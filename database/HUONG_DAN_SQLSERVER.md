# Hướng dẫn SQL Server - Truy vấn từ Cơ bản đến Nâng cao

## 1. SELECT - Truy vấn cơ bản

### 1.1. Select tất cả

```sql
-- Xem tất cả thiết bị
SELECT * FROM thiet_bi;

-- Xem tất cả người dùng
SELECT * FROM nguoi_dung;
```

### 1.2. Select với điều kiện WHERE

```sql
-- Xem thiết bị theo trạng thái
SELECT ma, ten, trang_thai
FROM thiet_bi
WHERE trang_thai = 'HOAT_DONG';

-- Xem thiết bị quá hạn
SELECT ma, ten, han_hieu_chuan
FROM thiet_bi
WHERE han_hieu_chuan < CAST(GETDATE() AS DATE);

-- Xem người dùng theo vai trò
SELECT ten_dang_nhap, ho_ten, vai_tro
FROM nguoi_dung
WHERE vai_tro = 'KY_THUAT_VIEN';
```

### 1.3. Select với điều kiện AND/OR

```sql
-- Thiết bị hoạt động VÀ thuộc khoa 1
SELECT ma, ten
FROM thiet_bi
WHERE trang_thai = 'HOAT_DONG' AND id_khoa = 1;

-- Thiết bị quá hạn HOẶC đang sửa
SELECT ma, ten, trang_thai
FROM thiet_bi
WHERE trang_thai = 'CHO_HIEU_CHUAN' OR trang_thai = 'DANG_SUA';

-- Kết hợp AND/OR (dùng ngoặc)
SELECT ma, ten
FROM thiet_bi
WHERE (trang_thai = 'HOAT_DONG' OR trang_thai = 'SAP_HAN')
  AND id_khoa = 1;
```

### 1.4. Select với IN, NOT IN

```sql
-- Thiết bị thuộc các trạng thái cụ thể
SELECT ma, ten, trang_thai
FROM thiet_bi
WHERE trang_thai IN ('HOAT_DONG', 'SAP_HAN', 'CHO_HIEU_CHUAN');

-- Người dùng KHÔNG thuộc vai trò admin
SELECT ten_dang_nhap, ho_ten, vai_tro
FROM nguoi_dung
WHERE vai_tro NOT IN ('ADMIN');
```

### 1.5. Select với LIKE (tìm kiếm)

```sql
-- Tìm thiết bị có tên chứa "sinh phẩm"
SELECT ma, ten
FROM thiet_bi
WHERE ten LIKE N'%sinh phẩm%';

-- Tìm người dùng có tên bắt đầu bằng "Nguyễn"
SELECT ten_dang_nhap, ho_ten
FROM nguoi_dung
WHERE ho_ten LIKE N'Nguyễn%';

-- Tìm mã thiết bị có pattern "DEV-0"
SELECT ma, ten
FROM thiet_bi
WHERE ma LIKE 'DEV-0%';
```

### 1.6. Select với ORDER BY (sắp xếp)

```sql
-- Sắp xếp theo ngày nhập (mới nhất trước)
SELECT ma, ten, ngay_nhap
FROM thiet_bi
ORDER BY ngay_nhap DESC;

-- Sắp xếp theo tên khoa, rồi theo tên thiết bị
SELECT e.ma, e.ten, k.ten AS khoa
FROM thiet_bi e
JOIN khoa_phong k ON e.id_khoa = k.id_khoa
ORDER BY k.ten ASC, e.ten ASC;

-- Sắp xếp theo điều kiện (trạng thái quan trọng lên trước)
SELECT ma, ten, trang_thai
FROM thiet_bi
ORDER BY
    CASE trang_thai
        WHEN 'CHO_HIEU_CHUAN' THEN 1
        WHEN 'SAP_HAN' THEN 2
        WHEN 'DANG_SUA' THEN 3
        ELSE 4
    END;
```

### 1.7. Select với LIMIT (TOP trong SQL Server)

```sql
-- Chỉ lấy 10 thiết bị đầu tiên
SELECT TOP 10 ma, ten, trang_thai
FROM thiet_bi;

-- Lấy 5 thiết bị mới nhất
SELECT TOP 5 ma, ten, ngay_nhap
FROM thiet_bi
ORDER BY ngay_nhap DESC;
```

---

## 2. INSERT - Thêm dữ liệu

### 2.1. Insert cơ bản

```sql
-- Thêm khoa phòng mới
INSERT INTO khoa_phong (ten, la_lam_sang, dia_chi, dien_thoai)
VALUES (N'Khoa Cận lâm sàng', 1, N'Tầng 2, khu khám bệnh', '2500');

-- Thêm nhà cung cấp mới
INSERT INTO nha_cung_cap (ten, nguoi_lien_he, dien_thoai, so_hop_dong)
VALUES (N'Công ty ABC', N'Nguyễn Văn B', '0909 123 456', 'HD-ABC-2024');
```

### 2.2. Insert với giá trị NULL

```sql
-- Thêm thiết bị mới (nhiều trường NULL)
INSERT INTO thiet_bi (ma, ten, id_model, serial, id_khoa, vi_tri, trang_thai,
                     han_hieu_chuan, pm_ke_tiep, ngay_nhap, thang_bao_hanh, gia_mua)
VALUES ('DEV-100', N'Máy X', 1, 'SN-001', 1, N'Phòng A', 'HOAT_DONG',
        NULL, NULL, '2024-10-28', 24, 500000000);
```

### 2.3. Insert với biến DECLARE

```sql
-- Tạo biến
DECLARE @id_khoa INT;
DECLARE @id_model INT;

-- Gán giá trị
SET @id_khoa = (SELECT id_khoa FROM khoa_phong WHERE ten = N'Hóa sinh');
SET @id_model = (SELECT id_model FROM model_thiet_bi WHERE ten = N'Mindray BS-240');

-- Insert với biến
INSERT INTO thiet_bi (ma, ten, id_model, serial, id_khoa, trang_thai, ngay_nhap, thang_bao_hanh)
VALUES ('DEV-101', N'Máy sinh phẩm mới', @id_model, 'SN-002', @id_khoa, 'HOAT_DONG', '2024-10-28', 24);
```

### 2.4. Insert nhiều dòng cùng lúc

```sql
-- Thêm nhiều thiết bị
INSERT INTO khoa_phong (ten, la_lam_sang, dia_chi, dien_thoai)
VALUES
    (N'Khoa A', 1, N'Tầng 1', '2601'),
    (N'Khoa B', 1, N'Tầng 2', '2602'),
    (N'Khoa C', 0, N'Tầng 3', '2603');
```

---

## 3. UPDATE - Cập nhật dữ liệu

### 3.1. Update cơ bản

```sql
-- Cập nhật trạng thái thiết bị
UPDATE thiet_bi
SET trang_thai = 'DANG_SUA'
WHERE ma = 'DEV-001';

-- Cập nhật thông tin người dùng
UPDATE nguoi_dung
SET dien_thoai = '0912 999 999',
    email = 'newemail@bvtw.vn'
WHERE ten_dang_nhap = 'minhvt';
```

### 3.2. Update với điều kiện phức tạp

```sql
-- Khóa tất cả thiết bị quá hạn
UPDATE thiet_bi
SET trang_thai = 'CHO_HIEU_CHUAN',
    ghi_chu = N'Tự động khóa do quá hạn hiệu chuẩn'
WHERE han_hieu_chuan < CAST(GETDATE() AS DATE)
  AND trang_thai = 'HOAT_DONG';

-- Cập nhật hạn hiệu chuẩn sau khi hoàn thành phiếu HC
UPDATE thiet_bi
SET han_hieu_chuan = DATEADD(YEAR, 1, han_hieu_chuan),
    trang_thai = 'HOAT_DONG',
    ghi_chu = NULL
WHERE ma = 'DEV-002';
```

### 3.3. Update với JOIN

```sql
-- Cập nhật ngày bảo trì kế tiếp cho tất cả thiết bị
UPDATE thiet_bi
SET pm_ke_tiep = DATEADD(DAY, m.chu_ky_pm_ngay, GETDATE())
FROM thiet_bi e
JOIN model_thiet_bi m ON e.id_model = m.id_model
WHERE e.pm_ke_tiep IS NULL OR e.pm_ke_tiep < CAST(GETDATE() AS DATE);
```

### 3.4. Update với CASE WHEN

```sql
-- Cập nhật trạng thái dựa trên điều kiện
UPDATE thiet_bi
SET trang_thai =
    CASE
        WHEN han_hieu_chuan < CAST(GETDATE() AS DATE) THEN 'CHO_HIEU_CHUAN'
        WHEN DATEDIFF(DAY, GETDATE(), han_hieu_chuan) <= 7 THEN 'SAP_HAN'
        ELSE 'HOAT_DONG'
    END;
```

---

## 4. DELETE - Xóa dữ liệu

### 4.1. Delete cơ bản

```sql
-- Xóa thông báo đã đọc
DELETE FROM thong_bao
WHERE is_read = 1;

-- Xóa sự cố đã đóng
DELETE FROM su_co
WHERE trang_thai = 'DONG';
```

### 4.2. Delete với điều kiện

```sql
-- Xóa người dùng không hoạt động
DELETE FROM nguoi_dung
WHERE hoat_dong = 0;

-- Xóa thiết bị đã thanh lý
DELETE FROM thiet_bi
WHERE trang_thai = 'THANH_LY';
```

### 4.3. Delete với JOIN

```sql
-- Xóa bằng chứng của phiếu đã xóa
DELETE bang_chung
FROM bang_chung b
JOIN phieu_cong_tac wo ON b.id_phieu = wo.id_phieu
WHERE wo.trang_thai = 'TRA_LAI' AND wo.ly_do_tra IS NOT NULL;
```

⚠️ **Lưu ý:** Thường dùng `trang_thai = 'THANH_LY'` thay vì DELETE để giữ lịch sử.

---

## 5. JOIN - Nối bảng

### 5.1. INNER JOIN (chỉ lấy dòng khớp)

```sql
-- Lấy thiết bị kèm thông tin model và hãng
SELECT e.ma, e.ten, m.ten AS model, h.ten AS hang_san_xuat
FROM thiet_bi e
INNER JOIN model_thiet_bi m ON e.id_model = m.id_model
INNER JOIN hang_san_xuat h ON m.id_hang = h.id_hang;

-- Lấy phiếu công tác kèm thông tin kỹ thuật viên
SELECT wo.ma, wo.loai_phieu, wo.trang_thai, u.ho_ten AS ky_thuat_vien
FROM phieu_cong_tac wo
INNER JOIN nguoi_dung u ON wo.id_nguoi_thuc_hien = u.id_nguoi_dung;
```

### 5.2. LEFT JOIN (lấy tất cả từ bảng trái, NULL nếu không khớp)

```sql
-- Lấy tất cả thiết bị, kể cả chưa có nhà cung cấp bảo trì
SELECT e.ma, e.ten, n.ten AS nha_cung_cap
FROM thiet_bi e
LEFT JOIN nha_cung_cap n ON e.id_ncc_bao_tri = n.id_ncc;

-- Lấy tất cả phiếu, kể cả chưa phân công
SELECT wo.ma, wo.loai_phieu, u.ho_ten AS ky_thuat_vien
FROM phieu_cong_tac wo
LEFT JOIN nguoi_dung u ON wo.id_nguoi_thuc_hien = u.id_nguoi_dung;
```

### 5.3. RIGHT JOIN (lấy tất cả từ bảng phải)

```sql
-- Lấy tất cả kỹ thuật viên, kể cả chưa có phiếu
SELECT u.ho_ten, COUNT(wo.id_phieu) AS so_phieu
FROM nguoi_dung u
RIGHT JOIN phieu_cong_tac wo ON u.id_nguoi_dung = wo.id_nguoi_thuc_hien
WHERE u.vai_tro = 'KY_THUAT_VIEN'
GROUP BY u.ho_ten;
```

### 5.4. SELF JOIN (nối bảng với chính nó)

```sql
-- Tìm thiết bị cùng model
SELECT e1.ma, e1.ten, e2.ma AS cung_model, e2.ten
FROM thiet_bi e1
JOIN thiet_bi e2 ON e1.id_model = e2.id_model AND e1.id_thiet_bi <> e2.id_thiet_bi
WHERE e1.ma = 'DEV-001';
```

---

## 6. AGGREGATE FUNCTIONS - Hàm tổng hợp

### 6.1. COUNT - Đếm

```sql
-- Đếm tổng số thiết bị
SELECT COUNT(*) AS tong_thiet_bi FROM thiet_bi;

-- Đếm thiết bị theo trạng thái
SELECT trang_thai, COUNT(*) AS so_luong
FROM thiet_bi
GROUP BY trang_thai;

-- Đếm thiết bị theo khoa
SELECT k.ten AS khoa, COUNT(e.id_thiet_bi) AS so_thiet_bi
FROM khoa_phong k
LEFT JOIN thiet_bi e ON k.id_khoa = e.id_khoa
GROUP BY k.ten;
```

### 6.2. SUM - Tổng

```sql
-- Tổng giá trị thiết bị
SELECT SUM(gia_mua) AS tong_gia_tri
FROM thiet_bi
WHERE gia_mua IS NOT NULL;

-- Tổng giá trị theo khoa
SELECT k.ten AS khoa, SUM(e.gia_mua) AS tong_gia_tri
FROM khoa_phong k
JOIN thiet_bi e ON k.id_khoa = e.id_khoa
GROUP BY k.ten;
```

### 6.3. AVG - Trung bình

```sql
-- Giá trung bình thiết bị
SELECT AVG(gia_mua) AS gia_trung_binh
FROM thiet_bi
WHERE gia_mua IS NOT NULL;

-- Thời gian hoàn thành trung bình phiếu (ngày)
SELECT AVG(DATEDIFF(DAY, wo.tao_luc, wo.hoan_thanh_luc)) AS trung_binh_ngay
FROM phieu_cong_tac wo
WHERE wo.hoan_thanh_luc IS NOT NULL;
```

### 6.4. MIN, MAX - Giá trị nhỏ nhất, lớn nhất

```sql
-- Thiết bị đắt nhất
SELECT ma, ten, gia_mua
FROM thiet_bi
WHERE gia_mua = (SELECT MAX(gia_mua) FROM thiet_bi);

-- Thiết bị rẻ nhất
SELECT ma, ten, gia_mua
FROM thiet_bi
WHERE gia_mua = (SELECT MIN(gia_mua) FROM thiet_bi WHERE gia_mua IS NOT NULL);
```

### 6.5. GROUP BY với HAVING

```sql
-- Đếm phiếu theo loại, chỉ loại có > 10 phiếu
SELECT loai_phieu, COUNT(*) AS so_luong
FROM phieu_cong_tac
GROUP BY loai_phieu
HAVING COUNT(*) > 10;

-- Khoa có > 5 thiết bị quá hạn
SELECT k.ten AS khoa, COUNT(e.id_thiet_bi) AS so_qua_han
FROM khoa_phong k
JOIN thiet_bi e ON k.id_khoa = e.id_khoa
WHERE e.trang_thai = 'CHO_HIEU_CHUAN'
GROUP BY k.ten
HAVING COUNT(e.id_thiet_bi) > 5;
```

---

## 7. SUBQUERY - Truy vấn con

### 7.1. Subquery trong WHERE

```sql
-- Thiết bị thuộc khoa có tên "Hóa sinh"
SELECT ma, ten
FROM thiet_bi
WHERE id_khoa = (SELECT id_khoa FROM khoa_phong WHERE ten = N'Hóa sinh');

-- Phiếu do kỹ thuật viên "minhvt" thực hiện
SELECT ma, loai_phieu, trang_thai
FROM phieu_cong_tac
WHERE id_nguoi_thuc_hien = (SELECT id_nguoi_dung FROM nguoi_dung WHERE ten_dang_nhap = 'minhvt');
```

### 7.2. Subquery trong SELECT

```sql
-- Số phiếu của mỗi thiết bị
SELECT ma, ten,
       (SELECT COUNT(*) FROM phieu_cong_tac WHERE id_thiet_bi = e.id_thiet_bi) AS so_phieu
FROM thiet_bi e;

-- Tên khoa của thiết bị
SELECT ma, ten,
       (SELECT ten FROM khoa_phong WHERE id_khoa = e.id_khoa) AS khoa
FROM thiet_bi e;
```

### 7.3. Subquery trong FROM (Derived Table)

```sql
-- Thiết bị có giá trên trung bình
SELECT ma, ten, gia_mua
FROM (
    SELECT ma, ten, gia_mua, AVG(gia_mua) OVER () as avg_gia
    FROM thiet_bi
) AS t
WHERE gia_mua > avg_gia;

-- Top 3 khoa có nhiều thiết bị nhất
SELECT TOP 3 khoa, so_thiet_bi
FROM (
    SELECT k.ten AS khoa, COUNT(e.id_thiet_bi) AS so_thiet_bi
    FROM khoa_phong k
    JOIN thiet_bi e ON k.id_khoa = e.id_khoa
    GROUP BY k.ten
) AS t
ORDER BY so_thiet_bi DESC;
```

### 7.4. EXISTS, NOT EXISTS

```sql
-- Thiết bị có phiếu đang mở
SELECT ma, ten
FROM thiet_bi e
WHERE EXISTS (
    SELECT 1 FROM phieu_cong_tac wo
    WHERE wo.id_thiet_bi = e.id_thiet_bi
      AND wo.trang_thai NOT IN ('HOAN_THANH', 'TRA_LAI')
);

-- Khoa không có thiết bị nào
SELECT ten
FROM khoa_phong k
WHERE NOT EXISTS (
    SELECT 1 FROM thiet_bi e
    WHERE e.id_khoa = k.id_khoa
);
```

---

## 8. WINDOW FUNCTIONS - Hàm cửa sổ

### 8.1. ROW_NUMBER - Đánh số thứ tự

```sql
-- Đánh số thứ tự thiết bị theo ngày nhập
SELECT ma, ten, ngay_nhap,
       ROW_NUMBER() OVER (ORDER BY ngay_nhap DESC) AS thu_tu
FROM thiet_bi;

-- Đánh số thứ tự thiết bị trong mỗi khoa
SELECT ma, ten, k.ten AS khoa,
       ROW_NUMBER() OVER (PARTITION BY e.id_khoa ORDER BY e.ngay_nhap DESC) AS thu_tu_trong_khoa
FROM thiet_bi e
JOIN khoa_phong k ON e.id_khoa = k.id_khoa;
```

### 8.2. RANK, DENSE_RANK - Xếp hạng

```sql
-- Xếp hạng thiết bị theo giá (giá bằng nhau cùng rank)
SELECT ma, ten, gia_mua,
       RANK() OVER (ORDER BY gia_mua DESC) AS hang_gia
FROM thiet_bi
WHERE gia_mua IS NOT NULL;

-- Xếp hạng kỹ thuật viên theo số phiếu hoàn thành
SELECT u.ho_ten,
       COUNT(wo.id_phieu) AS so_phieu_hoan_thanh,
       RANK() OVER (ORDER BY COUNT(wo.id_phieu) DESC) AS hang
FROM nguoi_dung u
JOIN phieu_cong_tac wo ON u.id_nguoi_dung = wo.id_nguoi_thuc_hien
WHERE wo.trang_thai = 'HOAN_THANH'
GROUP BY u.ho_ten;
```

### 8.3. LAG, LEAD - Lấy giá trị dòng trước/sau

```sql
-- So sánh giá thiết bị với thiết bị liền trước
SELECT ma, ten, gia_mua,
       LAG(gia_mua) OVER (ORDER BY gia_mua) AS gia_truoc,
       gia_mua - LAG(gia_mua) OVER (ORDER BY gia_mua) AS chenh_lech
FROM thiet_bi
WHERE gia_mua IS NOT NULL;

-- Ngày hiệu chuẩn trước và sau
SELECT ma, han_hieu_chuan,
       LAG(han_hieu_chuan) OVER (ORDER BY han_hieu_chuan) AS han_truoc,
       LEAD(han_hieu_chuan) OVER (ORDER BY han_hieu_chuan) AS han_sau
FROM thiet_bi
WHERE han_hieu_chuan IS NOT NULL;
```

### 8.4. SUM, AVG với OVER

```sql
-- Tổng giá trị thiết bị tích lũy
SELECT ma, ten, gia_mua,
       SUM(gia_mua) OVER (ORDER BY gia_mua DESC) AS tich_luy
FROM thiet_bi
WHERE gia_mua IS NOT NULL;

-- Trung bình giá thiết bị trong khoa
SELECT ma, ten, gia_mua,
       AVG(gia_mua) OVER (PARTITION BY id_khoa) AS tb_gia_khoa
FROM thiet_bi
WHERE gia_mua IS NOT NULL;
```

---

## 9. VIEW quan trọng

### 9.1. v_thiet_bi - View thiết bị đầy đủ

```sql
-- Xem thông tin đầy đủ thiết bị
SELECT * FROM v_thiet_bi;

-- Thiết bị sắp hết hạn
SELECT * FROM v_thiet_bi
WHERE trang_thai_hieu_chuan = 'SAP_HAN';

-- Thiết bị quá hạn
SELECT * FROM v_thiet_bi
WHERE trang_thai_hieu_chuan = 'CHO_HIEU_CHUAN';
```

### 9.2. v_phieu_cong_tac - View phiếu công tác

```sql
-- Phiếu quá hạn
SELECT * FROM v_phieu_cong_tac
WHERE is_overdue = 1;

-- Phiếu khẩn cấp chưa hoàn thành
SELECT * FROM v_phieu_cong_tac
WHERE uu_tien = 'KHAN' AND trang_thai <> 'HOAN_THANH';
```

### 9.3. v_bang_dieu_khien - Dashboard

```sql
-- Thống kê tổng quan
SELECT * FROM v_bang_dieu_khien;
```

Kết quả trả về:

- `thiet_bi_hoat_dong`: Số thiết bị hoạt động
- `thiet_bi_qua_han`: Số thiết bị quá hạn
- `cho_phan_cong`: Số phiếu chờ phân công
- `pm_on_time_rate_6m`: Tỷ lệ PM đúng hạn 6 tháng
- `su_co_12_thang`: Số sự cố 12 tháng

---

## 10. CÁC HÀM THỜI GIAN QUAN TRỌNG

### 10.1. GETDATE, CAST/CONVERT

```sql
-- Lấy ngày giờ hiện tại
SELECT GETDATE() AS now;

-- Chỉ lấy ngày
SELECT CAST(GETDATE() AS DATE) AS today;

-- Định dạng ngày
SELECT FORMAT(GETDATE(), 'dd/MM/yyyy') AS ngay_vn;
SELECT FORMAT(GETDATE(), 'yyyy-MM-dd') AS ngay_iso;
```

### 10.2. DATEDIFF - Tính khoảng cách ngày

```sql
-- Số ngày từ hôm nay đến hạn hiệu chuẩn
SELECT ma, han_hieu_chuan,
       DATEDIFF(DAY, CAST(GETDATE() AS DATE), han_hieu_chuan) AS ngay_con_lai
FROM thiet_bi
WHERE han_hieu_chuan IS NOT NULL;

-- Số ngày thiết bị đã sử dụng
SELECT ma, ngay_nhap,
       DATEDIFF(DAY, ngay_nhap, GETDATE()) AS so_ngay_da_sd
FROM thiet_bi;
```

### 10.3. DATEADD - Cộng/trừ ngày

```sql
-- Ngày bảo trì kế tiếp = hôm nay + 90 ngày
SELECT ma, ngay_nhap,
       DATEADD(DAY, 90, ngay_nhap) AS pm_ke_tiep
FROM thiet_bi;

-- Hạn hiệu chuẩn mới = hạn cũ + 1 năm
SELECT ma, han_hieu_chuan,
       DATEADD(YEAR, 1, han_hieu_chuan) AS han_moi
FROM thiet_bi
WHERE han_hieu_chuan IS NOT NULL;
```

### 10.4. Hàm fn_so_thang (đã có trong database)

```sql
-- Đếm số tháng giữa hai ngày
SELECT dbo.fn_so_thang('2024-01-01', '2024-10-28') AS so_thang;
-- Kết quả: 9

-- Số tháng bảo hành còn lại
SELECT ma, ngay_nhap, thang_bao_hanh,
       dbo.fn_so_thang(GETDATE(), DATEADD(MONTH, thang_bao_hanh, ngay_nhap)) AS thang_bao_hanh_con
FROM thiet_bi;
```

---

## 11. TRANSACTION - Giao dịch

### 11.1. Transaction cơ bản

```sql
BEGIN TRANSACTION;

-- Cập nhật trạng thái thiết bị
UPDATE thiet_bi SET trang_thai = 'DANG_SUA' WHERE ma = 'DEV-001';

-- Tạo phiếu sửa chữa
INSERT INTO phieu_cong_tac (ma, loai_phieu, id_thiet_bi, id_khoa, trang_thai, tao_luc, han_chot, progress)
VALUES ('SC-2026-9999', 'SC', (SELECT id_thiet_bi FROM thiet_bi WHERE ma = 'DEV-001'),
        (SELECT id_khoa FROM thiet_bi WHERE ma = 'DEV-001'), 'CHO_PHAN_CONG',
        CAST(GETDATE() AS DATE), DATEADD(DAY, 7, CAST(GETDATE() AS DATE)), 0);

-- Kiểm tra, nếu đúng thì commit
COMMIT TRANSACTION;

-- Nếu có lỗi, rollback
-- ROLLBACK TRANSACTION;
```

### 11.2. Transaction với TRY-CATCH

```sql
BEGIN TRY
    BEGIN TRANSACTION;

    -- Các lệnh SQL
    UPDATE thiet_bi SET trang_thai = 'HOAT_DONG' WHERE ma = 'DEV-001';

    COMMIT TRANSACTION;
    PRINT 'Thành công!';
END TRY
BEGIN CATCH
    ROLLBACK TRANSACTION;
    PRINT 'Lỗi: ' + ERROR_MESSAGE();
END CATCH;
```

---

## 12. STORED PROCEDURE - Thủ tục lưu trữ

### 12.1. Tạo stored procedure đơn giản

```sql
CREATE PROCEDURE sp_TaoPhieuBaoTri
    @ma_thiet_bi NVARCHAR(20),
    @ngay_han DATE
AS
BEGIN
    DECLARE @id_tb INT, @id_khoa INT;

    SELECT @id_tb = id_thiet_bi, @id_khoa = id_khoa
    FROM thiet_bi WHERE ma = @ma_thiet_bi;

    INSERT INTO phieu_cong_tac (ma, loai_phieu, id_thiet_bi, id_khoa, trang_thai, tao_luc, han_chot, progress)
    VALUES ('PM-' + FORMAT(GETDATE(), 'yyyy-MM-dd') + '-' + CAST(NEWID() AS NVARCHAR(8)),
            'PM', @id_tb, @id_khoa, 'CHO_PHAN_CONG',
            CAST(GETDATE() AS DATE), @ngay_han, 0);
END;
GO
```

### 12.2. Gọi stored procedure

```sql
EXEC sp_TaoPhieuBaoTri 'DEV-001', '2024-11-28';
```

---

## 13. Mẹo và Best Practices

### 13.1. Dùng EXISTS thay vì COUNT

```sql
-- ❌ Chậm
IF (SELECT COUNT(*) FROM thiet_bi WHERE trang_thai = 'CHO_HIEU_CHUAN') > 0
    PRINT 'Có thiết bị quá hạn';

-- ✅ Nhanh
IF EXISTS (SELECT 1 FROM thiet_bi WHERE trang_thai = 'CHO_HIEU_CHUAN')
    PRINT 'Có thiết bị quá hạn';
```

### 13.2. Dùng TOP thay vì LIMIT

```sql
-- SQL Server không có LIMIT, dùng TOP
SELECT TOP 10 * FROM thiet_bi;
```

### 13.3. Luôn dùng N'' cho tiếng Việt

```sql
-- ❌ Có thể lỗi font
INSERT INTO khoa_phong (ten) VALUES ('Hóa sinh');

-- ✅ Đúng
INSERT INTO khoa_phong (ten) VALUES (N'Hóa sinh');
```

### 13.4. Index để tăng tốc độ

```sql
-- Tạo index trên cột thường dùng WHERE
CREATE INDEX ix_thiet_bi_trang_thai ON thiet_bi(trang_thai);
CREATE INDEX ix_phieu_cong_tac_ngay ON phieu_cong_tac(tao_luc);
```

---

## 14. Ví dụ thực tế hoàn chỉnh

### 14.1. Quy trình tạo phiếu bảo trì hoàn chỉnh

```sql
-- Bước 1: Tạo phiếu
DECLARE @id_tb INT, @id_khoa INT;
SELECT @id_tb = id_thiet_bi, @id_khoa = id_khoa
FROM thiet_bi WHERE ma = 'DEV-001';

INSERT INTO phieu_cong_tac (ma, loai_phieu, id_thiet_bi, id_khoa, trang_thai, tao_luc, han_chot, progress, description)
VALUES ('PM-2026-9999', 'PM', @id_tb, @id_khoa, 'CHO_PHAN_CONG',
        CAST(GETDATE() AS DATE), DATEADD(DAY, 10, CAST(GETDATE() AS DATE)), 0,
        N'Bảo trì định kỳ tháng 10');

-- Bước 2: Phân công cho kỹ thuật viên
DECLARE @id_phieu INT, @id_nguoi INT;
SET @id_phieu = SCOPE_IDENTITY();
SET @id_nguoi = (SELECT id_nguoi_dung FROM nguoi_dung WHERE ten_dang_nhap = 'minhvt');

INSERT INTO phan_cong (id_phieu, id_thiet_bi, id_nguoi_thuc_hien, scheduled_date, trang_thai, created_by, tao_luc)
VALUES (@id_phieu, @id_tb, @id_nguoi, DATEADD(DAY, 2, CAST(GETDATE() AS DATE)), 'DANG_THUC_HIEN', 7, GETDATE());

-- Bước 3: Cập nhật phiếu
UPDATE phieu_cong_tac
SET id_nguoi_thuc_hien = @id_nguoi,
    trang_thai = 'DANG_THUC_HIEN'
WHERE id_phieu = @id_phieu;

PRINT 'Đã tạo và phân công phiếu PM-2026-9999';
```

### 14.2. Báo cáo thiết bị cần bảo trì trong tháng

```sql
-- Thiết bị cần bảo trì trong 30 ngày tới
SELECT e.ma, e.ten, k.ten AS khoa, e.pm_ke_tiep,
       DATEDIFF(DAY, CAST(GETDATE() AS DATE), e.pm_ke_tiep) AS ngay_con_lai
FROM thiet_bi e
JOIN khoa_phong k ON e.id_khoa = k.id_khoa
WHERE e.pm_ke_tiep BETWEEN CAST(GETDATE() AS DATE) AND DATEADD(DAY, 30, CAST(GETDATE() AS DATE))
  AND e.trang_thai = 'HOAT_DONG'
ORDER BY e.pm_ke_tiep ASC;
```

### 14.3. Thống kê hiệu suất kỹ thuật viên

```sql
-- Hiệu suất kỹ thuật viên (phiếu hoàn thành, đúng hạn, bị trả lại)
SELECT u.ho_ten,
       COUNT(wo.id_phieu) AS tong_phieu,
       SUM(CASE WHEN wo.trang_thai = 'HOAN_THANH' THEN 1 ELSE 0 END) AS hoan_thanh,
       SUM(CASE WHEN wo.trang_thai = 'HOAN_THANH'
                AND CAST(wo.hoan_thanh_luc AS DATE) <= wo.han_chot THEN 1 ELSE 0 END) AS dung_han,
       SUM(CASE WHEN wo.trang_thai = 'TRA_LAI' THEN 1 ELSE 0 END) AS bi_tra_lai,
       ROUND(CAST(SUM(CASE WHEN wo.trang_thai = 'HOAN_THANH' THEN 1 ELSE 0 END) AS FLOAT) /
             NULLIF(COUNT(wo.id_phieu), 0) * 100, 1) AS ty_le_hoan_thanh
FROM nguoi_dung u
LEFT JOIN phieu_cong_tac wo ON u.id_nguoi_dung = wo.id_nguoi_thuc_hien
WHERE u.vai_tro = 'KY_THUAT_VIEN'
GROUP BY u.ho_ten
ORDER BY ty_le_hoan_thanh DESC;
```

---

## Tổng kết

- **Cơ bản:** SELECT, INSERT, UPDATE, DELETE với WHERE, ORDER BY
- **Trung cấp:** JOIN, GROUP BY, HAVING, Subquery
- **Nâng cao:** Window Functions, Stored Procedure, Transaction
- **View quan trọng:** v_thiet_bi, v_phieu_cong_tac, v_bang_dieu_khien
- **Hàm thời gian:** DATEDIFF, DATEADD, GETDATE

Xem file `QLTBYT_SQLServer.sql` để hiểu cấu trúc database đầy đủ.
