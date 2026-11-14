import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { api, ApiError, WORK_ORDER_TYPE_LABELS } from '../../api/client';
import type { ApiOrderDetail } from '../../api/types';

// =====================================================================
// Màn THỰC HIỆN PHIẾU (KTV) — nhận mã phiếu từ route
// /technician/work-order/:code (bấm từ "Việc của tôi"). Có mã → GET
// /api/work-orders/{code} nạp checklist + bằng chứng thật; không có mã
// hoặc backend chưa chạy → demo offline với bộ bước mẫu HC-2026-0087.
//  • Giá trị đo lưu vào bước; server tự tính ĐẠT/KHÔNG ĐẠT (BR-03).
//  • Bằng chứng upload thật POST /evidence (multipart, magic bytes).
//  • Hoàn thành POST /complete — server kiểm tra lại BR-02 trong
//    transaction, nút khóa khi chưa đủ bước/bằng chứng.
// Autosave nháp vào localStorage theo mã phiếu.
// =====================================================================

const DEMO_CODE = '#HC-2026-0087';

interface StepCalibration {
  standard: number;
  tolerance: number;
  unit: string;
  measured: number | null;
  result: 'DAT' | 'KHONG_DAT' | null;
}

interface Step {
  id: number;
  label: string;
  requiresPhoto?: boolean;
  done: boolean;
  photoUploaded?: boolean;
  skipReason?: string;
  note?: string;
  calibration?: StepCalibration;
}

interface EvidenceItem {
  id: number;
  label: string;
  code: string; // evidence_code khớp required_evidence_config
  kind: 'photo' | 'pdf';
  uploaded: boolean;
  tenTep?: string;
  file?: File | null;
}

const INITIAL_STEPS: Step[] = [
  { id: 1, label: 'Vệ sinh buồng phản ứng', requiresPhoto: true, done: true, photoUploaded: true },
  {
    id: 2,
    label: 'Chuẩn 5.0 mmol/L',
    done: true,
    calibration: { standard: 5.0, tolerance: 2.5, unit: 'mmol/L', measured: 5.04, result: 'DAT' },
  },
  {
    id: 3,
    label: 'Chuẩn 12.0 mmol/L',
    done: false,
    calibration: { standard: 12.0, tolerance: 2.5, unit: 'mmol/L', measured: null, result: null },
  },
  { id: 4, label: 'Thử nghiệm an toàn (IEC 60601)', requiresPhoto: true, done: false },
  { id: 5, label: 'Dán tem hiệu chuẩn mới', requiresPhoto: true, done: false },
];

const INITIAL_EVIDENCE: EvidenceItem[] = [
  { id: 1, label: 'Ảnh tem hiệu chuẩn mới', code: 'ANH_TEM', kind: 'photo', uploaded: false },
  { id: 2, label: 'Chứng chỉ hiệu chuẩn PDF', code: 'CHUNG_CHI_PDF', kind: 'pdf', uploaded: false },
  {
    id: 3,
    label: 'Ảnh trước khi thực hiện',
    code: 'ANH_TRUOC',
    kind: 'photo',
    uploaded: true,
    tenTep: 'truoc_hc.jpg',
  },
  {
    id: 4,
    label: 'Ảnh kết quả chuẩn hóa',
    code: 'ANH_KET_QUA',
    kind: 'photo',
    uploaded: true,
    tenTep: 'ketqua_hc.jpg',
  },
];

function deviationPct(standard: number, measured: number): number {
  return (Math.abs(measured - standard) / standard) * 100;
}

function loadDraft(orderCode: string): Step[] | null {
  try {
    const saved = localStorage.getItem(`medequip_draft_${orderCode}`);
    return saved ? (JSON.parse(saved).steps as Step[]) : null;
  } catch {
    return null;
  }
}

function stepsFromApi(detail: ApiOrderDetail): Step[] {
  return detail.steps.map((s) => ({
    id: s.thuTu,
    label: s.tieuDe,
    requiresPhoto: s.requirePhoto,
    done: s.hoanThanh,
    photoUploaded: s.hoanThanh && s.requirePhoto,
    skipReason: s.lyDoBo ?? undefined,
    note: s.note ?? undefined,
    calibration:
      s.giaTriChuan !== null
        ? {
            standard: s.giaTriChuan,
            tolerance: s.dungSaiPhanTram ?? 100,
            unit: '',
            measured: s.giaTriDo,
            result: s.result,
          }
        : undefined,
  }));
}

function evidenceFromApi(detail: ApiOrderDetail): EvidenceItem[] {
  return detail.requiredEvidence.map((e, i) => ({
    id: i + 1,
    label: e.label,
    code: e.evidenceType,
    kind: e.evidenceType.includes('PDF') ? 'pdf' : 'photo',
    uploaded: e.provided,
    tenTep: e.files[0]?.tenTep,
  }));
}

export default function WorkOrderExecution() {
  const params = useParams();
  const ORDER_CODE = params.code ? `#${params.code}` : DEMO_CODE;
  const DRAFT_KEY = `medequip_draft_${ORDER_CODE}`;

  const [steps, setSteps] = useState<Step[]>(() => loadDraft(ORDER_CODE) ?? INITIAL_STEPS);
  const [evidence, setEvidence] = useState<EvidenceItem[]>(INITIAL_EVIDENCE);
  const [header, setHeader] = useState<{ name: string; serial: string; department: string; type: string } | null>(null);
  const [serverBlockers, setServerBlockers] = useState<string[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; title: string; detail?: string } | null>(null);
  const [online, setOnline] = useState(false); // backend có chạy?
  const fileInputs = useRef<Record<number, HTMLInputElement | null>>({});

  // Nạp phiếu từ API khi có mã; thành công → dữ liệu thật, thất bại mạng → offline
  useEffect(() => {
    let cancelled = false;
    api<ApiOrderDetail>(`/work-orders/${ORDER_CODE.replace('#', '')}`)
      .then((d) => {
        if (cancelled) return;
        setOnline(true);
        setHeader({
          name: d.equipment.name,
          serial: d.equipment.serial,
          department: d.department,
          type: WORK_ORDER_TYPE_LABELS[d.type] ?? 'Phiếu công tác',
        });
        const apiSteps = stepsFromApi(d);
        if (apiSteps.length > 0) setSteps(apiSteps);
        if (d.requiredEvidence.length > 0) setEvidence(evidenceFromApi(d));
        setServerBlockers(d.blockingReasons ?? []);
      })
      .catch((err) => {
        if (!cancelled && err instanceof ApiError) {
          setResult({ ok: false, title: 'Không mở được phiếu', detail: err.message });
        }
        // lỗi mạng → giữ demo offline
      });
    return () => {
      cancelled = true;
    };
  }, [ORDER_CODE]);

  // Autosave nháp mỗi khi steps đổi
  useEffect(() => {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ steps, savedAt: new Date().toISOString() }));
    const t = setTimeout(() => setSavedAt(new Date().toLocaleTimeString('vi-VN')), 400);
    return () => clearTimeout(t);
  }, [steps, DRAFT_KEY]);

  function updateStep(id: number, patch: Partial<Step>) {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    // Khi backend chạy: PATCH /work-orders/{code}/steps/{ordinal}
    const step = steps.find((s) => s.id === id);
    if (step && online) {
      api(`/work-orders/${ORDER_CODE.replace('#', '')}/steps/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          done: patch.done ?? step.done,
          measuredValue: patch.calibration?.measured ?? step.calibration?.measured ?? null,
          note: patch.note ?? step.note ?? null,
          skipReason: patch.skipReason ?? step.skipReason ?? null,
        }),
      }).catch(() => {
        /* offline nháp vẫn lưu localStorage */
      });
    }
  }

  function setMeasured(id: number, raw: string) {
    const val = raw === '' ? null : Number(raw);
    setSteps((prev) =>
      prev.map((s) => {
        if (s.id !== id || !s.calibration) return s;
        if (val === null) return { ...s, calibration: { ...s.calibration, measured: null, result: null } };
        // Server là người tuyên bố ĐẠT/KHÔNG ĐẠT — offline UI preview cùng công thức
        const dev = deviationPct(s.calibration.standard, val);
        const result = dev <= s.calibration.tolerance ? 'DAT' : 'KHONG_DAT';
        return { ...s, calibration: { ...s.calibration, measured: val, result } };
      }),
    );
  }

  function toggleCheck(id: number) {
    const step = steps.find((s) => s.id === id)!;
    const next = !step.done;
    if (next && step.calibration && step.calibration.measured === null && !step.skipReason) {
      setResult({
        ok: false,
        title: 'Cần nhập giá trị đo',
        detail: `Bước ${id} là bước đo hiệu chuẩn — hãy nhập "Đo được" trước khi đánh dấu hoàn thành.`,
      });
      return;
    }
    updateStep(id, { done: next });
  }

  function skipStep(id: number) {
    const reason = window.prompt('Lý do bỏ bước này (bắt buộc, sẽ lưu vào phiếu):');
    if (!reason) return;
    updateStep(id, { done: false, skipReason: reason });
  }

  async function uploadEvidence(item: EvidenceItem, file: File) {
    setEvidence((prev) =>
      prev.map((e) => (e.id === item.id ? { ...e, uploaded: true, fileName: file.name, file } : e)),
    );
    if (online) {
      const form = new FormData();
      form.append('file', file);
      form.append('evidenceCode', item.code);
      try {
        await api(`/work-orders/${ORDER_CODE.replace('#', '')}/evidence`, { method: 'POST', body: form });
      } catch (err) {
        if (err instanceof ApiError) {
          setEvidence((prev) => prev.map((e) => (e.id === item.id ? { ...e, uploaded: false } : e)));
          setResult({ ok: false, title: 'Từ chối file', detail: err.message });
        }
      }
    }
  }

  const doneCount = steps.filter((s) => s.done || s.skipReason).length;
  const evidenceCount = evidence.filter((e) => e.uploaded).length;
  const canComplete = doneCount === steps.length && evidenceCount === evidence.length;
  const hasFail = steps.some((s) => s.calibration?.result === 'KHONG_DAT');

  async function complete() {
    // Luôn để server quyết định (tầng 2 của BR-02); offline mới kiểm tra cục bộ.
    if (online) {
      try {
        await api(`/work-orders/${ORDER_CODE.replace('#', '')}/complete`, { method: 'POST' });
        setResult({
          ok: true,
          title: 'Hoàn thành phiếu',
          detail: 'Phiếu chuyển sang CHỜ NGHIỆM THU — điều phối sẽ duyệt. Thiết bị chỉ mở khóa sau nghiệm thu.',
        });
      } catch (err) {
        setResult({
          ok: false,
          title: 'Không thể hoàn thành',
          detail: err instanceof ApiError ? `${err.code}: ${err.message}` : 'Lỗi không xác định.',
        });
      }
      return;
    }
    setResult({
      ok: true,
      title: 'Hoàn thành (chế độ dữ liệu mẫu)',
      detail: hasFail
        ? 'Có bước đo KHÔNG ĐẠT — khi backend chạy, nghiệm thu sẽ TỪ CHỐI mở khóa thiết bị (BR-03).'
        : 'Khi backend chạy, phiếu sẽ chuyển CHỜ NGHIỆM THU và chờ điều phối duyệt.',
    });
  }

  return (
    <div className="p-4 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="bg-slate-800 rounded-2xl p-4 text-white">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs text-slate-400 font-mono">{ORDER_CODE}</span>
          <span
            className={`px-2 py-0.5 text-[11px] font-bold rounded-lg ${online ? 'bg-blue-500' : 'bg-slate-500'} text-white`}
          >
            {online ? 'ĐANG LÀM · ĐÃ KẾT NỐI MÁY CHỦ' : 'ĐANG LÀM · CHƯA KẾT NỐI'}
          </span>
        </div>
        <h1 className="text-lg font-bold">{header?.type ?? 'Phiếu Hiệu Chuẩn'}</h1>
        <p className="text-sm text-slate-300 mt-1">
          {header
            ? `${header.name} · ${header.serial} · Khoa ${header.department}`
            : 'Máy sinh phẩm BS-240 · SN-12346 · Khoa Hóa sinh'}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-slate-600 rounded-full">
            <div
              className="h-full bg-blue-400 rounded-full transition-all"
              style={{ width: `${steps.length ? (doneCount / steps.length) * 100 : 0}%` }}
            />
          </div>
          <span className="text-xs text-slate-400">
            {doneCount}/{steps.length}
          </span>
        </div>
      </div>

      {serverBlockers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-xs text-amber-700">
          ⚠ Phiếu còn thiếu: {serverBlockers.join(', ')} — hoàn thành chỉ mở khi đã đủ.
        </div>
      )}

      {hasFail && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-xs text-red-700">
          ⚠ Có bước đo <strong>KHÔNG ĐẠT</strong>. Phiếu vẫn gửi được nhưng nghiệm thu sẽ
          <strong> không mở khóa thiết bị</strong> — phải ghi hành động khắc phục.
        </div>
      )}

      {/* Checklist */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">
            CHECKLIST ({doneCount}/{steps.length})
          </span>
          {savedAt && <span className="text-[10px] text-slate-400">Nháp: {savedAt}</span>}
        </div>
        <div className="divide-y divide-slate-50">
          {steps.map((item, i) => {
            const cal = item.calibration;
            const dev =
              cal?.measured !== null && cal?.measured !== undefined && cal
                ? deviationPct(cal.standard, cal.measured)
                : null;
            return (
              <div key={item.id} className={`px-4 py-3 ${i === 2 && !item.done ? 'bg-blue-50/50' : ''}`}>
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => toggleCheck(item.id)}
                    className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                      item.done ? 'bg-blue-600 border-blue-600' : 'border-slate-300 hover:border-blue-400'
                    }`}
                  >
                    {item.done && <span className="text-white text-[10px] font-bold">✓</span>}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div
                      className={`text-sm font-medium ${item.done ? 'text-slate-400 line-through' : 'text-slate-800'} flex items-center gap-2`}
                    >
                      <span>
                        {i + 1}. {item.label}
                      </span>
                      {item.skipReason && (
                        <span className="text-[10px] text-amber-600 font-semibold no-underline">
                          ⚠ đã bỏ: {item.skipReason}
                        </span>
                      )}
                    </div>

                    {/* Form đo hiệu chuẩn */}
                    {cal && (
                      <div className="mt-2 bg-slate-50 rounded-xl p-3">
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div>
                            <div className="text-slate-400 mb-1">Chuẩn</div>
                            <div className="font-mono font-bold text-slate-700">
                              {cal.standard}
                              {cal.unit ? ` ${cal.unit}` : ''}
                            </div>
                          </div>
                          <div>
                            <div className="text-slate-400 mb-1">Đo được</div>
                            {cal.measured !== null ? (
                              <div className="font-mono font-bold text-slate-700">{cal.measured}</div>
                            ) : (
                              <input
                                type="number"
                                step="0.01"
                                value={cal.measured ?? ''}
                                onChange={(e) => setMeasured(item.id, e.target.value)}
                                placeholder="____"
                                className="w-full border border-slate-300 rounded-lg px-2 py-1 font-mono text-center focus:outline-none focus:ring-2 focus:ring-blue-400"
                              />
                            )}
                          </div>
                          <div>
                            <div className="text-slate-400 mb-1">Sai số</div>
                            {dev !== null ? (
                              <div>
                                <div className="font-mono font-bold text-slate-700">{dev.toFixed(1)}%</div>
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                    cal.result === 'DAT' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                  }`}
                                >
                                  {cal.result === 'DAT' ? 'ĐẠT' : 'KHÔNG ĐẠT'}
                                </span>
                              </div>
                            ) : (
                              <div className="text-slate-300 text-center">—</div>
                            )}
                          </div>
                        </div>
                        <div className="mt-1 text-[10px] text-slate-400">Dung sai cho phép: ±{cal.tolerance}%</div>
                      </div>
                    )}

                    {cal?.result === 'KHONG_DAT' && !item.note && (
                      <input
                        type="text"
                        placeholder="Hành động khắc phục (bắt buộc với bước KHÔNG ĐẠT)..."
                        value={item.note ?? ''}
                        onChange={(e) => updateStep(item.id, { note: e.target.value })}
                        className="mt-2 w-full border border-red-200 bg-red-50/50 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-red-300"
                      />
                    )}

                    {/* Ảnh bằng chứng theo bước */}
                    {item.requiresPhoto && !item.done && (
                      <button
                        onClick={() => fileInputs.current[item.id]?.click()}
                        className="mt-2 flex items-center gap-1.5 text-xs text-blue-600 border border-blue-200 bg-blue-50 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition-colors"
                      >
                        📷 Chụp ảnh bằng chứng
                      </button>
                    )}
                    {item.requiresPhoto && item.photoUploaded && (
                      <div className="mt-1 text-[11px] text-green-600 flex items-center gap-1">✓ Ảnh đã nộp</div>
                    )}
                    <input
                      ref={(el) => {
                        fileInputs.current[item.id] = el;
                      }}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) updateStep(item.id, { photoUploaded: true });
                        e.target.value = '';
                      }}
                    />
                    {!item.done && !item.skipReason && (
                      <button
                        onClick={() => skipStep(item.id)}
                        className="mt-1 text-[10px] text-slate-400 hover:text-slate-600 underline"
                      >
                        Bỏ bước (cần lý do)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Evidence */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-700">
            BẰNG CHỨNG BẮT BUỘC ({evidenceCount}/{evidence.length})
          </span>
          {evidenceCount < evidence.length && <span className="text-[11px] text-yellow-600 font-bold">⚠ Chưa đủ</span>}
        </div>
        <div className="divide-y divide-slate-50">
          {evidence.map((e) => (
            <div key={e.id} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`w-2 h-2 rounded-full ${e.uploaded ? 'bg-green-500' : 'bg-slate-300'}`} />
                <div>
                  <div className="text-sm text-slate-700">
                    {e.kind === 'photo' ? '📷' : '📄'} {e.label}
                  </div>
                  {!e.uploaded && <div className="text-[11px] text-red-500">Chưa có</div>}
                  {e.uploaded && (
                    <div className="text-[11px] text-green-600">✓ Đã nộp{e.tenTep && ` · ${e.tenTep}`}</div>
                  )}
                </div>
              </div>
              {!e.uploaded && (
                <button
                  onClick={() => fileInputs.current[100 + e.id]?.click()}
                  className="text-xs text-blue-600 border border-blue-200 bg-blue-50 px-3 py-1.5 rounded-xl hover:bg-blue-100 transition-colors"
                >
                  {e.kind === 'photo' ? '📷 Chụp' : '📄 Tải lên'}
                </button>
              )}
              <input
                ref={(el) => {
                  fileInputs.current[100 + e.id] = el;
                }}
                type="file"
                accept={e.kind === 'photo' ? 'image/*' : 'application/pdf'}
                capture={e.kind === 'photo' ? 'environment' : undefined}
                className="hidden"
                onChange={(ev) => {
                  const f = ev.target.files?.[0];
                  if (f) void uploadEvidence(e, f);
                  ev.target.value = '';
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pb-4">
        <button
          onClick={() => setSavedAt(new Date().toLocaleTimeString('vi-VN'))}
          className="flex-1 px-4 py-3.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-2xl hover:bg-slate-50 transition-colors"
        >
          {savedAt ? `✓ Đã lưu nháp ${savedAt}` : 'Lưu nháp'}
        </button>
        <button
          disabled={!canComplete}
          onClick={() => void complete()}
          className={`flex-1 px-4 py-3.5 text-sm font-bold rounded-2xl transition-all ${
            canComplete
              ? 'bg-green-600 text-white hover:bg-green-700 shadow-lg shadow-green-200'
              : 'bg-slate-100 text-slate-400 cursor-not-allowed'
          }`}
        >
          {canComplete ? '✓ HOÀN THÀNH' : `🔒 HOÀN THÀNH (${evidenceCount}/${evidence.length} bằng chứng)`}
        </button>
      </div>

      {/* Kết quả hoàn thành / lỗi */}
      {result && (
        <div
          className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4`}
          onClick={() => setResult(null)}
        >
          <div
            className={`rounded-2xl shadow-2xl max-w-sm w-full p-5 ${result.ok ? 'bg-white' : 'bg-white'}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`text-2xl mb-2 ${result.ok ? '' : ''}`}>{result.ok ? '✅' : '⛔'}</div>
            <h3 className={`font-bold text-base ${result.ok ? 'text-green-700' : 'text-red-700'}`}>{result.title}</h3>
            {result.detail && <p className="text-sm text-slate-600 mt-2">{result.detail}</p>}
            <button
              onClick={() => setResult(null)}
              className={`mt-4 w-full py-2.5 rounded-xl text-sm font-semibold text-white ${result.ok ? 'bg-green-600' : 'bg-slate-700'}`}
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
