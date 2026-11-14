/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'node:path';

// Cấu hình riêng cho Vitest, tách khỏi vite.config.ts vì file đó kèm
// các plugin của Figma Make (chỉ dùng khi chạy `vite`/`vite build`).
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    // jsdom mô phỏng trình duyệt: component cần document, window, localStorage.
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', 'dist/**', 'src/data/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      // Không ép đạt ngưỡng phủ: báo cáo để xem, không chặn commit.
    },
  },
});
