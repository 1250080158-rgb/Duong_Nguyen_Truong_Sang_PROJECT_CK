using MedEquip.Domain;
using MedEquip.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MedEquip.Infrastructure.Services;

public class AssignmentService : IAssignmentService
{
    readonly DataContext _db;
    readonly IAuditService _audit;

    public AssignmentService(DataContext db, IAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    public async Task<Assignment> AssignAsync(AssignRequest req, int actorUserId, string actor)
    {
        var wo = await _db.WorkOrders.Include(w => w.Equipment)
                   .FirstOrDefaultAsync(w => w.IdPhieu == req.WorkOrderId)
            ?? throw new BusinessException("NOT_FOUND", "Không tìm thấy phiếu công tác.", 404);

        // Một phiếu chỉ có đúng MỘT lần phân công (ràng buộc UNIQUE trong
        // CSDL). Kiểm tra ở tầng ứng dụng để trả 409 rõ ràng, thay vì để
        // EF ném DbUpdateException rồi người dùng thấy HTTP 500.
        var already = await _db.Assignments
            .Where(a => a.IdPhieu == req.WorkOrderId)
            .Select(a => a.IdNguoiDung)
            .FirstOrDefaultAsync();
        if (already != 0)
            throw new BusinessException("ALREADY_ASSIGNED",
                $"Phiếu {wo.Ma} đã được phân công cho kỹ thuật viên #{already}.", 409);

        // BR-01 phải kiểm trên THIẾT BỊ CỦA PHIẾU, không phải thiết bị do
        // client gửi lên: nếu tin client thì chỉ cần khai một thiết bị khác
        // là lách được luật.
        if (req.EquipmentId != 0 && req.EquipmentId != wo.IdThietBi)
            throw new BusinessException("EQUIPMENT_MISMATCH",
                "Thiết bị gửi lên không khớp với thiết bị của phiếu công tác.", 400);

        var equipment = wo.Equipment
            ?? await _db.Equipment.Include(e => e.Model)
                      .FirstOrDefaultAsync(e => e.IdThietBi == wo.IdThietBi)
            ?? throw new BusinessException("NOT_FOUND", "Không tìm thấy thiết bị.", 404);

        var today = DateOnly.FromDateTime(DateTime.Now);
        var overdueDays = CalibrationRules.OverdueDays(equipment.HanHieuChuan, today);

        // Ngày dự kiến làm: thiếu thì lấy hôm nay, quá khứ thì báo rõ —
        // nếu để mặc định 0001-01-01 thì cả tầng ứng dụng lẫn trigger đều
        // cho qua, trong khi người dùng đã nhìn thấy ngày 01/01/0001.
        var scheduledDate = req.ScheduledDate == default ? today : req.ScheduledDate;
        if (scheduledDate < today)
            throw new BusinessException("SCHEDULED_DATE_IN_PAST",
                $"Ngày dự kiến làm ({scheduledDate:dd/MM/yyyy}) không được sớm hơn hôm nay ({today:dd/MM/yyyy}).", 400);

        // BR-01 — tầng ứng dụng (tầng 2/4). Luật nằm trong CalibrationRules
        // để kiểm thử được không cần CSDL, và để trigger trong QLTBYT.sql
        // dùng chung một định nghĩa.
        //
        // Mốc so sánh là NGÀY DỰ KIẾN LÀM (scheduled_date) — đúng như
        // trigger fn_chan_phan_cong_qua_han. Trước đây tầng ứng dụng so
        // với hôm nay nên thiết bị hết hạn ngày mai vẫn được phân công
        // cho tuần sau ở tầng ứng dụng rồi bị trigger chặn, người dùng
        // thấy lỗi 500 thay vì 422.
        var blocked = !CalibrationRules.CanAssign(
            equipment.TrangThai, wo.LoaiPhieu, equipment.HanHieuChuan, scheduledDate);

        if (blocked)
        {
            // Chính hành động từ chối là bằng chứng: ghi audit ASSIGN_BLOCKED
            // kèm số ngày quá hạn và chứng thư căn cứ.
            var lastCert = await _db.Evidence
                .Where(ev => ev.WorkOrder!.IdThietBi == equipment.IdThietBi
                             && ev.MaBangChung == "CHUNG_CHI_PDF")
                .OrderByDescending(ev => ev.IdBangChung)
                .Select(ev => ev.TenTep)
                .FirstOrDefaultAsync();

            await _audit.AppendAsync(actor, "ASSIGN_BLOCKED", $"phiếu {wo.Ma}",
                $"Lý do: {(equipment.TrangThai == DeviceStatus.ThanhLy ? "thiết bị đã thanh lý"
                    : $"quá hạn hiệu chuẩn {overdueDays} ngày")}. Căn cứ: {lastCert ?? "không có chứng chỉ nào"}");

            throw new BusinessException(
                "CALIBRATION_OVERDUE",
                $"Thiết bị đã quá hạn hiệu chuẩn {overdueDays} ngày — không thể phân công khai thác.",
                422,
                new
                {
                    equipmentId = equipment.IdThietBi,
                    equipmentCode = equipment.Ma,
                    calibrationValidUntil = equipment.HanHieuChuan,
                    overdueDays,
                    lastCertificateRef = lastCert
                },
                new[] { "CREATE_CALIBRATION_ORDER", "VIEW_EQUIPMENT" });
        }

        var assignment = new Assignment
        {
            IdPhieu = req.WorkOrderId,
            IdThietBi = wo.IdThietBi,
            IdNguoiDung = req.AssigneeId,
            ScheduledDate = scheduledDate,
            // Người tạo phân công là điều phối ra lệnh, không phải KTV nhận việc.
            PhanCongBoi = actorUserId,
            PhanCongLuc = DateTime.UtcNow,
        };
        _db.Assignments.Add(assignment);
        wo.IdNguoiThucHien = req.AssigneeId;
        if (wo.TrangThai == WOStatus.ChoPhanCong) wo.TrangThai = WOStatus.DangThucHien;
        await _db.SaveChangesAsync();

        await _audit.AppendAsync(actor, "ASSIGN_CREATED", $"phiếu {wo.Ma}",
            $"Phân công cho user #{req.AssigneeId}, ngày {req.ScheduledDate:dd/MM/yyyy}");
        return assignment;
    }
}
