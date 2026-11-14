import { useEffect, useState } from 'react';
import { workOrders, type WorkOrder } from '../../data/mockData';
import { apiOr, fmtDate, getUser, PRIORITY_LABELS, WORK_ORDER_STATUS_LABELS, WORK_ORDER_TYPE_LABELS } from '../../api/client';
import type { ApiWorkOrder } from '../../api/types';

// Màn "Phiếu của khoa" — đầu mối khoa chỉ thấy phiếu của KHOA MÌNH.
// Trước đây khoa viết cứng 'Hóa sinh' và departmentId=1 nên MỌI đầu mối
// khoa đều thấy khoa Hóa sinh. Nay lấy khoa từ hồ sơ người đăng nhập.
const FALLBACK_DEPARTMENT = 'Khoa của bạn';

const STATUS_STYLE: Record<WorkOrder['status'], string> = {
  CHO_PHAN_CONG: 'bg-slate-100 text-slate-600',
  DANG_THUC_HIEN: 'bg-blue-100 text-blue-700',
  CHO_NGHIEM_THU: 'bg-purple-100 text-purple-700',
  HOAN_THANH: 'bg-green-100 text-green-700',
  TRA_LAI: 'bg-red-100 text-red-700',
};

const TYPE_STYLE: Record<WorkOrder['type'] | 'KT', string> = {
  HC: 'bg-purple-100 text-purple-700',
  SC: 'bg-orange-100 text-orange-700',
  PM: 'bg-blue-100 text-blue-700',
  KT: 'bg-teal-100 text-teal-700',
};

export default function DepartmentOrders() {
  const [orders, setOrders] = useState<WorkOrder[]>([]);
  const [detail, setDetail] = useState<WorkOrder | null>(null);
  // Khoa của người đang đăng nhập — lấy từ hồ sơ (GET /api/auth/me đã lưu
  // vào localStorage sau khi đăng nhập).
  const me = getUser();
  const department = me?.department ?? FALLBACK_DEPARTMENT;
  const departmentId = me?.departmentId ?? null;

  useEffect(() => {
    // API: GET /api/work-orders?departmentId=<khoa của tôi>.
    // Máy chủ cũng tự giới hạn theo khoa cho vai trò đầu mối khoa, nên
    // ngay cả khi tham số bị bỏ trốn thì dữ liệu vẫn đúng phạm vi.
    const path = departmentId ? `/work-orders?departmentId=${departmentId}` : '/work-orders';
    apiOr<ApiWorkOrder[]>(path, () =>
      workOrders.filter((o) => o.department === department) as unknown as ApiWorkOrder[],
    )
      .then((list) =>
        setOrders(
          list.map((w) => ({
            id: `#${w.id}`,
            type: w.type as WorkOrder['type'],
            device: w.device,
            serial: w.serial,
            department: w.department,
            assignee: w.assignee,
            status: w.status,
            priority: w.priority,
            ngayTao: fmtDate(w.created),
            deadline: fmtDate(w.deadline),
            progress: w.progress,
          })),
        ),
      )
      .catch(() => setOrders(workOrders.filter((o) => o.department === department)));
  }, [department, departmentId]);

  const counts = {
    open: orders.filter((o) => o.status === 'CHO_PHAN_CONG' || o.status === 'DANG_THUC_HIEN').length,
    review: orders.filter((o) => o.status === 'CHO_NGHIEM_THU').length,
    done: orders.filter((o) => o.status === 'HOAN_THANH').length,
    returned: orders.filter((o) => o.status === 'TRA_LAI').length,
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-bold text-slate-800">Phiếu công tác — {department}</h1>
        <p className="text-xs text-slate-400 mt-0.5">Chỉ hiển thị phiếu liên quan đến thiết bị của khoa</p>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Đang mở', value: counts.open, color: 'bg-blue-50 text-blue-700' },
          { label: 'Chờ nghiệm thu', value: counts.review, color: 'bg-purple-50 text-purple-700' },
          { label: 'Hoàn thành', value: counts.done, color: 'bg-green-50 text-green-700' },
          { label: 'Trả lại', value: counts.returned, color: 'bg-red-50 text-red-700' },
        ].map((s) => (
          <div key={s.label} className={`${s.color} rounded-2xl p-3 text-center`}>
            <div className="text-xl font-bold">{s.value}</div>
            <div className="text-[11px] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="space-y-3">
        {orders.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 text-center text-sm text-slate-400">
            Khoa chưa có phiếu công tác nào
          </div>
        )}
        {orders.map((o) => (
          <div
            key={o.id}
            onClick={() => setDetail(o)}
            className="bg-white border border-slate-200 rounded-2xl p-4 cursor-pointer hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-sm font-semibold text-slate-800 font-mono">{o.id}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {o.device} · <span className="font-mono">{o.serial}</span>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${STATUS_STYLE[o.status]}`}>
                {WORK_ORDER_STATUS_LABELS[o.status]}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px]">
              <span className={`px-1.5 py-0.5 rounded font-bold ${TYPE_STYLE[o.type]}`}>{WORK_ORDER_TYPE_LABELS[o.type]}</span>
              {o.priority === 'KHAN' && <span className="text-red-600 font-bold">🔴 Khẩn</span>}
              <span className="text-slate-400">Hạn: {o.deadline}</span>
              {o.assignee && o.assignee !== '—' && <span className="text-slate-400">· KTV: {o.assignee}</span>}
            </div>
            {o.progress !== undefined && (
              <div className="mt-2 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${o.progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                  style={{ width: `${o.progress}%` }}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal chi tiết phiếu của khoa */}
      {detail && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => setDetail(null)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="font-mono text-sm font-bold text-slate-800">{detail.id}</div>
                <div className="text-xs text-slate-400">
                  {WORK_ORDER_TYPE_LABELS[detail.type]} · {detail.department}
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${STATUS_STYLE[detail.status]}`}>
                {WORK_ORDER_STATUS_LABELS[detail.status]}
              </span>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-sm space-y-1.5">
              <div className="text-slate-700 font-medium">{detail.device}</div>
              <div className="text-xs text-slate-400 font-mono">{detail.serial}</div>
              <div className="text-xs text-slate-500">Người thực hiện: {detail.assignee}</div>
              <div className="text-xs text-slate-500">
                Tạo: {detail.ngayTao} · Hạn: {detail.deadline}
              </div>
              {detail.priority === 'KHAN' && <div className="text-xs text-red-600 font-bold">🔴 Mức độ KHẨN</div>}
            </div>
            <p className="text-[11px] text-slate-400">
              Cần chỉnh sửa hay phản hồi phiếu? Liên hệ Phòng VTYT — 0236.xxx.xxxx (nội bộ 245)
            </p>
            <button
              onClick={() => setDetail(null)}
              className="w-full py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50"
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
