import { useEffect, useState } from 'react';
import { api, apiOr, ApiError } from '../../api/client';
import type { ApiEvidenceConfig, ApiSystemConfig } from '../../api/types';

// =====================================================================
// Màn CẤU HÌNH HỆ THỐNG (admin) — GET /api/config; Lưu → PUT
// /api/config/{key} cho từng key đã sửa (mỗi lần PUT đều ghi audit
// CONFIG_UPDATE ở backend). Offline: bộ cấu hình khớp DbSeeder.
// =====================================================================

const MOCK_CONFIGS: ApiSystemConfig[] = [
  {
    configKey: 'warning_days_early',
    configValue: '30',
    description: 'Cảnh báo sớm (badge vàng) trước khi hết hạn hiệu chuẩn',
  },
  { configKey: 'warning_days_urgent', configValue: '7', description: 'Cảnh báo gấp (badge đỏ nhấp nháy)' },
  { configKey: 'warning_days_critical', configValue: '1', description: 'Cảnh báo khẩn cấp (push email)' },
  {
    configKey: 'auto_lock_on_expiry',
    configValue: 'true',
    description: 'Tự động khóa thiết bị khi hết hạn hiệu chuẩn',
  },
  {
    configKey: 'evidence_immutable_after_complete',
    configValue: 'true',
    description: 'Bằng chứng không sửa/xóa sau khi phiếu hoàn thành',
  },
];

export default function SystemConfig() {
  const [configs, setConfigs] = useState<ApiSystemConfig[]>(MOCK_CONFIGS);
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(MOCK_CONFIGS.map((c) => [c.configKey, c.configValue])),
  );
  const [changed, setChanged] = useState<Set<string>>(new Set());
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void apiOr<ApiSystemConfig[]>('/config', () => MOCK_CONFIGS)
      .then((list) => {
        if (list.length > 0) {
          setConfigs(list);
          setValues(Object.fromEntries(list.map((c) => [c.configKey, c.configValue])));
        }
      })
      .catch(() => {
        /* giữ mock */
      });
  }, []);

  function edit(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setChanged((prev) => new Set(prev).add(key));
    setSaved(false);
  }

  function save() {
    setSaving(true);
    setError(null);
    const keys = [...changed];
    void Promise.all(
      keys.map((key) => api(`/config/${key}`, { method: 'PUT', body: JSON.stringify({ value: values[key] }) })),
    )
      .then(() => {
        setConfigs((list) => list.map((c) => ({ ...c, configValue: values[c.configKey] })));
        setChanged(new Set());
        setSaved(true);
        setTimeout(() => setSaved(false), 4000);
      })
      .catch((err) => {
        setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : 'Không lưu được — backend chưa chạy.');
      })
      .finally(() => setSaving(false));
  }

  return (
    <div className="p-6 space-y-5 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Cấu hình hệ thống</h1>
        <p className="text-sm text-slate-500 mt-0.5">Mọi thay đổi sẽ được ghi vào Nhật ký kiểm toán</p>
      </div>

      {saved && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700 font-medium">
          ✓ Cấu hình đã lưu và ghi vào Nhật ký kiểm toán
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700 flex justify-between">
          <span>⛔ {error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            ✕
          </button>
        </div>
      )}

      {/* Danh sách cấu hình */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
          <div className="text-sm font-semibold text-slate-700">Tham số hệ thống</div>
          <div className="text-xs text-slate-400 mt-0.5">Sửa giá trị rồi bấm "Lưu cấu hình" ở cuối trang</div>
        </div>
        <div className="divide-y divide-slate-50">
          {configs.map((c) => (
            <div key={c.configKey} className="px-5 py-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-sm font-medium text-slate-700">
                  {c.description || c.configKey}
                  {changed.has(c.configKey) && (
                    <span className="ml-2 text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                      CHƯA LƯU
                    </span>
                  )}
                </div>
                <div className="text-[11px] font-mono text-slate-400 mt-0.5">{c.configKey}</div>
              </div>
              <input
                type="text"
                value={values[c.configKey] ?? ''}
                onChange={(e) => edit(c.configKey, e.target.value)}
                className="w-28 border border-slate-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Quy tắc bằng chứng (đọc từ required_evidence_config — hiển thị) */}
      <EvidenceRules />

      <button
        onClick={save}
        disabled={saving || changed.size === 0}
        className={`px-6 py-3 text-sm font-semibold rounded-xl transition-colors ${
          saving || changed.size === 0
            ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
            : 'bg-blue-600 text-white hover:bg-blue-700'
        }`}
      >
        {saving ? 'Đang lưu…' : changed.size > 0 ? `Lưu cấu hình (${changed.size} thay đổi)` : 'Lưu cấu hình'}
      </button>
    </div>
  );
}

function EvidenceRules() {
  const [rules, setRules] = useState<ApiEvidenceConfig[] | null>(null);

  useEffect(() => {
    // Hợp đồng thật của API: mã bằng chứng nằm ở field `maBangChung`
    // (xem ApiEvidenceConfig trong src/api/types.ts).
    void apiOr<ApiEvidenceConfig[]>('/catalog/evidence-config', () => [])
      .then((list) => {
        if (list.length > 0) setRules(list);
      })
      .catch(() => {
        /* fallback tĩnh bên dưới */
      });
  }, []);

  const grouped = new Map<string, { label: string; isRequired: boolean }[]>();
  if (rules) {
    for (const r of rules) {
      const arr = grouped.get(r.orderType) ?? [];
      arr.push({ label: r.label, isRequired: r.isRequired });
      grouped.set(r.orderType, arr);
    }
  }

  const STATIC = [
    {
      type: 'HC – Hiệu chuẩn',
      color: 'text-purple-600 bg-purple-50',
      evidence: [
        'Chứng chỉ hiệu chuẩn PDF',
        'Ảnh tem hiệu chuẩn mới',
        'Ảnh trước khi thực hiện',
        'Ảnh kết quả chuẩn hóa',
      ],
    },
    {
      type: 'SC – Sửa chữa',
      color: 'text-orange-600 bg-orange-50',
      evidence: ['Ảnh trước sửa chữa', 'Ảnh sau sửa chữa', 'Biên bản linh kiện thay thế'],
    },
    {
      type: 'PM – Bảo trì định kỳ',
      color: 'text-blue-600 bg-blue-50',
      evidence: ['Ảnh từng nhóm bước', 'Checklist hoàn thành 100%'],
    },
  ];
  const TYPE_LABEL: Record<string, string> = {
    HC: 'HC – Hiệu chuẩn',
    SC: 'SC – Sửa chữa',
    PM: 'PM – Bảo trì định kỳ',
    KT: 'KT – Kiểm định',
  };
  const TYPE_COLOR: Record<string, string> = {
    HC: 'text-purple-600 bg-purple-50',
    SC: 'text-orange-600 bg-orange-50',
    PM: 'text-blue-600 bg-blue-50',
    KT: 'text-teal-600 bg-teal-50',
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
        <div className="text-sm font-semibold text-slate-700">Quy tắc bằng chứng bắt buộc theo loại phiếu</div>
      </div>
      <div className="divide-y divide-slate-50">
        {rules
          ? [...grouped.entries()].map(([type, items]) => (
              <div key={type} className="px-4 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-xs font-bold px-2 py-0.5 rounded ${TYPE_COLOR[type] ?? 'text-slate-600 bg-slate-50'}`}
                  >
                    {TYPE_LABEL[type] ?? type}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {items.map((e, i) => (
                    <span
                      key={i}
                      className={`text-xs px-2 py-1 rounded-lg flex items-center gap-1 ${e.isRequired ? 'bg-slate-100 text-slate-600' : 'bg-slate-50 text-slate-400 border border-dashed border-slate-200'}`}
                    >
                      <span className={e.isRequired ? 'text-green-500' : 'text-slate-300'}>
                        {e.isRequired ? '✓' : '○'}
                      </span>{' '}
                      {e.label}
                    </span>
                  ))}
                </div>
              </div>
            ))
          : STATIC.map((rule) => (
              <div key={rule.type} className="px-4 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${rule.color}`}>{rule.type}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {rule.evidence.map((e, i) => (
                    <span
                      key={i}
                      className="text-xs bg-slate-100 text-slate-600 px-2 py-1 rounded-lg flex items-center gap-1"
                    >
                      <span className="text-green-500">✓</span> {e}
                    </span>
                  ))}
                </div>
              </div>
            ))}
      </div>
    </div>
  );
}
