# Hướng dẫn Chuyển đổi CSDL từ PostgreSQL sang SQL Server

## Tổng quan

Dự án chuyển đổi CSDL hệ thống quản lý thiết bị y tế (MED-EQUIP) từ PostgreSQL sang Microsoft SQL Server.

**Ngày chuyển đổi:** 2026-10-27
**File gốc:** `QLTBYT.sql` (PostgreSQL, ~1500 dòng)
**File đích:** 4 file SQL Server (T-SQL)

---

## 📁 Phân loại File SQL Server

### 1. QLTYT_SQLServer.sql (807 dòng)

**Chức năng:** Cấu trúc CSDL - DDL (Data Definition Language)

**Nội dung:**
- **Phase 1:** DROP tất cả objects (nếu tồn tại)
- **Phase 2:** CREATE TABLES (13 bảng chính + 3 bảng hệ thống)
  - Bảng danh mục: `khoa_phong`, `hang_san_xuat`, `nha_cung_cap`, `model_thiet_bi`
  - Bảng nghiệp vụ: `thiet_bi`, `lich_su_trang_thai_tb`, `nguoi_dung`, `phieu_cong_tac`, `buoc_phieu`, `bang_chung`, `su_co`, `phan_cong`
  - Bảng hệ thống: `nhat_ky_kiem_toan`, `cau_hinh_he_thong`, `thong_bao`
- **Phase 3:** CREATE FUNCTIONS (3 functions)
  - `fn_bam_kiem_toan` - Băm SHA-256 cho audit log
  - `fn_so_thang` - Đếm số tháng giữa 2 ngày
  - `fn_khoa_tb_qua_han` - Stored procedure khóa thiết bị quá hạn
- **Phase 4:** CREATE TRIGGERS (2 triggers)
  - `trg_phan_cong_chan_qua_han` - Chặn phân công thiết bị quá hạn (BR-01)
  - `trg_phieu_chan_khai_thac` - Chặn tạo phiếu khai thác cho thiết bị đã khóa
- **Phase 5:** CREATE VIEWS (9 views)
  - `v_thiet_bi` - View thiết bị
  - `v_thoi_gian_thiet_bi` - Timeline thiết bị
  - `v_phieu_cong_tac` - View phiếu công tác
  - `v_xac_minh_chuoi_kiem_toan` - Verify chuỗi hash audit log
  - `v_bang_dieu_khien` - Dashboard điều phối
  - `v_bao_cao_hieu_chuan` - Báo cáo hiệu chuẩn
  - `v_bao_cao_su_co` - Báo cáo sự cố
  - `v_bao_cao_pm` - Báo cáo bảo trì
  - `v_bao_cao_bang_chung` - Báo cáo bằng chứng

**Thứ tự chạy:** 1 (đầu tiên)

---

### 2. QLTYT_SQLServer_Data.sql (206 dòng)

**Chức năng:** Dữ liệu danh mục - DML (Data Manipulation Language)

**Nội dung:**
- **Mục 10.1:** INSERT `khoa_phong` (14 khoa)
  - 10 khoa lâm sàng + 4 phòng chức năng
- **Mục 10.2:** INSERT `hang_san_xuat` (17 hãng)
  - Mindray, Sysmex, GE Healthcare, Philips, v.v.
- **Mục 10.3:** INSERT `nha_cung_cap` (12 đơn vị)
  - Nhà cung cấp/bảo hành thiết bị
- **Mục 10.4:** INSERT `model_thiet_bi` (18 model)
  - Thông số kỹ thuật: chu kỳ PM, chu kỳ HC, dung sai
- **Mục 10.5:** INSERT `nguoi_dung` (15 tài khoản)
  - 4 vai trò: ADMIN, DIEU_PHOI, KY_THUAT_VIEN, DAU_MOI_KHOA
- **Mục 10.6:** INSERT `thiet_bi` (45 máy)
  - Phân bố 11 khoa lâm sàng
  - Trạng thái đa dạng: HOAT_DONG, SAP_HAN, CHO_HIEU_CHUAN, DANG_SUA, THANH_LY
- **Mục 10.7:** INSERT `cau_hinh_bang_chung` (14 quy tắc)
  - Quy tắc bằng chứng bắt buộc theo loại phiếu (HC, SC, PM, KT)

**Thứ tự chạy:** 2 (sau file cấu trúc)

---

### 3. QLTYT_SQLServer_Data_Parts.sql (130 dòng)

**Chức năng:** Phiếu công tác nghiệp vụ phức tạp

**Nội dung:**
- **Mục 10.8:** INSERT `phieu_cong_tac` (46 phiếu)
  - 8 phiếu HIỆU CHUẨN (HC)
  - 25 phiếu BẢO TRÌ ĐỊNH KỲ (PM)
  - 9 phiếu SỬA CHỮA (SC)
  - 4 phiếu KIỂM ĐỊNH (KT)
  - Phân bố trạng thái: CHO_PHAN_CONG, DANG_THUC_HIEN, CHO_NGHIEM_THU, HOAN_THANH, TRA_LAI
- **Update thời điểm hoàn thành/nghiệm thu**
  - Hoàn thành trước hạn
  - Hoàn thành trễ hạn (3 phiếu)
  - Trả lại phiếu (ly_do_tra)

**Đặc điểm:**
- Sử dụng temporary table để lưu dữ liệu trước khi JOIN với các bảng khác
- Cần join với `thiet_bi` và `nguoi_dung` để lấy ID thay vì tên

**Thứ tự chạy:** 3 (sau file dữ liệu danh mục)

---

### 4. QLTYT_SQLServer_Data_Final.sql (432 dòng)

**Chức năng:** Dữ liệu nghiệp vụ cuối cùng

**Nội dung:**
- **Mục 10.9:** INSERT `buoc_phieu` (checklist từng bước)
  - Phiếu HC: 5 bước (3 điểm chuẩn đo)
  - Phiếu PM: 5 bước (không đo)
  - Phiếu SC: 5 bước (không đo)
  - Phiếu KT: 4 bước (1 điểm chuẩn đo)
  - Tình huống đặc biệt: Bước KHÔNG ĐẠT, bước bị bỏ
- **Mục 10.10:** INSERT `bang_chung` (bằng chứng kỹ thuật)
  - Bằng chứng cho phiếu hoàn thành
  - Bằng chứng cho phiếu đang làm
  - Sử dụng `HashBytes('SHA2_256')` để băm file
- **Mục 10.11:** INSERT `su_co` (18 sự cố báo hỏng)
  - Phân bố severity: SO_BO, KHAN
  - Trang thái: MOI, DA_TIEP_NHAN, DA_TAO_PHIEU, DONG
- **Mục 10.12:** INSERT `phan_cong` (phân công kỹ thuật viên)
  - Derived từ `phieu_cong_tac`
- **Mục 10.13:** INSERT `lich_su_trang_thai_tb` (lịch sử thay đổi trạng thái)
  - Nghiệm thu nhập kho
  - Tự động khóa quá hạn
  - Chuyển sang sắp hạn
  - Chuyển sang đang sửa
  - Thanh lý
  - Manual inserts cho các case đặc biệt
- **Mục 10.14:** INSERT `nhat_ky_kiem_toan` (audit log - chuỗi hash)
  - ⚠️ **Chỉ có 3 entries mẫu**
  - Cần bổ sung thêm 41 entries để hoàn chỉnh
  - Chuỗi hash nối tiếp nhau bằng cách dùng hash của dòng trước
- **Mục 10.15:** INSERT `cau_hinh_he_thong` (14 cấu hình)
  - Cảnh báo sớm, gấp, khẩn cấp
  - Tự động khóa, quy tắc bằng chứng
- **Mục 10.16:** INSERT `thong_bao` (thông báo)
  - Thông báo cho điều phối
  - Thông báo cho kỹ thuật viên

**Thứ tự chạy:** 4 (cuối cùng)

---

## 📊 Thứ tự chạy file

```
┌─────────────────────────────────────────────────────────────┐
│                  THỨ TỰ CHAY FILE SQL                      │
└─────────────────────────────────────────────────────────────┘

1️⃣ QLTYT_SQLServer.sql
   ↓ (tạo cấu trúc rỗng)

2️⃣ QLTYT_SQLServer_Data.sql
   ↓ (chèn dữ liệu danh mục - không phụ thuộc phiếu)

3️⃣ QLTYT_SQLServer_Data_Parts.sql
   ↓ (chèn phiếu công tác - phụ thuộc thiết bị & người dùng)

4️⃣ QLTYT_SQLServer_Data_Final.sql
   ↓ (chèn dữ liệu nghiệp vụ - phụ thuộc phiếu công tác)

✅ HOÀN THÀNH
```

### Cách chạy trong SSMS

```sql
-- Mở SSMS, kết nối đến SQL Server, chọn database

-- 1. Chạy cấu trúc CSDL
:r E:\BAITAP\CK Thứ 6\database\QLTBYT_SQLServer.sql

-- 2. Chạy dữ liệu danh mục
:r E:\BAITAP\CK Thứ 6\database\QLTBYT_SQLServer_Data.sql

-- 3. Chạy phiếu công tác
:r E:\BAITAP\CK Thứ 6\database\QLTBYT_SQLServer_Data_Parts.sql

-- 4. Chạy dữ liệu cuối cùng
:r E:\BAITAP\CK Thứ 6\database\QLTBYT_SQLServer_Data_Final.sql
```

### Cách chạy bằng sqlcmd

```powershell
# Đặt đường dẫn
$basePath = "E:\BAITAP\CK Thứ 6\database"
$server = "localhost"
$database = "QLTYT"

# Chạy từng file
sqlcmd -S $server -d $database -i "$basePath\QLTBYT_SQLServer.sql"
sqlcmd -S $server -d $database -i "$basePath\QLTBYT_SQLServer_Data.sql"
sqlcmd -S $server -d $database -i "$basePath\QLTBYT_SQLServer_Data_Parts.sql"
sqlcmd -S $server -d $database -i "$basePath\QLTBYT_SQLServer_Data_Final.sql"
```

---

## 🔗 Phụ thuộc giữa các bảng

```
khoa_phong (danh mục)
    ↓
hang_san_xuat (danh mục)
    ↓
nha_cung_cap (danh mục)
    ↓
model_thiet_bi ←──────── hang_san_xuat
    ↓
thiet_bi ←──────── model_thiet_bi, khoa_phong, nha_cung_cap
    ↓
nguoi_dung ←──────── khoa_phong
    ↓
phieu_cong_tac ←──────── thiet_bi, khoa_phong, nguoi_dung
    ↓
buoc_phieu ←──────── phieu_cong_tac, nguoi_dung
bang_chung ←──────── phieu_cong_tac, nguoi_dung
su_co ←──────── thiet_bi, nguoi_dung, phieu_cong_tac
phan_cong ←──────── phieu_cong_tac, thiet_bi, nguoi_dung
lich_su_trang_thai_tb ←──────── thiet_bi
nhat_ky_kiem_toan (độc lập)
cau_hinh_he_thong (độc lập)
thong_bao ←──────── nguoi_dung
```

---

## 🔄 Khác biệt cú pháp PostgreSQL vs SQL Server

| PostgreSQL | SQL Server (T-SQL) | Ví dụ |
|------------|-------------------|-------|
| `GENERATED ALWAYS AS IDENTITY` | `IDENTITY(1,1)` | `id INT IDENTITY(1,1)` |
| `CREATE EXTENSION pgcrypto` | Không cần - dùng `HashBytes()` | `HashBytes('SHA2_256', ...)` |
| `::char(64)` | `CAST(... AS CHAR(64))` hoặc `CONVERT` | `CONVERT(CHAR(64), ...)` |
| `$function$ ... $$` | `CREATE FUNCTION ... AS BEGIN ... END` | T-SQL block |
| `timestamp`/`timestamptz` | `datetime2` | `datetime2` |
| `COALESCE(a, b)` | `ISNULL(a, b)` hoặc `COALESCE` | `ISNULL(a, b)` |
| `encode(digest(), 'hex')` | `CONVERT(VARCHAR(64), HashBytes(), 2)` | T-SQL hash |
| `LIMIT n` | `TOP n` | `SELECT TOP 10` |
| `RETURNING` | `OUTPUT INSERTED.*` | INSERT với OUTPUT |
| `TRIGGER BEFORE/AFTER` | `INSTEAD OF/AFTER` | Cú pháp khác |
| `string_agg()` | `STRING_AGG()` (SQL 2017+) hoặc `FOR XML PATH` | Aggregation |
| `date_trunc()` | `DATEADD()`, `DATEDIFF()` | Date functions |
| `make_interval()` | `DATEADD()` | Date arithmetic |
| `extract()` | `DATEPART()`, `DATEDIFF()` | Date parts |
| `GENERATED ALWAYS AS (expression)` | Computed column `AS (expression) PERSISTED` | Computed column |
| `CHECK (IN (...))` | Cú pháp tương tự | OK |
| `UNIQUE (columns)` | Cú pháp tương tự | OK |
| `DROP ... CASCADE` | Xóa thủ công dependent objects | Phức tạp hơn |

---

## 🧪 Test Cases (8 test cases)

### Test 1: Kiểm tra IDENTITY columns
**Mục tiêu:** Xác nhận IDENTITY columns hoạt động đúng trong SQL Server

```sql
CREATE TABLE test_identity (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL
);

INSERT INTO test_identity (name) VALUES ('A'), ('B'), ('C');
SELECT id, name FROM test_identity;
-- Expected: 1-A, 2-B, 3-C

DROP TABLE test_identity;
```

### Test 2: Kiểm tra hash function (SHA-256)
**Mục tiêu:** Xác nhận function fn_bam_kiem_toan trả về hash đúng

```sql
DECLARE @result CHAR(64) = dbo.fn_bam_kiem_toan(
    '0000000000000000000000000000000000000000000000000000000000000000',
    'testuser',
    'TEST_ACTION',
    'target_obj',
    'detail info'
);

SELECT @result AS hash_result, LEN(@result) AS hash_length;
-- Expected: hash_length = 64, hash_result chỉ chứa [0-9a-f]
```

### Test 3: Kiểm tra trigger chặn phân công quá hạn
**Mục tiêu:** Xác nhận trigger từ chối INSERT khi thiết bị quá hạn

```sql
-- Tạo bảng test và trigger (xem file test đầy đủ)
-- Test với thiết bị quá hạn → phải lỗi
-- Test với thiết bị bình thường → phải thành công
```

### Test 4: Kiểm tra CHECK constraint cho step result
**Mục tiêu:** Xác nhận constraint chặn khi sai số vượt dung sai

```sql
-- Test case: Sai số 4% > dung sai 2.5% → phải lỗi
-- Test case: Sai số 1% < dung sai 2.5% → phải thành công
```

### Test 5: Kiểm tra datetime2 với timezone
**Mục tiêu:** Xác nhận datetime2 lưu trữ chính xác thời gian

```sql
SELECT
    GETDATE() AS local_time,
    GETUTCDATE() AS utc_time,
    DATEDIFF(HOUR, GETUTCDATE(), GETDATE()) AS timezone_offset;
-- Expected: timezone_offset = 7 (UTC+7 cho Việt Nam)
```

### Test 6: Kiểm tra View với aggregation
**Mục tiêu:** Xác nhận view hoạt động đúng với T-SQL

```sql
SELECT * FROM v_bang_dieu_khien;
-- Expected: Các counts đúng theo dữ liệu đã insert
```

### Test 7: Kiểm tra INSERT với OUTPUT
**Mục tiêu:** Xác nhận lấy lại ID sau INSERT

```sql
DECLARE @inserted_id INT;

INSERT INTO test_table (name)
OUTPUT INSERTED.id INTO @inserted_id
VALUES ('Test Record');

SELECT @inserted_id AS new_id;
```

### Test 8: Kiểm tra hash chain integrity
**Mục tiêu:** Xác nhận chuỗi hash nối đúng

```sql
SELECT
    id,
    prev_hash,
    row_hash,
    LEAD(prev_hash) OVER (ORDER BY id) AS next_prev_hash,
    CASE WHEN LEAD(prev_hash) OVER (ORDER BY id) = row_hash THEN 'OK' ELSE 'BROKEN' END AS chain_status
FROM nhat_ky_kiem_toan;
-- Expected: chain_status = 'OK' cho tất cả rows
```

---

## ⚠️ Lưu ý quan trọng

### 1. Audit log chưa hoàn chỉnh
File `QLTBYT_SQLServer_Data_Final.sql` chỉ có 3 entries mẫu audit log. Cần bổ sung thêm 41 entries để khớp với bản PostgreSQL gốc (tổng 44 entries).

**Giải pháp:** Viết script bổ sung dựa trên dữ liệu từ file gốc PostgreSQL.

### 2. Trigger cần test kỹ
Sau khi chạy file 1, nên test trigger với các test cases ở trên vì logic trigger giữa PostgreSQL và SQL Server có thể khác nhau.

### 3. Datetime logic
Sử dụng `datetime2` thay vì `timestamp/timestamptz`, nên cần kiểm tra lại các phép tính ngày tháng, đặc biệt là:
- Hàm `fn_so_thang`
- Các view có tính toán ngày (v_thiet_bi, v_phieu_cong_tac)
- Trigger so sánh ngày tháng

### 4. Hash function
Đã chuyển sang `HashBytes('SHA2_256')` với `CONVERT(..., 2)` để ra chuỗi hex chữ thường. Cần verify kết quả khớp với PostgreSQL vì:
- PostgreSQL dùng `encode(digest(), 'hex')` trên byte UTF-8
- SQL Server dùng `HashBytes()` trên NVARCHAR (Unicode)

### 5. Trigger INSTEAD OF
Trigger `trg_phieu_chan_khai_thac` sử dụng `INSTEAD OF INSERT` thay vì `BEFORE INSERT` của PostgreSQL. Cần test kỹ vì:
- `INSTEAD OF` thay thế hoàn toàn INSERT
- Cần INSERT thủ công trong trigger body nếu pass check

### 6. Window functions
SQL Server hỗ trợ `LAG()`, `LEAD()`, `STRING_AGG()` (từ SQL 2017). Nếu dùng phiên bản cũ hơn, cần thay bằng `CROSS APPLY` hoặc `FOR XML PATH`.

---

## 📋 Validation Checklist

Sau khi chạy tất cả file, kiểm tra:

- [ ] Tất cả tables tạo thành công (16 bảng)
- [ ] Tất cả foreign keys hoạt động
- [ ] Tất cả constraints (CHECK, UNIQUE) hoạt động
- [ ] Functions chạy không lỗi (3 functions)
- [ ] Triggers firing đúng (2 triggers)
- [ ] Views trả về dữ liệu đúng (9 views)
- [ ] Data insert thành công
- [ ] Hash chain integrity OK
- [ ] BR-01 chặn phân công quá hạn
- [ ] BR-03 chặn result DAT khi sai số vượt dung sai

### Kiểm tra số lượng rows

```sql
-- Kiểm tra số lượng rows mỗi bảng
SELECT
    t.name AS table_name,
    p.rows AS row_count
FROM sys.tables t
INNER JOIN sys.partitions p ON t.object_id = p.object_id
WHERE p.index_id IN (0, 1)
ORDER BY t.name;
```

### Kiểm tra hash chain

```sql
SELECT
    COUNT(*) AS total_rows,
    SUM(CASE WHEN row_ok = 1 THEN 1 ELSE 0 END) AS rows_ok,
    SUM(CASE WHEN chain_ok = 1 THEN 1 ELSE 0 END) AS chain_ok
FROM v_xac_minh_chuoi_kiem_toan;
-- Expected: total_rows = 3, rows_ok = 3, chain_ok = 3
```

---

## 🔄 Rollback Plan

Nếu có lỗi sau khi chạy:

### Cách 1: Xóa toàn bộ database
```sql
DROP DATABASE QLTYT;
GO
CREATE DATABASE QLTYT;
GO
-- Chạy lại từ đầu
```

### Cách 2: Xóa objects theo thứ tự ngược
```sql
-- Drop views
DROP VIEW IF EXISTS v_bao_cao_bang_chung;
DROP VIEW IF EXISTS v_bao_cao_pm;
-- ... (tất cả views)

-- Drop triggers
DROP TRIGGER IF EXISTS trg_phan_cong_chan_qua_han ON phan_cong;
DROP TRIGGER IF EXISTS trg_phieu_chan_khai_thac ON phieu_cong_tac;

-- Drop functions
DROP FUNCTION IF EXISTS fn_khoa_tb_qua_han;
DROP FUNCTION IF EXISTS fn_bam_kiem_toan;
DROP FUNCTION IF EXISTS fn_so_thang;

-- Drop tables (theo thứ tự ngược dependencies)
DROP TABLE IF EXISTS thong_bao;
DROP TABLE IF EXISTS cau_hinh_he_thong;
DROP TABLE IF EXISTS nhat_ky_kiem_toan;
DROP TABLE IF EXISTS phan_cong;
DROP TABLE IF EXISTS su_co;
DROP TABLE IF EXISTS bang_chung;
DROP TABLE IF EXISTS cau_hinh_bang_chung;
DROP TABLE IF EXISTS buoc_phieu;
DROP TABLE IF EXISTS phieu_cong_tac;
DROP TABLE IF EXISTS nguoi_dung;
DROP TABLE IF EXISTS lich_su_trang_thai_tb;
DROP TABLE IF EXISTS thiet_bi;
DROP TABLE IF EXISTS model_thiet_bi;
DROP TABLE IF EXISTS nha_cung_cap;
DROP TABLE IF EXISTS hang_san_xuat;
DROP TABLE IF EXISTS khoa_phong;
```

---

## 📞 Hỗ trợ

Nếu gặp lỗi trong quá trình chuyển đổi:

1. Kiểm tra version SQL Server (cần SQL Server 2019+ để hỗ trợ đầy đủ features)
2. Kiểm tra collation database (nên dùng `SQL_Latin1_General_CP1_CI_AS` hoặc Unicode collation)
3. Kiểm tra permissions (người chạy script cần quyền CREATE TABLE, CREATE FUNCTION, CREATE TRIGGER, CREATE VIEW)
4. Test từng file riêng biệt để xác định file gây lỗi
5. Xem error message từ SQL Server để debug

---

## 📚 Tài liệu tham khảo

- [Microsoft SQL Server Documentation](https://docs.microsoft.com/en-us/sql/)
- [PostgreSQL to SQL Server Migration Guide](https://www.mssqltips.com/sql-server-tips/2516/migrating-from-postgresql-to-sql-server/)
- [HashBytes Function](https://docs.microsoft.com/en-us/sql/t-sql/functions/hashbytes-transact-sql)
- [IDENTITY Property](https://docs.microsoft.com/en-us/sql/t-sql/statements/create-table-transact-sql-identity-property)

---

**Ngày tạo:** 2026-10-27
**Phiên bản:** 1.0
**Tác giả:** Devin AI Assistant
