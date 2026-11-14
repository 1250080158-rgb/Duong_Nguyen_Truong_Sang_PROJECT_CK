import { useState } from 'react';
import { useNavigate } from 'react-router';
import { api, ApiError, setUser, ROLE_HOME, ROLE_LABELS } from '../api/client';
import { OIDC_ENABLED, startLogin } from '../auth/oidc';
import type { CurrentUser, RoleCode, LoginResponse } from '../api/types';

// =====================================================================
// Màn ĐĂNG NHẬP.
//
// Hai chế độ, chọn bằng biến môi trường VITE_OIDC_ENABLED:
//   • OIDC (bản thật): nút duy nhất "Đăng nhập bằng tài khoản viện" chuyển
//     sang Keycloak (Authorization Code + PKCE). Mật khẩu không đi qua app.
//   • Dev (bản chạy nhanh): form tài khoản/mật khẩu trỏ thẳng vào
//     POST /api/auth/login; backend chưa chạy thì rơi về dữ liệu mẫu.
// Tài khoản dev khớp DbSeeder.cs.
// =====================================================================

const DEMO_ACCOUNTS: { username: string; password: string; fullName: string; role: RoleCode; department?: string }[] = [
  {
    username: 'dphuong',
    password: '123456',
    fullName: 'Phạm Thị Diễm Phương',
    role: 'DIEU_PHOI',
    department: 'Phòng VTYT',
  },
  {
    username: 'minhvt',
    password: '123456',
    fullName: 'Nguyễn Minh Vĩnh Thịnh',
    role: 'KY_THUAT_VIEN',
    department: 'Phòng VTYT',
  },
  {
    username: 'vanna',
    password: '123456',
    fullName: 'Nguyễn Thị Ánh Vân',
    role: 'DAU_MOI_KHOA',
    department: 'Hóa sinh',
  },
  { username: 'longhduc', password: '123456', fullName: 'Hoàng Đức Long', role: 'ADMIN', department: 'CNTT' },
];

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function enter(user: CurrentUser, token: string | null, offline = false) {
    setUser(user);
    if (token) localStorage.setItem('medequip_token', token);
    navigate(ROLE_HOME[user.role], { replace: true });
    if (offline) sessionStorage.setItem('medequip_offline', '1');
  }

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    if (!username || !password || loading) return;
    setLoading(true);
    setError(null);

    api<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    })
      .then((res) => enter(res.user, res.token))
      .catch((err) => {
        if (err instanceof ApiError) {
          setError(err.message);
          setLoading(false);
          return;
        }
        // TypeError: fetch failed → backend chưa chạy → demo offline
        const demo = DEMO_ACCOUNTS.find((a) => a.username === username.trim());
        if (demo && password === demo.password) {
          enter(
            { id: 0, username: demo.username, fullName: demo.fullName, role: demo.role, department: demo.department },
            null,
            true,
          );
          return;
        }
        setError(
          'Không kết nối được máy chủ. Dùng tài khoản thử (dphuong / minhvt / vanna / longhduc — mật khẩu "123456") để xem với dữ liệu mẫu.',
        );
        setLoading(false);
      });
  }

  function quickLogin(account: (typeof DEMO_ACCOUNTS)[0]) {
    setUsername(account.username);
    setPassword(account.password);
    setError(null);
    // Thử đăng nhập thật; backend không chạy thì vào demo offline luôn.
    setLoading(true);
    api<LoginResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: account.username, password: account.password }),
    })
      .then((res) => enter(res.user, res.token))
      .catch((err) => {
        if (err instanceof ApiError) {
          setError(err.message);
          setLoading(false);
          return;
        }
        enter(
          {
            id: 0,
            username: account.username,
            fullName: account.fullName,
            role: account.role,
            department: account.department,
          },
          null,
          true,
        );
      });
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-6 justify-center">
          <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center text-white font-bold text-lg">
            M
          </div>
          <div>
            <div className="text-white text-lg font-bold tracking-wide">MED-EQUIP</div>
            <div className="text-slate-400 text-xs">Quản lý thiết bị y tế toàn viện</div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          <div className="px-6 pt-6 pb-2">
            <h1 className="text-base font-bold text-slate-800">Đăng nhập</h1>
            <p className="text-xs text-slate-400 mt-1">
              {OIDC_ENABLED
                ? 'Tài khoản do phòng CNTT quản lý, đăng nhập qua máy chủ xác thực dùng chung'
                : 'Chế độ chạy thử nhanh — tài khoản do phòng CNTT cấp'}
            </p>
          </div>

          {OIDC_ENABLED ? (
            <div className="px-6 pb-6 pt-4">
              <button
                type="button"
                onClick={() => startLogin()}
                className="w-full py-3 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700 transition-colors"
              >
                Đăng nhập bằng tài khoản viện
              </button>
              <p className="text-[11px] text-slate-400 mt-3 text-center leading-relaxed">
                Bạn sẽ được chuyển tới trang đăng nhập chung. Sau khi xác thực xong, hệ thống đưa bạn về đúng màn hình
                theo vai trò được phân công.
              </p>
            </div>
          ) : (
            <form onSubmit={submit} className="px-6 pb-6 pt-3 space-y-4">
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Tên đăng nhập</label>
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="ví dụ: dphuong"
                  autoFocus
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 mb-1.5 block">Mật khẩu</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5 text-xs text-red-700">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={!username || !password || loading}
                className={`w-full py-3 rounded-xl text-sm font-bold transition-colors ${
                  !username || !password || loading
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
              >
                {loading ? 'Đang đăng nhập…' : 'Đăng nhập'}
              </button>
            </form>
          )}

          {/* Vào nhanh theo vai trò — chỉ có ở chế độ chạy thử */}
          {!OIDC_ENABLED && (
            <div className="bg-slate-50 border-t border-slate-100 px-6 py-4">
              <div className="text-[10px] text-slate-400 uppercase tracking-widest mb-2">Vào nhanh bản thử</div>
              <div className="grid grid-cols-2 gap-2">
                {DEMO_ACCOUNTS.map((a) => (
                  <button
                    key={a.username}
                    onClick={() => quickLogin(a)}
                    className="text-left px-3 py-2 rounded-xl border border-slate-200 bg-white hover:border-blue-300 hover:bg-blue-50 transition-colors"
                  >
                    <div className="text-xs font-semibold text-slate-700">{ROLE_LABELS[a.role]}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{a.username} / 123456</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {!OIDC_ENABLED && (
          <p className="text-center text-[11px] text-slate-500 mt-4">
            Khi backend chưa chạy, nút vào nhanh sẽ mở chế độ <strong>dữ liệu mẫu</strong>.
          </p>
        )}
      </div>
    </div>
  );
}
