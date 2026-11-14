using MedEquip.Domain;
using Microsoft.EntityFrameworkCore;

namespace MedEquip.Infrastructure.Services;

/// <summary>
/// Đọc cấu hình hệ thống trong bảng <c>system_config</c>.
///
/// Bảng này được quản trị viên sửa từ màn "Admin > Cấu hình hệ thống". Trước
/// đây các ngưỡng cảnh báo (warning_days_early / urgent / critical) nằm trong
/// CSDL nhưng mã nguồn hard-code 30/7 ngày, nên sửa cấu hình không có tác
/// dụng gì. Tập trung việc đọc vào một chỗ để mọi màn cùng dùng một con số.
/// </summary>
public class SystemConfigService(DataContext db) : ISystemConfigService
{
    /// <summary>
    /// Đọc một khóa cấu hình dạng số. Không có khóa, rỗng hoặc không phải số
    /// thì trả về <paramref name="fallback"/> — máy chủ phải chạy được dù
    /// CSDL thiếu cấu hình.
    /// </summary>
    public async Task<int> GetIntAsync(string key, int fallback)
    {
        var raw = await db.SystemConfig
            .Where(c => c.ConfigKey == key)
            .Select(c => c.ConfigValue)
            .FirstOrDefaultAsync();

        if (string.IsNullOrWhiteSpace(raw)) return fallback;
        return int.TryParse(raw.Trim(), out var value) ? value : fallback;
    }
}
