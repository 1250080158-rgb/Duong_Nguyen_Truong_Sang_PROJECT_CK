using MedEquip.Api.Services;
using MedEquip.Domain;
using MedEquip.Domain.Entities;
using MedEquip.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace MedEquip.Api.Controllers;

[ApiController]
[Route("api/devices")]
[Authorize]
public class DevicesController(
    DataContext db,
    ISystemConfigService config,
    MedEquip.Api.Auth.CurrentUserAccessor currentUser) : ControllerBase
{
    // ===== Màn: DeviceList (điều phối) + DepartmentDevices (đầu mối khoa) =====
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? q, [FromQuery] int? departmentId, [FromQuery] string? status)
    {
        var today = DateOnly.FromDateTime(DateTime.Now);

        // Ngưỡng cảnh báo lấy từ cấu hình hệ thống (system_config) thay vì
        // hard-code 30 ngày ở từng màn — quản trị viên đổi ngưỡng thì mọi màn
        // cùng đổi theo.
        var warningDays = await config.GetIntAsync("warning_days_early", 30);

        var query = db.Equipment
            .Include(e => e.Model).ThenInclude(m => m!.Manufacturer)
            .Include(e => e.Department)
            .Include(e => e.MaintenanceSupplier)
            .AsQueryable();
        if (!string.IsNullOrEmpty(q))
            query = query.Where(e =>
                e.Serial.Contains(q) || e.Ma.Contains(q) ||
                e.Model!.Ten.Contains(q) || e.Department!.Ten.Contains(q));

        // Đầu mối khoa chỉ được xem thiết bị của khoa mình — chặn ở tầng API
        // chứ không chỉ lọc ở giao diện (lọc phía client là không an toàn:
        // gọi thẳng API vẫn thấy toàn viện).
        if (currentUser.VaiTro == UserRoles.DauMoiKhoa && currentUser.IdKhoa is int myKhoa)
            query = query.Where(e => e.IdKhoa == myKhoa);

        if (departmentId.HasValue) query = query.Where(e => e.IdKhoa == departmentId);
        if (!string.IsNullOrEmpty(status) && status != "Tất cả")
            query = query.Where(e => e.TrangThai == status);

        var items = await query.OrderBy(e => e.Ma).ToListAsync();
        // Tên field khớp src/api/types.ts (ApiDevice): idThietBi, idKhoa,
        // hanHieuChuan, pmKeTiep, ngayNhap — hooks.ts mapDevice đọc đúng những
        // tên này; đổi tên ở đây phải đổi song song types.ts.
        return Ok(items.Select(e => new
        {
            id = e.Ma,
            idThietBi = e.IdThietBi,
            name = e.Model!.Ten,
            model = e.Model.Ten,
            serial = e.Serial,
            department = e.Department!.Ten,
            idKhoa = e.IdKhoa,
            status = MapStatus(e, today, warningDays),
            hanHieuChuan = e.HanHieuChuan,
            daysLeft = e.HanHieuChuan.HasValue
                ? (int)(e.HanHieuChuan.Value.DayNumber - today.DayNumber) : (int?)null,
            pmCycle = e.Model.ChuKyPmNgay,
            pmKeTiep = e.PmKeTiep,
            manufacturer = e.Model.Manufacturer!.Ten,
            ngayNhap = e.NgayNhap,
            warrantyMonths = e.ThangBaoHanh,
            warrantyLeft = Math.Max(0,
                (e.NgayNhap.AddMonths(e.ThangBaoHanh).DayNumber - today.DayNumber) / 30),
            maintenanceContract = e.MaintenanceSupplier?.Ten,
        }));

        // Trạng thái suy biến SAP_HAN tính tại chỗ: còn hạn <= ngưỡng cảnh báo
        // lấy từ system_config (warning_days_early, mặc định 30 ngày).
        static string MapStatus(Equipment e, DateOnly today, int warningDays)
        {
            if (e.TrangThai is DeviceStatus.ThanhLy or DeviceStatus.DangSua or DeviceStatus.ChoHieuChuan)
                return e.TrangThai;
            if (e.HanHieuChuan.HasValue)
            {
                var days = e.HanHieuChuan.Value.DayNumber - today.DayNumber;
                if (days < 0) return DeviceStatus.ChoHieuChuan;
                if (days <= warningDays) return DeviceStatus.SapHan;
            }
            return DeviceStatus.HoatDong;
        }
    }

    // ===== Màn: DeviceDetail (timeline + bằng chứng + bảo hành) =====
    [HttpGet("{code}")]
    public async Task<IActionResult> GetByCode(string code)
    {
        var e = await db.Equipment
            .Include(x => x.Model).ThenInclude(m => m!.Manufacturer)
            .Include(x => x.Department)
            .Include(x => x.MaintenanceSupplier)
            .Include(x => x.WorkOrders).ThenInclude(w => w.Assignee)
            .Include(x => x.WorkOrders).ThenInclude(w => w.Evidence)
            // Hai collection (WorkOrders + Evidence lồng bên trong) trong một
            // truy vấn JOIN sẽ nhân chéo số dòng; tách truy vấn để tránh
            // cảnh báo EF 20504 và giữ chi phí tuyến tính.
            .AsSplitQuery()
            .FirstOrDefaultAsync(x => x.Ma == code);
        if (e is null) throw new BusinessException("NOT_FOUND", "Không tìm thấy thiết bị.", 404);

        // Dòng thời gian lấy từ view v_timeline_thiet_bi trong CSDL: gộp lịch
        // sử trạng thái, phiếu công tác và sự cố của thiết bị.
        var timelineRows = await ViewReader.QueryAsync(db,
            "SELECT thoi_diem, loai, tieu_de, chi_tiet, nguoi_thuc_hien, ma_phieu " +
            "FROM v_timeline_thiet_bi WHERE equipment_id = @id ORDER BY thoi_diem DESC",
            ("id", e.IdThietBi));

        var timeline = timelineRows.Select(r => new
        {
            type = r.Str("loai"),
            date = r.DateTimeValue("thoi_diem"),
            title = r.Str("tieu_de"),
            detail = r.Str("chi_tiet"),
            changedBy = r.Str("nguoi_thuc_hien"),
            workOrderCode = r.Str("ma_phieu"),
        }).ToList();

        return Ok(new
        {
            id = e.Ma,
            model = e.Model!.Ten,
            manufacturer = e.Model.Manufacturer!.Ten,
            serial = e.Serial,
            status = e.TrangThai,
            department = e.Department!.Ten,
            hanHieuChuan = e.HanHieuChuan,
            pmKeTiep = e.PmKeTiep,
            chuKyPmNgay = e.Model.ChuKyPmNgay,
            ngayNhap = e.NgayNhap,
            warrantyMonths = e.ThangBaoHanh,
            maintenanceContract = e.MaintenanceSupplier?.Ten,
            timeline,
        });
    }

    // ===== Admin tạo thiết bị mới (Danh mục nền) =====
    public record CreateDeviceRequest(
        int ModelId, string Serial, int DepartmentId, DateOnly ImportDate,
        int WarrantyMonths, int? MaintenanceSupplierId, string? Notes);

    [HttpPost]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> Create(CreateDeviceRequest req)
    {
        // Kiểm tra dữ liệu trước khi ghi: thiếu model/khoa hoặc serial rỗng
        // thì trả 400 rõ ràng, thay vì để khóa ngoại CSDL ném lỗi và người
        // dùng thấy HTTP 500.
        if (string.IsNullOrWhiteSpace(req.Serial))
            throw new BusinessException("SERIAL_REQUIRED", "Số serial là bắt buộc.", 400);
        if (req.ModelId <= 0)
            throw new BusinessException("MODEL_REQUIRED", "Phải chọn model thiết bị.", 400);
        if (req.DepartmentId <= 0)
            throw new BusinessException("DEPARTMENT_REQUIRED", "Phải chọn khoa phòng.", 400);
        if (req.ImportDate == default)
            throw new BusinessException("IMPORT_DATE_REQUIRED", "Phải nhập ngày nhập kho.", 400);
        if (req.WarrantyMonths < 0)
            throw new BusinessException("INVALID_WARRANTY", "Số tháng bảo hành không được nhỏ hơn 0.", 400);

        if (await db.Equipment.AnyAsync(x => x.Serial == req.Serial))
            throw new BusinessException("DUPLICATE_SERIAL", "Số serial đã tồn tại.", 409);

        var model = await db.EquipmentModels.FindAsync(req.ModelId)
            ?? throw new BusinessException("NOT_FOUND", "Không tìm thấy model.", 404);
        if (!await db.Departments.AnyAsync(d => d.IdKhoa == req.DepartmentId))
            throw new BusinessException("NOT_FOUND", "Không tìm thấy khoa phòng.", 404);

        var seq = await db.Equipment.CountAsync() + 1;
        var e = new Equipment
        {
            Ma = $"DEV-{seq:000}",
            IdModel = req.ModelId,
            Serial = req.Serial,
            IdKhoa = req.DepartmentId,
            TrangThai = DeviceStatus.HoatDong,
            NgayNhap = req.ImportDate,
            ThangBaoHanh = req.WarrantyMonths,
            IdNccBaoTri = req.MaintenanceSupplierId,
            GhiChu = req.Notes,
            HanHieuChuan = req.ImportDate.AddDays(model.ChuKyHcNgay),
            PmKeTiep = req.ImportDate.AddDays(model.ChuKyPmNgay),
        };
        db.Equipment.Add(e);
        await db.SaveChangesAsync();
        // Tên field camelCase tường minh — giao diện đọc `code` để mở
        // màn chi tiết của thiết bị vừa tạo.
        return CreatedAtAction(nameof(GetByCode), new { code = e.Ma },
            new { code = e.Ma, id = e.Ma, idThietBi = e.IdThietBi });
    }
}

[ApiController]
[Route("api/dashboard")]
[Authorize]
public class DashboardController(DataContext db, ISystemConfigService config) : ControllerBase
{
    /// <summary>Màn Dashboard điều phối: chỉ số tổng quan lấy từ view
    /// v_bang_dieu_khien trong CSDL, kèm danh sách sắp đến hạn và sự cố 12 tháng.</summary>
    [HttpGet]
    public async Task<IActionResult> Get()
    {
        var today = DateOnly.FromDateTime(DateTime.Now);
        // Ngưỡng "sắp đến hạn" lấy từ system_config (warning_days_early) —
        // đồng nhất với màn Danh sách thiết bị.
        var warningDays = await config.GetIntAsync("warning_days_early", 30);

        var kpiRows = await ViewReader.QueryAsync(db, "SELECT * FROM v_bang_dieu_khien");
        var kpi = kpiRows.FirstOrDefault() ?? new Row();

        // Danh sách thiết bị sắp đến hạn: lấy từ view v_equipment (đã có
        // sẵn cột days_left theo CURRENT_DATE của CSDL).
        var upcoming = await ViewReader.QueryAsync(db,
            "SELECT code, serial, days_left FROM v_equipment " +
            "WHERE calibration_expiry IS NOT NULL AND days_left >= 0 AND days_left <= @days " +
            "ORDER BY days_left ASC",
            ("days", warningDays));

        // Sự cố theo tháng: dùng khối THEO_THANG của view v_bao_cao_su_co.
        var incidentRows = await ViewReader.QueryAsync(db,
            "SELECT thang, so_luong FROM v_bao_cao_su_co WHERE khoa = 'THEO_THANG' ORDER BY thang");
        var byMonth = incidentRows.Select(r =>
        {
            var yyyymm = r.Int("thang");
            return new
            {
                month = $"{yyyymm / 100:0000}-{yyyymm % 100:00}",
                count = r.Int("so_luong"),
            };
        }).ToList();

        return Ok(new
        {
            deviceStatusCounts = new Dictionary<string, int>
            {
                [DeviceStatus.HoatDong] = kpi.Int("thiet_bi_hoat_dong"),
                [DeviceStatus.SapHan] = kpi.Int("thiet_bi_sap_han"),
                [DeviceStatus.ChoHieuChuan] = kpi.Int("thiet_bi_qua_han"),
                [DeviceStatus.DangSua] = kpi.Int("thiet_bi_dang_sua"),
                [DeviceStatus.ThanhLy] = kpi.Int("thiet_bi_thanh_ly"),
            },
            orderStatusCounts = new Dictionary<string, int>
            {
                [WOStatus.ChoPhanCong] = kpi.Int("cho_phan_cong"),
                [WOStatus.DangThucHien] = kpi.Int("dang_thuc_hien"),
                [WOStatus.ChoNghiemThu] = kpi.Int("cho_nghiem_thu"),
                [WOStatus.HoanThanh] = kpi.Int("hoan_thanh"),
                [WOStatus.TraLai] = kpi.Int("tra_lai"),
            },
            overdueDevices = kpi.Int("thiet_bi_qua_han"),
            upcomingDevices = kpi.Int("thiet_bi_sap_han"),
            // Tỷ lệ PM đúng hạn 6 tháng: view đã tính sẵn theo completed_at.
            pmOnTimeRate6M = kpi.Dec("pm_on_time_rate_6m"),
            upcomingCalibrations = upcoming.Select(r => new
            {
                code = r.Str("code"),
                serial = r.Str("serial"),
                daysLeft = r.Int("days_left"),
            }).ToList(),
            incidentsByMonth = byMonth,
        });
    }
}

[ApiController]
[Route("api/catalog")]
[Authorize]
public class CatalogController(DataContext db, IAuditService audit) : ControllerBase
{
    /// <summary>Màn Admin > Danh mục nền: model + chu kỳ PM/HC + dung sai.</summary>
    [HttpGet("models")]
    public async Task<IActionResult> GetModels() =>
        Ok(await db.EquipmentModels.Include(m => m.Manufacturer)
            .Select(m => new
            {
                idModel = m.IdModel, name = m.Ten, category = m.Loai,
                chuKyPmNgay = m.ChuKyPmNgay, chuKyHcNgay = m.ChuKyHcNgay,
                dungSaiHcPhanTram = m.DungSaiHcPhanTram,
                manufacturer = m.Manufacturer!.Ten,
            }).ToListAsync());

    /// <summary>
    /// Thêm model thiết bị.
    ///
    /// Tên field CỐ TÝ dùng đúng bộ tên của giao diện và của hợp đồng
    /// <c>src/api/types.ts</c> (ApiCatalogModel): idHang, chuKyPmNgay,
    /// chuKyHcNgay, dungSaiHcPhanTram. Trước đây máy chủ nhận
    /// ManufacturerId/PmCycleDays/... còn giao diện gửi idHang/chuKyPmNgay/...
    /// → các giá trị không bind, thành 0 → vi phạm khóa ngoại và ràng buộc
    /// CHECK trong CSDL → HTTP 500. System.Text.Json không phân biệt hoa
    /// thường nên vẫn bind được sau khi đổi tên thuộc tính.
    /// </summary>
    public record CreateModelRequest(
        string Name, int IdHang, string Category,
        int ChuKyPmNgay, int ChuKyHcNgay, decimal DungSaiHcPhanTram);

    [HttpPost("models")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> CreateModel(CreateModelRequest req)
    {
        // Kiểm tra dữ liệu trước khi ghi — luồng thay thế của UC-08 yêu cầu
        // máy chủ trả 400 khi dữ liệu không hợp lệ, không phải để ràng buộc
        // CSDL ném lỗi rồi người dùng thấy HTTP 500.
        if (string.IsNullOrWhiteSpace(req.Name))
            throw new BusinessException("INVALID_MODEL_NAME",
                "Tên model là bắt buộc.", 400);
        if (req.IdHang <= 0)
            throw new BusinessException("INVALID_MANUFACTURER",
                "Phải chọn hãng sản xuất của model.", 400);
        if (req.ChuKyPmNgay <= 0 || req.ChuKyHcNgay <= 0)
            throw new BusinessException("INVALID_CYCLE_DAYS",
                "Chu kỳ bảo trì và chu kỳ hiệu chuẩn phải lớn hơn 0 ngày.", 400);
        if (req.DungSaiHcPhanTram < 0)
            throw new BusinessException("INVALID_TOLERANCE",
                "Dung sai hiệu chuẩn không được nhỏ hơn 0.", 400);

        var hang = await db.Manufacturers.AnyAsync(h => h.IdHang == req.IdHang);
        if (!hang)
            throw new BusinessException("MANUFACTURER_NOT_FOUND",
                $"Hãng sản xuất #{req.IdHang} không tồn tại.", 404);

        // Kiểm tra trùng tên TRƯỚC khi ghi: để EF ném lỗi ràng buộc unique
        // thì người dùng chỉ thấy HTTP 500, không biết vì sao thêm mới thất
        // bại. Trả 409 kèm lý do rõ ràng.
        var duplicate = await db.EquipmentModels
            .Where(m => m.Ten == req.Name)
            .Select(m => m.IdModel)
            .FirstOrDefaultAsync();
        if (duplicate != 0)
            throw new BusinessException("MODEL_NAME_DUPLICATE",
                $"Model '{req.Name}' đã tồn tại (mã {duplicate}). Hãy dùng tên khác.", 409);

        var m = new EquipmentModel
        {
            Ten = req.Name, IdHang = req.IdHang, Loai = req.Category,
            ChuKyPmNgay = req.ChuKyPmNgay, ChuKyHcNgay = req.ChuKyHcNgay,
            DungSaiHcPhanTram = req.DungSaiHcPhanTram,
        };
        db.EquipmentModels.Add(m);
        await db.SaveChangesAsync();
        await audit.AppendAsync(User.Identity?.Name ?? "?", "CATALOG_CREATE", $"model {m.Ten}", "");
        return Ok(new { m.IdModel });
    }

    [HttpGet("departments")]
    public async Task<IActionResult> GetDepartments() =>
        Ok(await db.Departments.Select(d => new { idKhoa = d.IdKhoa, name = d.Ten, laLamSang = d.LaLamSang }).ToListAsync());

    [HttpGet("manufacturers")]
    public async Task<IActionResult> GetManufacturers() =>
        Ok(await db.Manufacturers.Select(m => new { idHang = m.IdHang, name = m.Ten }).ToListAsync());

    [HttpGet("suppliers")]
    public async Task<IActionResult> GetSuppliers() =>
        Ok(await db.Suppliers.Select(s => new { idNcc = s.IdNcc, name = s.Ten }).ToListAsync());

    [HttpGet("evidence-config")]
    public async Task<IActionResult> GetEvidenceConfig() =>
        // FE (ApiEvidenceConfig) đọc mã bằng chứng ở field "maBangChung".
        Ok(await db.RequiredEvidenceConfig.OrderBy(c => c.OrderType).ThenBy(c => c.SortOrder)
            .Select(c => new
            {
                c.ConfigId, c.OrderType, maBangChung = c.EvidenceCode, c.Label,
                c.IsRequired, c.MaxFiles, c.AcceptMime, c.SortOrder,
            }).ToListAsync());

    /// <summary>
    /// Danh mục nền gộp một lần: model + khoa + hãng + nhà cung cấp + quy
    /// tắc bằng chứng. Báo cáo đồ án mô tả giao diện gọi "GET /api/catalog"
    /// (models, departments, manufacturers, suppliers, evidence-config) —
    /// các route con ở trên vẫn giữ nguyên để gọi riêng từng nhóm.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var models = await db.EquipmentModels.Include(m => m.Manufacturer)
            .Select(m => new
            {
                idModel = m.IdModel, name = m.Ten, category = m.Loai,
                chuKyPmNgay = m.ChuKyPmNgay, chuKyHcNgay = m.ChuKyHcNgay,
                dungSaiHcPhanTram = m.DungSaiHcPhanTram,
                manufacturer = m.Manufacturer!.Ten,
            }).ToListAsync();

        var departments = await db.Departments
            .Select(d => new { idKhoa = d.IdKhoa, name = d.Ten, laLamSang = d.LaLamSang })
            .ToListAsync();

        var manufacturers = await db.Manufacturers
            .Select(m => new { idHang = m.IdHang, name = m.Ten }).ToListAsync();

        var suppliers = await db.Suppliers
            .Select(s => new { idNcc = s.IdNcc, name = s.Ten }).ToListAsync();

        var evidenceConfig = await db.RequiredEvidenceConfig
            .OrderBy(c => c.OrderType).ThenBy(c => c.SortOrder)
            .Select(c => new
            {
                c.ConfigId, c.OrderType, maBangChung = c.EvidenceCode, c.Label,
                c.IsRequired, c.MaxFiles, c.AcceptMime, c.SortOrder,
            }).ToListAsync();

        return Ok(new
        {
            models,
            departments,
            manufacturers,
            suppliers,
            evidenceConfig,
        });
    }
}

[ApiController]
[Route("api/reports")]
// Báo cáo (FR-14) dành cho Điều phối và Quản trị. Trước đây chỉ [Authorize]
// nên kỹ thuật viên và đầu mối khoa gọi được API báo cáo dù giao diện
// không có màn cho họ.
[Authorize(Roles = "ADMIN,DIEU_PHOI")]
public class ReportsController(DataContext db) : ControllerBase
{
    /// <summary>Màn Reports: 4 loại báo cáo — lấy số liệu trực tiếp từ các
    /// view báo cáo trong CSDL (v_bao_cao_hieu_chuan, v_bao_cao_su_co,
    /// v_bao_cao_pm, v_bao_cao_bang_chung) như báo cáo đồ án mô tả.</summary>
    [HttpGet("{kind}")]
    public async Task<IActionResult> Get(string kind)
    {
        switch (kind)
        {
            case "calibration":
            {
                var rows = await ViewReader.QueryAsync(db,
                    "SELECT code, model, department, calibration_expiry, days_left, status " +
                    "FROM v_bao_cao_hieu_chuan ORDER BY days_left ASC");
                return Ok(rows.Select(r => new
                {
                    code = r.Str("code"),
                    model = r.Str("model"),
                    department = r.Str("department"),
                    hanHieuChuan = r.DateIso("calibration_expiry"),
                    daysLeft = r.Int("days_left"),
                    status = r.Str("status"),
                }));
            }
            case "incidents":
            {
                // View trả về hai khối: THEO_MODEL (ten = tên model) và
                // THEO_THANG (ten = MM-YYYY, thang = YYYYMM).
                var rows = await ViewReader.QueryAsync(db,
                    "SELECT khoa, ten, so_luong, thang FROM v_bao_cao_su_co");

                var byModel = rows.Where(r => r.Str("khoa") == "THEO_MODEL")
                    .Select(r => new { model = r.Str("ten"), count = r.Int("so_luong") })
                    .OrderByDescending(x => x.count)
                    .ToList();

                var trend = rows.Where(r => r.Str("khoa") == "THEO_THANG")
                    .Select(r =>
                    {
                        var yyyymm = r.Int("thang");
                        return new
                        {
                            month = $"{yyyymm / 100:0000}-{yyyymm % 100:00}",
                            count = r.Int("so_luong"),
                        };
                    })
                    .OrderBy(x => x.month)
                    .ToList();

                // Số sự cố đang mở: view chỉ gom nhóm theo model và tháng,
                // nên lấy thêm một số đếm trực tiếp trên bảng incidents.
                var open = await db.Incidents.CountAsync(i => i.TrangThai != "DONG");

                return Ok(new
                {
                    total = byModel.Sum(x => x.count),
                    open,
                    byModel,
                    trend,
                });
            }
            case "pm":
            {
                // on_time trong view = đã hoàn thành và hoàn thành đúng hạn.
                var rows = await ViewReader.QueryAsync(db,
                    "SELECT technician, total, completed, on_time FROM v_bao_cao_pm");
                return Ok(rows.Select(r => new
                {
                    technician = r.Str("technician"),
                    total = r.Int("total"),
                    completed = r.Int("completed"),
                    onTime = r.Int("on_time"),
                }));
            }
            case "evidence":
            {
                var rows = await ViewReader.QueryAsync(db,
                    "SELECT code, order_type, required, provided, complete " +
                    "FROM v_bao_cao_bang_chung ORDER BY code");
                return Ok(rows.Select(r => new
                {
                    code = r.Str("code"),
                    orderType = r.Str("order_type"),
                    required = r.Int("required"),
                    provided = r.Int("provided"),
                    complete = r.Int("complete") == 1,
                }));
            }
            default:
                throw new BusinessException("UNKNOWN_REPORT", $"Loại báo cáo '{kind}' không tồn tại.", 400);
        }
    }
}
