import { useEffect, useState } from 'react';
import { users as mockUsers } from '../../data/mockData';
import { api, ApiError, apiOr, fmtDateTime } from '../../api/client';
import type { ApiUser, RoleCode } from '../../api/types';

// =====================================================================
// Màn NGƯỜI DÙNG & VAI TRÒ (admin) — GET /api/users?role&q. Vai trò từ
// API trả mã vai trò (ADMIN, DIEU_PHOI…) → quy đổi sang nhãn tiếng Việt để
// bộ lọc chạy được cả với dữ liệu mẫu. Mật khẩu do máy chủ xác thực quản lý.
// =====================================================================

const ROLE_CODE_TO_LABEL: Record<RoleCode, string> = {
  ADMIN: 'Quản trị hệ thống',
  DIEU_PHOI: 'Điều phối',
  KY_THUAT_VIEN: 'Kỹ thuật viên',
  DAU_MOI_KHOA: 'Đầu mối khoa',
};
const ROLE_LABELS_LIST = Object.values(ROLE_CODE_TO_LABEL);
const ROLE_LABEL_TO_CODE = Object.fromEntries(
  Object.entries(ROLE_CODE_TO_LABEL).map(([code, label]) => [label, code]),
) as Record<string, RoleCode>;

interface MappedUser {
  id: string;
  name: string;
  username: string;
  role: string; // nhãn tiếng Việt
  department: string;
  lastLogin: string;
  status: 'active' | 'inactive';
}

function mapApiUser(u: ApiUser): MappedUser {
  return {
    id: String(u.id),
    name: u.name,
    username: u.username,
    role: ROLE_CODE_TO_LABEL[u.role] ?? u.role,
    department: u.department ?? '—',
    lastLogin: u.lastLogin ? fmtDateTime(u.lastLogin) : 'Chưa từng',
    status: u.status,
  };
}

export default function UserManagement() {
  const [allUsers, setAllUsers] = useState<MappedUser[]>(() =>
    mockUsers.map((u) => ({
      ...u,
      status: u.status as MappedUser['status'],
    })),
  );
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('ALL');
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Nạp danh sách tài khoản. Hàm dùng lại cho nút "Đồng bộ Keycloak" —
  // trước đây nút này không có handler nên bấm không có gì xảy ra.
  const loadUsers = () =>
    apiOr<ApiUser[]>('/users', () => [])
      .then((list) => {
        if (list.length > 0) setAllUsers(list.map(mapApiUser));
        return list.length;
      })
      .catch(() => 0);

  useEffect(() => {
    void loadUsers();
  }, []);

  /** Đồng bộ tài khoản từ Keycloak — POST /api/users/sync-keycloak */
  const syncKeycloak = async () => {
    setBusyId('sync');
    setMessage(null);
    try {
      const res = await api<{
        total: number;
        created: number;
        updated: number;
        skipped: number;
        details: string[];
      }>('/users/sync-keycloak', { method: 'POST' });
      setMessage({
        type: 'ok',
        text: `Đã đồng bộ ${res.total} tài khoản từ Keycloak: tạo ${res.created}, cập nhật ${res.updated}, bỏ qua ${res.skipped}.`,
      });
      const list = await apiOr<ApiUser[]>('/users', () => []);
      if (list.length > 0) setAllUsers(list.map(mapApiUser));
    } catch (err) {
      setMessage({
        type: 'err',
        text:
          err instanceof ApiError
            ? `[${err.code}] ${err.message}`
            : 'Không đồng bộ được — kiểm tra kết nối máy chủ.',
      });
    } finally {
      setBusyId(null);
    }
  };

  /** Đổi vai trò nghiệp vụ — PUT /api/users/{id}/role */
  const changeRole = async (user: MappedUser, roleLabel: string) => {
    const role = ROLE_LABEL_TO_CODE[roleLabel];
    if (!role || role === user.role) return;
    setBusyId(user.id);
    setMessage(null);
    try {
      await api(`/users/${user.id}/role`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      });
      setAllUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: roleLabel } : u)));
      setMessage({ type: 'ok', text: `Đã đổi vai trò của ${user.name} thành ${roleLabel}.` });
    } catch (e) {
      setMessage({
        type: 'err',
        text: e instanceof Error ? e.message : 'Không đổi được vai trò. Vui lòng thử lại.',
      });
    } finally {
      setBusyId(null);
    }
  };

  /** Khoá / mở khoá tài khoản — PUT /api/users/{id}/status */
  const toggleStatus = async (user: MappedUser) => {
    const active = user.status !== 'active';
    setBusyId(user.id);
    setMessage(null);
    try {
      await api(`/users/${user.id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ active }),
      });
      setAllUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, status: active ? 'active' : 'inactive' } : u)),
      );
      setMessage({
        type: 'ok',
        text: active ? `Đã mở khoá tài khoản ${user.name}.` : `Đã khoá tài khoản ${user.name}.`,
      });
    } catch (e) {
      setMessage({
        type: 'err',
        text: e instanceof Error ? e.message : 'Không cập nhật được trạng thái. Vui lòng thử lại.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const filtered = allUsers.filter((u) => {
    const matchSearch =
      !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase());
    const matchRole = roleFilter === 'ALL' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const inactive = allUsers.filter((u) => u.status === 'inactive');

  return (
    <div className="p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Người dùng & Vai trò</h1>
          <p className="text-sm text-slate-500 mt-0.5">Đồng bộ từ Keycloak · {allUsers.length} tài khoản</p>
        </div>
        <button
          onClick={() => void syncKeycloak()}
          disabled={busyId === 'sync'}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {busyId === 'sync' ? 'Đang đồng bộ…' : '🔄 Đồng bộ Keycloak'}
        </button>
      </div>

      {message && (
        <div
          className={`rounded-xl px-4 py-3 text-xs border ${
            message.type === 'ok'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-xs text-blue-700">
        <strong>Keycloak SSO:</strong> Mật khẩu và xác thực được quản lý tập trung qua OIDC. Không đặt mật khẩu trực
        tiếp trong ứng dụng này. Quản trị viên chỉ gán vai trò và khoa phụ trách.
      </div>

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔍</span>
          <input
            type="text"
            placeholder="Tìm theo tên hoặc tên đăng nhập..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 focus:outline-none"
        >
          <option value="ALL">Tất cả vai trò</option>
          {ROLE_LABELS_LIST.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </select>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-[11px] text-slate-500 uppercase tracking-wide">
              <th className="px-4 py-3 text-left font-medium">Người dùng</th>
              <th className="px-4 py-3 text-left font-medium">Tên đăng nhập</th>
              <th className="px-4 py-3 text-left font-medium">Vai trò</th>
              <th className="px-4 py-3 text-left font-medium">Khoa / Bộ phận</th>
              <th className="px-4 py-3 text-left font-medium">Đăng nhập cuối</th>
              <th className="px-4 py-3 text-left font-medium">Trạng thái</th>
              <th className="px-4 py-3 text-left font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-bold shrink-0">
                      {u.name.split(' ').slice(-1)[0][0]}
                    </div>
                    <span className="font-medium text-slate-800">{u.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-slate-600">{u.username}</td>
                <td className="px-4 py-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      u.role === 'Quản trị hệ thống'
                        ? 'bg-red-100 text-red-700'
                        : u.role === 'Điều phối'
                          ? 'bg-purple-100 text-purple-700'
                          : u.role === 'Kỹ thuật viên'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-green-100 text-green-700'
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600">{u.department}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">{u.lastLogin}</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      u.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${u.status === 'active' ? 'bg-green-500' : 'bg-slate-400'}`}
                    />
                    {u.status === 'active' ? 'Hoạt động' : 'Đã khóa'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <select
                      value={u.role}
                      disabled={busyId === u.id}
                      onChange={(e) => void changeRole(u, e.target.value)}
                      className="text-xs px-2 py-1 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {ROLE_LABELS_LIST.map((r) => (
                        <option key={r}>{r}</option>
                      ))}
                    </select>
                    <button
                      disabled={busyId === u.id}
                      onClick={() => void toggleStatus(u)}
                      className={`text-xs hover:underline disabled:opacity-50 ${
                        u.status === 'active' ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {u.status === 'active' ? 'Khoá tài khoản' : 'Mở khoá'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {inactive.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-xs text-yellow-700">
          <strong>Cảnh báo:</strong> {inactive.length} tài khoản không hoạt động (
          {inactive.map((u) => u.username).join(', ')}). Theo chính sách bảo mật, tài khoản sẽ tự động vô hiệu hóa sau
          90 ngày không đăng nhập.
        </div>
      )}
    </div>
  );
}
