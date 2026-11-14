# Đồ Án Giữa Kỳ

## Đề Tài: HLT-08 Phương Pháp Phát Triển Phần Mềm Hướng Đối Tượng

**Hệ Thống Quản Lý Thiết Bị Y Tế Và Bảo Trì**

**Họ và Tên:** Dương Nguyễn Trường Sang
**Lớp:** 12_ĐH_CNPM2
**GVHD:** Th.S Phạm Trọng Huynh

---

# Giới Thiệu Đề Tài

## 01. Bài Toán

Thiết kế, hiện thực và kiểm chứng một hệ thống hướng đối tượng cho bài toán **"hệ thống quản lý thiết bị y tế và bảo trì"**

---

## 02. Đánh Giá Đề Tài

Hệ thống theo dõi vòng đời, hiệu chuẩn, bảo trì, sự cố và tình trạng khai thác. Đánh giá năng lực:

- Phân tích yêu cầu
- Mô hình hóa
- Phân bổ trách nhiệm cho lớp/đối tượng
- Thiết kế kiến trúc
- Kiểm thử và triển khai

---

## 03. Các Chức Năng Chính

- ✅ Quản lý thiết bị y tế
- ✅ Quản lý phiếu công tác
- ✅ Đăng nhập & phân quyền
- ✅ Lịch trình & phân công

---

## 04. Công Nghệ Sử Dụng

- 🗄️ **PostgreSQL** - Cơ sở dữ liệu
- 🐳 **Docker** - Container hóa
- 🔐 **OpenID Connect** - Xác thực
- 💻 **C# + ASP.NET Core** - Backend

---

# Use Case: Tổng Quát

## 4 Vị Trí Chủ Chốt Trong Hệ Thống

### 1. Đầu Mối Khoa

- Xem danh sách thiết bị khoa
- Báo hỏng thiết bị
- Xem báo cáo

### 2. Điều Phối

- Quản lý danh mục thiết bị
- Tạo phiếu công tác
- Phân công kỹ thuật viên
- Nghiệm thu phiếu
- Quản lý người dùng

### 3. Kỹ Thuật Viên

- Xem việc của mình
- Thực hiện phiếu công tác
- Nộp bằng chứng

### 4. Quản Trị

- Quản trị hệ thống

---

## 3 Chức Năng Chính

### 1. Phiếu Công Tác

- Tạo phiếu công tác
- Phân công phiếu cho thiết bị
- Chặn hạn hiệu chuẩn (BR-01)

### 2. Quản Lý Thiết Bị

- Xem danh sách thiết bị
- Xem chi tiết thiết bị
- Báo hỏng thiết bị

### 3. Quản Trị

- Quản lý người dùng
- Cấu hình hệ thống

---

# Sequence Diagram - Luồng Chính: Báo Hỏng → Sửa Chữa

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Đầu Mối Khoa │    │  Điều Phối   │    │ Kỹ Thuật Viên│
└──────┬───────┘    └──────┬───────┘    └──────┬───────┘
       │                   │                   │
       │ Báo hỏng thiết bị  │                   │
       │──────────────────>│                   │
       │                   │                   │
       │                   │ Lưu sự cố, giữ trạng thái │
       │                   │                   │
       │                   │                   │
       │                   │ Nhận thông báo   │
       │                   │──────────────────>│
       │                   │                   │
       │                   │                   │ Tạo phiếu sửa chữa
       │                   │<──────────────────│
       │                   │                   │
       │                   │ Phân công kỹ thuật viên │
       │                   │──────────────────>│
       │                   │                   │
       │                   │                   │ Thực hiện phiếu, nộp bằng chứng
       │                   │<──────────────────│
       │                   │                   │
       │                   │ Kiểm tra:         │
       │                   │ - Đủ checklist    │
       │                   │ - Đủ bằng chứng   │
       │                   │ - Giá trị đo trong dung sai
       │                   │                   │
       │                   │ Duyệt nghiệm thu  │
       │                   │──────────────────>│
       │                   │                   │
       │                   │                   │ Mở khóa thiết bị
       │                   │                   │
       │                   │ Thông báo hoàn thành
       │                   │──────────────────>│
       │                   │                   │
```

---

# Activity Diagram - Báo Hỏng Thiết Bị

## Bước 1/3 - Chọn Thiết Bị

```
┌─────────────────────────────┐
│         Báo Hỏng            │
└──────────┬──────────────────┘
           │
           ▼
┌─────────────────────────────┐
│   Tìm thiết bị...          │
│                             │
│ • Mindray BS-240 - SN-12345 │
│   DANG HOAT DONG            │
│                             │
│ • Mindray BS-240 - SN-12346 │
│   CHO HIEU CHUAN           │
│                             │
│ • Eppendorf 5430 R - SN-20034│
│   DANG SUA                  │
└──────────┬──────────────────┘
           │
           ▼ Chọn thiết bị
```

---

## Bước 2/3 - Mô Tả Sự Cố

```
┌─────────────────────────────┐
│ Mindray BS-240 - SN-12345   │
│ Mô tả sự cố:               │
│ ___________________        │
│                          │
│ ☑ Bình thường              │
│ ☐ Khẩn cấp                │
│                          │
│ [Cancel]      [Tiếp tục] │
└──────────┬──────────────────┘
           │
           ▼ Tiếp tục
```

---

## Bước 3/3 - Xác Nhận

```
┌─────────────────────────────┐
│ Mindray BS-240             │
│ SN-12345 - Hóa sinh        │
│ "khét"                     │
│ Mức độ: KHAN               │
│                             │
│ [ Quay lại ]  [ Xác nhận ] │
└──────────┬──────────────────┘
           │
           ▼ Xác nhận
       ┌───┴───┐
       │  Gửi  │
       └───────┘
```

---

# Sơ Đồ Trạng Thái Thiết Bị

```
        ┌──────────────┐
        │  HOAT_DONG   │
        │ Hoạt động    │
        └──────┬───────┘
               │
               │ Tạo phiếu PM/SC
               │ Han HC sắp hết / Cập nhật HC mới
               ▼
        ┌──────────────┐
        │ SAP_HET_HAN  │
        │ Sắp hết hạn  │
        └──────┬───────┘
               │
               │ (BR-01: Han HC đã hết khóa)
               │ Hoàn thành phiếu HC/KT
               ▼
    ┌──────────┴──────────┐
    │                     │
    ▼                     ▼
┌──────────────┐   ┌──────────────┐
│ DANG_SUA     │   │ CHO_HIEU_CHUAN│
│ Đang sửa     │   │ Chờ hiệu chuẩn│
└──────┬───────┘   └──────┬───────┘
       │                   │
       │ Nghiệm thu DAT    │ Tạo HC/KT (BR-01)
       │ Mở khóa           │ Chỉ được tạo HC/KT
       ▼                   ▼
┌──────────────┐   ┌──────────────┐
│ HOAT_DONG    │   │ HOAT_DONG    │
└──────────────┘   └──────────────┘
```

**Chú thích:**

- **HOAT_DONG:** Thiết bị hoạt động bình thường
- **SAP_HET_HAN:** Sắp hết hạn hiệu chuẩn
- **CHO_HIEU_CHUAN:** Đã quá hạn, bị khóa, chỉ tạo được phiếu HC/KT
- **DANG_SUA:** Đang sửa chữa
- **THANH_LY:** Thanh lý thiết bị

---

# Sơ Đồ Tiếp Nhận Phiếu

```
┌─────────────────────────────────────────┐
│      Mở phiếu được giao                │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│   Xem chi tiết thiết bị và checklist   │
│   25 bước?                             │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│   Nhập giá trị đo / Danh dấu hoàn thành │
│   Nộp bằng chứng (ảnh, PDF)             │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│   Bấm nút Hoàn thành                   │
└──────────┬──────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────┐
│   Đủ bước và bằng chứng?               │
│   ┌─────┐  ┌─────┐                    │
│   │  N  │  │  Y  │                    │
│   └──┬──┘  └──┬──┘                    │
└──────┬───────┬──────────────────────────┘
       │       │
       │       ▼ YES
       │   ┌─────────────────────────────────┐
       │   │ Hệ thống tự động chấp nhận        │
       │   │ Phieu chuyển CHO_NGHIEM_THU     │
       │   │ Thiết bị chuyển DANG_SUA        │
       │   │ Ghi nhật ký kiểm toán            │
       │   └─────────────────────────────────┘
       │
       ▼ NO
┌─────────────────────────────────────────┐
│   Hệ thống từ chối                    │
└─────────────────────────────────────────┘
```

---

# Form Tạo Phiếu Công Tác

```
┌─────────────────────────────────────────┐
│      Tạo Phiếu Công Tác                │
├─────────────────────────────────────────┤
│                                         │
│  Loại phiếu:                            │
│  ○ PM - Bảo trì kỳ                     │
│  ○ SC - Sửa chữa                        │
│  ○ HC - Hiệu chuẩn                      │
│  ○ KT - Kiểm định                       │
│                                         │
│  Thiết bị: [ Chọn thiết bị ▼ ]          │
│                                         │
│  Người thực hiện: [ Chọn kỹ thuật viên ▼]│
│                                         │
│  Ưu tiên:                               │
│  ○ Bình thường                          │
│  ○ Khẩn cấp                             │
│                                         │
│  Hạn chốt:   __/__/______                │
│                                         │
│            [ Hủy ]    [ Tạo Phiếu ]     │
│                                         │
└─────────────────────────────────────────┘
```

---

# Menu Dropdown - Danh Sọc Thiết Bị

```
┌──────────────────────────────┐
│   Danh sách thiết bị          │
├──────────────────────────────┤
│ • DEV-001 - Mindray BS-240   │
│ • DEV-002 - Mindray BS-240   │
│ • DEV-003 - Sysmex XN-1000   │
│ • DEV-004 - Hamilton G5       │
│ • DEV-005 - GE LOGIQ E9       │
│ • DEV-006 - Philips Monitor   │
│ • ...                         │
└──────────────────────────────┘
```

---

# ERD - Cơ Sở Dữ Liệu QLTBYT

## 10 Thực Thể Chính

```
┌─────────────────┐
│ hang_san_xuat   │
│ - id_hang (PK)  │
│ - ten           │
│ - quoc_gia      │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│ model_thiet_bi  │
│ - id_model (PK) │
│ - ten           │
│ - id_hang (FK)  │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│   thiet_bi      │
│ - id_thiet_bi   │
│   (PK)          │
│ - ma            │
│ - id_model (FK) │
│ - id_khoa (FK)  │
│ - trang_thai    │
│ - han_hieu_chuan│
│ - ngay_nhap     │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│ phieu_cong_tac  │
│ - id_phieu (PK) │
│ - ma            │
│ - id_thiet_bi   │
│   (FK)          │
│ - trang_thai    │
│ - progress      │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│   buoc_phieu    │
│ - id_buoc (PK)   │
│ - id_phieu (FK) │
│ - thu_tu        │
│ - gia_tri_chuan │
│ - gia_tri_do    │
│ - result        │
└─────────────────┘

┌─────────────────┐     ┌─────────────────┐
│   khoa_phong    │     │  nha_cung_cap   │
│ - id_khoa (PK)  │     │ - id_ncc (PK)    │
│ - ten           │     │ - ten            │
│ - la_lam_sang   │     └─────────────────┘
└─────────────────┘

┌─────────────────┐
│   nguoi_dung    │
│ - id_nguoi_dung │
│   (PK)          │
│ - ten_dang_nhap │
│ - vai_tro       │
│ - id_khoa (FK)  │
└────────┬────────┘
         │
         │ 1:N
         ▼
┌─────────────────┐
│ phieu_cong_tac  │
│ - id_nguoi_thuc │
│   _hien (FK)    │
└─────────────────┘

┌─────────────────┐
│  bang_chung     │
│ - id_bang_chung │
│   (PK)          │
│ - id_phieu (FK) │
│ - ma_bang_chung │
│ - ten_tep       │
└─────────────────┘
```

## Mối Quan Hệ Giữa Các Bảng

| Bảng A           | Bảng B           | Loại Quan Hệ | Mô Tả                         |
| ---------------- | ---------------- | ------------ | ----------------------------- |
| `hang_san_xuat`  | `model_thiet_bi` | 1:N          | Một hãng có nhiều model       |
| `model_thiet_bi` | `thiet_bi`       | 1:N          | Một model có nhiều thiết bị   |
| `khoa_phong`     | `thiet_bi`       | 1:N          | Một khoa có nhiều thiết bị    |
| `khoa_phong`     | `nguoi_dung`     | 1:N          | Một khoa có nhiều người dùng  |
| `thiet_bi`       | `phieu_cong_tac` | 1:N          | Một thiết bị có nhiều phiếu   |
| `nguoi_dung`     | `phieu_cong_tac` | 1:N          | Một người làm nhiều phiếu     |
| `phieu_cong_tac` | `buoc_phieu`     | 1:N          | Một phiếu có nhiều bước       |
| `phieu_cong_tac` | `bang_chung`     | 1:N          | Một phiếu có nhiều bằng chứng |

---

# Cơ Sở Dữ Liệu Của Hệ Thống

## Bảng Chi Tiết

### 1. khoa_phong

Lưu thông tin các khoa/phòng trong bệnh viện

- `id_khoa` - Khóa chính
- `ten` - Tên khoa
- `la_lam_sang` - Là lâm sàng hay phòng chức năng
- `dia_chi` - Địa chỉ
- `dien_thoai` - Số điện thoại

### 2. hang_san_xuat

Lưu thông tin hãng sản xuất thiết bị

- `id_hang` - Khóa chính
- `ten` - Tên hãng
- `quoc_gia` - Quốc gia
- `website` - Website

### 3. nha_cung_cap

Lưu thông tin nhà cung cấp/bảo hành

- `id_ncc` - Khóa chính
- `ten` - Tên nhà cung cấp
- `nguoi_lien_he` - Người liên hệ
- `dien_thoai` - Số điện thoại
- `so_hop_dong` - Số hợp đồng

### 4. model_thiet_bi

Lưu thông tin model thiết bị

- `id_model` - Khóa chính
- `ten` - Tên model
- `id_hang` - Khóa ngoại → hang_san_xuat
- `loai` - Loại thiết bị
- `chu_ky_pm_ngay` - Chu kỳ bảo trì (ngày)
- `chu_ky_hc_ngay` - Chu kỳ hiệu chuẩn (ngày)
- `dung_sai_hc_phan_tram` - Dung sai hiệu chuẩn (%)

### 5. thiet_bi

Lưu thông tin thiết bị thực tế

- `id_thiet_bi` - Khóa chính
- `ma` - Mã thiết bị (QR code)
- `ten` - Tên thiết bị
- `id_model` - Khóa ngoại → model_thiet_bi
- `serial` - Số serial
- `id_khoa` - Khóa ngoại → khoa_phong
- `trang_thai` - Trạng thái (HOAT_DONG, SAP_HAN, CHO_HIEU_CHUAN, DANG_SUA, THANH_LY)
- `han_hieu_chuan` - Hạn hiệu chuẩn
- `pm_ke_tiep` - Ngày bảo trì kế tiếp
- `ngay_nhap` - Ngày nhập
- `thang_bao_hanh` - Tháng bảo hành
- `gia_mua` - Giá mua
- `id_ncc_bao_tri` - Khóa ngoại → nha_cung_cap

### 6. nguoi_dung

Lưu thông tin người dùng

- `id_nguoi_dung` - Khóa chính
- `ten_dang_nhap` - Tên đăng nhập
- `ho_ten` - Họ tên
- `email` - Email
- `vai_tro` - Vai trò (ADMIN, DIEU_PHOI, KY_THUAT_VIEN, DAU_MOI_KHOA)
- `id_khoa` - Khóa ngoại → khoa_phong
- `hoat_dong` - Đang hoạt động

### 7. phieu_cong_tac

Lưu thông tin phiếu công tác

- `id_phieu` - Khóa chính
- `ma` - Mã phiếu
- `loai_phieu` - Loại (PM, SC, HC, KT)
- `id_thiet_bi` - Khóa ngoại → thiet_bi
- `id_khoa` - Khóa ngoại → khoa_phong
- `id_nguoi_thuc_hien` - Khóa ngoại → nguoi_dung
- `trang_thai` - Trạng thái (CHO_PHAN_CONG, DANG_THUC_HIEN, CHO_NGHIEM_THU, HOAN_THANH, TRA_LAI)
- `uu_tien` - Ưu tiên (BINH_THUONG, KHAN)
- `han_chot` - Hạn chót
- `progress` - Tiến độ (0-100)
- `hoan_thanh_luc` - Thời điểm hoàn thành
- `nghiem_thu_luc` - Thời điểm nghiệm thu

### 8. buoc_phieu

Lưu checklist từng bước của phiếu

- `id_buoc` - Khóa chính
- `id_phieu` - Khóa ngoại → phieu_cong_tac
- `thu_tu` - Thứ tự bước
- `tieu_de` - Tiêu đề bước
- `require_photo` - Bắt buộc chụp ảnh
- `gia_tri_chuan` - Giá trị chuẩn
- `gia_tri_do` - Giá trị đo
- `dung_sai_phan_tram` - Dung sai (%)
- `result` - Kết quả (DAT, KHONG_DAT)
- `hoan_thanh` - Đã hoàn thành

### 9. bang_chung

Lưu bằng chứng (file đính kèm)

- `id_bang_chung` - Khóa chính
- `id_phieu` - Khóa ngoại → phieu_cong_tac
- `ma_bang_chung` - Mã loại bằng chứng
- `ten_tep` - Tên file
- `duong_dan_tep` - Đường dẫn
- `ma_bam` - Hash file (SHA-256)
- `file_size_kb` - Kích thước (KB)
- `tai_boi` - Người tải
- `tai_luc` - Thời điểm tải

---

# Cảm Ơn

**Cảm ơn thầy và các bạn đã lắng nghe!**

---

**Dương Nguyễn Trường Sang**  
**12_ĐH_CNPM2**  
**GVHD: Th.S Phạm Trọng Huynh**
