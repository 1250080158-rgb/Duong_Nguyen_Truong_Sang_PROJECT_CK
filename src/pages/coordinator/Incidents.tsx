import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, fmtDateTime } from '../../api/client';

// =====================================================================
// Màn SỰ CỐ (điều phối):
//  • Hàng đợi sự cố: GET /api/incidents
//  • Tiếp nhận:      POST /api/incidents/{id}/ack
//  • Tạo phiếu SC:   POST /api/incidents/{id}/create-order
//
// Màn này giải quyết việc đầu mối khoa báo hỏng xong không ai thấy:
// trước đây sự cố chỉ có đường ghi (POST) mà không có đường đọc, nên
// không tồn tại chỗ nào để điều phối xem và xử lý.
// =====================================================================

interface IncidentItem {
  id: number;
  code: string;
  status: string;
  severity: string;
  description: string;
  photoCount: number;
  createdAt: string;
  closedAt: string | null;
  resolution: string | null;
  workOrderId: number | null;
  equipment: {
    id: number;
    code: string;
    name: string;
    status: string;
    department: string;
  };
  reportedBy: string;
}

const STATUS_LABELS: Record<string, string> = {
  MOI: 'Chờ tiếp nhận',
  DA_TIEP_NHAN: 'Đã tiếp nhận',
  DA_TAO_PHIEU: 'Đã tạo phiếu',
  DONG: 'Đã đóng',
};

const STATUS_STYLES: Record<string, string> = {
  MOI: 'bg-red-100 text-red-700',
  DA_TIEP_NHAN: 'bg-amber-100 text-amber-700',
  DA_TAO_PHIEU: 'bg-blue-100 text-blue-700',
  DONG: 'bg-slate-100 text-slate-600',
};

const SEVERITY_LABELS: Record<string, string> = {
  KHAN: 'Khẩn cấp',
  SO_BO: 'Sơ bộ',
};

export default function Incidents() {
  const [items, setItems] = useState<IncidentItem[] | null>(null);
  const [filter, setFilter] = useState<'MOI' | 'DA_TIEP_NHAN' | 'ALL'>('MOI');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api<IncidentItem[]>('/incidents'));
    } catch (err) {
      setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : 'Không tải được danh sách sự cố.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: number, path: string, body?: unknown) {
    setBusyId(id);
    setError(null);
    try {
      const res = await api<{ code?: string; orderId?: number; incidentCode?: string }>(`/incidents/${id}/${path}`, {
        method: 'POST',
        body: body ? JSON.stringify(body) : undefined,
      });
      if (path === 'ack') {
        setNotice(`Đã tiếp nhận sự cố ${res.code}. Hãy tạo phiếu sửa chữa khi đã điều tra xong.`);
      } else {
        setNotice(`Đã tạo phiếu sửa chữa cho sự cố ${res.incidentCode}. Đầu mối khoa đã nhận được thông báo.`);
      }
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : 'Thao tác thất bại.');
    } finally {
      setBusyId(null);
    }
  }

  const all = items ?? [];
  const shown = all.filter((i) => (filter === 'ALL' ? true : i.status === filter));
  const counts = {
    MOI: all.filter((i) => i.status === 'MOI').length,
    DA_TIEP_NHAN: all.filter((i) => i.status === 'DA_TIEP_NHAN').length,
    ALL: all.length,
  };

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Sự cố thiết bị</h1>
        <p className="text-sm text-slate-500 mt-0.5">
          Sự cố do đầu mối khoa báo. Tiếp nhận và sinh phiếu sửa chữa tại đây.
        </p>
      </div>

      {notice && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium flex items-start justify-between gap-2">
          <span>✓ {notice}</span>
          <button onClick={() => setNotice(null)} className="text-green-500 hover:text-green-700">
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

      <div className="flex gap-2">
        {(
          [
            ['MOI', 'Chờ tiếp nhận'],
            ['DA_TIEP_NHAN', 'Đã tiếp nhận'],
            ['ALL', 'Tất cả'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filter === key
                ? 'bg-slate-800 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label} ({counts[key]})
          </button>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        {shown.map((inc) => (
          <div key={inc.id} className="px-4 py-4 border-b border-slate-50 hover:bg-slate-50 transition-colors">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="font-mono text-sm text-slate-700 font-semibold">{inc.code}</span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      inc.severity === 'KHAN' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {SEVERITY_LABELS[inc.severity] ?? inc.severity}
                  </span>
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      STATUS_STYLES[inc.status] ?? 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {STATUS_LABELS[inc.status] ?? inc.status}
                  </span>
                </div>
                <div className="text-sm text-slate-800 font-medium">
                  {inc.equipment.name}{' '}
                  <span className="text-slate-400 font-normal">
                    · {inc.equipment.code} · {inc.equipment.department}
                  </span>
                </div>
                <div className="text-sm text-slate-700 mt-1">{inc.description}</div>
                <div className="text-xs text-slate-500 mt-1">
                  Người báo: {inc.reportedBy} · Thời điểm: {fmtDateTime(inc.createdAt)}
                  {inc.photoCount > 0 && ` · ${inc.photoCount} ảnh`}
                </div>
              </div>

              <div className="flex flex-col gap-2 shrink-0">
                {inc.status === 'MOI' && (
                  <button
                    onClick={() => void act(inc.id, 'ack')}
                    disabled={busyId === inc.id}
                    className="px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition-colors disabled:opacity-50"
                  >
                    Tiếp nhận
                  </button>
                )}
                {(inc.status === 'MOI' || inc.status === 'DA_TIEP_NHAN') && (
                  <button
                    onClick={() => void act(inc.id, 'create-order', { assigneeId: null })}
                    disabled={busyId === inc.id}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    Tạo phiếu sửa chữa
                  </button>
                )}
                {inc.status === 'DA_TAO_PHIEU' && inc.workOrderId && (
                  <div className="text-xs text-slate-500 text-right">Đã có phiếu #{inc.workOrderId}</div>
                )}
                {inc.status === 'DONG' && (
                  <div className="text-xs text-slate-500 text-right">Đóng {fmtDateTime(inc.closedAt)}</div>
                )}
              </div>
            </div>
          </div>
        ))}
        {shown.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-sm">
            {items === null ? 'Đang tải…' : 'Không có sự cố nào ở trạng thái này'}
          </div>
        )}
      </div>
    </div>
  );
}
