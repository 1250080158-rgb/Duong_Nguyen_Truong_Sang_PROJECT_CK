import { useState } from 'react';
import { useNavigate } from 'react-router';
import StatusBadge from '../../components/StatusBadge';
import { apiOr, ApiError, getUser } from '../../api/client';
import { useDevices, type DeviceRow } from '../../api/hooks';

// =====================================================================
// Màn THIẾT BỊ KHOA (đầu mối khoa, mobile-first) — danh sách lọc theo
// khoa của user đăng nhập (GET /api/devices, lọc client). Nút BÁO HỎNG
// mở wizard 3 bước → POST /api/incidents; backend chưa chạy → xác nhận
// cục bộ để demo vẫn chạy.
// =====================================================================

export default function DepartmentDevices() {
  const navigate = useNavigate();
  const user = getUser();
  const department = user?.department ?? 'Khoa của bạn';
  const allDevices = useDevices();
  const deptDevices = allDevices.filter((d) => d.department === department);

  const [search, setSearch] = useState('');
  const [showFaultWizard, setShowFaultWizard] = useState(false);
  const [faultStep, setFaultStep] = useState(1);
  const [selectedDevice, setSelectedDevice] = useState<DeviceRow | null>(null);
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'SO_BO' | 'KHAN'>('SO_BO');
  const [photo, setPhoto] = useState<File | null>(null);
  const [submittedCode, setSubmittedCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = deptDevices.filter(
    (d) =>
      !search ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.serial.toLowerCase().includes(search.toLowerCase()),
  );

  function submitFault() {
    if (!selectedDevice) return;
    // Gửi multipart để kèm ảnh sự cố (nếu có) — máy chủ nhận
    // equipmentId/description/severity/photo.
    const form = new FormData();
    form.append('equipmentId', String(selectedDevice.equipmentId));
    form.append('description', description);
    form.append('severity', severity);
    if (photo) form.append('photo', photo);

    apiOr<{ code: string; message: string }>(
      '/incidents',
      () => ({
        code: `SC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
        message: 'Đã ghi nhận sự cố (chế độ dữ liệu mẫu — khi máy chủ chạy sẽ lưu vào CSDL).',
      }),
      { method: 'POST', body: form },
    )
      .then((res) => {
        setSubmittedCode(res.code);
        setShowFaultWizard(false);
        setFaultStep(1);
        setDescription('');
        setPhoto(null);
        setSelectedDevice(null);
      })
      .catch((err) => {
        if (err instanceof ApiError) setError(`[${err.code}] ${err.message}`);
        else setError('Không gửi được báo cáo sự cố — kiểm tra kết nối máy chủ.');
      });
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-800">Khoa {department}</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Đầu mối: {user?.fullName ?? '—'} · {deptDevices.length} thiết bị
          </p>
        </div>
        <button className="relative p-2 rounded-xl hover:bg-slate-100">
          <span className="text-slate-500">🔔</span>
          <span className="absolute top-1 right-1 w-3 h-3 bg-red-500 rounded-full text-white text-[8px] flex items-center justify-center">
            2
          </span>
        </button>
      </div>

      {/* Status summary */}
      <div className="grid grid-cols-4 gap-2">
        {[
          {
            label: 'Hoạt động',
            count: deptDevices.filter((d) => d.status === 'HOAT_DONG').length,
            color: 'bg-green-50 text-green-700',
          },
          {
            label: 'Sắp hạn',
            count: deptDevices.filter((d) => d.status === 'SAP_HAN').length,
            color: 'bg-yellow-50 text-yellow-700',
          },
          {
            label: 'Chờ HC',
            count: deptDevices.filter((d) => d.status === 'CHO_HIEU_CHUAN').length,
            color: 'bg-red-50 text-red-700',
          },
          {
            label: 'Đang sửa',
            count: deptDevices.filter((d) => d.status === 'DANG_SUA').length,
            color: 'bg-gray-50 text-gray-600',
          },
        ].map((s) => (
          <div key={s.label} className={`${s.color} rounded-2xl p-3 text-center`}>
            <div className="text-xl font-bold">{s.count}</div>
            <div className="text-[11px] mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {submittedCode && (
        <div className="bg-green-50 border border-green-200 rounded-2xl px-4 py-3 text-sm text-green-700 flex items-start justify-between gap-2">
          <span>
            ✓ Đã gửi báo cáo sự cố thành công. Mã phiếu: <strong className="font-mono">#{submittedCode}</strong> · Phòng
            Vật tư - Thiết bị y tế sẽ tiếp nhận trong 2 giờ làm việc.
          </span>
          <button onClick={() => setSubmittedCode(null)} className="text-green-500 hover:text-green-700">
            ✕
          </button>
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700 flex items-start justify-between gap-2">
          <span>⛔ {error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            ✕
          </button>
        </div>
      )}

      {/* Search + fault button */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">🔍</span>
          <input
            type="text"
            placeholder="Tìm tên, serial, mã QR..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-3 border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <button
          onClick={() => setShowFaultWizard(true)}
          className="px-5 py-3 bg-red-600 text-white text-sm font-bold rounded-2xl hover:bg-red-700 transition-colors shadow-lg shadow-red-200 whitespace-nowrap"
        >
          ⊕ BÁO SỰ CỐ
        </button>
      </div>

      {/* Device list */}
      <div className="space-y-3">
        {filtered.map((d) => (
          <div
            key={d.id}
            onClick={() => navigate(`/department/devices/${d.id}`)}
            className={`bg-white border rounded-2xl p-4 cursor-pointer hover:shadow-md transition-shadow ${
              d.status === 'CHO_HIEU_CHUAN' ? 'border-red-200 bg-red-50/30' : 'border-slate-200'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <div className="text-base font-semibold text-slate-800">{d.name}</div>
                <div className="text-xs text-slate-400 font-mono">{d.serial}</div>
              </div>
              <StatusBadge status={d.status} />
            </div>

            <div className="text-xs text-slate-500">
              {d.status === 'HOAT_DONG' && (
                <span className="text-green-600">
                  HC còn hạn: <strong>{d.daysLeft} ngày</strong>
                </span>
              )}
              {d.status === 'SAP_HAN' && (
                <span className="text-yellow-600 font-semibold">⚠ Còn {d.daysLeft} ngày đến hạn hiệu chuẩn</span>
              )}
              {d.status === 'CHO_HIEU_CHUAN' && (
                <span className="text-red-600 font-bold">
                  Quá hạn {Math.abs(d.daysLeft)} ngày — không thể phân công sử dụng
                </span>
              )}
              {d.status === 'DANG_SUA' && <span className="text-gray-600">Đang sửa chữa</span>}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl py-10 text-center text-slate-400 text-sm">
            Khoa chưa có thiết bị trong hệ thống
          </div>
        )}
      </div>

      {/* Fault report wizard */}
      {showFaultWizard && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md overflow-hidden">
            {/* Progress */}
            <div className="flex border-b border-slate-100">
              {[1, 2, 3].map((step) => (
                <div
                  key={step}
                  className={`flex-1 py-3 text-center text-xs font-semibold ${faultStep === step ? 'text-blue-600 border-b-2 border-blue-600' : faultStep > step ? 'text-green-600' : 'text-slate-400'}`}
                >
                  {faultStep > step ? '✓' : step}. {step === 1 ? 'Chọn thiết bị' : step === 2 ? 'Mô tả' : 'Xác nhận'}
                </div>
              ))}
            </div>

            <div className="p-5">
              {faultStep === 1 && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-slate-800">Bước 1/3 – Chọn thiết bị</h3>
                  <input
                    type="text"
                    placeholder="🔍 Tìm thiết bị..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {filtered.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => {
                          setSelectedDevice(d);
                        }}
                        className={`w-full text-left p-3 rounded-xl border transition-colors ${selectedDevice?.id === d.id ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:bg-slate-50'}`}
                      >
                        <div className="text-sm font-medium text-slate-800">
                          {d.name} <span className="text-slate-400">· {d.serial}</span>
                        </div>
                        <StatusBadge status={d.status} />
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => setShowFaultWizard(false)}
                      className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-2xl text-sm"
                    >
                      Hủy
                    </button>
                    <button
                      disabled={!selectedDevice}
                      onClick={() => setFaultStep(2)}
                      className={`flex-1 py-3 rounded-2xl text-sm font-semibold ${selectedDevice ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                    >
                      Tiếp →
                    </button>
                  </div>
                </div>
              )}

              {faultStep === 2 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-800">Bước 2/3 – Mô tả sự cố</h3>
                  <div className="bg-slate-50 rounded-xl px-3 py-2 text-sm text-slate-700 font-medium">
                    {selectedDevice?.name} · {selectedDevice?.serial}
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">Mô tả hỏng hóc</label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Máy không khởi động, màn hình đen, phát ra tiếng kêu lạ..."
                      rows={4}
                      className="w-full border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-2 block">Mức độ khẩn cấp</label>
                    <div className="flex gap-3">
                      {(['SO_BO', 'KHAN'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setSeverity(s)}
                          className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-colors ${severity === s ? (s === 'KHAN' ? 'border-red-500 bg-red-50 text-red-700' : 'border-blue-500 bg-blue-50 text-blue-700') : 'border-slate-200 text-slate-500'}`}
                        >
                          {s === 'SO_BO' ? '🟡 Sơ bộ' : '🔴 Khẩn'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-2 block">Ảnh sự cố (nếu có)</label>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                      className="w-full text-xs text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-xs file:text-slate-700"
                    />
                    <p className="text-[11px] text-slate-400 mt-1">
                      Ảnh JPG/PNG/WEBP, tối đa 10 MB. Ảnh được lưu kèm sự cố để điều phối xem lại.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setFaultStep(1)}
                      className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-2xl text-sm"
                    >
                      ← Quay lại
                    </button>
                    <button
                      disabled={!description.trim()}
                      onClick={() => setFaultStep(3)}
                      className={`flex-1 py-3 rounded-2xl text-sm font-semibold ${description.trim() ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-400'}`}
                    >
                      Tiếp →
                    </button>
                  </div>
                </div>
              )}

              {faultStep === 3 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-slate-800">Bước 3/3 – Xác nhận</h3>
                  <div className="bg-slate-50 rounded-2xl p-4 space-y-2">
                    <div className="text-sm font-semibold text-slate-800">{selectedDevice?.name}</div>
                    <div className="text-xs text-slate-500 font-mono">
                      {selectedDevice?.serial} · {selectedDevice?.department}
                    </div>
                    <div className="text-sm text-slate-700 mt-2">"{description}"</div>
                    <div className="flex items-center gap-2 mt-2">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${severity === 'KHAN' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}
                      >
                        Mức độ: {severity === 'KHAN' ? '🔴 KHẨN' : '🟡 SƠ BỘ'}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setFaultStep(2)}
                      className="flex-1 border border-slate-200 text-slate-600 py-3 rounded-2xl text-sm"
                    >
                      ← Quay lại
                    </button>
                    <button
                      onClick={submitFault}
                      className="flex-1 py-3 rounded-2xl text-sm font-bold bg-red-600 text-white hover:bg-red-700 transition-colors"
                    >
                      GỬI BÁO SỰ CỐ
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
