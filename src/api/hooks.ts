import { useEffect, useState } from 'react';
import { devices as mockDevices, type Device } from '../data/mockData';
import { apiOr, fmtDate } from './client';
import type { ApiDevice } from './types';

/** 'DEV-002' → 2 (dùng khi POST cần idThietBi mà mock không có). */
export function parseEquipmentId(id: string): number {
  const n = parseInt(id.replace(/\D+/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

export type DeviceRow = Device & { idThietBi: number; equipmentId: number };

/** Map thiết bị từ API sang shape UI (định dạng ngày vi-VN). */
export function mapDevice(d: ApiDevice): DeviceRow {
  return {
    id: d.id,
    idThietBi: d.idThietBi,
    equipmentId: d.idThietBi,
    name: d.name,
    model: d.model,
    serial: d.serial,
    department: d.department,
    status: d.status,
    hanHieuChuan: fmtDate(d.hanHieuChuan),
    daysLeft: d.daysLeft ?? 0,
    pmCycle: d.pmCycle,
    pmKeTiep: fmtDate(d.pmKeTiep),
    manufacturer: d.manufacturer,
    ngayNhap: fmtDate(d.ngayNhap),
    warrantyMonths: d.warrantyMonths,
    warrantyLeft: d.warrantyLeft,
    maintenanceContract: d.maintenanceContract ?? '—',
  };
}

/**
 * Danh sách thiết bị toàn viện: GET /api/devices; backend chưa chạy
 * → mockData (idThietBi suy từ mã DEV-xxx). Dùng chung cho
 * DeviceList, WorkOrders (chọn thiết bị), DepartmentDevices (lọc khoa).
 *
 * `refreshKey` tăng lên để nạp lại danh sách sau khi tạo/sửa thiết bị
 * (nút "+ Thêm thiết bị" ở màn Danh sách thiết bị).
 */
export function useDevices(refreshKey = 0): DeviceRow[] {
  const [list, setList] = useState<DeviceRow[]>(() =>
    mockDevices.map((d) => ({ ...d, idThietBi: parseEquipmentId(d.id), equipmentId: parseEquipmentId(d.id) })),
  );

  useEffect(() => {
    void apiOr<ApiDevice[]>('/devices', () => [])
      .then((list) => {
        if (list.length > 0) setList(list.map(mapDevice));
      })
      .catch(() => {
        /* giữ mock */
      });
  }, [refreshKey]);

  return list;
}
