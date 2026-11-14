import { useEffect, useState } from 'react';
import { auditLogs } from '../../data/mockData';
import { apiOr, downloadCsv, fmtDateTime } from '../../api/client';
import type { ApiAuditResponse } from '../../api/types';

// =====================================================================
// Màn AUDIT LOG (admin, chỉ đọc) — GET /api/audit: mỗi dòng kèm hashOk
// (row_ok + chain_ok từ view v_audit_chain_verify của PostgreSQL) và
// cờ chainIntact toàn cục. Offline: mock (có 1 dòng đứt chuỗi để demo).
// =====================================================================

const ACTION_COLORS: Record<string, string> = {
  ASSIGN: 'bg-blue-100 text-blue-700',
  ASSIGN_BLOCKED: 'bg-red-100 text-red-700',
  WO_CREATE: 'bg-sky-100 text-sky-700',
  WO_STEP_UPDATE: 'bg-slate-100 text-slate-600',
  WO_COMPLETE: 'bg-green-100 text-green-700',
  WO_ACCEPT: 'bg-green-100 text-green-700',
  WO_RETURN: 'bg-orange-100 text-orange-700',
  EVIDENCE_UPLOADED: 'bg-teal-100 text-teal-700',
  CONFIG_UPDATE: 'bg-purple-100 text-purple-700',
  CATALOG_CREATE: 'bg-indigo-100 text-indigo-700',
  AUTO_LOCK: 'bg-orange-100 text-orange-700',
  FAULT_REPORT: 'bg-yellow-100 text-yellow-700',
  UPDATE: 'bg-blue-100 text-blue-700',
};

interface MappedLog {
  auditId: number;
  time: string; // hiển thị
  iso: string | null; // để lọc theo ngày (API)
  actor: string;
  action: string;
  target: string;
  detail: string;
  hash: string;
  hashOk: boolean;
}

const MOCK_MAPPED: MappedLog[] = auditLogs.map((l, i) => ({
  auditId: i + 1,
  time: l.time,
  iso: null,
  actor: l.nguoiThucHien,
  action: l.hanhDong,
  target: l.doiTuong,
  detail: l.chiTiet,
  hash: l.hash,
  hashOk: l.hashOk,
}));

export default function AuditLog() {
  const [logs, setLogs] = useState<MappedLog[]>(MOCK_MAPPED);
  const [chainIntact, setChainIntact] = useState<boolean | null>(null);
  const [actorFilter, setActorFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [allActions, setAllActions] = useState<string[]>(() =>
    Array.from(new Set(MOCK_MAPPED.map((l) => l.action))),
  );

  // Bộ lọc chạy Ở MÁY CHỦ (GET /api/audit?actor=&action=&from=&to=) — trước đây
  // giao diện lọc client-side nên tải toàn bộ nhật ký về rồi mới lọc, với
  // nhật ký lớn thì vừa chậm vừa không kiểm soát được dữ liệu trả về.
  const mapItems = (items: ApiAuditResponse['items']): MappedLog[] =>
    items.map((it) => ({
      auditId: it.idKiemToan,
      time: fmtDateTime(it.time),
      iso: it.time.slice(0, 10),
      actor: it.nguoiThucHien,
      action: it.hanhDong,
      target: it.doiTuong,
      detail: it.chiTiet ?? '',
      hash: it.hash,
      hashOk: it.hashOk,
    }));

  // Danh sách hành động để đổền bộ lọc: nạp một lần không lọc để có đủ
  // danh sách hành động của hệ thống.
  useEffect(() => {
    void apiOr<ApiAuditResponse>('/audit', () => ({ chainIntact: true, items: [] }))
      .then((res) => {
        if (res.items.length > 0) {
          setAllActions(Array.from(new Set(res.items.map((i) => i.hanhDong))));
        }
      })
      .catch(() => {
        /* giữ danh sách từ dữ liệu mẫu */
      });
  }, []);

  useEffect(() => {
    const q = new URLSearchParams();
    if (actorFilter) q.set('actor', actorFilter);
    if (actionFilter !== 'ALL') q.set('action', actionFilter);
    if (fromDate) q.set('from', `${fromDate}T00:00:00Z`);
    if (toDate) q.set('to', `${toDate}T23:59:59Z`);
    const path = `/audit${q.toString() ? `?${q}` : ''}`;

    void apiOr<ApiAuditResponse>(path, () => ({ chainIntact: true, items: [] }))
      .then((res) => {
        setChainIntact(res.chainIntact);
        if (res.items.length > 0) setLogs(mapItems(res.items));
      })
      .catch(() => setChainIntact(MOCK_MAPPED.every((l) => l.hashOk)));
  }, [actorFilter, actionFilter, fromDate, toDate]);

  const actions = allActions;

  const filtered = logs.filter((l) => {
    const matchActor = !actorFilter || l.actor.includes(actorFilter);
    const matchAction = actionFilter === 'ALL' || l.action === actionFilter;
    const matchFrom = !fromDate || !l.iso || l.iso >= fromDate;
    const matchTo = !toDate || !l.iso || l.iso <= toDate;
    return matchActor && matchAction && matchFrom && matchTo;
  });

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Nhật ký kiểm toán</h1>
          <p className="text-sm text-slate-500 mt-0.5">Nhật ký toàn bộ hành động hệ thống — chỉ đọc</p>
        </div>
        <button
          onClick={() =>
            downloadCsv('nhat-ky-kiem-toan', filtered, [
              { key: 'time', label: 'Thời điểm', value: (l) => l.time },
              { key: 'actor', label: 'Người thực hiện', value: (l) => l.actor },
              { key: 'action', label: 'Hành động', value: (l) => l.action },
              { key: 'target', label: 'Đối tượng', value: (l) => l.target },
              { key: 'detail', label: 'Chi tiết', value: (l) => l.detail },
              { key: 'hash', label: 'Mã băm', value: (l) => l.hash },
              { key: 'hashOk', label: 'Chuỗi băm hợp lệ', value: (l) => (l.hashOk ? 'Có' : 'KHÔNG') },
            ])
          }
          className="px-3 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50 flex items-center gap-2"
        >
          ⤓ Xuất tệp CSV
        </button>
      </div>

      <div
        className={`rounded-xl px-4 py-3 text-xs border ${
          chainIntact === false
            ? 'bg-red-50 border-red-200 text-red-700'
            : 'bg-amber-50 border-amber-200 text-amber-700'
        }`}
      >
        {chainIntact === false ? (
          <>
            <strong>⛔ CHUỖI BĂM BỊ ĐỨT:</strong> Có dấu hiệu sửa/xoá CSDL trực tiếp — dòng lỗi được tô đỏ bên dưới. Cần
            điều tra ngay.
          </>
        ) : (
          <>
            <strong>Chuỗi băm liên kết:</strong> Mỗi dòng nhật ký được gắn mật mã học với dòng trước (SHA-256). Nếu ai
            sửa/xoá trực tiếp trên CSDL, dòng tiếp theo sẽ hiển thị "⛔ BỊ ĐỨT". Xem cột "Mã băm" để kiểm tra toàn vẹn.
          </>
        )}
      </div>

      {/* Bộ lọc */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Lọc theo người dùng..."
          value={actorFilter}
          onChange={(e) => setActorFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none"
        >
          <option value="ALL">Tất cả loại sự kiện</option>
          {actions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <div className="ml-auto text-xs text-slate-400 flex items-center">
          Từ ngày{' '}
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="mx-2 border border-slate-200 rounded px-2 py-1 text-slate-600"
          />
          đến{' '}
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="mx-2 border border-slate-200 rounded px-2 py-1 text-slate-600"
          />
        </div>
      </div>

      {/* Bảng nhật ký */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-medium">Thời gian</th>
              <th className="px-4 py-3 text-left font-medium">Người thực hiện</th>
              <th className="px-4 py-3 text-left font-medium">Loại sự kiện</th>
              <th className="px-4 py-3 text-left font-medium">Đối tượng</th>
              <th className="px-4 py-3 text-left font-medium">Chi tiết</th>
              <th className="px-4 py-3 text-left font-medium">Mã băm</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 font-mono">
            {filtered.map((log, i) => (
              <tr key={log.auditId} className={`hover:bg-slate-50 transition-colors ${!log.hashOk ? 'bg-red-50' : ''}`}>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{log.time}</td>
                <td className="px-4 py-3 text-slate-700 font-medium">{log.actor}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${ACTION_COLORS[log.action] || 'bg-slate-100 text-slate-600'}`}
                  >
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{log.target}</td>
                <td className="px-4 py-3 text-slate-500 max-w-xs" style={{ fontFamily: 'Inter, sans-serif' }}>
                  {log.detail}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">{log.hash}</span>
                    {log.hashOk ? (
                      <span className="text-green-600 text-[10px] font-bold">✔ Hợp lệ</span>
                    ) : (
                      <span className="text-red-600 text-[10px] font-bold">⛔ BỊ ĐỨT</span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-10 text-center text-slate-400 text-sm">Không có dòng log nào khớp bộ lọc</div>
        )}
      </div>
    </div>
  );
}
