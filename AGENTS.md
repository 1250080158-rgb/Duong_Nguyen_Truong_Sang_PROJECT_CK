# MED-EQUIP — Quản lý thiết bị y tế

Hệ thống quản lý vòng đời thiết bị y tế: React + Vite ở giao diện,
ASP.NET Core 10 ở API, PostgreSQL 18 ở CSDL, Keycloak ở xác thực OIDC.
Xem `README.md` để biết cách chạy.

## Development Server

Máy chủ Vite được khởi chạy sẵn ở `$PORT` (mặc định 8443).

- Xem trước: người dùng truy cập qua bảng xem trước
- Tải lại nóng: thay đổi mã nguồn phản ánh ngay

## Project Structure

Đây là cấu trúc chuẩn. Bắt đầu từ các file liên quan tới nhiệm vụ.

**Giao diện**

- `src/main.tsx` — điểm vào React; nạp `src/index.css`, gắn `src/App.tsx` vào `#root`
- `src/App.tsx` — component ứng dụng chính
- `src/index.css` — CSS toàn cục và nạp Tailwind
- `src/api/client.ts` — tầng gọi API; đây là nơi quyết định dùng token OIDC hay token lưu cục bộ, và quy tắc rơi về dữ liệu mẫu
- `src/api/types.ts` — hợp đồng kiểu dữ liệu khớp response của API
- `src/auth/oidc.ts` — lớp bọc OIDC (oidc-client-ts), luồng Authorization Code + PKCE
- `src/routes.ts` — định tuyến và phân tách màn theo vai trò
- `src/components/Layout.tsx` — khung ứng dụng, menu, đăng xuất
- `src/pages/` — 17 màn nghiệp vụ, chia theo vai trò
- `src/data/mockData.ts` — dữ liệu mẫu dùng khi API chưa chạy
- `src/test/` — test Vitest

**API**

- `backend/MedEquip.slnx` — solution chứa 3 project nguồn + 1 project test
- `backend/src/MedEquip.Domain/` — Entities, hằng nghiệp vụ, `CalibrationRules` (luật BR-01/BR-03 dạng hàm thuần)
- `backend/src/MedEquip.Infrastructure/` — `DataContext`, `AuditService`, `AssignmentService`, `WorkOrderService`
- `backend/src/MedEquip.Api/Auth/` — `AuthOptions`, `RoleMapping`, `AppRoleClaimsTransformation`
- `backend/tests/MedEquip.Tests/` — test xUnit

**Hạ tầng**

- `database/QLTBYT.sql` — toàn bộ CSDL PostgreSQL: schema, dữ liệu, trigger, view báo cáo. Chạy lại được nhiều lần
- `database/02-create-keycloak-db.sql` — tạo CSDL riêng cho Keycloak, tách khỏi CSDL nghiệp vụ
- `docker-compose.yml` — 4 dịch vụ: postgres, keycloak, api, web
- `scripts/up.ps1` — dựng stack; build từng service một để tránh lỗi bake
- `docker/keycloak/realm-medequip.json` — realm, client, vai trò và tài khoản mẫu
- `backend/Dockerfile`, `web/Dockerfile`, `web/nginx.conf` — đóng gói

**Cấu hình**

- `.env.example` — biến môi trường cho Vite (sao chép thành `.env.local`)
- `.env.example.docker` — biến cho docker compose (sao chép thành `.env`)
- `vitest.config.ts` — cấu hình Vitest, tách khỏi `vite.config.ts` vì file đó kèm plugin Figma Make
- `.lintstagedrc.json`, `.prettierrc.json` — định dạng khi commit
- `.mise.toml` — phiên bản công cụ

## Dependencies

- Runtime: React 19, React DOM 19, React Router 8, `oidc-client-ts`
- Styling: Tailwind CSS 4 qua plugin `@tailwindcss/vite`
- Build tooling: Vite 8, TypeScript 5.7, `@vitejs/plugin-react`
- Test: Vitest 3 + Testing Library (giao diện), xUnit (API)
- Hook: Husky 9 + lint-staged + Prettier
- Formatting: oxfmt, Prettier

## Commands

```powershell
npm run dev                      # máy chủ phát triển giao diện
npm test                         # test giao diện
npm run test:coverage            # test kèm báo cáo phủ
npm run typecheck                # kiểm tra kiểu TypeScript
npm run build                    # kiểm tra kiểu rồi build giao diện

dotnet build backend\MedEquip.slnx
dotnet test backend\MedEquip.slnx
dotnet run --project backend\src\MedEquip.Api

docker compose up -d --build     # chạy trọn hệ thống
```

## Conventions

**Quy tắc bất di bất dịch của dự án**

1. **Giao diện không nối thẳng PostgreSQL.** Mọi thao tác đi qua API.
2. **CSDL chỉ đổi bằng `database/QLTBYT.sql`.** Không dùng EF migration, và
   phải nạp được trên PostgreSQL 18. Script chạy lại được nhiều lần.
3. **Cột thời gian trong `QLTBYT.sql` là `TIMESTAMP` (không múi giờ).**
   Luôn dùng `DateTime.UtcNow` cho giá trị thời gian; `DataContext` có
   lưới an toàn tự quy đổi `DateTime.Now` (`Kind = Local`) về UTC trước
   khi ghi, nhưng code mới vẫn nên viết đúng từ đầu.
4. **Chuỗi băm nhật ký kiểm toán phải khớp `fn_bam_audit` trong CSDL:**
   SHA-256 trên byte UTF-8 của `prev|actor|action|target|detail`, trả hex
   **chữ thường**. Đổi thuật toán thì phải đổi cả hàm SQL.
5. **Luật nghiệp vụ đặt trong `CalibrationRules`** (tầng Domain) để kiểm thử
   được không cần CSDL và để service, trigger SQL cùng dùng một định nghĩa.
6. **Vai trò nghiệp vụ dịch từ Keycloak** qua `RoleMapping.Resolve`, nên
   `[Authorize(Roles = "...")]` không phải sửa theo chế độ xác thực.
7. **Lỗi nghiệp vụ không được rơi về dữ liệu mẫu.** Chỉ lỗi mạng mới dùng
   `mockData.ts`. Xem `apiOr` trong `src/api/client.ts`.
8. **Văn bản hiển thị cho người dùng viết bằng tiếng Việt đầy đủ**, không
   dùng từ viết tắt tiếng Anh hay nhãn trần. Nhãn nghiệp vụ tập trung ở
   `src/data/mockData.ts` và `ROLE_LABELS` trong `src/api/client.ts`.
9. **Đóng gói Docker có những cái bẫy đã gặp, đừng lặp lại:**
   - Ảnh `mcr.microsoft.com/dotnet/*:10.0` dựa trên Ubuntu, **không có
     `adduser`** — phải dùng `useradd`.
   - PostgreSQL 18 mount volume ở `/var/lib/postgresql`, **không phải**
     `/var/lib/postgresql/data`. Mount nhánh con sẽ khiến container dừng ngay.
   - Keycloak 26 phục vụ `/health/ready` trên **cổng quản lý 9000**, không
     phải 8080. Ảng chính thức không có `curl`/`wget`, nên healthcheck phải
     dùng `bash` + `/dev/tcp`.
   - Bắt buộc có `KC_HOSTNAME_BACKCHANNEL_DYNAMIC=true`, nếu không
     `jwks_uri` sẽ là `http://localhost:8080` và container API tự gọi chính
     nó, sinh lỗi `The signature key was not found`.
   - Healthcheck trong container nên gọi `127.0.0.1` chứ không phải
     `localhost`: `localhost` ưu tiên `::1` còn nginx chỉ nghe IPv4.
   - `nginx` đặt `default_type` chứ không dùng `add_header Content-Type` —
     `add_header` chỉ ghi thêm header, không thay kiểu nội dung.
   - JSON realm của Keycloak **không có chú thích**; khóa bắt đầu bằng `//`
     sẽ bị coi là trường lạ và làm hỏng lúc import.
   - `start-dev` lưu realm trong H2 trong RAM nên mất sạch mỗi lần khởi
     động lại; dự án này dùng `start` + `KC_DB` trỏ vào PostgreSQL.
10. **Trên Windows, Docker CLI không dựng được phiên bake có từ hai target
    trở lúc nếu thư mục dự án chứa dấu tiếng Việt** (thư mục này là
    `CK Thứ 6`). Lỗi: `header key "x-docker-expose-session-sharedkey"
contains value with non-printable ASCII characters`.
    - Nguyên nhân là **số target trong phiên bake**, không phải số build
      chạy song song: `COMPOSE_PARALLEL_LIMIT=1` không có tác dụng.
    - `docker build`, `docker buildx build`, `docker compose build <một
service>` đều chạy bình thường.
    - Cách xử lý: dùng `scripts\up.ps1`, script build từng service một rồi
      `docker compose up -d`. Không cần copy dự án ra đường dẫn ASCII.

**Trước khi kết thúc công việc, chạy:**

```powershell
npm run typecheck && npm test && dotnet test backend\MedEquip.slnx
```

Đây cũng chính là những gì `.husky/pre-commit` chạy.

## Styling

Dự án dùng **Tailwind CSS v4** qua plugin `@tailwindcss/vite` khai báo trong
`vite.config.ts`. `src/index.css` nạp Tailwind với `@import 'tailwindcss';`.
Dùng class tiện ích trực tiếp trong JSX, đặt CSS tuỳ biến trong
`src/index.css`. Không cần file cấu hình Tailwind hay PostCSS.

`src/main.tsx` nạp `src/index.css`, nên khai báo font toàn cục thuộc về
`src/index.css`. Giữ các câu `@import` ở đầu file, rồi mới đặt `@font-face`
và font mặc định.
