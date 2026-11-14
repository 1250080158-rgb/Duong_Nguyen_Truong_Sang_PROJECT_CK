-- ============================================================
-- DATABASE QUẢN LÝ THIẾT BỊ Y TẾ - SQL SERVER
-- Dùng cho web MED-EQUIP
-- ============================================================

USE master;
GO

IF EXISTS (SELECT name FROM sys.databases WHERE name = 'QLTBYT')
BEGIN
    ALTER DATABASE QLTBYT SET SINGLE_USER WITH ROLLBACK IMMEDIATE;
    DROP DATABASE QLTBYT;
END
GO

CREATE DATABASE QLTBYT COLLATE Vietnamese_CI_AS;
GO

USE QLTBYT;
GO

-- ============================================================
-- DROP OBJECTS
-- ============================================================

IF OBJECT_ID('v_thiet_bi', 'V') IS NOT NULL DROP VIEW v_thiet_bi;
IF OBJECT_ID('v_phieu_cong_tac', 'V') IS NOT NULL DROP VIEW v_phieu_cong_tac;
IF OBJECT_ID('v_bang_dieu_khien', 'V') IS NOT NULL DROP VIEW v_bang_dieu_khien;

IF OBJECT_ID('fn_so_thang', 'FN') IS NOT NULL DROP FUNCTION fn_so_thang;

IF OBJECT_ID('trg_phieu_chan_khai_thac', 'TR') IS NOT NULL 
    EXEC('DROP TRIGGER trg_phieu_chan_khai_thac ON phieu_cong_tac');

IF OBJECT_ID('thong_bao', 'U') IS NOT NULL DROP TABLE thong_bao;
IF OBJECT_ID('cau_hinh_he_thong', 'U') IS NOT NULL DROP TABLE cau_hinh_he_thong;
IF OBJECT_ID('nhat_ky_kiem_toan', 'U') IS NOT NULL DROP TABLE nhat_ky_kiem_toan;
IF OBJECT_ID('phan_cong', 'U') IS NOT NULL DROP TABLE phan_cong;
IF OBJECT_ID('su_co', 'U') IS NOT NULL DROP TABLE su_co;
IF OBJECT_ID('bang_chung', 'U') IS NOT NULL DROP TABLE bang_chung;
IF OBJECT_ID('cau_hinh_bang_chung', 'U') IS NOT NULL DROP TABLE cau_hinh_bang_chung;
IF OBJECT_ID('buoc_phieu', 'U') IS NOT NULL DROP TABLE buoc_phieu;
IF OBJECT_ID('phieu_cong_tac', 'U') IS NOT NULL DROP TABLE phieu_cong_tac;
IF OBJECT_ID('nguoi_dung', 'U') IS NOT NULL DROP TABLE nguoi_dung;
IF OBJECT_ID('lich_su_trang_thai_tb', 'U') IS NOT NULL DROP TABLE lich_su_trang_thai_tb;
IF OBJECT_ID('thiet_bi', 'U') IS NOT NULL DROP TABLE thiet_bi;
IF OBJECT_ID('model_thiet_bi', 'U') IS NOT NULL DROP TABLE model_thiet_bi;
IF OBJECT_ID('nha_cung_cap', 'U') IS NOT NULL DROP TABLE nha_cung_cap;
IF OBJECT_ID('hang_san_xuat', 'U') IS NOT NULL DROP TABLE hang_san_xuat;
IF OBJECT_ID('khoa_phong', 'U') IS NOT NULL DROP TABLE khoa_phong;
GO

-- ============================================================
-- BẢNG DỮ LIỆU
-- ============================================================

-- Khoa phòng
CREATE TABLE khoa_phong (
    id_khoa   INT IDENTITY(1,1) PRIMARY KEY,
    ten       NVARCHAR(100) NOT NULL UNIQUE,
    la_lam_sang BIT NOT NULL DEFAULT 1,
    dia_chi   NVARCHAR(200) NULL,
    dien_thoai NVARCHAR(30) NULL
);
GO

-- Hãng sản xuất
CREATE TABLE hang_san_xuat (
    id_hang INT IDENTITY(1,1) PRIMARY KEY,
    ten     NVARCHAR(150) NOT NULL UNIQUE,
    quoc_gia NVARCHAR(80) NULL,
    website NVARCHAR(200) NULL
);
GO

-- Nhà cung cấp
CREATE TABLE nha_cung_cap (
    id_ncc       INT IDENTITY(1,1) PRIMARY KEY,
    ten          NVARCHAR(150) NOT NULL UNIQUE,
    nguoi_lien_he NVARCHAR(100) NULL,
    dien_thoai   NVARCHAR(30) NULL,
    so_hop_dong  NVARCHAR(60) NULL
);
GO

-- Model thiết bị
CREATE TABLE model_thiet_bi (
    id_model   INT IDENTITY(1,1) PRIMARY KEY,
    ten        NVARCHAR(150) NOT NULL UNIQUE,
    id_hang    INT NOT NULL,
    loai       NVARCHAR(100) NOT NULL,
    chu_ky_pm_ngay INT NOT NULL DEFAULT 180,
    chu_ky_hc_ngay INT NOT NULL DEFAULT 365,
    dung_sai_hc_phan_tram DECIMAL(5,2) NOT NULL DEFAULT 2.50,
    hoat_dong  BIT NOT NULL DEFAULT 1,
    ghi_chu    NVARCHAR(500) NULL,
    FOREIGN KEY (id_hang) REFERENCES hang_san_xuat(id_hang)
);
GO

-- Thiết bị
CREATE TABLE thiet_bi (
    id_thiet_bi    INT IDENTITY(1,1) PRIMARY KEY,
    ma             NVARCHAR(20) NOT NULL UNIQUE,
    ten            NVARCHAR(150) NOT NULL,
    id_model       INT NOT NULL,
    serial         NVARCHAR(50) NOT NULL UNIQUE,
    id_khoa        INT NOT NULL,
    vi_tri         NVARCHAR(120) NULL,
    trang_thai     NVARCHAR(20) NOT NULL DEFAULT 'HOAT_DONG'
        CHECK (trang_thai IN ('HOAT_DONG','SAP_HAN','CHO_HIEU_CHUAN','DANG_SUA','THANH_LY')),
    han_hieu_chuan DATE NULL,
    pm_ke_tiep     DATE NULL,
    ngay_nhap      DATE NOT NULL,
    thang_bao_hanh INT NOT NULL DEFAULT 24,
    gia_mua        DECIMAL(14,2) NULL,
    id_ncc_bao_tri INT NULL,
    ghi_chu        NVARCHAR(500) NULL,
    FOREIGN KEY (id_model) REFERENCES model_thiet_bi(id_model),
    FOREIGN KEY (id_khoa) REFERENCES khoa_phong(id_khoa),
    FOREIGN KEY (id_ncc_bao_tri) REFERENCES nha_cung_cap(id_ncc),
    CHECK (NOT (trang_thai = 'CHO_HIEU_CHUAN' AND han_hieu_chuan IS NULL))
);
GO

CREATE INDEX ix_thiet_bi_trang_thai ON thiet_bi(trang_thai);
CREATE INDEX ix_thiet_bi_khoa ON thiet_bi(id_khoa);
GO

-- Lịch sử trạng thái thiết bị
CREATE TABLE lich_su_trang_thai_tb (
    id_lich_su   BIGINT IDENTITY(1,1) PRIMARY KEY,
    id_thiet_bi  INT NOT NULL,
    trang_thai_cu  NVARCHAR(20) NOT NULL,
    trang_thai_moi NVARCHAR(20) NOT NULL,
    doi_boi      NVARCHAR(50) NOT NULL,
    ly_do        NVARCHAR(300) NULL,
    doi_luc      DATETIME2 NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (id_thiet_bi) REFERENCES thiet_bi(id_thiet_bi) ON DELETE CASCADE
);
GO

-- Người dùng
CREATE TABLE nguoi_dung (
    id_nguoi_dung   INT IDENTITY(1,1) PRIMARY KEY,
    ten_dang_nhap   NVARCHAR(50) NOT NULL UNIQUE,
    ho_ten          NVARCHAR(150) NOT NULL,
    email           NVARCHAR(120) NULL,
    ma_nhan_vien    NVARCHAR(30) NULL,
    vai_tro         NVARCHAR(20) NOT NULL
        CHECK (vai_tro IN ('ADMIN','DIEU_PHOI','KY_THUAT_VIEN','DAU_MOI_KHOA')),
    id_khoa         INT NULL,
    dien_thoai      NVARCHAR(30) NULL,
    dang_nhap_cuoi  DATETIME2 NULL,
    hoat_dong       BIT NOT NULL DEFAULT 1,
    FOREIGN KEY (id_khoa) REFERENCES khoa_phong(id_khoa)
);
GO

CREATE INDEX ix_nguoi_dung_vai_tro ON nguoi_dung(vai_tro);
GO

-- Phiếu công tác
CREATE TABLE phieu_cong_tac (
    id_phieu        INT IDENTITY(1,1) PRIMARY KEY,
    ma              NVARCHAR(20) NOT NULL UNIQUE,
    loai_phieu      CHAR(2) NOT NULL CHECK (loai_phieu IN ('PM','SC','HC','KT')),
    id_thiet_bi     INT NOT NULL,
    id_khoa         INT NOT NULL,
    id_nguoi_thuc_hien INT NULL,
    trang_thai      NVARCHAR(20) NOT NULL DEFAULT 'CHO_PHAN_CONG'
        CHECK (trang_thai IN ('CHO_PHAN_CONG','DANG_THUC_HIEN','CHO_NGHIEM_THU','HOAN_THANH','TRA_LAI')),
    uu_tien         NVARCHAR(15) NOT NULL DEFAULT 'BINH_THUONG'
        CHECK (uu_tien IN ('BINH_THUONG','KHAN')),
    tao_luc         DATE NOT NULL,
    han_chot        DATE NOT NULL,
    hoan_thanh_luc  DATETIME2 NULL,
    nghiem_thu_luc  DATETIME2 NULL,
    progress        SMALLINT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    ly_do_tra       NVARCHAR(500) NULL,
    description     NVARCHAR(500) NULL,
    FOREIGN KEY (id_thiet_bi) REFERENCES thiet_bi(id_thiet_bi),
    FOREIGN KEY (id_khoa) REFERENCES khoa_phong(id_khoa),
    FOREIGN KEY (id_nguoi_thuc_hien) REFERENCES nguoi_dung(id_nguoi_dung),
    CHECK (han_chot >= tao_luc)
);
GO

CREATE INDEX ix_phieu_trang_thai ON phieu_cong_tac(trang_thai);
CREATE INDEX ix_phieu_nguoi_thuc_hien ON phieu_cong_tac(id_nguoi_thuc_hien);
GO

-- Bước phiếu (checklist)
CREATE TABLE buoc_phieu (
    id_buoc         BIGINT IDENTITY(1,1) PRIMARY KEY,
    id_phieu        INT NOT NULL,
    thu_tu          INT NOT NULL CHECK (thu_tu > 0),
    tieu_de         NVARCHAR(200) NOT NULL,
    require_photo   BIT NOT NULL DEFAULT 0,
    gia_tri_chuan   DECIMAL(10,4) NULL,
    unit            NVARCHAR(20) NULL,
    dung_sai_phan_tram DECIMAL(5,2) NULL,
    gia_tri_do      DECIMAL(10,4) NULL,
    result          NVARCHAR(10) NULL CHECK (result IN ('DAT','KHONG_DAT')),
    hoan_thanh      BIT NOT NULL DEFAULT 0,
    ly_do_bo        NVARCHAR(300) NULL,
    note            NVARCHAR(500) NULL,
    performed_at    DATETIME2 NULL,
    performed_by    INT NULL,
    FOREIGN KEY (id_phieu) REFERENCES phieu_cong_tac(id_phieu) ON DELETE CASCADE,
    FOREIGN KEY (performed_by) REFERENCES nguoi_dung(id_nguoi_dung),
    UNIQUE (id_phieu, thu_tu),
    CHECK (result IS NULL OR result <> 'DAT' OR gia_tri_chuan IS NULL OR gia_tri_do IS NULL
           OR gia_tri_chuan = 0 OR ABS(gia_tri_do - gia_tri_chuan) / gia_tri_chuan * 100 <= ISNULL(dung_sai_phan_tram, 100))
);
GO

-- Cấu hình bằng chứng
CREATE TABLE cau_hinh_bang_chung (
    config_id      INT IDENTITY(1,1) PRIMARY KEY,
    loai_phieu     CHAR(2) NOT NULL CHECK (loai_phieu IN ('PM','SC','HC','KT')),
    ma_bang_chung  NVARCHAR(30) NOT NULL,
    label          NVARCHAR(100) NOT NULL,
    is_required    BIT NOT NULL DEFAULT 1,
    max_files      SMALLINT NOT NULL DEFAULT 1,
    accept_mime    NVARCHAR(120) NULL,
    sort_order     SMALLINT NOT NULL DEFAULT 0,
    UNIQUE (loai_phieu, ma_bang_chung)
);
GO

-- Bằng chứng (file đính kèm)
CREATE TABLE bang_chung (
    id_bang_chung  BIGINT IDENTITY(1,1) PRIMARY KEY,
    id_phieu       INT NOT NULL,
    ma_bang_chung  NVARCHAR(30) NOT NULL,
    ten_tep        NVARCHAR(260) NOT NULL,
    duong_dan_tep  NVARCHAR(500) NOT NULL,
    file_mime      NVARCHAR(80) NULL,
    ma_bam         NCHAR(64) NOT NULL,
    file_size_kb   INT NOT NULL CHECK (file_size_kb > 0),
    tai_boi        INT NOT NULL,
    tai_luc        DATETIME2 NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (id_phieu) REFERENCES phieu_cong_tac(id_phieu) ON DELETE CASCADE,
    FOREIGN KEY (tai_boi) REFERENCES nguoi_dung(id_nguoi_dung)
);
GO

-- Sự cố
CREATE TABLE su_co (
    id_su_co       INT IDENTITY(1,1) PRIMARY KEY,
    ma             NVARCHAR(20) NOT NULL UNIQUE,
    id_thiet_bi    INT NOT NULL,
    bao_boi        INT NOT NULL,
    description    NVARCHAR(500) NOT NULL,
    severity       NVARCHAR(10) NOT NULL CHECK (severity IN ('SO_BO','KHAN')),
    photo_count    SMALLINT NOT NULL DEFAULT 0,
    trang_thai     NVARCHAR(15) NOT NULL DEFAULT 'MOI'
        CHECK (trang_thai IN ('MOI','DA_TIEP_NHAN','DA_TAO_PHIEU','DONG')),
    tao_luc        DATETIME2 NOT NULL DEFAULT GETDATE(),
    closed_at      DATETIME2 NULL,
    resolution     NVARCHAR(500) NULL,
    id_phieu       INT NULL,
    FOREIGN KEY (id_thiet_bi) REFERENCES thiet_bi(id_thiet_bi),
    FOREIGN KEY (bao_boi) REFERENCES nguoi_dung(id_nguoi_dung),
    FOREIGN KEY (id_phieu) REFERENCES phieu_cong_tac(id_phieu)
);
GO

-- Phân công
CREATE TABLE phan_cong (
    id_phan_cong   INT IDENTITY(1,1) PRIMARY KEY,
    id_phieu       INT NOT NULL UNIQUE,
    id_thiet_bi    INT NOT NULL,
    id_nguoi_thuc_hien INT NOT NULL,
    scheduled_date DATE NOT NULL,
    trang_thai     NVARCHAR(15) NOT NULL DEFAULT 'DANG_THUC_HIEN'
        CHECK (trang_thai IN ('DANG_THUC_HIEN','HOAN_THANH','HUY')),
    created_by     INT NOT NULL,
    tao_luc        DATETIME2 NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (id_phieu) REFERENCES phieu_cong_tac(id_phieu) ON DELETE CASCADE,
    FOREIGN KEY (id_thiet_bi) REFERENCES thiet_bi(id_thiet_bi),
    FOREIGN KEY (id_nguoi_thuc_hien) REFERENCES nguoi_dung(id_nguoi_dung),
    FOREIGN KEY (created_by) REFERENCES nguoi_dung(id_nguoi_dung)
);
GO

-- Nhật ký hệ thống (audit log)
CREATE TABLE nhat_ky_kiem_toan (
    id_kiem_toan   BIGINT IDENTITY(1,1) PRIMARY KEY,
    occurred_at    DATETIME2 NOT NULL DEFAULT GETDATE(),
    nguoi_thuc_hien NVARCHAR(50) NOT NULL,
    hanh_dong      NVARCHAR(40) NOT NULL,
    doi_tuong      NVARCHAR(100) NOT NULL,
    chi_tiet       NVARCHAR(500) NULL,
    prev_hash      NCHAR(64) NOT NULL,
    row_hash       NCHAR(64) NOT NULL
);
GO

CREATE INDEX ix_nhat_ky_kiem_toan_time ON nhat_ky_kiem_toan(occurred_at DESC);
GO

-- Cấu hình hệ thống
CREATE TABLE cau_hinh_he_thong (
    config_key     NVARCHAR(50) PRIMARY KEY,
    config_value   NVARCHAR(200) NOT NULL,
    description    NVARCHAR(300) NOT NULL,
    updated_at     DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_by     NVARCHAR(50) NULL
);
GO

-- Thông báo
CREATE TABLE thong_bao (
    notification_id BIGINT IDENTITY(1,1) PRIMARY KEY,
    id_nguoi_dung   INT NOT NULL,
    type            NVARCHAR(30) NOT NULL,
    message         NVARCHAR(300) NOT NULL,
    link            NVARCHAR(200) NULL,
    is_read         BIT NOT NULL DEFAULT 0,
    tao_luc         DATETIME2 NOT NULL DEFAULT GETDATE(),
    FOREIGN KEY (id_nguoi_dung) REFERENCES nguoi_dung(id_nguoi_dung) ON DELETE CASCADE
);
GO

-- ============================================================
-- HÀM
-- ============================================================

-- Đếm số tháng giữa 2 ngày
CREATE FUNCTION fn_so_thang(@d1 DATE, @d2 DATE)
RETURNS INT
AS
BEGIN
    RETURN DATEDIFF(MONTH, @d1, @d2);
END;
GO

-- ============================================================
-- TRIGGER
-- ============================================================

-- Chặn tạo phiếu PM/SC cho thiết bị quá hạn
CREATE TRIGGER trg_phieu_chan_khai_thac
ON phieu_cong_tac
INSTEAD OF INSERT
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO phieu_cong_tac (ma, loai_phieu, id_thiet_bi, id_khoa, id_nguoi_thuc_hien, trang_thai, uu_tien, tao_luc, han_chot, progress, description)
    SELECT i.ma, i.loai_phieu, i.id_thiet_bi, i.id_khoa, i.id_nguoi_thuc_hien, i.trang_thai, i.uu_tien, i.tao_luc, i.han_chot, i.progress, i.description
    FROM inserted i
    JOIN thiet_bi e ON e.id_thiet_bi = i.id_thiet_bi
    WHERE i.loai_phieu NOT IN ('PM','SC')
       OR NOT (e.trang_thai = 'CHO_HIEU_CHUAN' OR e.trang_thai = 'THANH_LY'
               OR (e.han_hieu_chuan IS NOT NULL AND e.han_hieu_chuan < CAST(GETDATE() AS DATE)));

    IF EXISTS (
        SELECT 1
        FROM inserted i
        JOIN thiet_bi e ON e.id_thiet_bi = i.id_thiet_bi
        WHERE i.loai_phieu IN ('PM','SC')
          AND (e.trang_thai = 'CHO_HIEU_CHUAN' OR e.trang_thai = 'THANH_LY'
               OR (e.han_hieu_chuan IS NOT NULL AND e.han_hieu_chuan < CAST(GETDATE() AS DATE)))
    )
    BEGIN
        RAISERROR('Không thể tạo phiếu PM/SC cho thiết bị quá hạn hiệu chuẩn hoặc đã thanh lý.', 16, 1);
    END
END;
GO

-- ============================================================
-- VIEW
-- ============================================================

-- View thiết bị đầy đủ
CREATE VIEW v_thiet_bi AS
SELECT  e.id_thiet_bi,
        e.ma,
        e.ten,
        e.serial,
        e.vi_tri,
        e.trang_thai,
        m.ten AS model,
        h.ten AS hang_san_xuat,
        k.ten AS khoa,
        e.han_hieu_chuan,
        DATEDIFF(DAY, CAST(GETDATE() AS DATE), e.han_hieu_chuan) AS ngay_con_lai,
        CASE
            WHEN e.han_hieu_chuan IS NULL THEN NULL
            WHEN e.han_hieu_chuan < CAST(GETDATE() AS DATE) THEN 'QUA_HAN'
            WHEN DATEDIFF(DAY, CAST(GETDATE() AS DATE), e.han_hieu_chuan) <= 7 THEN 'SAP_HAN'
            ELSE 'CON_HAN'
        END AS trang_thai_hieu_chuan,
        e.pm_ke_tiep,
        e.ngay_nhap,
        e.thang_bao_hanh,
        dbo.fn_so_thang(CAST(GETDATE() AS DATE), DATEADD(MONTH, e.thang_bao_hanh, e.ngay_nhap)) AS thang_bao_hanh_con,
        e.gia_mua,
        n.ten AS nha_cung_cap,
        e.ghi_chu
FROM thiet_bi e
JOIN model_thiet_bi m ON e.id_model = m.id_model
JOIN hang_san_xuat h ON m.id_hang = h.id_hang
JOIN khoa_phong k ON e.id_khoa = k.id_khoa
LEFT JOIN nha_cung_cap n ON e.id_ncc_bao_tri = n.id_ncc;
GO

-- View phiếu công tác đầy đủ
CREATE VIEW v_phieu_cong_tac AS
SELECT  wo.id_phieu,
        wo.ma,
        wo.loai_phieu,
        wo.trang_thai,
        wo.uu_tien,
        wo.progress,
        wo.tao_luc,
        wo.han_chot,
        DATEDIFF(DAY, CAST(GETDATE() AS DATE), wo.han_chot) AS ngay_con_han,
        CASE WHEN wo.han_chot < CAST(GETDATE() AS DATE) AND wo.trang_thai <> 'HOAN_THANH' THEN 1 ELSE 0 END AS qua_han,
        e.ma AS ma_thiet_bi,
        e.ten AS ten_thiet_bi,
        k.ten AS khoa,
        e.trang_thai AS trang_thai_thiet_bi,
        u.ho_ten AS nguoi_thuc_hien,
        wo.description
FROM phieu_cong_tac wo
JOIN thiet_bi e ON wo.id_thiet_bi = e.id_thiet_bi
JOIN khoa_phong k ON wo.id_khoa = k.id_khoa
LEFT JOIN nguoi_dung u ON wo.id_nguoi_thuc_hien = u.id_nguoi_dung;
GO

-- View dashboard
CREATE VIEW v_bang_dieu_khien AS
SELECT  (SELECT COUNT(*) FROM thiet_bi WHERE trang_thai = 'HOAT_DONG') AS thiet_bi_hoat_dong,
        (SELECT COUNT(*) FROM thiet_bi WHERE trang_thai = 'SAP_HAN') AS thiet_bi_sap_han,
        (SELECT COUNT(*) FROM thiet_bi WHERE trang_thai = 'CHO_HIEU_CHUAN') AS thiet_bi_qua_han,
        (SELECT COUNT(*) FROM thiet_bi WHERE trang_thai = 'DANG_SUA') AS thiet_bi_dang_sua,
        (SELECT COUNT(*) FROM thiet_bi WHERE trang_thai = 'THANH_LY') AS thiet_bi_thanh_ly,
        (SELECT COUNT(*) FROM thiet_bi) AS tong_thiet_bi,
        (SELECT COUNT(*) FROM phieu_cong_tac WHERE trang_thai = 'CHO_PHAN_CONG') AS cho_phan_cong,
        (SELECT COUNT(*) FROM phieu_cong_tac WHERE trang_thai = 'DANG_THUC_HIEN') AS dang_thuc_hien,
        (SELECT COUNT(*) FROM phieu_cong_tac WHERE trang_thai = 'CHO_NGHIEM_THU') AS cho_nghiem_thu,
        (SELECT COUNT(*) FROM phieu_cong_tac WHERE trang_thai = 'HOAN_THANH') AS hoan_thanh,
        (SELECT COUNT(*) FROM phieu_cong_tac WHERE trang_thai = 'TRA_LAI') AS tra_lai,
        (SELECT COUNT(*) FROM phieu_cong_tac WHERE han_chot < CAST(GETDATE() AS DATE) AND trang_thai <> 'HOAN_THANH') AS phieu_qua_han,
        (SELECT COUNT(*) FROM phieu_cong_tac WHERE uu_tien = 'KHAN' AND trang_thai <> 'HOAN_THANH') AS phieu_khan;
GO

-- ============================================================
-- DỮ LIỆU MẪU
-- ============================================================

-- Khoa phòng
INSERT INTO khoa_phong (ten, la_lam_sang, dia_chi, dien_thoai) VALUES
(N'Hóa sinh', 1, N'Tầng 1', '2401'),
(N'Huyết học', 1, N'Tầng 1', '2402'),
(N'Hồi sức cấp cứu', 1, N'Tầng 3', '2410'),
(N'Chẩn đoán hình ảnh', 1, N'Tầng 1', '2403'),
(N'Tim mạch', 1, N'Tầng 2', '2420'),
(N'Nhi khoa', 1, N'Tầng 2', '2421'),
(N'Sản phụ khoa', 1, N'Tầng 3', '2411'),
(N'Ngoại khoa', 1, N'Tầng 4', '2430'),
(N'Tai Mũi Răng', 1, N'Tầng 2', '2422'),
(N'Mắt', 1, N'Tầng 2', '2423'),
(N'Dây chuyền ngoại trú', 1, N'Tầng 1', '2404'),
(N'Phòng Vật tư', 0, N'Tầng 1', '2450'),
(N'Phòng Quản lý', 0, N'Tầng 1', '2210'),
(N'Phòng IT', 0, N'Tầng 1', '2260');
GO

-- Hãng sản xuất
INSERT INTO hang_san_xuat (ten, quoc_gia, website) VALUES
(N'Mindray', N'Trung Quốc', 'https://www.mindray.com'),
(N'Sysmex', N'Nhật Bản', 'https://www.sysmex.co.jp'),
(N'Hamilton Medical', N'Thụy Sĩ', 'https://www.hamiltonmedical.com'),
(N'GE Healthcare', N'Hoa Kỳ', 'https://www.gehealthcare.com'),
(N'Philips', N'Hà Lan', 'https://www.philips.com'),
(N'Dräger', N'Đức', 'https://www.draeger.com');
GO

-- Nhà cung cấp
INSERT INTO nha_cung_cap (ten, nguoi_lien_he, dien_thoai, so_hop_dong) VALUES
(N'Dräger Vietnam', N'Nguyễn Văn Hùng', '0903 100 200', 'HD-DR-2024-01'),
(N'Sysmex Vietnam', N'Trần Minh Quân', '0903 100 201', 'HD-SY-2024-02'),
(N'GE Healthcare VN', N'Phạm Gia Linh', '0903 100 203', 'HD-GE-2024-04'),
(N'Philips Vietnam', N'Bùi Thanh Sơn', '0903 100 209', 'HD-PH-2024-10');
GO

-- Model thiết bị
INSERT INTO model_thiet_bi (ten, id_hang, loai, chu_ky_pm_ngay, chu_ky_hc_ngay, dung_sai_hc_phan_tram, ghi_chu) VALUES
(N'Mindray BS-240', 1, N'Máy sinh phẩm', 90, 365, 2.50, N'Máy sinh phẩm tự động'),
(N'Sysmex XN-1000', 2, N'Máy huyết học', 60, 365, 2.50, N'Phân tích tế bào máu'),
(N'Hamilton G5', 3, N'Máy thở', 180, 365, 3.00, N'Máy thở hồi sức'),
(N'GE LOGIQ E9', 4, N'Máy siêu âm', 180, 365, 5.00, N'Siêu âm Doppler'),
(N'Philips Monitor', 5, N'Màn hình theo dõi', 180, 365, 5.00, N'Monitor ICU'),
(N'Dräger Perseus', 6, N'Máy gây mê', 180, 365, 3.50, N'Máy gây mê');
GO

-- Người dùng
INSERT INTO nguoi_dung (ten_dang_nhap, ho_ten, email, ma_nhan_vien, vai_tro, id_khoa, dien_thoai, hoat_dong) VALUES
('minhvt', N'Nguyễn Minh Vĩnh Thịnh', 'minhvt@bvtw.vn', 'NV001', 'KY_THUAT_VIEN', 12, '0912 001 101', 1),
('hungtv', N'Trần Văn Hùng', 'hungtv@bvtw.vn', 'NV002', 'KY_THUAT_VIEN', 12, '0912 001 102', 1),
('lthimai', N'Lê Thị Mai', 'lthimai@bvtw.vn', 'NV003', 'KY_THUAT_VIEN', 12, '0912 001 103', 1),
('dphuong', N'Phạm Thị Diễm Phương', 'dphuong@bvtw.vn', 'NV010', 'DIEU_PHOI', 12, '0912 001 201', 1),
('ducvu', N'Nguyễn Đức Vũ', 'ducvu@bvtw.vn', 'NV011', 'DIEU_PHOI', 12, '0912 001 202', 1),
('vanna', N'Nguyễn Thị Ánh Vân', 'vanna@bvtw.vn', 'NV020', 'DAU_MOI_KHOA', 1, '0912 001 301', 1),
('khaibq', N'Bùi Quang Khải', 'khaibq@bvtw.vn', 'NV021', 'DAU_MOI_KHOA', 3, '0912 001 302', 1),
('longhduc', N'Hoàng Đức Long', 'longhduc@bvtw.vn', 'NV001', 'ADMIN', 14, '0912 001 001', 1);
GO

-- Thiết bị (20 máy - vừa đủ demo)
INSERT INTO thiet_bi (ma, ten, id_model, serial, id_khoa, vi_tri, trang_thai, han_hieu_chuan, pm_ke_tiep, ngay_nhap, thang_bao_hanh, gia_mua, id_ncc_bao_tri, ghi_chu) VALUES
('DEV-001', N'Máy sinh phẩm BS-240', 1, 'SN-12345', 1, N'Phòng thí nghiệm 1', 'HOAT_DONG', '2027-02-15', '2026-11-10', '2022-03-15', 24, 1850000000, 1, NULL),
('DEV-002', N'Máy sinh phẩm BS-240 số 2', 1, 'SN-12346', 1, N'Phòng thí nghiệm 1', 'CHO_HIEU_CHUAN', '2026-08-01', NULL, '2022-03-15', 24, 1850000000, 1, N'Quá hạn hiệu chuẩn'),
('DEV-003', N'Máy huyết học XN-1000', 2, 'SN-00912', 2, N'Phòng huyết học', 'DANG_SUA', '2026-11-20', NULL, '2021-06-08', 36, 3100000000, 2, N'Bơm hút bị nghẹt'),
('DEV-004', N'Máy thở Hamilton G5', 3, 'SN-44210', 3, N'Buồng hồi sức 1', 'SAP_HAN', '2026-10-18', '2026-10-18', '2020-09-01', 24, 5200000000, 1, NULL),
('DEV-005', N'Máy siêu âm LOGIQ E9', 4, 'SN-78123', 4, N'Phòng siêu âm 1', 'HOAT_DONG', '2027-04-05', '2027-04-05', '2023-04-20', 24, 3200000000, 3, NULL),
('DEV-006', N'Máy sinh phẩm BS-240 số 3', 1, 'SN-12347', 1, N'Phòng thí nghiệm 2', 'HOAT_DONG', '2027-04-30', '2026-11-30', '2023-04-30', 24, 1850000000, 1, NULL),
('DEV-007', N'Máy huyết học XN-1000 số 2', 2, 'SN-00913', 2, N'Phòng huyết học', 'HOAT_DONG', '2027-02-14', '2026-11-14', '2022-02-14', 36, 3100000000, 2, NULL),
('DEV-008', N'Máy thở Hamilton G5 số 2', 3, 'SN-44211', 3, N'Buồng hồi sức 2', 'HOAT_DONG', '2027-03-11', '2026-09-11', '2021-03-11', 24, 5200000000, 1, NULL),
('DEV-009', N'Máy siêu âm LOGIQ E9 số 2', 4, 'SN-78124', 4, N'Phòng siêu âm 2', 'HOAT_DONG', '2027-06-05', '2026-12-05', '2023-06-05', 24, 3200000000, 3, NULL),
('DEV-010', N'Philips Monitor ICU', 5, 'SN-66740', 3, N'Buồng hồi sức 1', 'HOAT_DONG', '2027-01-20', '2027-01-20', '2022-10-11', 24, 980000000, 4, NULL),
('DEV-011', N'Máy gây mê Dräger', 6, 'SN-88320', 7, N'Phòng mổ', 'HOAT_DONG', '2027-05-15', '2026-11-15', '2022-05-15', 24, 3900000000, 1, NULL),
('DEV-012', N'Máy sinh phẩm BS-240 số 4', 1, 'SN-12348', 11, N'Phòng ngoại trú', 'HOAT_DONG', '2027-01-25', '2026-10-25', '2023-01-25', 24, 1850000000, 1, NULL),
('DEV-013', N'Máy huyết học XN-1000 số 3', 2, 'SN-00914', 2, N'Phòng huyết học', 'SAP_HAN', '2026-10-28', '2026-10-28', '2020-11-20', 36, 3100000000, 2, NULL),
('DEV-014', N'Máy thở Hamilton G5 số 3', 3, 'SN-44212', 3, N'Buồng hồi sức 3', 'CHO_HIEU_CHUAN', '2026-09-20', NULL, '2020-06-18', 24, 5200000000, 1, N'Quá hạn lâu'),
('DEV-015', N'Máy siêu âm LOGIQ E9 số 3', 4, 'SN-78125', 4, N'Phòng siêu âm 3', 'HOAT_DONG', '2027-08-19', '2027-02-19', '2023-08-19', 24, 3200000000, 3, NULL),
('DEV-016', N'Philips Monitor số 2', 5, 'SN-66741', 3, N'Buồng hồi sức 2', 'HOAT_DONG', '2027-04-10', '2026-10-10', '2022-11-02', 24, 980000000, 4, NULL),
('DEV-017', N'Máy gây mê Dräger số 2', 6, 'SN-88321', 7, N'Phòng mổ 2', 'HOAT_DONG', '2027-03-25', '2026-09-25', '2023-03-25', 24, 3900000000, 1, NULL),
('DEV-018', N'Máy sinh phẩm BS-240 số 5', 1, 'SN-12349', 5, N'Phòng nội soi', 'HOAT_DONG', '2027-09-15', '2027-03-15', '2023-09-15', 24, 1850000000, 1, NULL),
('DEV-019', N'Máy huyết học XN-1000 số 4', 2, 'SN-00915', 2, N'Phòng huyết học 2', 'HOAT_DONG', '2027-06-14', '2026-12-14', '2022-06-14', 36, 3100000000, 2, NULL),
('DEV-020', N'Máy thở Hamilton G5 số 4', 3, 'SN-44213', 6, N'Buồng nhi', 'HOAT_DONG', '2027-02-08', '2026-11-08', '2023-02-08', 24, 5200000000, 1, NULL);
GO

-- Cấu hình bằng chứng
INSERT INTO cau_hinh_bang_chung (loai_phieu, ma_bang_chung, label, is_required, max_files, accept_mime, sort_order) VALUES
('HC', 'ANH_TRUOC', N'Ảnh trước hiệu chuẩn', 1, 3, 'image/jpeg', 1),
('HC', 'ANH_KET_QUA', N'Ảnh kết quả', 1, 3, 'image/jpeg', 2),
('HC', 'CHUNG_CHI', N'Chứng chỉ hiệu chuẩn', 1, 1, 'application/pdf', 3),
('SC', 'ANH_TRUOC', N'Ảnh trước sửa', 1, 3, 'image/jpeg', 1),
('SC', 'ANH_SAU', N'Ảnh sau sửa', 1, 3, 'image/jpeg', 2),
('PM', 'ANH_BUOC', N'Ảnh bước thực hiện', 1, 5, 'image/jpeg', 1),
('PM', 'CHECKLIST', N'Checklist', 1, 1, 'application/pdf', 2);
GO

-- Cấu hình hệ thống
INSERT INTO cau_hinh_he_thong (config_key, config_value, description, updated_by) VALUES
('warning_days', '7', N'Cảnh báo trước hết hạn', 'longhduc'),
('auto_lock', 'true', N'Tự động khóa khi quá hạn', 'longhduc'),
('require_evidence', 'true', N'Bắt buộc bằng chứng', 'dphuong');
GO

-- Phiếu công tác mẫu (10 phiếu)
INSERT INTO phieu_cong_tac (ma, loai_phieu, id_thiet_bi, id_khoa, id_nguoi_thuc_hien, trang_thai, uu_tien, tao_luc, han_chot, progress, description) VALUES
('PM-2026-001', 'PM', 1, 1, 1, 'DANG_THUC_HIEN', 'BINH_THUONG', '2026-10-20', '2026-10-30', 40, N'Bảo trì định kỳ'),
('PM-2026-002', 'PM', 6, 1, 2, 'CHO_PHAN_CONG', 'BINH_THUONG', '2026-10-22', '2026-11-01', 0, N'Bảo trì định kỳ'),
('HC-2026-001', 'HC', 2, 1, 1, 'DANG_THUC_HIEN', 'KHAN', '2026-10-15', '2026-10-25', 60, N'Hiệu chuẩn lại'),
('SC-2026-001', 'SC', 3, 2, 2, 'DANG_THUC_HIEN', 'KHAN', '2026-10-18', '2026-10-25', 70, N'Sửa bơm hút'),
('PM-2026-003', 'PM', 8, 3, 3, 'HOAN_THANH', 'BINH_THUONG', '2026-10-10', '2026-10-20', 100, N'Bảo trì máy thở'),
('HC-2026-002', 'HC', 14, 3, NULL, 'CHO_PHAN_CONG', 'KHAN', '2026-10-22', '2026-11-01', 0, N'Hiệu chuẩn máy thở'),
('SC-2026-002', 'SC', 5, 4, NULL, 'CHO_PHAN_CONG', 'BINH_THUONG', '2026-10-21', '2026-10-28', 0, N'Sửa siêu âm'),
('PM-2026-004', 'PM', 10, 3, 1, 'CHO_NGHIEM_THU', 'BINH_THUONG', '2026-10-15', '2026-10-25', 100, N'Bảo trì monitor'),
('HC-2026-003', 'HC', 11, 7, 2, 'HOAN_THANH', 'BINH_THUONG', '2026-10-05', '2026-10-15', 100, N'Hiệu chuẩn máy gây mê'),
('PM-2026-005', 'PM', 12, 11, 3, 'DANG_THUC_HIEN', 'BINH_THUONG', '2026-10-23', '2026-11-02', 30, N'Bảo trì ngoại trú');
GO

-- Sự cố mẫu (5 sự cố)
INSERT INTO su_co (ma, id_thiet_bi, bao_boi, description, severity, photo_count, trang_thai, tao_luc, resolution) VALUES
('INC-2026-001', 3, 7, N'Bơm hút bị nghẹt', 'KHAN', 1, 'DA_TAO_PHIEU', '2026-10-18 08:12', NULL),
('INC-2026-002', 5, 7, N'Màn hình nhiễu', 'SO_BO', 2, 'DONG', '2026-10-10 09:15', N'Vệ sinh đầu dò'),
('INC-2026-003', 14, 7, N'Máy thở báo lỗi', 'KHAN', 0, 'MOI', '2026-10-22 10:30', NULL),
('INC-2026-004', 4, 7, N'Không lên hình', 'KHAN', 1, 'DA_TIEP_NHAN', '2026-10-21 14:20', NULL),
('INC-2026-005', 2, 7, N'Kết quả lệch', 'SO_BO', 0, 'DONG', '2026-10-05 11:00', N'Hiệu chuẩn lại');
GO

-- Phân công mẫu
INSERT INTO phan_cong (id_phieu, id_thiet_bi, id_nguoi_thuc_hien, scheduled_date, trang_thai, created_by, tao_luc) VALUES
(1, 1, 1, '2026-10-25', 'DANG_THUC_HIEN', 4, GETDATE()),
(3, 2, 1, '2026-10-26', 'DANG_THUC_HIEN', 4, GETDATE()),
(4, 3, 2, '2026-10-26', 'DANG_THUC_HIEN', 4, GETDATE()),
(8, 10, 1, '2026-10-20', 'HOAN_THANH', 4, GETDATE()),
(10, 12, 3, '2026-10-26', 'DANG_THUC_HIEN', 4, GETDATE());
GO

-- Lịch sử trạng thái mẫu
INSERT INTO lich_su_trang_thai_tb (id_thiet_bi, trang_thai_cu, trang_thai_moi, doi_boi, ly_do, doi_luc) VALUES
(2, 'HOAT_DONG', 'CHO_HIEU_CHUAN', N'hệ thống', N'Quá hạn hiệu chuẩn', '2026-08-01 08:00'),
(3, 'HOAT_DONG', 'DANG_SUA', N'vanna', N'Báo hỏng', '2026-10-18 08:15'),
(14, 'HOAT_DONG', 'CHO_HIEU_CHUAN', N'hệ thống', N'Quá hạn hiệu chuẩn', '2026-09-20 08:00');
GO

-- Thông báo mẫu
INSERT INTO thong_bao (id_nguoi_dung, type, message, link, is_read, tao_luc) VALUES
(4, 'PHIEU_MOI', N'Phiếu PM-2026-001 chờ phân công', '/phieu/PM-2026-001', 0, GETDATE()),
(4, 'THIET_BI_QUA_HAN', N'DEV-002 quá hạn hiệu chuẩn', '/thietbi/DEV-002', 0, GETDATE()),
(4, 'SU_CO_MOI', N'INC-2026-003 mới báo hỏng', '/suco/INC-2026-003', 1, GETDATE()),
(1, 'PHIEU_MOI', N'Bạn được phân công PM-2026-001', '/phieu/PM-2026-001', 0, GETDATE()),
(2, 'PHIEU_MOI', N'Bạn được phân công SC-2026-001', '/phieu/SC-2026-001', 0, GETDATE());
GO

