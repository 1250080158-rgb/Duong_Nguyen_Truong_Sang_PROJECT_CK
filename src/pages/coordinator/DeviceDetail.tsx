import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router';
import { devices } from '../../data/mockData';
import StatusBadge from '../../components/StatusBadge';
import { api, ApiError, apiOr, fmtDate } from '../../api/client';
import { parseEquipmentId, useDevices } from '../../api/hooks';
import type { ApiDeviceDetail } from '../../api/types';

// =====================================================================
// Màn CHI TIẾT THIẾT BỊ — GET /api/devices/{code}: thông số + timeline
// gộp (đổi trạng thái / phiếu công tác / sự cố). Offline: mock.
// =====================================================================

const TIMELINE = [
  {
    date: '01/08/2026',
    event: 'Hết hạn hiệu chuẩn – tự động khóa',
    icon: '🔒',
    bg: 'bg-red-100',
    detail: 'Hệ thống tự động khóa. Trạng thái: HOAT_DONG → CHO_HIEU_CHUAN',
    evidence: 'log',
  },
  {
    date: '12/02/2026',
    event: 'Hiệu chuẩn định kỳ – ĐẠT',
    icon: '📋',
    bg: 'bg-purple-100',
    detail: 'KTV: Nguyễn Minh VT. Sai số tối đa: 0.8%. Kết luận: ĐẠT',
    evidence: 'Chứng chỉ #VC-2026-0112',
  },
  {
    date: '05/01/2026',
    event: 'PM định kỳ – hoàn thành',
    icon: '🔧',
    bg: 'bg-blue-100',
    detail: 'KTV: Trần Văn Hùng. 5/5 bước hoàn thành. 3 ảnh đính kèm',
    evidence: '3 ảnh',
  },
  {
    date: '20/09/2025',
    event: 'Sự cố: lỗi bơm mẫu – đã sửa',
    icon: '⚠',
    bg: 'bg-orange-100',
    detail: 'Báo hỏng: Nguyễn Ánh Vân. Sửa chữa: Lê Thị Mai. Thời gian: 2 ngày',
    evidence: 'Phiếu #SC-0355',
  },
  {
    date: '30/06/2025',
    event: 'Chuyển khoa — từ Sinh hóa sang Hóa sinh',
    icon: '↗',
    bg: 'bg-slate-100',
    detail: 'Người duyệt: Phạm Diễm Phương. Biên bản bàn giao đính kèm',
    evidence: 'Biên bản',
  },
  {
    date: '15/03/2022',
    event: 'Nghiệm thu nhập kho',
    icon: '📦',
    bg: 'bg-green-100',
    detail: 'Số hóa đơn: INV-2022-0045. Nhà cung cấp: Dräger VN',
    evidence: 'Biên bản nhập kho',
  },
];

function timelineVisual(t: { type: string }): { icon: string; bg: string } {
  switch (t.type) {
    case 'STATUS':
      return { icon: '🔒', bg: 'bg-red-100' };
    case 'HC':
      return { icon: '📋', bg: 'bg-purple-100' };
    case 'PM':
      return { icon: '🔧', bg: 'bg-blue-100' };
    case 'SC':
    case 'INCIDENT':
      return { icon: '⚠', bg: 'bg-orange-100' };
    default:
      return { icon: '📦', bg: 'bg-green-100' };
  }
}

export default function DeviceDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const allDevices = useDevices();
  const [device, setDevice] = useState(() => allDevices.find((d) => d.id === id) ?? devices[1]);
  const [timeline, setTimeline] = useState(TIMELINE);
  const [hcMsg, setHcMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [creatingHc, setCreatingHc] = useState(false);

  // Tạo phiếu hiệu chuẩn ngay cho thiết bị đang chờ hiệu chuẩn — đây là
  // "lối thoát" của BR-01 (phiếu HC luôn được phép). Trước đây nút bấm
  // không có handler nên không làm gì.
  function createHcOrder() {
    const equipmentId = parseEquipmentId(device.id);
    if (!equipmentId) {
      setHcMsg({ ok: false, text: 'Không xác định được mã thiết bị để tạo phiếu.' });
      return;
    }
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 30);
    setCreatingHc(true);
    setHcMsg(null);
    api<{ code: string }>('/work-orders', {
      method: 'POST',
      body: JSON.stringify({
        orderType: 'HC',
        equipmentId,
        priority: 'BINH_THUONG',
        deadline: deadline.toISOString().slice(0, 10),
        description: `Hiệu chuẩn định kỳ cho thiết bị ${device.id}`,
      }),
    })
      .then((res) => {
        setHcMsg({ ok: true, text: `Đã tạo phiếu ${res.code}.` });
      })
      .catch((err) => {
        setHcMsg({
          ok: false,
          text:
            err instanceof ApiError
              ? `[${err.code}] ${err.message}`
              : 'Không tạo được phiếu — máy chủ chưa chạy hoặc không kết nối được.',
        });
      })
      .finally(() => setCreatingHc(false));
  }

  useEffect(() => {
    if (!id) return;
    void apiOr<ApiDeviceDetail | null>(`/devices/${id}`, () => null)
      .then((detail) => {
        if (!detail) return; // offline → giữ mock
        setDevice((d) => ({
          ...d,
          name: detail.name,
          model: detail.model,
          serial: detail.serial,
          department: detail.department,
          status: detail.status,
          hanHieuChuan: fmtDate(detail.hanHieuChuan),
          daysLeft: diffDays(detail.hanHieuChuan),
          pmKeTiep: fmtDate(detail.pmKeTiep),
          manufacturer: detail.manufacturer,
          ngayNhap: fmtDate(detail.ngayNhap),
          warrantyMonths: detail.warrantyMonths,
          maintenanceContract: detail.maintenanceContract ?? '—',
        }));
        setTimeline(
          detail.timeline.map((t) => ({
            date: fmtDate(t.date),
            event: t.title,
            ...timelineVisual(t),
            detail: [t.detail, t.changedBy ? `Người ghi: ${t.changedBy}` : null].filter(Boolean).join(' · '),
            evidence: t.workOrderCode ? `Phiếu ${t.workOrderCode}` : 'log',
          })),
        );
      })
      .catch(() => {
        /* ApiError (vd 404) → giữ mock */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const daysLeft = device.daysLeft;
  const calibProgress = Math.max(0, Math.min(100, ((365 + daysLeft) / 365) * 100));

  return (
    <div className="p-6 space-y-5 max-w-4xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-600 transition-colors">
          ← Quay lại
        </button>
        <span className="text-slate-300">/</span>
        <span className="text-sm text-slate-500">Chi tiết thiết bị</span>
      </div>

      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-lg font-bold text-slate-800">{device.name}</h1>
              <StatusBadge status={device.status} />
              {daysLeft < 0 && (
                <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                  QUÁ HẠN {Math.abs(daysLeft)} NGÀY
                </span>
              )}
            </div>
            <div className="text-sm text-slate-500 space-y-1">
              <div>
                Model: <span className="text-slate-700 font-medium">{device.model}</span> · Nhập:{' '}
                <span className="text-slate-700">{device.ngayNhap}</span> · Khoa:{' '}
                <span className="text-slate-700">{device.department}</span>
              </div>
              <div>
                Bảo hành:{' '}
                <span className="text-slate-700">
                  {device.warrantyMonths} tháng{' '}
                  {device.warrantyLeft > 0 ? `(còn ${device.warrantyLeft} tháng)` : '(đã hết)'}
                </span>{' '}
                · HĐ bảo trì: <span className="text-slate-700">{device.maintenanceContract}</span>
              </div>
              <div>
                Serial: <span className="font-mono text-slate-700">{device.serial}</span> · ID:{' '}
                <span className="font-mono text-slate-700">{device.id}</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => window.print()}
              className="px-3 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50"
            >
              ⤓ In hồ sơ (PDF)
            </button>
            {device.status === 'CHO_HIEU_CHUAN' && (
              <button
                onClick={createHcOrder}
                disabled={creatingHc}
                className="px-3 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {creatingHc ? 'Đang tạo...' : 'Tạo phiếu HC ngay'}
              </button>
            )}
          </div>
          {hcMsg && (
            <div
              className={`mt-2 rounded-xl px-3 py-2 text-xs border ${
                hcMsg.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              {hcMsg.text}
            </div>
          )}
        </div>

        {/* Calibration bar */}
        <div className="mt-5 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-slate-600 uppercase tracking-wide">Hiệu chuẩn</div>
            <div
              className={`text-xs font-bold ${daysLeft < 0 ? 'text-red-600' : daysLeft <= 30 ? 'text-yellow-600' : 'text-green-600'}`}
            >
              {daysLeft < 0
                ? `⛔ QUÁ HẠN ${Math.abs(daysLeft)} NGÀY`
                : `Còn ${daysLeft} ngày · Hạn: ${device.hanHieuChuan}`}
            </div>
          </div>
          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${daysLeft < 0 ? 'bg-red-500' : daysLeft <= 30 ? 'bg-yellow-400' : 'bg-green-500'}`}
              style={{ width: `${calibProgress}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[10px] text-slate-400">
            <span>Nhập kho: {device.ngayNhap}</span>
            <span>Hạn: {device.hanHieuChuan}</span>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Lịch sử thiết bị</h2>
          <button className="text-xs text-blue-600 hover:underline">⤓ Tải hồ sơ PDF có mã tra cứu</button>
        </div>
        <div className="p-5">
          <div className="relative">
            <div className="absolute left-4 top-0 bottom-0 w-px bg-slate-200" />
            <div className="space-y-0">
              {timeline.map((item, i) => (
                <div key={i} className="relative pl-10 pb-6 last:pb-0 group">
                  <div
                    className={`absolute left-2 top-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] border-2 border-white shadow-sm ${item.bg}`}
                  >
                    {item.icon}
                  </div>
                  <div className="bg-slate-50 rounded-lg p-3 group-hover:bg-slate-100 transition-colors cursor-pointer">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-xs text-slate-400 mb-1">{item.date}</div>
                        <div className="text-sm font-semibold text-slate-800">{item.event}</div>
                        <div className="text-xs text-slate-500 mt-1">{item.detail}</div>
                      </div>
                      <button className="text-xs text-blue-600 border border-blue-200 bg-blue-50 px-2 py-1 rounded-lg hover:bg-blue-100 transition-colors whitespace-nowrap ml-4">
                        📄 {item.evidence}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {timeline.length === 0 && <div className="py-6 text-center text-slate-400 text-sm">Chưa có lịch sử</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function diffDays(isoExpiry: string | null | undefined): number {
  if (!isoExpiry) return 0;
  const expiry = new Date(isoExpiry.slice(0, 10));
  const today = new Date();
  return Math.round((expiry.getTime() - today.getTime()) / 86400000);
}
