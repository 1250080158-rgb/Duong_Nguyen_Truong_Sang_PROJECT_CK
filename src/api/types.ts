// =====================================================================
// Hợp đồng dữ liệu khớp response của backend MedEquip.Api (anonymous
// objects trong Controllers). Chỉ khai báo những field UI thực dụng.
// =====================================================================

export type DeviceStatusCode = 'HOAT_DONG' | 'SAP_HAN' | 'CHO_HIEU_CHUAN' | 'DANG_SUA' | 'THANH_LY';

export type WorkOrderStatusCode = 'CHO_PHAN_CONG' | 'DANG_THUC_HIEN' | 'CHO_NGHIEM_THU' | 'HOAN_THANH' | 'TRA_LAI';

export type RoleCode = 'ADMIN' | 'DIEU_PHOI' | 'KY_THUAT_VIEN' | 'DAU_MOI_KHOA';

// ----- Auth (POST /api/auth/login) -----
export interface LoginResponse {
  token: string;
  expires: string;
  user: CurrentUser;
}

export interface CurrentUser {
  id: number;
  username: string;
  fullName: string;
  role: RoleCode;
  department?: string | null;
  /** Mã khoa — đầu mối khoa dùng để lọc dữ liệu theo khoa của mình. */
  departmentId?: number | null;
}

// ----- Devices -----
export interface ApiDevice {
  id: string; // = code, vd 'DEV-001'
  idThietBi: number;
  name: string; // tên model
  model: string;
  serial: string;
  department: string;
  idKhoa: number;
  status: DeviceStatusCode;
  hanHieuChuan: string | null; // ISO yyyy-MM-dd
  daysLeft: number | null;
  pmCycle: number;
  pmKeTiep: string | null;
  manufacturer: string;
  ngayNhap: string;
  warrantyMonths: number;
  warrantyLeft: number;
  maintenanceContract: string | null;
}

export interface ApiTimelineItem {
  type: string; // STATUS | PM | SC | HC | INCIDENT | ...
  date: string;
  title: string;
  detail: string | null;
  changedBy?: string | null;
  workOrderCode?: string;
  severity?: string;
}

export interface ApiDeviceDetail extends Omit<ApiDevice, 'idThietBi' | 'idKhoa' | 'pmCycle' | 'daysLeft'> {
  status: DeviceStatusCode;
  chuKyPmNgay: number;
  timeline: ApiTimelineItem[];
}

// ----- Tạo thiết bị mới (POST /api/devices — Quản trị) -----
export interface ApiDeviceCreateRequest {
  modelId: number;
  serial: string;
  departmentId: number;
  importDate: string; // ISO yyyy-MM-dd
  warrantyMonths: number;
  maintenanceSupplierId?: number | null;
  notes?: string | null;
}

export interface ApiDeviceCreateResponse {
  code: string;
  id: string;
  idThietBi: number;
}

// ----- Dashboard (GET /api/dashboard) -----
export interface ApiDashboard {
  deviceStatusCounts: Record<string, number>;
  orderStatusCounts: Record<string, number>;
  overdueDevices: number;
  upcomingDevices: number;
  pmOnTimeRate6M: number;
  upcomingCalibrations: { code: string; serial: string; daysLeft: number }[];
  incidentsByMonth: { month: string; count: number }[]; // 'yyyy-MM'
}

// ----- Work orders -----
export interface ApiWorkOrder {
  id: string;
  workOrderId: number;
  type: 'PM' | 'SC' | 'HC' | 'KT';
  device: string;
  serial: string;
  equipmentCode: string;
  equipmentId: number;
  equipmentStatus: DeviceStatusCode;
  department: string;
  departmentId: number;
  assignee: string;
  assigneeId: number | null;
  status: WorkOrderStatusCode;
  priority: 'BINH_THUONG' | 'KHAN';
  created: string;
  deadline: string;
  overdue: boolean;
  progress: number;
  stepsDone: number;
}

export interface ApiStep {
  thuTu: number;
  tieuDe: string;
  requirePhoto: boolean;
  hoanThanh: boolean;
  giaTriChuan: number | null;
  dungSaiPhanTram: number | null;
  giaTriDo: number | null;
  result: 'DAT' | 'KHONG_DAT' | null;
  lyDoBo: string | null;
  note: string | null;
  deviationPct: number | null;
}

export interface ApiEvidenceFile {
  idBangChung: number;
  tenTep: string;
  duongDanTep: string;
  maBam: string;
  taiLuc: string;
}

export interface ApiRequiredEvidence {
  evidenceType: string;
  label: string;
  provided: boolean;
  files: ApiEvidenceFile[];
}

export interface ApiOrderDetail {
  id: string;
  workOrderId: number;
  type: 'PM' | 'SC' | 'HC' | 'KT';
  status: WorkOrderStatusCode;
  equipment: {
    code: string;
    name: string;
    serial: string;
    status: DeviceStatusCode;
    calibrationValidUntil: string | null;
  };
  department: string;
  assignee: string | null;
  priority: 'BINH_THUONG' | 'KHAN';
  deadline: string;
  progress: number;
  steps: ApiStep[];
  requiredEvidence: ApiRequiredEvidence[];
  canComplete: boolean;
  blockingReasons: string[];
}

// ----- Users (GET /api/users) -----
export interface ApiUser {
  id: number;
  name: string;
  username: string;
  role: RoleCode;
  department: string | null;
  lastLogin: string | null;
  status: 'active' | 'inactive';
}

// ----- Audit (GET /api/audit) -----
export interface ApiAuditResponse {
  chainIntact: boolean;
  items: {
    idKiemToan: number;
    time: string;
    nguoiThucHien: string;
    hanhDong: string;
    doiTuong: string;
    chiTiet: string | null;
    hash: string;
    hashOk: boolean;
  }[];
}

// ----- Config (GET /api/config) -----
export interface ApiSystemConfig {
  configKey: string;
  configValue: string;
  description: string;
}

// ----- Catalog (GET /api/catalog/*) -----
export interface ApiCatalogModel {
  idModel: number;
  name: string;
  category: string;
  chuKyPmNgay: number;
  chuKyHcNgay: number;
  dungSaiHcPhanTram: number;
  manufacturer: string;
}

export interface ApiDepartment {
  idKhoa: number;
  name: string;
  laLamSang: boolean;
}
export interface ApiManufacturer {
  idHang: number;
  name: string;
}
export interface ApiSupplier {
  idNcc: number;
  name: string;
}
export interface ApiEvidenceConfig {
  configId: number;
  orderType: string;
  maBangChung: string;
  label: string;
  isRequired: boolean;
}

// ----- Reports (GET /api/reports/{kind}) -----
export interface ApiReportCalibration {
  code: string;
  model: string;
  department: string;
  hanHieuChuan: string;
  daysLeft: number;
  status: DeviceStatusCode;
}
export interface ApiReportIncidents {
  total: number;
  open: number;
  byModel: { model: string; count: number }[];
  trend: { month: string; count: number }[];
}
export interface ApiReportPm {
  technician: string;
  total: number;
  completed: number;
  onTime: number;
}
export interface ApiReportEvidence {
  code: string;
  orderType: string;
  required: number;
  provided: number;
  complete: boolean;
}

// ----- Assignments (GET /api/assignments/week — màn Lịch bảo trì) -----
export interface ApiAssignmentItem {
  ma: string;
  workOrderId: number;
  equipmentId: number;
  type: 'PM' | 'SC' | 'HC' | 'KT';
  device: string;
  date?: string;
  serial?: string;
  department?: string;
  departmentId?: number;
  deadline?: string;
  equipmentStatus: DeviceStatusCode;
}

export interface ApiAssignmentWeek {
  weekStart: string; // yyyy-MM-dd
  technicians: { idNguoiDung: number; hoTen: string; schedule: ApiAssignmentItem[] }[];
  unassigned: ApiAssignmentItem[];
}
