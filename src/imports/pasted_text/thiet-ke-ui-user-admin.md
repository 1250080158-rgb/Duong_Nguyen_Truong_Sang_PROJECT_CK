THIẾT KẾ UI CHO USER VÀ ADMIN 0. Bốn nguyên tắc thiết kế (viết vào phần "Cơ sở thiết kế giao diện" của báo cáo)
Thiết kế theo vai trò, không theo bảng dữ liệu. Kỹ thuật viên cầm tablet đi sửa ở các khoa → màn hình của họ phải là mobile-first, nút to, ít chữ. Điều phối ngồi desktop nhiều cửa sổ → bảng dày, mật độ cao. Đầu mối khoa chỉ vào hệ thống vài lần/tuần → phải tự giải thích được trong 5 giây.
Trạng thái thiết bị là "ngôn ngữ màu" toàn hệ thống. Cùng một bộ badge màu ở mọi nơi (danh sách, chi tiết, phiếu, dashboard) — người dùng học một lần, dùng mọi nơi.
Mọi hành động chặn phải có lý do và lối thoát. Không bao giờ disable nút mà không giải thích; thông báo chặn phải kèm nút dẫn đến hành động đúng (VD: "Tạo phiếu hiệu chuẩn ngay").
Mỗi bước nghiệp vụ quan trọng là một điểm thu bằng chứng. Nút "Hoàn thành" khóa cho đến khi bằng chứng bắt buộc đã đủ — đây là cách UI bảo hiểm cho yêu cầu "lưu đầy đủ bằng chứng" của đề tài.

1. Sơ đồ màn hình tổng thể (screen map)

text
MED-EQUIP
├── 1. KHÔNG GIAN USER
│ ├── 1A. Đầu mối khoa: Trang chủ khoa · Tra cứu thiết bị · Chi tiết thiết bị
│ │ · Báo hỏng (3 bước) · Phiếu của khoa · Xác nhận bàn giao
│ ├── 1B. Kỹ thuật viên: Việc của tôi · Thực hiện phiếu (checklist + bằng chứng)
│ │ · Lịch cá nhân
│ └── 1C. Điều phối: Dashboard · Lịch bảo trì · Phân công (nơi xảy ra CHẶN)
│ · Nghiệm thu phiếu · Thiết bị (toàn viện) · Báo cáo
└── 2. KHÔNG GIAN ADMIN
├── Danh mục nền (hãng, model, loại, khoa, nhà cung cấp)
├── Người dùng & vai trò (đồng bộ Keycloak)
├── Cấu hình hệ thống (ngưỡng cảnh báo, chu kỳ PM mặc định)
├── Trình xem Audit Log (chỉ đọc)
└── Quản lý bằng chứng/lưu trữ file
Vai trò điều phối và admin tách riêng vì nguyên tắc phân cách nhiệm vụ (separation of duties): admin quản trị hệ thống, điều phối vận hành nghiệp vụ — admin không được sửa dữ liệu nghiệp vụ, và chính admin cũng không xem được… không, xem được nhưng không sửa/xóa được audit log. Điểm này ghi vào báo cáo phần bảo mật.

2. KHÔNG GIAN USER
   2.1. Đầu mối khoa phòng (đăng nhập bằng tài khoản OIDC thường)
   Màn 1 — Trang chủ khoa: tóm tắt thiết bị khoa theo badge + số phiếu đang mở. Danh sách thiết bị là màn hình chính:

text
┌─────────────────────────────────────────────────────────┐
│ Khoa Hóa sinh – Diễn giải [Thông báo (2)] A.Vân ▾│
├─────────────────────────────────────────────────────────┤
│ Thiết bị khoa (14) [🔍 Tìm tên / serial / QR] │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ ● Máy sinh phẩm BS-240 · SN 12345 [ĐANG HOẠT ĐỘNG]│ │
│ │ HC còn hạn: 128 ngày │ │
│ │ ● Máy sinh phẩm BS-240 · SN 12346 [CHỜ HIỆU CHUẨN]🔴│
│ │ Quá hạn 23 ngày – không thể phân công sử dụng │ │
│ │ ● Máy huyết học XN-1000 · SN 00912 [ĐANG SỬA CHỮA]│ │
│ │ Phiếu #SC-2026-0102 · dự kiến trả 26/09 │ │
│ └─────────────────────────────────────────────────────┘ │
│ [ ⊕ BÁO HỎNG ] ← nút lớn, cố định, một chạm │
└─────────────────────────────────────────────────────────┘
Chi tiết đáng chú ý: dòng hiệu chuẩn hiển thị số ngày còn lại (đếm ngược), không hiển thị ngày khô khan — người dùng科 không nhớ "01/08 là gần hay xa". Thiết bị quá hạn hiển thị luôn hệ quả ("không thể phân công sử dụng") để đầu mối khoa hiểu vì sao nó bị khóa mà không phải gọi điện hỏi.

Màn 2 — Báo hỏng (wizard 3 bước, hoàn thành dưới 60 giây):

text
Bước 1/3 – Chọn thiết bị Bước 2/3 – Mô tả Bước 3/3 – Xác nhận
┌────────────────────────┐ ┌────────────────────────┐ ┌────────────────────┐
│ [🔍 Tìm… ] [IXEL QR] │ │ Mô tả hỏng hóc: │ │ ┌─ BS-240 SN12345 ─┐│
│ ● BS-240 · SN 12345 │ │ "Máy không khởi động, │ │ │ Ảnh (2) ✓ ││
│ ● BS-240 · SN 12346 🔴 │ │ màn hình đen" │ │ │ Mức độ: KHẨN ││
│ (chọn được – báo hỏng│ │ Mức độ: ○Sơ bộ ●Khẩn │ │ └──────────────────┘│
│ là quyền riêng, không│ │ [📷 Chụp ảnh hiện trường]│ │ [GỬI BÁO HỎNG] ││
│ bị chặn bởi hiệu chuẩn)│ │ │ │ → mã phiếu hiển thị│
└────────────────────────┘ └────────────────────────┘ └────────────────────┘
Lưu ý nghiệp vụ hiển thị ở wireframe: thiết bị đã khóa chờ hiệu chuẩn vẫn được báo hỏng — báo hỏng là quyền của mọi người với mọi thiết bị; luật chặn chỉ áp cho phân công khai thác. Nếu bạn chặn cả báo hỏng là hiểu sai nghiệp vụ (điểm giảng viên sẽ hỏi).

Màn 3 — Chi tiết thiết bị ("bảng chân dung thiết bị"): nơi tập trung mọi bằng chứng hiển thị cho user. Gồm 3 khối: (a) thông tin định danh + bảo hành + hợp đồng bảo trì; (b) hạn hiệu chuẩn hiện hành với thanh tiến trình thời gian còn lại; (c) timeline dọc toàn bộ lịch sử — mỗi sự kiện (nhập kho, lần PM, lần hiệu chuẩn, sự cố, đổi khoa) là một node, bấm mở ra xem bằng chứng đính kèm.

text
┌───────────────────────────────────────────────────────────┐
│ Máy sinh phẩm BS-240 · SN 12346 [CHỜ HIỆU CHUẨN] 🔴 │
│ Model: Mindray BS-240 · Nhập 15/03/2022 · Khoa HSDT │
│ Bảo hành: 24 tháng (còn 5 tháng) · HĐ bảo trì: Dräger VN │
│ Hiệu chuẩn: hết hạn 01/08/2026 ── QUÁ HẠN 23 NGÀY ── │
├───────────────────────────────────────────────────────────┤
│ LỊCH SỬ [Tải hồ sơ PDF ⤓] │
│ ● 01/08/2026 Hết hạn hiệu chuẩn – tự động khóa [log] │
│ ● 12/02/2026 Hiệu chuẩn định kỳ – ĐẠT [📄 chứng chỉ]│
│ ● 05/01/2026 PM định kỳ – hoàn thành [📷 3 ảnh]│
│ ● 20/09/2025 Sự cố: lỗi bơm mẫu – đã sửa [phiếu #0355]│
│ ● 15/03/2022 Nghiệm thu nhập kho [ biên bản ]│
└───────────────────────────────────────────────────────────┘
Nút "Tải hồ sơ PDF" (mức nâng cao) xuất toàn bộ lịch sử + bằng chứng thành một biên bản có mã tra cứu — đây là thứ khoa Trang thiết bị thật sự cần khi thanh tra đến kiểm tra.

2.2. Kỹ thuật viên (mobile-first, tablet/điện thoại)
Màn 4 — Việc của tôi: danh sách phiếu được phân công, sắp theo hạn ưu tiên; mỗi phiếu một thẻ với loại (PM/SC/HC), thiết bị, khoa, hết hạn.

Màn 5 — Thực hiện phiếu (màn quan trọng nhất của cả hệ thống về mặt bằng chứng):

text
┌───────────────────────────────────────┐
│ PHIẾU HIỆU CHUẨN #HC-2026-0087 [ĐANG LÀM] │
│ BS-240 · SN 12346 · Khoa HSDT │
├───────────────────────────────────────┤
│ CHECKLIST (2/5) │
│ ☑ 1. Vệ sinh buồng phản ứng [📷] ✓ │
│ ☑ 2. Chuẩn 5.0 mmol/L │
│ Chuẩn 5.00 │ Đo 5.04 │ +0.8% ĐẠT│
│ ☐ 3. Chuẩn 12.0 mmol/L ← đang làm │
│ Chuẩn ____ │ Đo ____ │ [tính] │
│ ☐ 4. Thử nghiệm an toàn (IEC 60601) │
│ ☐ 5. Dán tem hiệu chuẩn mới │
├───────────────────────────────────────┤
│ BẰNG CHỨNG BẮT BUỘC (2/4) ⚠ │
│ 📷 Ảnh tem mới … chưa có │
│ 📄 Chứng chỉ hiệu chuẩn PDF … chưa có│
│ [📷 Chụp ảnh] [📄 Tải file lên] │
├───────────────────────────────────────┤
│ [Lưu nháp] [HOÀN THÀNH 🔒] │
│ ← khóa cho đến khi đủ bằng chứng │
└───────────────────────────────────────┘
Ba quyết định thiết kế trong màn này cần viết rõ trong báo cáo:

Form hiệu chuẩn có cấu trúc (chuẩn/giá trị đo/sai số/tự kết luận ĐẠT–KHÔNG ĐẠT theo dung sai cho phép của model) — không phải ô text tự do. Đây là khác biệt giữa "phần mềm echt" và phần mềm bài tập.
Bằng chứng định nghĩa theo loại phiếu (cấu hình được): phiếu hiệu chuẩn bắt buộc chứng chỉ + ảnh tem; phiếu sửa chữa bắt buộc ảnh trước/sau; PM bắt buộc ảnh kết quả từng nhóm bước. UI đọc cấu hình này và render danh sách "chưa có" tương ứng.
Nút hoàn thành bị khóa có đếm "(2/4)" — người dùng luôn biết còn thiếu gì, không bị bất ngờ.
2.3. Điều phối (desktop, mật độ cao)
Màn 6 — Dashboard:

text
┌──────────────────────────────────────────────────────────────────┐
│ BẢNG ĐIỀU KHIỂN · 23/09/2026 │
│ ┌────────┐┌────────┐┌─────────┐┌───────────┐┌─────────────────┐ │
│ │ 412 ││ 27 ││ 9 ││ 4 ││ 89% │ │
│ │ĐANG HĐ ││PHIẾU MỞ││BÁO HỎNG ││QUÁ HẠN HC ││PM đúng hạn 6T │ │
│ └────────┘└────────┘└─────────┘└─────🔴─────┘└─────────────────┘ │
│ ↑ click vào thẻ nào mở danh sách đó │
│ ┌───────────────────────────┐ ┌────────────────────────────────┐ │
│ │ SẮP ĐẾN HẠN HC (7 NGÀY) │ │ SỰ CỐ THEO THÁNG (12 tháng) │ │
│ │ BS-240 SN12346 · 2 ngày │ │ ▂▃▅▂▇▃▂▄▅▂▃ ← biểu đồ cột │ │
│ │ XN-1000 SN00912 · 5 ngày │ │ │ │
│ └───────────────────────────┘ └──────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
Thẻ "QUÁ HẠN HC" màu đỏ là thẻ quan trọng nhất hệ thống — bấm vào ra danh sách thiết bị quá hạn, mỗi dòng có nút "Tạo phiếu hiệu chuẩn" ngay tại chỗ. Nguyên tắc: dashboard không chỉ để nhìn, mỗi con số là một cửa vào hành động.

Màn 7 — Lịch bảo trì + phân công kéo-thả (nơi xảy ra CHẶN — màn demo điểm nhấn):

text
┌────────────────────────────────────────────────────────────────┐
│ LỊCH TUẦN 28/09–04/10 [Tuần ▾] │
├──────────┬──────────┬──────────┬──────────┬──────────┬─────────┤
│ │ T2 28/09 │ T3 29/09 │ T4 30/09 │ T5 01/10 │ … │
│ Minh (VT)│ ▣PM BS240│ │ ▣HC XN1000│ │ │
│ Hùng (TT)│ │▣SC #0102 │ │ │ │
│ [chưa gán]│ │ ▣PM định kỳ (3) ← cần phân công │
├──────────┴──────────┴──────────┴──────────┴──────────┴─────────┤
│ THẢ PHIẾU VÀO THIẾT BỊ: │
│ Phiếu #SC-0088 "Sử dụng lưu động" → Thiết bị: [BS-240 SN12346]│
│ ⛔ KHÔNG THỂ PHÂN CÔNG │
│ Thiết bị đã quá hạn hiệu chuẩn 23 ngày │
│ (chứng chỉ hết hạn 01/08/2026 – chứng thư #VC-2026-0112). │
│ [Tạo phiếu hiệu chuẩn cho thiết bị này] [Xem hồ sơ thiết bị] │
└────────────────────────────────────────────────────────────────┘
Hộp chặn là trung tâm của khóa luận: nêu số ngày quá hạn + căn cứ (số chứng thư hiệu chuẩn cũ) — "bằng chứng của việc chặn". Hai nút bên dưới là "lối thoát". Hành vi chặn này cũng được ghi audit log (bằng chứng cho việc đã từng chặn).

Màn 8 — Nghiệm thu phiếu: điều phối xem lại phiếu kỹ thuật viên đã hoàn thành: checklist kết quả, gallery ảnh, file chứng chỉ, xác nhận của đầu mối khoa (nếu phiếu ở khoa) → nút Duyệt hoàn thành hoặc Trả lại làm lại kèm lý do (lý do bắt buộc — cũng là bằng chứng). Chỉ khi duyệt, thiết bị mới trở lại trạng thái hoạt động và lịch PM/HC kế tiếp mới sinh.

3. KHÔNG GIAN ADMIN
   Màn 9 — Danh mục nền: các bảng CRUD chuẩn (hãng, model thiết bị, loại thiết bị A/B/C/D, khoa, vị trí, nhà cung cấp). Màn model thiết bị quan trọng nhất vì chứa chu kỳ PM/hiệu chuẩn mặc định và dung sai hiệu chuẩn theo model — cấu hình một lần, mọi thiết bị của model đó kế thừa. Mức trung cấp: import/export Excel (thực tế bệnh viện nhận danh sách từ file), và khi import hiển thị bảng preview lỗi từng dòng trước khi cam kết.

Màn 10 — Người dùng & vai trò: danh sách người dùng đồng bộ từ Keycloak (không đặt mật khẩu trong app), gán role + khoa phụ trách. Nên có cột "lần đăng nhập cuối" và mức nâng cao là tự động vô hiệu hóa tài khoản không hoạt động 90 ngày.

Màn 11 — Cấu hình hệ thống: các tham số vận hành — ngưỡng cảnh báo hiệu chuẩn (30/7/1 ngày), số ngày "tự động khóa" (0 hoặc sau hết hạn), quy tắc bằng chứng bắt buộc theo loại phiếu, mãnh nháp phiếu tự lưu. Tất cả thay đổi cấu hình đều vào audit log.

Màn 12 — Trình xem Audit Log (chỉ đọc):

text
┌───────────────────────────────────────────────────────────────┐
│ AUDIT LOG [Đối tượng ▾][Người ▾][Loại ▾][Từ ngày][Đến] CSV ⤓│
├───────────────────────────────────────────────────────────────┤
│ 14:02:11 hệ thống UPDATE equipment #12346 │
│ status: HOAT_DONG → CHO_HIEU_CHUAN │
│ hash a3f9…e2 ✔ chuỗi hợp lệ │
│ 14:01:58 dphuong ASSIGN_BLOCKED phiếu #SC-0088 │
│ Lý do: quá hạn hiệu chuẩn 23 ngày ← chặn cũng được │
│ 11:20:03 minhvt WORK_ORDER_COMPLETE #HC-2026-0087 │
│ bằng chứng: 4/4 · chứng chỉ VC-2026-0112 │
└───────────────────────────────────────────────────────────────┘
Hai chi tiết nâng cao đáng giá: (a) cột hash chain — mỗi dòng hiện trạng thái "chuỗi hợp lệ", nếu ai sửa/xóa dòng nào đó trên CSDL trực tiếp thì dòng sau hiện "⛔ chuỗi bị đứt tại dòng #N" (demo kiểm tra toàn vẹn bằng chứng cực ấn tượng trước hội đồng); (b) loại sự kiện ASSIGN_BLOCKED — chính hành vi từ chối là một loại sự kiện audit, chứng minh hệ thống đã thực thi luật chặn chứ không chỉ có luật trên giấy.

Màn 13 — Quản lý bằng chứng/lưu trữ: danh sách file theo dung lượng/khoảng thời gian, kiểm tra lại hash định kỳ, tải xuống chứng chỉ gốc. Mức cơ bản chỉ cần: link file nằm sẵn trong chi tiết phiếu — màn riêng này thuộc mức nâng cao.

4. Bảng phân cấp tính năng UI: cơ bản → trung cấp → nâng cao
   Màn hình Cơ bản (bắt buộc) Trung cấp Nâng cao (chọn)
   Trang chủ khoa Danh sách + badge màu Đếm ngược ngày hạn; thông báo Push email khi khoa có thiết bị sắp khóa
   Báo hỏng Form chọn TB + mô tả Wizard 3 bước + ảnh + mức độ Quét QR; ảnh đóng dấu thời gian
   Chi tiết thiết bị Thông tin + hạn HC Timeline lịch sử Xuất gói hồ sơ PDF có mã tra cứu
   Việc của tôi Danh sách phiếu Lọc theo loại/trạng thái Lịch cá nhân đồng bộ
   Thực hiện phiếu Checklist + mô tả kết quả Checklist cấu hình theo loại; khóa nút hoàn thành Form hiệu chuẩn có sai số tự tính; chữ ký số đầu mối khoa; lưu nháp offline
   Dashboard Thẻ số liệu + danh sách quá hạn Biểu đồ sự cố/PM theo tháng KPI MTBF/MTTR/uptime; xu hướng 12 tháng
   Lịch + phân công Chọn TB bằng dropdown, validate chặn Kéo-thả phiếu vào người; hộp chặn có căn cứ chứng thư Gợi ý phân công theo tải nhân sự
   Nghiệm thu Duyệt/từ chối Bắt lý do khi trả lại; xác nhận 2 phía Duyệt từ xa trên mobile
   Danh mục admin CRUD Import/export Excel + preview lỗi Lịch sử phiên bản danh mục
   Cấu hình Sửa ngưỡng cảnh báo Quy tắc bằng chứng theo loại phiếu Cấu hình theo khoa (đa-phòng ban)
   Audit log Xem + lọc Xuất CSV; xem diff trước/sau Hash chain kiểm tra toàn vẹn
   Bằng chứng Xem file trong phiếu Kiểm tra hash file Tái kiểm tra hash định kỳ + báo cáo
   Cách dùng bảng này trong kế hoạch làm đồ án: cột "cơ bản" là mốc demo tối thiểu phải xong tuần 12; chọn thêm 3–4 ô trung cấp tùy thời gian; chọn đúng 2 ô nâng cao — khuyến nghị của tôi: "Form hiệu chuẩn có sai số tự tính" và "Hash chain audit log", vì hai ô này bám sát điểm nhấn đề tài nên trả lời được câu hỏi hội đồng "em làm gì khác biệt?".

5. Bản đồ điểm thu bằng chứng trên UI (viết thành bảng trong báo cáo)
   Hành động trên UI Bằng chứng hệ thống thu Người thấy ở đâu
   Gửi báo hỏng Ảnh hiện trường, người báo, thời điểm, mức độ Timeline thiết bị, phiếu sự cố
   Thực hiện bước checklist Kết quả từng bước + ảnh (nếu bắt buộc) Phiếu công tác
   Nhập kết quả hiệu chuẩn Chuẩn/giá trị đo/sai số/đánh giá ĐẠT Phiếu + timeline thiết bị
   Nộp chứng chỉ hiệu chuẩn File PDF + hash nội dung + người nộp Tab bằng chứng thiết bị
   Hoàn thành phiếu Tên người hoàn thành, thời điểm, đủ/không đủ bằng chứng Phiếu (không thể hoàn thành nếu thiếu)
   Bàn giao cho khoa Xác nhận đầu mối khoa (bước 2 phía) Phiếu + timeline
   Hệ thống chặn phân công Sự kiện ASSIGN_BLOCKED: ai, phiếu nào, thiết bị nào, số ngày quá hạn, căn cứ chứng thư Audit log
   Duyệt/từ chối nghiệm thu Người duyệt, thời điểm, lý do trả lại Phiếu + audit
   Thay đổi cấu hình/danh mục Giá trị trước/sau, người sửa Audit log
   Điểm cần nhấn: hàng "hệ thống chặn phân công" — bằng chứng không chỉ là hồ sơ hoàn thành, mà cả vết của hành động phòng ngừa. Đây là cách hiểu đầy đủ nhất của cụm "lưu đầy đủ bằng chứng" trong đề tài.

6. Quy ước hình thức (design tokens)
   Màu badge trạng thái (duy nhất một bộ): xanh lá #16A34A đang hoạt động · vàng #EAB308 sắp đến hạn (≤30 ngày, cấu hình được) · đỏ #DC2626 đã khóa chờ hiệu chuẩn/quá hạn · xám #6B7280 đang sửa chữa · xám đậm thanh lý. Đỏ chỉ dành cho "không được dùng" — không dùng đỏ cho các mục tiêu trang trí, để màu đỏ giữ nguyên ý nghĩa an toàn.
   Tương phản: mọi tổ hợp chữ/nền đạt mức AA của WCAG 2.1 (tỷ lệ 4.5:1) — đây là chuẩn thật (W3C) và có công cụ kiểm tra tự động (axe DevTools) để đưa bằng chứng vào phụ lục báo cáo.
   Typography/density: desktop bảng 13–14px mật độ cao (tương tự Ant Design); mobile 16px cơ bản, nút chạm tối thiểu 44×44px (theo khuyến nghị iOS HIG — chuẩn thật của Apple).
   Ngôn ngữ: toàn bộ UI tiếng Việt, thuật ngữ giữ nguyên khi đã là thuật ngữ nghề ("hiệu chuẩn", "PM", "nghiệm thu"); không lẫn tiếng Anh gây mơ hồ ("calibration" chỉ xuất hiện trong phụ đề kỹ thuật).
7. Phần "kiểm chứng UI" cho khóa luận (đừng bỏ — đây là điểm cộng kiểm chứng thực)
   Khóa luận của bạn yêu cầu "kiểm chứng", nên chương giao diện cần một mục đánh giá có phương pháp thật, do người thật thực hiện:

Đánh giá heuristic theo 10 tiêu chí của Nielsen (Jakob Nielsen, 1994 — phương pháp chuẩn ngành, trích dẫn được): bạn tự chấm giao diện theo 10 tiêu chí, mỗi vi phạm nêu vị trí + mức nghiêm trọng.
SUS — System Usability Scale (John Brooke, 1996): bảng hỏi 10 câu chuẩn, cho 5–8 người dùng thử (bạn bè đóng vai điều dưỡng/kỹ thuật viên), tính điểm 0–100. Điểm trên 68 được coi là trên trung bình ngành — đưa bảng tính vào phụ lục.
Kịch bản demo 5 phút ("đường vàng"): báo hỏng → tiếp nhận → phân công (gặp thiết bị quá hạn → bị chặn, tạo phiếu hiệu chuẩn luôn) → kỹ thuật viên thực hiện với form sai số → nộp đủ bằng chứng → hoàn thành → thiết bị mở khóa → mở audit log thấy đủ vết. Đo thời gian hoàn thành kịch bản của 3 người dùng làm bằng chứng hiệu quả. 8. Triển khai trong React (khuyến nghị thực tế)
Với stack React của bạn, dùng Ant Design (khusu biệt là các thành phần Table, Timeline, Steps, Form, Upload — khớp gần như 1:1 với các màn ở trên) hoặc MUI + MUI X. Đừng tự vẽ component từ đầu — vừa mất thời gian vừa kém ổn định; vốn đầu tư đúng của đồ án là ở luồng nghiệp vụ và trạng thái, không ở CSS. Wireframe ở trên vẽ lại bằng Figma (gói miễn phí cho sinh viên) trước khi code — báo cáo có wireframe low-fi + thiết kế cao cấp + ảnh chụp màn hình chạy thật là chuỗi bằng chứng quy trình đầy đủ mà hội đồng đánh giá cao.
