import { useEffect, useState } from 'react';
import { workOrders } from '../../data/mockData';
import { api, apiOr, ApiError, fmtDate } from '../../api/client';
import type { ApiWorkOrder, ApiOrderDetail } from '../../api/types';

// =====================================================================
// Màn NGHIỆM THU (điều phối):
//  • Danh sách chờ duyệt: GET /api/work-orders?status=CHO_NGHIEM_THU
//  • Chi tiết trong modal: GET /api/work-orders/{code} (steps + bằng chứng)
//  • Duyệt:      POST /api/work-orders/{code}/review/accept
//  • Trả lại:    POST /api/work-orders/{code}/review/return  (bắt buộc lý do)
// Offline: mock PM-2026-0195, duyệt/trả lại chỉ tác động cục bộ.
// =====================================================================

const MOCK_STEPS = [
  'Kiểm tra đầu dò (probe)',
  'Vệ sinh đầu dò và cổng kết nối',
  'Kiểm tra chức năng Doppler',
  'Kiểm tra lưu ảnh và in ảnh',
  'Vệ sinh tổng thể, dán nhãn PM',
];
const MOCK_EVIDENCE = ['Ảnh trước PM', 'Ảnh đầu dò', 'Ảnh kết quả test', 'Ảnh nhãn PM mới'];

export default function ReviewOrders() {
  const [pending, setPending] = useState<ApiWorkOrder[] | null>(null);
  const [detail, setDetail] = useState<ApiOrderDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selected, setSelected] = useState<ApiWorkOrder | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [approved, setApproved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const offlineMock = (): ApiWorkOrder[] =>
    workOrders
      .filter((o) => o.status === 'CHO_NGHIEM_THU')
      .map((o, i) => ({
        id: o.id.replace('#', ''),
        workOrderId: i + 1,
        type: o.type,
        device: o.device,
        serial: o.serial,
        equipmentCode: 'DEV-005',
        equipmentId: 5,
        equipmentStatus: 'HOAT_DONG' as const,
        department: o.department,
        departmentId: 4,
        assignee: o.assignee,
        assigneeId: 1,
        status: o.status,
        priority: o.priority,
        created: '2026-09-10',
        deadline: '2026-09-20',
        overdue: false,
        progress: o.progress ?? 100,
        stepsDone: 5,
      }));

  useEffect(() => {
    void apiOr<ApiWorkOrder[]>('/work-orders?status=CHO_NGHIEM_THU', offlineMock)
      .then(setPending)
      .catch(() => setPending(offlineMock()));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openReview(order: ApiWorkOrder) {
    setSelected(order);
    setShowReject(false);
    setRejectReason('');
    setDetail(null);
    setDetailLoading(true);
    apiOr<ApiOrderDetail>(`/work-orders/${order.id}`, () => null as unknown as ApiOrderDetail)
      .then((d) => setDetail(d))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false));
  }

  function closeReview() {
    setSelected(null);
    setDetail(null);
    setShowReject(false);
    setRejectReason('');
  }

  function removeFromList(code: string) {
    setPending((list) => (list ? list.filter((o) => o.id !== code) : list));
  }

  function accept() {
    if (!selected) return;
    api(`/work-orders/${selected.id}/review/accept`, {
      method: 'POST',
      body: JSON.stringify({ newCalibrationExpiry: null, certificateRef: null }),
    })
      .then(() => {
        setApproved(
          `Phiếu ${selected.id} đã được duyệt. Thiết bị trở lại trạng thái ĐANG HOẠT ĐỘNG. Lịch bảo trì kế tiếp đã được tạo tự động.`,
        );
        removeFromList(selected.id);
        closeReview();
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          setError(`[${err.code}] ${err.message}`);
          return;
        }
        // Offline demo: chấp nhận cục bộ
        setApproved(`Phiếu ${selected.id} đã được duyệt (chế độ dữ liệu mẫu — khi máy chủ chạy sẽ lưu vào CSDL).`);
        removeFromList(selected.id);
        closeReview();
      });
  }

  function returnOrder() {
    if (!selected || !rejectReason.trim()) return;
    api(`/work-orders/${selected.id}/review/return`, {
      method: 'POST',
      body: JSON.stringify({ reason: rejectReason.trim() }),
    })
      .then(() => {
        setApproved(`Đã trả lại phiếu ${selected.id} cho kỹ thuật viên làm lại. Lý do đã ghi vào Nhật ký kiểm toán.`);
        removeFromList(selected.id);
        closeReview();
      })
      .catch((err) => {
        if (err instanceof ApiError) {
          setError(`[${err.code}] ${err.message}`);
          return;
        }
        setApproved(`Đã trả lại phiếu ${selected.id} (chế độ dữ liệu mẫu).`);
        removeFromList(selected.id);
        closeReview();
      });
  }

  const list = pending ?? [];

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Nghiệm thu phiếu</h1>
        <p className="text-sm text-slate-500 mt-0.5">Xem xét và duyệt phiếu kỹ thuật viên đã hoàn thành</p>
      </div>

      {approved && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium flex items-start justify-between gap-2">
          <span>✓ {approved}</span>
          <button onClick={() => setApproved(null)} className="text-green-500 hover:text-green-700">
            ✕
          </button>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex items-start justify-between gap-2">
          <span>⛔ {error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            ✕
          </button>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 text-sm font-semibold text-slate-700">
          Chờ nghiệm thu ({list.length})
        </div>
        {list.map((r) => (
          <div key={r.id} className="px-4 py-4 border-b border-slate-50 hover:bg-slate-50 transition-colors">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-mono text-sm text-slate-700 font-semibold">#{r.id}</span>
                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-700">
                    {r.type}
                  </span>
                  {r.overdue && (
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700">QUÁ HẠN</span>
                  )}
                </div>
                <div className="text-sm text-slate-800 font-medium">
                  {r.device} <span className="text-slate-400 font-normal">· {r.serial}</span>
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  Khoa {r.department} · KTV: {r.assignee} · Tạo: {fmtDate(r.created)}
                </div>
                <div className="flex gap-4 mt-2 text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${r.progress >= 100 ? 'bg-green-500' : 'bg-yellow-400'}`} />
                    Checklist: {r.stepsDone} bước · tiến độ {r.progress}%
                  </span>
                </div>
              </div>
              <button
                onClick={() => openReview(r)}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Xem & Nghiệm thu
              </button>
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-sm">Không có phiếu nào chờ nghiệm thu</div>
        )}
      </div>

      {/* Review modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 p-6 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full my-4">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-800">Nghiệm thu phiếu #{selected.id}</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {selected.device} · {selected.assignee}
                </p>
              </div>
              <button onClick={closeReview} className="text-slate-400 hover:text-slate-600 text-xl">
                ×
              </button>
            </div>
            <div className="px-6 py-5 space-y-5">
              {detailLoading && <div className="text-sm text-slate-400 py-4 text-center">Đang tải chi tiết phiếu…</div>}

              {/* Checklist — từ API khi có, mock khi offline */}
              {!detailLoading && (
                <div>
                  <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
                    Kết quả checklist{' '}
                    {detail
                      ? `(${detail.steps.filter((s) => s.hoanThanh || s.lyDoBo).length}/${detail.steps.length})`
                      : ''}
                  </div>
                  <div className="space-y-2">
                    {(detail
                      ? detail.steps.map((s) => ({
                          label: s.tieuDe,
                          done: s.hoanThanh,
                          skip: s.lyDoBo,
                          result: s.result,
                          photo: s.requirePhoto,
                        }))
                      : MOCK_STEPS.map((label, i) => ({ label, done: true, skip: null, result: null, photo: i < 3 }))
                    ).map((s, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        {s.done ? (
                          <span className="text-green-500 text-base">☑</span>
                        ) : s.skip ? (
                          <span className="text-amber-500 text-base">⚠</span>
                        ) : (
                          <span className="text-slate-300 text-base">☐</span>
                        )}
                        <span className={s.done ? 'text-slate-700' : s.skip ? 'text-amber-700' : 'text-slate-400'}>
                          {s.label}
                        </span>
                        {s.skip && <span className="text-[10px] text-amber-600">bỏ: {s.skip}</span>}
                        {s.result === 'KHONG_DAT' && (
                          <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded bg-red-100 text-red-700">
                            KHÔNG ĐẠT
                          </span>
                        )}
                        {s.result === 'DAT' && (
                          <span className="ml-auto text-[10px] font-bold px-2 py-0.5 rounded bg-green-100 text-green-700">
                            ĐẠT
                          </span>
                        )}
                        {!s.result && s.done && s.photo && (
                          <span className="ml-auto text-xs text-blue-600 border border-blue-100 bg-blue-50 px-2 py-0.5 rounded">
                            📷 1 ảnh
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Evidence */}
              {!detailLoading && (
                <div>
                  <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
                    Bằng chứng đính kèm{' '}
                    {detail
                      ? `(${detail.requiredEvidence.filter((e) => e.provided).length}/${detail.requiredEvidence.length})`
                      : '(4/4)'}
                  </div>
                  <div className="grid grid-cols-4 gap-2">
                    {(detail
                      ? detail.requiredEvidence.map((e) => ({
                          label: e.label,
                          provided: e.provided,
                          files: e.files.length,
                        }))
                      : MOCK_EVIDENCE.map((label) => ({ label, provided: true, files: 1 }))
                    ).map((e, i) => (
                      <div
                        key={i}
                        className={`rounded-lg aspect-square flex flex-col items-center justify-center gap-1 transition-colors ${e.provided ? 'bg-slate-100 hover:bg-slate-200 cursor-pointer' : 'bg-red-50 border border-dashed border-red-200'}`}
                      >
                        <span className="text-2xl">{e.provided ? '📷' : '⛔'}</span>
                        <span
                          className={`text-[10px] text-center px-1 ${e.provided ? 'text-slate-500' : 'text-red-500'}`}
                        >
                          {e.label}
                        </span>
                        {e.provided && e.files > 0 && (
                          <span className="text-[9px] text-green-600 font-bold">{e.files} file</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Blocking reasons từ server (nếu có) */}
              {!detailLoading && detail && detail.blockingReasons.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-700">
                  ⚠ Phiếu còn thiếu: {detail.blockingReasons.join(', ')} — nên TRẢ LẠI thay vì duyệt.
                </div>
              )}

              {/* Reject form */}
              {showReject && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-3">
                  <div className="text-sm font-semibold text-red-700">Lý do trả lại (bắt buộc)</div>
                  <textarea
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Nêu cụ thể bước nào chưa đạt, bằng chứng nào còn thiếu..."
                    rows={3}
                    className="w-full text-sm border border-red-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-300 bg-white"
                  />
                  <div className="text-[11px] text-red-500">
                    Lý do này sẽ được ghi vào phiếu và thông báo đến kỹ thuật viên. Cũng được lưu vào Nhật ký kiểm toán.
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-2 border-t border-slate-100">
                <button
                  onClick={accept}
                  className="flex-1 px-4 py-3 bg-green-600 text-white text-sm font-semibold rounded-xl hover:bg-green-700 transition-colors"
                >
                  ✓ Duyệt hoàn thành
                </button>
                <button
                  onClick={() => setShowReject(!showReject)}
                  className="flex-1 px-4 py-3 border border-red-200 text-red-600 text-sm font-semibold rounded-xl hover:bg-red-50 transition-colors"
                >
                  ✕ Trả lại làm lại
                </button>
              </div>
              {showReject && (
                <button
                  onClick={returnOrder}
                  disabled={!rejectReason.trim()}
                  className={`w-full py-2.5 rounded-xl text-sm font-bold ${rejectReason.trim() ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                >
                  Gửi trả lại với lý do trên
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
