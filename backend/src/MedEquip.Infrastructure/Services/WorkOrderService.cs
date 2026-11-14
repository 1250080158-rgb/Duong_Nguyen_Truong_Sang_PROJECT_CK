using MedEquip.Domain;
using MedEquip.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace MedEquip.Infrastructure.Services;

public class WorkOrderService : IWorkOrderService
{
    readonly DataContext _db;
    readonly IAuditService _audit;

    public WorkOrderService(DataContext db, IAuditService audit)
    {
        _db = db;
        _audit = audit;
    }

    public async Task<WorkOrder> CreateAsync(CreateOrderRequest req, string actor)
    {
        var equipment = await _db.Equipment.Include(e => e.Model)
                          .FirstOrDefaultAsync(e => e.IdThietBi == req.EquipmentId)
                      ?? throw new BusinessException("NOT_FOUND", "Không tìm thấy thiết bị.", 404);

        var today = DateOnly.FromDateTime(DateTime.Now);

        // Tạo phiếu khai thác cho thiết bị bị khóa là vi phạm BR-01 ngay từ gốc —
        // chặn luôn, chỉ cho tạo phiếu HC/KT.
        // Dùng bản luật CÓ xét hạn hiệu chuẩn để khớp đúng với trigger
        // fn_chan_tao_phieu_khai_thac trong QLTBYT.sql (so với CURRENT_DATE).
        if (!CalibrationRules.CanCreateOrder(
                equipment.TrangThai, req.OrderType, equipment.HanHieuChuan, today))
        {
            await _audit.AppendAsync(actor, "WO_CREATE_BLOCKED", $"equipment {equipment.Ma}",
                $"Không cho tạo phiếu {req.OrderType} — thiết bị {equipment.TrangThai}");
            throw new BusinessException("CALIBRATION_OVERDUE",
                "Thiết bị đang bị khóa chờ hiệu chuẩn — chỉ được tạo phiếu hiệu chuẩn/kiểm định.",
                422, new { equipmentId = equipment.IdThietBi, status = equipment.TrangThai },
                new[] { "CREATE_CALIBRATION_ORDER" });
        }

        var type = OrderType.All.Contains(req.OrderType)
            ? req.OrderType
            : throw new BusinessException("INVALID_ORDER_TYPE", $"Loại phiếu không hợp lệ: {req.OrderType}", 400);

        // Ràng buộc CSDL ck_work_order_dates đòi deadline >= created_at.
        // DateOnly không cho null nên thiếu deadline sẽ ra default 0001-01-01
        // và chạm ràng buộc: SaveChanges ném PostgresException 23514 và người
        // dùng chỉ thấy HTTP 500 vô nghĩa. Kiểm tra trước để trả 400 rõ ràng.
        if (req.Deadline == default)
            throw new BusinessException("DEADLINE_REQUIRED",
                "Phải nhập hạn hoàn thành cho phiếu.", 400);
        if (req.Deadline < today)
            throw new BusinessException("DEADLINE_IN_PAST",
                $"Hạn hoàn thành ({req.Deadline:dd/MM/yyyy}) không được sớm hơn ngày tạo phiếu ({today:dd/MM/yyyy}).", 400);

        var seq = await _db.WorkOrders.CountAsync(w => w.Ma.StartsWith(type)) + 1;
        var wo = new WorkOrder
        {
            Ma = $"{type}-{DateTime.Now:yyyy}-{seq:0000}",
            LoaiPhieu = type,
            IdThietBi = req.EquipmentId,
            IdKhoa = req.DepartmentId != 0 ? req.DepartmentId : equipment.IdKhoa,
            IdNguoiThucHien = req.AssigneeId,
            TrangThai = req.AssigneeId != null ? WOStatus.DangThucHien : WOStatus.ChoPhanCong,
            UuTien = req.Priority,
            NgayTao = today,
            HanChot = req.Deadline,
            MoTa = req.Description,
        };
        _db.WorkOrders.Add(wo);
        await _db.SaveChangesAsync();

        // Tạo checklist mặc định: phiếu HC lấy theo dung sai của model,
        // phiếu khác chỉ có 1 bước mô tả chung (coi như template rỗng).
        if (type == OrderType.HC)
        {
            var tolerance = equipment.Model?.DungSaiHcPhanTram ?? 2.5m;
            _db.WorkOrderSteps.AddRange(
                new WorkOrderStep { IdPhieu = wo.IdPhieu, ThuTu = 1, TieuDe = "Kiểm tra điều kiện vận hành thiết bị" },
                new WorkOrderStep { IdPhieu = wo.IdPhieu, ThuTu = 2, TieuDe = "Đo điểm chuẩn giữa", GiaTriChuan = 10.0000m, DungSaiPhanTram = tolerance },
                new WorkOrderStep { IdPhieu = wo.IdPhieu, ThuTu = 3, TieuDe = "Thử nghiệm an toàn (IEC 60601)", RequirePhoto = true },
                new WorkOrderStep { IdPhieu = wo.IdPhieu, ThuTu = 4, TieuDe = "Dán tem hiệu chuẩn mới", RequirePhoto = true });
        }
        else
        {
            _db.WorkOrderSteps.Add(new WorkOrderStep
                { IdPhieu = wo.IdPhieu, ThuTu = 1, TieuDe = $"Thực hiện {type} và ghi kết quả" });
        }
        await _db.SaveChangesAsync();

        await _audit.AppendAsync(actor, "WO_CREATE", wo.Ma,
            $"Tạo phiếu {type} cho thiết bị {equipment.Ma}, hạn {req.Deadline:dd/MM/yyyy}");
        return wo;
    }

    /// Hoàn thành phiếu — giao dịch kiểm tra lại TOÀN BỘ bất biến từ DB
    /// (không tin request): đủ bước / đủ bằng chứng bắt buộc.
    public async Task CompleteAsync(int workOrderId, string actor)
    {
        var wo = await _db.WorkOrders.Include(w => w.Steps)
                    .Include(w => w.Evidence)
                    .FirstOrDefaultAsync(w => w.IdPhieu == workOrderId)
                ?? throw new BusinessException("NOT_FOUND", "Không tìm thấy phiếu.", 404);

        // TRA_LAI cũng được hoàn thành lại: phiếu bị trả về KTV sửa tiếp,
        // nếu chỉ cho DANG_THUC_HIEN thì phiếu trả lại không còn đường nào
        // quay vào luồng hoàn thành (dead-end).
        if (wo.TrangThai != WOStatus.DangThucHien && wo.TrangThai != WOStatus.TraLai)
            throw new BusinessException("WO_INVALID_STATE",
                $"Phiếu đang ở trạng thái {wo.TrangThai} — không thể hoàn thành.", 409);

        var missingSteps = wo.Steps
            .Where(s => !s.HoanThanh && string.IsNullOrWhiteSpace(s.LyDoBo)).ToList();
        if (missingSteps.Count > 0)
            throw new BusinessException("STEPS_MISSING",
                $"Còn {missingSteps.Count} bước chưa hoàn thành.", 422,
                new { missingOrdinals = missingSteps.Select(s => s.ThuTu) });

        var required = await _db.RequiredEvidenceConfig
            .Where(c => c.OrderType == wo.LoaiPhieu && c.IsRequired).ToListAsync();
        var providedCodes = wo.Evidence.Select(e => e.MaBangChung).ToHashSet();
        var missingEvidence = required.Where(c => !providedCodes.Contains(c.EvidenceCode)).ToList();
        if (missingEvidence.Count > 0)
            throw new BusinessException("EVIDENCE_MISSING",
                $"Thiếu {missingEvidence.Count} bằng chứng bắt buộc.", 422,
                new { missing = missingEvidence.Select(c => new { evidenceType = c.EvidenceCode, label = c.Label }) });

        wo.TrangThai = WOStatus.ChoNghiemThu;
        wo.Progress = 100;
        // Cột completed_at là căn cứ cho "PM đúng hạn" trong v_bao_cao_pm
        // và Dashboard — trước đây không bao giờ được ghi nên mọi phiếu
        // hoàn thành qua app đều bị coi là không đúng hạn.
        wo.HoanThanhLuc = DateTime.UtcNow;
        if (wo.IdThietBi != 0)
        {
            var equipment = await _db.Equipment.FirstAsync(e => e.IdThietBi == wo.IdThietBi);
            // KHÔNG đặt trạng thái thiết bị thành "CHO_NGHIEM_THU": đó là
            // trạng thái của PHIẾU, không phải của thiết bị. Ràng buộc
            // equipment_status_check trong QLTBYT.sql chỉ cho phép
            // HOAT_DONG / SAP_HAN / CHO_HIEU_CHUAN / DANG_SUA / THANH_LY,
            // nên gán sai sẽ làm SaveChanges ném lỗi và KTV không bao giờ
            // hoàn thành được phiếu nào (HTTP 500).
            // Thiết bị vẫn ở DANG_SUA cho tới lúc nghiệm thu mới mở khoá.
            if (equipment.TrangThai == DeviceStatus.HoatDong || equipment.TrangThai == DeviceStatus.SapHan)
            {
                var fromStatus = equipment.TrangThai;
                equipment.TrangThai = DeviceStatus.DangSua;
                _db.EquipmentStatusHistory.Add(new EquipmentStatusHistory
                {
                    IdThietBi = equipment.IdThietBi,
                    TrangThaiCu = fromStatus,
                    TrangThaiMoi = DeviceStatus.DangSua,
                    DoiBoi = actor,
                    LyDo = $"Hoàn thành phiếu {wo.Ma} — chờ nghiệm thu",
                    DoiLuc = DateTime.UtcNow,
                });
            }
        }
        await _db.SaveChangesAsync();

        await _audit.AppendAsync(actor, "WORK_ORDER_COMPLETE", wo.Ma,
            $"bằng chứng: {wo.Evidence.Count}/{required.Count} · chờ nghiệm thu");
    }

    public async Task ReturnAsync(int workOrderId, string reason, string actor)
    {
        if (string.IsNullOrWhiteSpace(reason))
            throw new BusinessException("REASON_REQUIRED", "Lý do trả lại là bắt buộc.", 400);

        var wo = await _db.WorkOrders.FirstOrDefaultAsync(w => w.IdPhieu == workOrderId)
                 ?? throw new BusinessException("NOT_FOUND", "Không tìm thấy phiếu.", 404);
        if (wo.TrangThai != WOStatus.ChoNghiemThu)
            throw new BusinessException("WO_INVALID_STATE", "Chỉ nghiệm thu được phiếu đang chờ.", 409);

        wo.TrangThai = WOStatus.TraLai;
        wo.MoTa = $"[TRẢ LẠI] {reason}";
        // Cột return_reason tồn tại riêng trong CSDL ("bắt buộc khi trả lại
        // phiếu") — ghi để phiếu tự mang lý do, không phải dò trong description.
        wo.LyDoTra = reason;
        await _db.SaveChangesAsync();
        await _audit.AppendAsync(actor, "WO_RETURN", wo.Ma, reason);
    }

    /// Duyệt nghiệm thu. Với phiếu HC ĐẠT: cập nhật hạn hiệu chuẩn mới
    /// (theo chứng thư) và MỞ KHÓA thiết bị + sinh lịch PM kế tiếp.
    public async Task AcceptReviewAsync(int workOrderId, AcceptReviewRequest req, string actor)
    {
        var wo = await _db.WorkOrders.Include(w => w.Steps).Include(w => w.Equipment)
                    .ThenInclude(e => e!.Model)
                    .FirstOrDefaultAsync(w => w.IdPhieu == workOrderId)
                ?? throw new BusinessException("NOT_FOUND", "Không tìm thấy phiếu.", 404);

        if (wo.TrangThai != WOStatus.ChoNghiemThu)
            throw new BusinessException("WO_INVALID_STATE", "Chỉ nghiệm thu được phiếu đang chờ.", 409);

        var hasFailed = wo.Steps.Any(s => s.Result == "KHONG_DAT");

        // Phiếu HC có bước KHÔNG ĐẠT thì tuyệt đối không mở khóa thiết bị.
        if (wo.LoaiPhieu == OrderType.HC && hasFailed)
            throw new BusinessException("MEASUREMENT_OUT_OF_TOLERANCE",
                "Phiếu có bước đo KHÔNG ĐẠT — không được mở khóa thiết bị. Hãy trả lại hoặc đề nghị ngừng sử dụng.",
                422);

        wo.TrangThai = WOStatus.HoanThanh;
        wo.NghiemThuLuc = DateTime.UtcNow;
        var e = wo.Equipment!;
        var prevStatus = e.TrangThai;

        if (wo.LoaiPhieu == OrderType.HC && req.NewCalibrationExpiry.HasValue)
        {
            e.HanHieuChuan = req.NewCalibrationExpiry;
            e.TrangThai = DeviceStatus.HoatDong;
            _db.EquipmentStatusHistory.Add(new EquipmentStatusHistory
            {
                IdThietBi = e.IdThietBi,
                TrangThaiCu = prevStatus,
                TrangThaiMoi = DeviceStatus.HoatDong,
                DoiBoi = actor,
                LyDo = $"Nghiệm thu {wo.Ma} — chứng thư {req.CertificateRef ?? "n/a"}",
                DoiLuc = DateTime.UtcNow,
            });
        }
        else if (wo.LoaiPhieu == OrderType.HC)
        {
            // Không có hạn mới → vẫn mở khóa nhưng giữ hạn cũ (đã được hiệu chuẩn kéo dài
            // một chu kỳ theo model)
            e.HanHieuChuan = DateOnly.FromDateTime(DateTime.Now).AddDays(e.Model?.ChuKyHcNgay ?? 365);
            e.TrangThai = DeviceStatus.HoatDong;
        }
        else if (e.TrangThai == DeviceStatus.DangSua)
        {
            // Phiếu PM/HC thường: mở khoá thiết bị sau khi nghiệm thu, nếu
            // bước hoàn thành đã chuyển nó sang DANG_SUA. Thiết bị đang
            // CHO_HIEU_CHUAN thì giữ nguyên cho tới khi có kết quả hiệu chuẩn.
            e.TrangThai = DeviceStatus.HoatDong;
            _db.EquipmentStatusHistory.Add(new EquipmentStatusHistory
            {
                IdThietBi = e.IdThietBi,
                TrangThaiCu = prevStatus,
                TrangThaiMoi = DeviceStatus.HoatDong,
                DoiBoi = actor,
                LyDo = $"Nghiệm thu {wo.Ma} — mở khoá thiết bị",
                DoiLuc = DateTime.UtcNow,
            });
        }

        if (e.Model != null)
            e.PmKeTiep = DateOnly.FromDateTime(DateTime.Now).AddDays(e.Model.ChuKyPmNgay);

        await _db.SaveChangesAsync();
        await _audit.AppendAsync(actor, "WORK_ORDER_ACCEPT", wo.Ma,
            $"Nghiệm thu đạt. HC mới: {e.HanHieuChuan:dd/MM/yyyy} · chứng thư {req.CertificateRef ?? "n/a"}");
    }
}
