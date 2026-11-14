# Thuyết Trình 10 Phút - Hệ Thống Quản Lý Thiết Bị Y Tế

**Người trình bày:** Dương Nguyễn Trường Sang
**Lớp:** 12_ĐH_CNPM2

---

## Slide 1: Use Case Tổng Quát

### 4 Vị Trí Chủ Chốt Trong Hệ Thống

1. **Đầu mối khoa** - Báo hỏng thiết bị, xem danh sách thiết bị khoa
2. **Điều phối** - Tạo phiếu, phân công kỹ thuật viên, nghiệm thu
3. **Kỹ thuật viên** - Thực hiện phiếu, nộp bằng chứng
4. **Quản trị** - Quản trị hệ thống, cấu hình

### 3 Chức Năng Chính

1. **Quản lý thiết bị** - Theo dõi danh sách, trạng thái thiết bị
2. **Phiếu công tác** - Tạo, phân công, thực hiện, nghiệm thu phiếu
3. **Quản trị hệ thống** - Quản lý người dùng, cấu hình thông số

**Điểm nhấn:** Chặn phản hồi cho thiết bị (BR-01) - Không cho phép tạo phiếu PM/SC khi thiết bị quá hạn hiệu chuẩn

---

## Slide 2: Sơ Đồ Hoạt Động - Báo Hỏng → Sửa Chữa

### Quy Trình Chính

1. **Đầu mối khoa** báo hỏng thiết bị
2. **Hệ thống** lưu sự cố, gửi thông báo
3. **Điều phối** xem sự cố, tạo phiếu sửa chữa
4. **Hệ thống** phân công kỹ thuật viên
5. **Kỹ thuật viên** nhận phiếu, thực hiện, nộp bằng chứng
6. **Hệ thống** kiểm tra điều kiện:
   - Đủ checklist?
   - Đủ bằng chứng?
   - Giá trị đo trong dung sai?
7. Nếu đủ → Chuyển nghiệm thu → Duyệt → Mở khóa thiết bị
8. Nếu thiếu → Từ chối, yêu cầu bổ sung

### Quy Trình Báo Sự Cố (3 Bước)

**Bước 1:** Chọn thiết bị hỏng (ví dụ: Mindray BS-240 SN-12345)

**Bước 2:** Mô tả sự cố (ví dụ: "khét") + Chọn mức độ (Sơ bộ/Khẩn)

**Bước 3:** Xác nhận thông tin → Gửi báo sự cố

---

## Slide 3: Sơ Đồ Trạng Thái Thiết Bị

### Các Trạng Thái Chính

| Trạng Thái         | Mô Tả                           | Chức Năng                                                |
| ------------------ | ------------------------------- | -------------------------------------------------------- |
| **HOAT_DONG**      | Vận hành bình thường            | Tạo được phiếu PM/SC                                     |
| **SAP_HET_HAN**    | Hạn hiệu chuẩn sắp hết (7 ngày) | Cảnh báo vàng                                            |
| **CHO_HIEU_CHUAN** | Đã quá hạn hiệu chuẩn           | **Bị khóa, không tạo được PM/SC, chỉ tạo HC/KT (BR-01)** |
| **DANG_SUA**       | Đang sửa chữa                   | Vẫn bị khóa, với khi nghiệm thu ĐẠT                      |
| **THANH_LY**       | Thanh lý                        | Không tạo được phiếu nào                                 |

### Luồng Chuyển Trạng Thái

```
HOAT_DONG → Tạo phiếu SC/PM → DANG_SUA → Nghiệm thu ĐẠT → HOAT_DONG
HOAT_DONG → Hạn HC hết → CHO_HIEU_CHUAN → Tạo HC/KT → Nghiệm thu ĐẠT → HOAT_DONG
```

**Điểm nhấn BR-01:** Khi thiết bị quá hạn, chỉ được tạo phiếu Hiệu chuẩn (HC) hoặc Kiểm định (KT) để gỡ tình huống. Phiếu Bảo trì (PM) hoặc Sửa chữa (SC) bị chặn.

---

## Slide 4: Sơ Đồ Tiếp Nhận Phiếu

### Quy Trình Tiếp Nhận Phiếu

1. **Mở phiếu được giao**
2. **Xem chi tiết thiết bị và checklist**
3. **Nhập giá trị** hoặc **Đánh dấu hoàn thành** từng bước
4. **Nộp bằng chứng** (ảnh, PDF)
5. **Bấm nút Hoàn thành**
6. **Hệ thống kiểm tra:**
   - Nếu thiếu bước hoặc bằng chứng → Từ chối
   - Nếu đầy đủ → Phiếu chuyển CHO_NGHIEM_THU
7. **Thiết bị chuyển DANG_SUA**
8. **Ghi nhật ký kiểm toán**

### Form Tạo Phiếu Công Tác

- **Loại phiếu:** PM (Bảo trì định kỳ), SC (Sửa chữa), HC (Hiệu chuẩn), KT (Kiểm định)
- **Thiết bị:** Chọn từ dropdown
- **Người thực hiện:** Chọn kỹ thuật viên hoặc để "Chưa phân công"
- **Ưu tiên:** Thường hoặc Khẩn
- **Hạn hoàn thành:** Chọn ngày
- **Mô tả:** Nhập mô tả (tùy chọn)

---

## Slide 5: Cơ Sở Dữ Liệu Của Hệ Thống

### 10 Bảng Chính

1. **hang_san_xuat** - Hãng sản xuất (id, ten, quoc_gia)
2. **khoa_phong** - Khoa phòng (id, ten, la_lam_sang)
3. **nha_cung_cap** - Nhà cung cấp (id, ten, dien_thoai)
4. **model_thiet_bi** - Model thiết bị (id, ten, id_hang_sx, chu_ky_bv_ngay)
5. **nguoi_dung** - Người dùng (id, ten_dang_nhap, ho_ten, vai_tro)
6. **thiet_bi** - Thiết bị (id, ma, ten, id_model, id_khoa_phong, trang_thai, han_hieu_chuan)
7. **phieu** - Phiếu công tác (id, ma, loai_phieu, id_thiet_bi, trang_thai, progress)
8. **su_co** - Sự cố (id, ma, id_thiet_bi, priority, trang_thai, id_phieu)
9. **buoc** - Bước thực hiện (id, id_phieu, description, result, photo)
10. **lich_su_trang_thai_tb** - Lịch sử trạng thái thiết bị (id, id_thiet_bi, trang_thai_cu, trang_thai_moi)

### Quan Hệ Quan Trọng

- **hang_san_xuat** (1) → (N) **model_thiet_bi**
- **model_thiet_bi** (1) → (N) **thiet_bi**
- **khoa_phong** (1) → (N) **thiet_bi**
- **khoa_phong** (1) → (N) **nguoi_dung**
- **thiet_bi** (1) → (N) **phieu**
- **nguoi_dung** (1) → (N) **phieu**
- **phieu** (1) → (N) **buoc**
- **thiet_bi** (1) → (N) **su_co**

---

## Tổng Kết

Hệ thống quản lý thiết bị y tế được thiết kế với:

- 4 vai trò nghiệp vụ rõ ràng
- Luồng báo hỏng → sửa chữa chặt chẽ
- Sơ đồ trạng thái thiết bị đảm bảo an toàn (BR-01)
- Quy trình tiếp nhận phiếu có kiểm tra chặt chẽ
- Cơ sở dữ liệu 10 bảng với quan hệ hoàn chỉnh

---

**Cảm ơn thầy và các bạn đã lắng nghe!**
