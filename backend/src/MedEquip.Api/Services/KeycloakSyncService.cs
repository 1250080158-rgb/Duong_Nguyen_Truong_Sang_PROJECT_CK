using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using MedEquip.Api.Auth;
using MedEquip.Domain;
using MedEquip.Domain.Entities;
using MedEquip.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace MedEquip.Api.Services;

/// <summary>
/// Đồng bộ tài khoản người dùng từ Keycloak về bảng <c>users</c>.
///
/// Keycloak là nguồn danh tính: mật khẩu và trạng thái kích hoạt nằm ở
/// realm; vai trò nghiệp vụ (ADMIN, DIEU_PHOI, KY_THUAT_VIEN, DAU_MOI_KHOA)
/// được dịch từ realm_access.roles. Bảng <c>users</c> trong CSDL là nơi
/// máy chủ tra quyền và ghi nhật ký kiểm toán, nên hai nguồn phải khớp.
///
/// Dịch vụ gọi Keycloak Admin REST API (Resource Owner Password grant với
/// tài khoản quản trị). Khi chưa cấu hình thông tin quản trị thì trả lỗi
/// rõ ràng thay vì im lặng bỏ qua.
/// </summary>
public class KeycloakSyncService(
    DataContext db,
    IConfiguration cfg,
    IHttpClientFactory httpFactory,
    IAuditService audit)
{
    private record RealmUser(
        string Username,
        string? FirstName,
        string? LastName,
        string? Email,
        bool Enabled,
        JsonElement? RealmAccess,
        JsonElement? Attributes);

    /// <summary>Kết quả đồng bộ để giao diện hiển thị.</summary>
    public record SyncResult(int Total, int Created, int Updated, int Skipped, List<string> Details);

    public async Task<SyncResult> SyncAsync(string actor)
    {
        var authority = cfg["Auth:Oidc:Authority"]?.TrimEnd('/');
        var adminUser = cfg["Auth:Oidc:AdminUsername"];
        var adminPass = cfg["Auth:Oidc:AdminPassword"];

        if (string.IsNullOrWhiteSpace(authority)
            || string.IsNullOrWhiteSpace(adminUser)
            || string.IsNullOrWhiteSpace(adminPass))
        {
            throw new BusinessException("KEYCLOAK_SYNC_NOT_CONFIGURED",
                "Chưa cấu hình thông tin quản trị Keycloak "
                + "(Auth:Oidc:AdminUsername, Auth:Oidc:AdminPassword).", 501);
        }

        // Authority có dạng http://host/realms/{realm} — phần quản trị nằm
        // ở http://host (không có /realms) và realm là phần cuối.
        var realm = cfg["Auth:Oidc:Realm"];
        if (string.IsNullOrWhiteSpace(realm))
        {
            var segments = authority.Split('/');
            realm = segments.Length > 0 ? segments[^1] : "medequip";
        }
        var baseUrl = authority.Contains("/realms/", StringComparison.OrdinalIgnoreCase)
            ? authority[..authority.IndexOf("/realms/", StringComparison.OrdinalIgnoreCase)]
            : authority;

        var client = httpFactory.CreateClient("keycloak-admin");
        var token = await GetAdminTokenAsync(client, baseUrl, realm, adminUser, adminPass);
        var users = await GetRealmUsersAsync(client, baseUrl, realm, token);

        int created = 0, updated = 0, skipped = 0;
        var details = new List<string>();

        foreach (var ru in users)
        {
            var role = ResolveRole(ru);
            if (role is null)
            {
                skipped++;
                continue;
            }

            var existing = await db.Users.FirstOrDefaultAsync(u => u.TenDangNhap == ru.Username);
            if (existing is null)
            {
                db.Users.Add(new User
                {
                    TenDangNhap = ru.Username,
                    HoTen = BuildFullName(ru),
                    VaiTro = role,
                    Email = ru.Email,
                    HoatDong = ru.Enabled,
                    // Khoa chưa có trong realm: quản trị viên gán sau trong
                    // màn Người dùng & vai trò.
                    IdKhoa = null,
                });
                created++;
                details.Add($"Tạo mới {ru.Username} ({role})");
            }
            else
            {
                var changes = new List<string>();
                if (existing.VaiTro != role)
                {
                    changes.Add($"vai trò {existing.VaiTro} → {role}");
                    existing.VaiTro = role;
                }
                if (existing.HoatDong != ru.Enabled)
                {
                    changes.Add($"trạng thái {(ru.Enabled ? "mở khoá" : "khoá")}");
                    existing.HoatDong = ru.Enabled;
                }
                if (!string.IsNullOrWhiteSpace(ru.Email) && existing.Email != ru.Email)
                {
                    changes.Add("cập nhật email");
                    existing.Email = ru.Email;
                }

                if (changes.Count > 0)
                {
                    updated++;
                    details.Add($"Cập nhật {ru.Username}: {string.Join(", ", changes)}");
                }
                else skipped++;
            }
        }

        await db.SaveChangesAsync();
        await audit.AppendAsync(actor, "SYNC_KEYCLOAK", "realm " + realm,
            $"Đồng bộ {users.Count} tài khoản: tạo {created}, cập nhật {updated}, bỏ qua {skipped}.");

        return new SyncResult(users.Count, created, updated, skipped, details);
    }

    private static async Task<string> GetAdminTokenAsync(
        HttpClient client, string baseUrl, string realm, string user, string password)
    {
        var body = new Dictionary<string, string>
        {
            ["client_id"] = "admin-cli",
            ["username"] = user,
            ["password"] = password,
            ["grant_type"] = "password",
        };
        using var response = await client.PostAsJsonAsync(
            $"{baseUrl}/realms/master/protocol/openid-connect/token", body);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        if (!doc.RootElement.TryGetProperty("access_token", out var token))
            throw new BusinessException("KEYCLOAK_SYNC_FAILED",
                "Keycloak không trả về access token cho tài khoản quản trị.", 502);
        return token.GetString() ?? "";
    }

    private static async Task<List<RealmUser>> GetRealmUsersAsync(
        HttpClient client, string baseUrl, string realm, string token)
    {
        using var request = new HttpRequestMessage(
            HttpMethod.Get, $"{baseUrl}/admin/realms/{realm}/users?max=200");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);

        using var response = await client.SendAsync(request);
        response.EnsureSuccessStatusCode();

        var json = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(json);
        var result = new List<RealmUser>();

        foreach (var item in doc.RootElement.EnumerateArray())
        {
            var username = item.TryGetProperty("username", out var u) ? u.GetString() : null;
            if (string.IsNullOrWhiteSpace(username)) continue;

            result.Add(new RealmUser(
                username,
                item.TryGetProperty("firstName", out var f) ? f.GetString() : null,
                item.TryGetProperty("lastName", out var l) ? l.GetString() : null,
                item.TryGetProperty("email", out var e) ? e.GetString() : null,
                !item.TryGetProperty("enabled", out var en) || en.GetBoolean(),
                item.TryGetProperty("realmAccess", out var ra) ? ra.Clone() : null,
                item.TryGetProperty("attributes", out var at) ? at.Clone() : null));
        }

        return result;
    }

    /// <summary>Dịch vai trò trong realm sang vai trò nghiệp vụ của ứng dụng.</summary>
    private static string? ResolveRole(RealmUser ru)
    {
        if (ru.RealmAccess is not { ValueKind: JsonValueKind.Object } access) return null;
        if (!access.TryGetProperty("roles", out var roles) || roles.ValueKind != JsonValueKind.Array)
            return null;

        foreach (var role in roles.EnumerateArray())
        {
            var name = role.GetString();
            if (string.IsNullOrWhiteSpace(name)) continue;
            if (RoleMapping.KeycloakToApp.TryGetValue(name, out var appRole))
                return appRole;
        }

        return null;
    }

    private static string BuildFullName(RealmUser ru)
    {
        var full = $"{ru.FirstName ?? ""} {ru.LastName ?? ""}".Trim();
        return string.IsNullOrWhiteSpace(full) ? ru.Username : full;
    }
}
