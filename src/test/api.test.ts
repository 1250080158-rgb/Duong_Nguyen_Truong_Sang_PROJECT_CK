import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Bộ test này kiểm tra nhánh đăng nhập bằng mật khẩu tại /login, nên phải
// tắt OIDC. Không mock thì kết quả phụ thuộc vào VITE_OIDC_ENABLED trong
// .env.local của máy lập trình viên: bật OIDC thì currentToken() đọc token
// từ oidc-client-ts thay vì localStorage và test hỏng vì lý do không liên
// quan tới hàm đang kiểm tra.
vi.mock('../auth/oidc', () => ({
  OIDC_ENABLED: false,
  getAccessToken: async () => null,
  startLogin: () => {},
  startLogout: () => {},
}));

import { api, apiOr, ApiError } from '../api/client';

// =====================================================================
// Test cho tầng gọi API. Điểm quan trọng nhất: lỗi nghiệp vụ từ máy chủ
// (ApiError) KHÔNG được rơi về dữ liệu mẫu, còn lỗi mạng thì phải rơi
// về — nếu lẫn hai loại này thì người dùng sẽ thấy dữ liệu giả như
// dữ liệu thật, rất nguy hiểm trong hệ thống quản lý thiết bị.
// =====================================================================

const originalFetch = globalThis.fetch;

function mockFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  globalThis.fetch = vi.fn(impl) as unknown as typeof fetch;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('api', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('trả về dữ liệu khi máy chủ trả 200', async () => {
    mockFetch(async () => jsonResponse({ chainIntact: true, items: [] }));

    const result = await api<{ chainIntact: boolean }>('/audit');
    expect(result.chainIntact).toBe(true);
  });

  it('gắn access token lưu trong phiên vào header Authorization', async () => {
    localStorage.setItem('medequip_token', 'token-abc');
    let seenAuth: string | null = null;

    mockFetch(async (_url, init) => {
      seenAuth = new Headers(init?.headers).get('Authorization');
      return jsonResponse({});
    });

    await api('/devices');
    expect(seenAuth).toBe('Bearer token-abc');
  });

  it('không gắn header Authorization khi chưa đăng nhập', async () => {
    let seenAuth: string | null = 'chưa-set';
    mockFetch(async (_url, init) => {
      seenAuth = new Headers(init?.headers).get('Authorization');
      return jsonResponse({});
    });

    await api('/devices');
    expect(seenAuth).toBeNull();
  });

  it('ném ApiError khi máy chủ trả mã nghiệp vụ 422', async () => {
    mockFetch(async () =>
      jsonResponse(
        {
          code: 'CALIBRATION_OVERDUE',
          message: 'Thiết bị đang bị khóa chờ hiệu chuẩn.',
          details: { equipmentId: 2 },
          actions: ['CREATE_CALIBRATION_ORDER'],
        },
        422,
      ),
    );

    await expect(api('/work-orders', { method: 'POST' })).rejects.toThrow(ApiError);

    try {
      await api('/work-orders', { method: 'POST' });
    } catch (e) {
      expect((e as ApiError).code).toBe('CALIBRATION_OVERDUE');
      expect((e as ApiError).status).toBe(422);
    }
  });

  it('xóa phiên khi máy chủ trả 401', async () => {
    localStorage.setItem('medequip_token', 'token-het-han');
    localStorage.setItem('medequip_user', '{"id":1}');
    mockFetch(async () => jsonResponse({ code: 'NO_SUBJECT' }, 401));

    await expect(api('/devices')).rejects.toThrow(ApiError);
    // Token và hồ sơ phải bị dọn để App đưa người dùng về màn đăng nhập.
    expect(localStorage.getItem('medequip_token')).toBeNull();
    expect(localStorage.getItem('medequip_user')).toBeNull();
  });

  it('trả undefined khi máy chủ trả 204', async () => {
    mockFetch(async () => new Response(null, { status: 204 }));
    await expect(api('/assignments/1', { method: 'DELETE' })).resolves.toBeUndefined();
  });

  it('không ép Content-Type khi gửi FormData', async () => {
    // Đặt Content-Type thủ công sẽ làm mất ranh giới multipart, khiến
    // máy chủ không đọc được file tải lên.
    let contentType: string | null = 'chưa-set';
    mockFetch(async (_url, init) => {
      contentType = new Headers(init?.headers).get('Content-Type');
      return jsonResponse({});
    });

    const form = new FormData();
    form.append('file', new Blob(['x']), 'hinh.png');
    await api('/work-orders/HC-1/evidence', { method: 'POST', body: form });

    expect(contentType).toBeNull();
  });
});

describe('apiOr — rơi về dữ liệu mẫu', () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('dùng dữ liệu thật khi máy chủ đang chạy', async () => {
    mockFetch(async () => jsonResponse([{ id: 1 }]));
    const rows = await apiOr('/devices', () => [{ id: 99 }]);
    expect(rows).toEqual([{ id: 1 }]);
  });

  it('rơi về dữ liệu mẫu khi không kết nối được máy chủ', async () => {
    mockFetch(async () => {
      throw new TypeError('fetch failed');
    });
    const rows = await apiOr('/devices', () => [{ id: 99 }]);
    expect(rows).toEqual([{ id: 99 }]);
  });

  it('KHÔNG rơi về dữ liệu mẫu khi gặp lỗi nghiệp vụ', async () => {
    // Đây là hành vi quan trọng nhất: lỗi 422 phải nổi lên để UI hiện
    // thông báo chặn của BR-01, không được giả làm có dữ liệu.
    mockFetch(async () => jsonResponse({ code: 'CALIBRATION_OVERDUE', message: 'bị chặn' }, 422));

    await expect(apiOr('/work-orders', () => [])).rejects.toThrow(ApiError);
  });
});
