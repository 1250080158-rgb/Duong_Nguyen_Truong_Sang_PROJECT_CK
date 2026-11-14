using Microsoft.Extensions.Logging;
using System.Security.Cryptography;
using System.Text;
using MedEquip.Domain;
using MedEquip.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MedEquip.Infrastructure;

/// <summary>
/// Dữ liệu dự phòng cho trường hợp bảng <c>equipment</c> còn rỗng (ví dụ mới
/// tạo CSDL mà chưa nạp script). Bộ dữ liệu chính dùng trong học tập /
/// trình diễn nằm trong <c>database/QLTBYT.sql</c> — script đó tạo đầy đủ
/// bảng, trigger BR-01, view và 45 thiết bị cùng 47 phiếu công tác.
/// Seeder này chỉ chạy khi bảng <c>equipment</c> thực sự trống.
/// </summary>
public static class DbSeeder
{
    public static async Task SeedIfEmptyAsync(DataContext db, ILogger logger)
    {
        if (!await db.Database.CanConnectAsync())
        {
            logger.LogError(
                "Không kết nối được PostgreSQL. Hãy nạp database/QLTBYT.sql trước " +
                "(psql -U sa -h localhost -d qltbyt -f database/QLTBYT.sql) và kiểm tra " +
                "ConnectionStrings:MedEquip trong appsettings.json.");
            return;
        }
        try { if (await db.Equipment.AnyAsync()) return; } catch { return; }

        logger.LogInformation("CSDL rỗng — đang seed dữ liệu mẫu MED-EQUIP...");

        db.Departments.AddRange(
            new Department { Ten = "Hóa sinh" }, new Department { Ten = "Huyết học" },
            new Department { Ten = "ICU" }, new Department { Ten = "Chẩn đoán hình ảnh" },
            new Department { Ten = "Tim mạch" }, new Department { Ten = "Phòng VTYT", LaLamSang = false },
            new Department { Ten = "CNTT", LaLamSang = false });
        await db.SaveChangesAsync();

        db.Manufacturers.AddRange(
            new Manufacturer { Ten = "Mindray" }, new Manufacturer { Ten = "Sysmex" },
            new Manufacturer { Ten = "Hamilton Medical" }, new Manufacturer { Ten = "GE Healthcare" },
            new Manufacturer { Ten = "Nihon Kohden" }, new Manufacturer { Ten = "Carestream" },
            new Manufacturer { Ten = "Eppendorf" });

        db.Suppliers.AddRange(
            new Supplier { Ten = "Dräger VN" }, new Supplier { Ten = "Sysmex VN" },
            new Supplier { Ten = "BMT Medical" }, new Supplier { Ten = "GE Healthcare VN" },
            new Supplier { Ten = "NK VN" }, new Supplier { Ten = "Carestream Asia" },
            new Supplier { Ten = "Eppendorf VN" });
        await db.SaveChangesAsync();

        db.EquipmentModels.AddRange(
            new EquipmentModel { Ten = "Mindray BS-240", IdHang = 1, Loai = "Sinh phẩm", ChuKyPmNgay = 90, ChuKyHcNgay = 365, DungSaiHcPhanTram = 2.50m },
            new EquipmentModel { Ten = "Sysmex XN-1000", IdHang = 2, Loai = "Huyết học", ChuKyPmNgay = 60, ChuKyHcNgay = 365, DungSaiHcPhanTram = 2.50m },
            new EquipmentModel { Ten = "Hamilton G5", IdHang = 3, Loai = "Hô hấp", ChuKyPmNgay = 180, ChuKyHcNgay = 365, DungSaiHcPhanTram = 3.00m },
            new EquipmentModel { Ten = "GE LOGIQ E9", IdHang = 4, Loai = "Siêu âm", ChuKyPmNgay = 365, ChuKyHcNgay = 365, DungSaiHcPhanTram = 5.00m },
            new EquipmentModel { Ten = "Nihon Kohden ECG-2150", IdHang = 5, Loai = "Tim mạch", ChuKyPmNgay = 180, ChuKyHcNgay = 365, DungSaiHcPhanTram = 5.00m },
            new EquipmentModel { Ten = "Carestream DR 600", IdHang = 6, Loai = "X-quang", ChuKyPmNgay = 365, ChuKyHcNgay = 365, DungSaiHcPhanTram = 3.00m },
            new EquipmentModel { Ten = "Eppendorf 5430R", IdHang = 7, Loai = "Xét nghiệm", ChuKyPmNgay = 180, ChuKyHcNgay = 365, DungSaiHcPhanTram = 2.00m });
        await db.SaveChangesAsync();

        db.Equipment.AddRange(
            new Equipment { Ma = "DEV-001", IdModel = 1, Serial = "SN-12345", IdKhoa = 1, TrangThai = DeviceStatus.HoatDong, HanHieuChuan = new DateOnly(2027, 2, 15), PmKeTiep = new DateOnly(2026, 11, 10), NgayNhap = new DateOnly(2022, 3, 15), ThangBaoHanh = 24, IdNccBaoTri = 1 },
            new Equipment { Ma = "DEV-002", IdModel = 1, Serial = "SN-12346", IdKhoa = 1, TrangThai = DeviceStatus.ChoHieuChuan, HanHieuChuan = new DateOnly(2026, 8, 1), NgayNhap = new DateOnly(2022, 3, 15), ThangBaoHanh = 24, IdNccBaoTri = 1 },
            new Equipment { Ma = "DEV-003", IdModel = 2, Serial = "SN-00912", IdKhoa = 2, TrangThai = DeviceStatus.DangSua, HanHieuChuan = new DateOnly(2026, 11, 20), NgayNhap = new DateOnly(2021, 6, 8), ThangBaoHanh = 36, IdNccBaoTri = 2 },
            new Equipment { Ma = "DEV-004", IdModel = 3, Serial = "SN-44210", IdKhoa = 3, TrangThai = DeviceStatus.SapHan, HanHieuChuan = new DateOnly(2026, 10, 18), PmKeTiep = new DateOnly(2026, 10, 18), NgayNhap = new DateOnly(2020, 9, 1), ThangBaoHanh = 24, IdNccBaoTri = 3 },
            new Equipment { Ma = "DEV-005", IdModel = 4, Serial = "SN-78123", IdKhoa = 4, TrangThai = DeviceStatus.HoatDong, HanHieuChuan = new DateOnly(2027, 4, 5), PmKeTiep = new DateOnly(2027, 4, 5), NgayNhap = new DateOnly(2023, 4, 20), ThangBaoHanh = 24, IdNccBaoTri = 4 },
            new Equipment { Ma = "DEV-006", IdModel = 5, Serial = "SN-33901", IdKhoa = 5, TrangThai = DeviceStatus.HoatDong, HanHieuChuan = new DateOnly(2026, 12, 29), PmKeTiep = new DateOnly(2026, 12, 29), NgayNhap = new DateOnly(2022, 12, 10), ThangBaoHanh = 24, IdNccBaoTri = 5 },
            new Equipment { Ma = "DEV-007", IdModel = 6, Serial = "SN-55820", IdKhoa = 4, TrangThai = DeviceStatus.ChoHieuChuan, HanHieuChuan = new DateOnly(2026, 8, 10), NgayNhap = new DateOnly(2020, 7, 14), ThangBaoHanh = 36, IdNccBaoTri = 6 },
            new Equipment { Ma = "DEV-008", IdModel = 7, Serial = "SN-20034", IdKhoa = 1, TrangThai = DeviceStatus.HoatDong, HanHieuChuan = new DateOnly(2027, 1, 12), PmKeTiep = new DateOnly(2027, 1, 12), NgayNhap = new DateOnly(2023, 1, 30), ThangBaoHanh = 12, IdNccBaoTri = 7 });

        db.Users.AddRange(
            new User { TenDangNhap = "minhvt", HoTen = "Nguyễn Minh Vĩnh Thịnh", VaiTro = UserRoles.KyThuatVien, IdKhoa = 6, DangNhapCuoi = new DateTime(2026, 9, 24, 8, 15, 0) },
            new User { TenDangNhap = "hungtv", HoTen = "Trần Văn Hùng", VaiTro = UserRoles.KyThuatVien, IdKhoa = 6, DangNhapCuoi = new DateTime(2026, 9, 24, 7, 50, 0) },
            new User { TenDangNhap = "dphuong", HoTen = "Phạm Thị Diễm Phương", VaiTro = UserRoles.DieuPhoi, IdKhoa = 6, DangNhapCuoi = new DateTime(2026, 9, 24, 8, 2, 0) },
            new User { TenDangNhap = "lthimai", HoTen = "Lê Thị Mai", VaiTro = UserRoles.KyThuatVien, IdKhoa = 6, DangNhapCuoi = new DateTime(2026, 9, 23, 16, 45, 0) },
            new User { TenDangNhap = "vanna", HoTen = "Nguyễn Thị Ánh Vân", VaiTro = UserRoles.DauMoiKhoa, IdKhoa = 1, DangNhapCuoi = new DateTime(2026, 9, 22, 14, 30, 0) },
            new User { TenDangNhap = "khaibq", HoTen = "Bùi Quang Khải", VaiTro = UserRoles.DauMoiKhoa, IdKhoa = 3, DangNhapCuoi = new DateTime(2026, 9, 20, 9, 10, 0) },
            new User { TenDangNhap = "longhduc", HoTen = "Hoàng Đức Long", VaiTro = UserRoles.Admin, IdKhoa = 7, DangNhapCuoi = new DateTime(2026, 9, 24, 8, 0, 0) },
            new User { TenDangNhap = "ngocttb", HoTen = "Trịnh Thị Bích Ngọc", VaiTro = UserRoles.DauMoiKhoa, IdKhoa = 5, DangNhapCuoi = new DateTime(2026, 9, 15, 11, 20, 0), HoatDong = false });
        await db.SaveChangesAsync();

        db.WorkOrders.AddRange(
            new WorkOrder { Ma = "HC-2026-0087", LoaiPhieu = "HC", IdThietBi = 2, IdKhoa = 1, IdNguoiThucHien = 1, TrangThai = WOStatus.DangThucHien, UuTien = Priority.Khan, NgayTao = new DateOnly(2026, 9, 2), HanChot = new DateOnly(2026, 9, 25), Progress = 40 },
            new WorkOrder { Ma = "PM-2026-0201", LoaiPhieu = "PM", IdThietBi = 4, IdKhoa = 3, IdNguoiThucHien = 2, TrangThai = WOStatus.ChoPhanCong, UuTien = Priority.BinhThuong, NgayTao = new DateOnly(2026, 9, 20), HanChot = new DateOnly(2026, 10, 10) },
            new WorkOrder { Ma = "SC-2026-0102", LoaiPhieu = "SC", IdThietBi = 3, IdKhoa = 2, IdNguoiThucHien = 2, TrangThai = WOStatus.DangThucHien, UuTien = Priority.Khan, NgayTao = new DateOnly(2026, 9, 18), HanChot = new DateOnly(2026, 9, 26), Progress = 70 },
            new WorkOrder { Ma = "HC-2026-0091", LoaiPhieu = "HC", IdThietBi = 7, IdKhoa = 4, IdNguoiThucHien = 4, TrangThai = WOStatus.ChoPhanCong, UuTien = Priority.Khan, NgayTao = new DateOnly(2026, 9, 21), HanChot = new DateOnly(2026, 9, 28) },
            new WorkOrder { Ma = "PM-2026-0195", LoaiPhieu = "PM", IdThietBi = 5, IdKhoa = 4, IdNguoiThucHien = 1, TrangThai = WOStatus.ChoNghiemThu, UuTien = Priority.BinhThuong, NgayTao = new DateOnly(2026, 9, 10), HanChot = new DateOnly(2026, 9, 20), Progress = 100 },
            new WorkOrder { Ma = "SC-2026-0088", LoaiPhieu = "SC", IdThietBi = 2, IdKhoa = 1, TrangThai = WOStatus.ChoPhanCong, UuTien = Priority.Khan, NgayTao = new DateOnly(2026, 9, 15), HanChot = new DateOnly(2026, 9, 30) });
        await db.SaveChangesAsync();

        db.WorkOrderSteps.AddRange(
            new WorkOrderStep { IdPhieu = 1, ThuTu = 1, TieuDe = "Vệ sinh buồng phản ứng", RequirePhoto = true, HoanThanh = true },
            new WorkOrderStep { IdPhieu = 1, ThuTu = 2, TieuDe = "Chuẩn 5.0 mmol/L", GiaTriChuan = 5.0000m, DungSaiPhanTram = 2.50m, GiaTriDo = 5.0400m, Result = "DAT", HoanThanh = true },
            new WorkOrderStep { IdPhieu = 1, ThuTu = 3, TieuDe = "Chuẩn 12.0 mmol/L", GiaTriChuan = 12.0000m, DungSaiPhanTram = 2.50m },
            new WorkOrderStep { IdPhieu = 1, ThuTu = 4, TieuDe = "Thử nghiệm an toàn (IEC 60601)", RequirePhoto = true },
            new WorkOrderStep { IdPhieu = 1, ThuTu = 5, TieuDe = "Dán tem hiệu chuẩn mới", RequirePhoto = true });

        db.RequiredEvidenceConfig.AddRange(
            new RequiredEvidenceConfig { OrderType = "HC", EvidenceCode = "ANH_TRUOC", Label = "Ảnh trước khi thực hiện" },
            new RequiredEvidenceConfig { OrderType = "HC", EvidenceCode = "ANH_KET_QUA", Label = "Ảnh kết quả chuẩn hóa" },
            new RequiredEvidenceConfig { OrderType = "HC", EvidenceCode = "ANH_TEM", Label = "Ảnh tem hiệu chuẩn mới" },
            new RequiredEvidenceConfig { OrderType = "HC", EvidenceCode = "CHUNG_CHI_PDF", Label = "Chứng chỉ hiệu chuẩn PDF" },
            new RequiredEvidenceConfig { OrderType = "SC", EvidenceCode = "ANH_TRUOC_SUA", Label = "Ảnh trước sửa chữa" },
            new RequiredEvidenceConfig { OrderType = "SC", EvidenceCode = "ANH_SAU_SUA", Label = "Ảnh sau sửa chữa" },
            new RequiredEvidenceConfig { OrderType = "SC", EvidenceCode = "BIEN_BAN_LINH_KIEN", Label = "Biên bản linh kiện thay thế" },
            new RequiredEvidenceConfig { OrderType = "PM", EvidenceCode = "ANH_NHOM_BUOC", Label = "Ảnh từng nhóm bước" },
            new RequiredEvidenceConfig { OrderType = "PM", EvidenceCode = "CHECKLIST_DAY_DU", Label = "Checklist hoàn thành 100%" });

        db.Evidence.AddRange(
            new Evidence { IdPhieu = 1, MaBangChung = "ANH_TRUOC", TenTep = "truoc_hc.jpg", DuongDanTep = "/evidence/HC-2026-0087/truoc_hc.jpg", MaBam = Rep('a'), FileSizeKb = 420, TaiBoi = 1, TaiLuc = new DateTime(2026, 9, 24, 9, 0, 0) },
            new Evidence { IdPhieu = 1, MaBangChung = "ANH_KET_QUA", TenTep = "ketqua_hc.jpg", DuongDanTep = "/evidence/HC-2026-0087/ketqua_hc.jpg", MaBam = Rep('b'), FileSizeKb = 380, TaiBoi = 1, TaiLuc = new DateTime(2026, 9, 24, 10, 30, 0) },
            new Evidence { IdPhieu = 5, MaBangChung = "ANH_NHOM_BUOC", TenTep = "pm1.jpg", DuongDanTep = "/evidence/PM-2026-0195/pm1.jpg", MaBam = Rep('c'), FileSizeKb = 510, TaiBoi = 1, TaiLuc = new DateTime(2026, 9, 19, 15, 0, 0) },
            new Evidence { IdPhieu = 5, MaBangChung = "CHECKLIST_DAY_DU", TenTep = "checklist.pdf", DuongDanTep = "/evidence/PM-2026-0195/checklist.pdf", MaBam = Rep('d'), FileSizeKb = 220, TaiBoi = 1, TaiLuc = new DateTime(2026, 9, 19, 15, 5, 0) });

        db.Incidents.AddRange(
            new Incident { Ma = "INC-2026-0031", IdThietBi = 5, BaoBoi = 5, MoTa = "Màn hình bị nhiễu, ảnh siêu âm có vạch kẻ", MucDo = "SO_BO", TrangThai = "DA_TAO_PHIEU", CreatedAt = new DateTime(2026, 9, 24, 7, 58, 0), IdPhieu = 5 },
            new Incident { Ma = "INC-2026-0030", IdThietBi = 2, BaoBoi = 5, MoTa = "Máy không khởi động, màn hình đen", MucDo = "KHAN", TrangThai = "DA_TIEP_NHAN", CreatedAt = new DateTime(2026, 9, 15, 9, 0, 0) });

        db.SystemConfig.AddRange(
            // updated_at là NOT NULL: thiếu giá trị, EF ghi NULL → vi phạm
            // ràng buộc và seed nổ ngay khi CSDL còn trống.
            new SystemConfig { ConfigKey = "warning_days_early", ConfigValue = "30", Description = "Cảnh báo sớm (badge vàng) trước khi hết hạn hiệu chuẩn", UpdatedAt = DateTime.UtcNow },
            new SystemConfig { ConfigKey = "warning_days_urgent", ConfigValue = "7", Description = "Cảnh báo gấp (badge đỏ nhấp nháy)", UpdatedAt = DateTime.UtcNow },
            new SystemConfig { ConfigKey = "warning_days_critical", ConfigValue = "1", Description = "Cảnh báo khẩn cấp (push email)", UpdatedAt = DateTime.UtcNow },
            new SystemConfig { ConfigKey = "auto_lock_on_expiry", ConfigValue = "true", Description = "Tự động khóa thiết bị khi hết hạn hiệu chuẩn", UpdatedAt = DateTime.UtcNow },
            new SystemConfig { ConfigKey = "evidence_immutable_after_complete", ConfigValue = "true", Description = "Bằng chứng không sửa/xóa sau khi phiếu hoàn thành", UpdatedAt = DateTime.UtcNow });

        db.Notifications.AddRange(
            new Notification { UserId = 3, Type = "HC_QUA_HAN", Message = "BS-240 SN-12346 quá hạn hiệu chuẩn 23 ngày", CreatedAt = new DateTime(2026, 9, 24, 8, 12, 0) },
            new Notification { UserId = 3, Type = "HC_SAP_HAN", Message = "HAMILTON-G5 còn 24 ngày đến hạn hiệu chuẩn", CreatedAt = new DateTime(2026, 9, 24, 8, 12, 0) },
            new Notification { UserId = 3, Type = "HC_QUA_HAN", Message = "X-quang DR 600 tự động khóa — quá hạn 14 ngày", CreatedAt = new DateTime(2026, 9, 24, 8, 12, 0) },
            new Notification { UserId = 3, Type = "WO_CHO_NGHIEM_THU", Message = "Phiếu #PM-2026-0195 đã hoàn thành — chờ nghiệm thu", CreatedAt = new DateTime(2026, 9, 23, 16, 0, 0) });

        await db.SaveChangesAsync();

        // Audit log 7 dòng — chuỗi hash tính bằng cùng thuật toán AuditService
        var logs = new (DateTime at, string actor, string action, string target, string detail)[]
        {
            new(new DateTime(2026, 9, 24, 7, 58, 44), "lthimai", "FAULT_REPORT", "equipment #78123", "Báo hỏng: màn hình bị nhiễu. Mức độ: SƠ BỘ"),
            new(new DateTime(2026, 9, 24, 8, 12, 5), "hệ thống", "AUTO_LOCK", "equipment #55820", "Quá hạn hiệu chuẩn 14 ngày — tự động khóa"),
            new(new DateTime(2026, 9, 24, 9, 30, 11), "minhvt", "WORK_ORDER_START", "#HC-2026-0087", "Bắt đầu thực hiện phiếu hiệu chuẩn"),
            new(new DateTime(2026, 9, 24, 10, 45, 22), "admin", "CONFIG_UPDATE", "calibration_threshold", "warning_days: 30 -> 45"),
            new(new DateTime(2026, 9, 24, 11, 20, 3), "minhvt", "WORK_ORDER_COMPLETE", "#HC-2026-0087", "bằng chứng: 2/4 — đang tiến hành"),
            new(new DateTime(2026, 9, 24, 14, 1, 58), "dphuong", "ASSIGN_BLOCKED", "phiếu #SC-0088", "Lý do: quá hạn hiệu chuẩn 23 ngày. Căn cứ: chứng thư #VC-2026-0112"),
            new(new DateTime(2026, 9, 24, 14, 2, 11), "hệ thống", "UPDATE", "equipment #12346", "status: HOAT_DONG -> CHO_HIEU_CHUAN"),
        };
        var prev = new string('0', 64);
        foreach (var (at, actor, action, target, detail) in logs)
        {
            var row = new AuditLog { TaoLuc = at, NguoiThucHien = actor, HanhDong = action, DoiTuong = target, ChiTiet = detail, PrevHash = prev };
            row.MaBam = Services.AuditService.ComputeHash(prev, actor, action, target, detail);
            db.AuditLog.Add(row);
            prev = row.MaBam;
        }
        await db.SaveChangesAsync();
        logger.LogInformation("Seed xong: {Devices} thiết bị, {Orders} phiếu, {Users} user.", 8, 6, 8);
    }

    static string Rep(char c) => new string(c, 64);
}
