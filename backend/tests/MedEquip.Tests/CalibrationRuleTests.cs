using MedEquip.Domain;
using Xunit;

namespace MedEquip.Tests;

/// <summary>
/// Kiểm thử BR-01 (chặn phân công khi thiết bị quá hạn hiệu chuẩn) và
/// BR-03 (kiểm tra sai số trong dung sai).
///
/// Đây là hai luật nghiệp vụ được nhấn mạnh nhất của đề tài, nên test
/// phủ kỹ cả chiều cho phép lẫn chiều chặn, kể cả các trường hợp biên.
/// </summary>
public class CalibrationRuleTests
{
    private static readonly DateOnly Today = new(2026, 9, 29);

    // ---------------- BR-01: chặn phân công ----------------

    [Fact]
    public void Chặn_PM_cho_thiết_bị_đang_chờ_hiệu_chuẩn()
    {
        Assert.False(CalibrationRules.CanAssign(
            DeviceStatus.ChoHieuChuan, OrderType.PM, Today.AddDays(30), Today));
    }

    [Fact]
    public void Chặn_SC_cho_thiết_bị_đã_quá_hạn_hiệu_chuẩn()
    {
        Assert.False(CalibrationRules.CanAssign(
            DeviceStatus.HoatDong, OrderType.SC, Today.AddDays(-5), Today));
    }

    [Fact]
    public void Chặn_phiếu_khai_thác_cho_thiết_bị_đã_thanh_lý()
    {
        // Đã thanh lý thì không được giao việc khai thác nào.
        Assert.False(CalibrationRules.CanAssign(
            DeviceStatus.ThanhLy, OrderType.PM, Today.AddDays(365), Today));
        Assert.False(CalibrationRules.CanAssign(
            DeviceStatus.ThanhLy, OrderType.SC, Today.AddDays(365), Today));
    }

    [Theory]
    [InlineData(OrderType.HC)]
    [InlineData(OrderType.KT)]
    public void Cho_phép_phiếu_hiệu_chuẩn_và_kiểm_định_trên_thiết_bị_đã_thanh_lý(string orderType)
    {
        // Quy tắc BR-01 trong báo cáo: "phiếu HC, KT luôn được phép" — kể cả
        // máy đã thanh lý, vì đó là lối thoát để gỡ máy khỏi vòng đời.
        Assert.True(CalibrationRules.CanAssign(
            DeviceStatus.ThanhLy, orderType, Today.AddDays(365), Today));
    }

    [Theory]
    [InlineData(OrderType.HC)]
    [InlineData(OrderType.KT)]
    public void Cho_phép_phiếu_hiệu_chuẩn_và_kiểm_định_trên_thiết_bị_bị_khoá(string orderType)
    {
        // Đây là lối thoát của BR-01: thiết bị bị khoá thì chính phiếu
        // hiệu chuẩn phải được tạo được, nếu không hệ thống kẹt vĩnh viễn.
        Assert.True(CalibrationRules.CanAssign(
            DeviceStatus.ChoHieuChuan, orderType, Today.AddDays(-30), Today));
    }

    [Fact]
    public void Cho_phép_PM_khi_hiệu_chuẩn_còn_hạn()
    {
        Assert.True(CalibrationRules.CanAssign(
            DeviceStatus.HoatDong, OrderType.PM, Today.AddDays(30), Today));
    }

    [Fact]
    public void Cho_phép_PM_khi_thiết_bị_đang_sửa_nhưng_còn_hạn()
    {
        Assert.True(CalibrationRules.CanAssign(
            DeviceStatus.DangSua, OrderType.PM, Today.AddDays(10), Today));
    }

    [Fact]
    public void Chặn_khi_quá_hạn_đúng_một_ngày()
    {
        // Biên: hạn bằng hôm nay thì vẫn còn hạn, hơn một ngày là quá hạn.
        Assert.True(CalibrationRules.CanAssign(
            DeviceStatus.HoatDong, OrderType.PM, Today, Today));
        Assert.False(CalibrationRules.CanAssign(
            DeviceStatus.HoatDong, OrderType.PM, Today.AddDays(-1), Today));
    }

    [Fact]
    public void Không_chặn_khi_thiết_bị_chưa_đặt_hạn_hiệu_chuẩn()
    {
        // Chưa có hạn thì không kết luận là quá hạn — tránh chặn oan.
        Assert.True(CalibrationRules.CanAssign(
            DeviceStatus.HoatDong, OrderType.PM, null, Today));
    }

    [Fact]
    public void Đếm_đúng_số_ngày_quá_hạn()
    {
        Assert.Equal(0, CalibrationRules.OverdueDays(Today, Today));
        Assert.Equal(5, CalibrationRules.OverdueDays(Today.AddDays(-5), Today));
        Assert.Equal(-30, CalibrationRules.OverdueDays(Today.AddDays(30), Today));
        Assert.Equal(0, CalibrationRules.OverdueDays(null, Today));
    }

    // ---------------- BR-01: chặn lúc tạo phiếu ----------------

    [Fact]
    public void Tạo_phiếu_PM_trên_thiết_bị_chờ_hiệu_chuẩn_thì_bị_chặn()
    {
        Assert.False(CalibrationRules.CanCreateOrder(DeviceStatus.ChoHieuChuan, OrderType.PM));
        Assert.False(CalibrationRules.CanCreateOrder(DeviceStatus.ThanhLy, OrderType.SC));
    }

    [Fact]
    public void Tạo_phiếu_HC_trên_thiết_bị_chờ_hiệu_chuẩn_thì_được_phép()
    {
        Assert.True(CalibrationRules.CanCreateOrder(DeviceStatus.ChoHieuChuan, OrderType.HC));
        Assert.True(CalibrationRules.CanCreateOrder(DeviceStatus.ChoHieuChuan, OrderType.KT));
    }

    [Fact]
    public void Tạo_phiếu_khai_thác_trên_thiết_bị_quá_hạn_hiệu_chuẩn_thì_bị_chặn()
    {
        // Bản luật có xét ngày hết hạn — khớp với trigger fn_chan_tao_phieu_khai_thac
        // trong QLTBYT.sql (so với CURRENT_DATE).
        Assert.False(CalibrationRules.CanCreateOrder(
            DeviceStatus.HoatDong, OrderType.PM, Today.AddDays(-1), Today));
        Assert.False(CalibrationRules.CanCreateOrder(
            DeviceStatus.HoatDong, OrderType.SC, Today.AddDays(-1), Today));
        Assert.True(CalibrationRules.CanCreateOrder(
            DeviceStatus.HoatDong, OrderType.PM, Today.AddDays(1), Today));
    }

    [Fact]
    public void Tạo_phiếu_hiệu_chuẩn_kể_cả_thiết_bị_quá_hạn_thì_được_phép()
    {
        Assert.True(CalibrationRules.CanCreateOrder(
            DeviceStatus.ChoHieuChuan, OrderType.HC, Today.AddDays(-30), Today));
        Assert.True(CalibrationRules.CanCreateOrder(
            DeviceStatus.HoatDong, OrderType.KT, Today.AddDays(-30), Today));
    }

    // ---------------- Trạng thái suy biến theo ngưỡng cấu hình ----------------

    [Fact]
    public void Trạng_thái_suy_biến_theo_ngưỡng_cảnh_báo_trong_cấu_hình()
    {
        // Ngưỡng mặc định 30 ngày (system_config.warning_days_early).
        Assert.Equal(DeviceStatus.HoatDong,
            CalibrationRules.DeviceStatusFor(Today.AddDays(31), Today, 30));
        Assert.Equal(DeviceStatus.SapHan,
            CalibrationRules.DeviceStatusFor(Today.AddDays(30), Today, 30));
        Assert.Equal(DeviceStatus.SapHan,
            CalibrationRules.DeviceStatusFor(Today, Today, 30));
        Assert.Equal(DeviceStatus.ChoHieuChuan,
            CalibrationRules.DeviceStatusFor(Today.AddDays(-1), Today, 30));
        Assert.Equal(DeviceStatus.HoatDong,
            CalibrationRules.DeviceStatusFor(null, Today, 30));
    }

    [Fact]
    public void Đổi_ngưỡng_cấu_hình_thì_ngưỡng_cảnh_báo_đổi_theo()
    {
        // Quản trị viên nâng ngưỡng lên 45 ngày: máy còn 40 ngày hạn đã
        // chuyển sang SAP_HAN mà không cần sửa mã nguồn.
        Assert.Equal(DeviceStatus.SapHan,
            CalibrationRules.DeviceStatusFor(Today.AddDays(40), Today, 45));
        Assert.Equal(DeviceStatus.HoatDong,
            CalibrationRules.DeviceStatusFor(Today.AddDays(40), Today, 30));
    }

    // ---------------- BR-03: dung sai sai số ----------------

    [Fact]
    public void Sai_số_nằm_trong_dung_sai_thì_Đạt()
    {
        // Chuẩn 100, đo 102, dung sai 2.5% → lệch 2% → đạt
        Assert.True(CalibrationRules.WithinTolerance(100m, 102m, 2.5m));
    }

    [Fact]
    public void Sai_số_vượt_dung_sai_thì_Không_Đạt()
    {
        // Chuẩn 100, đo 105, dung sai 2.5% → lệch 5% → không đạt
        Assert.False(CalibrationRules.WithinTolerance(100m, 105m, 2.5m));
    }

    [Fact]
    public void Sai_số_âm_cũng_được_tính_tuyệt_đối()
    {
        // Đo thấp hơn chuẩn cũng là sai số, không chỉ đo cao hơn.
        Assert.True(CalibrationRules.WithinTolerance(100m, 98m, 2.5m));
        Assert.False(CalibrationRules.WithinTolerance(100m, 95m, 2.5m));
    }

    [Fact]
    public void Sai_số_đúng_bằng_dung_sai_thì_vẫn_Đạt()
    {
        Assert.True(CalibrationRules.WithinTolerance(100m, 102.5m, 2.5m));
        Assert.True(CalibrationRules.WithinTolerance(100m, 97.5m, 2.5m));
    }

    [Fact]
    public void Thiếu_giá_trị_đo_thì_chưa_kết_luận_Không_Đạt()
    {
        // Bước chưa đo thì không được gắn nhãn KHÔNG_DAT — chỉ gắn được
        // khi đã có số đo thật và vượt dung sai.
        Assert.True(CalibrationRules.WithinTolerance(null, 100m, 2.5m));
        Assert.True(CalibrationRules.WithinTolerance(100m, null, 2.5m));
        Assert.True(CalibrationRules.WithinTolerance(null, null, 2.5m));
    }

    [Fact]
    public void Chuẩn_bằng_không_không_được_chia_cho_0()
    {
        // Tránh lỗi chia cho 0 khi thiết bị không có giá trị chuẩn.
        Assert.True(CalibrationRules.WithinTolerance(0m, 0m, 2.5m));
        Assert.False(CalibrationRules.WithinTolerance(0m, 1m, 2.5m));
    }
}
