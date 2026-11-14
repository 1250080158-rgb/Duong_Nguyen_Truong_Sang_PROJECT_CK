import { useEffect, useMemo, useState } from 'react';
import { workOrders, type WorkOrder } from '../../data/mockData';
import {
  api,
  apiOr,
  ApiError,
  fmtDate,
  PRIORITY_LABELS,
  WORK_ORDER_STATUS_LABELS,
  WORK_ORDER_TYPE_LABELS,
} from '../../api/client';
import { useDevices, parseEquipmentId, type DeviceRow } from '../../api/hooks';
import type { ApiWorkOrder, ApiUser } from '../../api/types';

// =====================================================================
// Màn PHIẾU CÔNG TÁC (điều phối) — đã bổ sung:
//  • Modal "+ Tạo phiếu mới" (trước đây nút bấm không làm gì).
//  • Chặn BR-01 ở TẦNG UI: không cho tạo phiếu PM/SC cho thiết bị đang
//    CHỜ_HIỆU_CHUẨN — nút bị vô hiệu + nêu lý do; chỉ cho tạo HC/KT.
//    (Tầng API vẫn kiểm tra lại — đây chỉ là lớp tiện dụng đầu tiên.)
//  • Danh sách phiếu: GET /api/work-orders; tạo phiếu: POST
//    /api/work-orders (persist thật). Offline: mock + localStorage.
// =====================================================================

const NEW_ORDERS_KEY = 'medequip_new_orders';
// Offline fallback: id khớp DbSeeder (minhvt=1, hungtv=2, lthimai=4)
const FALLBACK_TECHS = [
  { id: 1, name: 'Nguyễn Minh VT' },
  { id: 2, name: 'Trần Văn Hùng' },
  { id: 4, name: 'Lê Thị Mai' },
];

type NewOrder = {
  id: string;
  type: WorkOrder['type'] | 'KT';
  device: string;
  serial: string;
  department: string;
  assignee: string;
  status: 'CHO_PHAN_CONG' | 'DANG_THUC_HIEN' | 'CHO_NGHIEM_THU' | 'HOAN_THANH' | 'TRA_LAI';
  priority: 'BINH_THUONG' | 'KHAN';
  ngayTao: string;
  deadline: string;
  progress?: number;
};

function loadLocalNew(): NewOrder[] {
  try {
    return JSON.parse(localStorage.getItem(NEW_ORDERS_KEY) ?? '[]') as NewOrder[];
  } catch {
    return [];
  }
}

function nextCode(existing: string[], type: string): string {
  const year = new Date().getFullYear();
  const seq = existing.filter((c) => c.startsWith(`${type}-`)).length + 1;
  return `${type}-${year}-${String(seq).padStart(4, '0')}`;
}

export default function WorkOrders() {
  const devices = useDevices();
  const [technicians, setTechnicians] = useState(FALLBACK_TECHS);
  const [orders, setOrders] = useState<(WorkOrder | NewOrder)[]>(() => [...loadLocalNew(), ...workOrders]);
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<{ code: string; message: string } | null>(null);

  // Form tạo phiếu
  const [type, setType] = useState<WorkOrder['type'] | 'KT'>('PM');
  const [deviceCode, setDeviceCode] = useState('');
  const [assigneeId, setAssigneeId] = useState<number | null>(null);
  const [priority, setPriority] = useState<'BINH_THUONG' | 'KHAN'>('BINH_THUONG');
  const [deadline, setDeadline] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    // API: GET /api/work-orders; offline: mock + phiếu tạo cục bộ
    apiOr<ApiWorkOrder[]>('/work-orders', () => [])
      .then((list) => {
        if (list.length > 0) {
          setOrders(
            list.map((w) => ({
              id: `#${w.id}`,
              type: w.type,
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

    void apiOr<ApiUser[]>('/users?role=KY_THUAT_VIEN', () => [])
      .then((list) => {
        if (list.length > 0) setTechnicians(list.map((u) => ({ id: u.id, name: u.name })));
      })
      .catch(() => {
        /* giữ fallback */
      });
  }, []);

  const device = useMemo<DeviceRow | undefined>(
    () => devices.find((d) => d.id === deviceCode || d.serial === deviceCode),
    [deviceCode, devices],
  );
  const deviceLocked = device?.status === 'CHO_HIEU_CHUAN';
  const deviceLiquidated = device?.status === 'THANH_LY';
  // BR-01 tầng UI: phiếu khai thác (PM/SC) không được tạo cho thiết bị khóa
  const br01Blocked = (deviceLocked || deviceLiquidated) && (type === 'PM' || type === 'SC');

  function submitCreate() {
    if (!device || !deadline) return;
    const assigneeName = technicians.find((t) => t.id === assigneeId)?.name ?? '—';
    const localCodes = loadLocalNew().map((o) => o.id);
    const code = nextCode([...workOrders.map((o) => o.id), ...localCodes], type);
    const newOrder: NewOrder = {
      id: `#${code}`,
      type,
      device: device.name,
      serial: device.serial,
      department: device.department,
      assignee: assigneeName,
      status: assigneeId ? 'DANG_THUC_HIEN' : 'CHO_PHAN_CONG',
      priority,
      ngayTao: new Date().toLocaleDateString('vi-VN'),
      deadline,
    };

    // API: POST /api/work-orders (backend tự chặn BR-01 ở tầng 2 + ghi audit).
    // Body khớp record CreateOrderRequest của backend: equipmentId/assigneeId.
    api<{ code: string }>('/work-orders', {
      method: 'POST',
      body: JSON.stringify({
        orderType: type,
        equipmentId: device.equipmentId || parseEquipmentId(device.id),
        assigneeId,
        priority,
        deadline: deadline.split('/').reverse().join('-'),
        description: description || null,
      }),
    })
      .then((res) => {
        setNotice(`Đã tạo phiếu ${res.code} (lưu trên server)`);
      })
      .catch((err) => {
        if (err instanceof ApiError && (err.code === 'CALIBRATION_OVERDUE' || err.code === 'WO_CREATE_BLOCKED')) {
          setError({ code: err.code, message: err.message }); // chặn tầng 2
          return;
        }
        // backend chưa chạy → persist cục bộ
        const next = [newOrder, ...loadLocalNew()];
        localStorage.setItem(NEW_ORDERS_KEY, JSON.stringify(next));
        setOrders((orders) => [newOrder, ...orders]);
        setNotice(`Đã tạo phiếu ${newOrder.id} (lưu cục bộ)`);
      });
    setShowCreate(false);
    setType('PM');
    setDeviceCode('');
    setAssigneeId(null);
    setPriority('BINH_THUONG');
    setDeadline('');
    setDescription('');
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Phiếu công tác</h1>
          <p className="text-sm text-slate-500 mt-0.5">{orders.length} phiếu đang theo dõi</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Tạo phiếu mới
        </button>
      </div>

      {notice && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 flex justify-between">
          <span>✓ {notice}</span>
          <button onClick={() => setNotice(null)} className="text-green-500 hover:text-green-700">
            ✕
          </button>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex justify-between">
          <span>
            ⛔ [{error.code}] {error.message}
          </span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: 'Chờ phân công',
            count: orders.filter((o) => o.status === 'CHO_PHAN_CONG').length,
            color: 'text-slate-600',
            bg: 'bg-slate-50',
          },
          {
            label: 'Đang thực hiện',
            count: orders.filter((o) => o.status === 'DANG_THUC_HIEN').length,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
          },
          {
            label: 'Chờ nghiệm thu',
            count: orders.filter((o) => o.status === 'CHO_NGHIEM_THU').length,
            color: 'text-purple-600',
            bg: 'bg-purple-50',
          },
          {
            label: 'Hoàn thành',
            count: orders.filter((o) => o.status === 'HOAN_THANH').length,
            color: 'text-green-600',
            bg: 'bg-green-50',
          },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-slate-100`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.count}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-medium">Mã phiếu</th>
              <th className="px-4 py-3 text-left font-medium">Loại</th>
              <th className="px-4 py-3 text-left font-medium">Thiết bị</th>
              <th className="px-4 py-3 text-left font-medium">Khoa</th>
              <th className="px-4 py-3 text-left font-medium">Người thực hiện</th>
              <th className="px-4 py-3 text-left font-medium">Ưu tiên</th>
              <th className="px-4 py-3 text-left font-medium">Hạn</th>
              <th className="px-4 py-3 text-left font-medium">Tiến độ</th>
              <th className="px-4 py-3 text-left font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {orders.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50 cursor-pointer transition-colors">
                <td className="px-4 py-3 font-mono text-xs text-slate-700 font-medium">{o.id}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      o.type === 'HC'
                        ? 'bg-purple-100 text-purple-700'
                        : o.type === 'SC'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {o.type}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-slate-800">{o.device}</div>
                  <div className="text-xs text-slate-400 font-mono">{o.serial}</div>
                </td>
                <td className="px-4 py-3 text-slate-500 text-sm">{o.department}</td>
                <td className="px-4 py-3 text-slate-600 text-sm">{o.assignee}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      o.priority === 'KHAN' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {o.priority === 'KHAN' ? '🔴 Khẩn' : PRIORITY_LABELS[o.priority]}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-500 text-sm">{o.deadline}</td>
                <td className="px-4 py-3 w-24">
                  {o.progress !== undefined ? (
                    <div>
                      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${o.progress === 100 ? 'bg-green-500' : 'bg-blue-500'}`}
                          style={{ width: `${o.progress}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{o.progress}%</div>
                    </div>
                  ) : (
                    <span className="text-[10px] text-slate-300">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                      o.status === 'HOAN_THANH'
                        ? 'bg-green-100 text-green-700'
                        : o.status === 'CHO_NGHIEM_THU'
                          ? 'bg-purple-100 text-purple-700'
                          : o.status === 'DANG_THUC_HIEN'
                            ? 'bg-blue-100 text-blue-700'
                            : o.status === 'TRA_LAI'
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {WORK_ORDER_STATUS_LABELS[o.status]}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ============ Modal tạo phiếu mới ============ */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-slate-800 px-6 py-4">
              <h2 className="text-white font-bold">Tạo phiếu công tác</h2>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Loại phiếu</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['PM', 'SC', 'HC', 'KT'] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className={`py-2 rounded-xl text-sm font-bold border-2 transition-colors ${
                        type === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-500'
                      }`}
                    >
                      {t === 'PM'
                        ? `PM · ${WORK_ORDER_TYPE_LABELS.PM}`
                        : t === 'SC'
                          ? `SC · ${WORK_ORDER_TYPE_LABELS.SC}`
                          : t === 'HC'
                            ? `HC · ${WORK_ORDER_TYPE_LABELS.HC}`
                            : `KT · ${WORK_ORDER_TYPE_LABELS.KT}`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Thiết bị</label>
                <select
                  value={deviceCode}
                  onChange={(e) => setDeviceCode(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  <option value="">— Chọn thiết bị —</option>
                  {devices.map((d) => (
                    <option
                      key={d.id}
                      value={d.id}
                      disabled={d.status === 'CHO_HIEU_CHUAN' && (type === 'PM' || type === 'SC')}
                    >
                      {d.name} · {d.serial} [{d.status}]
                    </option>
                  ))}
                </select>
                {deviceLocked && (
                  <div className="mt-2 text-[11px] bg-amber-50 border border-amber-200 text-amber-700 rounded-lg px-3 py-2">
                    ⚠ Thiết bị <strong>đang bị khóa chờ hiệu chuẩn</strong> (quá hạn {Math.abs(device!.daysLeft)} ngày).
                    {br01Blocked
                      ? ' Không thể tạo phiếu PM/SC — hãy tạo phiếu HC (hiệu chuẩn) hoặc KT (kiểm định) trước.'
                      : ' Chỉ được tạo phiếu HC/KT.'}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Người thực hiện</label>
                  <select
                    value={assigneeId ?? ''}
                    onChange={(e) => setAssigneeId(e.target.value ? parseInt(e.target.value, 10) : null)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">— Chưa phân công —</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Ưu tiên</label>
                  <div className="flex gap-2">
                    {(['BINH_THUONG', 'KHAN'] as const).map((p) => (
                      <button
                        key={p}
                        onClick={() => setPriority(p)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold border-2 ${
                          priority === p
                            ? p === 'KHAN'
                              ? 'border-red-500 bg-red-50 text-red-700'
                              : 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 text-slate-400'
                        }`}
                      >
                        {p === 'KHAN' ? '🔴 Khẩn' : 'Thường'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Hạn hoàn thành</label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Mô tả (tùy chọn)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  disabled={!device || !deadline || br01Blocked}
                  title={
                    br01Blocked
                      ? 'BR-01: thiết bị quá hạn hiệu chuẩn — không thể phân công/ tạo phiếu khai thác'
                      : undefined
                  }
                  onClick={submitCreate}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${
                    !device || !deadline || br01Blocked
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  {br01Blocked ? '⛔ Bị chặn (BR-01)' : 'Tạo phiếu'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
