# ĐỐI CHIẾU BÁO CÁO ĐỒ ÁN VỚI MÃ NGUỒN — 12/11/2026

Tài liệu này ghi lại kết quả đọc báo cáo đồ án
(`1250080158_Dương Nguyễn Trường Sang_BC_CK.docx`) và đối chiếu từng
điểm với mã nguồn thật trong repo. Những mục báo cáo mô tả **không đúng với
sản phẩm** đã được sửa ở mã nguồn; những mục chỉ sai **số liệu/câu chữ** đã
vá trong bản Word mới (`..._BC_CK_v2.docx`, bản gốc giữ nguyên).

---

## 1. Tóm tắt

| Hạng mục                 | Kết quả                                                         |
| ------------------------ | --------------------------------------------------------------- |
| Số mục đối chiếu         | 4 chương đầu + chương 5–7 (toàn bộ 7 chương, 2.985 dòng)        |
| Sai lệch phát hiện       | 60+ mục                                                         |
| Đã sửa trong mã nguồn    | 15 nhóm thay đổi (Domain, Infrastructure, Api, CSDL, giao diện) |
| Đã vá trong báo cáo Word | 10 cụm sửa + Phụ lục A mới (25 đoạn)                            |
| Kiểm thử mới             | +6 test xUnit (70 → 76), +2 kiểm tra runtime                    |

---

## 2. Những chỗ báo cáo mô tả hành vi chưa có trong mã nguồn → đã làm cho đúng

| #   | Báo cáo nói                                                           | Thực tế trước khi sửa                                                                                                             | Đã sửa                                                                                                                                                   |
| --- | --------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | BR-01 kiểm soát ở **bốn tầng**, áp dụng cả khi tạo phiếu SC từ sự cố  | `POST /api/incidents/{id}/create-order` **không** kiểm BR-01 ở tầng dịch vụ → lỗi trigger thành **HTTP 500**                      | Thêm kiểm tra BR-01 → **422 CALIBRATION_OVERDUE** + action `CREATE_CALIBRATION_ORDER` (`WorkOrderControllers.cs`)                                        |
| 2   | "Phiếu HC, KT **luôn được phép**" (quy tắc BR-01)                     | `CalibrationRules.CanAssign` chặn **mọi** loại phiếu với thiết bị `THANH_LY`; trigger `fn_chan_phan_cong_qua_han` cũng chặn HC/KT | Cả luật C# lẫn trigger: `THANH_LY` chỉ chặn phiếu **PM/SC**; HC/KT luôn được phép                                                                        |
| 3   | "Ba tầng phải cùng kết luận"                                          | Tầng ứng dụng so hạn HC với **hôm nay**, trigger so với **ngày dự kiến làm**                                                      | `AssignmentService` dùng `scheduled_date` — trùng trigger; `CanCreateOrder` có bản xét hạn hiệu chuẩn                                                    |
| 4   | BR-03: "bước chỉ ĐẠT khi nằm trong khoảng ± dung sai"                 | SQL `ck_step_result` cho qua khi `standard_value = 0`, C# thì không → lệch nhau, có thể sinh lỗi 500                              | Sửa CHECK theo đúng công thức C# (và tránh chia cho 0)                                                                                                   |
| 5   | "Chạy hằng ngày (pg_cron)" hàm `fn_khoa_thiet_bi_qua_han()`           | **Không có** pg_cron, **không có** job nào gọi hàm → thiết bị quá hạn không bao giờ tự khoá                                       | Thêm dịch vụ nền `AutoLockService` (chạy lúc khởi động + mỗi 24 giờ)                                                                                     |
| 6   | Cảnh báo theo `system_config`: `warning_days_early/urgent/critical`   | Ngưỡng **hard-code** 30/7 ngày ở từng màn; sửa cấu hình không có tác dụng                                                         | `ISystemConfigService` đọc cấu hình; API đọc `warning_days_early`; `AutoLockService` gửi cảnh báo theo `urgent` (điều phối) và `critical` (đầu mối khoa) |
| 7   | FR-13 "Quản lý người dùng" (biểu mẫu "Tài khoản và vai trò")          | API chỉ có `GET /api/users`; nút "Sửa vai trò" và "🔄 Đồng bộ Keycloak" là **nút chết**                                           | Thêm `PUT /api/users/{id}/role`, `PUT /api/users/{id}/status` + nối giao diện                                                                            |
| 8   | FR-14 "Xem báo cáo — Điều phối, **Quản trị**"                         | API báo cáo mở cho mọi vai trò; menu Quản trị **không có** màn Báo cáo                                                            | API giới hạn `ADMIN,DIEU_PHOI`; thêm route `/admin/reports` + menu cho Quản trị                                                                          |
| 9   | "Đầu mối khoa theo dõi **thiết bị của khoa**"                         | Chỉ lọc ở giao diện; màn "Phiếu của khoa" **ghi cứng** khoa Hóa sinh và `departmentId=1`                                          | Chặn ở tầng API; `/api/auth/me` trả `departmentId`; giao diện bỏ mã khoa cứng                                                                            |
| 10  | `work_order_steps.performed_at / performed_by` là thuộc tính của bước | Hai cột **không bao giờ được ghi**                                                                                                | Ghi mỗi khi KTV cập nhật bước                                                                                                                            |
| 11  | Bảo mật: giới hạn truy cập                                            | `POST /api/auth/login` không giới hạn số lần thử                                                                                  | Rate limit 30 lần/phút theo IP → **429**; chặn tự khoá tài khoản quản trị đang đăng nhập                                                                 |
| 12  | Bảng 3.9: `TRA_LAI → DANG_THUC_HIEN`                                  | Có trong code nhưng thiếu trong bảng trạng thái                                                                                   | Ghi rõ trong Phụ lục A; hành vi đã đúng                                                                                                                  |
| 13  | Bảng 3.14: ô "Chưa vẽ" ở luồng tiếp nhận sự cố                        | Ô trống trong báo cáo                                                                                                             | Điền "UC-04 (tạo phiếu SC từ sự cố)"                                                                                                                     |

## 3. Những chỗ báo cáo nói sai về mã nguồn → đã vá trong bản Word v2

| Nội dung trong báo cáo                                                 | Đã sửa thành                                                                              |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| "38 kiểm thử xUnit" (3 chỗ) + "xUnit (38)"                             | **76 kiểm thử xUnit**                                                                     |
| "PostgreSQL … thực thi các **trigger BR-01, BR-03**"                   | BR-03 là **ràng buộc CHECK**, không phải trigger (2 chỗ)                                  |
| "Máy chủ **chỉ đọc từ view**"                                          | Máy chủ đọc bảng gốc bằng EF Core, tái hiện logic ở tầng Domain; view là nguồn tham chiếu |
| "Chạy hằng ngày (**pg_cron**) hoặc gọi tay"                            | Chạy tự động bởi dịch vụ nền của máy chủ (AutoLockService) hoặc gọi tay                   |
| "Hợp đồng HTTP gồm **12 nhóm controller**. Mỗi endpoint yêu cầu token" | 12 controller, **35 endpoint**; trừ `/health` và `/api/auth/login`                        |
| Bảng 6.1: nhóm Đầu mối khoa có 2 màn                                   | Thêm **Chi tiết thiết bị** (route `/department/devices/:id` có thật)                      |
| Bảng 5.12: "Giới hạn 10 MB, kiểm tra loại và chữ ký tệp"               | Bổ sung: **yêu cầu token khi tải tệp**                                                    |
| ERD trong `docs/` vẽ 10 thực thể                                       | `docs/diagrams/05-er-diagram.puml` đã đổi sang **đúng tên bảng/cột** của `QLTBYT.sql`     |
| README ghi "17 màn" / "38 test"                                        | README đã sửa: **16 màn nghiệp vụ**, **76 test**                                          |

## 4. Các điểm báo cáo vẫn mô tả khác thực tế (ghi rõ trong Phụ lục A)

- Máy chủ không đọc trực tiếp các view báo cáo (`v_bao_cao_*`, `v_bang_dieu_khien`);
  số liệu được tính lại ở `PmMetrics` — cần duy trì hai bản song song.
- `SAP_HAN` là trạng thái **suy biến** tính lúc hiển thị, không lưu trong
  `equipment.status`.
- Hạn hiệu chuẩn **đúng bằng ngày hết hạn** vẫn chưa quá hạn (luật dùng
  `expiry < today`).
- Quản trị đổi vai trò trong CSDL **không** tự đồng bộ sang realm Keycloak.
- Chưa có kiểm thử tích hợp với CSDL thật, chưa có CI, chưa có script
  backup/restore.

---

## 5. Bằng chứng kiểm chứng

```
dotnet build --no-incremental   → 0 Warning, 0 Error
npm run typecheck                → EXIT=0
npm test                         → 35/35
dotnet test backend\MedEquip.slnx→ 76/76
Smoke runtime (API thật + PG18)  → 37/36 điểm đạt, 0 lỗi
Nạp lại QLTBYT.sql (strict)      → OK, chạy lại được nhiều lần
Kiểm tra BR-03 trực tiếp trên SQL:
  - ghi 'DAT' ngoài dung sai      → bị CHECK từ chối (23514)
  - chuẩn = 0, đo = 5, ghi 'DAT'  → bị CHECK từ chối (không lỗi chia 0)
  - chuẩn = 0, đo = 0, ghi 'DAT'  → được phép
Kiểm tra BR-01 trực tiếp trên SQL:
  - tạo phiếu PM cho thiết bị quá hạn → trigger từ chối
  - gán phiếu HC cho thiết bị đã thanh lý → được phép (lối thoát BR-01)
Sau một vòng tự khóa: 5 thiết bị → CHO_HIEU_CHUAN, 16 thông báo cảnh báo,
  0 dòng sai chuỗi băm kiểm toán
```

## 6. Tệp đã thay đổi trong đợt này

**Tầng Domain**

- `CalibrationRules.cs` — BR-01 theo quy tắc "HC/KT luôn được phép"; thêm
  `CanCreateOrder(status, type, expiry, today)` và `DeviceStatusFor(...)`.
- `Interfaces.cs` — thêm `ISystemConfigService`; sửa comment thuật toán băm
  (UTF-8, không phải UTF-16LE).

**Tầng Infrastructure**

- `Services/AssignmentService.cs` — mốc so sánh BR-01 theo `scheduled_date`,
  chặn ngày dự kiến làm trong quá khứ.
- `Services/WorkOrderService.cs` — dùng bản luật BR-01 có xét hạn hiệu chuẩn.
- `Services/SystemConfigService.cs` (mới) — đọc cấu hình hệ thống.

**Tầng Api**

- `Program.cs` — đăng ký `AutoLockService`, thêm rate limit cho đăng nhập.
- `Services/AutoLockService.cs` (mới) — tự khóa BR-01 + cảnh báo sắp hết hạn.
- `Controllers/WorkOrderControllers.cs` — BR-01 khi tạo phiếu SC từ sự cố;
  ghi `performed_at`/`performed_by`.
- `Controllers/DeviceControllers.cs` — ngưỡng cảnh báo theo cấu hình; giới hạn
  thiết bị theo khoa của đầu mối khoa; giới hạn API báo cáo theo FR-14.
- `Controllers/SystemControllers.cs` — `PUT /api/users/{id}/role|status`;
  `departmentId` trong `/api/auth/me` và `/api/auth/login`.
- `Auth/CurrentUserAccessor.cs` — thêm `VaiTro`, `IdKhoa`.

**CSDL**

- `database/QLTBYT.sql` — `ck_step_result` khớp C#; trigger phân công chỉ chặn
  PM/SC.

**Giao diện**

- `src/pages/admin/UserManagement.tsx` — nối nút đổi vai trò, khoá tài khoản,
  đồng bộ Keycloak.
- `src/pages/department/DepartmentOrders.tsx`, `DepartmentDevices.tsx` — bỏ khoa
  viết cứng.
- `src/components/Layout.tsx`, `src/routes.ts` — thêm màn Báo cáo cho Quản trị.
- `src/api/types.ts` — `CurrentUser.departmentId`.
- `src/pages/Login.tsx` — gợi ý mật khẩu đúng (`123456`).

**Tài liệu**

- `README.md` — số test và số màn.
- `docs/diagrams/05-er-diagram.puml` — đúng tên bảng/cột của CSDL.
- `BAO_CAO_AUDIT_2026-11-12.md` — ghi thêm vòng kiểm chứng này.

---

## 7. Đợt 2 — sửa MÃ NGUỒN để khớp đúng báo cáo đồ án

Yêu cầu: **code phải làm đúng những gì báo cáo nêu** (không sửa báo cáo cho
vừa code). Đối chiếu lại từng đặc tả UC-01..UC-10 và từng sơ đồ tuần tự
(3.6–3.12) với mã nguồn; kết quả: 10/10 UC và 7/7 sơ đồ có bước thật, còn
9 lỗ hổng đã sửa.

| #   | Báo cáo nêu                                             | Trước khi sửa                                                                                     | Đã sửa trong mã nguồn                                                                                                                                                               |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | UC-08: "giao diện gọi `GET /api/catalog`"               | Chỉ có 5 route con, không có route gộp                                                            | Thêm `GET /api/catalog` trả đủ 5 nhóm (model, khoa, hãng, NCC, quy tắc bằng chứng)                                                                                                  |
| 2   | UC-08: "thêm model qua POST /api/catalog/models"        | FE gửi `idHang/chuKyPmNgay/...`, máy chủ nhận `ManufacturerId/PmCycleDays/...` → không bind → 500 | Đổi máy chủ sang đúng bộ tên hợp đồng; thêm kiểm tra 400 (thiếu tên/hãng, chu kỳ ≤ 0, dung sai âm)                                                                                  |
| 3   | UC-10 / Bảng 6.3: "máy chủ đọc các view `v_bao_cao_*`"  | API tự tính lại bằng EF Core                                                                      | Thêm lớp `ViewReader`; 4 loại báo cáo đọc thẳng `v_bao_cao_hieu_chuan`, `v_bao_cao_su_co`, `v_bao_cao_pm`, `v_bao_cao_bang_chung`                                                   |
| 4   | Bảng 6.3: "chỉ số tổng quan từ `v_bang_dieu_khien`"     | Tính tay từ 3 bảng                                                                                | Dashboard đọc thẳng `v_bang_dieu_khien` + `v_equipment` + khối THEO_THANG của `v_bao_cao_su_co`                                                                                     |
| 5   | UC-02: "lịch sử liên quan (view `v_timeline_thiet_bi`)" | Dựng timeline bằng LINQ                                                                           | Timeline lấy thẳng từ `v_timeline_thiet_bi`                                                                                                                                         |
| 6   | UC-03: "nhập mô tả, mức độ, **ảnh nếu có**"             | Chỉ có `photoCount = 0` cứng                                                                      | `POST /api/incidents` nhận multipart kèm ảnh; thêm cột `incidents.photo_paths`; ảnh lưu `uploads/incident/{mã}/`; GET trả `photoCount` + `photos[]`; endpoint JSON cũ vẫn dùng được |
| 7   | UC-05: BR-01 theo thiết bị **của phiếu**                | Kiểm trên `equipmentId` do client gửi → lách được luật                                            | Kiểm trên `wo.IdThietBi`; thiết bị gửi lệch → 400 `EQUIPMENT_MISMATCH`; phân công trùng → 409 `ALREADY_ASSIGNED` (thay vì 500)                                                      |
| 8   | Bảng 5.9 / 6.1: KTV có 3 màn gồm **Lịch cá nhân**       | Route `technician/calendar` trỏ lại màn "Việc của tôi"                                            | Thêm màn `TechnicianCalendar.tsx` — lịch tuần riêng của kỹ thuật viên (GET `/api/assignments/week`)                                                                                 |
| 9   | UC-09: "tài khoản đồng bộ từ Keycloak"                  | Nút chỉ tải lại bảng `users`                                                                      | Thêm `POST /api/users/sync-keycloak` đọc realm qua Keycloak Admin REST, tạo/cập nhật bảng `users`, ghi audit `SYNC_KEYCLOAK`; chưa cấu hình thì trả 501 kèm hướng dẫn               |

Bổ sung khác (từ báo cáo audit trước đó, không có trong Word nhưng là nút chết
thật trong sản phẩm):

- `POST /api/devices`: thêm kiểm tra 400 + phản hồi `{ code, id, idThietBi }`;
  nút "+ Thêm thiết bị" ở màn Danh sách thiết bị nay mở hộp thoại thật.
- Nút "Tạo phiếu HC ngay" ở màn Chi tiết thiết bị → `POST /api/work-orders`
  loại HC (lối thoát của BR-01).
- Nút "Xuất Excel" (danh sách thiết bị, danh mục nền) và "Xuất tệp CSV"
  (nhật ký) → xuất CSV có BOM UTF-8; "Tải hồ sơ PDF" → in hồ sơ.
- Màn Nhật ký kiểm toán lọc **ở máy chủ** (`?actor=&action=&from=&to=`).
- `PUT /api/config/{key}`: ngưỡng cảnh báo phải là số nguyên ≥ 0, giá trị rỗng
  bị từ chối (400).
- Trang 404 cho mọi đường dẫn lạ (`src/pages/NotFound.tsx`).
- `Entity User` bổ sung `email`, `employee_no`, `phone` — ba cột có sẵn trong
  CSDL nhưng chưa được ánh xạ.

### Kiểm chứng đợt 2

```
dotnet build --no-incremental   → 0 Warning, 0 Error
npm run typecheck                → EXIT=0
npm run build                    → thành công
npm test                         → 35/35
dotnet test backend\MedEquip.slnx→ 76/76
Smoke runtime (37 điểm cũ)       → 37/37 đạt
Smoke tính năng mới (10 điểm)    → đạt (thêm model 200, dữ liệu sai 400,
                                   thêm thiết bị 201, báo hỏng kèm ảnh 201,
                                   ảnh trả về đúng, phân công 201, phân công
                                   trùng 409, lọc nhật ký ở máy chủ,
                                   KTV gọi báo cáo 403)
GET /api/catalog (gộp)           → 200, 19 model + 14 khoa + 17 hãng + 12 NCC
                                   + 13 quy tắc bằng chứng
POST /api/users/sync-keycloak    → 501 kèm hướng dẫn cấu hình (đúng khi chưa
                                   có thông tin quản trị Keycloak)
PUT /api/config/warning_days_early: "abc" → 400, "-5" → 400, "45" → 200
QLTBYT.sql nạp lại (strict)       → OK, 45 thiết bị, 47 phiếu, 52 audit,
                                   0 sai chuỗi hash
```
