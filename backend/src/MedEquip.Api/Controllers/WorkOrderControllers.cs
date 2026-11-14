using MedEquip.Domain;
using MedEquip.Api.Auth;
using MedEquip.Domain.Entities;
using MedEquip.Infrastructure;
using MedEquip.Infrastructure.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Security.Cryptography;

namespace MedEquip.Api.Controllers;

using MedEquipCreateOrderRequest = MedEquip.Domain.CreateOrderRequest;

[ApiController]
[Route("api/work-orders")]
[Authorize]
public class WorkOrdersController(
    DataContext db, IWorkOrderService orders, IAuditService audit,
    CurrentUserAccessor currentUser, IHostEnvironment host) : ControllerBase
{
    // ===== Màn: WorkOrders (điều phối), MyWork (KTV), DepartmentOrders (khoa),
    //              ReviewOrders (status=CHO_NGHIEM_THU) =====
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? status, [FromQuery] string? type,
        [FromQuery] int? assigneeId, [FromQuery] int? departmentId, [FromQuery] string? q)
    {
        var query = db.WorkOrders
            .Include(w => w.Equipment).ThenInclude(e => e!.Model)
            .Include(w => w.Department)
            .Include(w => w.Assignee)
            .Include(w => w.Steps)   // stepsDone đếm từ đây; thiếu Include thì luôn = 0
            .AsQueryable();
        if (!string.IsNullOrEmpty(status)) query = query.Where(w => w.TrangThai == status);
        if (!string.IsNullOrEmpty(type)) query = query.Where(w => w.LoaiPhieu == type);
        if (assigneeId.HasValue) query = query.Where(w => w.IdNguoiThucHien == assigneeId);
        if (departmentId.HasValue) query = query.Where(w => w.IdKhoa == departmentId);
        if (!string.IsNullOrEmpty(q))
            query = query.Where(w => w.Ma.Contains(q) || w.Equipment!.Serial.Contains(q)
                || w.Equipment!.Model!.Ten.Contains(q));

        var items = await query.OrderByDescending(w => w.NgayTao).ToListAsync();
        var today = DateOnly.FromDateTime(DateTime.Now);
        return Ok(items.Select(w => new
        {
            id = w.Ma,
            workOrderId = w.IdPhieu,
            type = w.LoaiPhieu,
            device = w.Equipment!.Model!.Ten,
            serial = w.Equipment.Serial,
            equipmentCode = w.Equipment.Ma,
            equipmentId = w.IdThietBi,
            equipmentStatus = w.Equipment.TrangThai,
            department = w.Department!.Ten,
            departmentId = w.IdKhoa,
            assignee = w.Assignee?.HoTen ?? "—",
            assigneeId = w.IdNguoiThucHien,
            status = w.TrangThai,
            priority = w.UuTien,
            created = w.NgayTao,
            deadline = w.HanChot,
            overdue = w.HanChot < today && w.TrangThai != WOStatus.HoanThanh,
            progress = w.Progress,
            stepsDone = w.Steps?.Count(s => s.HoanThanh) ?? 0,
        }));
    }

    // ===== Màn: WorkOrderExecution (KTV) — phiếu + steps + bằng chứng + canComplete =====
    [HttpGet("{code}")]
    public async Task<IActionResult> GetByCode(string code)
    {
        var w = await db.WorkOrders
            .Include(x => x.Equipment).ThenInclude(e => e!.Model)
            .Include(x => x.Department)
            .Include(x => x.Assignee)
            .Include(x => x.Steps)
            .Include(x => x.Evidence)
            // Hai collection (Steps + Evidence) trong một truy vấn JOIN sẽ
            // nhân chéo số dòng; tách truy vấn để tránh cảnh báo EF 20504
            // và giữ chi phí tuyến tính khi phiếu nhiều bước/bằng chứng.
            .AsSplitQuery()
            .FirstOrDefaultAsync(x => x.Ma == code);
        if (w is null) throw new BusinessException("NOT_FOUND", "Không tìm thấy phiếu.", 404);

        // Chống IDOR: đăng nhập rồi không có nghĩa là xem được MỌI phiếu.
        //   • KTV: chỉ phiếu được phân công cho mình (màn Việc của tôi chỉ
        //     mở đúng các phiếu đó).
        //   • Đầu mối khoa: chỉ phiếu thuộc khoa mình.
        //   • Điều phối / quản trị: toàn viện — đúng chức năng.
        var me = currentUser.IdNguoiDung
            ?? throw new BusinessException("USER_NOT_MAPPED",
                "Tài khoản chưa được ánh xạ sang bảng người dùng.", 403);
        var meRow = await db.Users.Where(u => u.IdNguoiDung == me)
            .Select(u => new { u.VaiTro, u.IdKhoa }).FirstOrDefaultAsync();
        if (meRow is null)
            throw new BusinessException("USER_NOT_MAPPED",
                "Tài khoản chưa được ánh xạ sang bảng người dùng.", 403);
        if (meRow.VaiTro == UserRoles.KyThuatVien && w.IdNguoiThucHien != me)
            throw new BusinessException("FORBIDDEN",
                "Bạn chỉ được xem phiếu được phân công cho mình.", 403);
        if (meRow.VaiTro == UserRoles.DauMoiKhoa && w.IdKhoa != meRow.IdKhoa)
            throw new BusinessException("FORBIDDEN",
                "Bạn chỉ được xem phiếu thuộc khoa của mình.", 403);

        var required = await db.RequiredEvidenceConfig
            .Where(c => c.OrderType == w.LoaiPhieu && c.IsRequired).ToListAsync();
        var providedCodes = w.Evidence.Select(e => e.MaBangChung).ToHashSet();
        var blockingReasons = new List<string>();
        if (w.Steps.Any(s => !s.HoanThanh && string.IsNullOrWhiteSpace(s.LyDoBo)))
            blockingReasons.Add("STEPS_MISSING");
        var missingEvidence = required.Where(c => !providedCodes.Contains(c.EvidenceCode)).ToList();
        if (missingEvidence.Count > 0) blockingReasons.Add("EVIDENCE_MISSING");

        return Ok(new
        {
            id = w.Ma,
            workOrderId = w.IdPhieu,
            type = w.LoaiPhieu,
            status = w.TrangThai,
            equipment = new
            {
                code = w.Equipment!.Ma, name = w.Equipment.Model!.Ten,
                serial = w.Equipment.Serial, status = w.Equipment.TrangThai,
                calibrationValidUntil = w.Equipment.HanHieuChuan,
            },
            department = w.Department!.Ten,
            assignee = w.Assignee?.HoTen,
            priority = w.UuTien,
            deadline = w.HanChot,
            progress = w.Progress,
            steps = w.Steps.OrderBy(s => s.ThuTu).Select(s => new
            {
                s.ThuTu, s.TieuDe, s.RequirePhoto, s.HoanThanh,
                s.GiaTriChuan, s.DungSaiPhanTram, s.GiaTriDo, s.Result,
                s.LyDoBo, s.Note,
                deviationPct = s.GiaTriChuan.HasValue && s.GiaTriDo.HasValue
                    ? Math.Round(Math.Abs(s.GiaTriDo.Value - s.GiaTriChuan.Value)
                        / s.GiaTriChuan.Value * 100, 2)
                    : (decimal?)null,
            }),
            requiredEvidence = required.Select(c => new
            {
                evidenceType = c.EvidenceCode, label = c.Label,
                provided = providedCodes.Contains(c.EvidenceCode),
                files = w.Evidence.Where(e => e.MaBangChung == c.EvidenceCode)
                    .Select(e => new { e.IdBangChung, e.TenTep, e.DuongDanTep, e.MaBam, e.TaiLuc }),
            }),
            canComplete = blockingReasons.Count == 0 && w.TrangThai == WOStatus.DangThucHien,
            blockingReasons,
        });
    }

    public record CreateOrderRequest(
        string OrderType, int EquipmentId, int? AssigneeId, string Priority,
        DateOnly Deadline, string? Description);

    // ===== Nút "+ Tạo phiếu mới" (điều phối) & "Tạo phiếu hiệu chuẩn ngay" =====
    [HttpPost]
    [Authorize(Roles = "ADMIN,DIEU_PHOI")]
    public async Task<IActionResult> Create(MedEquipCreateOrderRequest req)
    {
        var wo = await orders.CreateAsync(req, User.Identity?.Name ?? "?");
        return CreatedAtAction(nameof(GetByCode), new { code = wo.Ma }, new { code = wo.Ma });
    }

    public record StepPatchRequest(
        bool? Done, decimal? MeasuredValue, string? Note, string? SkipReason);

    // ===== Autosave từng bước checklist (PATCH /steps/{ordinal}) =====
    [HttpPatch("{code}/steps/{ordinal}")]
    [Authorize(Roles = "ADMIN,KY_THUAT_VIEN,DIEU_PHOI")]
    public async Task<IActionResult> PatchStep(string code, int ordinal, StepPatchRequest req)
    {
        var w = await db.WorkOrders.Include(x => x.Steps)
            .FirstOrDefaultAsync(x => x.Ma == code)
            ?? throw new BusinessException("NOT_FOUND", "Không tìm thấy phiếu.", 404);
        await EnsureCanWriteAsync(w);
        // Phiếu TRA_LAI được mở lại ngay khi KTV sửa bước đầu tiên — nếu không
        // sẽ không có đường nào đưa phiếu trở lại DANG_THUC_HIEN (dead-end).
        var wasReturned = w.TrangThai == WOStatus.TraLai;
        if (wasReturned) w.TrangThai = WOStatus.DangThucHien;
        else if (w.TrangThai != WOStatus.DangThucHien)
            throw new BusinessException("WO_INVALID_STATE",
                $"Phiếu đang ở trạng thái {w.TrangThai} — không thể sửa bước.", 409);

        var step = w.Steps.FirstOrDefault(s => s.ThuTu == ordinal)
            ?? throw new BusinessException("NOT_FOUND", $"Không có bước {ordinal}.", 404);
        if (string.IsNullOrWhiteSpace(req.SkipReason) && !req.Done.HasValue && !req.MeasuredValue.HasValue && req.Note == null)
            throw new BusinessException("EMPTY_PATCH", "Không có dữ liệu cập nhật.", 400);

        if (req.SkipReason != null) step.LyDoBo = req.SkipReason;
        if (req.Note != null) step.Note = req.Note;

        // Ai thực hiện, lúc nào. Hai cột này là bằng chứng truy vết ở tầng
        // dữ liệu (work_order_steps.performed_at / performed_by) — trước đây
        // khai báo trong CSDL và trong đặc tả nhưng mã nguồn không bao giờ
        // ghi, nên không biết bước nào do ai làm.
        step.HoanThanhLuc = DateTime.UtcNow;
        step.PerformedBy = currentUser.IdNguoiDung;
        if (req.MeasuredValue.HasValue)
        {
            if (!step.GiaTriChuan.HasValue)
                throw new BusinessException("NOT_A_MEASUREMENT",
                    $"Bước {ordinal} không phải bước đo.", 400);
            step.GiaTriDo = req.MeasuredValue;
            // Server tự tính kết luận — client không được gửi 'DAT' tùy ý.
            // Dùng chung CalibrationRules để cùng công thức với kiểm thử
            // và với trigger trong QLTBYT.sql.
            step.Result = CalibrationRules.WithinTolerance(
                step.GiaTriChuan, step.GiaTriDo, step.DungSaiPhanTram ?? 100m)
                ? "DAT" : "KHONG_DAT";
        }
        if (req.Done.HasValue)
        {
            if (req.Done.Value && step.GiaTriChuan.HasValue && !step.GiaTriDo.HasValue
                && string.IsNullOrWhiteSpace(step.LyDoBo))
                throw new BusinessException("MEASUREMENT_REQUIRED",
                    $"Bước {ordinal} cần nhập giá trị đo trước khi đánh dấu hoàn thành.", 422);
            step.HoanThanh = req.Done.Value;
        }

        w.Progress = (int)Math.Round(
            w.Steps.Count(s => s.HoanThanh) * 100.0 / Math.Max(1, w.Steps.Count));
        await db.SaveChangesAsync();
        await audit.AppendAsync(User.Identity?.Name ?? "?", "WO_STEP_UPDATE", code,
            (wasReturned ? "Mở lại phiếu bị trả lại. " : "")
            + $"Bước {ordinal}: done={step.HoanThanh}, đo={step.GiaTriDo?.ToString() ?? "—"}, kết quả={step.Result ?? "—"}");
        return Ok(new { step.ThuTu, step.HoanThanh, step.GiaTriDo, step.Result, status = w.TrangThai });
    }

    // ===== Upload bằng chứng (multipart: file + evidenceCode) =====
    [HttpPost("{code}/evidence")]
    [Authorize(Roles = "ADMIN,KY_THUAT_VIEN,DIEU_PHOI")]
    public async Task<IActionResult> UploadEvidence(
        string code, IFormFile file, [FromForm] string evidenceCode)
    {
        var w = await db.WorkOrders.FirstOrDefaultAsync(x => x.Ma == code)
                ?? throw new BusinessException("NOT_FOUND", "Không tìm thấy phiếu.", 404);
        await EnsureCanWriteAsync(w);

        if (w.TrangThai == WOStatus.HoanThanh)
            throw new BusinessException("EVIDENCE_IMMUTABLE",
                "Bằng chứng không thể thêm sau khi phiếu hoàn thành.", 409);

        // evidenceCode đi thẳng vào tên tệp ghi trên đĩa — phải ràng buộc
        // chặt: chỉ chữ/số/gạch dưới (đúng định dạng mã bằng chứng), chặn
        // ../ ..\ và ký tự lạ. Trước đây chuỗi bất kỳ được ghép vào đường
        // dẫn → path traversal đọc/ghi tùy ý ngoài thư mục uploads.
        var evCode = (evidenceCode ?? "").Trim();
        if (evCode.Length == 0 || evCode.Length > 30
            || evCode.Any(ch => !char.IsAsciiLetterOrDigit(ch) && ch != '_'))
            throw new BusinessException("INVALID_EVIDENCE_CODE",
                "Mã bằng chứng chỉ gồm chữ, số và gạch dưới, tối đa 30 ký tự.", 400);
        var codeConfigured = await db.RequiredEvidenceConfig
            .AnyAsync(c => c.OrderType == w.LoaiPhieu && c.EvidenceCode == evCode);
        if (!codeConfigured)
            throw new BusinessException("EVIDENCE_CODE_UNKNOWN",
                $"Mã bằng chứng '{evCode}' không có trong quy tắc bằng chứng của phiếu {w.LoaiPhieu}.", 400);

        if (!EvidenceRules.IsAllowedContentType(file.ContentType))
            throw new BusinessException("FILE_TYPE_NOT_ALLOWED",
                $"Định dạng không cho phép: {file.ContentType}. Cho phép: JPG, PNG, WEBP, PDF.", 415);
        if (file.Length > EvidenceRules.MaxBytes)
            throw new BusinessException("FILE_TOO_LARGE", "File tối đa 10MB.", 413);

        // Kiểm magic bytes — đổi đuôi file không qua được tầng này
        var header = new byte[8];
        using (var read = file.OpenReadStream())
        {
            await read.ReadExactlyAsync(header);
            read.Position = 0;
        }
        if (!EvidenceRules.HasKnownSignature(header))
            throw new BusinessException("FILE_TYPE_NOT_ALLOWED",
                "Nội dung file không khớp định dạng khai báo.", 415);

        // Ghi vào đúng thư mục mà Program.cs phục vụ tĩnh tại /uploads
        // (ContentRootPath). Trước đây ghi vào AppContext.BaseDirectory
        // (bin/Debug/...) — file lưu xong không thấy được qua đường dẫn
        // /uploads mà response trả về.
        var dir = Path.Combine(host.ContentRootPath, "uploads", code);
        Directory.CreateDirectory(dir);
        var ext = Path.GetExtension(file.FileName);
        if (ext.Length > 10 || ext.Any(ch => !char.IsAsciiLetterOrDigit(ch) && ch != '.'))
            throw new BusinessException("INVALID_FILE_NAME", "Phần mở rộng tệp không hợp lệ.", 400);
        var safeName = $"{evCode}_{DateTime.UtcNow:yyyyMMddHHmmss}{ext}";
        var fullPath = Path.Combine(dir, safeName);
        await using (var stream = System.IO.File.Create(fullPath))
            await file.CopyToAsync(stream);

        var bytes = await System.IO.File.ReadAllBytesAsync(fullPath);
        var sha = Convert.ToHexString(SHA256.HashData(bytes));

        var evidence = new Evidence
        {
            IdPhieu = w.IdPhieu,
            MaBangChung = evCode,
            TenTep = Path.GetFileName(file.FileName),
            DuongDanTep = $"/uploads/{code}/{safeName}",
            MaBam = sha,
            FileSizeKb = EvidenceRules.ToKilobytes(file.Length),
            TaiBoi = currentUser.RequireUserId(),
            TaiLuc = DateTime.UtcNow,
        };
        db.Evidence.Add(evidence);
        await db.SaveChangesAsync();
        await audit.AppendAsync(User.Identity?.Name ?? "?", "EVIDENCE_UPLOADED", code,
            $"{evidenceCode}: {file.FileName} (sha256 {sha[..12]}…)");
        return Ok(new { evidence.IdBangChung, evidence.TenTep, evidence.DuongDanTep, sha256 = sha });
    }

    // ===== Hoàn thành phiếu (KTV) — server kiểm tra lại mọi bất biến =====
    [HttpPost("{code}/complete")]
    [Authorize(Roles = "ADMIN,KY_THUAT_VIEN,DIEU_PHOI")]
    public async Task<IActionResult> Complete(string code)
    {
        var w = await db.WorkOrders.FirstOrDefaultAsync(x => x.Ma == code)
                ?? throw new BusinessException("NOT_FOUND", "Không tìm thấy phiếu.", 404);
        await EnsureCanWriteAsync(w);
        await orders.CompleteAsync(w.IdPhieu, User.Identity?.Name ?? "?");
        return Ok(new { status = WOStatus.ChoNghiemThu });
    }

    /// <summary>
    /// KTV chỉ được THAO TÁC (sửa bước, nộp bằng chứng, hoàn thành) trên
    /// phiếu được phân công cho mình; điều phối/quản trị giữ quyền toàn viện.
    /// Chặn IDOR ghi: biết mã phiếu của người khác không đủ để sửa.
    /// </summary>
    private async Task EnsureCanWriteAsync(WorkOrder w)
    {
        if (!User.IsInRole(UserRoles.KyThuatVien)) return;
        var me = currentUser.IdNguoiDung
            ?? throw new BusinessException("USER_NOT_MAPPED",
                "Tài khoản chưa được ánh xạ sang bảng người dùng.", 403);
        if (w.IdNguoiThucHien != me)
            throw new BusinessException("FORBIDDEN",
                "Bạn chỉ được thao tác trên phiếu được phân công cho mình.", 403);
    }

    // ===== Nghiệm thu (điều phối) =====
    [HttpPost("{code}/review/accept")]
    [Authorize(Roles = "ADMIN,DIEU_PHOI")]
    public async Task<IActionResult> Accept(string code,
        [FromBody] AcceptReviewRequest req)
    {
        var w = await db.WorkOrders.FirstOrDefaultAsync(x => x.Ma == code)
                ?? throw new BusinessException("NOT_FOUND", "Không tìm thấy phiếu.", 404);
        await orders.AcceptReviewAsync(w.IdPhieu, req, User.Identity?.Name ?? "?");
        return Ok(new { status = WOStatus.HoanThanh });
    }

    [HttpPost("{code}/review/return")]
    [Authorize(Roles = "ADMIN,DIEU_PHOI")]
    public async Task<IActionResult> Return(string code, [FromBody] ReturnRequest req)
    {
        var w = await db.WorkOrders.FirstOrDefaultAsync(x => x.Ma == code)
                ?? throw new BusinessException("NOT_FOUND", "Không tìm thấy phiếu.", 404);
        await orders.ReturnAsync(w.IdPhieu, req.Reason, User.Identity?.Name ?? "?");
        return Ok(new { status = WOStatus.TraLai });
    }

    public record ReturnRequest(string Reason);
}

[ApiController]
[Route("api/assignments")]
[Authorize]
public class AssignmentsController(DataContext db, IAssignmentService service, CurrentUserAccessor currentUser) : ControllerBase
{
    // ===== POST phân công — nơi xảy ra CHẶN BR-01 (422 + ASSIGN_BLOCKED) =====
    [HttpPost]
    [Authorize(Roles = "ADMIN,DIEU_PHOI")]
    public async Task<IActionResult> Assign(AssignRequest req)
    {
        var a = await service.AssignAsync(req, currentUser.RequireUserId(), User.Identity?.Name ?? "?");
        // Tên field camelCase tường minh — FE đọc assignmentId; trước đây
        // trả "idPhanCong" nên FE không đọc được kết quả phân công.
        return Created("", new
        {
            assignmentId = a.IdPhanCong,
            workOrderId = a.IdPhieu,
            equipmentId = a.IdThietBi,
            assigneeId = a.IdNguoiDung,
            scheduledDate = a.ScheduledDate,
            status = a.TrangThai,
        });
    }

    // ===== GET tuần — dữ liệu cho màn Lịch bảo trì (kéo-thả) =====
    [HttpGet("week")]
    public async Task<IActionResult> GetWeek([FromQuery] DateTime? weekStart)
    {
        var start = DateOnly.FromDateTime(weekStart?.Date.ToUniversalTime() ?? DateTime.UtcNow);
        var end = start.AddDays(7);
        var technicians = await db.Users.Where(u => u.VaiTro == UserRoles.KyThuatVien && u.HoatDong)
            .Select(u => new { u.IdNguoiDung, u.HoTen }).ToListAsync();
        var scheduled = await db.Assignments
            .Include(a => a.WorkOrder).ThenInclude(w => w!.Equipment).ThenInclude(e => e!.Model)
            .Where(a => a.ScheduledDate >= start && a.ScheduledDate < end)
            .ToListAsync();
        var unassigned = await db.WorkOrders
            .Include(w => w.Equipment).ThenInclude(e => e!.Model)
            .Include(w => w.Department)
            .Where(w => w.TrangThai == WOStatus.ChoPhanCong)
            .ToListAsync();

        return Ok(new
        {
            weekStart = start,
            technicians = technicians.Select(t => new
            {
                t.IdNguoiDung, t.HoTen,
                schedule = scheduled.Where(a => a.IdNguoiDung == t.IdNguoiDung)
                    .Select(a => new
                    {
                        a.WorkOrder!.Ma,
                        // workOrderId + equipmentId để frontend POST /assignments
                        // lại đúng phiếu/thiết bị thay vì gửi số 0 cứng.
                        workOrderId = a.IdPhieu,
                        equipmentId = a.IdThietBi,
                        type = a.WorkOrder.LoaiPhieu,
                        device = a.WorkOrder.Equipment!.Model!.Ten,
                        date = a.ScheduledDate,
                        equipmentStatus = a.WorkOrder.Equipment.TrangThai,
                    }),
            }),
            unassigned = unassigned.Select(w => new
            {
                w.Ma,
                workOrderId = w.IdPhieu,
                equipmentId = w.IdThietBi,
                type = w.LoaiPhieu,
                device = w.Equipment!.Model!.Ten,
                serial = w.Equipment.Serial,
                departmentId = w.IdKhoa,
                department = w.Department!.Ten,
                deadline = w.HanChot,
                equipmentStatus = w.Equipment.TrangThai,
            }),
        });
    }
}

[ApiController]
[Route("api/incidents")]
[Authorize]
public class IncidentsController(
    DataContext db, IAuditService audit, CurrentUserAccessor currentUser,
    IHostEnvironment host) : ControllerBase
{
    public record ReportRequest(int EquipmentId, string Description, string Severity, int PhotoCount = 0);

    // ===== Màn "Báo hỏng" 3 bước của đầu mối khoa =====
    // Hai đường vào cùng một nghiệp vụ:
    //  • multipart (giao diện mới): kèm ảnh sự cố "ảnh nếu có" (UC-03).
    //  • JSON (client cũ / script kiểm thử): không kèm ảnh.
    // Trước đây chỉ có JSON và giao diện gửi photoCount = 0 cứng — ảnh
    // sự cố không bao giờ được lưu.

    [HttpPost]
    [Consumes("application/json")]
    [Authorize(Roles = "ADMIN,DIEU_PHOI,DAU_MOI_KHOA")]
    public async Task<IActionResult> Report(ReportRequest req) =>
        await CreateIncidentAsync(req.EquipmentId, req.Description, req.Severity, null);

    [HttpPost]
    [Consumes("multipart/form-data")]
    [Authorize(Roles = "ADMIN,DIEU_PHOI,DAU_MOI_KHOA")]
    public async Task<IActionResult> ReportWithPhoto(
        [FromForm] int equipmentId,
        [FromForm] string description,
        [FromForm] string severity,
        IFormFile? photo) =>
        await CreateIncidentAsync(equipmentId, description, severity, photo);

    private async Task<IActionResult> CreateIncidentAsync(
        int equipmentId, string description, string severity, IFormFile? photo)
    {
        if (string.IsNullOrWhiteSpace(description))
            throw new BusinessException("DESCRIPTION_REQUIRED", "Mô tả sự cố là bắt buộc.", 400);
        var e = await db.Equipment.Include(x => x.Model).FirstOrDefaultAsync(x => x.IdThietBi == equipmentId)
                ?? throw new BusinessException("NOT_FOUND", "Không tìm thấy thiết bị.", 404);
        var seq = await db.Incidents.CountAsync() + 1;
        var inc = new Incident
        {
            Ma = $"INC-{DateTime.Now:yyyy}-{seq:0000}",
            IdThietBi = equipmentId,
            BaoBoi = currentUser.RequireUserId(),
            MoTa = description,
            MucDo = severity is "SO_BO" or "KHAN" ? severity
                : throw new BusinessException("INVALID_SEVERITY", "Mức độ phải là SO_BO hoặc KHAN.", 400),
            PhotoCount = 0,
            // created_at là NOT NULL: thiếu giá trị EF ghi năm 1 — hàng đợi
            // sự cố hiển thị sai thời gian và sắp xếp nhảy loạn.
            CreatedAt = DateTime.UtcNow,
        };

        // Ảnh sự cố (nếu có): kiểm tra như bằng chứng phiếu công tác.
        if (photo is not null && photo.Length > 0)
        {
            if (!EvidenceRules.IsAllowedContentType(photo.ContentType))
                throw new BusinessException("FILE_TYPE_NOT_ALLOWED",
                    $"Định dạng không cho phép: {photo.ContentType}. Cho phép: JPG, PNG, WEBP, PDF.", 415);
            if (photo.Length > EvidenceRules.MaxBytes)
                throw new BusinessException("FILE_TOO_LARGE", "Ảnh tối đa 10MB.", 413);

            var uploadsRoot = Path.Combine(host.ContentRootPath, "uploads");
            var folder = Path.Combine(uploadsRoot, "incident", inc.Ma);
            Directory.CreateDirectory(folder);

            var ext = Path.GetExtension(photo.FileName);
            if (string.IsNullOrWhiteSpace(ext) || ext.Length > 10) ext = ".jpg";
            var fileName = $"{DateTime.Now:yyyyMMddHHmmss}{ext}";
            var fullPath = Path.Combine(folder, fileName);
            await using (var fs = System.IO.File.Create(fullPath))
            {
                await photo.CopyToAsync(fs);
            }
            inc.PhotoCount = 1;
            inc.PhotoPaths = $"incident/{inc.Ma}/{fileName}";
        }

        db.Incidents.Add(inc);

        // Báo hỏng chỉ có ý nghĩa nếu điều phối nhìn thấy. Trước đây sự cố
        // được ghi vào CSDL rồi im lặng — không có màn hình nào đọc, không có
        // thông báo nào gửi, nên đầu mối khoa tưởng như báo cáo bị nuốt mất.
        var coordinators = await db.Users
            .Where(u => u.VaiTro == "DIEU_PHOI" && u.HoatDong)
            .ToListAsync();
        foreach (var coord in coordinators)
        {
            db.Notifications.Add(new Notification
            {
                UserId = coord.IdNguoiDung,
                Type = "INCIDENT_MOI",
                Message = $"Sự cố mới {inc.Ma} — {e.Ma} ({e.Model?.Ten}): {inc.MoTa}",
                Link = "/coordinator/incidents",
                IsRead = false,
                CreatedAt = DateTime.UtcNow,
            });
        }

        await db.SaveChangesAsync();
        await audit.AppendAsync(currentUser.TenDangNhap, "FAULT_REPORT", $"equipment {e.Ma}",
            $"Báo hỏng: {description}. Mức độ: {severity}"
            + (inc.PhotoCount > 0 ? $". Kèm {inc.PhotoCount} ảnh" : ""));
        return Created("", new
        {
            code = inc.Ma,
            message = $"Đã gửi báo hỏng thành công. Mã phiếu: #{inc.Ma}. " +
                      "Điều phối đã nhận được thông báo và sẽ xử lý.",
        });
    }

    // ===== Hàng đợi sự cố của điều phối =====
    // Trước đây KHÔNG có GET nào cho bảng incidents: sự cố chỉ ghi được chứ
    // không đọc được, nên không ai xử lý được sau khi khoa báo.
    [HttpGet]
    [Authorize(Roles = "ADMIN,DIEU_PHOI,DAU_MOI_KHOA")]
    public async Task<IActionResult> List(
        [FromQuery] string? status, [FromQuery] string? severity, [FromQuery] int? equipmentId)
    {
        var query = db.Incidents
            .Include(i => i.Equipment).ThenInclude(e => e!.Model)
            .Include(i => i.Equipment).ThenInclude(e => e!.Department)
            .Include(i => i.Reporter)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(i => i.TrangThai == status);
        if (!string.IsNullOrWhiteSpace(severity)) query = query.Where(i => i.MucDo == severity);
        if (equipmentId.HasValue) query = query.Where(i => i.IdThietBi == equipmentId);

        var rows = await query
            .OrderByDescending(i => i.MucDo == "KHAN" ? 1 : 0)
            .ThenByDescending(i => i.IdSuCo)
            .Select(i => new
            {
                id = i.IdSuCo,
                code = i.Ma,
                status = i.TrangThai,
                severity = i.MucDo,
                description = i.MoTa,
                photoCount = i.PhotoCount,
                // Đường dẫn tương đối trong thư mục uploads — giao diện mở
                // qua /uploads/<đường dẫn> (yêu cầu đăng nhập).
                photos = string.IsNullOrWhiteSpace(i.PhotoPaths)
                    ? Array.Empty<string>()
                    : i.PhotoPaths.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries),
                createdAt = i.CreatedAt,
                closedAt = i.ClosedAt,
                resolution = i.Resolution,
                workOrderId = i.IdPhieu,
                equipment = new
                {
                    id = i.IdThietBi,
                    code = i.Equipment!.Ma,
                    name = i.Equipment.Model!.Ten,
                    status = i.Equipment.TrangThai,
                    department = i.Equipment.Department!.Ten,
                },
                reportedBy = i.Reporter!.HoTen,
            })
            .ToListAsync();

        return Ok(rows);
    }

    /// <summary>Điều phối tiếp nhận sự cố — chuyển sang DA_TIEP_NHAN.</summary>
    [HttpPost("{id:int}/ack")]
    [Authorize(Roles = "ADMIN,DIEU_PHOI")]
    public async Task<IActionResult> Ack(int id)
    {
        var inc = await db.Incidents.FirstOrDefaultAsync(i => i.IdSuCo == id)
                  ?? throw new BusinessException("NOT_FOUND", "Không tìm thấy sự cố.", 404);
        if (inc.TrangThai != "MOI")
            throw new BusinessException("INCIDENT_INVALID_STATE",
                $"Sự cố đang ở trạng thái {inc.TrangThai}, không tiếp nhận lại được.", 409);

        inc.TrangThai = "DA_TIEP_NHAN";
        await db.SaveChangesAsync();
        await audit.AppendAsync(currentUser.TenDangNhap, "INCIDENT_ACK", inc.Ma, "Tiếp nhận sự cố");
        return Ok(new { code = inc.Ma, status = inc.TrangThai });
    }

    /// <summary>Sinh phiếu sửa chữa từ sự cố và đóng sự cố.</summary>
    [HttpPost("{id:int}/create-order")]
    [Authorize(Roles = "ADMIN,DIEU_PHOI")]
    public async Task<IActionResult> CreateOrderFromIncident(int id, [FromBody] CreateOrderFromIncidentRequest req)
    {
        var inc = await db.Incidents.Include(i => i.Equipment)
                      .FirstOrDefaultAsync(i => i.IdSuCo == id)
                  ?? throw new BusinessException("NOT_FOUND", "Không tìm thấy sự cố.", 404);
        if (inc.TrangThai == "DONG")
            throw new BusinessException("INCIDENT_INVALID_STATE", "Sự cố đã đóng.", 409);
        if (inc.IdPhieu.HasValue)
            throw new BusinessException("ALREADY_HAS_ORDER",
                $"Sự cố đã có phiếu #{inc.IdPhieu.Value}.", 409);

        // Cùng cách sinh mã với WorkOrderService.CreateAsync để mã phiếu SC
        // không trùng định dạng: {LOAI}-{năm}-{số 4 chữ số}.
        var seq = await db.WorkOrders.CountAsync(w => w.Ma.StartsWith(OrderType.SC)) + 1;
        var today = DateOnly.FromDateTime(DateTime.Now);

        // BR-01 ở tầng dịch vụ. Trước đây luồng này KHÔNG kiểm BR-01: lệnh
        // INSERT bị trigger trong CSDL chặn rồi rơi vào middleware catch-all
        // → HTTP 500 "lỗi không mong đợi", người dùng không hiểu vì sao.
        // Giờ chặn ở tầng ứng dụng với mã lỗi nghiệp vụ 422 như các luồng
        // tạo phiếu và phân công khác.
        var equipment = inc.Equipment!;
        if (!CalibrationRules.CanCreateOrder(
                equipment.TrangThai, OrderType.SC, equipment.HanHieuChuan, today))
        {
            await audit.AppendAsync(currentUser.TenDangNhap, "WO_CREATE_BLOCKED",
                $"equipment {equipment.Ma}",
                $"Không cho tạo phiếu SC từ sự cố — thiết bị {equipment.TrangThai}");
            throw new BusinessException("CALIBRATION_OVERDUE",
                "Thiết bị đang bị khóa chờ hiệu chuẩn — chỉ được tạo phiếu hiệu chuẩn/kiểm định.",
                422,
                new { equipmentId = equipment.IdThietBi, status = equipment.TrangThai },
                new[] { "CREATE_CALIBRATION_ORDER" });
        }

        var order = new WorkOrder
        {
            Ma = $"{OrderType.SC}-{DateTime.Now:yyyy}-{seq:0000}",
            LoaiPhieu = OrderType.SC,
            IdThietBi = inc.IdThietBi,
            IdKhoa = inc.Equipment!.IdKhoa,
            IdNguoiThucHien = req.AssigneeId,
            UuTien = inc.MucDo == "KHAN" ? Priority.Khan : Priority.BinhThuong,
            TrangThai = WOStatus.ChoPhanCong,
            MoTa = $"[Từ sự cố {inc.Ma}] {inc.MoTa}",
            NgayTao = today,
            HanChot = today.AddDays(inc.MucDo == "KHAN" ? 1 : 3),
        };
        db.WorkOrders.Add(order);
        // Phải lưu phiếu TRƯỚC rồi mới nối sự cố: work_order_id là khóa
        // ngoại identity do PostgreSQL sinh, EF chỉ gán giá trị sau khi
        // chạy INSERT. Gán trước sẽ ghi 0 và vi phạm ràng buộc 23503.
        await db.SaveChangesAsync();

        inc.TrangThai = "DA_TAO_PHIEU";
        inc.IdPhieu = order.IdPhieu;

        // Báo lại cho đầu mối khoa đã nhận được sự cố.
        db.Notifications.Add(new Notification
        {
            UserId = inc.BaoBoi,
            Type = "INCIDENT_TO_ORDER",
            Message = $"Sự cố {inc.Ma} đã chuyển thành phiếu {order.Ma}.",
            Link = "/department/orders",
            IsRead = false,
            CreatedAt = DateTime.UtcNow,
        });

        await db.SaveChangesAsync();
        await audit.AppendAsync(currentUser.TenDangNhap, "INCIDENT_TO_ORDER", inc.Ma,
            $"Tạo phiếu {order.Ma} từ sự cố");

        return Created("", new { code = order.Ma, incidentCode = inc.Ma, orderId = order.IdPhieu });
    }
}

public record CreateOrderFromIncidentRequest(int? AssigneeId);
