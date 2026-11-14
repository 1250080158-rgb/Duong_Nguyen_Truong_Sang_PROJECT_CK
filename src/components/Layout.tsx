import { useCallback, useEffect, useState } from 'react';
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from 'react-router';
import { api, getUser, logout, ROLE_HOME, ROLE_LABELS } from '../api/client';
import { OIDC_ENABLED, startLogout } from '../auth/oidc';
import type { RoleCode } from '../api/types';

// Vai trò → tiền tố đường dẫn được phép. Route ngoài tiền tố sẽ bị
// đưa về màn chính của vai trò (separation of duties ở tầng UI).
const ROLE_PREFIX: Record<RoleCode, string> = {
  DIEU_PHOI: '/coordinator',
  KY_THUAT_VIEN: '/technician',
  DAU_MOI_KHOA: '/department',
  ADMIN: '/admin',
};

const NAV_ITEMS: Record<RoleCode, { label: string; path: string; icon: string }[]> = {
  DIEU_PHOI: [
    { label: 'Bảng điều khiển', path: '/coordinator/dashboard', icon: '▦' },
    { label: 'Thiết bị toàn viện', path: '/coordinator/devices', icon: '⚕' },
    { label: 'Lịch bảo trì', path: '/coordinator/calendar', icon: '⊟' },
    { label: 'Phiếu công tác', path: '/coordinator/orders', icon: '☰' },
    { label: 'Nghiệm thu', path: '/coordinator/review', icon: '✓' },
    { label: 'Sự cố thiết bị', path: '/coordinator/incidents', icon: '⚠' },
    { label: 'Báo cáo', path: '/coordinator/reports', icon: '↗' },
  ],
  KY_THUAT_VIEN: [
    { label: 'Việc của tôi', path: '/technician/my-work', icon: '⊡' },
    { label: 'Lịch cá nhân', path: '/technician/calendar', icon: '⊟' },
  ],
  DAU_MOI_KHOA: [
    { label: 'Thiết bị khoa', path: '/department/devices', icon: '⚕' },
    { label: 'Phiếu của khoa', path: '/department/orders', icon: '☰' },
  ],
  ADMIN: [
    { label: 'Người dùng & vai trò', path: '/admin/users', icon: '◉' },
    { label: 'Danh mục nền', path: '/admin/catalog', icon: '▤' },
    { label: 'Báo cáo', path: '/admin/reports', icon: '↗' },
    { label: 'Cấu hình hệ thống', path: '/admin/config', icon: '⚙' },
    { label: 'Nhật ký kiểm toán', path: '/admin/audit', icon: '☷' },
  ],
};

const AVATAR_TEXT: Record<RoleCode, string> = {
  DIEU_PHOI: 'ĐP',
  KY_THUAT_VIEN: 'KT',
  DAU_MOI_KHOA: 'ĐM',
  ADMIN: 'AD',
};

// Biểu tượng theo nhóm thông báo, đọc từ trường `type` do API trả về.
const NOTIF_ICONS: Record<string, string> = {
  INCIDENT_MOI: '🔴',
  INCIDENT_TO_ORDER: '🟠',
  HC_QUA_HAN: '🔴',
  PM_DEN_HAN: '🟡',
  INCIDENT_TRA_LAI: '🟠',
  WO_CHO_NGHIEM_THU: '🟢',
};

interface NotificationItem {
  id: number;
  type: string;
  message: string;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const phut = Math.floor(diff / 60000);
  if (phut < 1) return 'Vừa xong';
  if (phut < 60) return `${phut} phút trước`;
  const gio = Math.floor(phut / 60);
  if (gio < 24) return `${gio} giờ trước`;
  const ngay = Math.floor(gio / 24);
  if (ngay === 1) return 'Hôm qua';
  return `${ngay} ngày trước`;
}

export default function Layout() {
  const user = getUser();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  // Thông báo lấy từ CSDL thật. Trước đây chuông này hiện 4 dòng viết
  // cứng trong mã nguồn, không liên quan gì tới dữ liệu của hệ thống —
  // người dùng bấm vào thấy nội dung bịa và không bao giờ thấy thông báo
  // thật (sự cố mới, thiết bị quá hạn, phiếu chờ nghiệm thu).
  const loadNotifs = useCallback(async () => {
    try {
      const data = await api<{ unread: number; items: NotificationItem[] }>('/notifications');
      setNotifs(data.items);
      setUnread(data.unread);
    } catch {
      // Không kéo được thông báo thì giữ trạng thái trước, không báo lỗi
      // chồng lên màn hình đang xem.
    }
  }, []);

  useEffect(() => {
    if (user) void loadNotifs();
  }, [user, loadNotifs]);

  // Chưa đăng nhập → về màn login
  if (!user) return <Navigate to="/login" replace />;

  // Route không thuộc vai trò → về màn chính của vai trò
  if (!location.pathname.startsWith(ROLE_PREFIX[user.role])) {
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }

  const navItems = NAV_ITEMS[user.role];
  const offline = sessionStorage.getItem('medequip_offline') === '1';

  function handleLogout() {
    sessionStorage.removeItem('medequip_offline');
    // Ở chế độ OIDC, phải đăng xuất cả ở Keycloak — nếu chỉ xoá phiên cục
    // bộ thì quay lại trang là dùng cookie Keycloak vào thẳng được.
    if (OIDC_ENABLED) {
      startLogout();
      return;
    }
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900 flex flex-col shrink-0">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-slate-700">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-blue-500 rounded flex items-center justify-center text-white text-xs font-bold">
              M
            </div>
            <div>
              <div className="text-white text-sm font-bold tracking-wide">MED-EQUIP</div>
              <div className="text-slate-400 text-[10px]">Quản lý thiết bị y tế</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          <div className="text-slate-500 text-[10px] uppercase tracking-widest mb-2">{ROLE_LABELS[user.role]}</div>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-2 py-2 rounded text-xs transition-colors ${
                  isActive
                    ? 'bg-slate-700 text-white font-medium'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800'
                }`
              }
            >
              <span className="text-base leading-none w-4 text-center">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User + logout */}
        <div className="px-4 py-3 border-t border-slate-700">
          {offline && (
            <div className="mb-2 text-[10px] text-amber-400 bg-amber-950/40 border border-amber-900 rounded-lg px-2 py-1">
              ⚡ Đang dùng dữ liệu mẫu — chưa kết nối máy chủ
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
              {AVATAR_TEXT[user.role]}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-white text-xs font-medium truncate">{user.fullName}</div>
              <div className="text-slate-500 text-[10px]">{ROLE_LABELS[user.role]}</div>
            </div>
            <button
              onClick={handleLogout}
              title="Đăng xuất"
              className="text-slate-400 hover:text-white text-sm px-1.5 py-1 rounded hover:bg-slate-800 transition-colors"
            >
              ⏻
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Topbar */}
        <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0">
          <div className="text-slate-500 text-sm">
            <span className="text-slate-800 font-medium">MED-EQUIP</span>
            <span className="mx-2 text-slate-300">/</span>
            <span>{ROLE_LABELS[user.role]}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-slate-400">
              {new Date().toLocaleDateString('vi-VN', {
                weekday: 'long',
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
              })}
            </div>
            <button
              onClick={() => {
                setNotifOpen(!notifOpen);
                if (!notifOpen) void loadNotifs();
              }}
              className="relative p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              title="Thông báo"
            >
              <span className="text-slate-500 text-base">🔔</span>
              {unread > 0 && (
                <span className="absolute top-0.5 right-0.5 min-w-3.5 h-3.5 px-1 bg-red-500 rounded-full text-white text-[8px] flex items-center justify-center font-bold">
                  {unread > 99 ? '99+' : unread}
                </span>
              )}
            </button>
            {notifOpen && (
              <div className="absolute top-12 right-4 w-80 bg-white border border-slate-200 rounded-xl shadow-xl z-50 overflow-hidden">
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-700">
                    Thông báo{unread > 0 ? ` (${unread} chưa đọc)` : ''}
                  </span>
                  {unread > 0 && (
                    <button
                      onClick={async () => {
                        try {
                          await api('/notifications/read-all', { method: 'POST' });
                          void loadNotifs();
                        } catch {
                          /* giữ nguyên nếu đánh dấu hỏng */
                        }
                      }}
                      className="text-[10px] text-blue-600 hover:underline"
                    >
                      Đánh dấu đã đọc
                    </button>
                  )}
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {notifs.length === 0 && (
                    <div className="px-4 py-6 text-center text-xs text-slate-400">
                      Chưa có thông báo nào.
                    </div>
                  )}
                  {notifs.map((n) => (
                    <div
                      key={n.id}
                      onClick={async () => {
                        if (!n.isRead) {
                          try {
                            await api(`/notifications/${n.id}/read`, { method: 'POST' });
                          } catch {
                            /* không chặn điều hướng */
                          }
                        }
                        if (n.link) {
                          setNotifOpen(false);
                          navigate(n.link);
                        }
                        void loadNotifs();
                      }}
                      className={`px-4 py-2.5 border-b border-slate-50 hover:bg-slate-50 cursor-pointer ${
                        n.isRead ? '' : 'bg-blue-50/50'
                      }`}
                    >
                      <div className="flex gap-2 items-start">
                        <span className="text-sm mt-0.5">{NOTIF_ICONS[n.type] ?? '🔵'}</span>
                        <div className="min-w-0">
                          <div className="text-xs text-slate-700">{n.message}</div>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {timeAgo(n.createdAt)}
                            {!n.isRead && ' · chưa đọc'}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
