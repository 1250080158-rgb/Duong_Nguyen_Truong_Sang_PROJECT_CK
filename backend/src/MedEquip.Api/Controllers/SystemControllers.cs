using MedEquip.Api.Auth;
using MedEquip.Api.Services;
using MedEquip.Domain.Entities;
using MedEquip.Infrastructure;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using MedEquip.Domain;

namespace MedEquip.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController(DataContext db, IConfiguration cfg, IOptionsMonitor<AuthOptions> authOptions) : ControllerBase
{
    public record LoginRequest(string Username, string Password);

    /// <summary>
    /// Đăng nhập bản dev: mật khẩu chung "123456".
    /// Chỉ tồn tại khi Auth:Mode = "Dev". Ở chế độ OIDC/Keycloak, người dùng
    /// đăng nhập qua trình duyệt (Authorization Code + PKCE) và endpoint này
    /// trả 404 để không ai lách được bằng cách gọi thẳng API.
    /// </summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [EnableRateLimiting("DangNhap")]
    public async Task<IActionResult> Login(LoginRequest req)
    {
        if (authOptions.CurrentValue.IsOidcMode) return NotFound();

        var user = await db.Users.Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.TenDangNhap == req.Username && u.HoatDong);
        if (user is null || req.Password != "123456")
            return Unauthorized(new { code = "BAD_CREDENTIALS", message = "Sai tên đăng nhập hoặc mật khẩu." });

        user.DangNhapCuoi = DateTime.UtcNow;
        await db.SaveChangesAsync();
        var (token, expires) = TokenService.Create(user, cfg);
        return Ok(new
        {
            token,
            expires,
            user = new
            {
                id = user.IdNguoiDung,
                username = user.TenDangNhap,
                fullName = user.HoTen,
                role = user.VaiTro,
                department = user.Department?.Ten,
                departmentId = user.IdKhoa,
            },
        });
    }

    /// <summary>
    /// Hồ sơ người dùng hiện tại, lấy từ claim của token.
    /// Frontend gọi endpoint này sau khi Keycloak trả callback, để lấy
    /// vai trò nghiệp vụ đã được RoleMapping dịch sẵn trong claim.
    /// Ưu tiên hồ sơ trong bảng users (có cả khoa) — khi không có thì dựng
    /// từ claim, để IdP là nguồn danh tính còn CSDL chỉ bổ sung nghiệp vụ.
    /// </summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<IActionResult> Me()
    {
        var username = User.Identity?.Name
            ?? User.FindFirst("preferred_username")?.Value
            ?? User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value;

        if (string.IsNullOrEmpty(username))
            return Unauthorized(new { code = "NO_SUBJECT", message = "Token không có thông tin người dùng." });

        var role = RoleMapping.Resolve(User)
            ?? User.FindFirst(AppRoleClaimsTransformation.AppRoleClaimType)?.Value
            ?? UserRoles.KyThuatVien;

        var user = await db.Users.Include(u => u.Department)
            .FirstOrDefaultAsync(u => u.TenDangNhap == username && u.HoatDong);

        if (user is not null)
        {
            user.DangNhapCuoi = DateTime.UtcNow;
            await db.SaveChangesAsync();
        }

        return Ok(new
        {
            id = user?.IdNguoiDung ?? 0,
            username,
            fullName = user?.HoTen
                ?? User.FindFirst(System.Security.Claims.ClaimTypes.GivenName)?.Value
                ?? username,
            role,
            department = user?.Department?.Ten,
            // Mã khoa: đầu mối khoa cần để lọc thiết bị/phiếu theo khoa
            // của mình thay vì một mã khoa viết cứng trong giao diện.
            departmentId = user?.IdKhoa,
        });
    }
}

[ApiController]
[Route("api/users")]
// Danh sách tài khoản và địa bàn phòng ban chỉ nên hiện với nhóm quản trị.
// Trước đây chỉ [Authorize] nên bất kỳ tài khoản nào đã đăng nhập cũng gọi
// được và đọc hết danh sách nhân sự toàn viện.
[Authorize(Roles = "ADMIN,DIEU_PHOI")]
public class UsersController(DataContext db, IAuditService audit) : ControllerBase
{
    /// Màn Admin > Người dùng & vai trò (đồng bộ Keycloak).
    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? role, [FromQuery] string? q)
    {
        var query = db.Users.AsQueryable();
        if (!string.IsNullOrEmpty(role) && role != "Tất cả") query = query.Where(u => u.VaiTro == role);
        if (!string.IsNullOrEmpty(q))
            query = query.Where(u => u.HoTen.Contains(q) || u.TenDangNhap.Contains(q));
        var users = await query.Include(u => u.Department)
            .OrderBy(u => u.IdNguoiDung).ToListAsync();
        return Ok(users.Select(u => new
        {
            id = u.IdNguoiDung,
            name = u.HoTen,
            username = u.TenDangNhap,
            role = u.VaiTro,
            department = u.Department?.Ten,   // UI hiện tên khoa, không phải số id
            lastLogin = u.DangNhapCuoi,
            status = u.HoatDong ? "active" : "inactive",
        }));
    }

    public record UpdateRoleRequest(string Role);

    /// <summary>
    /// Đổi vai trò nghiệp vụ của tài khoản (FR-13 — quản lý người dùng).
    ///
    /// Vai trò trong CSDL là nguồn quyết định quyền khi chế độ Dev; ở chế độ
    /// OIDC, Keycloak là nguồn danh tính nên thay đổi ở đây KHÔNG tự đồng bộ
    /// sang realm — màn hình hiển thị rõ điều đó.
    /// </summary>
    [HttpPut("{id:int}/role")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> UpdateRole(int id, UpdateRoleRequest req)
    {
        if (!RoleMapping.IsKnown(req.Role))
            throw new BusinessException("INVALID_ROLE",
                $"Vai trò không hợp lệ: {req.Role}. Chỉ nhận: {string.Join(", ", RoleMapping.All)}.", 400);

        var user = await db.Users.FindAsync(id)
                   ?? throw new BusinessException("NOT_FOUND", "Không tìm thấy người dùng.", 404);

        var oldRole = user.VaiTro;
        if (oldRole == req.Role) return Ok(new { id = user.IdNguoiDung, role = user.VaiTro });

        user.VaiTro = req.Role;
        await db.SaveChangesAsync();
        await audit.AppendAsync(User.Identity?.Name ?? "?", "USER_ROLE_UPDATE",
            $"user {user.TenDangNhap}", $"{oldRole} -> {req.Role}");
        return Ok(new { id = user.IdNguoiDung, role = user.VaiTro });
    }

    public record UpdateStatusRequest(bool Active);

    /// <summary>
    /// Đồng bộ tài khoản người dùng từ Keycloak về bảng users (UC-09).
    /// Keycloak là nguồn danh tính; vai trò nghiệp vụ được dịch từ
    /// realm_access.roles. Khi chưa cấu hình tài khoản quản trị Keycloak thì
    /// trả 501 kèm hướng dẫn cấu hình.
    /// </summary>
    [HttpPost("sync-keycloak")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> SyncKeycloak(KeycloakSyncService sync)
    {
        var result = await sync.SyncAsync(User.Identity?.Name ?? "?");
        return Ok(result);
    }

    /// <summary>
    /// Khoá / mở khoá tài khoản (FR-13). Tài khoản bị khoá không đăng nhập
    /// được và không hiện trong danh sách chọn kỹ thuật viên.
    /// </summary>
    [HttpPut("{id:int}/status")]
    [Authorize(Roles = "ADMIN")]
    public async Task<IActionResult> UpdateStatus(int id, UpdateStatusRequest req)
    {
        var user = await db.Users.FindAsync(id)
                   ?? throw new BusinessException("NOT_FOUND", "Không tìm thấy người dùng.", 404);

        // Không cho tự khoá chính mình — nếu không sẽ mất tài khoản quản trị.
        if (user.TenDangNhap == User.Identity?.Name && !req.Active)
            throw new BusinessException("CANNOT_LOCK_SELF",
                "Không thể khoá chính tài khoản đang đăng nhập.", 400);

        var oldStatus = user.HoatDong;
        user.HoatDong = req.Active;
        await db.SaveChangesAsync();
        await audit.AppendAsync(User.Identity?.Name ?? "?", "USER_STATUS_UPDATE",
            $"user {user.TenDangNhap}",
            $"{(oldStatus ? "đang hoạt động" : "đã khoá")} -> {(req.Active ? "đang hoạt động" : "đã khoá")}");
        return Ok(new { id = user.IdNguoiDung, status = user.HoatDong ? "active" : "inactive" });
    }
}

[ApiController]
[Route("api/audit")]
// Nhật ký kiểm toán chứa dữ liệu nhạy cảm về cả nhân sự lẫn thiết bị:
// chỉ ADMIN được đọc, không mở cho kỹ thuật viên hay đầu mối khoa.
[Authorize(Roles = "ADMIN")]
public class AuditController(IAuditService audit) : ControllerBase
{
    /// Màn Admin > Audit Log. Kèm kết quả kiểm tra chuỗi hash từng dòng
    /// (row_ok / chain_ok) — nếu có ai sửa CSDL trực tiếp là lộ ngay.
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? actor, [FromQuery] string? action,
        [FromQuery] DateTime? from, [FromQuery] DateTime? to)
    {
        var verified = await audit.VerifyChainAsync();
        IEnumerable<AuditChainRow> rows = verified;
        if (!string.IsNullOrEmpty(actor)) rows = rows.Where(r => r.Entry.NguoiThucHien.Contains(actor));
        if (!string.IsNullOrEmpty(action)) rows = rows.Where(r => r.Entry.HanhDong == action);
        if (from.HasValue) rows = rows.Where(r => r.Entry.TaoLuc >= from);
        if (to.HasValue) rows = rows.Where(r => r.Entry.TaoLuc <= to);

        return Ok(new
        {
            chainIntact = verified.All(r => r.RowOk && r.ChainOk),
            items = rows.Select(r => new
            {
                r.Entry.IdKiemToan,
                time = r.Entry.TaoLuc,
                r.Entry.NguoiThucHien,
                r.Entry.HanhDong,
                r.Entry.DoiTuong,
                r.Entry.ChiTiet,
                hash = r.Entry.MaBam[..12] + "…",
                hashOk = r.RowOk && r.ChainOk,
            }),
        });
    }
}

[ApiController]
[Route("api/config")]
[Authorize(Roles = "ADMIN")]
public class ConfigController(DataContext db, IAuditService audit) : ControllerBase
{
    [HttpGet]
    public async Task<IActionResult> GetAll() =>
        Ok(await db.SystemConfig.OrderBy(c => c.ConfigKey).ToListAsync());

    public record UpdateRequest(string Value);

    // Ngưỡng cảnh báo phải là số nguyên dương — nhập "abc" hoặc "-5" thì hệ
    // thống không tính được ngày hết hạn, mà người dùng lại tưởng đã sửa xong.
    private static readonly string[] NumericKeys =
    {
        "warning_days_early", "warning_days_urgent", "warning_days_critical",
    };

    [HttpPut("{key}")]
    public async Task<IActionResult> Update(string key, UpdateRequest req)
    {
        var config = await db.SystemConfig.FindAsync(key)
            ?? throw new Domain.BusinessException("NOT_FOUND", $"Không có cấu hình '{key}'.", 404);

        if (NumericKeys.Contains(key, StringComparer.OrdinalIgnoreCase))
        {
            if (!int.TryParse(req.Value?.Trim(), out var days))
                throw new Domain.BusinessException("INVALID_CONFIG_VALUE",
                    $"'{key}' phải là số nguyên (số ngày cảnh báo).", 400);
            if (days < 0)
                throw new Domain.BusinessException("INVALID_CONFIG_VALUE",
                    $"'{key}' không được nhỏ hơn 0.", 400);
        }
        else if (req.Value is null || req.Value.Trim().Length == 0)
        {
            throw new Domain.BusinessException("INVALID_CONFIG_VALUE",
                "Giá trị cấu hình không được để trống.", 400);
        }

        var oldValue = config.ConfigValue;
        config.ConfigValue = req.Value;
        await db.SaveChangesAsync();
        await audit.AppendAsync(User.Identity?.Name ?? "?", "CONFIG_UPDATE", key,
            $"{oldValue} -> {req.Value}");
        return Ok(config);
    }
}

[ApiController]
[Route("api/notifications")]
[Authorize]
public class NotificationsController(
    DataContext db, MedEquip.Api.Auth.CurrentUserAccessor currentUser) : ControllerBase
{
    /// <summary>
    /// Hộp thư của chính người đang đăng nhập. Bảng notifications trước đây
    /// được ghi dữ liệu mẫu nhưng KHÔNG có đường đọc nào, nên không ai thấy
    /// được thông báo nào.
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetMine([FromQuery] bool? unreadOnly)
    {
        // Không được bỏ lọc theo user: trước đây khi claim không ánh xạ được
        // IdNguoiDung thì truy vấn KHÔNG có WHERE và trả toàn bộ hộp thư của
        // mọi người trong viện — lộ thông báo của người khác.
        var me = currentUser.IdNguoiDung
            ?? throw new Domain.BusinessException("USER_NOT_MAPPED",
                "Tài khoản chưa được ánh xạ sang bảng người dùng.", 403);
        var query = db.Notifications.Where(n => n.UserId == me).AsQueryable();
        if (unreadOnly == true) query = query.Where(n => !n.IsRead);

        var rows = await query
            .OrderByDescending(n => n.NotificationId)
            .Take(100)
            .ToListAsync();

        return Ok(new
        {
            unread = rows.Count(r => !r.IsRead),
            items = rows.Select(n => new
            {
                id = n.NotificationId,
                type = n.Type,
                message = n.Message,
                link = n.Link,
                isRead = n.IsRead,
                createdAt = n.CreatedAt,
            }),
        });
    }

    [HttpPost("{id:long}/read")]
    public async Task<IActionResult> MarkRead(long id)
    {
        var n = await db.Notifications.FindAsync(id)
                ?? throw new Domain.BusinessException("NOT_FOUND", "Không tìm thấy thông báo.", 404);

        // Chỉ chủ nhân thông báo được đánh dấu đã đọc.
        if (currentUser.IdNguoiDung is null || n.UserId != currentUser.IdNguoiDung)
            throw new Domain.BusinessException("FORBIDDEN", "Không phải thông báo của bạn.", 403);

        n.IsRead = true;
        await db.SaveChangesAsync();
        return Ok(n);
    }

    [HttpPost("read-all")]
    public async Task<IActionResult> MarkAllRead()
    {
        var me = currentUser.IdNguoiDung ?? throw new Domain.BusinessException("USER_NOT_MAPPED",
            "Tài khoản chưa được ánh xạ sang bảng người dùng.", 403);
        var rows = await db.Notifications
            .Where(n => n.UserId == me && !n.IsRead)
            .ToListAsync();
        foreach (var n in rows) n.IsRead = true;
        await db.SaveChangesAsync();
        return Ok(new { updated = rows.Count });
    }
}
