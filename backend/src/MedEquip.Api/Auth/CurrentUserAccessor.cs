using System.Security.Claims;
using MedEquip.Domain;
using MedEquip.Infrastructure;

namespace MedEquip.Api.Auth;

/// <summary>
/// Xác định người đang đăng nhập và tra user_id trong CSDL.
///
/// KHÔNG được đọc thẳng <see cref="ClaimTypes.NameIdentifier"/> trong
/// controller: claim đó chỉ có trong JWT nội bộ của chế độ Dev. Token do
/// Keycloak cấp không có claim này, nên `FindFirstValue(...) ?? "1"` rơi về
/// user_id = 1 (minhvt) và mọi bản ghi kiểm toán đều bị ghi nhầm người.
///
/// Thứ tự tra cứu:
///   1. user_id (claim số) — chế độ Dev, hoặc mapper tuỳ biến.
///   2. sub / preferred_username — đối chiếu cột <c>users.username</c>.
/// Nếu không khớp tài khoản nào thì trả về null để nơi gọi báo lỗi rõ ràng,
/// thay vì ghi sai người vào nhật ký kiểm toán.
/// </summary>
public class CurrentUserAccessor
{
    private readonly IHttpContextAccessor _accessor;
    private readonly DataContext _db;

    public CurrentUserAccessor(IHttpContextAccessor accessor, DataContext db)
    {
        _accessor = accessor;
        _db = db;
    }

    /// <summary>Tên đăng nhập của người dùng, luôn có giá trị để ghi audit.</summary>
    public string TenDangNhap => ResolveUsername(_accessor.HttpContext?.User);

    /// <summary>Alias cho tương thích ngược với code cũ.</summary>
    public string Username => TenDangNhap;

    /// <summary>
    /// Vai trò nghiệp vụ của người đang đăng nhập (ADMIN, DIEU_PHOI,
    /// KY_THUAT_VIEN, DAU_MOI_KHOA) hoặc null nếu không xác định được.
    /// Dùng để giới hạn phạm vi dữ liệu theo vai trò, ví dụ đầu mối khoa
    /// chỉ xem thiết bị của khoa mình.
    /// </summary>
    public string? VaiTro => RoleMapping.Resolve(_accessor.HttpContext?.User ?? new ClaimsPrincipal());

    /// <summary>
    /// Khoa của người đang đăng nhập, hoặc null nếu không ánh xạ được.
    /// </summary>
    public int? IdKhoa
    {
        get
        {
            var id = IdNguoiDung;
            if (id is null) return null;
            return _db.Users.Where(u => u.IdNguoiDung == id)
                            .Select(u => u.IdKhoa)
                            .FirstOrDefault();
        }
    }

    /// <summary>
    /// user_id trong CSDL, hoặc null nếu tài khoản OIDC chưa được ánh xạ
    /// vào bảng <c>users</c>.
    /// </summary>
    public int? IdNguoiDung
    {
        get
        {
            var principal = _accessor.HttpContext?.User;
            if (principal?.Identity?.IsAuthenticated != true) return null;

            var direct = ResolveUserId(principal);
            if (direct.HasValue) return direct;

            // sub của Keycloak là UUID, không phải user_id nội bộ.
            var username = ResolveUsername(principal);
            if (string.IsNullOrWhiteSpace(username)) return null;

            return _db.Users
                .Where(u => u.TenDangNhap == username)
                .Select(u => (int?)u.IdNguoiDung)
                .FirstOrDefault();
        }
    }

    /// <summary>
    /// user_id ghi thẳng trong token, hoặc null.
    ///
    /// Chỉ chấp nhận giá trị là SỐ. Token Keycloak đặt <c>sub</c> là UUID nên
    /// phải trả null chứ không được rơi về 1 — nếu không, mọi bằng chứng và
    /// dòng kiểm toán đều bị quy cho cùng một người.
    /// </summary>
    public static int? ResolveUserId(ClaimsPrincipal? principal)
    {
        var raw = principal?.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(raw, out var id) ? id : null;
    }

    /// <summary>Tên đăng nhập, dùng làm "actor" cho nhật ký kiểm toán.</summary>
    public static string ResolveUsername(ClaimsPrincipal? principal) =>
        principal?.Identity?.Name
        ?? principal?.FindFirstValue("preferred_username")
        ?? "?";

    /// <summary>
    /// user_id, hoặc ném lỗi 403 nếu không ánh xạ được. Dùng cho các đường ghi
    /// dữ liệu cần chắc chắn là đúng người (bằng chứng, phân công, hoàn thành).
    /// </summary>
    public int RequireUserId()
    {
        var id = IdNguoiDung;
        if (id is null)
            throw new BusinessException("USER_NOT_MAPPED",
                $"Tài khoản '{TenDangNhap}' chưa được ánh xạ sang bảng người dùng. " +
                "Hãy liên kết tài khoản Keycloak với một bản ghi trong bảng users.", 403);
        return id.Value;
    }
}
