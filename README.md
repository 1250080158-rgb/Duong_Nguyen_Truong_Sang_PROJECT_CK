# MED-EQUIP — Hệ thống quản lý thiết bị y tế và bảo trì

Ứng dụng quản lý vòng đời thiết bị y tế: theo dõi hiệu chuẩn, lịch bảo trì
định kỳ (PM), sửa chữa (SC), phiếu công tác, bằng chứng và nhật ký kiểm toán
bất biến.

| Thành phần  | Công nghệ                                                      |
| ----------- | -------------------------------------------------------------- |
| Giao diện   | React 19 + Vite 8 + Tailwind CSS 4 + React Router              |
| API         | ASP.NET Core 10 (3 tầng: Domain / Infrastructure / Api)        |
| CSDL        | PostgreSQL 18 (schema bằng script thuần, không dùng migration) |
| Xác thực    | OpenID Connect + Keycloak (Authorization Code + PKCE)          |
| Đóng gói    | Docker Compose (4 dịch vụ)                                     |
| Kiểm thử    | Vitest (giao diện) + xUnit (API)                               |
| Hook commit | Husky + lint-staged                                            |

---

## 1. Yêu cầu cài đặt

| Phần mềm       | Phiên bản cần | Đã kiểm thử với | Ghi chú                                      |
| -------------- | ------------- | --------------- | -------------------------------------------- |
| .NET SDK       | 10.0          | 10.0.403        | `dotnet --version` để kiểm tra               |
| Node.js        | ≥ 22          | v24.21.0        | `node --version` để kiểm tra                 |
| PostgreSQL     | 18            | 18              | Chỉ cần khi chạy không dùng Docker           |
| Docker Desktop | bản mới       | —               | Chỉ cần khi chạy bằng Docker Compose (mục 3) |

Cài hook commit tự động khi chạy `npm install` lần đầu (script `prepare`
chạy `husky`).

> **Lưu ý đường dẫn:** thư mục dự án chứa dấu tiếng Việt (`CK Thứ 6`) gây
> hai bẫy đã biết: (1) `psql` không xử lý được đường dẫn có dấu — copy script
> CSDL ra `%TEMP%` trước khi nạp; (2) Docker CLI không dựng phiên bake từ hai
> target trở lên — dùng `scripts\up.ps1` (mục 3.3).

---

## 2. Cài đặt và chạy bằng tay (phát triển)

Thứ tự: nạp CSDL → chạy API → chạy giao diện → đăng nhập.

### 2.1. Nạp CSDL

Tạo database `qltbyt` trống trước (nếu chưa có):

```powershell
$env:PGPASSWORD = "123456"
psql -U postgres -c "CREATE DATABASE qltbyt;"
```

Nạp toàn bộ schema + dữ liệu mẫu (copy ra đường dẫn ASCII để tránh lỗi dấu):

```powershell
Copy-Item database\QLTBYT.sql "$env:TEMP\QLTBYT.sql" -Force
psql -U postgres -d qltbyt -v ON_ERROR_STOP=1 -f "$env:TEMP\QLTBYT.sql"
```

Script **chạy lại được nhiều lần** (khối `DROP ... CASCADE` đầu file dọn
sạch trước khi tạo lại). Nội dung sau khi nạp:

- 45 thiết bị, 17 hãng, 18 model, 14 khoa, 12 nhà cung cấp
- 47 phiếu công tác, 231 bước checklist, 98 bằng chứng, 18 sự cố
- 15 người dùng, 30 phân công, 52 dòng nhật ký kiểm toán
- Trigger **BR-01** (chặn phân công phiếu khai thác cho thiết bị quá hạn
  hiệu chuẩn), trigger **BR-03** (chặn ghi sai số vượt dung sai)
- Các view báo cáo: `v_bao_cao_hieu_chuan`, `v_bao_cao_su_co`,
  `v_bao_cao_pm`, `v_bao_cao_bang_chung`, `v_bang_dieu_khien`,
  `v_timeline_thiet_bi`, `v_equipment`

Chuỗi kết nối mặc định API dùng (đổi trong `backend/src/MedEquip.Api/appsettings.json`
hoặc bằng biến `ConnectionStrings__MedEquip`):

```
Host=127.0.0.1;Port=5432;Database=qltbyt;Username=postgres;Password=123456
```

### 2.2. Chạy API

```powershell
dotnet run --project backend\src\MedEquip.Api
# Nghe mặc định tại http://localhost:5000 (đã đặt sẵn trong launchSettings)
```

Kiểm tra sống (có cả kiểm tra kết nối CSDL):

```powershell
Invoke-RestMethod http://localhost:5000/health
# { status = "ok"; database = "up" }
```

Lúc khởi động, dịch vụ nền `AutoLockService` chạy ngay một vòng: tự khóa
thiết bị quá hạn hiệu chuẩn (BR-01), gửi cảnh báo sắp đến hạn vào bảng
`notifications`. Đây là hành vi đúng, không phải lỗi.

### 2.3. Chạy giao diện

```powershell
npm install                         # lần đầu
Copy-Item .env.example .env.local   # lần đầu
npm run dev
```

Vite mặc định mở `http://localhost:8443` (cổng đặt trong `vite.config.ts`;
thay bằng biến `$PORT` nếu cần). Chế độ dữ liệu mẫu bật khi API chưa chạy —
xem mục 7.

### 2.4. Đăng nhập

Ở chế độ **Dev** (`Auth:Mode = "Dev"`, mặc định khi chạy bằng tay), màn
`/login` gọi `POST /api/auth/login`. Mật khẩu chung: **`123456`** — áp dụng
cho mọi người dùng đang hoạt động trong CSDL. Năm tài khoản chính:

| Tài khoản  | Họ tên                 | Vai trò           | Đăng nhập xong thấy            |
| ---------- | ---------------------- | ----------------- | ------------------------------ |
| `dphuong`  | Phạm Thị Diễm Phương   | Điều phối         | 8 màn điều phối                |
| `minhvt`   | Nguyễn Minh Vĩnh Thịnh | Kỹ thuật viên     | Việc của tôi, Lịch, Thực hiện  |
| `hungtv`   | Trần Văn Hùng          | Kỹ thuật viên     | Như trên                       |
| `vanna`    | Nguyễn Thị Ánh Vân     | Đầu mối khoa      | Thiết bị + phiếu của khoa      |
| `longhduc` | Hoàng Đức Long         | Quản trị hệ thống | Người dùng, Nhật ký, Cấu hình… |

Hạn chế truy vấn đăng nhập: **30 lần/phút/máy** — vượt giới hạn máy chủ trả
**HTTP 429**. Chạy script kiểm thử lặp nhanh dễ dính lỗi này; đợi một phút
là hết.

---

## 3. Chạy bằng Docker Compose (đầy đủ: PostgreSQL + Keycloak + API + Web)

### 3.1. Khởi động

```powershell
Copy-Item .env.example.docker .env   # lần đầu
.\scripts\up.ps1
```

Script build **từng dịch vụ một** rồi `docker compose up -d`. Lần khởi động
đầu, PostgreSQL tự nạp `database/QLTBYT.sql` và Keycloak tự nạp realm từ
`docker/keycloak/realm-medequip.json`.

### 3.2. Địa chỉ và tài khoản

| Dịch vụ    | Địa chỉ               | Tài khoản                                       |
| ---------- | --------------------- | ----------------------------------------------- |
| Giao diện  | http://localhost:3000 | Đăng nhập qua Keycloak (dùng tài khoản mục 2.4) |
| API        | http://localhost:8081 | —                                               |
| Keycloak   | http://localhost:8080 | Quản trị: `admin` / `123456`                    |
| PostgreSQL | localhost:5432        | `sa` / `123456`                                 |

Lệnh thường dùng:

```powershell
docker compose ps           # mỗi dịch vụ phải ghi (healthy)
docker compose logs -f api  # theo dõi log API
docker compose restart api  # khởi động lại một dịch vụ
docker compose down         # dừng, giữ dữ liệu
docker compose down -v      # dừng và XOÁ cả CSDL + bằng chứng đã tải
```

### 3.3. Vì sao phải dùng `scripts\up.ps1`, không dùng `docker compose up -d --build`

`docker compose up -d --build` báo lỗi:

```
failed to dial gRPC: rpc error: code = Internal desc = header key
"x-docker-expose-session-sharedkey" contains value with non-printable
ASCII characters
```

Đây là lỗi của Docker CLI, không phải cấu hình của dự án. Nguyên nhân chính
xác: khi thư mục dự án chứa dấu tiếng Việt (thư mục này tên là `CK Thứ 6`),
Docker CLI không dựng được phiên bake có **từ hai target trở lên**. Build
một target thì bình thường.

Đã kiểm chứng từng trường hợp:

| Cách chạy                                                 | Kết quả   |
| --------------------------------------------------------- | --------- |
| `docker build -f ... .`                                   | Chạy được |
| `docker buildx build ... --load .`                        | Chạy được |
| `docker compose build api` (một target)                   | Chạy được |
| `docker compose build` (hai target)                       | Lỗi       |
| `docker compose build --parallel api web`                 | Lỗi       |
| `COMPOSE_PARALLEL_LIMIT=1 docker compose build`           | Vẫn lỗi   |
| `docker compose build api` rồi `docker compose build web` | Chạy được |

`COMPOSE_PARALLEL_LIMIT=1` không có tác dụng, nên nguyên nhân nằm ở **số
target trong một phiên bake**, không phải số build chạy song song.
`scripts\up.ps1` build từng dịch vụ một rồi `docker compose up -d`, chạy
trực tiếp trong thư mục dự án, không cần copy sang đường dẫn khác.

Nếu vẫn muốn tự gõ:

```powershell
docker compose build api
docker compose build web
docker compose up -d
```

### 3.4. Lấy token thật từ Keycloak để thử API bằng dòng lệnh

Realm `medequip` bật luồng Resource Owner Password Credentials để kiểm thử
nhanh:

```powershell
$body = @{
  client_id = 'medequip-ui'; username = 'dphuong'; password = '123456'
  grant_type = 'password';      scope = 'openid profile email'
}
$token = (Invoke-RestMethod `
  -Uri 'http://localhost:8080/realms/medequip/protocol/openid-connect/token' `
  -Method Post -Body $body -ContentType 'application/x-www-form-urlencoded').access_token

Invoke-RestMethod -Uri 'http://localhost:3000/api/auth/me' `
  -Headers @{ Authorization = "Bearer $token" }
```

Cần tắt `directAccessGrantsEnabled` trong `docker/keycloak/realm-medequip.json`
khi triển khai thật; khi đó chỉ còn luồng Authorization Code + PKCE.

---

## 4. Xác thực — hai chế độ

Chuyển chế độ bằng cấu hình `Auth:Mode` (API) và `VITE_OIDC_ENABLED` (giao
diện). Hai bên phải cùng chế độ.

### 4.1. Chế độ OIDC (bản thật — mặc định khi chạy Docker)

Người dùng đăng nhập qua Keycloak bằng **Authorization Code + PKCE**:
trình duyệt chuyển tới Keycloak, đăng nhập xong Keycloak trả mã, ứng dụng
đổi mã lấy access token. Mật khẩu không bao giờ đi qua mã ứng dụng.

```
Cấu hình backend  : Auth:Mode = "Oidc"
                    Auth:Oidc:Authority        = http://keycloak:8080/realms/medequip
                    Auth:Oidc:PublicAuthority  = http://localhost:8080/realms/medequip
                    Auth:Oidc:Audience         = medequip-api
Cấu hình frontend : VITE_OIDC_ENABLED = true
                    VITE_OIDC_AUTHORITY = http://localhost:8080/realms/medequip
```

`Authority` và `PublicAuthority` tách riêng vì: token do Keycloak phát hành
mang issuer là tên miền công khai (trình duyệt gọi được), còn API trong
Docker tải khoá công khai qua tên nội bộ. Ghi đè `ValidIssuer` bằng issuer
công khai giúp kiểm tra vẫn đúng.

Ở chế độ này `POST /api/auth/login` **trả 404** — không ai lách được bằng
cách gọi thẳng API.

**Đồng bộ tài khoản từ Keycloak (màn Người dùng & vai trò):** nút
"Đồng bộ Keycloak" gọi `POST /api/users/sync-keycloak`, đọc danh sách tài
khoản + vai trò trong realm qua Keycloak Admin REST rồi tạo/cập nhật bảng
`users`. Cần cấu hình:

```
Auth:Oidc:Realm          = medequip
Auth:Oidc:AdminUsername  = admin       # đã đặt sẵn trong docker-compose.yml
Auth:Oidc:AdminPassword  = 123456
```

Chưa cấu hình thì máy chủ trả **501** kèm hướng dẫn — đúng hành vi, không
phải lỗi.

Vai trò khai trong realm được dịch sang vai trò nghiệp vụ của ứng dụng:

| Vai trò trong Keycloak    | Vai trò trong ứng dụng | Quyền                            |
| ------------------------- | ---------------------- | -------------------------------- |
| `MED-EQUIP_ADMIN`         | `ADMIN`                | Toàn quyền                       |
| `MED-EQUIP_DIEU_PHOI`     | `DIEU_PHOI`            | Tạo, phân công, nghiệm thu phiếu |
| `MED-EQUIP_KY_THUAT_VIEN` | `KY_THUAT_VIEN`        | Thực hiện phiếu được giao        |
| `MED-EQUIP_DAU_MOI_KHOA`  | `DAU_MOI_KHOA`         | Xem thiết bị và phiếu của khoa   |

Việc dịch nằm ở `RoleMapping.Resolve` và `AppRoleClaimsTransformation`, nên
các `[Authorize(Roles = "...")]` sẵn có trong controller không phải sửa theo
chế độ xác thực.

### 4.2. Chế độ Dev (chạy nhanh, không cần Keycloak)

```
Auth:Mode          = "Dev"
VITE_OIDC_ENABLED  = false
```

Màn `/login` hiện form tài khoản/mật khẩu gọi thẳng `POST /api/auth/login`
(mục 2.4). Chuyển chế độ khi đang chạy API trực tiếp:

```powershell
dotnet run --project backend\src\MedEquip.Api -- --Auth:Mode=Oidc
```

---

## 5. Màn hình theo vai trò (17 màn nghiệp vụ)

| #   | Màn                  | Đường dẫn                      | Điều phối | KTV | Đầu mối khoa | Quản trị |
| --- | -------------------- | ------------------------------ | :-------: | :-: | :----------: | :------: |
| 1   | Bảng điều khiển      | `/coordinator/dashboard`       |     ✔     |     |              |          |
| 2   | Danh sách thiết bị   | `/coordinator/devices`         |     ✔     |     |              |          |
| 3   | Chi tiết thiết bị    | `/coordinator/devices/:id`     |     ✔     |     |      ✔       |          |
| 4   | Lịch bảo trì         | `/coordinator/calendar`        |     ✔     |     |              |          |
| 5   | Phiếu công tác       | `/coordinator/orders`          |     ✔     |     |              |          |
| 6   | Nghiệm thu phiếu     | `/coordinator/review`          |     ✔     |     |              |          |
| 7   | Sự cố                | `/coordinator/incidents`       |     ✔     |     |              |          |
| 8   | Báo cáo              | `/coordinator/reports`         |     ✔     |     |              |    ✔     |
| 9   | Việc của tôi         | `/technician/my-work`          |           |  ✔  |              |          |
| 10  | Thực hiện phiếu      | `/technician/work-order/:code` |           |  ✔  |              |          |
| 11  | Lịch cá nhân         | `/technician/calendar`         |           |  ✔  |              |          |
| 12  | Thiết bị khoa        | `/department/devices`          |           |     |      ✔       |          |
| 13  | Phiếu của khoa       | `/department/orders`           |           |     |      ✔       |          |
| 14  | Người dùng & vai trò | `/admin/users`                 |           |     |              |    ✔     |
| 15  | Nhật ký kiểm toán    | `/admin/audit`                 |           |     |              |    ✔     |
| 16  | Cấu hình hệ thống    | `/admin/config`                |           |     |              |    ✔     |
| 17  | Danh mục nền         | `/admin/catalog`               |           |     |              |    ✔     |

Ngoài ra: `/login`, `/auth/callback` (về từ Keycloak), trang 404 cho mọi
đường dẫn lạ. Đầu mối khoa chỉ xem được thiết bị/phiếu của khoa mình — chặn
ở tầng API, không chỉ lọc phía giao diện.

---

## 6. Biến môi trường

**Giao diện** — `.env.local` (sao chép từ `.env.example`):

| Biến                     | Mặc định                                | Ý nghĩa                         |
| ------------------------ | --------------------------------------- | ------------------------------- |
| `VITE_API_BASE`          | `http://localhost:5000/api`             | Địa chỉ API                     |
| `VITE_OIDC_ENABLED`      | `false`                                 | `true` = đăng nhập qua Keycloak |
| `VITE_OIDC_AUTHORITY`    | `http://localhost:8080/realms/medequip` | Realm Keycloak                  |
| `VITE_OIDC_CLIENT_ID`    | `medequip-ui`                           | Client OIDC                     |
| `VITE_OIDC_SCOPE`        | `openid profile email`                  | Scope yêu cầu                   |
| `VITE_OIDC_REDIRECT_URI` | suy ra từ địa chỉ hiện tại              | Đặt rõ khi chạy Docker          |

**Docker Compose** — `.env` (sao chép từ `.env.example.docker`):

| Biến                      | Mặc định | Ý nghĩa                                     |
| ------------------------- | -------- | ------------------------------------------- |
| `WEB_PORT`                | `3000`   | Cổng giao diện                              |
| `API_PORT`                | `8081`   | Cổng API                                    |
| `KEYCLOAK_PORT`           | `8080`   | Cổng Keycloak                               |
| `POSTGRES_PORT`           | `5432`   | Cổng PostgreSQL                             |
| `AUTH_MODE`               | `Oidc`   | Chế độ xác thực API (`Oidc` / `Dev`)        |
| `OIDC_UI_ENABLED`         | `true`   | Phải khớp với `AUTH_MODE` (`true` ↔ `Oidc`) |
| `KEYCLOAK_ADMIN`          | `admin`  | Tài khoản quản trị Keycloak lần đầu         |
| `KEYCLOAK_ADMIN_PASSWORD` | `123456` | Mật khẩu quản trị Keycloak                  |
| `POSTGRES_PASSWORD`       | `123456` | Đổi trước khi triển khai thật               |

**API** — `appsettings.json` hoặc biến môi trường kiểu `Auth__Mode`:

| Khóa                                | Ý nghĩa                                             |
| ----------------------------------- | --------------------------------------------------- |
| `ConnectionStrings:MedEquip`        | Chuỗi kết nối PostgreSQL                            |
| `Auth:Mode`                         | `Dev` / `Oidc`                                      |
| `Auth:Oidc:Authority`               | Realm nội bộ (API dùng để tải khoá công khai)       |
| `Auth:Oidc:PublicAuthority`         | Realm công khai (để đối chiếu issuer của token)     |
| `Auth:Oidc:Audience`                | `medequip-api`                                      |
| `Auth:Oidc:Realm`                   | Tên realm — dùng cho đồng bộ tài khoản              |
| `Auth:Oidc:AdminUsername/-Password` | Tài khoản quản trị Keycloak — dùng cho đồng bộ      |
| `Jwt:Key`                           | Khoá ký JWT ở chế độ Dev (đổi trước khi triển khai) |
| `Cors:AllowedOrigins`               | Các nguồn được gọi API                              |

---

## 7. Hành vi khi API chưa chạy (dữ liệu mẫu)

Giao diện có **chế độ dữ liệu mẫu**: khi gọi API thất bại vì **lỗi mạng**,
màn hình rơi về `src/data/mockData.ts` để vẫn xem được giao diện. Lỗi nghiệp
vụ từ máy chủ (400/403/409/422…) thì **không** rơi về dữ liệu mẫu — hiển thị
thông báo lỗi thật để không bao giờ nhầm dữ liệu giả với dữ liệu thật.

---

## 8. Kiểm thử

```powershell
npm run typecheck                   # kiểm tra kiểu TypeScript
npm test                            # test giao diện (Vitest) — 35 test
npm run test:coverage               # test kèm báo cáo phủ
dotnet test backend\MedEquip.slnx   # test API (xUnit) — 76 test
dotnet build backend\MedEquip.slnx --no-incremental   # build sạch, 0 cảnh báo
npm run build                       # build production giao diện
```

Phạm vi test hiện có:

| Nhóm                            | Nội dung                                                                 |
| ------------------------------- | ------------------------------------------------------------------------ |
| `src/test/api.test.ts`          | Gắn token, xử lý 401/422, **không rơi về dữ liệu mẫu khi lỗi nghiệp vụ** |
| `src/test/client.test.ts`       | Định dạng ngày kiểu Việt Nam, mã lỗi nghiệp vụ, hồ sơ phiên              |
| `src/test/StatusBadge.test.tsx` | Nhãn tiếng Việt đủ cho mọi mã trạng thái                                 |
| `src/test/oidc.test.ts`         | Nhận diện URL callback OIDC                                              |
| `AuditHashTests`                | Tính chuỗi băm SHA-256 của nhật ký kiểm toán                             |
| `RoleMappingTests`              | Dịch vai trò Keycloak → vai trò nghiệp vụ                                |
| `CalibrationRuleTests`          | BR-01 (chặn phân công) và BR-03 (dung sai sai số), gồm cả biên           |

Chuỗi kiểm tra trước khi kết thúc công việc (cũng là nội dung `.husky/pre-commit`):

```powershell
npm run typecheck && npm test && dotnet test backend\MedEquip.slnx
```

---

## 9. Hook trước khi commit

Husky chạy `.husky/pre-commit` trước mỗi lần commit:

1. `lint-staged` — định dạng lại đúng những file vừa thay đổi (Prettier/oxfmt)
2. `tsc --noEmit` — kiểm tra kiểu TypeScript
3. `dotnet build` — kiểm tra kiểu C#
4. `vitest run` — test giao diện
5. `dotnet test` — test backend

`.husky/pre-push` chạy build giao diện và backend trước khi đẩy nhánh.

Bỏ qua tạm thời: `git commit --no-verify`.

---

## 10. Cấu trúc thư mục

```
.
├── backend/
│   ├── MedEquip.slnx
│   ├── Dockerfile
│   ├── src/
│   │   ├── MedEquip.Domain/          — Entities, hằng nghiệp vụ, CalibrationRules (BR-01/BR-03)
│   │   ├── MedEquip.Infrastructure/  — DataContext, AuditService, AssignmentService, WorkOrderService
│   │   └── MedEquip.Api/             — Controllers, chế độ xác thực, TokenService,
│   │                                    AutoLockService (dịch vụ nền BR-01), ViewReader (đọc view báo cáo),
│   │                                    KeycloakSyncService (đồng bộ tài khoản)
│   └── tests/MedEquip.Tests/         — xUnit
├── web/
│   ├── Dockerfile
│   └── nginx.conf                    — phục vụ tĩnh + chuyển tiếp /api
├── docker/keycloak/realm-medequip.json  — realm, client, vai trò, tài khoản mẫu
├── database/QLTBYT.sql               — toàn bộ CSDL (nạp lại được nhiều lần)
├── database/02-create-keycloak-db.sql — tạo CSDL riêng cho Keycloak
├── docker-compose.yml
├── scripts/up.ps1                    — dựng stack Docker (build từng dịch vụ một)
└── src/                              — giao diện React
    ├── api/          — client, hooks, hợp đồng kiểu dữ liệu (types.ts)
    ├── auth/oidc.ts  — lớp bọc OIDC (oidc-client-ts)
    ├── components/   — Layout, StatusBadge
    ├── data/         — dữ liệu mẫu khi máy chủ chưa chạy
    ├── pages/        — 17 màn nghiệp vụ (xem mục 5)
    └── test/         — Vitest
```

---

## 11. Giải sự cố thường gặp

| Hiện tượng                                                       | Nguyên nhân                                                                                       | Cách xử lý                                                             |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| API khởi động xong vẫn không gọi được                            | CSDL chưa nạp, `DataContext` chờ PostgreSQL                                                       | Nạp `QLTBYT.sql` (mục 2.1), kiểm tra `/health` trả `database = "up"`   |
| `dotnet build` báo file DLL đang bị khóa                         | API cũ còn chạy, giữ DLL                                                                          | Tắt process `MedEquip.Api`/`dotnet` rồi build lại                      |
| Gọi API trả **401**                                              | Token hết hạn (8 giờ) hoặc sai chế độ xác thực hai bên                                            | Đăng nhập lại; kiểm tra `Auth:Mode` và `VITE_OIDC_ENABLED` cùng chế độ |
| Gọi `POST /api/auth/login` trả **404**                           | Đang ở chế độ OIDC — route login bị tắt **đúng thiết kế**                                         | Đổi `Auth:Mode=Dev` hoặc đăng nhập qua Keycloak                        |
| Đăng nhập trả **429**                                            | Vượt 30 lần/phút/máy (giới hạn đăng nhập)                                                         | Đợi một phút rồi thử lại                                               |
| Gọi API trả **501** kèm "KEYCLOAK_SYNC_NOT_CONFIGURED"           | Nút Đồng bộ Keycloak chưa có thông tin quản trị                                                   | Đặt `Auth:Oidc:AdminUsername/-Password` (mục 4.1)                      |
| Giao diện hiện dữ liệu lạ/chỉ là dữ liệu mẫu                     | API chưa chạy → chế độ dữ liệu mẫu                                                                | Chạy API rồi tải lại trang                                             |
| `docker compose up --build` lỗi `non-printable ASCII characters` | Bẫy bake của Docker với đường dẫn có dấu tiếng Việt                                               | Dùng `.\scripts\up.ps1` (mục 3.3)                                      |
| Keycloak báo realm trống sau khi khởi động lại                   | Chạy bằng `start-dev` (lưu realm trong RAM)                                                       | Dự án dùng `start` + `KC_DB=postgres` — realm bền trong PostgreSQL     |
| `psql` báo lỗi đọc script CSDL                                   | Đường dẫn chứa dấu tiếng Việt                                                                     | Copy `QLTBYT.sql` ra `%TEMP%` rồi nạp (mục 2.1)                        |
| Container PostgreSQL dừng ngay khi chạy                          | Mount volume sai nhánh (phải là `/var/lib/postgresql`, **không phải** `/var/lib/postgresql/data`) | `docker-compose.yml` đã đặt đúng — đừng sửa                            |
| API trong Docker báo `The signature key was not found`           | `jwks_uri` trỏ `localhost` vì thiếu biến backchannel                                              | `KC_HOSTNAME_BACKCHANNEL_DYNAMIC=true` đã đặt sẵn trong compose        |

---

## 12. Ghi chú kỹ thuật

**Mọi cột thời gian trong CSDL là `TIMESTAMPTZ`.** Npgsql chỉ nhận `DateTime`
có `Kind = Utc`. `DataContext.NormalizeDateTimeToUtc()` tự quy đổi trước khi
`SaveChanges`, nhưng code mới vẫn nên dùng `DateTime.UtcNow`.

**Chuỗi băm nhật ký kiểm toán** phải khớp chính xác hàm `fn_bam_audit` trong
CSDL: SHA-256 trên byte UTF-8 của `prev|actor|action|target|detail`, trả về
hex **chữ thường** (khớp `encode(...,'hex')` của PostgreSQL). Lệch một byte
là màn "Nhật ký kiểm toán" báo đứt chuỗi giả.

**CSDL chỉ đổi qua `database/QLTBYT.sql`.** Không dùng EF migration; script
phải nạp được trên PostgreSQL 18 ở chế độ strict (trigger/FK bật) và chạy
lại được nhiều lần.

**Số liệu báo cáo đọc từ view.** Các màn Báo cáo/Bảng điều khiển/Lịch sử
thiết bị lấy số liệu trực tiếp từ các view trong CSDL (`v_bao_cao_*`,
`v_bang_dieu_khien`, `v_timeline_thiet_bi`) qua lớp `ViewReader` — một nguồn
sự thật duy nhất là SQL, không tính lại ở C#.

**Luật nghiệp vụ đặt trong `CalibrationRules`** (tầng Domain) để kiểm thử
được không cần CSDL; trigger SQL và service C# dùng chung một định nghĩa.

**Giao diện không nối thẳng PostgreSQL.** Mọi thao tác đi qua ASP.NET Core;
nhúng chuỗi kết nối vào React sẽ làm lộ mật khẩu ra trình duyệt.
