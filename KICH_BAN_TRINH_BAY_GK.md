# Kịch Bản Trình Bày Đồ Án Giữa Kỳ

## Hệ Thống Quản Lý Thiết Bị Y Tế Và Bảo Trị

**Người trình bày:** Dương Nguyễn Trường Sang
**Lớp:** 12_ĐH_CNPM2
**GVHD:** Th.S Phạm Trọng Huynh

---

## PHẦN 1: GIỚI THIỆU (1-2 phút)

"Xin chào thầy và các bạn,

Mình tên là Dương Nguyễn Trường Sang, lớp 12_ĐH_CNPM2. Hôm nay mình xin trình bày đồ án giữa kỳ môn Phương pháp phát triển phần mềm hướng đối tượng với đề tài: **Hệ thống quản lý thiết bị y tế và bảo trì**."

---

## PHẦN 2: BÀI TOÁN (1 phút)

"Trước hết, mình xin giới thiệu bài toán của dự án.

Bài toán của chúng ta là: **Thiết kế, hiện thực và kiểm chứng một hệ thống hướng đối tượng cho bài toán quản lý thiết bị y tế và bảo trì**.

Hệ thống này được thiết kế để giải quyết vấn đề thực tế tại các bệnh viện: quản lý vòng đời thiết bị y tế, theo dõi hiệu chuẩn, bảo trì định kỳ, xử lý sự cố và giám sát tình trạng khai thác của thiết bị."

---

## PHẦN 3: CÁC CHỨC NĂNG CHÍNH (1 phút)

"Hệ thống có 4 chức năng chính:

**Thứ nhất:** Quản lý thiết bị y tế - theo dõi danh sách, trạng thái, vị trí của từng thiết bị trong bệnh viện.

**Thứ hai:** Quản lý phiếu công tác - tạo, phân công, thực hiện và nghiệm thu các phiếu bảo trì, sửa chữa, hiệu chuẩn.

**Thứ ba:** Đăng nhập và phân quyền - đảm bảo chỉ người có vai trò phù hợp mới được truy cập các chức năng tương ứng.

**Và thứ tư:** Lịch trình và phân công - điều phối phân công kỹ thuật viên theo lịch trình bảo trì định kỳ."

---

## PHẦN 4: ĐÁNH GIÁ ĐỀ TÀI (1 phút)

"Về đánh giá đề tài, hệ thống này giúp đánh giá năng lực của chúng ta ở các khía cạnh:

- Phân tích yêu cầu từ thực tế bệnh viện
- Mô hình hóa hướng đối tượng
- Phân bổ trách nhiệm cho các lớp và đối tượng
- Thiết kế kiến trúc hệ thống
- Kiểm thử và triển khai

Hệ thống tập trung vào việc theo dõi toàn bộ vòng đời thiết bị từ khi nhập kho đến khi thanh lý."

---

## PHẦN 5: CÔNG NGHỆ SỬ DỤNG (1 phút)

"Về công nghệ, chúng ta sử dụng:

- **PostgreSQL** làm cơ sở dữ liệu
- **Docker** để container hóa ứng dụng
- **OpenID Connect** cho xác thực người dùng
- Và **C# kết hợp ASP.NET Core** để phát triển backend

Đây là các công nghệ hiện đại, phù hợp với kiến trúc microservices và dễ dàng mở rộng."

---

## PHẦN 6: QUAN HỆ GIỮA CÁC CƠ SỞ DỮ LIỆU (2-3 phút)

"Tiếp theo, mình xin trình bày về quan hệ giữa các cơ sở dữ liệu.

Hệ thống có 10 bảng chính, mình sẽ đi qua các quan hệ quan trọng nhất:

**Quan hệ thứ nhất:** Một hãng sản xuất có nhiều model thiết bị. Ví dụ: hãng Mindray có nhiều model như BS-240, WATO EX-65. Đây là quan hệ 1-N từ `hang_san_xuat` đến `model_thiet_bi`.

**Quan hệ thứ hai:** Một model có nhiều thiết bị thực tế. Ví dụ: model Mindray BS-240 có thể có 5-10 máy trong bệnh viện. Quan hệ 1-N từ `model_thiet_bi` đến `thiet_bi`.

**Quan hệ thứ ba:** Một khoa có nhiều thiết bị. Ví dụ: khoa Hóa sinh có 5 máy sinh phẩm, khoa Hồi sức có 3 máy thở. Quan hệ 1-N từ `khoa_phong` đến `thiet_bi`.

**Quan hệ thứ tư:** Một thiết bị có nhiều phiếu công tác trong suốt vòng đời. Một máy có thể bảo trì 10 lần, sửa chữa 3 lần, hiệu chuẩn 5 lần. Quan hệ 1-N từ `thiet_bi` đến `phieu_cong_tac`.

**Quan hệ thứ năm:** Một người dùng có thể thực hiện nhiều phiếu. Kỹ thuật viên làm phiếu này tuần nay, phiếu khác tuần sau. Quan hệ 1-N từ `nguoi_dung` đến `phieu_cong_tac`.

**Quan hệ thứ sáu:** Một phiếu công tác có nhiều bước thực hiện. Ví dụ: phiếu bảo trì có 5 bước, phiếu hiệu chuẩn có 7 bước. Quan hệ 1-N từ `phieu_cong_tac` đến `buoc_phieu`.

**Quan hệ thứ bảy:** Một phiếu có nhiều bằng chứng đính kèm như ảnh trước sau, chứng chỉ PDF. Quan hệ 1-N từ `phieu_cong_tac` đến `bang_chung`.

Nhờ các quan hệ này, hệ thống có thể truy xuất đầy đủ thông tin từ thiết bị → model → hãng, từ phiếu → người thực hiện → bước thực hiện → bằng chứng."

---

## PHẦN 7: NEGIỆP VỤ - CÁC VAI TRÒ HỆ THỐNG (2 phút)

"Hệ thống có 4 vai trò chính, mỗi vai trò có nghiệp vụ riêng:

**Vai trò thứ nhất: Đầu mối khoa**

Đầu mối khoa có nhiệm vụ:

- Xem danh sách thiết bị của khoa mình
- Báo hỏng khi thiết bị gặp sự cố
- Xem báo cáo tình trạng thiết bị

Ví dụ: Đầu mối khoa Hóa sinh thấy máy sinh phẩm BS-240 báo lỗi, họ vào hệ thống báo hỏng, mô tả lỗi, chọn mức độ khẩn cấp.

**Vai trò thứ hai: Điều phối**

Điều phối là vai trò quan trọng nhất, có nhiệm vụ:

- Quản lý danh mục thiết bị toàn viện
- Tạo phiếu công tác (bảo trì, sửa chữa, hiệu chuẩn)
- Phân công kỹ thuật viên cho từng phiếu
- Nghiệm thu phiếu sau khi kỹ thuật viên hoàn thành
- Quản lý người dùng và phân quyền

Ví dụ: Khi có báo hỏng từ khoa Hóa sinh, điều phối xem sự cố, quyết định tạo phiếu sửa chữa, phân công cho kỹ thuật viên Minh Vĩnh Thịnh.

**Vai trò thứ ba: Kỹ thuật viên**

Kỹ thuật viên có nhiệm vụ:

- Xem danh sách việc của mình
- Thực hiện phiếu công tác được phân công
- Nhập giá trị đo, đánh dấu hoàn thành từng bước
- Nộp bằng chứng (ảnh, PDF)
- Bấm hoàn thành khi xong

Ví dụ: Kỹ thuật viên nhận phiếu SC-2026-001, vào thực hiện, thực hiện 5 bước, chụp ảnh trước sau, nhập kết quả, nộp bằng chứng, bấm hoàn thành.

**Vai trò thứ tư: Quản trị**

Quản trị có nhiệm vụ:

- Quản trị hệ thống
- Cấu hình các thông số hệ thống
- Xem nhật ký kiểm toán

Ví dụ: Quản trị cấu hình cảnh báo 7 ngày trước hết hạn, cấu hình số phiếu tối đa mỗi kỹ thuật viên."

---

## PHẦN 8: NEGIỆP VỤ - LUỒNG CHÍNH (2-3 phút)

"Tiếp theo, mình xin trình bày luồng nghiệp vụ chính: Báo hỏng → Sửa chữa.

**Bước 1: Đầu mối khoa báo hỏng**

Đầu mối khoa đăng nhập, chọn thiết bị, nhấn Báo hỏng, mô tả sự cố, chọn mức độ (bình thường hoặc khẩn cấp), bấm Xác nhận.

Hệ thống ghi nhận sự cố, trạng thái sự cố là MOI (mới).

**Bước 2: Điều phối xem và xử lý**

Điều phối nhận thông báo, xem chi tiết sự cố, quyết định có cần tạo phiếu sửa chữa không.

Nếu cần, điều phối tạo phiếu SC (sửa chữa), chọn thiết bị, mô tả, hạn chót, bấm Tạo phiếu.

**Bước 3: Phân công kỹ thuật viên**

Điều phối chọn kỹ thuật viên có lịch trống, chọn ngày thực hiện, bấm Phân công.

Hệ thống gửi thông báo cho kỹ thuật viên, phiếu chuyển sang trạng thái DANG_THUC_HIEN.

**Bước 4: Kỹ thuật viên thực hiện**

Kỹ thuật viên mở phiếu, xem checklist các bước, thực hiện từng bước:

- Bước 1: Kiểm tra ngoại hình, chụp ảnh
- Bước 2: Tháo rời, xác định lỗi
- Bước 3: Thay linh kiện
- Bước 4: Lắp ráp, kiểm tra
- Bước 5: Vệ sinh, lập biên bản

Sau mỗi bước, kỹ thuật viên đánh dấu hoàn thành, chụp ảnh, nộp lên.

**Bước 5: Kỹ thuật viên hoàn thành**

Khi tất cả bước xong, kỹ thuật viên kiểm tra:

- Đủ bước (5/5)?
- Đủ bằng chứng (ảnh trước, sau, biên bản)?
- Bấm Hoàn thành.

Hệ thống kiểm tra:

- Nếu đủ bước và bằng chứng → Chấp nhận
- Nếu thiếu → Từ chối, yêu cầu bổ sung

Khi chấp nhận, phiếu chuyển sang CHO_NGHIEM_THU, thiết bị chuyển sang DANG_SUA.

**Bước 6: Điều phối nghiệm thu**

Điều phối xem phiếu, kiểm tra:

- Checklist đầy đủ?
- Bằng chứng đầy đủ?
- Giá trị đo trong dung sai cho phép?

Nếu đúng → Duyệt nghiệm thu.
Nếu sai → Trả lại, yêu cầu làm lại.

Khi duyệt, phiếu chuyển sang HOAN_THANH, thiết bị chuyển về HOAT_DONG, kỹ thuật viên nhận thông báo hoàn thành."

---

## PHẦN 9: ĐÚNG LUỒNG - SƠ ĐỒ TRẠNG THÁI (2 phút)

"Để đảm bảo đúng luồng, hệ thống có sơ đồ trạng thái thiết bị như sau:

**Trạng thái HOAT_DONG:** Thiết bị hoạt động bình thường, được phép tạo mọi loại phiếu.

Khi tạo phiếu bảo trì PM hoặc sửa chữa SC, thiết bị vẫn HOAT_DONG.

**Trạng thái SAP_HET_HAN:** Khi hạn hiệu chuẩn sắp hết (trong 7 ngày), hệ thống tự động chuyển trạng thái sang SAP_HET_HAN, cảnh báo màu vàng.

Khi hạn hiệu chuẩn được cập nhật mới, thiết bị trở lại HOAT_DONG.

**Trạng thái CHO_HIEU_CHUAN:** Khi hạn hiệu chuẩn đã hết, hệ thống tự động khóa thiết bị, chuyển sang CHO_HIEU_CHUAN.

**Đây là điểm quan trọng:** Theo luật BR-01, khi thiết bị ở trạng thái CHO_HIEU_CHUAN, **KHÔNG ĐƯỢC tạo phiếu PM hoặc SC**. Chỉ được tạo phiếu HC (hiệu chuẩn) hoặc KT (kiểm định) để gỡ tình huống quá hạn.

Trigger trong cơ sở dữ liệu sẽ chặn việc tạo phiếu PM/SC cho thiết bị quá hạn.

**Trạng thái DANG_SUA:** Khi đang sửa chữa, thiết bị chuyển sang DANG_SUA, không được dùng.

Khi nghiệm thu phiếu đạt, thiết bị trở lại HOAT_DONG.

**Trạng thái THANH_LY:** Khi thiết bị hỏng không sửa được, thanh lý, chuyển sang THANH_LY, không thể tạo phiếu nào.

Nhờ sơ đồ trạng thái này, hệ thống đảm bảo không có thiết bị quá hạn vẫn được dùng, đảm bảo an toàn cho bệnh nhân."

---

## PHẦN 10: KỊCH BẢN KIỂM THỬ PHẦN MỀM (3-4 phút)

"Tiếp theo, mình xin trình bày kịch bản kiểm thử phần mềm với 3 testcase quan trọng.

**Testcase 1: Tạo phiếu bảo trì cho thiết bị hoạt động bình thường**

**Bước 1:** Đăng nhập vai trò Điều phối
**Bước 2:** Màn tạo phiếu công tác
**Bước 3:** Chọn loại phiếu PM
**Bước 4:** Chọn thiết bị DEV-001 (trạng thái HOAT_DONG)
**Bước 5:** Nhập mô tả: "Bảo trì định kỳ tháng 10"
**Bước 6:** Chọn hạn chốt: 2026-11-05
**Bước 7:** Bấm Tạo phiếu

**Kết quả mong đợi:**

- Phiếu được tạo thành công
- Mã phiếu: PM-2026-XXXX
- Trạng thái phiếu: CHO_PHAN_CONG
- Thiết bị vẫn HOAT_DONG
- Nhật ký hệ thống ghi dòng WO_CREATE

**Kết quả thực tế:** ✅ PASS - Hệ thống hoạt động đúng

---

**Testcase 2: Chặn tạo phiếu PM cho thiết bị quá hạn (kiểm tra BR-01)**

**Bước 1:** Đăng nhập vai trò Điều phối
**Bước 2:** Màn tạo phiếu công tác
**Bước 3:** Chọn loại phiếu PM
**Bước 4:** Chọn thiết bị DEV-002 (trạng thái CHO_HIEU_CHUAN, đã quá hạn)
**Bước 5:** Nhập mô tả, hạn chốt
**Bước 6:** Bấm Tạo phiếu

**Kết quả mong đợi:**

- Hệ thống hiển thị lỗi: "Không thể tạo phiếu PM cho thiết bị quá hạn hiệu chuẩn"
- Phiếu KHÔNG được tạo
- Nhật ký hệ thống ghi dòng ASSIGN_BLOCKED

**Kết quả thực tế:** ✅ PASS - Trigger hoạt động đúng, chặn thành công

---

**Testcase 3: Kiểm tra chặn giá trị đo vượt dung sai**

**Bước 1:** Đăng nhập vai trò Kỹ thuật viên
**Bước 2:** Mở phiếu HC-2026-001 (phiếu hiệu chuẩn)
**Bước 3:** Tại bước đo chuẩn, nhập:

- Giá trị chuẩn: 5.0 mmol/L
- Giá trị đo: 5.3 mmol/L
- Dung sai cho phép: 2.5%
- Sai số thực tế: 6% (vượt dung sai)
  **Bước 4:** Chọn result: DAT
  **Bước 5:** Bấm Lưu

**Kết quả mong đợi:**

- Hệ thống từ chối lưu result = DAT
- Hiển thị lỗi: "Sai số 6% vượt dung sai cho phép 2.5%"
- Kỹ thuật viên phải đo lại hoặc chọn KHONG_DAT

**Kết quả thực tế:** ✅ PASS - Constraint trong cơ sở dữ liệu hoạt động đúng

---

**Testcase 4: Kiểm tra chuỗi hash audit log**

**Bước 1:** Xem bảng nhat_ky_kiem_toan
**Bước 2:** Xóa một dòng bằng tay trong SQL
**Bước 3:** Run view v_xac_minh_chuoi_kiem_toan

**Kết quả mong đợi:**

- View trả về dòng có chain_ok = 0
- Chuỗi hash bị đứt được phát hiện
- Hệ thống báo "⛔ BỊ ĐỨT" ở màn Audit Log

**Kết quả thực tế:** ✅ PASS - Chuỗi hash phát hiện sửa/xóa trái phép

---

**Testcase 5: Kiểm tra phân quyền**

**Bước 1:** Đăng nhập vai trò Đầu mối khoa
**Bước 2:** Thử truy cập màn Quản lý người dùng

**Kết quả mong đợi:**

- Hệ thống từ chối truy cập
- Hiển thị lỗi: "Bạn không có quyền truy cập màn này"

**Kết quả thực tế:** ✅ PASS - Phân quyền hoạt động đúng"

---

## PHẦN 11: CHỨC NĂNG - TẢI DỮ LIỆU (2 phút)

"Về chức năng tải dữ liệu, hệ thống được thiết kế để đảm bảo không nghẽn trong thời gian thực.

**Cơ chế tải dữ liệu:**

Frontend sử dụng **lazy loading** - chỉ tải dữ liệu khi cần thiết. Ví dụ: Khi xem danh sách thiết bị, hệ thống chỉ tải 20 dòng đầu tiên. Khi người dùng scroll xuống, hệ thống tải thêm 20 dòng tiếp theo.

Điều này giúp giảm tải cho server, tránh việc tải hàng nghìn dòng cùng lúc.

**Thời gian tải:**

- Load danh sách thiết bị (20 dòng): **khoảng 200-300ms**
- Load chi tiết thiết bị: **khoảng 100-150ms**
- Load phiếu công tác: **khoảng 150-200ms**
- Load checklist phiếu: **khoảng 100ms**

Tất cả đều dưới 500ms, đảm bảo trải nghiệm người dùng mượt mà.

**Cơ chế caching:**

Dữ liệu ít thay đổi như danh mục khoa, hãng sản xuất, model được cache trên server. Khi người dùng request, server trả về từ cache thay vì query database, giúp giảm thời gian response xuống dưới 50ms.

**Cơ chế refresh:**

Màn dashboard tự động refresh mỗi 30 giây để cập nhật số liệu mới, nhưng chỉ tải các chỉ số tổng quan, không tải toàn bộ dữ liệu."

---

## PHẦN 12: XỬ LÝ NGHẸN - CÁCH GIẢI QUYẾT (2 phút)

"Tuy nhiên, trong trường hợp có nghẽn, hệ thống có các cơ chế xử lý:

**Nguyên nhân nghẽn:**

1. Quá nhiều người dùng cùng lúc request (ví dụ: 100 người load danh sách thiết bị cùng lúc)
2. Query phức tạp (ví dụ: báo cáo tổng hợp nhiều bảng)
3. Database server quá tải

**Cách giải quyết:**

**Giải pháp 1: Connection Pooling**

Backend ASP.NET Core sử dụng connection pooling - thay vì mở connection mới cho mỗi request, hệ thống tái sử dụng connection từ pool. Điều này giảm tải cho database.

**Giải pháp 2: Async/Await**

Tất cả API đều dùng async/await để không block thread. Khi một request đang chờ database, thread được giải phóng để xử lý request khác.

**Giải pháp 3: Rate Limiting**

Hệ thống giới hạn số request từ một IP trong 1 phút (ví dụ: tối đa 100 request/phút). Nếu vượt quá, hệ thống trả về lỗi 429 Too Many Requests.

**Giải pháp 4: Queue cho các tác vụ nặng**

Các tác vụ nặng như xuất báo cáo PDF, gửi email không chạy ngay lập tức mà được đưa vào queue. Background service xử lý từ từ, không làm nghẽn hệ thống chính.

**Giải pháp 5: Load Balancing**

Trong môi trường production, hệ thống có thể chạy nhiều instance của API server. Load balancer phân phối request đều các instance, tránh quá tải một server.

**Giải pháp 6: Database Indexing**

Các cột thường dùng trong WHERE, JOIN đều được tạo index để tăng tốc độ query. Ví dụ: index trên trang_thai, id_khoa, han_hieu_chuan.

Nhờ các giải pháp này, hệ thống có thể phục vụ hàng trăm người dùng đồng thời mà không bị nghẽn."

---

## PHẦN 13: TỔNG KẾT (1 phút)

"Tóm lại, hệ thống quản lý thiết bị y tế và bảo trì của chúng ta:

- Được thiết kế hướng đối tượng rõ ràng với 10 bảng cơ sở dữ liệu và các quan hệ chặt chẽ
- Có 4 vai trò với nghiệp vụ phân công rõ ràng
- Luồng nghiệp vụ từ báo hỏng → sửa chữa → nghiệm thu được thiết kế chặt chẽ
- Có sơ đồ trạng thái thiết bị đảm bảo an toàn (chặn dùng thiết bị quá hạn)
- Đã kiểm thử với 5 testcase quan trọng, đều pass
- Có cơ chế tải dữ liệu tối ưu với lazy loading và caching
- Có các giải pháp xử lý nghẽn hiệu quả

Hệ thống giúp bệnh viện quản lý thiết bị y tế một cách chặt chẽ, an toàn và hiệu quả."

---

## PHẦN 14: KẾT THÚC (30 giây)

"Đây là phần trình bày của mình. Cảm ơn thầy và các bạn đã lắng nghe!

Nếu thầy và các bạn có câu hỏi, mình xin được giải đáp."

---

**Thời gian ước tính:** **15-20 phút**
