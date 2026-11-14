namespace MedEquip.Domain;

/// <summary>
/// Luật nghiệp vụ về hiệu chuẩn — gom ra khỏi service để kiểm thử được
/// mà không cần dựng CSDL.
///
/// Mỗi luật ở đây đều được kiểm tra ở ba tầng: hàm này (tầng ứng dụng),
/// trigger trong CSDL (chống thao tác SQL tay) và nút trên giao diện.
/// Ba tầng phải cùng kết luận, nên nếu đổi luật thì phải sửa cả ba.
/// </summary>
public static class CalibrationRules
{
    /// <summary>Số ngày thiết bị đã quá hạn hiệu chuẩn. Không có hạn thì 0.</summary>
    public static int OverdueDays(DateOnly? calibrationExpiry, DateOnly today)
    {
        if (!calibrationExpiry.HasValue) return 0;
        return today.DayNumber - calibrationExpiry.Value.DayNumber;
    }

    /// <summary>Thiết bị đã quá hạn hiệu chuẩn chưa.</summary>
    public static bool IsOverdue(DateOnly? calibrationExpiry, DateOnly today) =>
        calibrationExpiry.HasValue && calibrationExpiry.Value < today;

    /// <summary>
    /// BR-01 — có được phân công phiếu cho thiết bị này không.
    ///
    /// Chặn khi: phiếu khai thác (PM/SC) mà thiết bị đã thanh lý, đang chờ
    /// hiệu chuẩn, hoặc hạn hiệu chuẩn đã qua.
    ///
    /// Phiếu hiệu chuẩn (HC) và kiểm định (KT) LUÔN được phép — đó chính là
    /// lối thoát để gỡ máy khỏi tình trạng bị khoá, kể cả máy đã thanh lý
    /// (quy tắc BR-01 trong báo cáo đồ án: "phiếu HC, KT luôn được phép").
    /// </summary>
    public static bool CanAssign(string equipmentStatus, string orderType, DateOnly? calibrationExpiry, DateOnly today)
    {
        if (!OrderType.KhaiThac.Contains(orderType)) return true;

        return equipmentStatus is not (DeviceStatus.ChoHieuChuan or DeviceStatus.ThanhLy)
            && !IsOverdue(calibrationExpiry, today);
    }

    /// <summary>
    /// BR-01 (phiên bản lúc tạo phiếu) — có được tạo phiếu cho thiết bị này không.
    /// Cùng ý với <see cref="CanAssign"/> nhưng thông điệp lỗi khác, vì đây là
    /// hành động khác nghiệp vụ (tạo mới chứ không phải giao việc).
    ///
    /// Bản không có tham số ngày giữ nguyên hành vi cũ (chỉ xét trạng thái);
    /// bản có thêm hạn hiệu chuẩn thì khớp đúng với trigger trong
    /// QLTBYT.sql — cùng một định nghĩa ở mọi tầng.
    /// </summary>
    public static bool CanCreateOrder(string equipmentStatus, string orderType) =>
        !OrderType.KhaiThac.Contains(orderType)
        || equipmentStatus is not (DeviceStatus.ChoHieuChuan or DeviceStatus.ThanhLy);

    /// <summary>
    /// BR-01 lúc tạo phiếu — có xét cả hạn hiệu chuẩn.
    /// Chặn phiếu PM/SC khi thiết bị đã thanh lý, đang chờ hiệu chuẩn
    /// hoặc hạn hiệu chuẩn đã qua (so với ngày hôm nay).
    /// </summary>
    public static bool CanCreateOrder(
        string equipmentStatus, string orderType, DateOnly? calibrationExpiry, DateOnly today) =>
        !OrderType.KhaiThac.Contains(orderType)
        || (equipmentStatus is not (DeviceStatus.ChoHieuChuan or DeviceStatus.ThanhLy)
            && !IsOverdue(calibrationExpiry, today));

    /// <summary>
    /// Trạng thái hiển thị của thiết bị — suy biến từ hạn hiệu chuẩn.
    ///
    /// Ngưỡng cảnh báo lấy từ cấu hình hệ thống (<c>warning_days_early</c>,
    /// mặc định 30 ngày) nên quản trị viên đổi ngưỡng là mọi màn hình
    /// cùng đổi theo — không hard-code rời rạc ở từng nơi.
    ///
    /// Ghi chú: SAP_HAN là trạng thái SUY BIẾN, chỉ dùng khi hiển thị;
    /// cột <c>equipment.status</c> không bao giờ lưu giá trị này.
    /// </summary>
    public static string DeviceStatusFor(DateOnly? calibrationExpiry, DateOnly today, int warningDays)
    {
        if (!calibrationExpiry.HasValue) return DeviceStatus.HoatDong;

        var days = calibrationExpiry.Value.DayNumber - today.DayNumber;
        if (days < 0) return DeviceStatus.ChoHieuChuan;
        if (days <= warningDays) return DeviceStatus.SapHan;
        return DeviceStatus.HoatDong;
    }

    /// <summary>
    /// BR-03 — sai số trong dung sai cho phép hay không.
    /// Sai số tính theo phần trăm so với giá trị chuẩn.
    /// </summary>
    public static bool WithinTolerance(decimal? standardValue, decimal? measuredValue, decimal tolerancePct)
    {
        if (!standardValue.HasValue || !measuredValue.HasValue) return true;
        if (standardValue.Value == 0m) return measuredValue.Value == 0m;

        var deviationPct = Math.Abs((measuredValue.Value - standardValue.Value) / standardValue.Value) * 100m;
        return deviationPct <= tolerancePct;
    }
}
