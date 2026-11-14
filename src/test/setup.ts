// Thiết lập môi trường cho Vitest — nạp trước mỗi file test.
import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  // Dọn khoá phiên để test sau không thấy dữ liệu của test trước.
  localStorage.clear();
  sessionStorage.clear();
});
