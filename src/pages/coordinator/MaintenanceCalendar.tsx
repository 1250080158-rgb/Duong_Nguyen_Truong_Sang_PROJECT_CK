import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { api, ApiError, fmtDate } from '../../api/client';
import type { ApiAssignmentItem, ApiAssignmentWeek } from '../../api/types';

// =====================================================================
// Màn LỊCH BẢO TRÌ & PHÂN CÔNG.
//  • Backend chạy: dữ liệu tuần nạp từ GET /api/assignments/week; kéo-thả
//    phân công POST /api/assignments với idPhieu/idThietBi thật —
//    backend trả 422 CALIBRATION_OVERDUE nếu vi phạm BR-01 (tầng 2).
//  • Backend chưa chạy: giữ bộ dữ liệu mẫu; phân công persist vào
//    localStorage (trước đây state cục bộ mất khi refresh).
//  • Nút "Tạo phiếu hiệu chuẩn ngay" trong hộp chặn TẠO THẬT phiếu HC
//    (persist + POST /work-orders) — trước đây chỉ đóng hộp thoại.
// =====================================================================

const ASSIGN_KEY = 'medequip_assignments';
const HC_CREATED_KEY = 'medequip_hc_created';

interface DayCol {
  label: string; // 'T2 05/10'
  iso: string; // '2026-10-05'
}

interface Ticket {
  key: string; // mã phiếu không dấu #
  id: string; // mã hiển thị, ví dụ #PM-2026-0201
  type: string;
  device: string;
  department?: string;
  deadline?: string;
  locked?: boolean;
  idPhieu?: number;
  idThietBi?: number;
}

interface OverdueDetails {
  idThietBi?: number;
  equipmentCode?: string;
  calibrationValidUntil?: string;
  overdueDays?: number;
  lastCertificateRef?: string;
}

interface BlockedState {
  ticket: Ticket;
  tech: string;
  day: string;
  details?: OverdueDetails;
}

function loadAssignments(): Record<string, Record<string, Ticket[]>> {
  try {
    return JSON.parse(localStorage.getItem(ASSIGN_KEY) ?? '{}');
  } catch {
    return {};
  }
}
function loadCreatedHC(): Ticket[] {
  try {
    return JSON.parse(localStorage.getItem(HC_CREATED_KEY) ?? '[]');
  } catch {
    return [];
  }
}

const WEEKDAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

function mondayOf(d: Date): Date {
  const date = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const dow = date.getDay(); // 0 = chủ nhật
  date.setDate(date.getDate() + (dow === 0 ? -6 : 1 - dow));
  return date;
}

function isoOf(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** 6 cột T2 → T7 của tuần bắt đầu từ thứ Hai cho trước. */
function dayColumns(monday: Date): DayCol[] {
  return Array.from({ length: 6 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return {
      label: `${WEEKDAY_NAMES[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      iso: isoOf(d),
    };
  });
}

// ----- Bộ dữ liệu mẫu dùng khi backend chưa chạy -----
const OFFLINE_TECHNICIANS = ['Nguyễn Minh VT', 'Trần Văn Hùng', 'Lê Thị Mai'];

// Lịch mẫu ghi theo thứ trong tuần ('T2 28/09' → đặt vào ngày T2 của tuần
// đang xem) để màn demo không bị "tuần cũ" khi mở vào tuần khác.
const SCHEDULE: Record<string, Record<string, { id: string; type: string; device: string; locked?: boolean }[]>> = {
  'Nguyễn Minh VT': {
    'T2 28/09': [{ id: '#PM-2026-0201', type: 'PM', device: 'BS-240' }],
    'T4 30/09': [{ id: '#HC-2026-0087', type: 'HC', device: 'XN-1000', locked: true }],
  },
  'Trần Văn Hùng': {
    'T3 29/09': [{ id: '#SC-2026-0102', type: 'SC', device: 'XN-1000' }],
  },
  'Lê Thị Mai': {
    'T5 01/10': [{ id: '#HC-2026-0091', type: 'HC', device: 'DR 600' }],
  },
};

const UNASSIGNED: { id: string; type: string; device: string; department: string; deadline: string; locked?: boolean }[] = [
  { id: '#PM-2026-0199', type: 'PM', device: 'ECG-2150', department: 'Tim mạch', deadline: '05/10' },
  {
    id: '#SC-2026-0088',
    type: 'SC',
    device: 'BS-240 SN12346',
    department: 'Hóa sinh',
    deadline: '30/09',
    locked: true,
  },
  { id: '#PM-2026-0200', type: 'PM', device: 'LOGIQ E9', department: 'CĐHA', deadline: '07/10' },
];

function toTicket(a: ApiAssignmentItem): Ticket {
  return {
    key: a.ma,
    id: `#${a.ma}`,
    type: a.type,
    device: a.serial ? `${a.device} ${a.serial}` : a.device,
    department: a.department,
    deadline: a.deadline ? fmtDate(a.deadline) : undefined,
    idPhieu: a.workOrderId,
    idThietBi: a.equipmentId,
  };
}

function offlineBoard(monday: Date): {
  cols: DayCol[];
  techs: { id: number; name: string }[];
  schedule: Record<string, Record<string, Ticket[]>>;
  unassigned: Ticket[];
} {
  const cols = dayColumns(monday);
  const schedule: Record<string, Record<string, Ticket[]>> = {};
  for (const name of OFFLINE_TECHNICIANS) {
    schedule[name] = Object.fromEntries(cols.map((d) => [d.label, []]));
  }
  Object.entries(SCHEDULE).forEach(([tech, byDay]) => {
    Object.entries(byDay).forEach(([oldLabel, items]) => {
      const weekday = `${oldLabel.split(' ')[0]} `; // 'T2 '
      const col = cols.find((d) => d.label.startsWith(weekday));
      if (col && schedule[tech]) {
        schedule[tech][col.label] = items.map((it) => ({
          key: it.id,
          id: it.id,
          type: it.type,
          device: it.device,
          locked: it.locked,
        }));
      }
    });
  });
  const created = loadCreatedHC();
  const unassigned: Ticket[] = [
    ...created,
    ...UNASSIGNED.filter((u) => !created.some((c) => c.id === u.id)).map((u) => ({
      key: u.id,
      id: u.id,
      type: u.type,
      device: u.device,
      department: u.department,
      deadline: u.deadline,
      locked: u.locked,
    })),
  ];
  return { cols, techs: OFFLINE_TECHNICIANS.map((name, i) => ({ id: i + 1, name })), schedule, unassigned };
}

const TYPE_COLORS: Record<string, string> = {
  PM: 'bg-blue-100 text-blue-700 border-blue-200',
  SC: 'bg-orange-100 text-orange-700 border-orange-200',
  HC: 'bg-purple-100 text-purple-700 border-purple-200',
};

export default function MaintenanceCalendar() {
  const navigate = useNavigate();
  const initial = offlineBoard(mondayOf(new Date()));
  const [weekStart, setWeekStart] = useState(() => isoOf(mondayOf(new Date())));
  const [days, setDays] = useState<DayCol[]>(initial.cols);
  const [technicians, setTechnicians] = useState(initial.techs);
  const [schedule, setSchedule] = useState(initial.schedule);
  const [unassigned, setUnassigned] = useState<Ticket[]>(initial.unassigned);
  const [online, setOnline] = useState(false);
  const [assigned, setAssigned] = useState(loadAssignments);
  const [created, setCreated] = useState<Ticket[]>(loadCreatedHC);
  const [dragging, setDragging] = useState<Ticket | null>(null);
  const [blocked, setBlocked] = useState<BlockedState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);

  const unassignedPool = [...created, ...unassigned.filter((u) => !created.some((c) => c.id === u.id))];

  function applyServer(w: ApiAssignmentWeek) {
    const cols = dayColumns(new Date(`${w.weekStart}T00:00:00`));
    setOnline(true);
    setDays(cols);
    setTechnicians(w.technicians.map((t) => ({ id: t.idNguoiDung, name: t.hoTen })));
    const next: Record<string, Record<string, Ticket[]>> = {};
    for (const t of w.technicians) {
      next[t.hoTen] = Object.fromEntries(cols.map((d) => [d.label, [] as Ticket[]]));
      for (const a of t.schedule) {
        const col = cols.find((d) => d.iso === a.date);
        if (col) next[t.hoTen][col.label].push(toTicket(a));
      }
    }
    setSchedule(next);
    setUnassigned(w.unassigned.map(toTicket));
  }

  useEffect(() => {
    let cancelled = false;
    api<ApiAssignmentWeek>(`/assignments/week?weekStart=${weekStart}`)
      .then((w) => {
        if (!cancelled) applyServer(w);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError) setServerError(`[${err.code}] ${err.message}`);
        const board = offlineBoard(new Date(`${weekStart}T00:00:00`));
        setOnline(false);
        setDays(board.cols);
        setTechnicians(board.techs);
        setSchedule(board.schedule);
        setUnassigned(board.unassigned);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart]);

  function persistAssigned(next: Record<string, Record<string, Ticket[]>>) {
    localStorage.setItem(ASSIGN_KEY, JSON.stringify(next));
  }

  /** Chuyển phiếu từ cột "Chờ phân công" vào ô lịch (chỉ UI, sau khi server xác nhận). */
  function moveTicket(techName: string, dayLabel: string, ticket: Ticket) {
    setUnassigned((list) => list.filter((t) => t.key !== ticket.key));
    setSchedule((prev) => ({
      ...prev,
      [techName]: {
        ...(prev[techName] ?? {}),
        [dayLabel]: [...(prev[techName]?.[dayLabel] ?? []), ticket],
      },
    }));
  }

  function handleDrop(tech: { id: number; name: string }, day: DayCol) {
    if (!dragging) return;
    const ticket = dragging;
    setDragging(null);
    if (ticket.locked) {
      setBlocked({ ticket, tech: tech.name, day: day.label });
      return;
    }
    if (online && ticket.idPhieu && ticket.idThietBi && tech.id > 0) {
      // Backend: POST /api/assignments — tầng 2 xác nhận lại BR-01.
      // Body khớp record AssignRequest của backend.
      api<{ assignmentId: number }>('/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workOrderId: ticket.idPhieu,
          equipmentId: ticket.idThietBi,
          assigneeId: tech.id,
          scheduledDate: day.iso,
        }),
      })
        .then(() => {
          moveTicket(tech.name, day.label, ticket);
          setNotice(`Đã phân công ${ticket.id} cho ${tech.name} — ${day.label}`);
        })
        .catch((err) => {
          if (err instanceof ApiError && err.code === 'CALIBRATION_OVERDUE') {
            setBlocked({ ticket, tech: tech.name, day: day.label, details: err.details as OverdueDetails });
          } else if (err instanceof ApiError) {
            setServerError(`${err.code}: ${err.message}`);
          } else {
            setServerError('Không phân công được — máy chủ không phản hồi.');
          }
        });
      return;
    }
    // Offline demo: persist vào localStorage
    const next = {
      ...assigned,
      [tech.name]: {
        ...(assigned[tech.name] ?? {}),
        [day.label]: [...(assigned[tech.name]?.[day.label] ?? []), ticket],
      },
    };
    setAssigned(next);
    persistAssigned(next);
  }

  function createHcNow() {
    const t = blocked!.ticket;
    const overdue = blocked!.details;
    const deadline = isoOf(new Date(Date.now() + 7 * 86_400_000));
    if (online && overdue?.idThietBi) {
      // Backend chạy: tạo phiếu HC thật cho đúng thiết bị bị khóa
      void api<{ code: string }>('/work-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderType: 'HC',
          equipmentId: overdue.idThietBi,
          priority: 'KHAN',
          deadline,
          description: `Tạo nhanh sau khi bị chặn phân công phiếu ${t.id} (BR-01)`,
        }),
      })
        .then((res) => setNotice(`Đã tạo phiếu hiệu chuẩn ${res.code} trên máy chủ`))
        .catch((err) =>
          setServerError(err instanceof ApiError ? `${err.code}: ${err.message}` : 'Không tạo được phiếu trên máy chủ.'),
        );
    } else {
      const seq = loadCreatedHC().length + 1;
      const newOrder: Ticket = {
        key: `HC-LOCAL-${seq}`,
        id: `#HC-${new Date().getFullYear()}-${String(100 + seq).padStart(4, '0')}`,
        type: 'HC',
        device: t.device,
        department: t.department,
        deadline: '07/10',
      };
      const next = [newOrder, ...loadCreatedHC()];
      localStorage.setItem(HC_CREATED_KEY, JSON.stringify(next));
      setCreated(next);
      setNotice(`Đã tạo phiếu hiệu chuẩn ${newOrder.id} cho ${t.device} — xuất hiện trong cột "Chờ phân công"`);
    }
    setBlocked(null);
  }

  const mondayDate = new Date(`${weekStart}T00:00:00`);
  const sundayDate = new Date(mondayDate);
  sundayDate.setDate(mondayDate.getDate() + 6);

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Lịch bảo trì & Phân công</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Tuần {fmtDate(isoOf(mondayDate))} – {fmtDate(isoOf(sundayDate))}
          </p>
          {(notice || serverError) && (
            <div
              className={`mt-2 rounded-lg px-3 py-2 text-xs max-w-md ${notice ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}
            >
              {notice ? `✓ ${notice}` : `⛔ ${serverError}`}
              <button
                onClick={() => {
                  setNotice(null);
                  setServerError(null);
                }}
                className="ml-2 opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              const m = new Date(`${weekStart}T00:00:00`);
              m.setDate(m.getDate() - 7);
              setWeekStart(isoOf(m));
            }}
            className="px-3 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors"
          >
            ← Tuần trước
          </button>
          <button
            onClick={() => setWeekStart(isoOf(mondayOf(new Date())))}
            className="px-4 py-2 bg-slate-800 text-white text-sm rounded-lg hover:bg-slate-700 transition-colors"
          >
            Tuần này
          </button>
          <button
            onClick={() => {
              const m = new Date(`${weekStart}T00:00:00`);
              m.setDate(m.getDate() + 7);
              setWeekStart(isoOf(m));
            }}
            className="px-3 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors"
          >
            Tuần sau →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {/* Unassigned */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <div className="text-sm font-semibold text-slate-700">Chờ phân công ({unassignedPool.length})</div>
            <div className="text-xs text-slate-400 mt-0.5">Kéo phiếu vào lịch để phân công</div>
          </div>
          <div className="p-3 space-y-2">
            {unassignedPool.map((ticket) => (
              <div
                key={ticket.key}
                draggable
                onDragStart={() => setDragging(ticket)}
                onDragEnd={() => setDragging(null)}
                className={`p-3 rounded-lg border cursor-grab active:cursor-grabbing select-none transition-shadow hover:shadow-md ${
                  ticket.locked ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'
                } ${dragging?.key === ticket.key ? 'opacity-50' : ''}`}
              >
                <div className="flex items-start justify-between mb-1.5">
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${TYPE_COLORS[ticket.type]}`}>
                    {ticket.type}
                  </span>
                  {ticket.locked && <span className="text-[10px] text-red-500 font-bold">⚠ THIẾT BỊ KHÓA</span>}
                </div>
                <div className="text-xs font-medium text-slate-700">{ticket.device}</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {ticket.department} {ticket.deadline ? `· Hạn: ${ticket.deadline}` : ''}
                </div>
                <div className="text-[10px] text-slate-400 font-mono mt-1">{ticket.id}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Calendar */}
        <div className="col-span-2 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="px-3 py-3 text-left text-slate-500 font-medium w-28">Kỹ thuật viên</th>
                  {days.map((day) => (
                    <th key={day.iso} className="px-2 py-3 text-center text-slate-500 font-medium min-w-[90px]">
                      {day.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {technicians.map((tech) => (
                  <tr key={tech.id}>
                    <td className="px-3 py-2 text-slate-700 font-medium border-r border-slate-100 bg-slate-50/50 text-[11px]">
                      {tech.name}
                    </td>
                    {days.map((day) => {
                      const fromServer = schedule[tech.name]?.[day.label] ?? [];
                      const fromLocal = online ? [] : (assigned[tech.name]?.[day.label] ?? []);
                      const allItems = [...fromServer, ...fromLocal];
                      return (
                        <td
                          key={day.iso}
                          className="px-1.5 py-1.5 align-top border-r border-slate-50 min-h-[60px]"
                          onDragOver={(e) => {
                            e.preventDefault();
                          }}
                          onDrop={() => handleDrop(tech, day)}
                        >
                          <div className="min-h-12 rounded-lg border-2 border-dashed border-transparent hover:border-blue-200 hover:bg-blue-50/30 transition-colors p-1 space-y-1">
                            {allItems.map((item, i) => (
                              <div
                                key={i}
                                className={`px-1.5 py-1 rounded border text-[10px] font-medium ${
                                  item.locked ? 'bg-red-100 text-red-700 border-red-200' : TYPE_COLORS[item.type]
                                }`}
                              >
                                <div className="font-bold">{item.type}</div>
                                <div className="truncate">{item.device}</div>
                              </div>
                            ))}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex gap-4 text-[11px] text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-blue-100 border border-blue-200 inline-block" /> PM – Bảo trì định kỳ
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-orange-100 border border-orange-200 inline-block" /> SC – Sửa chữa
            </span>
            <span className="flex items-center gap-1">
              <span className="w-3 h-3 rounded bg-purple-100 border border-purple-200 inline-block" /> HC – Hiệu chuẩn
            </span>
          </div>
        </div>
      </div>

      {/* Block dialog */}
      {blocked && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-red-600 px-6 py-4">
              <div className="flex items-center gap-2">
                <span className="text-white text-xl">⛔</span>
                <h2 className="text-white font-bold text-lg">KHÔNG THỂ PHÂN CÔNG</h2>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
                <div className="text-sm font-semibold text-red-800">Thiết bị: {blocked.ticket.device}</div>
                {blocked.details ? (
                  <>
                    <div className="text-sm text-red-700">
                      Thiết bị đã{' '}
                      <strong>quá hạn hiệu chuẩn {blocked.details.overdueDays ?? '?'} ngày</strong>
                      {blocked.details.calibrationValidUntil
                        ? `. Chứng chỉ hiệu chuẩn hết hạn ngày ${fmtDate(blocked.details.calibrationValidUntil)}`
                        : ''}
                      .
                    </div>
                    <div className="text-xs text-red-600 font-mono">
                      Căn cứ: {blocked.details.lastCertificateRef ?? 'không có chứng chỉ nào'}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="text-sm text-red-700">
                      Thiết bị đã <strong>quá hạn hiệu chuẩn 23 ngày</strong>. Chứng chỉ hiệu chuẩn hết hạn ngày
                      01/08/2026.
                    </div>
                    <div className="text-xs text-red-600 font-mono">Căn cứ: chứng thư #VC-2026-0112</div>
                  </>
                )}
                <div className="text-xs text-red-600 mt-1">
                  Phiếu sử dụng lưu động không thể phân công vào thiết bị đã bị khóa do quá hạn hiệu chuẩn.
                </div>
              </div>
              <div className="text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
                <strong>Lưu ý nghiệp vụ:</strong> Hành động từ chối này đã được ghi vào{' '}
                <strong>Nhật ký kiểm toán</strong> với loại sự kiện ASSIGN_BLOCKED — đây là bằng chứng hệ thống đã thực
                thi luật chặn.
              </div>
              <div className="flex gap-3">
                <button
                  onClick={createHcNow}
                  className="flex-1 px-4 py-2.5 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 transition-colors"
                >
                  Tạo phiếu hiệu chuẩn ngay
                </button>
                <button
                  onClick={() => {
                    setBlocked(null);
                    navigate(`/coordinator/devices/${blocked.details?.equipmentCode ?? 'DEV-002'}`);
                  }}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm rounded-xl hover:bg-slate-50 transition-colors"
                >
                  Xem hồ sơ thiết bị
                </button>
              </div>
              <button
                onClick={() => setBlocked(null)}
                className="w-full text-xs text-slate-400 hover:text-slate-600 py-1"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
