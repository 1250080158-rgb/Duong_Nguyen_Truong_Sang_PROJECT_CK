namespace MedEquip.Domain;

/// <summary>
/// Trạng thái thiết bị. Danh sách phải khớp với ràng buộc
/// CHECK (status IN (...)) trên cột equipment.status của QLTBYT.sql.
///
/// KHÔNG thêm trạng thái của phiếu vào đây. "CHO_NGHIEM_THU" từng được
/// khai sai là trạng thái thiết bị; dùng nó ở luồng hoàn thành phiếu khiến
/// Postgres từ chối UPDATE với 23514 và mọi lượt hoàn thành phiếu đều trả
/// HTTP 500. Trạng thái đúng của thiết bị lúc chờ nghiệm thu là DANG_SUA
/// (thiết bị vẫn bị khoá cho tới khi nghiệm thu mở khoá).
/// </summary>
public static class DeviceStatus
{
    public const string HoatDong = "HOAT_DONG";
    public const string SapHan = "SAP_HAN";
    public const string ChoHieuChuan = "CHO_HIEU_CHUAN";
    public const string DangSua = "DANG_SUA";
    public const string ThanhLy = "THANH_LY";

    public static readonly string[] All = { HoatDong, SapHan, ChoHieuChuan, DangSua, ThanhLy };
}

public static class WOStatus
{
    public const string ChoPhanCong = "CHO_PHAN_CONG";
    public const string DangThucHien = "DANG_THUC_HIEN";
    public const string ChoNghiemThu = "CHO_NGHIEM_THU";
    public const string HoanThanh = "HOAN_THANH";
    public const string TraLai = "TRA_LAI";

    public static readonly string[] All = { ChoPhanCong, DangThucHien, ChoNghiemThu, HoanThanh, TraLai };
}

public static class OrderType
{
    public const string PM = "PM";
    public const string SC = "SC";
    public const string HC = "HC";
    public const string KT = "KT";

    public static readonly string[] All = { PM, SC, HC, KT };
    public static readonly string[] KhaiThac = { PM, SC }; // BR-01 áp dụng cho phiếu khai thác
}

public static class Priority
{
    public const string BinhThuong = "BINH_THUONG";
    public const string Khan = "KHAN";
}

public static class UserRoles
{
    public const string Admin = "ADMIN";
    public const string DieuPhoi = "DIEU_PHOI";
    public const string KyThuatVien = "KY_THUAT_VIEN";
    public const string DauMoiKhoa = "DAU_MOI_KHOA";
}
