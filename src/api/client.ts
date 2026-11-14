// =====================================================================
// Tầng API client — cầu nối giữa UI React và ASP.NET Core backend.
// Quy tắc: mọi call thử API trước (http://localhost:5000/api); nếu backend
// chưa chạy (lỗi mạng/fetch) thì rơi về fallback cục bộ để demo UI vẫn hoạt
// động. Khi backend chạy, dữ liệu thật từ PostgreSQL được dùng.
//
// Token: ở chế độ OIDC, access token do Keycloak cấp được lấy đồng bộ
// trước mỗi request (oidc-client-ts tự làm mới khi sắp hết hạn). Ở chế độ
// dev, token lưu trong localStorage như cũ.
// =====================================================================
import { getAccessToken, OIDC_ENABLED } from '../auth/oidc';

export const API_BASE: string =
  (import.meta as { env?: Record<string, string> }).env?.VITE_API_BASE ?? 'http://localhost:5000/api';

const TOKEN_KEY = 'medequip_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

/** Lấy access token để gắn vào header Authorization. */
async function currentToken(): Promise<string | null> {
  if (OIDC_ENABLED) return getAccessToken();
  return getToken();
}

/** Lỗi nghiệp vụ từ API — đúng hợp đồng { code, message, details, actions } */
export class ApiError extends Error {
  code: string;
  status: number;
  details: unknown;
  actions?: string[];

  constructor(status: number, body: { code?: string; message?: string; details?: unknown; actions?: string[] }) {
    super(body.message ?? `Lỗi API ${status}`);
    this.code = body.code ?? 'UNKNOWN';
    this.status = status;
    this.details = body.details;
    this.actions = body.actions;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  const token = await currentToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init?.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');

  const res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  if (res.status === 401) {
    // Phiên hết hạn hoặc bị thu hồi: xoá token để App đưa người dùng về
    // màn đăng nhập thay vì để mọi màn trắng.
    setToken(null);
    setUser(null);
  }
  if (!res.ok) {
    let body: { code?: string; message?: string; details?: unknown; actions?: string[] } = {};
    try {
      body = await res.json();
    } catch {
      /* body rỗng */
    }
    throw new ApiError(res.status, body);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

/** Gọi API, nếu backend không chạy thì dùng fallback cục bộ (demo offline). */
export async function apiOr<T>(path: string, fallback: () => T, init?: RequestInit): Promise<T> {
  try {
    return await api<T>(path, init);
  } catch (e) {
    if (e instanceof ApiError) throw e; // lỗi nghiệp vụ thật — KHÔNG fallback
    // TypeError: fetch failed = backend chưa chạy → fallback mock
    if (e instanceof TypeError) return fallback();
    throw e;
  }
}

// =====================================================================
// Phiên đăng nhập: JWT (token) + hồ sơ user lưu localStorage.
// Offline demo không có backend → user giả lập không có token.
// =====================================================================
import type { CurrentUser, RoleCode } from './types';

const USER_KEY = 'medequip_user';

export function getUser(): CurrentUser | null {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) ?? 'null') as CurrentUser;
  } catch {
    return null;
  }
}

export function setUser(user: CurrentUser | null) {
  if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  else localStorage.removeItem(USER_KEY);
}

export function logout() {
  setToken(null);
  setUser(null);
}

/**
 * Lấy hồ sơ người dùng hiện tại từ API (đọc claim trong access token).
 * Dùng sau khi Keycloak trả callback, để biết vai trò nghiệp vụ mà
 * backend đã dịch từ realm_access.roles.
 */
export async function fetchCurrentUser(): Promise<CurrentUser> {
  return api<CurrentUser>('/auth/me');
}

export const ROLE_LABELS: Record<RoleCode, string> = {
  ADMIN: 'Quản trị hệ thống',
  DIEU_PHOI: 'Điều phối',
  KY_THUAT_VIEN: 'Kỹ thuật viên',
  DAU_MOI_KHOA: 'Đầu mối khoa',
};

/** Nhãn ưu tiên phiếu công tác */
export const PRIORITY_LABELS: Record<'BINH_THUONG' | 'KHAN', string> = {
  BINH_THUONG: 'Bình thường',
  KHAN: 'Khẩn cấp',
};

/** Nhãn trạng thái phiếu công tác */
export const WORK_ORDER_STATUS_LABELS: Record<
  'CHO_PHAN_CONG' | 'DANG_THUC_HIEN' | 'CHO_NGHIEM_THU' | 'HOAN_THANH' | 'TRA_LAI',
  string
> = {
  CHO_PHAN_CONG: 'Chờ phân công',
  DANG_THUC_HIEN: 'Đang thực hiện',
  CHO_NGHIEM_THU: 'Chờ nghiệm thu',
  HOAN_THANH: 'Hoàn thành',
  TRA_LAI: 'Trả lại',
};

/** Nhãn loại phiếu công tác */
export const WORK_ORDER_TYPE_LABELS: Record<'PM' | 'SC' | 'HC' | 'KT', string> = {
  PM: 'Bảo trì định kỳ',
  SC: 'Sửa chữa',
  HC: 'Hiệu chuẩn',
  KT: 'Kiểm định',
};

/** Màn hình đầu tiên sau đăng nhập theo vai trò. */
export const ROLE_HOME: Record<RoleCode, string> = {
  ADMIN: '/admin/users',
  DIEU_PHOI: '/coordinator/dashboard',
  KY_THUAT_VIEN: '/technician/my-work',
  DAU_MOI_KHOA: '/department/devices',
};

// =====================================================================
// Xuất dữ liệu ra tệp CSV (mở được bằng Excel).
// BOM UTF-8 ở đầu tệp để Excel nhận đúng tiếng Việt có dấu.
// =====================================================================
export interface CsvColumn<T> {
  key: string;
  label: string;
  value: (row: T) => string | number | boolean | null | undefined;
}

export function downloadCsv<T>(filename: string, rows: T[], columns: CsvColumn<T>[]): void {
  const escape = (v: string | number | boolean | null | undefined): string => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };

  const header = columns.map((c) => escape(c.label)).join(';');
  const body = rows.map((r) => columns.map((c) => escape(c.value(r))).join(';')).join('\r\n');
  const csv = `﻿${header}\r\n${body}`;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// =====================================================================
// Format ngày: backend trả ISO ('yyyy-MM-dd' cho DateOnly,
// 'yyyy-MM-ddTHH:mm:ss' cho DateTime) → hiển thị dd/MM/yyyy.
// =====================================================================
export function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
}

export function fmtDateTime(iso?: string | null): string {
  if (!iso) return '—';
  const date = fmtDate(iso);
  const time = iso.includes('T') ? iso.slice(11, 16) : '';
  return time ? `${date} ${time}` : date;
}
