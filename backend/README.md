# MED-EQUIP Backend — ASP.NET Core Web API (EF Core + PostgreSQL)

Solution 3 project theo cấu trúc phân tầng dùng cho khóa luận:

```
backend/
├── MedEquip.slnx
└── src/
    ├── MedEquip.Domain/          — Entities, hằng nghiệp vụ, BusinessException, interface dịch vụ
    ├── MedEquip.Infrastructure/  — DataContext (mapping snake_case), AuditService,
    │                               AssignmentService (BR-01 tầng 2), WorkOrderService, DbSeeder
    └── MedEquip.Api/             — Controllers (11 nhóm endpoint), JWT dev login, Swagger/OpenAPI
```

## 1. Chuẩn bị CSDL (bắt buộc chạy trước)

CSDL được tạo bằng **script SQL thuần** (có trigger BR-01 + CHECK sai số + seed + audit hash chain),
không dùng EF migration:

```powershell
$env:PGPASSWORD = "123456"
psql -U sa -d qltbyt -v ON_ERROR_STOP=1 -f ../database/QLTBYT.sql
```

> `psql` không xử lý được đường dẫn chứa dấu tiếng Việt, nên copy script ra
> đường dẫn ASCII trước khi chạy:
> `Copy-Item -LiteralPath "..\database\QLTBYT.sql" -Destination "$env:TEMP\QLTBYT.sql" -Force`

Script chạy lại được nhiều lần (mục 0 `DROP ... CASCADE`).

Chuỗi kết nối mặc định trong `src/MedEquip.Api/appsettings.json`:
`Host=localhost;Port=5432;Database=qltbyt;Username=sa;Password=123456`.

Mọi cột thời gian là `TIMESTAMPTZ` — Npgsql chỉ nhận `DateTime` có `Kind = Utc`.
`DataContext.NormalizeDateTimeToUtc()` tự quy đổi trước khi `SaveChanges`, nhưng
code mới vẫn nên dùng `DateTime.UtcNow` cho thẳng.

## 2. Chạy API

```
cd backend/src/MedEquip.Api
dotnet run
```

- API: `http://localhost:5000` (thay cổng theo output thực tế), OpenAPI JSON: `/openapi/v1.json`
- Lần đầu chạy, nếu bảng `equipment` rỗng → tự seed dữ liệu mẫu khớp UI mockData.ts
- Thư mục lưu bằng chứng: `MedEquip.Api/uploads/` (phục vụ tại `/uploads/...`)

## 3. Đăng nhập (bản dev)

`POST /api/auth/login` — `{"username":"dphuong","password":"123456"}` → JWT 8 giờ.
Tài khoản seed: `dphuong` (Điều phối), `minhvt`/`hungtv`/`lthimai` (KTV), `vanna` (Đầu mối khoa),
`longhduc` (Admin), mật khẩu chung `123456`.
Production: thay bằng OIDC/Keycloak — chỉ đổi Program.cs, không đổi controller.

## 4. Endpoint chính (đủ cho 15 màn UI)

| Màn UI                       | Endpoint                                                                                                                                                                                                            |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bảng điều khiển              | `GET /api/dashboard`                                                                                                                                                                                                |
| Thiết bị toàn viện / khoa    | `GET /api/devices?q&departmentId&status`, `POST /api/devices` (admin)                                                                                                                                               |
| Chi tiết thiết bị (timeline) | `GET /api/devices/{code}`                                                                                                                                                                                           |
| Lịch bảo trì (kéo-thả)       | `GET /api/assignments/week?weekStart`, `POST /api/assignments` ← **422 CALIBRATION_OVERDUE khi vi phạm BR-01**                                                                                                      |
| Phiếu công tác               | `GET /api/work-orders?status&type&assigneeId&departmentId&q`, `POST /api/work-orders`                                                                                                                               |
| Thực hiện phiếu (KTV)        | `GET /api/work-orders/{code}` (gồm `canComplete`, `blockingReasons`), `PATCH /api/work-orders/{code}/steps/{ordinal}`, `POST /api/work-orders/{code}/evidence` (multipart), `POST /api/work-orders/{code}/complete` |
| Nghiệm thu                   | `POST /api/work-orders/{code}/review/accept`, `POST /api/work-orders/{code}/review/return`                                                                                                                          |
| Báo hỏng                     | `POST /api/incidents`                                                                                                                                                                                               |
| Người dùng & vai trò         | `GET /api/users?role&q`                                                                                                                                                                                             |
| Audit Log (+ kiểm tra hash)  | `GET /api/audit?actor&action&from&to`                                                                                                                                                                               |
| Cấu hình hệ thống            | `GET /api/config`, `PUT /api/config/{key}`                                                                                                                                                                          |
| Danh mục nền                 | `GET /api/catalog/models                                                                                                                                                                                            | departments | manufacturers | suppliers | evidence-config`, `POST /api/catalog/models` |
| Báo cáo                      | `GET /api/reports/calibration                                                                                                                                                                                       | incidents   | pm            | evidence` |

## 5. Các luật nghiệp vụ ép ở nhiều tầng (chương kiểm chứng)

- **BR-01 chặn phân công**: tầng UI (nút vô hiệu + lý do) → tầng API
  `AssignmentService` (422 kèm số ngày quá hạn + chứng thư căn cứ + audit `ASSIGN_BLOCKED`)
  → tầng CSDL trigger `trg_assignments_block_overdue` (chống SQL tay).
- **BR-02 đủ bằng chứng mới hoàn thành**: `CompleteAsync` kiểm tra lại trong transaction
  (đủ bước + đủ `required_evidence_config` theo loại phiếu).
- **BR-03 sai số**: `PATCH steps` — server tự tính `DAT/KHONG_DAT` theo dung sai; phiếu HC
  có bước `KHONG_DAT` thì **nghiệm thu không được mở khóa thiết bị**.
- **Audit hash chain**: `SHA-256(UTF-8(prev|actor|action|target|detail))`, hex **chữ thường**
  — khớp hàm `fn_bam_audit` và view `v_audit_chain_verify` của PostgreSQL.
  (C# dùng `Convert.ToHexString` trả chữ _hoa_, phải `.ToLowerInvariant()` mới khớp giá trị
  đang lưu trong CSDL.) GET `/api/audit` trả `hashOk` từng dòng và cờ `chainIntact` toàn cục.

## 6. Kiểm tra nhanh BR-01 sau khi seed (psql)

```sql
-- PHẢI BỊ LỖI 50001 (thiết bị DEV-002 đã khóa):
INSERT assignments (work_order_id, equipment_id, assignee_id, scheduled_date, created_by)
VALUES (6, 2, 1, '2026-09-28', 3);
-- ĐƯỢC PHÉP (phiếu HC không bị chặn):
INSERT assignments (work_order_id, equipment_id, assignee_id, scheduled_date, created_by)
VALUES (1, 2, 1, '2026-09-25', 3);
```
