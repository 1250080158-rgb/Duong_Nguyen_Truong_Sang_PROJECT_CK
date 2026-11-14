import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { apiOr, fmtDate, getUser, WORK_ORDER_TYPE_LABELS } from '../../api/client';
import type { ApiAssignmentItem, ApiAssignmentWeek, ApiWorkOrder } from '../../api/types';

// =====================================================================
// Màn LỊCH CÁ NHÂN của kỹ thuật viên.
//  • Dữ liệu tuần lấy từ GET /api/assignments/week (chỉ phần lịch của
//    chính người đang đăng nhập) và GET /api/work-orders?assigneeId=…
//    cho các phiếu chưa được xếp lịch.
//  • Không vẽ lịch của đồng nghiệp: kỹ thuật viên chỉ thấy việc của mình.
//  • Backend chưa chạy: hiển thị dữ liệu mẫu để giao diện vẫn xem được.
// =====================================================================

const WEEKDAY_NAMES = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

const TYPE_STYLE: Record<string, string> = {
  PM: 'bg-blue-100 text-blue-700',
  SC: 'bg-orange-100 text-orange-700',
  HC: 'bg-purple-100 text-purple-700',
  KT: 'bg-teal-100 text-teal-700',
};

function mondayOf(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = date.getDay(); // 0 = Chủ nhật
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function isoDate(d: Date): string {
  const m = `${d.getMonth() + 1}`.padStart(2, '0');
  const day = `${d.getDate()}`.padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

export default function TechnicianCalendar() {
  const navigate = useNavigate();
  const me = getUser();
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [items, setItems] = useState<ApiAssignmentItem[]>([]);
  const [unscheduled, setUnscheduled] = useState<ApiWorkOrder[]>([]);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let hủy = false;
    const start = isoDate(weekStart);

    void apiOr<ApiAssignmentWeek>(`/assignments/week?weekStart=${start}`, () => {
      setOffline(true);
      return { weekStart: start, technicians: [], unassigned: [] };
    })
      .then((week) => {
        if (hủy) return;
        setOffline(false);
        // Chỉ lấy phần lịch của chính mình.
        const mine = week.technicians.find((t) => t.idNguoiDung === me?.id);
        setItems(mine ? mine.schedule : []);
      })
      .catch(() => {
        if (!hủy) setItems([]);
      });

    if (me?.id) {
      void apiOr<ApiWorkOrder[]>(`/work-orders?assigneeId=${me.id}`, () => [])
        .then((list) => {
          if (!hủy) setUnscheduled(list.filter((w) => w.status !== 'HOAN_THANH'));
        })
        .catch(() => {
          /* giữ danh sách rỗng */
        });
    }

    return () => {
      hủy = true;
    };
  }, [weekStart, me?.id]);

  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return { iso: isoDate(d), label: `${WEEKDAY_NAMES[i]} ${`${d.getDate()}`.padStart(2, '0')}/${`${d.getMonth() + 1}`.padStart(2, '0')}` };
      }),
    [weekStart],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, ApiAssignmentItem[]>();
    for (const it of items) {
      if (!it.date) continue;
      const list = map.get(it.date) ?? [];
      list.push(it);
      map.set(it.date, list);
    }
    return map;
  }, [items]);

  const shiftWeek = (delta: number) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(d);
  };

  const total = items.length;

  return (
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Lịch cá nhân</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Lịch thực hiện phiếu được phân công cho tôi
            {offline ? ' · đang dùng dữ liệu mẫu (máy chủ chưa chạy)' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => shiftWeek(-1)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
          >
            ‹ Tuần trước
          </button>
          <span className="text-xs text-slate-500 font-medium">
            {fmtDate(isoDate(weekStart))} — {fmtDate(isoDate(new Date(weekStart.getTime() + 6 * 86400000)))}
          </span>
          <button
            onClick={() => shiftWeek(1)}
            className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50"
          >
            Tuần sau ›
          </button>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-4">
        <div className="text-xs text-slate-500 mb-3">
          Tuần này có <strong className="text-slate-700">{total}</strong> phiếu được xếp lịch.
        </div>

        {total === 0 ? (
          <div className="text-center text-sm text-slate-400 py-6">
            Tuần này không có phiếu nào được xếp lịch.
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {days.map((d) => {
              const list = byDay.get(d.iso) ?? [];
              return (
                <div key={d.iso} className="min-h-[120px] bg-slate-50 rounded-xl p-2">
                  <div className="text-[11px] font-semibold text-slate-500 mb-2 text-center">{d.label}</div>
                  <div className="space-y-1.5">
                    {list.map((it) => (
                      <button
                        key={`${it.ma}-${it.date}`}
                        onClick={() => navigate(`/technician/work-order/${it.ma}`)}
                        className={`w-full text-left px-2 py-1.5 rounded-lg text-[11px] font-medium ${TYPE_STYLE[it.type] ?? 'bg-slate-100 text-slate-600'} hover:opacity-80`}
                        title={`${it.ma} · ${it.device}`}
                      >
                        <div className="font-mono font-bold truncate">{it.ma}</div>
                        <div className="truncate font-normal">{it.device}</div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {unscheduled.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-2">
            Phiếu của tôi chưa có ngày dự kiến
          </h2>
          <div className="space-y-2">
            {unscheduled.map((w) => (
              <button
                key={w.id}
                onClick={() => navigate(`/technician/work-order/${w.id}`)}
                className="w-full text-left flex items-center justify-between px-3 py-2 border border-slate-200 rounded-xl hover:bg-slate-50"
              >
                <span className="text-xs font-mono font-bold text-slate-700">{w.id}</span>
                <span className="text-xs text-slate-500">{w.device}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${TYPE_STYLE[w.type] ?? 'bg-slate-100 text-slate-600'}`}>
                  {WORK_ORDER_TYPE_LABELS[w.type] ?? w.type}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
