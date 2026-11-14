import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import StatusBadge from '../components/StatusBadge';
import { STATUS_LABELS, devices } from '../data/mockData';
import type { DeviceStatus } from '../data/mockData';

// =====================================================================
// Test cho StatusBadge — nhãn tiếng Việt của từng trạng thái thiết bị là
// thứ người dùng nhìn thấy nhiều nhất, nên phải có nhãn cho đủ mọi mã
// trạng thái mà API có thể trả về.
// =====================================================================

describe('StatusBadge', () => {
  it('hiển thị nhãn tiếng Việt của trạng thái đang hoạt động', () => {
    render(<StatusBadge status="HOAT_DONG" />);
    expect(screen.getByText('ĐANG HOẠT ĐỘNG')).toBeInTheDocument();
  });

  it('hiển thị nhãn cho trạng thái chờ hiệu chuẩn', () => {
    render(<StatusBadge status="CHO_HIEU_CHUAN" />);
    expect(screen.getByText('CHỜ HIỆU CHUẨN')).toBeInTheDocument();
  });

  it('có nhãn tiếng Việt cho mọi mã trạng thái', () => {
    const allStatuses: DeviceStatus[] = ['HOAT_DONG', 'SAP_HAN', 'CHO_HIEU_CHUAN', 'DANG_SUA', 'THANH_LY'];

    for (const status of allStatuses) {
      const label = STATUS_LABELS[status];
      expect(label, `thiếu nhãn cho trạng thái ${status}`).toBeTruthy();
      // Nhãn phải có dấu tiếng Việt, không phải mã trần.
      expect(label).not.toBe(status);
    }
  });

  it('hiển thị đúng nhãn của thiết bị trong dữ liệu mẫu', () => {
    render(<StatusBadge status={devices[1].status} />);
    expect(screen.getByText(STATUS_LABELS[devices[1].status])).toBeInTheDocument();
  });
});
