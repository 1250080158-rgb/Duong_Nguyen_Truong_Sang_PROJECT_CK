import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { DeviceStatus } from '../../data/mockData';
import StatusBadge from '../../components/StatusBadge';
import { useDevices } from '../../api/hooks';
import { api, ApiError, apiOr, downloadCsv } from '../../api/client';
import type {
  ApiCatalogModel,
  ApiDepartment,
  ApiDeviceCreateRequest,
  ApiDeviceCreateResponse,
  ApiSupplier,
} from '../../api/types';

const STATUS_FILTERS: { label: string; value: DeviceStatus | 'ALL' }[] = [
  { label: 'Tất cả', value: 'ALL' },
  { label: 'Đang hoạt động', value: 'HOAT_DONG' },
  { label: 'Sắp hết hạn', value: 'SAP_HAN' },
  { label: 'Chờ hiệu chuẩn', value: 'CHO_HIEU_CHUAN' },
  { label: 'Đang sửa chữa', value: 'DANG_SUA' },
];

export default function DeviceList() {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const devices = useDevices(refreshKey);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DeviceStatus | 'ALL'>('ALL');
  const [deptFilter, setDeptFilter] = useState('ALL');

  const departments = ['ALL', ...Array.from(new Set(devices.map((d) => d.department)))];

  const filtered = devices.filter((d) => {
    const matchSearch =
      !search ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.serial.toLowerCase().includes(search.toLowerCase()) ||
      d.department.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'ALL' || d.status === statusFilter;
    const matchDept = deptFilter === 'ALL' || d.department === deptFilter;
    return matchSearch && matchStatus && matchDept;
  });

  // ===== Tạo thiết bị mới (POST /api/devices — quyền Quản trị) =====
  const [showCreate, setShowCreate] = useState(false);
  const [models, setModels] = useState<ApiCatalogModel[]>([]);
  const [depts, setDepts] = useState<ApiDepartment[]>([]);
  const [suppliers, setSuppliers] = useState<ApiSupplier[]>([]);
  const [fModel, setFModel] = useState('');
  const [fSerial, setFSerial] = useState('');
  const [fDept, setFDept] = useState('');
  const [fImport, setFImport] = useState(() => new Date().toISOString().slice(0, 10));
  const [fWarranty, setFWarranty] = useState('24');
  const [fSupplier, setFSupplier] = useState('');
  const [fNotes, setFNotes] = useState('');
  const [createMsg, setCreateMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!showCreate) return;
    void apiOr<ApiCatalogModel[]>('/catalog/models', () => [])
      .then((l) => setModels(l))
      .catch(() => setModels([]));
    void apiOr<ApiDepartment[]>('/catalog/departments', () => [])
      .then((l) => setDepts(l))
      .catch(() => setDepts([]));
    void apiOr<ApiSupplier[]>('/catalog/suppliers', () => [])
      .then((l) => setSuppliers(l))
      .catch(() => setSuppliers([]));
  }, [showCreate]);

  function submitCreateDevice() {
    if (!fModel || !fSerial.trim() || !fDept) {
      setCreateMsg({ ok: false, text: 'Phải chọn model, nhập số serial và chọn khoa phòng.' });
      return;
    }
    const body: ApiDeviceCreateRequest = {
      modelId: Number(fModel),
      serial: fSerial.trim(),
      departmentId: Number(fDept),
      importDate: fImport,
      warrantyMonths: Number(fWarranty) || 0,
      maintenanceSupplierId: fSupplier ? Number(fSupplier) : null,
      notes: fNotes.trim() || null,
    };
    setBusy(true);
    setCreateMsg(null);
    api<ApiDeviceCreateResponse>('/devices', { method: 'POST', body: JSON.stringify(body) })
      .then((res) => {
        setCreateMsg({ ok: true, text: `Đã thêm thiết bị ${res.code}.` });
        setFSerial('');
        setFNotes('');
        setRefreshKey((k) => k + 1); // nạp lại danh sách
      })
      .catch((err) => {
        setCreateMsg({
          ok: false,
          text:
            err instanceof ApiError
              ? `[${err.code}] ${err.message}`
              : 'Không thêm được — máy chủ chưa chạy hoặc không kết nối được.',
        });
      })
      .finally(() => setBusy(false));
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Thiết bị toàn viện</h1>
          <p className="text-sm text-slate-500 mt-0.5">{devices.length} thiết bị đang quản lý</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              downloadCsv('danh-sach-thiet-bi', filtered, [
                { key: 'id', label: 'Mã thiết bị', value: (d) => d.id },
                { key: 'name', label: 'Tên model', value: (d) => d.name },
                { key: 'serial', label: 'Số serial', value: (d) => d.serial },
                { key: 'department', label: 'Khoa phòng', value: (d) => d.department },
                { key: 'status', label: 'Trạng thái', value: (d) => d.status },
                { key: 'hanHieuChuan', label: 'Hạn hiệu chuẩn', value: (d) => d.hanHieuChuan },
                { key: 'pmKeTiep', label: 'PM kế tiếp', value: (d) => d.pmKeTiep },
                { key: 'warrantyMonths', label: 'Tháng bảo hành', value: (d) => d.warrantyMonths },
              ])
            }
            className="px-3 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50 transition-colors"
          >
            ⤓ Xuất Excel
          </button>
          <button
            onClick={() => {
              setShowCreate(true);
              setCreateMsg(null);
            }}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            + Thêm thiết bị
          </button>
        </div>
      </div>

      {/* Hộp thoại thêm thiết bị — POST /api/devices */}
      {showCreate && (
        <div
          className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4"
          onClick={() => setShowCreate(false)}
        >
          <div
            className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg p-5 space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-bold text-slate-800">Thêm thiết bị mới</h2>

            {createMsg && (
              <div
                className={`rounded-xl px-3 py-2 text-xs border ${
                  createMsg.ok ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'
                }`}
              >
                {createMsg.text}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-2 text-xs text-slate-500">
                Model thiết bị *
                <select
                  value={fModel}
                  onChange={(e) => setFModel(e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="">— Chọn model —</option>
                  {models.map((m) => (
                    <option key={m.idModel} value={m.idModel}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-slate-500">
                Số serial *
                <input
                  value={fSerial}
                  onChange={(e) => setFSerial(e.target.value)}
                  placeholder="VD: SN-2026-001"
                  className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                />
              </label>

              <label className="text-xs text-slate-500">
                Khoa phòng *
                <select
                  value={fDept}
                  onChange={(e) => setFDept(e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="">— Chọn khoa —</option>
                  {depts.map((d) => (
                    <option key={d.idKhoa} value={d.idKhoa}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-xs text-slate-500">
                Ngày nhập kho *
                <input
                  type="date"
                  value={fImport}
                  onChange={(e) => setFImport(e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                />
              </label>

              <label className="text-xs text-slate-500">
                Tháng bảo hành
                <input
                  type="number"
                  min={0}
                  value={fWarranty}
                  onChange={(e) => setFWarranty(e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                />
              </label>

              <label className="col-span-2 text-xs text-slate-500">
                Nhà cung cấp bảo trì
                <select
                  value={fSupplier}
                  onChange={(e) => setFSupplier(e.target.value)}
                  className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                >
                  <option value="">— Không có —</option>
                  {suppliers.map((s) => (
                    <option key={s.idNcc} value={s.idNcc}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="col-span-2 text-xs text-slate-500">
                Ghi chú
                <textarea
                  value={fNotes}
                  onChange={(e) => setFNotes(e.target.value)}
                  rows={2}
                  className="mt-1 w-full px-2 py-1.5 border border-slate-200 rounded-lg text-sm"
                />
              </label>
            </div>

            <p className="text-[11px] text-slate-400">
              Hạn hiệu chuẩn và lịch bảo trì đầu tiên được tính tự động theo chu kỳ của model.
            </p>

            <div className="flex gap-2 pt-1">
              <button
                onClick={submitCreateDevice}
                disabled={busy}
                className="flex-1 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 disabled:opacity-50"
              >
                {busy ? 'Đang lưu...' : 'Lưu thiết bị'}
              </button>
              <button
                onClick={() => setShowCreate(false)}
                className="px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Tìm tên thiết bị, serial, khoa..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {departments.map((d) => (
            <option key={d} value={d}>
              {d === 'ALL' ? 'Tất cả khoa' : d}
            </option>
          ))}
        </select>
        <div className="flex gap-1">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                statusFilter === f.value ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {f.label}
              {f.value !== 'ALL' && (
                <span className="ml-1 opacity-70">({devices.filter((d) => d.status === f.value).length})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-medium">Thiết bị</th>
              <th className="px-4 py-3 text-left font-medium">Số sê-ri</th>
              <th className="px-4 py-3 text-left font-medium">Khoa</th>
              <th className="px-4 py-3 text-left font-medium">Trạng thái</th>
              <th className="px-4 py-3 text-left font-medium">Hạn hiệu chuẩn</th>
              <th className="px-4 py-3 text-left font-medium">Bảo trì kế tiếp</th>
              <th className="px-4 py-3 text-left font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((d) => (
              <tr
                key={d.id}
                className={`hover:bg-slate-50 cursor-pointer transition-colors ${d.status === 'CHO_HIEU_CHUAN' ? 'bg-red-50/30' : ''}`}
                onClick={() => navigate(`/coordinator/devices/${d.id}`)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium text-slate-800">{d.name}</div>
                  <div className="text-xs text-slate-400">
                    {d.model} · {d.manufacturer}
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{d.serial}</td>
                <td className="px-4 py-3 text-slate-600">{d.department}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={d.status} />
                </td>
                <td className="px-4 py-3">
                  <div
                    className={`text-sm font-semibold ${d.daysLeft < 0 ? 'text-red-600' : d.daysLeft <= 30 ? 'text-yellow-600' : 'text-slate-700'}`}
                  >
                    {d.hanHieuChuan}
                  </div>
                  <div
                    className={`text-xs font-medium ${d.daysLeft < 0 ? 'text-red-500' : d.daysLeft <= 30 ? 'text-yellow-500' : 'text-slate-400'}`}
                  >
                    {d.daysLeft < 0 ? `Quá hạn ${Math.abs(d.daysLeft)} ngày` : `Còn ${d.daysLeft} ngày`}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-slate-500">{d.pmKeTiep}</td>
                <td className="px-4 py-3">
                  <button className="text-xs text-blue-600 hover:underline">Chi tiết →</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-sm">Không tìm thấy thiết bị phù hợp</div>
        )}
      </div>
    </div>
  );
}
