import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { completeLogin, OIDC_ENABLED } from '../auth/oidc';
import { fetchCurrentUser, ROLE_HOME, setUser } from '../api/client';

// =====================================================================
// Trang nhận callback từ Keycloak (Authorization Code + PKCE).
// Keycloak chuyển về /auth/callback?code=...&state=...; ở đây đổi mã
// lấy token, hỏi API vai trò nghiệp vụ rồi vào màn theo vai trò.
// =====================================================================
export default function AuthCallback() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!OIDC_ENABLED) {
        navigate('/login', { replace: true });
        return;
      }

      const user = await completeLogin();
      if (!user) {
        if (!cancelled) setError('Không nhận được mã đăng nhập từ máy chủ xác thực.');
        return;
      }

      try {
        // API là nguồn quyết định vai trò nghiệp vụ, không phải IdP.
        const profile = await fetchCurrentUser();
        if (cancelled) return;
        setUser(profile);
        navigate(ROLE_HOME[profile.role], { replace: true });
      } catch {
        if (!cancelled) setError('Đăng nhập thành công nhưng không lấy được hồ sơ người dùng.');
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="bg-white rounded-2xl shadow-2xl px-6 py-8">
          {error ? (
            <>
              <div className="text-3xl mb-3" aria-hidden="true">
                ⚠
              </div>
              <h1 className="text-base font-bold text-slate-800 mb-1">Đăng nhập không thành công</h1>
              <p className="text-xs text-slate-500 mb-5">{error}</p>
              <a
                href="/login"
                className="inline-block w-full py-2.5 rounded-xl text-sm font-bold bg-blue-600 text-white hover:bg-blue-700"
              >
                Quay lại màn đăng nhập
              </a>
            </>
          ) : (
            <>
              <div className="w-10 h-10 mx-auto mb-4 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin" />
              <h1 className="text-base font-bold text-slate-800 mb-1">Đang xác thực</h1>
              <p className="text-xs text-slate-500">Vui lòng đợi trong giây lát…</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
