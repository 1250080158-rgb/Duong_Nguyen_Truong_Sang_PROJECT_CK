using System.Security.Claims;
using MedEquip.Api.Auth;
using MedEquip.Domain;
using Xunit;

namespace MedEquip.Tests;

/// <summary>
/// Test hồi quy cho các lỗi đã phát hiện khi chạy thử toàn hệ thống.
/// Mỗi test ghi lại đúng triệu chứng đã gặp, để lần sau sửa nhầm chỗ khác
/// thì test vẫn đỏ.
/// </summary>
public class RegressionTests
{
    // ---------------------------------------------------------------
    // LỖI: tải bằng chứng nhỏ hơn 1 KB luôn trả HTTP 500
    // Nguyên nhân: chia nguyên (bytes / 1024) ra 0, CSDL có
    // CHECK (file_size_kb > 0) nên Postgres từ chối INSERT.
    // ---------------------------------------------------------------

    [Theory]
    [InlineData(1, 1)]
    [InlineData(208, 1)]
    [InlineData(1023, 1)]
    [InlineData(1024, 1)]
    [InlineData(1025, 2)]
    [InlineData(430_080, 420)]
    public void Kich_thuoc_tinh_theo_KB_luon_it_nhat_1(long bytes, int expected)
    {
        // Không được bao giờ trả 0: đó là nguyên nhân gốc của HTTP 500.
        Assert.Equal(expected, EvidenceRules.ToKilobytes(bytes));
        Assert.True(EvidenceRules.ToKilobytes(bytes) > 0);
    }

    [Fact]
    public void Kich_thuoc_lam_tron_len_chu_khong_lam_tron_xuong()
    {
        // 430_080 byte = 419,999… KB → phải làm tròn lên 420.
        Assert.Equal(420, EvidenceRules.ToKilobytes(430_080));
        // 2049 byte > 2 KB → 3 KB.
        Assert.Equal(3, EvidenceRules.ToKilobytes(2049));
    }

    [Fact]
    public void Tu_choi_kich_thuoc_am()
    {
        Assert.Throws<ArgumentOutOfRangeException>(() => EvidenceRules.ToKilobytes(-1));
    }

    [Fact]
    public void Gioi_han_10MB_dung_ky_luc()
    {
        Assert.Equal(10 * 1024 * 1024, EvidenceRules.MaxBytes);
    }

    [Theory]
    [InlineData("image/jpeg", true)]
    [InlineData("image/png", true)]
    [InlineData("image/webp", true)]
    [InlineData("application/pdf", true)]
    [InlineData("image/svg+xml", false)]
    [InlineData("text/html", false)]
    [InlineData("application/x-msdownload", false)]
    [InlineData(null, false)]
    public void Chi_cho_phep_dinh_dang_anh_va_pdf(string? contentType, bool allowed)
    {
        Assert.Equal(allowed, EvidenceRules.IsAllowedContentType(contentType));
    }

    [Fact]
    public void Nhan_dien_chu_ky_tap_theo_magic_bytes()
    {
        byte[] Jpeg = [0xFF, 0xD8, 0xFF, 0xE0];
        byte[] Png = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
        byte[] Pdf = [0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37];
        byte[] Webp = [0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00];
        byte[] Gia = [0x4D, 0x5A, 0x90, 0x00]; // .exe đổi đuôi thành .jpg

        Assert.True(EvidenceRules.HasKnownSignature(Jpeg));
        Assert.True(EvidenceRules.HasKnownSignature(Png));
        Assert.True(EvidenceRules.HasKnownSignature(Pdf));
        Assert.True(EvidenceRules.HasKnownSignature(Webp));
        Assert.False(EvidenceRules.HasKnownSignature(Gia));
        Assert.False(EvidenceRules.HasKnownSignature([]));
    }

    // ---------------------------------------------------------------
    // LỖI: người thao tác bị ghi sai thành user_id = 1
    // Nguyên nhân: controller đọc thẳng ClaimTypes.NameIdentifier, nhưng
    // token Keycloak không có claim đó nên rơi về giá trị mặc định "1".
    // Hậu quả: mọi dòng kiểm toán và mọi bằng chứng đều bị quy cho
    // minhvt dù người ký thực tế là người khác.
    // ---------------------------------------------------------------

    private static ClaimsPrincipal Principal(params Claim[] claims)
    {
        var identity = new ClaimsIdentity(claims, authenticationType: "Test");
        return new ClaimsPrincipal(identity);
    }

    [Fact]
    public void Token_Dev_co_NameIdentifier_thì_giữ_nguyên_user_id()
    {
        var user = Principal(
            new Claim(ClaimTypes.NameIdentifier, "7"),
            new Claim(ClaimTypes.Name, "dphuong"));

        Assert.Equal(7, CurrentUserAccessor.ResolveUserId(user));
    }

    [Fact]
    public void Token_Keycloak_khong_co_NameIdentifier_phai_tra_null_chu_khong_roi_ve_1()
    {
        // sub của Keycloak là UUID, không phải user_id nội bộ. Không được
        // biến nó thành 1 — đó chính là lỗi ghi sai người thao tác.
        var user = Principal(
            new Claim("sub", "f2a9c1de-4b7e-4c1a-9f3d-8a2b6c5d1e0f"),
            new Claim("preferred_username", "dphuong"));

        Assert.Null(CurrentUserAccessor.ResolveUserId(user));
    }

    [Fact]
    public void Lay_ten_dang_nhap_duoc_o_che_do_OIDC()
    {
        var user = Principal(
            new Claim("preferred_username", "minhvt"),
            new Claim("realm_access", """{"roles":["MED-EQUIP_KY_THUAT_VIEN"]}"""));

        Assert.Equal("minhvt", CurrentUserAccessor.ResolveUsername(user));
    }

    [Fact]
    public void Ten_dang_nhap_roi_ve_dau_thanh_sau_cung_khong_ba_rong()
    {
        var user = Principal(new Claim(ClaimTypes.Name, "longhduc"));

        Assert.Equal("longhduc", CurrentUserAccessor.ResolveUsername(user));
    }

    [Fact]
    public void Principal_cha_xac_thuc_khong_duoc_co_user_id()
    {
        var anonymous = new ClaimsPrincipal(new ClaimsIdentity());

        Assert.Null(CurrentUserAccessor.ResolveUserId(anonymous));
    }

    // ---------------------------------------------------------------
    // LỖI: hoàn thành phiếu luôn HTTP 500
    // Nguyên nhân: gán equipment.Status = "CHO_NGHIEM_THU", nhưng đó là
    // trạng thái của PHIẾU; ràng buộc equipment_status_check trong CSDL
    // chỉ cho phép HOAT_DONG / SAP_HAN / CHO_HIEU_CHUAN / DANG_SUA /
    // THANH_LY nên SaveChanges ném PostgresException 23514.
    // Hậu quả: kỹ thuật viên không thể hoàn thành bất kỳ phiếu nào.
    // ---------------------------------------------------------------

    [Fact]
    public void Trang_thai_thiet_bi_khong_bao_gom_cho_nghiem_thu()
    {
        // "CHO_NGHIEM_THU" là trạng thái phiếu, không được nằm trong tập
        // trạng thái hợp lệ của thiết bị.
        Assert.DoesNotContain("CHO_NGHIEM_THU", DeviceStatus.All);
        Assert.Contains(DeviceStatus.DangSua, DeviceStatus.All);
        Assert.Contains(DeviceStatus.HoatDong, DeviceStatus.All);
    }

    [Fact]
    public void Tap_trang_thai_khop_voi_rang_buoc_trong_CSDL()
    {
        // Nội dung này phải khớp với CHECK (status IN (...)) của QLTBYT.sql.
        Assert.Equal(
            new[] { "HOAT_DONG", "SAP_HAN", "CHO_HIEU_CHUAN", "DANG_SUA", "THANH_LY" },
            DeviceStatus.All);
        Assert.Equal(
            new[] { "CHO_PHAN_CONG", "DANG_THUC_HIEN", "CHO_NGHIEM_THU", "HOAN_THANH", "TRA_LAI" },
            WOStatus.All);
    }

    [Fact]
    public void Trang_thai_phieu_co_cho_nghiem_thu()
    {
        Assert.Contains(WOStatus.ChoNghiemThu, WOStatus.All);
    }

    // ---------------------------------------------------------------
    // LỖI: tạo phiếu thiếu hạn hoàn thành trả HTTP 500
    // Nguyên nhân: DateOnly không cho null nên thiếu deadline ra
    // 0001-01-01, chạm CHECK (deadline >= created_at) → 23514.
    // ---------------------------------------------------------------

    [Fact]
    public void Han_hoan_thanh_mac_dinh_phai_la_default_de_biet_duoc_bat_loi()
    {
        // DateOnly mặc định là 0001-01-01 — nhỏ hơn mọi ngày tạo phiếu.
        Assert.True(default(DateOnly) < new DateOnly(2026, 1, 1));
    }
}
