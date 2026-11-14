using MedEquip.Domain;
using Xunit;

namespace MedEquip.Tests;

/// <summary>
/// Định nghĩa "PM đúng hạn" dùng bởi Dashboard và view v_bao_cao_pm:
/// đúng hạn = completed_at ≤ deadline, đếm trong cửa sổ 6 tháng.
/// Trước đây Dashboard trả số 89 cứng — các test này khoá công thức lại.
/// </summary>
public class PmMetricsTests
{
    static readonly DateTime AsOf = new(2026, 10, 1, 8, 0, 0, DateTimeKind.Utc);

    static (string, string, DateTime?, DateOnly) Pm(
        string status, DateTime? completedAt, DateOnly deadline) =>
        (OrderType.PM, status, completedAt, deadline);

    [Fact]
    public void Khong_co_phieu_nao_thi_ty_le_la_0()
    {
        Assert.Equal(0, PmMetrics.OnTimeRate6M([], AsOf));
    }

    [Fact]
    public void Hoan_thanh_dung_han_het_han_thi_100()
    {
        var rows = new[]
        {
            Pm(WOStatus.HoanThanh, new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc), new DateOnly(2026, 9, 5)),
            Pm(WOStatus.HoanThanh, new DateTime(2026, 9, 5, 0, 0, 0, DateTimeKind.Utc), new DateOnly(2026, 9, 5)),
        };

        // Hoàn thành ĐÚNG ngày hạn vẫn tính là đúng hạn (≤ deadline).
        Assert.Equal(100, PmMetrics.OnTimeRate6M(rows, AsOf));
    }

    [Fact]
    public void Mot_nua_tra_muon_thi_50()
    {
        var rows = new[]
        {
            Pm(WOStatus.HoanThanh, new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc), new DateOnly(2026, 9, 5)),
            Pm(WOStatus.HoanThanh, new DateTime(2026, 9, 10, 0, 0, 0, DateTimeKind.Utc), new DateOnly(2026, 9, 5)),
        };

        Assert.Equal(50, PmMetrics.OnTimeRate6M(rows, AsOf));
    }

    [Fact]
    public void Chi_dem_phieu_hoan_thanh_trong_6_thang()
    {
        var rows = new[]
        {
            // Quá 6 tháng — không tính.
            Pm(WOStatus.HoanThanh, new DateTime(2026, 3, 1, 0, 0, 0, DateTimeKind.Utc), new DateOnly(2026, 3, 5)),
            // Chưa hoàn thành — không tính.
            Pm(WOStatus.DangThucHien, null, new DateOnly(2026, 9, 5)),
            // Loại phiếu khác (HC/SC) — không tính.
            (OrderType.HC, WOStatus.HoanThanh, (DateTime?)new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc), new DateOnly(2026, 9, 5)),
            // Chỉ phiếu này tính: đúng hạn.
            Pm(WOStatus.HoanThanh, new DateTime(2026, 9, 2, 0, 0, 0, DateTimeKind.Utc), new DateOnly(2026, 9, 5)),
        };

        Assert.Equal(100, PmMetrics.OnTimeRate6M(rows, AsOf));
    }

    [Fact]
    public void Phieu_chua_ghi_completed_at_khong_duoc_tinh_dung_han()
    {
        // Hoàn thành qua app nhưng completed_at chưa từng được ghi —
        // đúng triệu chứng của lỗi cũ: tỷ lệ đứng ở 0 vì thiếu dữ liệu.
        var rows = new[] { Pm(WOStatus.HoanThanh, null, new DateOnly(2026, 9, 5)) };

        Assert.Equal(0, PmMetrics.OnTimeRate6M(rows, AsOf));
    }
}
