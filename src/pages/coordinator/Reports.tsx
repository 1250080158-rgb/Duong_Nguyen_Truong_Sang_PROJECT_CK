import { useState } from 'react';
import { api, ApiError, fmtDate } from '../../api/client';
import type { ApiReportCalibration, ApiReportIncidents, ApiReportPm, ApiReportEvidence } from '../../api/types';

// =====================================================================
// Màn BÁO CÁO — GET /api/reports/{kind} với kind ∈ calibration |
// incidents | pm | evidence. Backend chưa chạy → thông báo rõ thay vì
// hiện số liệu giả (báo cáo dùng dữ liệu giả sẽ sai lệch hội đồng).
// =====================================================================

type ReportKind = 'calibration' | 'incidents' | 'pm' | 'evidence';

const REPORTS: { kind: ReportKind; title: string; desc: string; icon: string }[] = [
  {
    kind: 'calibration',
    title: 'Báo cáo hiệu chuẩn',
    desc: 'Danh sách thiết bị theo trạng thái hiệu chuẩn, lịch sử hiệu chuẩn toàn viện',
    icon: '📊',
  },
  {
    kind: 'incidents',
    title: 'Báo cáo sự cố',
    desc: 'Tổng hợp sự cố theo model thiết bị, xu hướng 12 tháng',
    icon: '⚠',
  },
  { kind: 'pm', title: 'Báo cáo PM', desc: 'Tỷ lệ hoàn thành PM đúng hạn, phân tích theo kỹ thuật viên', icon: '🔧' },
  {
    kind: 'evidence',
    title: 'Báo cáo bằng chứng',
    desc: 'Kiểm tra tính đầy đủ bằng chứng theo từng phiếu',
    icon: '🔒',
  },
];

export default function Reports() {
  const [active, setActive] = useState<ReportKind | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [calib, setCalib] = useState<ApiReportCalibration[] | null>(null);
  const [incidents, setIncidents] = useState<ApiReportIncidents | null>(null);
  const [pm, setPm] = useState<ApiReportPm[] | null>(null);
  const [evidence, setEvidence] = useState<ApiReportEvidence[] | null>(null);

  function load(kind: ReportKind) {
    setActive(kind);
    setLoading(true);
    setMessage(null);
    api(
      kind === 'calibration'
        ? '/reports/calibration'
        : kind === 'incidents'
          ? '/reports/incidents'
          : kind === 'pm'
            ? '/reports/pm'
            : '/reports/evidence',
    )
      .then((data: unknown) => {
        if (kind === 'calibration') setCalib(data as ApiReportCalibration[]);
        else if (kind === 'incidents') setIncidents(data as ApiReportIncidents);
        else if (kind === 'pm') setPm(data as ApiReportPm[]);
        else setEvidence(data as ApiReportEvidence[]);
      })
      .catch((err) => {
        const msg =
          err instanceof ApiError
            ? `[${err.code}] ${err.message}`
            : 'Không kết nối được máy chủ — báo cáo cần dữ liệu thật từ CSDL, không có chế độ dữ liệu mẫu.';
        setMessage(msg);
      })
      .finally(() => setLoading(false));
  }

  const maxTrend = incidents ? Math.max(...incidents.trend.map((t) => t.count), 1) : 1;

  return (
    <div className="p-6 space-y-5">
      <div>
        <h1 className="text-xl font-bold text-slate-800">Báo cáo</h1>
        <p className="text-sm text-slate-500 mt-0.5">Thống kê và xuất báo cáo thiết bị y tế</p>
      </div>

      {message && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-700 flex justify-between">
          <span>⚠ {message}</span>
          <button onClick={() => setMessage(null)} className="text-amber-500 hover:text-amber-700">
            ✕
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {REPORTS.map((r) => (
          <div
            key={r.kind}
            className={`bg-white border rounded-xl p-5 hover:shadow-md transition-shadow cursor-pointer ${active === r.kind ? 'border-blue-400 ring-1 ring-blue-200' : 'border-slate-200'}`}
            onClick={() => load(r.kind)}
          >
            <div className="text-3xl mb-3">{r.icon}</div>
            <h3 className="text-sm font-semibold text-slate-800 mb-1">{r.title}</h3>
            <p className="text-xs text-slate-500">{r.desc}</p>
            <button className="mt-4 px-3 py-1.5 border border-slate-200 text-slate-600 text-xs rounded-lg hover:bg-slate-50 transition-colors">
              {loading && active === r.kind ? 'Đang tạo…' : 'Tạo báo cáo'}
            </button>
          </div>
        ))}
      </div>

      {/* ===== Kết quả: Hiệu chuẩn ===== */}
      {active === 'calibration' && calib && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 text-sm font-semibold text-slate-700">
            Báo cáo hiệu chuẩn — {calib.length} thiết bị có mốc hiệu chuẩn
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left font-medium">Mã</th>
                <th className="px-4 py-2.5 text-left font-medium">Thiết bị</th>
                <th className="px-4 py-2.5 text-left font-medium">Khoa</th>
                <th className="px-4 py-2.5 text-left font-medium">Hạn HC</th>
                <th className="px-4 py-2.5 text-left font-medium">Còn lại</th>
                <th className="px-4 py-2.5 text-left font-medium">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {calib.map((r) => (
                <tr key={r.code} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{r.code}</td>
                  <td className="px-4 py-2.5 text-slate-700">{r.model}</td>
                  <td className="px-4 py-2.5 text-slate-500">{r.department}</td>
                  <td className="px-4 py-2.5 text-slate-600">{fmtDate(r.hanHieuChuan)}</td>
                  <td
                    className={`px-4 py-2.5 font-semibold ${r.daysLeft < 0 ? 'text-red-600' : r.daysLeft <= 30 ? 'text-yellow-600' : 'text-slate-600'}`}
                  >
                    {r.daysLeft < 0 ? `Quá hạn ${Math.abs(r.daysLeft)} ngày` : `${r.daysLeft} ngày`}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-slate-500">{r.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== Kết quả: Sự cố ===== */}
      {active === 'incidents' && incidents && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-3xl font-bold text-slate-800">{incidents.total}</div>
              <div className="text-xs text-slate-500 mt-1">Tổng số sự cố</div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="text-3xl font-bold text-orange-600">{incidents.open}</div>
              <div className="text-xs text-slate-500 mt-1">Chưa đóng</div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 text-sm font-semibold text-slate-700">
                Theo model
              </div>
              <table className="w-full text-sm">
                <tbody className="divide-y divide-slate-50">
                  {incidents.byModel.map((m) => (
                    <tr key={m.model}>
                      <td className="px-4 py-2.5 text-slate-700">{m.model}</td>
                      <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{m.count}</td>
                    </tr>
                  ))}
                  {incidents.byModel.length === 0 && (
                    <tr>
                      <td className="px-4 py-6 text-center text-slate-400 text-sm" colSpan={2}>
                        Không có dữ liệu
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-sm font-semibold text-slate-700 mb-3">Xu hướng theo tháng</div>
              <div className="flex items-end gap-1.5 h-28">
                {incidents.trend.map((t) => (
                  <div
                    key={t.month}
                    className="flex-1 flex flex-col items-center gap-1"
                    title={`${t.month}: ${t.count}`}
                  >
                    <div
                      className="w-full rounded-t-sm bg-blue-500"
                      style={{ height: `${(t.count / maxTrend) * 100}%`, minHeight: 3 }}
                    />
                    <span className="text-[8px] text-slate-400">{t.month.slice(5)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===== Kết quả: PM ===== */}
      {active === 'pm' && pm && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 text-sm font-semibold text-slate-700">
            Báo cáo PM theo kỹ thuật viên
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left font-medium">Kỹ thuật viên</th>
                <th className="px-4 py-2.5 text-left font-medium">Tổng phiếu</th>
                <th className="px-4 py-2.5 text-left font-medium">Hoàn thành</th>
                <th className="px-4 py-2.5 text-left font-medium">Đúng hạn</th>
                <th className="px-4 py-2.5 text-left font-medium">Tỷ lệ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {pm.map((r) => (
                <tr key={r.technician} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 text-slate-700">{r.technician}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.total}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.completed}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.onTime}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`font-semibold ${r.completed >= r.total && r.total > 0 ? 'text-green-600' : 'text-slate-600'}`}
                    >
                      {r.total > 0 ? Math.round((r.completed / r.total) * 100) : 0}%
                    </span>
                  </td>
                </tr>
              ))}
              {pm.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-slate-400 text-sm">
                    Chưa có phiếu PM nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ===== Kết quả: Bằng chứng ===== */}
      {active === 'evidence' && evidence && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 text-sm font-semibold text-slate-700">
            Đầy đủ bằng chứng theo phiếu
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-2.5 text-left font-medium">Mã phiếu</th>
                <th className="px-4 py-2.5 text-left font-medium">Loại</th>
                <th className="px-4 py-2.5 text-left font-medium">Bằng chứng bắt buộc</th>
                <th className="px-4 py-2.5 text-left font-medium">Đã nộp</th>
                <th className="px-4 py-2.5 text-left font-medium">Đủ?</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {evidence.map((r) => (
                <tr key={r.code} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-mono text-xs text-slate-700">{r.code}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.orderType}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.required}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.provided}</td>
                  <td className="px-4 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${r.complete ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
                    >
                      {r.complete ? '✓ Đủ' : '⛔ Thiếu'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
