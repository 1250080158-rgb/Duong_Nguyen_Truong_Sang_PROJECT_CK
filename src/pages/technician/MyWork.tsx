import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { workOrders, type WorkOrder } from '../../data/mockData';
import { apiOr, fmtDate, getUser, WORK_ORDER_TYPE_LABELS } from '../../api/client';
import type { ApiWorkOrder } from '../../api/types';

// =====================================================================
// Màn VIỆC CỦA TÔI (KTV, mobile-first) — GET
// /api/work-orders?assigneeId={user đăng nhập}. Bấm phiếu → màn thực
// hiện /technician/work-order/{code}. Offline: mock của "Nguyễn Minh VT".
// =====================================================================

export default function MyWork() {
  const navigate = useNavigate();
  const user = getUser();
  const [filter, setFilter] = useState<'ALL' | 'PM' | 'SC' | 'HC'>('ALL');
  const [myOrders, setMyOrders] = useState<WorkOrder[]>(() =>
    workOrders.filter((o) => o.assignee === 'Nguyễn Minh VT' || o.assignee === '—'),
  );

  useEffect(() => {
    if (!user || user.id === 0) return; // offline demo → giữ mock
    void apiOr<ApiWorkOrder[]>(`/work-orders?assigneeId=${user.id}`, () => [])
      .then((list) => {
        if (list.length > 0) {
          setMyOrders(
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
          );
        }
      })
      .catch(() => {
        /* giữ mock */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = filter === 'ALL' ? myOrders : myOrders.filter((o) => o.type === filter);
  // So sánh hai phía — comparator cũ chỉ nhìn a nên thứ tự KHAN không ổn định.
  const sorted = [...filtered].sort(
    (a, b) => (a.priority === 'KHAN' ? 0 : 1) - (b.priority === 'KHAN' ? 0 : 1),
  );

  return (
    <div className="p-4 space-y-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Việc của tôi</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {user?.fullName ?? 'Kỹ thuật viên'} · {new Date().toLocaleDateString('vi-VN')}
          </p>
        </div>
        <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold">
          {(user?.fullName ?? 'KTV').split(' ').slice(-1)[0].slice(0, 2).toUpperCase()}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          {
            label: 'Đang làm',
            count: myOrders.filter((o) => o.status === 'DANG_THUC_HIEN').length,
            color: 'text-blue-600 bg-blue-50',
          },
          {
            label: 'Chờ làm',
            count: myOrders.filter((o) => o.status === 'CHO_PHAN_CONG').length,
            color: 'text-slate-600 bg-slate-50',
          },
          {
            label: 'Khẩn cấp',
            count: myOrders.filter((o) => o.priority === 'KHAN').length,
            color: 'text-red-600 bg-red-50',
          },
        ].map((s) => (
          <div key={s.label} className={`${s.color} rounded-2xl p-3 text-center`}>
            <div className={`text-2xl font-bold ${s.color.split(' ')[0]}`}>{s.count}</div>
            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['ALL', 'PM', 'SC', 'HC'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
              filter === f ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {f === 'ALL' ? 'Tất cả' : f}
          </button>
        ))}
      </div>

      {/* Work order cards */}
      <div className="space-y-3">
        {sorted.map((o) => (
          <div
            key={o.id}
            onClick={() => navigate(`/technician/work-order/${o.id.replace('#', '')}`)}
            className={`bg-white border rounded-2xl p-4 cursor-pointer hover:shadow-md transition-shadow ${
              o.priority === 'KHAN' ? 'border-red-200' : 'border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <span
                  className={`px-2 py-1 rounded-lg text-xs font-bold ${
                    o.type === 'HC'
                      ? 'bg-purple-100 text-purple-700'
                      : o.type === 'SC'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-blue-100 text-blue-700'
                  }`}
                >
                  {WORK_ORDER_TYPE_LABELS[o.type]}
                </span>
                {o.priority === 'KHAN' && (
                  <span className="px-2 py-0.5 bg-red-100 text-red-600 text-[11px] font-bold rounded-lg">🔴 KHẨN</span>
                )}
              </div>
              <span
                className={`text-[11px] font-semibold px-2 py-1 rounded-lg ${
                  o.status === 'DANG_THUC_HIEN'
                    ? 'bg-blue-50 text-blue-600'
                    : o.status === 'CHO_NGHIEM_THU'
                      ? 'bg-purple-50 text-purple-600'
                      : o.status === 'TRA_LAI'
                        ? 'bg-red-50 text-red-600'
                        : o.status === 'HOAN_THANH'
                          ? 'bg-green-50 text-green-600'
                          : 'bg-slate-50 text-slate-500'
                }`}
              >
                {o.status === 'DANG_THUC_HIEN'
                  ? 'Đang làm'
                  : o.status === 'CHO_NGHIEM_THU'
                    ? 'Chờ nghiệm thu'
                    : o.status === 'TRA_LAI'
                      ? 'Bị trả lại'
                      : o.status === 'HOAN_THANH'
                        ? 'Đã nghiệm thu'
                        : 'Chờ làm'}
              </span>
            </div>

            <div className="text-base font-semibold text-slate-800 mb-1">{o.device}</div>
            <div className="text-sm text-slate-500">
              {o.serial} · Khoa {o.department}
            </div>

            <div className="mt-3 pt-3 border-t border-slate-50 flex items-center justify-between">
              <div className="text-xs text-slate-400 font-mono">{o.id}</div>
              <div className="text-xs text-slate-500">
                Hạn:{' '}
                <span className={`font-semibold ${o.priority === 'KHAN' ? 'text-red-600' : 'text-slate-700'}`}>
                  {o.deadline}
                </span>
              </div>
            </div>

            {o.progress !== undefined && (
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                  <span>Tiến độ</span>
                  <span>{o.progress}%</span>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${o.progress}%` }} />
                </div>
              </div>
            )}
          </div>
        ))}
        {sorted.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl py-10 text-center text-slate-400 text-sm">
            Không có phiếu nào — bạn sẽ thấy việc ở đây khi điều phối phân công
          </div>
        )}
      </div>
    </div>
  );
}
