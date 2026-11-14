using MedEquip.Domain;
using MedEquip.Infrastructure;
using MedEquip.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;

namespace MedEquip.Api.Services;

/// <summary>
/// Dịch vụ nền: tự khóa thiết bị quá hạn hiệu chuẩn và cảnh báo sắp hết hạn.
///
/// Báo cáo đồ án mô tả "tự động khóa BR-01" như một chức năng chạy hằng
/// ngày. Trong CSDL có hàm <c>fn_khoa_thiet_bi_qua_han()</c> (khóa thiết bị,
/// ghi lịch sử, ghi audit AUTO_LOCK nối tiếp chuỗi băm, báo cho điều phối)
/// nhưng trước đây KHÔNG có gọi nó ở đâu: không có pg_cron trong Docker
/// Compose, không có job nào trong máy chủ. Hệ quả là thiết bị quá hạn
/// không bao giờ chuyển sang CHO_HIEU_CHUAN trong CSDL.
///
/// Dịch vụ này chạy một lần lúc khởi động và sau đó mỗi 24 giờ:
///   1. gọi hàm khóa của CSDL (tầng CSDL giữ nguyên vai trò ghi audit băm);
///   2. gửi cảnh báo "sắp hết hạn" theo ngưỡng trong system_config:
///      warning_days_urgent (mặc định 7 ngày) → điều phối,
///      warning_days_critical (mặc định 1 ngày) → thêm đầu mối khoa phụ trách.
///
/// Mọi thao tác đều bọc try/catch: lỗi lặp lại không được làm sập máy chủ.
/// </summary>
public class AutoLockService(
    IServiceScopeFactory scopeFactory,
    ILogger<AutoLockService> logger) : BackgroundService
{
    /// <summary>Chu kỳ quét: 24 giờ (đúng như "chạy hằng ngày" trong báo cáo).</summary>
    private static readonly TimeSpan Interval = TimeSpan.FromHours(24);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        // Chờ một chút cho kết nối CSDL sẵn sàng rồi mới chạy vòng đầu.
        try { await Task.Delay(TimeSpan.FromSeconds(10), stoppingToken); }
        catch (OperationCanceledException) { return; }

        while (!stoppingToken.IsCancellationRequested)
        {
            try { await RunOnceAsync(stoppingToken); }
            catch (OperationCanceledException) { return; }
            catch (Exception ex)
            {
                logger.LogError(ex, "Vòng tự khóa BR-01 thất bại");
            }

            try { await Task.Delay(Interval, stoppingToken); }
            catch (OperationCanceledException) { return; }
        }
    }

    /// <summary>Chạy một vòng: khóa quá hạn + cảnh báo sắp hết hạn.</summary>
    public async Task RunOnceAsync(CancellationToken ct = default)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<DataContext>();
        var config = scope.ServiceProvider.GetRequiredService<ISystemConfigService>();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<AutoLockService>>();

        var locked = await LockOverdueEquipmentAsync(db, ct);
        if (locked > 0)
            logger.LogInformation("BR-01: đã tự khóa {So} thiết bị quá hạn hiệu chuẩn", locked);

        var urgentDays = await config.GetIntAsync("warning_days_urgent", 7);
        var criticalDays = await config.GetIntAsync("warning_days_critical", 1);
        var warned = await WarnExpiringEquipmentAsync(db, urgentDays, criticalDays, ct);
        if (warned > 0)
            logger.LogInformation("BR-01: đã gửi {So} cảnh báo sắp hết hạn hiệu chuẩn", warned);
    }

    /// <summary>Gọi hàm khóa của CSDL. Trả về số thiết bị bị khóa.</summary>
    private static async Task<int> LockOverdueEquipmentAsync(DataContext db, CancellationToken ct)
    {
        var connection = db.Database.GetDbConnection();
        var opened = connection.State != System.Data.ConnectionState.Open;
        if (opened) await connection.OpenAsync(ct);

        try
        {
            await using var command = connection.CreateCommand();
            command.CommandText = "SELECT * FROM fn_khoa_thiet_bi_qua_han()";
            await using var reader = await command.ExecuteReaderAsync(ct);
            var count = 0;
            while (await reader.ReadAsync(ct)) count++;
            return count;
        }
        finally
        {
            if (opened) await connection.CloseAsync();
        }
    }

    /// <summary>
    /// Gửi cảnh báo cho thiết bị sắp hết hạn hiệu chuẩn.
    /// Không gửi trùng: mỗi thiết bị mỗi mốc cảnh báo chỉ nhận một thông báo
    /// trong ngày.
    /// </summary>
    private static async Task<int> WarnExpiringEquipmentAsync(
        DataContext db, int urgentDays, int criticalDays, CancellationToken ct)
    {
        var today = DateOnly.FromDateTime(DateTime.Now);

        var devices = await db.Equipment
            .Include(e => e.Department)
            .Where(e => e.HanHieuChuan.HasValue
                        && e.TrangThai != DeviceStatus.ThanhLy
                        && e.TrangThai != DeviceStatus.ChoHieuChuan)
            .ToListAsync(ct);

        var coordinators = await db.Users
            .Where(u => u.VaiTro == UserRoles.DieuPhoi && u.HoatDong)
            .Select(u => u.IdNguoiDung)
            .ToListAsync(ct);

        var deptHeads = await db.Users
            .Where(u => u.VaiTro == UserRoles.DauMoiKhoa && u.HoatDong)
            .Select(u => new { u.IdNguoiDung, u.IdKhoa })
            .ToListAsync(ct);

        var startOfToday = DateTime.UtcNow.Date;
        // Khoá chống gửi trùng: mỗi (loại cảnh báo, thiết bị) chỉ nhận một
        // thông báo trong ngày. Liên kết "/coordinator/devices/{mã}" là định
        // danh ổn định để đối chiếu.
        var sentToday = (await db.Notifications
            .Where(n => n.CreatedAt >= startOfToday
                        && (n.Type == "HC_SAP_HAN" || n.Type == "HC_KHAN_CAP"))
            .Select(n => new { n.Type, n.Link })
            .ToListAsync(ct))
            .Select(n => $"{n.Type}|{n.Link}")
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var count = 0;
        foreach (var device in devices)
        {
            var daysLeft = device.HanHieuChuan!.Value.DayNumber - today.DayNumber;
            if (daysLeft < 0) continue;

            var link = $"/coordinator/devices/{device.Ma}";

            // Cảnh báo khẩn cấp (mặc định 1 ngày): điều phối + đầu mối khoa.
            var criticalKey = $"HC_KHAN_CAP|{link}";
            if (daysLeft <= criticalDays && sentToday.Add(criticalKey))
            {
                foreach (var head in deptHeads.Where(h => h.IdKhoa == device.IdKhoa))
                {
                    db.Notifications.Add(new Notification
                    {
                        UserId = head.IdNguoiDung,
                        Type = "HC_KHAN_CAP",
                        Message = $"Thiết bị {device.Ma} sắp hết hạn hiệu chuẩn ({daysLeft} ngày) — "
                                  + "khoa phụ trách cần sắp xếp hiệu chuẩn",
                        Link = link,
                        IsRead = false,
                        CreatedAt = DateTime.UtcNow,
                    });
                    count++;
                }
                foreach (var coordinator in coordinators)
                {
                    db.Notifications.Add(new Notification
                    {
                        UserId = coordinator,
                        Type = "HC_KHAN_CAP",
                        Message = $"Thiết bị {device.Ma} sắp hết hạn hiệu chuẩn ({daysLeft} ngày) — "
                                  + "cần lên phiếu hiệu chuẩn",
                        Link = link,
                        IsRead = false,
                        CreatedAt = DateTime.UtcNow,
                    });
                    count++;
                }
            }

            // Cảnh báo gấp (mặc định 7 ngày): điều phối.
            var urgentKey = $"HC_SAP_HAN|{link}";
            if (daysLeft <= urgentDays && sentToday.Add(urgentKey))
            {
                foreach (var coordinator in coordinators)
                {
                    db.Notifications.Add(new Notification
                    {
                        UserId = coordinator,
                        Type = "HC_SAP_HAN",
                        Message = $"Thiết bị {device.Ma} sắp hết hạn hiệu chuẩn ({daysLeft} ngày)",
                        Link = link,
                        IsRead = false,
                        CreatedAt = DateTime.UtcNow,
                    });
                    count++;
                }
            }
        }

        if (count > 0) await db.SaveChangesAsync(ct);
        return count;
    }
}
