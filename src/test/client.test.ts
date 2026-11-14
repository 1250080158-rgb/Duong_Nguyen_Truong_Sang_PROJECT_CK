import { describe, it, expect } from 'vitest';
import { fmtDate, fmtDateTime, ApiError, getUser, setUser, ROLE_HOME, ROLE_LABELS } from '../api/client';
import type { RoleCode } from '../api/types';

// =====================================================================
// Test cho tầng tiện ích của API client — nơi quyết định ngày tháng có
// hiển thị đúng kiểu Việt Nam hay không, và lỗi API có giữ nguyên mã
// nghiệp vụ để UI hiển thị đúng không.
// =====================================================================

describe('fmtDate', () => {
  it('chuyển ngày ISO sang dd/MM/yyyy', () => {
    expect(fmtDate('2026-09-29')).toBe('29/09/2026');
  });

  it('giữ nguyên phần giờ nếu chuỗi có "T"', () => {
    // DateOnly không có giờ; DateTime thì có. Hàm chỉ cắt 10 ký tự đầu.
    expect(fmtDate('2026-01-05T08:30:00')).toBe('05/01/2026');
  });

  it('trả về gạch dài khi không có dữ liệu', () => {
    expect(fmtDate(null)).toBe('—');
    expect(fmtDate(undefined)).toBe('—');
    expect(fmtDate('')).toBe('—');
  });

  it('giữ nguyên chuỗi lạ để không mất dữ liệu', () => {
    expect(fmtDate('abc')).toBe('abc');
  });
});

describe('fmtDateTime', () => {
  it('hiển thị ngày kèm giờ phút', () => {
    expect(fmtDateTime('2026-09-29T14:35:00')).toBe('29/09/2026 14:35');
  });

  it('bỏ phần giờ nếu chuỗi chỉ có ngày', () => {
    expect(fmtDateTime('2026-09-29')).toBe('29/09/2026');
  });

  it('trả về gạch dài khi không có dữ liệu', () => {
    expect(fmtDateTime(null)).toBe('—');
  });

  it('giữ đúng giờ có số 0 ở đầu', () => {
    // Cắt chuỗi chứ không parse rồi format, nên 08:05 phải giữ nguyên 0.
    expect(fmtDateTime('2026-09-29T08:05:00')).toBe('29/09/2026 08:05');
  });
});

describe('ApiError', () => {
  it('giữ mã nghiệp vụ do API trả về', () => {
    const err = new ApiError(422, {
      code: 'CALIBRATION_OVERDUE',
      message: 'Thiết bị đang bị khóa chờ hiệu chuẩn.',
      details: { equipmentId: 2 },
      actions: ['CREATE_CALIBRATION_ORDER'],
    });

    expect(err.code).toBe('CALIBRATION_OVERDUE');
    expect(err.status).toBe(422);
    expect(err.details).toEqual({ equipmentId: 2 });
    expect(err.actions).toEqual(['CREATE_CALIBRATION_ORDER']);
    expect(err.message).toBe('Thiết bị đang bị khóa chờ hiệu chuẩn.');
  });

  it('có mã dự phòng khi API không trả mã lỗi', () => {
    // 500 thường đến từ proxy với body rỗng; UI vẫn cần thông điệp hiển thị được.
    const err = new ApiError(500, {});
    expect(err.code).toBe('UNKNOWN');
    expect(err.message).toBe('Lỗi API 500');
  });

  it('là instance của Error để catch hoạt động như bình thường', () => {
    expect(new ApiError(400, {})).toBeInstanceOf(Error);
  });
});

describe('lưu hồ sơ người dùng', () => {
  const user = {
    id: 7,
    username: 'dphuong',
    fullName: 'Phạm Thị Diễm Phương',
    role: 'DIEU_PHOI' as RoleCode,
    department: 'Phòng VTYT',
  };

  it('lưu rồi đọc lại được hồ sơ', () => {
    setUser(user);
    expect(getUser()).toEqual(user);
  });

  it('xoá hồ sơ khi truyền null', () => {
    setUser(user);
    setUser(null);
    expect(getUser()).toBeNull();
  });

  it('trả null thay vì ném lỗi khi dữ liệu lưu hỏng', () => {
    localStorage.setItem('medequip_user', '{không phải JSON');
    expect(getUser()).toBeNull();
  });
});

describe('bảng vai trò', () => {
  it('có nhãn tiếng Việt cho cả bốn vai trò', () => {
    const roles: RoleCode[] = ['ADMIN', 'DIEU_PHOI', 'KY_THUAT_VIEN', 'DAU_MOI_KHOA'];
    for (const role of roles) {
      expect(ROLE_LABELS[role]).toBeTruthy();
      expect(ROLE_LABELS[role]).not.toBe(role);
    }
  });

  it('mỗi vai trò có một màn hình chính riêng', () => {
    const roles: RoleCode[] = ['ADMIN', 'DIEU_PHOI', 'KY_THUAT_VIEN', 'DAU_MOI_KHOA'];
    const homes = roles.map((r) => ROLE_HOME[r]);
    expect(new Set(homes).size).toBe(4);
    for (const home of homes) expect(home.startsWith('/')).toBe(true);
  });
});
