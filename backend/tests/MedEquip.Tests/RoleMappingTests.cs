using System.Security.Claims;
using MedEquip.Api.Auth;
using MedEquip.Domain;
using Xunit;

namespace MedEquip.Tests;

/// <summary>
/// Kiểm thử việc dịch vai trò từ Keycloak sang vai trò nghiệp vụ.
///
/// Đây là mắt xích quyết định phân quyền: nếu Resolve trả sai hoặc
/// trả null, người dùng sẽ bị chặn oan (403) hoặc — nguy hiểm hơn —
/// được cấp quyền không đúng vai trò.
/// </summary>
public class RoleMappingTests
{
    /// <summary>Dựng principal đã xác thực với các claim cho trước.</summary>
    private static ClaimsPrincipal Principal(params Claim[] claims)
    {
        var identity = new ClaimsIdentity(claims, authenticationType: "Test");
        return new ClaimsPrincipal(identity);
    }

    [Fact]
    public void Chế_độ_Dev_đọc_được_vai_trò_từ_ClaimTypes_Role()
    {
        var user = Principal(new Claim(ClaimTypes.Role, UserRoles.DieuPhoi));

        Assert.Equal(UserRoles.DieuPhoi, RoleMapping.Resolve(user));
    }

    [Fact]
    public void Chế_độ_Oidc_dịch_được_vai_trò_từ_realm_access()
    {
        // Keycloak gom vai trò trong realm_access.roles dưới dạng JSON.
        var realmAccess = """{"roles":["offline_access","MED-EQUIP_DIEU_PHOI"]}""";
        var user = Principal(new Claim("realm_access", realmAccess));

        Assert.Equal(UserRoles.DieuPhoi, RoleMapping.Resolve(user));
    }

    [Theory]
    [InlineData("MED-EQUIP_ADMIN", UserRoles.Admin)]
    [InlineData("MED-EQUIP_DIEU_PHOI", UserRoles.DieuPhoi)]
    [InlineData("MED-EQUIP_KY_THUAT_VIEN", UserRoles.KyThuatVien)]
    [InlineData("MED-EQUIP_DAU_MOI_KHOA", UserRoles.DauMoiKhoa)]
    public void Dịch_đủ_bốn_vai_trò_nghiệp_vụ(string keycloakRole, string expected)
    {
        var user = Principal(new Claim("realm_access", $$"""{"roles":["{{keycloakRole}}"]}"""));

        Assert.Equal(expected, RoleMapping.Resolve(user));
    }

    [Fact]
    public void Chọn_vai_trò_cao_hơn_khi_có_nhiều_vai_trò()
    {
        // Người dùng có cả hai vai trò thì lấy vai trò quyền cao hơn.
        var user = Principal(new Claim(
            "realm_access",
            """{"roles":["MED-EQUIP_KY_THUAT_VIEN","MED-EQUIP_ADMIN"]}"""));

        Assert.Equal(UserRoles.Admin, RoleMapping.Resolve(user));
    }

    [Fact]
    public void Trả_null_khi_vai_trò_không_đúng_khuôn_dự_định()
    {
        // Vai trò lạ không được cấp quyền nào cả — thà không vào còn hơn vào sai.
        var user = Principal(new Claim("realm_access", """{"roles":["default-roles-medequip"]}"""));

        Assert.Null(RoleMapping.Resolve(user));
    }

    [Fact]
    public void Trả_null_khi_token_không_chứa_vai_trò_nào()
    {
        var user = Principal(new Claim(ClaimTypes.Name, "dphuong"));

        Assert.Null(RoleMapping.Resolve(user));
    }

    [Fact]
    public void Bỏ_qua_vai_trò_dev_không_hợp_lệ()
    {
        // Chế độ Dev nhưng token mang vai trò bậy — vẫn phải kiểm tra.
        var user = Principal(new Claim(ClaimTypes.Role, "HACKER"));

        Assert.Null(RoleMapping.Resolve(user));
    }

    [Fact]
    public void Đọc_được_vai_trò_ở_dạng_claim_phẳng()
    {
        // Một số IdP không gom vào realm_access mà đặt claim role riêng.
        var user = Principal(new Claim("role", UserRoles.KyThuatVien));

        Assert.Equal(UserRoles.KyThuatVien, RoleMapping.Resolve(user));
    }

    [Fact]
    public void IsKnown_chỉ_nhận_đúng_bốn_vai_trò_hệ_thống()
    {
        foreach (var role in RoleMapping.All)
            Assert.True(RoleMapping.IsKnown(role));

        Assert.False(RoleMapping.IsKnown("KHACH"));
        Assert.False(RoleMapping.IsKnown(""));
        Assert.False(RoleMapping.IsKnown(null));
    }

    [Fact]
    public void Danh_sách_vai_trò_không_trùng_lặp()
    {
        Assert.Equal(RoleMapping.All.Length, RoleMapping.All.Distinct().Count());
    }
}
