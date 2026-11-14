import { describe, it, expect } from 'vitest';
import { isCallbackUrl } from '../auth/oidc';

// =====================================================================
// Test cho phần nhận diện URL callback của OIDC. Hàm này quyết định
// có đưa người dùng vào luồng đổi mã lấy token hay không, nên phải
// phân biệt chính xác URL có mã và URL bình thường.
// =====================================================================

function setUrl(url: string) {
  window.history.replaceState({}, '', url);
}

describe('isCallbackUrl', () => {
  it('nhận ra URL có cả code và state', () => {
    setUrl('/auth/callback?code=abc123&state=xyz');
    expect(isCallbackUrl()).toBe(true);
  });

  it('trả false với URL chỉ có code nhưng thiếu state', () => {
    // Thiếu state nghĩa là không khớp state đã lưu, phải coi như
    // không phải callback hợp lệ.
    setUrl('/auth/callback?code=abc123');
    expect(isCallbackUrl()).toBe(false);
  });

  it('trả false với URL chỉ có state nhưng thiếu code', () => {
    setUrl('/auth/callback?state=xyz');
    expect(isCallbackUrl()).toBe(false);
  });

  it('trả false với trang đăng nhập bình thường', () => {
    setUrl('/login');
    expect(isCallbackUrl()).toBe(false);
  });

  it('trả false khi không có tham số nào', () => {
    setUrl('/coordinator/dashboard');
    expect(isCallbackUrl()).toBe(false);
  });
});
