using System.Security.Claims;
using MedEquip.Api.Auth;
using Microsoft.AspNetCore.Authentication;

namespace MedEquip.Api.Auth;

/// <summary>
/// Chuyển vai trò do IdP cấp thành vai trò nghiệp vụ của ứng dụng, rồi
/// nhân bản ra claim RoleClaimType để policy [Authorize(Roles = "...")]
/// hoạt động giống nhau ở cả chế độ Dev lẫn OIDC.
///
/// Chạy mỗi lần principal được xác thực, nên phải idempotent: nếu claim đã
/// được thêm thì không thêm lần nữa.
/// </summary>
public class AppRoleClaimsTransformation : IClaimsTransformation
{
    public const string AppRoleClaimType = "medequip_app_role";

    private readonly IHttpContextAccessor _httpContextAccessor;

    public AppRoleClaimsTransformation(IHttpContextAccessor httpContextAccessor) =>
        _httpContextAccessor = httpContextAccessor;

    public Task<ClaimsPrincipal> TransformAsync(ClaimsPrincipal principal)
    {
        if (principal.Identity is not ClaimsIdentity identity || !identity.IsAuthenticated)
            return Task.FromResult(principal);

        if (principal.HasClaim(c => c.Type == AppRoleClaimType))
            return Task.FromResult(principal);

        var role = RoleMapping.Resolve(principal);
        if (role is null) return Task.FromResult(principal);

        // Gắn vào identity của scheme mặc định (JwtBearer) để
        // AuthorizationService đọc được; đồng thời đặt vào claims đầu ra.
        identity.AddClaim(new Claim(AppRoleClaimType, role));

        return Task.FromResult(new ClaimsPrincipal(identity));
    }
}
