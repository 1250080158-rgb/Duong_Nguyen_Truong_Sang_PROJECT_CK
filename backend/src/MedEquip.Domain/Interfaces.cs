using MedEquip.Domain.Entities;

namespace MedEquip.Domain;

public interface IAuditService
{
    /// Ghi một dòng audit, tự bám prev_hash mới nhất và tính row_hash
    /// (SHA-256 trên byte UTF-8 — khớp đúng hàm fn_bam_audit trong QLTBYT.sql).
    Task AppendAsync(string actor, string action, string target, string? detail);

    /// Kiểm tra chuỗi hash của toàn bộ audit log (row_ok + chain_ok từng dòng).
    Task<List<AuditChainRow>> VerifyChainAsync();
}

/// <summary>
/// Đọc cấu hình hệ thống trong bảng system_config theo kiểu số.
///
/// Ngưỡng cảnh báo hạn hiệu chuẩn (warning_days_early / urgent / critical)
/// nằm trong CSDL nhưng trước đây mã nguồn hard-code 30/7 ngày ở từng màn —
/// quản trị viên sửa cấu hình xong không thấy tác dụng. Đọc cấu hình ở đây
/// giữ một nguồn sự thật duy nhất cho cả máy chủ lẫn báo cáo.
/// </summary>
public interface ISystemConfigService
{
    Task<int> GetIntAsync(string key, int fallback);
}

public class AuditChainRow
{
    public AuditLog Entry { get; set; } = null!;
    public bool RowOk { get; set; }
    public bool ChainOk { get; set; }
}

public interface IAssignmentService
{
    /// Phân công kỹ thuật viên vào phiếu. Tầng 2/4 của BR-01:
    /// từ chối PM/SC vào thiết bị quá hạn hiệu chuẩn / đã thanh lý,
    /// ghi audit ASSIGN_BLOCKED khi từ chối.
    /// actorUserId là user_id của NGƯỜI TẠO phân công (điều phối), ghi vào
    /// assignments.created_by — không phải người được phân công.
    Task<Assignment> AssignAsync(AssignRequest req, int actorUserId, string actor);
}

public class AssignRequest
{
    public int WorkOrderId { get; set; }
    public int EquipmentId { get; set; }
    public int AssigneeId { get; set; }
    public DateOnly ScheduledDate { get; set; }
}

public interface IWorkOrderService
{
    Task<WorkOrder> CreateAsync(CreateOrderRequest req, string actor);
    Task CompleteAsync(int workOrderId, string actor);
    Task ReturnAsync(int workOrderId, string reason, string actor);
    Task AcceptReviewAsync(int workOrderId, AcceptReviewRequest req, string actor);
}

public class CreateOrderRequest
{
    public string OrderType { get; set; } = "PM";
    public int EquipmentId { get; set; }
    public int DepartmentId { get; set; }
    public int? AssigneeId { get; set; }
    public string Priority { get; set; } = "BINH_THUONG";
    public DateOnly Deadline { get; set; }
    public string? Description { get; set; }
}

public class AcceptReviewRequest
{
    /// Chỉ dùng cho phiếu HC: ngày hết hạn hiệu chuẩn mới theo chứng chỉ.
    public DateOnly? NewCalibrationExpiry { get; set; }
    /// Số chứng thư hiệu chuẩn — đưa vào audit làm căn cứ.
    public string? CertificateRef { get; set; }
}
