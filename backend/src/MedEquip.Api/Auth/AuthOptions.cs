using System.Security.Claims;
using MedEquip.Domain;

namespace MedEquip.Api.Auth;

/// <summary>
/// Chế độ xác thực, đọc từ section "Auth" trong appsettings.json.
///   Mode = "Dev"  → API tự cấp JWT bằng khoá đối xứng, endpoint /api/auth/login mở.
///   Mode = "Oidc" → xác thực bằng access token do Keycloak (hoặc IdP bất kỳ) cấp;
///                   /api/auth/login bị tắt hoàn toàn.
/// </summary>
public class AuthOptions
{
    public const string SectionName = "Auth";

    public string Mode { get; set; } = "Dev";

    public OidcOptions Oidc { get; set; } = new();

    public bool IsDevMode => string.Equals(Mode, "Dev", StringComparison.OrdinalIgnoreCase);
    public bool IsOidcMode => !IsDevMode;

    public class OidcOptions
    {
        /// <summary>URL realm của Keycloak, ví dụ http://localhost:8080/realms/medequip</summary>
        public string Authority { get; set; } = "";

        /// <summary>
        /// Địa chỉ realm mà TRÌNH DUYỆT dùng để đăng nhập. Trong Docker,
        /// Keycloak phát hành token với issuer là tên miền công khai nên
        /// trình duyệt phải gọi được tên đó; còn API chỉ cần Authority
        /// nội bộ để tải khoá công khai. Nếu để trống thì lấy Authority.
        /// </summary>
        public string PublicAuthority { get; set; } = "";

        /// <summary>Client id của API trong realm. Token phải chứa audience này.</summary>
        public string Audience { get; set; } = "medequip-api";

        /// <summary>Keycloak chạy local qua HTTP nên metadata không có HTTPS.</summary>
        public bool RequireHttpsMetadata { get; set; } = true;

        /// <summary>Client secret, chỉ dùng cho luồng client_credentials của máy chủ.</summary>
        public string ClientIdSecret { get; set; } = "";
    }
}

/// <summary>
/// Dịch claim của IdP sang vai trò nghiệp vụ mà UI/backend dùng
/// (ADMIN, DIEU_PHOI, KY_THUAT_VIEN, DAU_MOI_KHOA).
/// Keycloak đặt vai trò trong realm_access.roles; realm dùng đúng các tên
/// trong <see cref="KeycloakToApp"/> để map sang vai trò của ứng dụng.
/// </summary>
public static class RoleMapping
{
    /// <summary>Các tên vai trò trong realm Keycloak tương ứng, theo thứ tự ưu tiên cao → thấp.</summary>
    public static readonly IReadOnlyDictionary<string, string> KeycloakToApp = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
    {
        ["MED-EQUIP_ADMIN"] = UserRoles.Admin,
        ["admin"] = UserRoles.Admin,
        ["MED-EQUIP_DIEU_PHOI"] = UserRoles.DieuPhoi,
        ["dieu-phoi"] = UserRoles.DieuPhoi,
        ["MED-EQUIP_KY_THUAT_VIEN"] = UserRoles.KyThuatVien,
        ["ky-thuat-vien"] = UserRoles.KyThuatVien,
        ["MED-EQUIP_DAU_MOI_KHOA"] = UserRoles.DauMoiKhoa,
        ["dau-moi-khoa"] = UserRoles.DauMoiKhoa,
    };

    /// <summary>Tất cả vai trò nghiệp vụ hợp lệ.</summary>
    public static readonly string[] All =
    {
        UserRoles.Admin, UserRoles.DieuPhoi, UserRoles.KyThuatVien, UserRoles.DauMoiKhoa,
    };

    public static bool IsKnown(string? role) =>
        role is not null && All.Contains(role, StringComparer.OrdinalIgnoreCase);

    /// <summary>
    /// Rút vai trò nghiệp vụ từ principal. Ưu tiên claim do API tự cấp
    /// (chế độ Dev), sau đó tới realm_access của Keycloak.
    /// Trả về null nếu không khớp vai trò nào.
    /// </summary>
    public static string? Resolve(ClaimsPrincipal principal)
    {
        // Chế độ Dev: token tự cấp đã đặt sẵn ClaimTypes.Role.
        var direct = principal.FindFirst(ClaimTypes.Role)?.Value;
        if (IsKnown(direct)) return direct;

        // Keycloak gom vai trò trong realm_access.roles. Với JWT do
        // Microsoft.IdentityModel parse, realm_access là object nên không
        // tra được bằng FindFirst — duyệt claim thô rồi so khớp tên.
        var realmAccess = principal.FindFirst("realm_access")?.Value;
        if (!string.IsNullOrEmpty(realmAccess))
        {
            foreach (var (key, appRole) in KeycloakToApp)
            {
                if (realmAccess.Contains(key, StringComparison.OrdinalIgnoreCase)) return appRole;
            }
        }

        // Một số IdP đặt vai trò dạng claim phẳng hoặc trong scope.
        foreach (var claim in principal.Claims)
        {
            if (claim.Type is ClaimTypes.Role or "role" or "roles" or "scope" && IsKnown(claim.Value))
                return claim.Value;
        }

        return null;
    }
}
