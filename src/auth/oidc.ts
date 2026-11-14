// =====================================================================
// Lớp bọc OIDC (OpenID Connect) dùng oidc-client-ts, nối vào Keycloak.
//
// Vì sao cần lớp này:
//  - Luồng chuẩn là Authorization Code + PKCE: trình duyệt chuyển người
//    dùng tới Keycloak, đăng nhập xong Keycloak chuyển lại mã, ứng dụng
//    đổi mã lấy access token. Mật khẩu không bao giờ đi qua app.
//  - Token được oidc-client-ts tự làm mới trước khi hết hạn, nên các
//    request API không phải lo chuyện hết phiên.
//
// Ứng dụng chạy được ở cả hai chế độ, chuyển qua biến môi trường
// VITE_OIDC_ENABLED. Bật lên là dùng Keycloak, tắt đi thì quay về
// đăng nhập dev bằng mật khẩu như trước.
// =====================================================================
import { UserManager, WebStorageStateStore, type User } from 'oidc-client-ts';

const env = (import.meta as { env?: Record<string, string> }).env ?? {};

export const OIDC_ENABLED = env.VITE_OIDC_ENABLED === 'true';

const authority = env.VITE_OIDC_AUTHORITY ?? 'http://localhost:8080/realms/medequip';
const clientId = env.VITE_OIDC_CLIENT_ID ?? 'medequip-ui';
const redirectUri = env.VITE_OIDC_REDIRECT_URI ?? `${window.location.origin}/auth/callback`;
const postLogoutRedirectUri = env.VITE_OIDC_POST_LOGOUT_REDIRECT_URI ?? `${window.location.origin}/login`;

let userManager: UserManager | null = null;

/**
 * UserManager chỉ khởi tạo khi thực sự bật OIDC. oidc-client-ts đọc
 * sessionStorage ngay lúc tạo nên phải trả về null khi tắt, tránh đụng
 * storage trong môi trường không có Keycloak.
 */
export function getUserManager(): UserManager | null {
  if (!OIDC_ENABLED) return null;
  if (userManager) return userManager;

  userManager = new UserManager({
    authority,
    client_id: clientId,
    // Public client: không có secret phía trình duyệt, bắt buộc dùng PKCE.
    response_type: 'code',
    redirect_uri: redirectUri,
    post_logout_redirect_uri: postLogoutRedirectUri,
    scope: env.VITE_OIDC_SCOPE ?? 'openid profile email',
    // Tự làm mới token; không dùng refresh token ở trình duyệt.
    automaticSilentRenew: true,
    // refresh_token: vẫn cần cho lần tải trang sau, nhưng token không gửi
    // qua cookie nào nên không tạo rủi ro CSRF kiểu session.
    loadUserInfo: false,
    userStore: new WebStorageStateStore({ store: window.sessionStorage }),
    stateStore: new WebStorageStateStore({ store: window.sessionStorage }),
  });

  return userManager;
}

/** Đang đứng ở trang callback không (có mã trả về từ IdP). */
export function isCallbackUrl(): boolean {
  const params = new URLSearchParams(window.location.search);
  return params.has('code') && params.has('state');
}

/** Chuyển hướng sang trang đăng nhập của Keycloak. */
export async function startLogin(): Promise<void> {
  const mgr = getUserManager();
  if (!mgr) return;
  await mgr.signinRedirect();
}

/**
 * Xử lý mã trả về sau khi đăng nhập. Trả về true nếu đăng nhập thành công.
 * oidc-client-ts dọn query string khỏi URL nên gọi một lần rồi bỏ.
 */
export async function completeLogin(): Promise<User | null> {
  const mgr = getUserManager();
  if (!mgr) return null;
  try {
    return await mgr.signinRedirectCallback();
  } catch {
    return null;
  }
}

/** Access token hiện tại, tự làm mới nếu sắp hết hạn. Null nếu chưa đăng nhập. */
export async function getAccessToken(): Promise<string | null> {
  const mgr = getUserManager();
  if (!mgr) return null;
  const user = await mgr.getUser();
  if (!user || user.expired) return null;
  return user.access_token;
}

/** Người dùng đang đăng nhập, null nếu chưa có phiên. */
export async function getOidcUser(): Promise<User | null> {
  const mgr = getUserManager();
  if (!mgr) return null;
  return mgr.getUser();
}

/** Đăng xuất — vừa xoá phiên cục bộ vừa chuyển tới trang logout của Keycloak. */
export async function startLogout(): Promise<void> {
  const mgr = getUserManager();
  if (!mgr) return;
  await mgr.signoutRedirect();
}
