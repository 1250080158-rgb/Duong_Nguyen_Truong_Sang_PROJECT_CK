# BÁO CÁO KIỂM TRA TOÀN HỆ THỐNG MED-EQUIP — 12/11/2026

Phạm vi: frontend React (18 màn), backend ASP.NET Core (3 tầng), CSDL PostgreSQL
(QLTBYT.sql), Docker/Keycloak/nginx, env/config, tài liệu, test.

Phương pháp: audit tĩnh 3 agent song song (frontend / backend / CSDL-hạ tầng) +
probe động thật (boot API cục bộ, gọi endpoint bằng curl) + chạy 3 bộ kiểm thử.

Kết quả kiểm thử: `typecheck` ✓ · Vitest 35/35 ✓ · xUnit 70/70 ✓ — **test xanh
nhưng hệ thống không chạy nổi end-to-end** (xem MỨC 1). Lý do: mọi test đều là
hàm thuần, không có một test tích hợp nào chạm HTTP/CSDL.

---

## MỨC 1 — CHẾT CHỬC: hệ thống không chạy được như đã giao

### 1.1. Backend ↔ CSDL lệch schema (đã chứng minh bằng probe thật)

- `Entities.cs:14–274` ánh xạ bảng **tiếng Việt của schema SQL Server cũ**
  (`khoa_phong`, `hang_san_xuat`, `model_thiet_bi`, `thiet_bi`, `nguoi_dung`,
  `phieu_cong_tac`, `buoc_phieu`, `bang_chung`, `su_co`, `phan_cong`,
  `nhat_ky_kiem_toan`…) và cột tiếng Việt (`id_khoa`, `tao_luc`, `ten_dang_nhap`…).
- `database/QLTBYT.sql:58–372` tạo bảng **tiếng Anh** (`departments`,
  `manufacturers`, `equipment_models`, `equipment`, `users`, `work_orders`,
  `work_order_steps`, `required_evidence_config`, `evidence`, `incidents`,
  `assignments`, `audit_log`…).
- Probe thật: boot API → `POST /api/auth/login` → **500** với SQL `SELECT … FROM
nguoi_dung` → `42P01 relation "nguoi_dung" does not exist`. **Mọi endpoint
  nghiệp vụ đều 500 như vậy.** Mục 11 trong QLTBYT.sql (`:1582` "CSDL đã sẵn
  sàng nối với ASP.NET Core") là sai.
- `DbSeeder.cs:29` `catch { return; }` + `Program.cs:165-169` nuốt lỗi seed →
  không ai thấy sự cố khi boot; `/health` vẫn báo `ok/up` (chỉ test kết nối).
- Nguyên nhân nguồn: kỳ "di chuyển sang SQL Server" đã bỏ dở (còn sót
  `QLTBYT_SQLServer.sql`, `MAPPING.md`, `HUONG_DAN_SQLSERVER.md`,
  `SQL_SERVER_MIGRATION_GUIDE.md`, `convert_mapping.*` — toàn bộ file này chứa
  tên bảng tiếng Việt, là nguồn của sự lệch).

### 1.2. Chuỗi kết nối trong `appsettings.json` là kiểu SQL Server

- `appsettings.json:3`: `Server=localhost;Database=QLTBYT;User Id=sang;Password=123456;TrustServerCertificate=True`
  — chạy `dotnet run` theo README mục 2.2 → **không nối được PostgreSQL** (đã
  thử: `/health` = `degraded/database down`). Chuỗi đúng phải dạng
  `Host=…;Database=qltbyt;Username=…`. DB thật trên máy là `qltbyt` (chữ thường).
- Lỗi gốc bị `DbSeeder` nuốt, không log exception → mất hàng giờ chẩn đoán.

### 1.3. `QLTBYT.sql` tự hỏng khi nạp (quả bom thời gian)

- Dữ liệu mẫu vi phạm chính trigger **BR-01** của nó: nạp script →
  `BR-01: Không thể tạo phiếu SC cho thiết bị đang quá hạn hiệu chuẩn hoặc đã
thanh lý` (nạp thật hôm nay 12/11/2026, seed ngày hiệu chuẩn cứng đã trôi quá
  hạn). Script chỉ nạp được nếu ngày mẫu nằm trong tương lai — **hỏng theo thời
  gian thực**. Phiếu SC mẫu cần `han_hieu_chuan` đủ xa.
- Script chứa meta-lệnh psql `\set ON_ERROR_STOP` (`QLTBYT.sql:2`) → chỉ chạy
  được bằng CLI psql, không chạy được qua driver/GUI (nạp bằng Npgsql → syntax
  error ngay dòng 3).

### 1.4. Frontend ↔ Backend lệch hợp đồng dữ liệu (luồng chính chết khi bật API)

- **Tạo phiếu**: UI gửi `{orderType, idThietBi, idNguoiThucHien}`
  (`WorkOrders.tsx:134-141`, `MaintenanceCalendar.tsx:315-321`) nhưng DTO cần
  `equipmentId, assigneeId` (`Interfaces.cs:48-57`) → bind 0 → 404 mọi lần tạo.
- **Phân công**: UI gửi `{idPhieu, idThietBi}` (`MaintenanceCalendar.tsx:272-277`)
  vs DTO `WorkOrderId, EquipmentId` (`Interfaces.cs:32-38`) → kéo-thả phân công
  luôn 404. UI đọc `assignmentId` nhưng backend trả `idPhanCong`.
- **GET /devices**: backend trả `equipmentId/calibrationExpiry/nextPm/importDate`
  (`DeviceControllers.cs:35-56`) nhưng `mapDevice` (`hooks.ts:18-30`) đọc
  `idThietBi/hanHieuChuan/pmKeTiep/ngayNhap` → các cột ngày hiện "—".
- **GET /devices/{code}**: backend trả `calibrationExpiry/nextPm/pmCycleDays`,
  không có `daysLeft/warrantyLeft` vs types.ts:58-62.
- **GET /users**: backend bind `role` (`SystemControllers.cs:107`), UI gửi
  `vaiTro` (`WorkOrders.tsx:95`) → dropdown KTV chứa cả admin/đầu mối.
- **GET /work-orders**: backend bind `assigneeId/departmentId`
  (`WorkOrderControllers.cs:28`); MyWork gửi `idNguoiThucHien`
  (`MyWork.tsx:23`), DepartmentOrders gửi `idKhoa` (`DepartmentOrders.tsx:30`)
  → bộ lọc bỏ qua; KTV thấy phiếu toàn viện, đầu mối thấy phiếu mọi khoa.
- **POST /catalog/models**: UI gửi `idHang/chuKyPmNgay/…`
  (`MasterCatalog.tsx:117-124`) vs DTO `ManufacturerId/PmCycleDays/…`
  (`DeviceControllers.cs:230-232`) → tạo model chu kỳ 0.
- **GET /catalog/***: backend trả `ten/loai` (`DeviceControllers.cs:226-271`)
  vs types kỳ vọng `name/category` (`types.ts:184-206`) → danh mục trống tên.
- **GET /reports/calibration|evidence**: backend trả `ma/trangThai/loaiPhieu`
  (`DeviceControllers.cs:295-301,344`) vs `code/status/orderType`
  (`types.ts:216-242`) → cột báo cáo trống; `Reports.tsx:137` còn render
  `{r.status}` mã trần (trái quy tắc #8).
- **/auth/me, /auth/login trả `department: null` cứng**
  (`SystemControllers.cs:48,92`) → cả hệ thống không bao giờ biết khoa của user;
  DepartmentDevices fallback cứng "Hóa sinh" (`DepartmentDevices.tsx:17`).
- **[ApiController] auto-400** trả ProblemDetails RFC7807, không khớp hợp đồng
  `{code,message,details,actions}` của `ApiError` (`client.ts:34-47`).

---

## MỨC 2 — BẢO MẬT

1. **Bằng chứng công khai không cần đăng nhập** — `Program.cs:105-109`
   `UseStaticFiles("/uploads")` đặt trước `UseAuthentication`; nginx cũng proxy
   thẳng (`web/nginx.conf:53-58`). Ai biết URL là tải chứng thư hiệu chuẩn.
   Cần download endpoint có `[Authorize]` + kiểm quyền.
2. **Path traversal khi upload** — `WorkOrderControllers.cs:230-233`: `evidenceCode`
   từ form nối thẳng vào `Path.Combine` → `../` ghi file ra ngoài thư mục uploads;
   không kiểm tra mã có thuộc `required_evidence_config`, không áp dụng
   `max_files/accept_mime` của config.
3. **Secrets trong repo**: mật khẩu CSDL (`appsettings.json:3`), khóa JWT đối
   xứng (`:16`), client secret (`:12` + `realm-medequip.json:93`).
4. **Dev password `123456` hardcode** (`SystemControllers.cs:32`), không
   rate-limit → biết username là vào được vai trò (chế độ Dev).
5. **Rò rỉ thông báo**: `SystemControllers.cs:205-207` — user OIDC chưa ánh xạ
   (`IdNguoiDung == null`) → bộ lọc bị bỏ qua, trả thông báo của TẤT CẢ người
   dùng (MarkAllRead thì đã chặn đúng — ném `USER_NOT_MAPPED`).
6. **IDOR**: KTV sửa bước/nộp bằng chứng/hoàn thành phiếu của KTV khác không bị
   chặn (`WorkOrderControllers.cs:147-149,203,263` — chỉ kiểm role).
7. **Audit hổng**: tạo thiết bị không ghi audit (`DeviceControllers.cs:136-163`);
   audit append tách SaveChanges — lỗi audit vẫn cam kết nghiệp vụ
   (`WorkOrderService.cs:156-158`, `AssignmentService.cs:80-82`); chuỗi hash
   đọc-prev rồi insert riêng → 2 append song song = đứt chuỗi giả
   (`AuditService.cs:16-19`).
8. **`/health` trả `ex.Message`** kèm chi tiết CSDL (`Program.cs:150-154`).
9. `directAccessGrantsEnabled: true` cho public client (`realm-medequip.json:59`)
   — password grant mở (README đã ghi chú phải tắt khi triển khai thật).
10. App + Keycloak chạy bằng superuser `sa/123456`, không GRANT nào trong script.

---

## MỨC 3 — BUG LOGIC/CHẠY THẬT

**Backend**

- Incident mới `created_at` = 0001-01-01 (`WorkOrderControllers.cs:387-396`
  không gán `CreatedAt`) → sự cố mới biến mất khỏi Dashboard 12 tháng
  (`DeviceControllers.cs:178-179`), trend gom về "0001-01".
- `stepsDone` luôn = 0: `GetAll` không Include Steps mà vẫn đếm
  (`WorkOrderControllers.cs:43,65`).
- Trộn `DateTime.Now` (giờ địa phương) và `UtcNow` — trái quy tắc #3
  (`WorkOrderControllers.cs:44,232,389,511,514`; `DeviceControllers.cs:20,175`;
  `WorkOrderService.cs:24,56,224,245`; `AssignmentService.cs:28`) vs các chỗ
  `UtcNow` (`WorkOrderService.cs:130,152,202,247`; `AuditService.cs:23`).
- Seeder sập khi CSDL trống: `SystemConfig` không đặt `UpdatedAt` → INSERT NULL
  vào cột NOT NULL → `Program.cs:165-169` không try/catch → API không boot nổi.
- Upload: file < 8 byte → `ReadExactlyAsync` ném 500 (`WorkOrderControllers.cs:220-223`);
  ghi vào `AppContext.BaseDirectory/uploads` nhưng serve từ `ContentRootPath/uploads`
  (`Program.cs:103`) → khi `dotnet run`, file vừa upload 404 ngay.
- `ReturnAsync` đè mất mô tả gốc phiếu (`WorkOrderService.cs:173`).
- Tạo SC từ sự cố bỏ qua checklist + BR-01 tầng app (`WorkOrderControllers.cs:497-550`)
  → phiếu SC 0 bước, không 422 có `actions` mà 500 từ trigger.
- Report "evidence" đếm file thay vì đếm mã bằng chứng (`DeviceControllers.cs:340-345`).
- Sinh mã phiếu/assignment/mã thiết bị bằng Count+1 → race 500 khi song song
  (`WorkOrderService.cs:53-56`, `WorkOrderControllers.cs:386-389,510-514`,
  `DeviceControllers.cs:145-148`).
- Mọi vi phạm CHECK/FK/UNIQUE CSDL nổ 500 trần (không map `PostgresException`
  23514/23503/23505 → BusinessException); middleware chỉ bắt BusinessException
  (`Program.cs:112-127`).
- Không pagination ở bất kỳ list nào; không `AsNoTracking`; Dashboard load toàn
  bộ thiết bị + phiếu vào RAM (`DeviceControllers.cs:176-177`); `/audit` verify
  chuỗi toàn bảng mỗi request (`AuditService.cs:37`).
- `performed_at/performed_by` của bước không bao giờ được ghi
  (`WorkOrderControllers.cs:182-189`); `evidence.file_mime` trống.
- Phân công lại phiếu đã phân công = 500 (`assignments.work_order_id UNIQUE`,
  `AssignmentService.cs:67-80` không xử lý) → kéo-thả nhầm không sửa được.

**Frontend**

- **Vòng lặp fetch vô hạn**: `Layout.tsx:81,103-105` — `getUser()` parse JSON
  mới mỗi render → `useEffect([user])` chạy lại → `loadNotifs()` → setState mảng
  mới → render lại → … GET `/notifications` liên tục khi API chạy.
- **401 không điều hướng**: `client.ts:56-61` xoá token nhưng không render lại/
  redirect → màn đứng với dữ liệu chết.
- **`DeviceDetail.tsx:85,90-120`**: vào mã không tồn tại → hiện dữ liệu thiết bị
  khác (fallback devices[1]), ApiError bị nuốt giữ mock.
- **`WorkOrders.tsx:146-156`**: mọi ApiError lạ (403/500…) rơi nhánh "backend
  chưa chạy" → lưu localStorage + báo thành công — trái quy tắc #7.
- **`MyWork.tsx:145-151`**: phiếu HOAN_THANH hiện nhãn "Chờ làm" + đếm sai;
  sort comparator không đối xứng (`:50`).
- **`MaintenanceCalendar.tsx:294-304`**: offline kéo-thả nhân đôi phiếu (không
  gỡ khỏi cột chờ).
- **`WorkOrderExecution.tsx:184-201,426`**: PATCH mỗi ký tự gõ vào ô ghi chú
  (mỗi ký tự = 1 PATCH + 1 dòng audit); ảnh theo bước chỉ set flag cục bộ, không
  bao giờ lên server (`:451-455`); optimistic upload không revert khi lỗi mạng
  (`:237-253`).
- **`hooks.ts:47-54`**: API trả `[]` hợp lệ bị coi là "offline" → hiện mock như
  dữ liệu thật (nguy hiểm với hệ thống thiết bị y tế).
- Dashboard ngưỡng 7 vs 30 ngày lệch nhau (`Dashboard.tsx:22-24 vs 103`);
  nhiều `catch(() => {})` giữ mock cả khi ApiError (Dashboard/WorkOrders/
  UserManagement/MasterCatalog/SystemConfig/AuditLog).
- `ReviewOrders.tsx:72-75`: lỗi load chi tiết → hiện MOCK_STEPS như dữ liệu thật.
- `Login.tsx:216`: gợi ý mật khẩu "medequip" sai (thật là 123456).
- `StatusBadge.tsx:7-10`: mã trạng thái lạ → class rỗng, không nhãn dự phòng.
- `Layout.tsx:111`: role lạ trong localStorage → crash `startsWith(undefined)`.

**CSDL/hạ tầng**

- Toàn bộ cột thời gian là `timestamp` **không** `timestamptz` — trái quy tắc #3
  (QLTBYT.sql:64,142,167,199-200,229,271,292-293,312,337,358,369); comment
  `DataContext.cs:28` khẳng định sai.
- `fn_khoa_thiet_bi_qua_han` lỗi "column reference is ambiguous" (biến OUT
  `equipment_id` trùng tên cột, QLTBYT.sql:502-555) → gọi là ném; và **không
  có scheduler nào** chạy nó (pg_cron không cài, backend không có job) → "tự
  động khóa BR-01" thực tế không tự chạy.
- **nginx**: regex đuôi file `\.(jpg|png|…)$` thắng prefix `/uploads/` → ảnh
  upload trả 404 (cần `^~ /uploads/`); thiếu `client_max_body_size` (mặc định
  1MB) trong khi hệ thống cho 10MB → 413.
- Healthcheck Keycloak grep `"status": "UP"` (có space) — Keycloak 26 trả JSON
  không space → nhiều khả năng không bao giờ khớp, container unhealthy.
- `api depends_on keycloak: service_started` thay vì `service_healthy`.
- Đổi WEB_PORT/KEYCLOAK_PORT trong `.env` → realm JSON redirect URIs cứng
  3000/5173/8443 vỡ luồng đăng nhập.
- `web/Dockerfile:20`: `ARG VITE_OIDC_SCOPE=openid\ profile\ email` — backslash
  literal nếu build web rời; `web/Dockerfile:43` healthcheck dùng `localhost`
  (trái quy tắc #9 của chính dự án).
- `.dockerignore:18` loại `src/vite-env.d.ts` — file nguồn bị loại khỏi build.
- Seed lệch: comment 46 phiếu nhưng VALUES 47 (26 PM); phiếu `CHO_PHAN_CONG`
  vẫn có `assignee_id`; sự cố `DONG` nhưng `closed_at` NULL; trùng `employee_no`
  'NV001' (minhvt & longhduc); email seed `@bvtw.vn` ≠ Keycloak `@bvdk.vn`.
- Thiếu index cho FK hay dùng: `incidents.work_order_id`, `work_orders.equipment_id`,
  `users.department_id`, `equipment.maintenance_supplier_id`.
- `.env` (compose) đặt `AUTH_MODE=Dev` — stack Docker chạy xác thực dev mật khẩu,
  mâu thuẫn README mục 3 (bảo OIDC là mặc định khi Docker).

---

## MỨC 4 — THIẾU CHỨC NĂNG (cơ bản → nâng cao)

**Cơ bản (màn hình khoe nút mà không làm gì)**

- Nút chết không onClick: "⤓ Xuất Excel" (DeviceList, MasterCatalog, AuditLog
  CSV), "+ Thêm thiết bị" (DeviceList — dù backend đã có POST /devices),
  "Tải hồ sơ PDF" (DeviceDetail ×2), "Tạo phiếu HC ngay" (thiết bị khóa),
  "🔄 Đồng bộ Keycloak", "Sửa vai trò" (UserManagement), "Sửa" model/khoa/NCC
  (MasterCatalog), nút tải từng dòng bằng chứng (DeviceDetail).
- Không route 404/`errorElement` (`routes.ts`) → URL lạ trang trắng tiếng Anh.
- `/technician/calendar` map trùng MyWork → menu "Lịch cá nhân" mở nhầm màn.
- Không phân trang ở bất kỳ danh sách nào (2 phía).
- Không bảo vệ route theo vai trò trong router (Layout chỉ ẩn menu).

**Trung bình (CRUD & luồng nghiệp vụ hở)**

- Admin không sửa được gì: không PUT/DELETE thiết bị; không đổi vai trò/khóa
  người dùng; không hủy/xóa phiếu; không xóa phân công; không xóa bằng chứng.
- Sự cố: không endpoint đóng sự cố (status DONG, resolution, closed_at không
  bao giờ được ghi); UI không xem ảnh sự cố; wizard báo sự cố không bước đính
  ảnh (photoCount luôn 0).
- Báo cáo: không export CSV/PDF nào (chỉ JSON).
- Upload bằng chứng: không áp dụng max_files/accept_mime/mã bằng chứng hợp lệ.
- `POST /devices` + filter server-side của GET /devices tồn tại nhưng FE không
  dùng (tìm kiếm client-side, nạp toàn viện).
- AuditLog: backend hỗ trợ lọc actor/action/from/to nhưng UI lọc client-only.
- Form thiếu validate: SystemConfig nhận text tùy ý; deadline quá khứ; chu kỳ
  âm; giá trị config âm.
- Lưu nháp (WorkOrderExecution) chỉ là nút hình thức; DEMO_CODE '#HC-2026-0087'
  mặc định khi vào route thiếu mã.

**Nâng cao (thiếu hoàn toàn)**

- Không test tích hợp nào (WebApplicationFactory/service/seed/upload/middleware) —
  70 test xUnit toàn hàm thuần; không test chạm CSDL thật; hash test không có
  vector giá trị thật.
- Không CI (không .github/), không backup/restore CSDL, không script teardown.
- Không scheduler cho BR-01 (khóa thiết bị tự động).
- Không rate limiting / lockout cho login.
- Không i18n nhãn dự phòng cho mã trạng thái mới từ backend.
- Giá trị chuẩn HC cứng 10.0 (`WorkOrderService.cs:77`) — chưa có template theo
  model; `CreateOrderRequest` của Domain bị dùng làm DTO HTTP (rò rỉ tầng).

---

## MỨC 5 — ĐỒNG BỘ TÀI LIỆU / DỰ ÁN / MÔI TRƯỜNG

- **Repo chưa có commit nào** (branch `master` chưa commit lần đầu) — rủi ro
  mất toàn bộ công việc; hàng trăm file đang staged.
- README: nói "38 test" (thực 70); bảng tài khoản Keycloak thiếu `hungtv`;
  "Realm `123456`" → realm `medequip`; ghi QLTBYT.sql "nạp lại được nhiều lần"
  (thực tế đang hỏng theo mục 1.3).
- `KICH_BAN_TRINH_BAY_GK.md` mô tả quan hệ bằng tên bảng tiếng Việt cũ
  (`hang_san_xuat/model_thiet_bi/khoa_phong/thiet_bi/nguoi_dung/buoc_phieu/bang_chung`)
  — lệch với QLTBYT.sql hiện tại; typo "NEGIỆP VỤ".
- Rác repo: `--version/` (thư mục rác do lệnh sai), `.kilo/`,
  `docs/diagrams/docs/diagrams/` (path lặp), `src/imports/pasted_text/`,
  `database/.vs/`, bin/obj đã staged trong git (hàng trăm file build), 2 lock
  file song song (`package-lock.json` + `pnpm-lock.yaml`), `package.json` name
  `figma-make-app`, `CLAUDE.md` 11 byte.
- `vite.config.ts:6` import cứng `./.figma/make/site.json` → clone/CI thiếu
  `.figma` là `vite build` gãy.
- `scripts/up.ps1`: log mất dấu tiếng Việt; gợi ý "(admin / admin)" sai (thật
  123456); không có script teardown/reset.
- Ngữ cảnh probe cục bộ (máy này): DB `qltbyt` (postgres/123456) chưa từng có
  schema → tôi đã nạp QLTBYT.sql bằng tool Npgsql (bypass trigger trong seed vì
  lỗi 1.3). File `--version/` rác không động.

---

## THỨ TỰ ƯU TIÊN SỬA (đề xuất)

1. Đồng bộ `Entities.cs` ↔ `QLTBYT.sql` (chọn 1 naming: tiếng Anh của script)
   - đặt chuỗi kết nối PostgreSQL đúng trong appsettings.json.
2. Sửa 6 mismatch DTO/JSON tạo phiếu, phân công, users, devices, catalog,
   reports (chọn tên camelCase chuẩn, sửa FE hoặc BE một phía).
3. Nạp được QLTBYT.sql mọi ngày (dịch ngày mẫu theo CURRENT_DATE hoặc bypass
   trigger trong seed có kiểm soát) + bỏ `\set` hoặc tài liệu hóa ràng buộc psql.
4. Bảo mật: upload có auth + chống traversal; đưa `/uploads` sau xác thực;
   bỏ secret khỏi appsettings (env var); chặn rò thông báo; IDOR phiếu.
5. Bug runtime: incident CreatedAt, stepsDone Include, DateTime chuẩn UtcNow,
   seeder crash, map PostgresException → {code,message}, transaction cho audit.
6. nginx: `^~ /uploads/`, `client_max_body_size 10m`; sửa pattern healthcheck
   Keycloak; `service_healthy`.
7. Điền nút chết + route 404 + phân trang + đóng sự cố + export.
8. Thêm test tích hợp (WebApplicationFactory + Postgres testcontainer hoặc DB
   thật) — đây là lưới an toàn mà cả dự án đang không có.
9. Commit lần đầu cho repo; dọn rác mục MỨC 5; đồng bộ README/docs.

---

## PHẦN ĐÃ SỬA VÀ KIỂM CHỨNG — 12/11/2026 (sau báo cáo)

### 1. Đồng bộ Entities ↔ CSDL (mục 1.1)

- `Entities.cs` viết lại đủ 16 bảng: `[Table("tên_bảng_Anh")]` + `[Column("cột_Anh")]`
  cho **mọi** property (kể cả tên trùng), giữ nguyên property tiếng Việt nên
  controller/service không phải sửa. `system_config.updated_by` khai `string`
  (cột VARCHAR(50), trước đây `int` làm `/api/config` 500).
- `appsettings.json`: chuỗi kết nối PostgreSQL cục bộ
  (`Host=127.0.0.1;Port=5432;Database=qltbyt;Username=postgres;Password=123456`).
  Docker vẫn ghi đè bằng biến môi trường `ConnectionStrings__MedEquip` — không
  xung đột.

### 2. Hợp đồng FE ↔ BE (mục 1.4)

- Backend phát đúng field `src/api/types.ts`:
  devices (`idThietBi/idKhoa/hanHieuChuan/pmKeTiep/ngayNhap`, chi tiết thêm
  `warrantyLeft`), dashboard `upcomingCalibrations[].code`, catalog
  `name/category/idKhoa/idHang/idNcc`, evidence-config `maBangChung`,
  reports `code/status/orderType`, phân công trả `assignmentId/...`.
- FE gửi đúng key backend bind: tạo phiếu
  (`orderType/equipmentId/assigneeId/priority/deadline/description`),
  phân công (`workOrderId/equipmentId/assigneeId/scheduledDate`), lọc
  `assigneeId=`, `departmentId=`, `/users?role=`.
- Sửa thêm: `MyWork` comparator sắp xếp hai phía + nhãn HOAN_THANH
  "Đã nghiệm thu"; `DepartmentOrders` map `ApiWorkOrder` → `WorkOrder` (trước
  đây đổ thẳng JSON API vào state UI nên vỡ render) + style phiếu KT.

### 3. Seed SQL nạp được mọi ngày (mục 1.3)

- 4 khối `DO $shift_seed$` dịch ngày theo T0 = 2026-09-29 → `CURRENT_DATE`:
  equipment (chạy **trước** INSERT work_orders để trigger BR-01 đọc ngày đã
  dịch), work_orders (trước khối completed_at/reviewed_at và trước các bảng
  phái sinh), incidents, users/audit_log/notifications. Status history viết
  dạng `(CURRENT_DATE − n) + time`; sự cố DONG được điền `closed_at`.
- Hàm `fn_khoa_thiet_bi_qua_han`: sửa lỗi _column reference "equipment_id" is
  ambiguous_ (biến OUT trùng tên cột) — gọi hàm thật chạy OK.
- **Kiểm chứng**: nạp lại toàn bộ script trên PostgreSQL 18 **không tắt
  trigger/FK** (tương đương psql thuần) → thành công. Sau nạp:
  `wo_violate_br01 = 0`; DEV-042 đến hạn đúng hôm nay; DEV-009 còn 4 ngày;
  sự cố DONG thiếu `closed_at` = 0; chuỗi băm audit 0 dòng sai / 0 dòng đứt.

### 4. Bảo mật upload (mục 2)

- `evidenceCode`: chỉ chữ/số/gạch dưới, tối đa 30 ký tự, **và** phải có trong
  `required_evidence_config` của loại phiếu (`EVIDENCE_CODE_UNKNOWN` nếu
  không). Phần mở rộng tệp kiểm tra; `TenTep = Path.GetFileName`; ghi vào
  `ContentRootPath/uploads` (trước đây ghi vào `bin/Debug` nên URL trả về
  không mở được).
- `/uploads`: phục vụ sau `UseAuthentication` + middleware trả **401 tường
  minh** (UseStaticFiles không tự ép đăng nhập).
  Đo thật: không token → **401**, có token → **200**; `../../evil` và mã
  ngoài cấu hình → **400 INVALID_EVIDENCE_CODE**.

### 5. Bug runtime khác

- Sự cố: `CreatedAt = DateTime.UtcNow` khi báo (trước đây NULL → năm 1).
- `stepsDone` đếm đúng nhờ `.Include(w => w.Steps)`.
- Seeder: `SystemConfig.UpdatedAt = DateTime.UtcNow` (cột NOT NULL).
- `login`/`me` trả `department` thật (Include khoa); `/users` trả **tên khoa**
  thay vì số id; `/notifications` khi claim không ánh xạ → 403
  `USER_NOT_MAPPED` (trước đây trả hộp thư của toàn bộ người dùng).
- Middleware bắt **mọi** exception → JSON `INTERNAL_ERROR` 500 (log đầy đủ
  phía server, client không thấy chi tiết nội bộ).
- Chặn IDOR phiếu (đọc **và** ghi): KTV chỉ xem/thao tác phiếu được phân
  công cho mình (`GET/PATCH/POST` theo mã đều trả 403 nếu không phải chủ
  phiếu); đầu mối khoa chỉ xem phiếu thuộc khoa mình; điều phối/quản trị giữ
  quyền toàn viện. Đo thật: KTV khác mã phiếu → 403; chủ phiếu → 200;
  đầu mối khoa khác khoa → 403.

### 6. Kết quả bộ test bắt buộc (chạy sau khi sửa)

```
npm run typecheck   → EXIT=0
npm test            → 4 file, 35/35 test đạt
dotnet test         → 70/70 test đạt, 0 lỗi
```

### 7. Việc còn lại (chưa xử lý trong đợt này)

- Docker stack: chưa probe được vì daemon không chạy trên máy; các bẫy đóng
  gói trong `AGENTS.md` giữ nguyên hiệu lực.
- nginx: đã vá `location ^~ /uploads/` (regex cache từng thắng prefix khiến
  ảnh bằng chứng 404) và `client_max_body_size 12m` (mặc định 1 MB chặn ảnh
  điện thoại); chưa kiểm chứng được trong container vì daemon tắt.
- `Jwt:Key` còn trong `appsettings.json` (chỉ dùng dev) — production phải
  chuyển sang biến môi trường.
- Test tích hợp `WebApplicationFactory` + PostgreSQL thật; phân trang; các
  nút chết; commit đầu tiên cho repo.

### 8. Vòng debug cuối — kiểm chứng runtime (12/11/2026)

- Build sạch toàn bộ: `dotnet build --no-incremental` → **0 warning, 0 error**;
  `npm run build` → thành công (chỉ còn cảnh báo kích thước chunk 544 kB,
  thuần thẩm mỹ).
- Sửa nốt 2 vấn đề phát hiện khi soát log:
  - `AuditController` bỏ tham số `db` không dùng (warning CS9113).
  - `AsSplitQuery()` cho `GET /api/work-orders/{code}` **và**
    `GET /api/devices/{code}` — hai truy vấn nạp 2 collection lồng nhau
    (`Steps`+`Evidence`, `WorkOrders`+`Evidence`) từng sinh cảnh báo EF 20504
    và nguy cơ nhân chéo dòng.
- Smoke test runtime 36/36 điểm đạt trên API thật + PostgreSQL cục bộ:
  phân quyền ẩn danh (401), đủ 4 báo cáo, lịch phân công tuần, sự cố, thông
  báo; KTV xem phiếu mình 200 / phiếu người khác 403 (cả đọc lẫn ghi);
  ADMIN users/audit/config 200; BR-01 chặn PM thiết bị quá hạn hiệu chuẩn
  → 422; payload sai → 400/404; route lạ → 404.
- Log server sau smoke: **0 warning, 0 exception, 0 cảnh báo EF 20504**.
- `QLTBYT.sql` nạp lại bằng chế độ strict (trigger/FK bật): thành công.
  Kiểm tra sau nạp: 45 thiết bị, 47 phiếu, 52 dòng audit,
  **0 dòng sai chuỗi hash**, **0 phiếu PM vi phạm BR-01**.
- Chuỗi kiểm thử bắt buộc chạy lại lần cuối: `npm run typecheck` EXIT=0;
  `npm test` 35/35; `dotnet test` 70/70.

### 9. Đối chiếu với báo cáo đồ án và sửa theo báo cáo (12/11/2026)

Báo cáo đồ án (`1250080158_..._BC_CK.docx`) được đọc và đối chiếu toàn bộ 7
chương với mã nguồn. Chi tiết ở `BAO_CAO_DOI_CHIEU_WORD_2026-11-12.md`.

Tóm tắt các sửa đổi đã làm trong đợt này:

- BR-01: luồng tạo phiếu SC từ sự cố **không** kiểm luật ở tầng dịch vụ
  (lỗi trigger thành HTTP 500) → nay trả **422 CALIBRATION_OVERDUE**.
- BR-01: luật C# và trigger thống nhất — `THANH_LY` chỉ chặn phiếu PM/SC,
  HC/KT luôn được phép (lối thoát), và cùng so với **ngày dự kiến làm**.
- BR-03: `ck_step_result` khớp công thức C# kể cả khi giá trị chuẩn = 0.
- Thêm dịch vụ nền `AutoLockService`: tự khóa thiết bị quá hạn (BR-01) và
  gửi cảnh báo theo `warning_days_urgent` / `warning_days_critical`.
- Ngưỡng cảnh báo đọc từ `system_config` thay vì hard-code 30 ngày.
- FR-13: thêm `PUT /api/users/{id}/role|status` + nối nút chết ở màn quản trị.
- FR-14: API báo cáo giới hạn theo vai trò; thêm màn Báo cáo cho Quản trị.
- Đầu mối khoa chỉ xem thiết bị của khoa mình (chặn ở tầng API, bỏ mã khoa
  viết cứng trong giao diện).
- Ghi `performed_at` / `performed_by` khi cập nhật bước thực hiện.
- Giới hạn 30 lần đăng nhập/phút theo IP (429) và chặn tự khoá tài khoản
  quản trị.

Kiểm chứng: build 0 warning/0 error; `npm run typecheck` EXIT=0;
`npm test` 35/35; `dotnet test` **76/76**; smoke runtime đạt toàn bộ điểm
kiểm tra (422 khi vi phạm BR-01, 403 khi thiếu quyền, 429 khi vượt giới hạn
đăng nhập); `QLTBYT.sql` nạp lại strict thành công (45 thiết bị, 47 phiếu,
52 dòng audit, 0 sai chuỗi hash).

Bản Word đã vá 10 cụm sai lệch và thêm Phụ lục A, lưu thành
`1250080158_Dương Nguyễn Trường Sang_BC_CK_v2.docx` trên Desktop (bản gốc
giữ nguyên).
