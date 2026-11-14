import { createBrowserRouter, redirect } from 'react-router';
import Login from './pages/Login';
import AuthCallback from './pages/AuthCallback';
import NotFound from './pages/NotFound';
import Layout from './components/Layout';
import Dashboard from './pages/coordinator/Dashboard';
import DeviceList from './pages/coordinator/DeviceList';
import DeviceDetail from './pages/coordinator/DeviceDetail';
import MaintenanceCalendar from './pages/coordinator/MaintenanceCalendar';
import WorkOrders from './pages/coordinator/WorkOrders';
import ReviewOrders from './pages/coordinator/ReviewOrders';
import Incidents from './pages/coordinator/Incidents';
import Reports from './pages/coordinator/Reports';
import MyWork from './pages/technician/MyWork';
import TechnicianCalendar from './pages/technician/TechnicianCalendar';
import WorkOrderExecution from './pages/technician/WorkOrderExecution';
import DepartmentDevices from './pages/department/DepartmentDevices';
import DepartmentOrders from './pages/department/DepartmentOrders';
import UserManagement from './pages/admin/UserManagement';
import AuditLog from './pages/admin/AuditLog';
import SystemConfig from './pages/admin/SystemConfig';
import MasterCatalog from './pages/admin/MasterCatalog';

export const router = createBrowserRouter([
  { path: 'login', Component: Login },
  // Keycloak chuyển về đây sau khi người dùng đăng nhập xong.
  { path: 'auth/callback', Component: AuthCallback },
  // Đường dẫn lạ: hiện trang báo "không tìm thấy" thay vì trang trắng.
  { path: '*', Component: NotFound },
  {
    path: '/',
    Component: Layout,
    children: [
      { index: true, loader: () => redirect('/coordinator/dashboard') },
      { path: 'coordinator/dashboard', Component: Dashboard },
      { path: 'coordinator/devices', Component: DeviceList },
      { path: 'coordinator/devices/:id', Component: DeviceDetail },
      { path: 'coordinator/calendar', Component: MaintenanceCalendar },
      { path: 'coordinator/orders', Component: WorkOrders },
      { path: 'coordinator/review', Component: ReviewOrders },
      { path: 'coordinator/incidents', Component: Incidents },
      { path: 'coordinator/reports', Component: Reports },
      { path: 'technician/my-work', Component: MyWork },
      { path: 'technician/work-order/:code?', Component: WorkOrderExecution },
      // Lịch cá nhân: lịch thực hiện riêng của kỹ thuật viên (trước đây
      // route này trỏ lại màn "Việc của tôi").
      { path: 'technician/calendar', Component: TechnicianCalendar },
      { path: 'department/devices', Component: DepartmentDevices },
      { path: 'department/devices/:id', Component: DeviceDetail },
      { path: 'department/orders', Component: DepartmentOrders },
      { path: 'admin/users', Component: UserManagement },
      { path: 'admin/audit', Component: AuditLog },
      { path: 'admin/config', Component: SystemConfig },
      { path: 'admin/catalog', Component: MasterCatalog },
      // Báo cáo (FR-14): quản trị cũng xem được, dùng chung màn với điều phối.
      { path: 'admin/reports', Component: Reports },
    ],
  },
]);
