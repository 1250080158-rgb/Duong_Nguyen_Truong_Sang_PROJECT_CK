import { useEffect, useState } from 'react';
import { api, apiOr, ApiError, downloadCsv } from '../../api/client';
import type { ApiCatalogModel, ApiDepartment, ApiManufacturer, ApiSupplier } from '../../api/types';

// =====================================================================
// Màn DANH MỤC NỀN (admin) — GET /api/catalog/models | departments |
// suppliers | manufacturers. Tab model hỗ trợ "+ Thêm" → POST
// /api/catalog/models (chu kỳ PM/HC + dung sai kế thừa cho thiết bị).
// =====================================================================

const MOCK_MODELS: ApiCatalogModel[] = [
  {
    idModel: 1,
    name: 'BS-240',
    manufacturer: 'Mindray',
    category: 'Sinh phẩm',
    chuKyPmNgay: 90,
    chuKyHcNgay: 365,
    dungSaiHcPhanTram: 2.5,
  },
  {
    idModel: 2,
    name: 'XN-1000',
    manufacturer: 'Sysmex',
    category: 'Huyết học',
    chuKyPmNgay: 60,
    chuKyHcNgay: 365,
    dungSaiHcPhanTram: 3.0,
  },
  {
    idModel: 3,
    name: 'HAMILTON-G5',
    manufacturer: 'Hamilton Medical',
    category: 'Hô hấp',
    chuKyPmNgay: 180,
    chuKyHcNgay: 365,
    dungSaiHcPhanTram: 1.5,
  },
  {
    idModel: 4,
    name: 'LOGIQ E9',
    manufacturer: 'GE Healthcare',
    category: 'Siêu âm',
    chuKyPmNgay: 365,
    chuKyHcNgay: 730,
    dungSaiHcPhanTram: 5.0,
  },
];
const MOCK_DEPARTMENTS: ApiDepartment[] = [
  'Hóa sinh',
  'Huyết học',
  'ICU',
  'Chẩn đoán hình ảnh',
  'Tim mạch',
  'Nhi khoa',
  'Ngoại tổng hợp',
  'Cấp cứu',
].map((name, i) => ({ idKhoa: i + 1, name, laLamSang: true }));
const MOCK_SUPPLIERS: ApiSupplier[] = [
  { idNcc: 1, name: 'Dräger Vietnam' },
  { idNcc: 2, name: 'GE Healthcare Vietnam' },
  { idNcc: 3, name: 'Sysmex Vietnam' },
  { idNcc: 4, name: 'BMT Medical' },
];

export default function MasterCatalog() {
  const [activeTab, setActiveTab] = useState<'models' | 'departments' | 'suppliers'>('models');
  const [models, setModels] = useState<ApiCatalogModel[]>(MOCK_MODELS);
  const [departments, setDepartments] = useState<ApiDepartment[]>(MOCK_DEPARTMENTS);
  const [suppliers, setSuppliers] = useState<ApiSupplier[]>(MOCK_SUPPLIERS);
  const [manufacturers, setManufacturers] = useState<ApiManufacturer[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form tạo model
  const [mName, setMName] = useState('');
  const [mManuId, setMManuId] = useState('');
  const [mCategory, setMCategory] = useState('');
  const [mPm, setMPm] = useState('90');
  const [mHc, setMHc] = useState('365');
  const [mTol, setMTol] = useState('2.5');

  useEffect(() => {
    void apiOr<ApiCatalogModel[]>('/catalog/models', () => [])
      .then((list) => {
        if (list.length > 0) setModels(list);
      })
      .catch(() => {
        /* giữ mock */
      });
    void apiOr<ApiDepartment[]>('/catalog/departments', () => [])
      .then((list) => {
        if (list.length > 0) setDepartments(list);
      })
      .catch(() => {
        /* giữ mock */
      });
    void apiOr<ApiSupplier[]>('/catalog/suppliers', () => [])
      .then((list) => {
        if (list.length > 0) setSuppliers(list);
      })
      .catch(() => {
        /* giữ mock */
      });
    void apiOr<ApiManufacturer[]>('/catalog/manufacturers', () => [])
      .then((list) => setManufacturers(list))
      .catch(() => {
        /* chỉ cần cho form tạo model */
      });
  }, []);

  function submitCreateModel() {
    if (!mName || !mManuId) return;
    api<{ idModel: number }>('/catalog/models', {
      method: 'POST',
      body: JSON.stringify({
        name: mName,
        idHang: parseInt(mManuId, 10),
        category: mCategory || 'Khác',
        chuKyPmNgay: parseInt(mPm, 10) || 90,
        chuKyHcNgay: parseInt(mHc, 10) || 365,
        dungSaiHcPhanTram: parseFloat(mTol) || 2.5,
      }),
    })
      .then((res) => {
        setShowCreate(false);
        setNotice(`Đã thêm model ${mName} (#${res.idModel}) — thiết bị mới cùng model sẽ kế thừa chu kỳ PM/HC.`);
        setMName('');
        setMManuId('');
        setMCategory('');
        setMPm('90');
        setMHc('365');
        setMTol('2.5');
        void apiOr<ApiCatalogModel[]>('/catalog/models', () => [])
          .then((list) => {
            if (list.length > 0) setModels(list);
          })
          .catch(() => {
            /* giữ nguyên */
          });
      })
      .catch((err) => {
        setError(err instanceof ApiError ? `[${err.code}] ${err.message}` : 'Không thêm được — backend chưa chạy.');
      });
  }

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Danh mục nền</h1>
          <p className="text-sm text-slate-500 mt-0.5">Cấu hình một lần — mọi thiết bị kế thừa</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() =>
              downloadCsv('danh-muc-model', models, [
                { key: 'name', label: 'Tên model', value: (m) => m.name },
                { key: 'manufacturer', label: 'Hãng', value: (m) => m.manufacturer },
                { key: 'category', label: 'Loại', value: (m) => m.category },
                { key: 'pm', label: 'Chu kỳ PM (ngày)', value: (m) => m.chuKyPmNgay },
                { key: 'hc', label: 'Chu kỳ HC (ngày)', value: (m) => m.chuKyHcNgay },
                { key: 'tol', label: 'Dung sai hiệu chuẩn (%)', value: (m) => m.dungSaiHcPhanTram },
              ])
            }
            className="px-3 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50"
          >
            ⤓ Xuất Excel
          </button>
          {activeTab === 'models' && (
            <button
              onClick={() => setShowCreate(true)}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
            >
              + Thêm
            </button>
          )}
        </div>
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
          <span>⛔ {error}</span>
          <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700">
            ✕
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-0">
        {(
          [
            ['models', 'Model thiết bị'],
            ['departments', 'Khoa & Vị trí'],
            ['suppliers', 'Nhà cung cấp'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === key
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'models' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-amber-50 border-b border-amber-100 text-xs text-amber-700">
            <strong>Quan trọng:</strong> Chu kỳ PM/HC và dung sai cấu hình theo model — tất cả thiết bị cùng model sẽ kế
            thừa. Thay đổi ở đây ảnh hưởng toàn bộ.
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-medium">Tên model</th>
                <th className="px-4 py-3 text-left font-medium">Hãng</th>
                <th className="px-4 py-3 text-left font-medium">Loại</th>
                <th className="px-4 py-3 text-left font-medium">Chu kỳ PM</th>
                <th className="px-4 py-3 text-left font-medium">Chu kỳ HC</th>
                <th className="px-4 py-3 text-left font-medium">Dung sai hiệu chuẩn</th>
                <th className="px-4 py-3 text-left font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {models.map((m) => (
                <tr key={m.idModel} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-800">{m.name}</td>
                  <td className="px-4 py-3 text-slate-600">{m.manufacturer}</td>
                  <td className="px-4 py-3 text-slate-600">{m.category}</td>
                  <td className="px-4 py-3 text-slate-700">{m.chuKyPmNgay} ngày</td>
                  <td className="px-4 py-3 text-slate-700">{m.chuKyHcNgay} ngày</td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-slate-700">±{m.dungSaiHcPhanTram}%</span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-xs text-blue-600 hover:underline">Sửa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'departments' && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="grid grid-cols-3 gap-3">
            {departments.map((d) => (
              <div
                key={d.idKhoa}
                className="flex items-center justify-between p-3 border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
              >
                <span className="text-sm text-slate-700">{d.name}</span>
                <button className="text-xs text-blue-600 hover:underline">Sửa</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'suppliers' && (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 uppercase tracking-wide">
                <th className="px-4 py-3 text-left font-medium">Tên nhà cung cấp</th>
                <th className="px-4 py-3 text-left font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {suppliers.map((s) => (
                <tr key={s.idNcc} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-800">{s.name}</td>
                  <td className="px-4 py-3">
                    <button className="text-xs text-blue-600 hover:underline">Sửa</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal thêm model */}
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
              <h2 className="text-white font-bold">Thêm model thiết bị</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Tên model *</label>
                  <input
                    value={mName}
                    onChange={(e) => setMName(e.target.value)}
                    placeholder="vd: AQL-200"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Hãng sản xuất *</label>
                  <select
                    value={mManuId}
                    onChange={(e) => setMManuId(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  >
                    <option value="">— Chọn hãng —</option>
                    {manufacturers.map((m) => (
                      <option key={m.idHang} value={m.idHang}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Loại thiết bị</label>
                <input
                  value={mCategory}
                  onChange={(e) => setMCategory(e.target.value)}
                  placeholder="vd: Sinh phẩm, Hô hấp…"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Chu kỳ PM (ngày)</label>
                  <input
                    type="number"
                    value={mPm}
                    onChange={(e) => setMPm(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Chu kỳ HC (ngày)</label>
                  <input
                    type="number"
                    value={mHc}
                    onChange={(e) => setMHc(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500 mb-1.5 block">Dung sai HC (%)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={mTol}
                    onChange={(e) => setMTol(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50"
                >
                  Hủy
                </button>
                <button
                  onClick={submitCreateModel}
                  disabled={!mName || !mManuId}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-bold ${
                    !mName || !mManuId
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  Thêm model
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
