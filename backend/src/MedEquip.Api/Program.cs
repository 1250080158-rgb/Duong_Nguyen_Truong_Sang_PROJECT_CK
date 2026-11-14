using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using MedEquip.Api.Auth;
using MedEquip.Api.Services;
using MedEquip.Domain.Entities;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using MedEquip.Domain;
using MedEquip.Infrastructure;
using MedEquip.Infrastructure.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers().AddJsonOptions(o =>
{
    o.JsonSerializerOptions.Converters.Add(new System.Text.Json.Serialization.JsonStringEnumConverter());
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddOpenApi();

var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:5173", "http://localhost:8443" };
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
{
    if (allowedOrigins.Contains("*")) p.AllowAnyOrigin();
    else p.WithOrigins(allowedOrigins).AllowCredentials();
    p.AllowAnyHeader().AllowAnyMethod();
}));

builder.Services.AddDbContext<DataContext>(opt =>
    opt.UseNpgsql(builder.Configuration.GetConnectionString("MedEquip")));
builder.Services.AddScoped<IAuditService, AuditService>();
builder.Services.AddScoped<IAssignmentService, AssignmentService>();
builder.Services.AddScoped<IWorkOrderService, WorkOrderService>();
builder.Services.AddScoped<ISystemConfigService, SystemConfigService>();
builder.Services.AddScoped<KeycloakSyncService>();
builder.Services.AddHttpClient("keycloak-admin");

// Dịch vụ nền: tự khóa thiết bị quá hạn hiệu chuẩn (BR-01) và gửi cảnh báo
// sắp hết hạn theo ngưỡng trong system_config — thay cho ý định "chạy hằng
// ngày bằng pg_cron" chưa có cấu hình trong Docker Compose.
builder.Services.AddHostedService<MedEquip.Api.Services.AutoLockService>();


var authOptions = builder.Configuration.GetSection(AuthOptions.SectionName).Get<AuthOptions>() ?? new AuthOptions();
builder.Services.Configure<AuthOptions>(builder.Configuration.GetSection(AuthOptions.SectionName));

var jwt = builder.Configuration.GetSection("Jwt");
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(opt =>
    {
        if (authOptions.IsOidcMode)
        {
            // Token do Keycloak ký; khóa công khai lấy từ endpoint jwks của realm.
            opt.Authority = authOptions.Oidc.Authority;
            opt.Audience = authOptions.Oidc.Audience;
            opt.RequireHttpsMetadata = authOptions.Oidc.RequireHttpsMetadata;
            opt.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                // Trong Docker, API tải khoá công khai qua tên nội bộ
                // (http://keycloak:8080) nhưng token lại mang issuer là tên
                // công khai (http://localhost:8080) vì Keycloak phát hành cho
                // trình duyệt. Ghi đề ValidIssuer bằng issuer công khai để
                // kiểm tra vẫn đúng mà vẫn tải được jwks.
                ValidIssuer = string.IsNullOrWhiteSpace(authOptions.Oidc.PublicAuthority)
                    ? null
                    : authOptions.Oidc.PublicAuthority,
                NameClaimType = "preferred_username",
                // Vai trò nghiệp vụ lấy từ realm_access nên không map claim
                // role chuẩn; RoleMapping tự dịch. Đặt RoleClaimType thành
                // tên không tồn tại để tránh policy Roles() nhận nhầm.
                RoleClaimType = "medequip_app_role",
            };
        }
        else
        {
            opt.TokenValidationParameters = new TokenValidationParameters
            {
                ValidateIssuer = true,
                ValidateAudience = true,
                ValidateLifetime = true,
                ValidateIssuerSigningKey = true,
                ValidIssuer = jwt["Issuer"],
                ValidAudience = jwt["Audience"],
                IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!)),
                RoleClaimType = ClaimTypes.Role,
            };
        }
    });

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy("TheoVaiTro", policy => policy.RequireAuthenticatedUser());
});

// Giới hạn tần suất đăng nhập: chặn dò mật khẩu. Trước đây
// POST /api/auth/login không có bất kỳ hạn chế nào — ai cũng thử được vô
// hạn lần với mật khẩu dùng chung của chế độ Dev.
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.ContentType = "application/json; charset=utf-8";
        await context.HttpContext.Response.WriteAsJsonAsync(new
        {
            code = "TOO_MANY_REQUESTS",
            message = "Bạn đăng nhập quá nhiều lần. Vui lòng thử lại sau giây lát.",
        }, token);
    };
    options.AddPolicy("DangNhap", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                // 30 lần/phút theo địa chỉ IP: đủ cho mọi người dùng trong
                // một bệnh viện (thường đi qua cùng một IP ngoài) nhưng vẫn
                // chặn được dò mật khẩu.
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));
});

// Nối claim Keycloak (realm_access.roles) sang vai trò nghiệp vụ để
// [Authorize(Roles = "ADMIN,DIEU_PHOI")] không phải đổi giữa hai chế độ.
    builder.Services.AddHttpContextAccessor();
    builder.Services.AddScoped<MedEquip.Api.Auth.CurrentUserAccessor>();
builder.Services.AddTransient<Microsoft.AspNetCore.Authentication.IClaimsTransformation, AppRoleClaimsTransformation>();

var app = builder.Build();

// Tạo thư mục lưu bằng chứng (WorkOrdersController ghi file vào đây).
// KHÔNG phục vụ tĩnh tại đây: UseStaticFiles dưới đây chạy trước
// UseAuthentication nên mọi file được tải không cần đăng nhập — bằng
// chứng pháp y của phiếu công tác phải đi qua kiểm tra token.
var uploadsDir = Path.Combine(app.Environment.ContentRootPath, "uploads");
Directory.CreateDirectory(uploadsDir);

// Middleware map BusinessException -> { code, message, details, actions } + HTTP status
app.Use(async (ctx, next) =>
{
    try { await next(); }
    catch (BusinessException ex)
    {
        ctx.Response.StatusCode = ex.HttpStatus;
        ctx.Response.ContentType = "application/json; charset=utf-8";
        await ctx.Response.WriteAsJsonAsync(new
        {
            code = ex.Code,
            message = ex.Message,
            details = ex.Details,
            actions = ex.Actions,
        });
    }
    catch (Exception ex)
    {
        // Lỗi kỹ thuật: log nguyên vẹn để tra cứu, trả client một thông điệp
        // chung — không lộ chi tiết nội bộ (stack, SQL, đường dẫn).
        var logger = ctx.RequestServices.GetRequiredService<ILogger<Program>>();
        logger.LogError(ex, "Lỗi chưa xử lý tại {Method} {Path}",
            ctx.Request.Method, ctx.Request.Path);
        ctx.Response.StatusCode = StatusCodes.Status500InternalServerError;
        ctx.Response.ContentType = "application/json; charset=utf-8";
        await ctx.Response.WriteAsJsonAsync(new
        {
            code = "INTERNAL_ERROR",
            message = "Hệ thống gặp lỗi không mong đợi. Vui lòng thử lại hoặc liên hệ quản trị viên.",
        });
    }
});

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// CORS áp dụng cho mọi môi trường, không chỉ Development: khi chạy trong
// Docker, frontend ở cổng khác vẫn phải gọi được API.
app.UseCors();
app.UseRateLimiter();

// ---- Kiểm tra sống: Docker Compose và liveness probe dùng endpoint này ----
app.MapGet("/health", async (DataContext db) =>
{
    try
    {
        // Nối thật vào CSDL — chỉ trả 200 khi truy vấn được, để container
        // API bị đánh dấu kém khi PostgreSQL chưa sẵn sàng.
        var canConnect = await db.Database.CanConnectAsync();
        return canConnect
            ? Results.Ok(new { status = "ok", database = "up" })
            : Results.Json(new { status = "degraded", database = "down" }, statusCode: 503);
    }
    catch (Exception ex)
    {
        return Results.Json(
            new { status = "degraded", database = "down", error = ex.Message },
            statusCode: 503);
    }
}).AllowAnonymous();

app.UseAuthentication();
app.UseAuthorization();

// Phục vụ file bằng chứng SAU auth. Lưu ý: UseStaticFiles đặt sau
// UseAuthentication vẫn KHÔNG tự ép đăng nhập (middleware tĩnh không đọc
// User), nên cần lưới này trả 401 tường minh cho người chưa đăng nhập.
app.Use(async (ctx, next) =>
{
    if (ctx.Request.Path.StartsWithSegments("/uploads")
        && ctx.User.Identity?.IsAuthenticated != true)
    {
        ctx.Response.StatusCode = StatusCodes.Status401Unauthorized;
        return;
    }
    await next();
});
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new Microsoft.Extensions.FileProviders.PhysicalFileProvider(uploadsDir),
    RequestPath = "/uploads",
});

app.MapControllers();

// Seed nếu CSDL trống. Lược đồ đã được tạo sẵn bởi database/QLTBYT.sql
// (Docker nạp lúc khởi tạo volume) — không phải schema_sqlserver.sql, file
// đó là bản SQL Server cũ và không liên quan tới dự án này.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<DataContext>();
    await DbSeeder.SeedIfEmptyAsync(db, scope.ServiceProvider.GetRequiredService<ILoggerFactory>().CreateLogger("DbSeeder"));
}

app.Run();

// ============ TokenService (dev) ============
public static class TokenService
{
    public static (string token, DateTime expires) Create(User user, IConfiguration cfg)
    {
        var jwt = cfg.GetSection("Jwt");
        var expires = DateTime.UtcNow.AddHours(double.Parse(jwt["ExpireHours"]!));
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.IdNguoiDung.ToString()),
            new(ClaimTypes.Name, user.TenDangNhap),
            new(ClaimTypes.GivenName, user.HoTen),
            new(ClaimTypes.Role, user.VaiTro),
            new("dept", user.IdKhoa?.ToString() ?? ""),
        };
        var cred = new SigningCredentials(
            new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt["Key"]!)),
            SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(jwt["Issuer"], jwt["Audience"], claims,
            expires: expires, signingCredentials: cred);
        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }
}
