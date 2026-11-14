export type DeviceStatus = 'HOAT_DONG' | 'SAP_HAN' | 'CHO_HIEU_CHUAN' | 'DANG_SUA' | 'THANH_LY';

export const STATUS_LABELS: Record<DeviceStatus, string> = {
  HOAT_DONG: 'ĐANG HOẠT ĐỘNG',
  SAP_HAN: 'SẮP HẾT HẠN',
  CHO_HIEU_CHUAN: 'CHỜ HIỆU CHUẨN',
  DANG_SUA: 'ĐANG SỬA CHỮA',
  THANH_LY: 'THANH LÝ',
};

export const STATUS_COLORS: Record<DeviceStatus, string> = {
  HOAT_DONG: 'bg-green-100 text-green-800 border-green-200',
  SAP_HAN: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  CHO_HIEU_CHUAN: 'bg-red-100 text-red-800 border-red-200',
  DANG_SUA: 'bg-gray-100 text-gray-600 border-gray-200',
  THANH_LY: 'bg-gray-200 text-gray-500 border-gray-300',
};

export const STATUS_DOT: Record<DeviceStatus, string> = {
  HOAT_DONG: 'bg-green-500',
  SAP_HAN: 'bg-yellow-400',
  CHO_HIEU_CHUAN: 'bg-red-500',
  DANG_SUA: 'bg-gray-400',
  THANH_LY: 'bg-gray-500',
};

export interface Device {
  id: string;
  name: string;
  model: string;
  serial: string;
  department: string;
  status: DeviceStatus;
  hanHieuChuan: string;
  daysLeft: number;
  pmCycle: number;
  pmKeTiep: string;
  manufacturer: string;
  ngayNhap: string;
  warrantyMonths: number;
  warrantyLeft: number;
  maintenanceContract: string;
  lastTicket?: string;
  expectedReturn?: string;
}

export const devices: Device[] = [
  {
    id: 'DEV-001',
    name: 'Máy sinh phẩm BS-240',
    model: 'Mindray BS-240',
    serial: 'SN-12345',
    department: 'Hóa sinh',
    status: 'HOAT_DONG',
    hanHieuChuan: '15/02/2027',
    daysLeft: 144,
    pmCycle: 90,
    pmKeTiep: '10/11/2026',
    manufacturer: 'Mindray',
    ngayNhap: '15/03/2022',
    warrantyMonths: 24,
    warrantyLeft: 5,
    maintenanceContract: 'Dräger VN',
  },
  {
    id: 'DEV-002',
    name: 'Máy sinh phẩm BS-240',
    model: 'Mindray BS-240',
    serial: 'SN-12346',
    department: 'Hóa sinh',
    status: 'CHO_HIEU_CHUAN',
    hanHieuChuan: '01/08/2026',
    daysLeft: -23,
    pmCycle: 90,
    pmKeTiep: '—',
    manufacturer: 'Mindray',
    ngayNhap: '15/03/2022',
    warrantyMonths: 24,
    warrantyLeft: 5,
    maintenanceContract: 'Dräger VN',
    lastTicket: '#SC-2026-0088',
  },
  {
    id: 'DEV-003',
    name: 'Máy huyết học XN-1000',
    model: 'Sysmex XN-1000',
    serial: 'SN-00912',
    department: 'Huyết học',
    status: 'DANG_SUA',
    hanHieuChuan: '20/11/2026',
    daysLeft: 57,
    pmCycle: 60,
    pmKeTiep: '—',
    manufacturer: 'Sysmex',
    ngayNhap: '08/06/2021',
    warrantyMonths: 36,
    warrantyLeft: 0,
    maintenanceContract: 'Sysmex VN',
    lastTicket: '#SC-2026-0102',
    expectedReturn: '26/09/2026',
  },
  {
    id: 'DEV-004',
    name: 'Máy thở HAMILTON-G5',
    model: 'Hamilton G5',
    serial: 'SN-44210',
    department: 'ICU',
    status: 'SAP_HAN',
    hanHieuChuan: '18/10/2026',
    daysLeft: 24,
    pmCycle: 180,
    pmKeTiep: '18/10/2026',
    manufacturer: 'Hamilton Medical',
    ngayNhap: '01/09/2020',
    warrantyMonths: 24,
    warrantyLeft: 0,
    maintenanceContract: 'BMT Medical',
  },
  {
    id: 'DEV-005',
    name: 'Máy siêu âm LOGIQ E9',
    model: 'GE LOGIQ E9',
    serial: 'SN-78123',
    department: 'Chẩn đoán hình ảnh',
    status: 'HOAT_DONG',
    hanHieuChuan: '05/04/2027',
    daysLeft: 193,
    pmCycle: 365,
    pmKeTiep: '05/04/2027',
    manufacturer: 'GE Healthcare',
    ngayNhap: '20/04/2023',
    warrantyMonths: 24,
    warrantyLeft: 18,
    maintenanceContract: 'GE Healthcare VN',
  },
  {
    id: 'DEV-006',
    name: 'Máy điện tim ECG-2150',
    model: 'Nihon Kohden ECG-2150',
    serial: 'SN-33901',
    department: 'Tim mạch',
    status: 'HOAT_DONG',
    hanHieuChuan: '29/12/2026',
    daysLeft: 96,
    pmCycle: 180,
    pmKeTiep: '29/12/2026',
    manufacturer: 'Nihon Kohden',
    ngayNhap: '10/12/2022',
    warrantyMonths: 24,
    warrantyLeft: 0,
    maintenanceContract: 'NK VN',
  },
  {
    id: 'DEV-007',
    name: 'Máy X-quang DR 600',
    model: 'Carestream DR 600',
    serial: 'SN-55820',
    department: 'Chẩn đoán hình ảnh',
    status: 'CHO_HIEU_CHUAN',
    hanHieuChuan: '10/08/2026',
    daysLeft: -14,
    pmCycle: 365,
    pmKeTiep: '—',
    manufacturer: 'Carestream',
    ngayNhap: '14/07/2020',
    warrantyMonths: 36,
    warrantyLeft: 0,
    maintenanceContract: 'Carestream Asia',
  },
  {
    id: 'DEV-008',
    name: 'Máy ly tâm Eppendorf 5430',
    model: 'Eppendorf 5430R',
    serial: 'SN-20034',
    department: 'Hóa sinh',
    status: 'HOAT_DONG',
    hanHieuChuan: '12/01/2027',
    daysLeft: 110,
    pmCycle: 180,
    pmKeTiep: '12/01/2027',
    manufacturer: 'Eppendorf',
    ngayNhap: '30/01/2023',
    warrantyMonths: 12,
    warrantyLeft: 0,
    maintenanceContract: 'Eppendorf VN',
  },
];

export interface WorkOrder {
  id: string;
  type: 'PM' | 'SC' | 'HC';
  device: string;
  serial: string;
  department: string;
  assignee: string;
  status: 'CHO_PHAN_CONG' | 'DANG_THUC_HIEN' | 'CHO_NGHIEM_THU' | 'HOAN_THANH' | 'TRA_LAI';
  priority: 'BINH_THUONG' | 'KHAN';
  ngayTao: string;
  deadline: string;
  progress?: number;
}

export const workOrders: WorkOrder[] = [
  {
    id: '#HC-2026-0087',
    type: 'HC',
    device: 'Máy sinh phẩm BS-240',
    serial: 'SN-12346',
    department: 'Hóa sinh',
    assignee: 'Nguyễn Minh VT',
    status: 'DANG_THUC_HIEN',
    priority: 'KHAN',
    ngayTao: '02/09/2026',
    deadline: '25/09/2026',
    progress: 40,
  },
  {
    id: '#PM-2026-0201',
    type: 'PM',
    device: 'Máy thở HAMILTON-G5',
    serial: 'SN-44210',
    department: 'ICU',
    assignee: 'Trần Văn Hùng',
    status: 'CHO_PHAN_CONG',
    priority: 'BINH_THUONG',
    ngayTao: '20/09/2026',
    deadline: '10/10/2026',
  },
  {
    id: '#SC-2026-0102',
    type: 'SC',
    device: 'Máy huyết học XN-1000',
    serial: 'SN-00912',
    department: 'Huyết học',
    assignee: 'Trần Văn Hùng',
    status: 'DANG_THUC_HIEN',
    priority: 'KHAN',
    ngayTao: '18/09/2026',
    deadline: '26/09/2026',
    progress: 70,
  },
  {
    id: '#HC-2026-0091',
    type: 'HC',
    device: 'Máy X-quang DR 600',
    serial: 'SN-55820',
    department: 'CĐHA',
    assignee: 'Lê Thị Mai',
    status: 'CHO_PHAN_CONG',
    priority: 'KHAN',
    ngayTao: '21/09/2026',
    deadline: '28/09/2026',
  },
  {
    id: '#PM-2026-0195',
    type: 'PM',
    device: 'Máy siêu âm LOGIQ E9',
    serial: 'SN-78123',
    department: 'CĐHA',
    assignee: 'Nguyễn Minh VT',
    status: 'CHO_NGHIEM_THU',
    priority: 'BINH_THUONG',
    ngayTao: '10/09/2026',
    deadline: '20/09/2026',
    progress: 100,
  },
  {
    id: '#SC-2026-0088',
    type: 'SC',
    device: 'Máy sinh phẩm BS-240',
    serial: 'SN-12346',
    department: 'Hóa sinh',
    assignee: '—',
    status: 'CHO_PHAN_CONG',
    priority: 'KHAN',
    ngayTao: '15/09/2026',
    deadline: '30/09/2026',
  },
];

export const auditLogs = [
  {
    time: '14:02:11',
    nguoiThucHien: 'hệ thống',
    hanhDong: 'UPDATE',
    doiTuong: 'equipment #12346',
    chiTiet: 'status: HOAT_DONG → CHO_HIEU_CHUAN',
    hash: 'a3f9…e2',
    hashOk: true,
  },
  {
    time: '14:01:58',
    nguoiThucHien: 'dphuong',
    hanhDong: 'ASSIGN_BLOCKED',
    doiTuong: 'phiếu #SC-0088',
    chiTiet: 'Lý do: quá hạn hiệu chuẩn 23 ngày. Căn cứ: chứng thư #VC-2026-0112',
    hash: 'b7c1…f4',
    hashOk: true,
  },
  {
    time: '11:20:03',
    nguoiThucHien: 'minhvt',
    hanhDong: 'WORK_ORDER_COMPLETE',
    doiTuong: '#HC-2026-0087',
    chiTiet: 'bằng chứng: 2/4 — đang tiến hành',
    hash: 'c2d8…a1',
    hashOk: true,
  },
  {
    time: '10:45:22',
    nguoiThucHien: 'admin',
    hanhDong: 'CONFIG_UPDATE',
    doiTuong: 'calibration_threshold',
    chiTiet: 'warning_days: 30 → 45',
    hash: 'd5e3…b9',
    hashOk: true,
  },
  {
    time: '09:30:11',
    nguoiThucHien: 'minhvt',
    hanhDong: 'WORK_ORDER_START',
    doiTuong: '#HC-2026-0087',
    chiTiet: 'Bắt đầu thực hiện phiếu hiệu chuẩn',
    hash: 'e1f6…c3',
    hashOk: true,
  },
  {
    time: '08:12:05',
    nguoiThucHien: 'hệ thống',
    hanhDong: 'AUTO_LOCK',
    doiTuong: 'equipment #55820',
    chiTiet: 'Quá hạn hiệu chuẩn 14 ngày — tự động khóa',
    hash: 'f9a2…d7',
    hashOk: true,
  },
  {
    time: '07:58:44',
    nguoiThucHien: 'lthimai',
    hanhDong: 'FAULT_REPORT',
    doiTuong: 'equipment #78123',
    chiTiet: 'Báo hỏng: màn hình bị nhiễu. Mức độ: SƠ BỘ',
    hash: 'a8b4…e5',
    hashOk: false,
  },
];

export const users = [
  {
    id: 'U001',
    name: 'Nguyễn Minh Vĩnh Thịnh',
    username: 'minhvt',
    role: 'Kỹ thuật viên',
    department: 'Phòng VTYT',
    lastLogin: '24/09/2026 08:15',
    status: 'active',
  },
  {
    id: 'U002',
    name: 'Trần Văn Hùng',
    username: 'hungtv',
    role: 'Kỹ thuật viên',
    department: 'Phòng VTYT',
    lastLogin: '24/09/2026 07:50',
    status: 'active',
  },
  {
    id: 'U003',
    name: 'Phạm Thị Diễm Phương',
    username: 'dphuong',
    role: 'Điều phối',
    department: 'Phòng VTYT',
    lastLogin: '24/09/2026 08:02',
    status: 'active',
  },
  {
    id: 'U004',
    name: 'Lê Thị Mai',
    username: 'lthimai',
    role: 'Kỹ thuật viên',
    department: 'Phòng VTYT',
    lastLogin: '23/09/2026 16:45',
    status: 'active',
  },
  {
    id: 'U005',
    name: 'Nguyễn Thị Ánh Vân',
    username: 'vanna',
    role: 'Đầu mối khoa',
    department: 'Hóa sinh',
    lastLogin: '22/09/2026 14:30',
    status: 'active',
  },
  {
    id: 'U006',
    name: 'Bùi Quang Khải',
    username: 'khaibq',
    role: 'Đầu mối khoa',
    department: 'ICU',
    lastLogin: '20/09/2026 09:10',
    status: 'active',
  },
  {
    id: 'U007',
    name: 'Hoàng Đức Long',
    username: 'longhduc',
    role: 'Quản trị hệ thống',
    department: 'CNTT',
    lastLogin: '24/09/2026 08:00',
    status: 'active',
  },
  {
    id: 'U008',
    name: 'Trịnh Thị Bích Ngọc',
    username: 'ngocttb',
    role: 'Đầu mối khoa',
    department: 'Tim mạch',
    lastLogin: '15/09/2026 11:20',
    status: 'inactive',
  },
];
