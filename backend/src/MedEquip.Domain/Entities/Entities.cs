using System.ComponentModel.DataAnnotations.Schema;

namespace MedEquip.Domain.Entities;

// Tất cả entity khớp 1:1 với database/QLTBYT.sql.
//
// QLTBYT.sql dùng TÊN BẢNG và TÊN CỘT tiếng Anh (departments, equipment,
// work_orders, users...), trong khi property C# giữ tên tiếng Việt để
// controller/service không phải đổi. Cách nối hai bên:
//
//   • [Table("tên_bảng_sql")]  — ép tên bảng.
//   • [Column("tên_cột_sql")]  — ép tên cột cho MỌI property, kể cả khi
//     trùng nhau. Mọi giá trị đều viết sẵn dạng snake_case nên vòng lặp
//     ToSnake trong DataContext.OnModelCreating giữ nguyên.
//
// Trước đây [Table] trỏ vào bảng tiếng Việt (khoa_phong, thiet_bi...) mà
// PostgreSQL chỉ có bảng tiếng Anh — mọi truy vấn đều 500
// "relation ... does not exist". Cố định bằng cách ánh xạ ở đây.

[Table("departments")]
public class Department
{
    [Column("department_id")]
    public int IdKhoa { get; set; }
    [Column("name")]
    public string Ten { get; set; } = "";
    [Column("is_clinical")]
    public bool LaLamSang { get; set; }
    [Column("address")]
    public string? DiaChi { get; set; }     // vị trí đặt thiết bị
    [Column("phone")]
    public string? DienThoai { get; set; }       // số nội bộ khoa
    [Column("created_at")]
    public DateTime TaoLuc { get; set; }

    public ICollection<Equipment> Equipments { get; set; } = new List<Equipment>();
    public ICollection<User> Users { get; set; } = new List<User>();
}

[Table("manufacturers")]
public class Manufacturer
{
    [Column("manufacturer_id")]
    public int IdHang { get; set; }
    [Column("name")]
    public string Ten { get; set; } = "";
    [Column("country")]
    public string? QuocGia { get; set; }
    [Column("website")]
    public string? Website { get; set; }
}

[Table("suppliers")]
public class Supplier
{
    [Column("supplier_id")]
    public int IdNcc { get; set; }
    [Column("name")]
    public string Ten { get; set; } = "";
    [Column("contact_person")]
    public string? NguoiLienHe { get; set; }
    [Column("phone")]
    public string? DienThoai { get; set; }
    [Column("contract_no")]
    public string? SoHopDong { get; set; }   // số hợp đồng bảo trì
}

[Table("equipment_models")]
public class EquipmentModel
{
    [Column("model_id")]
    public int IdModel { get; set; }
    [Column("name")]
    public string Ten { get; set; } = "";
    [Column("manufacturer_id")]
    public int IdHang { get; set; }
    [Column("category")]
    public string Loai { get; set; } = "";
    [Column("pm_cycle_days")]
    public int ChuKyPmNgay { get; set; }
    [Column("hc_cycle_days")]
    public int ChuKyHcNgay { get; set; }
    [Column("hc_tolerance_pct")]
    public decimal DungSaiHcPhanTram { get; set; }
    [Column("is_active")]
    public bool HoatDong { get; set; } = true;
    [Column("notes")]
    public string? GhiChu { get; set; }

    public Manufacturer? Manufacturer { get; set; }
    public ICollection<Equipment> Equipments { get; set; } = new List<Equipment>();
}

[Table("equipment")]
public class Equipment
{
    [Column("equipment_id")]
    public int IdThietBi { get; set; }
    [Column("code")]
    public string Ma { get; set; } = "";
    [Column("name")]
    public string Ten { get; set; } = "";    // tên gọi tại khoa, vd 'Máy sinh phẩm BS-240 số 1'
    [Column("model_id")]
    public int IdModel { get; set; }
    [Column("serial")]
    public string Serial { get; set; } = "";
    [Column("department_id")]
    public int IdKhoa { get; set; }
    [Column("location")]
    public string? ViTri { get; set; }      // vị trí đặt trong khoa
    [Column("status")]
    public string TrangThai { get; set; } = DeviceStatus.HoatDong;
    [Column("calibration_expiry")]
    public DateOnly? HanHieuChuan { get; set; }
    [Column("next_pm")]
    public DateOnly? PmKeTiep { get; set; }
    [Column("import_date")]
    public DateOnly NgayNhap { get; set; }
    [Column("warranty_months")]
    public int ThangBaoHanh { get; set; }
    [Column("purchase_price")]
    public decimal? GiaMua { get; set; }   // giá trị ban đầu
    [Column("maintenance_supplier_id")]
    public int? IdNccBaoTri { get; set; }
    [Column("notes")]
    public string? GhiChu { get; set; }

    public EquipmentModel? Model { get; set; }
    public Department? Department { get; set; }
    public Supplier? MaintenanceSupplier { get; set; }
    public ICollection<WorkOrder> WorkOrders { get; set; } = new List<WorkOrder>();
}

[Table("equipment_status_history")]
public class EquipmentStatusHistory
{
    [Column("history_id")]
    public long IdLichSu { get; set; }
    [Column("equipment_id")]
    public int IdThietBi { get; set; }
    [Column("from_status")]
    public string TrangThaiCu { get; set; } = "";
    [Column("to_status")]
    public string TrangThaiMoi { get; set; } = "";
    [Column("changed_by")]
    public string DoiBoi { get; set; } = "";
    [Column("reason")]
    public string? LyDo { get; set; }
    [Column("changed_at")]
    public DateTime DoiLuc { get; set; }

    public Equipment? Equipment { get; set; }
}

[Table("users")]
public class User
{
    [Column("user_id")]
    public int IdNguoiDung { get; set; }
    [Column("username")]
    public string TenDangNhap { get; set; } = "";
    [Column("full_name")]
    public string HoTen { get; set; } = "";
    [Column("email")]
    public string? Email { get; set; }
    [Column("employee_no")]
    public string? MaNhanVien { get; set; }
    [Column("phone")]
    public string? DienThoai { get; set; }
    [Column("role")]
    public string VaiTro { get; set; } = "";
    [Column("department_id")]
    public int? IdKhoa { get; set; }
    [Column("last_login")]
    public DateTime? DangNhapCuoi { get; set; }
    [Column("is_active")]
    public bool HoatDong { get; set; }

    public Department? Department { get; set; }
}

[Table("work_orders")]
public class WorkOrder
{
    [Column("work_order_id")]
    public int IdPhieu { get; set; }
    [Column("code")]
    public string Ma { get; set; } = "";
    [Column("order_type")]
    public string LoaiPhieu { get; set; } = "PM";
    [Column("equipment_id")]
    public int IdThietBi { get; set; }
    [Column("department_id")]
    public int IdKhoa { get; set; }
    [Column("assignee_id")]
    public int? IdNguoiThucHien { get; set; }
    [Column("status")]
    public string TrangThai { get; set; } = "CHO_PHAN_CONG";
    [Column("priority")]
    public string UuTien { get; set; } = "BINH_THUONG";
    [Column("created_at")]
    public DateOnly NgayTao { get; set; }
    [Column("deadline")]
    public DateOnly HanChot { get; set; }
    [Column("progress")]
    public int Progress { get; set; }
    [Column("description")]
    public string? MoTa { get; set; }
    [Column("completed_at")]
    public DateTime? HoanThanhLuc { get; set; }     // thời điểm KTV bấm hoàn thành (căn cứ tính PM đúng hạn)
    [Column("reviewed_at")]
    public DateTime? NghiemThuLuc { get; set; }      // thời điểm lãnh đạo duyệt
    [Column("return_reason")]
    public string? LyDoTra { get; set; }      // lý do trả lại khi bị duyệt hụt

    public Equipment? Equipment { get; set; }
    public Department? Department { get; set; }
    public User? Assignee { get; set; }
    public ICollection<WorkOrderStep> Steps { get; set; } = new List<WorkOrderStep>();
    public ICollection<Evidence> Evidence { get; set; } = new List<Evidence>();
}

[Table("work_order_steps")]
public class WorkOrderStep
{
    [Column("step_id")]
    public long IdBuoc { get; set; }
    [Column("work_order_id")]
    public int IdPhieu { get; set; }
    [Column("ordinal")]
    public int ThuTu { get; set; }
    [Column("title")]
    public string TieuDe { get; set; } = "";
    [Column("require_photo")]
    public bool RequirePhoto { get; set; }
    [Column("standard_value")]
    public decimal? GiaTriChuan { get; set; }
    [Column("tolerance_pct")]
    public decimal? DungSaiPhanTram { get; set; }
    [Column("measured_value")]
    public decimal? GiaTriDo { get; set; }
    [Column("result")]
    public string? Result { get; set; }
    [Column("done")]
    public bool HoanThanh { get; set; }
    [Column("skip_reason")]
    public string? LyDoBo { get; set; }
    [Column("note")]
    public string? Note { get; set; }
    [Column("unit")]
    public string? Unit { get; set; }             // đơn vị đo, vd 'mmHg', 'phút'
    [Column("performed_at")]
    public DateTime? HoanThanhLuc { get; set; }     // thời điểm thực hiện bước
    [Column("performed_by")]
    public int? PerformedBy { get; set; }         // người thực hiện

    public WorkOrder? WorkOrder { get; set; }
    public User? Operator { get; set; }
}

[Table("required_evidence_config")]
public class RequiredEvidenceConfig
{
    [Column("config_id")]
    public int ConfigId { get; set; }
    [Column("order_type")]
    public string OrderType { get; set; } = "";
    [Column("evidence_code")]
    public string EvidenceCode { get; set; } = "";
    [Column("label")]
    public string Label { get; set; } = "";
    [Column("is_required")]
    public bool IsRequired { get; set; }
    [Column("max_files")]
    public int MaxFiles { get; set; } = 5;        // số ảnh tối đa cho loại bằng chứng này
    [Column("accept_mime")]
    public string? AcceptMime { get; set; }        // danh sách MIME được phép
    [Column("sort_order")]
    public int SortOrder { get; set; }
}

[Table("evidence")]
public class Evidence
{
    [Column("evidence_id")]
    public long IdBangChung { get; set; }
    [Column("work_order_id")]
    public int IdPhieu { get; set; }
    [Column("evidence_code")]
    public string MaBangChung { get; set; } = "";
    [Column("file_name")]
    public string TenTep { get; set; } = "";
    [Column("file_path")]
    public string DuongDanTep { get; set; } = "";
    [Column("sha256")]
    public string MaBam { get; set; } = "";
    [Column("file_size_kb")]
    public int FileSizeKb { get; set; }
    [Column("file_mime")]
    public string? FileMime { get; set; }          // kiểu MIME thực tế của file
    [Column("uploaded_by")]
    public int TaiBoi { get; set; }
    [Column("uploaded_at")]
    public DateTime TaiLuc { get; set; }

    public WorkOrder? WorkOrder { get; set; }
    public User? Uploader { get; set; }
}

[Table("incidents")]
public class Incident
{
    [Column("incident_id")]
    public int IdSuCo { get; set; }
    [Column("code")]
    public string Ma { get; set; } = "";
    [Column("equipment_id")]
    public int IdThietBi { get; set; }
    [Column("reported_by")]
    public int BaoBoi { get; set; }
    [Column("description")]
    public string MoTa { get; set; } = "";
    [Column("severity")]
    public string MucDo { get; set; } = "SO_BO";
    [Column("photo_count")]
    public int PhotoCount { get; set; }
    [Column("photo_paths")]
    public string? PhotoPaths { get; set; }   // đường dẫn ảnh sự cố (cách nhau bằng dấu phẩy)
    [Column("status")]
    public string TrangThai { get; set; } = "MOI";
    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
    [Column("closed_at")]
    public DateTime? ClosedAt { get; set; }         // thời điểm đóng sự cố
    [Column("resolution")]
    public string? Resolution { get; set; }        // biện pháp xử lý
    [Column("work_order_id")]
    public int? IdPhieu { get; set; }

    public Equipment? Equipment { get; set; }
    public User? Reporter { get; set; }
}

[Table("assignments")]
public class Assignment
{
    [Column("assignment_id")]
    public int IdPhanCong { get; set; }
    [Column("work_order_id")]
    public int IdPhieu { get; set; }
    [Column("equipment_id")]
    public int IdThietBi { get; set; }
    [Column("assignee_id")]
    public int IdNguoiDung { get; set; }
    [Column("scheduled_date")]
    public DateOnly ScheduledDate { get; set; }
    [Column("status")]
    public string TrangThai { get; set; } = "DANG_THUC_HIEN";
    [Column("created_by")]
    public int PhanCongBoi { get; set; }
    [Column("created_at")]
    public DateTime PhanCongLuc { get; set; }

    public WorkOrder? WorkOrder { get; set; }
    public Equipment? Equipment { get; set; }
    public User? Assignee { get; set; }
}

[Table("audit_log")]
public class AuditLog
{
    [Column("audit_id")]
    public long IdKiemToan { get; set; }
    [Column("occurred_at")]
    public DateTime TaoLuc { get; set; }
    [Column("actor")]
    public string NguoiThucHien { get; set; } = "";
    [Column("action")]
    public string HanhDong { get; set; } = "";
    [Column("target")]
    public string DoiTuong { get; set; } = "";
    [Column("detail")]
    public string? ChiTiet { get; set; }
    [Column("prev_hash")]
    public string PrevHash { get; set; } = "";
    [Column("row_hash")]
    public string MaBam { get; set; } = "";
}

[Table("system_config")]
public class SystemConfig
{
    [Column("config_key")]
    public string ConfigKey { get; set; } = "";
    [Column("config_value")]
    public string ConfigValue { get; set; } = "";
    [Column("description")]
    public string Description { get; set; } = "";
    [Column("updated_at")]
    public DateTime? UpdatedAt { get; set; }

    // system_config.updated_by là VARCHAR(50) chứa tên đăng nhập (ví dụ
    // "longhduc"), không phải khoá số — khai báo int sẽ khiến Npgsql ném
    // InvalidCastException và /api/config trả 500.
    [Column("updated_by")]
    public string? UpdatedBy { get; set; }
}

[Table("notifications")]
public class Notification
{
    [Column("notification_id")]
    public long NotificationId { get; set; }
    [Column("user_id")]
    public int UserId { get; set; }
    [Column("type")]
    public string Type { get; set; } = "";
    [Column("message")]
    public string Message { get; set; } = "";
    [Column("is_read")]
    public bool IsRead { get; set; }
    [Column("created_at")]
    public DateTime CreatedAt { get; set; }
    [Column("link")]
    public string? Link { get; set; }              // đường dẫn nội bộ tới màn hình liên quan

    public User? User { get; set; }
}
