import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { devices, workOrders, type Device, type WorkOrder } from '../../data/mockData';
import { apiOr, fmtDate } from '../../api/client';
import { mapDevice } from '../../api/hooks';
import type { ApiDashboard, ApiDevice, ApiWorkOrder } from '../../api/types';

// =====================================================================
// Màn BẢNG ĐIỀU KHIỂN (điều phối) — GET /api/dashboard (KPI + biểu đồ
// sự cố 12 tháng) + GET /api/devices (danh sách quá hạn / sắp đến hạn)
// + GET /api/work-orders (phiếu gần đây). Offline: tính từ mockData.
// =====================================================================

const monthlyIncidents = [3, 5, 8, 4, 12, 6, 4, 7, 8, 4, 6, 9];
const monthLabels = ['T10', 'T11', 'T12', 'T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9'];

export default function Dashboard() {
  const navigate = useNavigate();
  const [activeCard, setActiveCard] = useState<string | null>(null);
  const [stats, setStats] = useState(() => mockStats());
  const [overdue, setOverdue] = useState(() => devices.filter((d) => d.status === 'CHO_HIEU_CHUAN'));
  const [expiringSoon, setExpiringSoon] = useState(() =>
    devices.filter((d) => d.status === 'SAP_HAN' || (d.daysLeft > 0 && d.daysLeft <= 7)),
  );
  const [chart, setChart] = useState({ values: monthlyIncidents, labels: monthLabels });
  const [recent, setRecent] = useState<WorkOrder[]>(workOrders.slice(0, 5));

  useEffect(() => {
    void apiOr<ApiDashboard>('/dashboard', mockDashboard)
      .then((data) => {
        const s = mockStats();
        const statusCounts = data.deviceStatusCounts ?? {};
        setStats([
          {
            key: 'active',
            label: 'ĐANG HOẠT ĐỘNG',
            value: statusCounts['HOAT_DONG'] ?? 0,
            color: 'text-green-600',
            bg: 'bg-green-50',
            border: 'border-green-200',
            icon: '✓',
          },
          {
            key: 'orders',
            label: 'PHIẾU ĐANG MỞ',
            value: openOrdersOf(data.orderStatusCounts ?? {}),
            color: 'text-blue-600',
            bg: 'bg-blue-50',
            border: 'border-blue-200',
            icon: '☰',
          },
          {
            key: 'faults',
            label: 'SỰ CỐ 12 THÁNG',
            value: data.incidentsByMonth.reduce((sum, m) => sum + m.count, 0),
            color: 'text-orange-600',
            bg: 'bg-orange-50',
            border: 'border-orange-200',
            icon: '⚠',
          },
          {
            key: 'overdue',
            label: 'QUÁ HẠN HIỆU CHUẨN',
            value: data.overdueDevices,
            color: 'text-red-600',
            bg: 'bg-red-50',
            border: 'border-red-200 border-2',
            icon: '🔴',
          },
          {
            key: 'pmrate',
            label: 'BẢO TRÌNH ĐÚNG HẠN',
            value: `${data.pmOnTimeRate6M}%`,
            color: 'text-slate-700',
            bg: 'bg-slate-50',
            border: 'border-slate-200',
            icon: '↗',
          },
        ]);

        // Biểu đồ sự cố: phủ 0 cho các tháng không có sự cố
        const now = new Date();
        const months: { key: string; label: string }[] = [];
        for (let i = 11; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          months.push({
            key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
            label: `T${d.getMonth() + 1}`,
          });
        }
        const map = new Map(data.incidentsByMonth.map((m) => [m.month, m.count]));
        setChart({ values: months.map((m) => map.get(m.key) ?? 0), labels: months.map((m) => m.label) });
      })
      .catch(() => {
        /* giữ mock */
      });

    void apiOr<ApiDevice[]>('/devices', () => [])
      .then((list) => {
        if (list.length === 0) return; // offline → giữ mock
        const mapped = list.map(mapDevice);
        setOverdue(mapped.filter((d) => d.status === 'CHO_HIEU_CHUAN'));
        setExpiringSoon(mapped.filter((d) => d.status === 'SAP_HAN' || (d.daysLeft > 0 && d.daysLeft <= 30)));
      })
      .catch(() => {
        /* giữ mock */
      });

    void apiOr<ApiWorkOrder[]>('/work-orders', () => [])
      .then((list) => {
        if (list.length > 0) {
          setRecent(
            list.slice(0, 5).map((w) => ({
              id: w.id,
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
  }, []);

  const maxInc = Math.max(...chart.values, 1);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Bảng điều khiển</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {new Date().toLocaleDateString('vi-VN', {
              weekday: 'long',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}{' '}
            · Bệnh viện Đa khoa Trung ương
          </p>
        </div>
        <button
          onClick={() => navigate('/coordinator/orders')}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          + Tạo phiếu công tác
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-5 gap-4">
        {stats.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveCard(activeCard === s.key ? null : s.key)}
            className={`${s.bg} border ${s.border} rounded-xl p-4 text-left transition-all hover:shadow-md ${activeCard === s.key ? 'ring-2 ring-blue-400 ring-offset-1' : ''}`}
          >
            <div className="flex items-start justify-between">
              <span className="text-lg">{s.icon}</span>
              {s.key === 'overdue' && <span className="text-[10px] text-red-500 font-bold animate-pulse">KHẨN</span>}
            </div>
            <div className={`text-3xl font-bold mt-2 ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-slate-500 mt-1 font-medium leading-tight">{s.label}</div>
            <div className="text-[10px] text-slate-400 mt-1">↓ Bấm để xem</div>
          </button>
        ))}
      </div>

      {/* Overdue alert */}
      {activeCard === 'overdue' && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-red-600 font-bold text-sm">⛔ THIẾT BỊ QUÁ HẠN HIỆU CHUẨN</span>
            <span className="text-[11px] text-red-500">— Không thể phân công sử dụng</span>
          </div>
          <div className="space-y-2">
            {overdue.map((d) => (
              <div
                key={d.id}
                className="bg-white border border-red-100 rounded-lg px-4 py-3 flex items-center justify-between"
              >
                <div>
                  <span className="text-sm font-semibold text-slate-800">{d.name}</span>
                  <span className="text-slate-400 text-xs ml-2">
                    · {d.serial} · {d.department}
                  </span>
                  <div className="text-xs text-red-600 font-medium mt-0.5">
                    Quá hạn {Math.abs(d.daysLeft)} ngày (hết {fmtDate(d.hanHieuChuan)})
                  </div>
                </div>
                <button
                  onClick={() => navigate('/coordinator/orders')}
                  className="px-3 py-1.5 bg-red-600 text-white text-xs font-semibold rounded-lg hover:bg-red-700 transition-colors whitespace-nowrap"
                >
                  Tạo phiếu HC ngay
                </button>
              </div>
            ))}
            {overdue.length === 0 && (
              <div className="bg-white border border-red-100 rounded-lg px-4 py-3 text-sm text-green-700">
                ✓ Không có thiết bị nào quá hạn hiệu chuẩn
              </div>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Expiring soon */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">SẮP ĐẾN HẠN HC (≤30 ngày)</h2>
            <span className="text-[11px] text-yellow-600 bg-yellow-50 px-2 py-0.5 rounded-full border border-yellow-200 font-medium">
              {expiringSoon.length} thiết bị
            </span>
          </div>
          <div className="divide-y divide-slate-50 max-h-72 overflow-y-auto">
            {expiringSoon.map((d) => (
              <div
                key={d.id}
                className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 cursor-pointer"
                onClick={() => navigate(`/coordinator/devices/${d.id}`)}
              >
                <div>
                  <div className="text-sm font-medium text-slate-800">
                    {d.name} <span className="text-slate-400 font-normal">· {d.serial}</span>
                  </div>
                  <div className="text-xs text-slate-500">
                    {d.department} · Hạn: {fmtDate(d.hanHieuChuan)}
                  </div>
                </div>
                <div className={`text-sm font-bold ${(d.daysLeft ?? 99) <= 7 ? 'text-red-600' : 'text-yellow-600'}`}>
                  {d.daysLeft} ngày
                </div>
              </div>
            ))}
            {expiringSoon.length === 0 && (
              <div className="px-4 py-6 text-center text-slate-400 text-sm">Không có thiết bị sắp hết hạn</div>
            )}
          </div>
        </div>

        {/* Incident chart */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-700">SỰ CỐ THEO THÁNG (12 tháng qua)</h2>
          </div>
          <div className="p-4">
            <div className="flex items-end gap-1.5 h-28">
              {chart.values.map((v, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t-sm transition-all hover:opacity-80"
                    style={{
                      height: `${(v / maxInc) * 100}%`,
                      background: v === maxInc ? '#DC2626' : v >= 7 ? '#F97316' : '#3B82F6',
                      minHeight: 4,
                    }}
                    title={`${v} sự cố`}
                  />
                  <span className="text-[9px] text-slate-400">{chart.labels[i]}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-4 text-[11px] text-slate-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-blue-500 rounded-sm inline-block" /> Bình thường
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-orange-500 rounded-sm inline-block" /> Cao
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 bg-red-600 rounded-sm inline-block" /> Đỉnh
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Recent orders */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700">PHIẾU CÔNG TÁC GẦN ĐÂY</h2>
          <button onClick={() => navigate('/coordinator/orders')} className="text-xs text-blue-600 hover:underline">
            Xem tất cả →
          </button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wide">
              <th className="px-4 py-2 text-left font-medium">Mã phiếu</th>
              <th className="px-4 py-2 text-left font-medium">Loại</th>
              <th className="px-4 py-2 text-left font-medium">Thiết bị</th>
              <th className="px-4 py-2 text-left font-medium">Khoa</th>
              <th className="px-4 py-2 text-left font-medium">Người thực hiện</th>
              <th className="px-4 py-2 text-left font-medium">Hạn</th>
              <th className="px-4 py-2 text-left font-medium">Trạng thái</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {recent.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50 cursor-pointer">
                <td className="px-4 py-2.5 font-mono text-slate-700">{o.id}</td>
                <td className="px-4 py-2.5">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      o.type === 'HC'
                        ? 'bg-purple-100 text-purple-700'
                        : o.type === 'SC'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {o.type}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-700">
                  {o.device} <span className="text-slate-400">· {o.serial}</span>
                </td>
                <td className="px-4 py-2.5 text-slate-500">{o.department}</td>
                <td className="px-4 py-2.5 text-slate-600">{o.assignee}</td>
                <td className="px-4 py-2.5 text-slate-500">{o.deadline}</td>
                <td className="px-4 py-2.5">
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
                    {o.status === 'CHO_PHAN_CONG'
                      ? 'Chờ phân công'
                      : o.status === 'DANG_THUC_HIEN'
                        ? 'Đang thực hiện'
                        : o.status === 'CHO_NGHIEM_THU'
                          ? 'Chờ nghiệm thu'
                          : o.status === 'HOAN_THANH'
                            ? 'Hoàn thành'
                            : 'Trả lại'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ----- Fallback offline: tính từ mockData -----

function mockStats() {
  const openOrders = workOrders.filter((d) => d.status !== 'HOAN_THANH');
  return [
    {
      key: 'active',
      label: 'ĐANG HOẠT ĐỘNG',
      value: devices.filter((d) => d.status === 'HOAT_DONG').length,
      color: 'text-green-600',
      bg: 'bg-green-50',
      border: 'border-green-200',
      icon: '✓',
    },
    {
      key: 'orders',
      label: 'PHIẾU ĐANG MỞ',
      value: openOrders.length,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
      icon: '☰',
    },
    {
      key: 'faults',
      label: 'SỰ CỐ 12 THÁNG',
      value: monthlyIncidents.reduce((a, b) => a + b, 0),
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      border: 'border-orange-200',
      icon: '⚠',
    },
    {
      key: 'overdue',
      label: 'QUÁ HẠN HIỆU CHUẨN',
      value: devices.filter((d) => d.status === 'CHO_HIEU_CHUAN').length,
      color: 'text-red-600',
      bg: 'bg-red-50',
      border: 'border-red-200 border-2',
      icon: '🔴',
    },
    {
      key: 'pmrate',
      label: 'BẢO TRÌNH ĐÚNG HẠN',
      value: '89%',
      color: 'text-slate-700',
      bg: 'bg-slate-50',
      border: 'border-slate-200',
      icon: '↗',
    },
  ] as {
    key: string;
    label: string;
    value: string | number;
    color: string;
    bg: string;
    border: string;
    icon: string;
  }[];
}

function openOrdersOf(orderStatusCounts: Record<string, number>): number {
  return Object.entries(orderStatusCounts)
    .filter(([status]) => status !== 'HOAN_THANH')
    .reduce((sum, [, count]) => sum + count, 0);
}

function mockDashboard(): ApiDashboard {
  const statusCounts: Record<string, number> = {};
  devices.forEach((d) => {
    statusCounts[d.status] = (statusCounts[d.status] ?? 0) + 1;
  });
  const orderCounts: Record<string, number> = {};
  workOrders.forEach((o) => {
    orderCounts[o.status] = (orderCounts[o.status] ?? 0) + 1;
  });
  const now = new Date();
  const incidentsByMonth = monthlyIncidents.map((count, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1);
    return { month: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, count };
  });
  return {
    deviceStatusCounts: statusCounts,
    orderStatusCounts: orderCounts,
    overdueDevices: devices.filter((d) => d.status === 'CHO_HIEU_CHUAN').length,
    upcomingDevices: devices.filter((d) => d.status === 'SAP_HAN').length,
    pmOnTimeRate6M: 89,
    upcomingCalibrations: [],
    incidentsByMonth,
  };
}
