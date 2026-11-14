namespace MedEquip.Domain;

/// <summary>
/// Thống kê PM tính từ dữ liệu phiếu công tác. Tách thành hàm thuần ở tầng
/// Domain vì cùng lý do với CalibrationRules: Dashboard, báo cáo và kiểm thử
/// phải dùng chung một định nghĩa "PM đúng hạn" thay vì mỗi nơi tính một kiểu.
/// </summary>
public static class PmMetrics
{
    /// <summary>
    /// Tỷ lệ PM hoàn thành đúng hạn trong 6 tháng trước <paramref name="asOf"/>,
    /// làm tròn thành số nguyên 0–100.
    ///
    /// Đếm các phiếu PM đã HOAN_THANH mà thời điểm hoàn thành nằm trong cửa sổ
    /// 6 tháng; "đúng hạn" = completed_at ≤ deadline — trùng định nghĩa của
    /// view v_bao_cao_pm trong QLTBYT.sql. Không có phiếu nào thì trả 0.
    /// </summary>
    public static int OnTimeRate6M(
        IEnumerable<(string OrderType, string Status, DateTime? CompletedAt, DateOnly Deadline)> orders,
        DateTime asOf)
    {
        var windowStart = asOf.AddMonths(-6);
        var total = 0;
        var onTime = 0;
        foreach (var (orderType, status, completedAt, deadline) in orders)
        {
            if (orderType != OrderType.PM || status != WOStatus.HoanThanh) continue;
            if (!completedAt.HasValue) continue;
            if (completedAt.Value < windowStart || completedAt.Value > asOf) continue;
            total++;
            if (DateOnly.FromDateTime(completedAt.Value) <= deadline) onTime++;
        }
        return total == 0 ? 0 : (int)Math.Round(onTime * 100.0 / total);
    }
}
