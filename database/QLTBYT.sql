
\set ON_ERROR_STOP on

/* =====================================================================
   MỤC 0. DỌN DẸP — cho phép chạy lại script nhiều lần
   ===================================================================== */
DROP VIEW IF EXISTS v_bao_cao_bang_chung      CASCADE;
DROP VIEW IF EXISTS v_bao_cao_pm               CASCADE;
DROP VIEW IF EXISTS v_bao_cao_su_co            CASCADE;
DROP VIEW IF EXISTS v_bao_cao_hieu_chuan       CASCADE;
DROP VIEW IF EXISTS v_bang_dieu_khien         CASCADE;
DROP VIEW IF EXISTS v_audit_chain_verify       CASCADE;
DROP VIEW IF EXISTS v_work_orders             CASCADE;
DROP VIEW IF EXISTS v_equipment               CASCADE;
DROP VIEW IF EXISTS v_timeline_thiet_bi        CASCADE;

DROP FUNCTION IF EXISTS fn_khoa_thiet_bi_qua_han()  CASCADE;
DROP FUNCTION IF EXISTS fn_bam_audit(text,text,text,text,text) CASCADE;
DROP FUNCTION IF EXISTS fn_so_thang(date,date)      CASCADE;
DROP FUNCTION IF EXISTS fn_chan_phan_cong_qua_han()  CASCADE;
DROP FUNCTION IF EXISTS fn_chan_tao_phieu_khai_thac() CASCADE;

DROP TRIGGER IF EXISTS trg_assignments_block_overdue ON assignments;
DROP TRIGGER IF EXISTS trg_work_orders_block_khai_thac ON work_orders;

DROP TABLE IF EXISTS notifications      CASCADE;
DROP TABLE IF EXISTS system_config      CASCADE;
DROP TABLE IF EXISTS audit_log          CASCADE;
DROP TABLE IF EXISTS assignments        CASCADE;
DROP TABLE IF EXISTS incidents          CASCADE;
DROP TABLE IF EXISTS evidence           CASCADE;
DROP TABLE IF EXISTS required_evidence_config CASCADE;
DROP TABLE IF EXISTS work_order_steps   CASCADE;
DROP TABLE IF EXISTS work_orders        CASCADE;
DROP TABLE IF EXISTS users              CASCADE;
DROP TABLE IF EXISTS equipment_status_history CASCADE;
DROP TABLE IF EXISTS equipment          CASCADE;
DROP TABLE IF EXISTS equipment_models   CASCADE;
DROP TABLE IF EXISTS suppliers          CASCADE;
DROP TABLE IF EXISTS manufacturers      CASCADE;
DROP TABLE IF EXISTS departments        CASCADE;

-- digest() / encode() dùng cho chuỗi hash SHA-256 của Audit Log
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Bảng danh mục dùng chữ tiếng Việt có dấu
SET client_encoding = 'UTF8';


/* =====================================================================
   MỤC 1. DANH MỤC NỀN  (quản trị viên thiết lập một lần)
   ---------------------------------------------------------------------
   Đây là tầng dữ liệu "nền": khoa phòng, hãng sản xuất, nhà cung cấp và
   thông số kỹ thuật của từng model. Mọi thiết bị và phiếu công tác phía
   dưới đều tham chiếu tới đây — đúng màn "Admin > Danh mục nền".
   ===================================================================== */

CREATE TABLE departments (
    department_id   integer     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            varchar(100) NOT NULL UNIQUE,   -- 'Hóa sinh', 'Hồi sức cấp cứu'...
    is_clinical     boolean     NOT NULL DEFAULT true,  -- khoa lâm sàng hay phòng chức năng
    address         varchar(200) NULL,             -- vị trí đặt thiết bị
    phone           varchar(30)  NULL,             -- số nội bộ khoa
    created_at      timestamp   NOT NULL DEFAULT now()
);

CREATE TABLE manufacturers (
    manufacturer_id integer     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            varchar(150) NOT NULL UNIQUE,  -- Mindray, GE Healthcare...
    country         varchar(80)  NULL,            -- quốc gia sản xuất
    website         varchar(200) NULL
);

CREATE TABLE suppliers (
    supplier_id     integer     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            varchar(150) NOT NULL UNIQUE,  -- nhà cung cấp / đơn vị bảo hành
    contact_person  varchar(100) NULL,
    phone           varchar(30)  NULL,
    contract_no     varchar(60)  NULL             -- số hợp đồng bảo trì
);

-- Model thiết bị: tách riêng khỏi thiết bị vật lý (1 model – nhiều máy).
-- Chu kỳ PM/HC và DUNG SAI hiệu chuẩn cấu hình ở đây, mọi thiết bị cùng
-- model kế thừa — khớp màn "Admin > Danh mục nền > Model thiết bị".
CREATE TABLE equipment_models (
    model_id        integer     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            varchar(150) NOT NULL UNIQUE,  -- 'Mindray BS-240'
    manufacturer_id integer     NOT NULL REFERENCES manufacturers(manufacturer_id),
    category        varchar(100) NOT NULL,         -- 'Máy sinh phẩm', 'Máy siêu âm'...
    pm_cycle_days   integer     NOT NULL DEFAULT 180 CHECK (pm_cycle_days > 0),  -- chu kỳ bảo trì phòng ngừa
    hc_cycle_days   integer     NOT NULL DEFAULT 365 CHECK (hc_cycle_days > 0),  -- chu kỳ hiệu chuẩn
    hc_tolerance_pct numeric(5,2) NOT NULL DEFAULT 2.50 CHECK (hc_tolerance_pct > 0), -- dung sai sai số cho phép (%)
    is_active       boolean     NOT NULL DEFAULT true,
    notes           varchar(500) NULL
);


/* =====================================================================
   MỤC 2. THIẾT BỊ  (trục xương sống của hệ thống)
   ---------------------------------------------------------------------
   Một dòng = một máy vật lý có serial riêng. Trạng thái và hạn hiệu
   chuẩn là hai trường độc lập: BR-01 chỉ khóa được khi hạn hiệu chuẩn
   THỰC SỰ quá hạn, không phụ thuộc ai cập nhật trạng thái.
   ===================================================================== */

CREATE TABLE equipment (
    equipment_id    integer     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code            varchar(20)  NOT NULL UNIQUE,   -- 'DEV-001' — mã QR in trên nhãn tài sản
    name            varchar(150) NOT NULL,          -- tên gọi tại khoa, ví dụ 'Máy sinh phẩm BS-240'
    model_id        integer     NOT NULL REFERENCES equipment_models(model_id),
    serial          varchar(50)  NOT NULL UNIQUE,  -- số serial của hãng
    department_id   integer     NOT NULL REFERENCES departments(department_id),
    location        varchar(120) NULL,              -- vị trí đặt trong khoa
    status          varchar(20)  NOT NULL DEFAULT 'HOAT_DONG'
        CHECK (status IN ('HOAT_DONG','SAP_HAN','CHO_HIEU_CHUAN','DANG_SUA','THANH_LY')),
    calibration_expiry date     NULL,               -- hạn hiệu chuẩn hiện hành
    next_pm         date         NULL,              -- ngày bảo trì định kỳ kế tiếp
    import_date     date         NOT NULL,          -- ngày nghiệm thu nhập kho
    warranty_months integer      NOT NULL DEFAULT 24 CHECK (warranty_months >= 0),
    purchase_price  numeric(14,2) NULL,             -- giá trị ban đầu (tính tỷ lệ hao mòn)
    maintenance_supplier_id integer NULL REFERENCES suppliers(supplier_id), -- đơn vị ký hợp đồng bảo trì
    notes           varchar(500) NULL,
    -- Ràng buộc: máy đã khóa chờ hiệu chuẩn thì bắt buộc phải có hạn hiệu chuẩn để hiển thị
    CONSTRAINT ck_equipment_lock_needs_expiry
        CHECK (NOT (status = 'CHO_HIEU_CHUAN' AND calibration_expiry IS NULL))
);

CREATE INDEX ix_equipment_status   ON equipment(status);
CREATE INDEX ix_equipment_dept     ON equipment(department_id);
CREATE INDEX ix_equipment_calib    ON equipment(calibration_expiry);  -- phục vụ job quét hạn
CREATE INDEX ix_equipment_model    ON equipment(model_id);

-- Lịch sử thay đổi trạng thái — nguồn dữ liệu cho dòng thời gian ở màn
-- "Chi tiết thiết bị" (ghép thêm phiếu công tác, sự cố, hiệu chuẩn).
CREATE TABLE equipment_status_history (
    history_id      bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    equipment_id    integer     NOT NULL REFERENCES equipment(equipment_id) ON DELETE CASCADE,
    from_status     varchar(20)  NOT NULL,
    to_status       varchar(20)  NOT NULL,
    changed_by      varchar(50)  NOT NULL,          -- username hoặc chuỗi 'hệ thống'
    reason          varchar(300) NULL,
    changed_at      timestamp    NOT NULL DEFAULT now()
);

CREATE INDEX ix_status_history_equipment ON equipment_status_history(equipment_id, changed_at DESC);


/* =====================================================================
   MỤC 3. NGƯỜI DÙNG & PHÂN QUYỀN
   ---------------------------------------------------------------------
   Hồ sơ nghiệp vụ của nhân viên. ĐĂNG NHẬP THẬT do Keycloak (OIDC) đảm
   nhiệm — bảng này chỉ lưu hồ sơ và vai trò nghiệp vụ, đồng bộ từ
   claim của Keycloak. Khớp ghi chú "Đồng bộ từ Keycloak" trên màn
   "Admin > Người dùng & Vai trò".
   ===================================================================== */

CREATE TABLE users (
    user_id       integer     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    username      varchar(50)  NOT NULL UNIQUE,     -- trùng username Keycloak
    full_name     varchar(150) NOT NULL,
    email         varchar(120) NULL,
    employee_no   varchar(30)  NULL,               -- mã nhân viên
    role          varchar(20)  NOT NULL
        CHECK (role IN ('ADMIN','DIEU_PHOI','KY_THUAT_VIEN','DAU_MOI_KHOA')),
    department_id integer     NULL REFERENCES departments(department_id),
    phone         varchar(30)  NULL,
    last_login    timestamp   NULL,
    is_active     boolean     NOT NULL DEFAULT true
);

CREATE INDEX ix_users_role ON users(role);


/* =====================================================================
   MỤC 4. PHIẾU CÔNG TÁC + CHECKLIST + BẰNG CHỨNG
   ---------------------------------------------------------------------
   Bốn loại phiếu:
     PM — Bảo trì định kỳ   (phòng ngừa, theo chu kỳ của model)
     SC — Sửa chữa          (phát sinh từ sự cố báo hỏng)
     HC — Hiệu chuẩn        (đo chuẩn so với giá trị chuẩn, có dung sai)
     KT — Kiểm định         (kiểm định định kỳ theo quy định pháp lý)
   PM và SC gọi chung là "phiếu KHAI THÁC" — loại này mới bị BR-01 chặn
   khi thiết bị quá hạn hiệu chuẩn.
   ===================================================================== */

CREATE TABLE work_orders (
    work_order_id  integer     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code           varchar(20)  NOT NULL UNIQUE,   -- 'HC-2026-0087' (giao diện hiển thị kèm dấu #)
    order_type     char(2)      NOT NULL CHECK (order_type IN ('PM','SC','HC','KT')),
    equipment_id   integer     NOT NULL REFERENCES equipment(equipment_id),
    department_id  integer     NOT NULL REFERENCES departments(department_id), -- chép nhanh để lọc theo khoa
    assignee_id    integer     NULL REFERENCES users(user_id),                 -- NULL = chưa phân công
    status         varchar(20)  NOT NULL DEFAULT 'CHO_PHAN_CONG'
        CHECK (status IN ('CHO_PHAN_CONG','DANG_THUC_HIEN','CHO_NGHIEM_THU','HOAN_THANH','TRA_LAI')),
    priority       varchar(15)  NOT NULL DEFAULT 'BINH_THUONG'
        CHECK (priority IN ('BINH_THUONG','KHAN')),
    created_at     date         NOT NULL,
    deadline       date         NOT NULL,
    completed_at   timestamp   NULL,             -- thời điểm kỹ thuật viên bấm hoàn thành
    reviewed_at    timestamp   NULL,             -- thời điểm điều phối nghiệm thu
    progress       smallint     NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    return_reason  varchar(500) NULL,             -- lý do trả lại, bắt buộc khi trả lại phiếu
    description    varchar(500) NULL,
    CONSTRAINT ck_work_order_dates CHECK (deadline >= created_at)
);

CREATE INDEX ix_wo_status   ON work_orders(status);
CREATE INDEX ix_wo_assignee ON work_orders(assignee_id);
CREATE INDEX ix_wo_dept     ON work_orders(department_id);
CREATE INDEX ix_wo_deadline ON work_orders(deadline);

-- Checklist từng bước — khớp màn "Thực hiện phiếu" của kỹ thuật viên.
-- Bước CÓ standard_value là bước ĐO HIỆU CHUẨN: có giá trị chuẩn, giá
-- trị đo và dung sai. Bước không có standard_value là bước thao tác.
CREATE TABLE work_order_steps (
    step_id        bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    work_order_id  integer      NOT NULL REFERENCES work_orders(work_order_id) ON DELETE CASCADE,
    ordinal        integer      NOT NULL CHECK (ordinal > 0),
    title          varchar(200) NOT NULL,
    require_photo  boolean      NOT NULL DEFAULT false,
    standard_value numeric(10,4) NULL,             -- giá trị chuẩn (VD 5,0000 mmol/L)
    unit           varchar(20)  NULL,              -- đơn vị đo (mmol/L, %, °C...)
    tolerance_pct  numeric(5,2)  NULL,             -- dung sai cho phép (%), mặc định lấy của model
    measured_value numeric(10,4) NULL,             -- giá trị kỹ thuật viên nhập
    result         varchar(10)  NULL CHECK (result IN ('DAT','KHONG_DAT')),
    done           boolean      NOT NULL DEFAULT false,
    skip_reason    varchar(300) NULL,              -- bắt buộc nhập lý do nếu bỏ bước
    note           varchar(500) NULL,
    performed_at   timestamp   NULL,
    performed_by   integer      NULL REFERENCES users(user_id),
    CONSTRAINT uq_step UNIQUE (work_order_id, ordinal),
    /* ---- LUẬT BR-03 ÉP NGAY TẠI TẦNG CSDL ----
       Sai số vượt dung sai thì TUYỆT ĐỐI không được ghi result = 'DAT'.
       Ngay cả khi có người sửa tay bằng câu lệnh SQL, CHECK constraint
       này vẫn chặn.

       Công thức PHẢI khớp CalibrationRules.WithinTolerance (tầng ứng dụng):
         sai số (%) = |giá trị đo − giá trị chuẩn| / giá trị chuẩn × 100
         ĐẠT  ⟺  sai số ≤ dung sai (mặc định 100 %)
       Riêng khi giá trị chuẩn = 0 thì CHỈ ĐẠT khi giá trị đo cũng = 0
       (tương đương nhánh `standardValue == 0` trong C#). Nhánh này cũng
       tránh chia cho 0 — Postgres ném lỗi "division by zero" khi
       standard_value = 0. */
    CONSTRAINT ck_step_result
        CHECK (result IS DISTINCT FROM 'DAT'
               OR standard_value IS NULL
               OR measured_value IS NULL
               OR (standard_value = 0 AND measured_value = 0)
               OR (standard_value <> 0
                   AND abs(measured_value - standard_value) / standard_value * 100
                      <= COALESCE(tolerance_pct, 100)))
);

-- Quy tắc bằng chứng bắt buộc theo từng loại phiếu — khớp màn
-- "Admin > Cấu hình hệ thống > Quy tắc bằng chứng".
CREATE TABLE required_evidence_config (
    config_id      integer     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    order_type     char(2)     NOT NULL CHECK (order_type IN ('PM','SC','HC','KT')),
    evidence_code  varchar(30)  NOT NULL,
    label          varchar(100) NOT NULL,
    is_required    boolean     NOT NULL DEFAULT true,
    max_files      smallint     NOT NULL DEFAULT 1 CHECK (max_files > 0),
    accept_mime    varchar(120) NULL,              -- ví dụ 'image/jpeg,application/pdf'
    sort_order     smallint     NOT NULL DEFAULT 0,
    CONSTRAINT uq_evidence_cfg UNIQUE (order_type, evidence_code)
);

-- Bằng chứng kỹ thuật viên nộp lên. sha256 = hash nội dung file, để phát
-- hiện file bị thay sau khi phiếu đã hoàn thành (append-only).
CREATE TABLE evidence (
    evidence_id    bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    work_order_id  integer      NOT NULL REFERENCES work_orders(work_order_id) ON DELETE CASCADE,
    evidence_code  varchar(30)  NOT NULL,
    file_name      varchar(260) NOT NULL,
    file_path      varchar(500) NOT NULL,
    file_mime      varchar(80)  NULL,
    sha256         char(64)     NOT NULL,
    file_size_kb   integer      NOT NULL CHECK (file_size_kb > 0),
    uploaded_by    integer      NOT NULL REFERENCES users(user_id),
    uploaded_at    timestamp    NOT NULL DEFAULT now()
);

CREATE INDEX ix_evidence_wo ON evidence(work_order_id);


/* =====================================================================
   MỤC 5. SỰ CỐ (BÁO HỎNG) & PHÂN CÔNG
   ===================================================================== */

-- Sự cố do đầu mối khoa báo qua nút "BÁO HỎNG" trên màn Thiết bị khoa.
CREATE TABLE incidents (
    incident_id    integer     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    code           varchar(20)  NOT NULL UNIQUE,   -- 'INC-2026-0031'
    equipment_id   integer     NOT NULL REFERENCES equipment(equipment_id),
    reported_by    integer     NOT NULL REFERENCES users(user_id),
    description    varchar(500) NOT NULL,
    severity       varchar(10)  NOT NULL CHECK (severity IN ('SO_BO','KHAN')),
    photo_count    smallint     NOT NULL DEFAULT 0,
    photo_paths    text         NULL,              -- đường dẫn ảnh sự cố, cách nhau bằng dấu phẩy
    status         varchar(15)  NOT NULL DEFAULT 'MOI'
        CHECK (status IN ('MOI','DA_TIEP_NHAN','DA_TAO_PHIEU','DONG')),
    created_at     timestamp    NOT NULL DEFAULT now(),
    closed_at      timestamp   NULL,
    resolution     varchar(500) NULL,              -- kết quả xử lý sau cùng
    work_order_id  integer     NULL REFERENCES work_orders(work_order_id) -- phiếu SC sinh ra từ sự cố
);

CREATE INDEX ix_incidents_equipment ON incidents(equipment_id);
CREATE INDEX ix_incidents_created   ON incidents(created_at DESC);

-- Phân công kỹ thuật viên cho một phiếu tại một ngày cụ thể.
-- Một phiếu chỉ có đúng MỘT lần phân công (ràng buộc UNIQUE bên dưới).
CREATE TABLE assignments (
    assignment_id   integer     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    work_order_id   integer     NOT NULL UNIQUE REFERENCES work_orders(work_order_id) ON DELETE CASCADE,
    equipment_id    integer     NOT NULL REFERENCES equipment(equipment_id),
    assignee_id     integer     NOT NULL REFERENCES users(user_id),
    scheduled_date  date        NOT NULL,
    status          varchar(15)  NOT NULL DEFAULT 'DANG_THUC_HIEN'
        CHECK (status IN ('DANG_THUC_HIEN','HOAN_THANH','HUY')),
    created_by      integer     NOT NULL REFERENCES users(user_id),
    created_at      timestamp    NOT NULL DEFAULT now()
);

CREATE INDEX ix_assignments_assignee ON assignments(assignee_id, scheduled_date);


/* =====================================================================
   MỤC 6. NHẬT KÝ HỆ THỐNG (AUDIT LOG) — APPEND-ONLY + CHUỖI HASH
   ---------------------------------------------------------------------
   ĐIỂM NHẤN 2 CỦA ĐỀ TÀI.

   Công thức băm:
       row_hash = SHA256( prev_hash | actor | action | target | detail )

   Mỗi dòng bám hash của dòng trước, nên chỉ cần sửa hoặc xóa một dòng
   thì dòng kế tiếp lập tức hiển thị "⛔ BỊ ĐỨT" ở màn "Admin > Audit Log".

   LƯU Ý KỸ THUẬT: chuỗi được băm trên byte UTF-8. Bản SQL Server cũ dùng
   UTF-16LE (do HASHBYTES băm kiểu nvarchar) — PostgreSQL không hỗ trợ
   chuyển đổi sang UTF-16, nên khi chuyển CSDL chuẩn đã đổi sang UTF-8 và
   AuditService.ComputeHash bên C# cũng được sửa cho khớp (Encoding.UTF8).
   ===================================================================== */

CREATE TABLE audit_log (
    audit_id     bigint       GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    occurred_at  timestamp    NOT NULL DEFAULT now(),
    actor        varchar(50)  NOT NULL,   -- username, hoặc chuỗi 'hệ thống'
    action       varchar(40)  NOT NULL,   -- AUTO_LOCK, ASSIGN_BLOCKED, WO_COMPLETE...
    target       varchar(100) NOT NULL,   -- đối tượng bị tác động
    detail       varchar(500) NULL,
    prev_hash    char(64)     NOT NULL,   -- hash của dòng liền trước
    row_hash     char(64)     NOT NULL    -- hash của chính dòng này
);

CREATE INDEX ix_audit_time ON audit_log(occurred_at DESC);
CREATE INDEX ix_audit_actor ON audit_log(actor);


/* =====================================================================
   MỤC 7. CẤU HÌNH HỆ THỐNG & THÔNG BÁO
   ===================================================================== */

CREATE TABLE system_config (
    config_key   varchar(50)  PRIMARY KEY,
    config_value varchar(200) NOT NULL,
    description  varchar(300) NOT NULL,
    updated_at   timestamp   NOT NULL DEFAULT now(),
    updated_by   varchar(50) NULL
);

CREATE TABLE notifications (
    notification_id bigint     GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id       integer     NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    type          varchar(30)  NOT NULL,   -- 'HC_QUA_HAN','HC_SAP_HAN','WO_CHO_NGHIEM_THU'...
    message       varchar(300) NOT NULL,
    link          varchar(200) NULL,      -- đường dẫn mở thẳng tới màn liên quan
    is_read       boolean      NOT NULL DEFAULT false,
    created_at    timestamp    NOT NULL DEFAULT now()
);

CREATE INDEX ix_notifications_user ON notifications(user_id, is_read);


/* =====================================================================
   MỤC 8. HÀM SỐ, TRIGGER KIỂM SOÁT VÀ VIEW PHỤC VỤ GIAO DIỆN
   ===================================================================== */

/* ---------------------------------------------------------------
   8.1. Hàm băm chuỗi Audit Log
   --------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION fn_bam_audit(
    p_prev_hash text,
    p_actor     text,
    p_action    text,
    p_target    text,
    p_detail    text
) RETURNS char(64)
LANGUAGE sql IMMUTABLE AS $$
    SELECT encode(
        digest(
            p_prev_hash || '|' || p_actor || '|' || p_action || '|' || p_target
                || '|' || COALESCE(p_detail, ''),
            'sha256'
        ),
        'hex'
    )::char(64);
$$;

COMMENT ON FUNCTION fn_bam_audit IS
    'Băm SHA-256 chuỗi prev_hash|actor|action|target|detail trên byte UTF-8 — khớp AuditService.ComputeHash bên C#.';


/* ---------------------------------------------------------------
   8.2. Hàm đếm số tháng giữa hai ngày — dùng cho cột "còn bảo hành"
   --------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION fn_so_thang(d1 date, d2 date) RETURNS integer
LANGUAGE sql IMMUTABLE AS $$
    SELECT (
        (EXTRACT(YEAR  FROM age(d2, d1)) * 12)::integer
        + EXTRACT(MONTH FROM age(d2, d1))::integer
    );
$$;


/* ---------------------------------------------------------------
   8.3. TRIGGER BR-01 — chặn phân công phiếu khai thác cho thiết bị
        quá hạn hiệu chuẩn hoặc đã thanh lý.

        Đây là TẦNG 4/4 của điểm nhấn BR-01:
          tầng 1 — giao diện: ẩn nút, hiện lý do (màn Lịch bảo trì,
                     màn Tạo phiếu công tác)
          tầng 2 — dịch vụ:     kiểm tra trước khi ghi, ghi dòng audit
                               ASSIGN_BLOCKED (AssignmentService)
          tầng 3 — cơ sở dữ liệu: trigger này
          tầng 4 — báo cáo:    dòng ASSIGN_BLOCKED trong Audit Log là
                               bằng chứng hệ thống đã thực thi luật chặn

        Phiếu HC và KT KHÔNG bị chặn — chính là lối thoát để gỡ tình
        huống quá hạn.
   --------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION fn_chan_phan_cong_qua_han() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM work_orders wo
        JOIN equipment  e  ON e.equipment_id = NEW.equipment_id
        WHERE wo.work_order_id = NEW.work_order_id
          AND wo.order_type IN ('PM','SC')                          -- chỉ chặn phiếu KHAI THÁC
          AND ( e.status = 'THANH_LY'                               -- đã thanh lý
             OR e.status = 'CHO_HIEU_CHUAN'                         -- đang chờ hiệu chuẩn
             OR e.calibration_expiry < NEW.scheduled_date )        -- hạn HC < ngày dự kiến làm
    ) THEN
        RAISE EXCEPTION
            'BR-01: Không thể phân công — thiết bị đã quá hạn hiệu chuẩn hoặc đã thanh lý. Chỉ được phân công phiếu hiệu chuẩn (HC) hoặc kiểm định (KT).'
            USING ERRCODE = 'check_violation',
                  HINT    = 'Tạo phiếu HC trước để gỡ tình huống quá hạn hiệu chuẩn.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assignments_block_overdue
    BEFORE INSERT ON assignments
    FOR EACH ROW EXECUTE FUNCTION fn_chan_phan_cong_qua_han();


/* ---------------------------------------------------------------
   8.4. TRIGGER BR-01 — chặn TẠO phiếu khai thác cho thiết bị đã khóa
        Chặn sớm hơn, ngay lúc mở phiếu chứ không đợi tới lúc phân công.
   --------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION fn_chan_tao_phieu_khai_thac() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_status  varchar(20);
    v_expiry  date;
BEGIN
    IF NEW.order_type NOT IN ('PM','SC') THEN
        RETURN NEW;   -- phiếu HC/KT luôn được phép tạo
    END IF;

    SELECT status, calibration_expiry INTO v_status, v_expiry
    FROM equipment WHERE equipment_id = NEW.equipment_id;

    IF v_status = 'CHO_HIEU_CHUAN' OR v_status = 'THANH_LY'
       OR (v_expiry IS NOT NULL AND v_expiry < CURRENT_DATE) THEN
        RAISE EXCEPTION
            'BR-01: Không thể tạo phiếu % cho thiết bị đang quá hạn hiệu chuẩn hoặc đã thanh lý.', NEW.order_type
            USING ERRCODE = 'check_violation',
                  HINT    = 'Hãy tạo phiếu HC (hiệu chuẩn) hoặc KT (kiểm định) thay thế.';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trg_work_orders_block_khai_thac
    BEFORE INSERT ON work_orders
    FOR EACH ROW EXECUTE FUNCTION fn_chan_tao_phieu_khai_thac();


/* ---------------------------------------------------------------
   8.5. HÀM TỰ ĐỘNG KHÓA THIẾT BỊ QUÁ HẠN  (tầng hệ thống của BR-01)

   Chạy hằng ngày bằng pg_cron, hoặc gọi thủ công:
       SELECT * FROM fn_khoa_thiet_bi_qua_han();
   Ghi vết vào cả ba nơi: trạng thái thiết bị, lịch sử thay đổi,
   nhật ký hệ thống (AUTO_LOCK) và thông báo cho điều phối.
   --------------------------------------------------------------- */
CREATE OR REPLACE FUNCTION fn_khoa_thiet_bi_qua_han()
RETURNS TABLE(equipment_id integer, code varchar, so_ngay_qua_han integer)
LANGUAGE plpgsql AS $$
DECLARE
    r          record;
    v_prev     char(64);
    v_hash     char(64);
BEGIN
    FOR r IN
        SELECT e.equipment_id, e.code,
               (CURRENT_DATE - e.calibration_expiry)::integer AS so_ngay
        FROM equipment e
        WHERE e.calibration_expiry < CURRENT_DATE
          AND e.status IN ('HOAT_DONG','SAP_HAN')
        ORDER BY e.equipment_id
    LOOP
        -- 1) đổi trạng thái thiết bị
        -- MUST qualify: hàm có biến OUT trùng tên cột (equipment_id),
        -- nếu viết WHERE equipment_id = r.equipment_id thì plpgsql báo
        -- "column reference is ambiguous" khi gọi hàm thật.
        UPDATE equipment SET status = 'CHO_HIEU_CHUAN'
        WHERE equipment.equipment_id = r.equipment_id;

        -- 2) ghi lịch sử thay đổi trạng thái
        INSERT INTO equipment_status_history
            (equipment_id, from_status, to_status, changed_by, reason, changed_at)
        VALUES
            (r.equipment_id, 'HOAT_DONG/SAP_HAN', 'CHO_HIEU_CHUAN', 'hệ thống',
             'Quá hạn hiệu chuẩn ' || r.so_ngay || ' ngày — tự động khóa theo BR-01',
             now());

        -- 3) ghi nhật ký hệ thống, nối tiếp chuỗi hash
        SELECT row_hash INTO v_prev FROM audit_log ORDER BY audit_id DESC LIMIT 1;
        v_prev := COALESCE(v_prev, repeat('0', 64)::char(64));
        v_hash := fn_bam_audit(v_prev, 'hệ thống', 'AUTO_LOCK',
                               'thiết bị #' || r.code,
                               'Quá hạn hiệu chuẩn ' || r.so_ngay || ' ngày — tự động khóa');
        INSERT INTO audit_log (actor, action, target, detail, prev_hash, row_hash)
        VALUES ('hệ thống', 'AUTO_LOCK', 'thiết bị #' || r.code,
                'Quá hạn hiệu chuẩn ' || r.so_ngay || ' ngày — tự động khóa', v_prev, v_hash);

        -- 4) báo cho toàn bộ điều phối đang hoạt động
        INSERT INTO notifications (user_id, type, message, link)
        SELECT u.user_id, 'HC_QUA_HAN',
               'Thiết bị ' || r.code || ' đã quá hạn hiệu chuẩn ' || r.so_ngay
                   || ' ngày — hệ thống tự động khóa, không được phân công sử dụng',
               '/coordinator/devices/' || r.code
        FROM users u
        WHERE u.role = 'DIEU_PHOI' AND u.is_active = true;

        equipment_id := r.equipment_id;
        code         := r.code;
        so_ngay_qua_han := r.so_ngay;
        RETURN NEXT;
    END LOOP;
END;
$$;

COMMENT ON FUNCTION fn_khoa_thiet_bi_qua_han() IS
    'Khóa mọi thiết bị quá hạn hiệu chuẩn, ghi lịch sử + audit AUTO_LOCK + thông báo cho điều phối. Nên chạy hằng ngày.';


/* =====================================================================
   MỤC 9. CÁC VIEW PHỤC VỤ TRỰC TIẾP TỪNG MÀN GIAO DIỆN
   ---------------------------------------------------------------------
   Nguyên tắc: các phép tính suy diễn (còn bao nhiêu ngày, còn bao nhiêu
   tháng bảo hành) đặt Ở TẦNG CSDL chứ không tính lại ở từng màn giao
   diện — tránh mỗi màn một cách hiểu, lệch số liệu giữa các màn.
   ===================================================================== */

/* --- 9.1. Màn "Thiết bị toàn viện" + "Thiết bị khoa" --- */
CREATE VIEW v_equipment AS
SELECT  e.equipment_id,
        e.code,
        e.name                                        AS ten_thiet_bi,
        e.serial,
        e.location                                    AS vi_tri,
        e.status,
        m.name                                        AS model,
        mf.name                                       AS manufacturer,
        d.name                                        AS department,
        d.department_id,
        e.calibration_expiry,
        (e.calibration_expiry - CURRENT_DATE)::integer AS days_left,
        CASE
            WHEN e.calibration_expiry IS NULL              THEN NULL
            WHEN e.calibration_expiry < CURRENT_DATE       THEN 'CHO_HIEU_CHUAN'
            WHEN e.calibration_expiry - CURRENT_DATE <= 7  THEN 'SAP_HAN'
            ELSE 'HOAT_DONG'
        END                                           AS trang_thai_hieu_chuan,
        e.next_pm,
        (e.next_pm - CURRENT_DATE)::integer            AS days_to_pm,
        m.pm_cycle_days,
        m.hc_cycle_days,
        m.hc_tolerance_pct,
        e.import_date,
        e.warranty_months,
        fn_so_thang(CURRENT_DATE, (e.import_date + make_interval(months => e.warranty_months))::date)
                                                            AS warranty_left,
        e.purchase_price,
        s.name                                        AS maintenance_contract,
        e.notes
FROM equipment e
JOIN equipment_models m  ON m.model_id  = e.model_id
JOIN manufacturers   mf  ON mf.manufacturer_id = m.manufacturer_id
JOIN departments     d   ON d.department_id  = e.department_id
LEFT JOIN suppliers  s   ON s.supplier_id   = e.maintenance_supplier_id;


/* --- 9.2. Màn "Dòng thời gian" của Chi tiết thiết bị ---
   Gộp 4 nguồn: đổi trạng thái, phiếu HC, phiếu PM/SC, sự cố. --- */
CREATE VIEW v_timeline_thiet_bi AS
    SELECT h.equipment_id,
           h.changed_at                                AS thoi_diem,
           'STATUS'::varchar(20)                       AS loai,
           CASE h.to_status
               WHEN 'CHO_HIEU_CHUAN' THEN 'Hết hạn hiệu chuẩn – tự động khóa'
               WHEN 'DANG_SUA'        THEN 'Chuyển sang đang sửa chữa'
               WHEN 'HOAT_DONG'       THEN 'Trở lại đang hoạt động'
               WHEN 'SAP_HAN'         THEN 'Chuyển sang sắp hết hạn'
               WHEN 'THANH_LY'        THEN 'Thanh lý, ngừng sử dụng'
               ELSE h.to_status
           END                                         AS tieu_de,
           h.reason                                    AS chi_tiet,
           h.changed_by                                AS nguoi_thuc_hien,
           NULL::varchar(20)                           AS ma_phieu
    FROM equipment_status_history h

    UNION ALL

    SELECT wo.equipment_id,
           COALESCE(wo.completed_at, wo.created_at::timestamp),
           wo.order_type,
           'Hoàn thành phiếu ' || wo.order_type || ' – ' ||
               CASE wo.order_type
                   WHEN 'PM' THEN 'bảo trì định kỳ'
                   WHEN 'SC' THEN 'sửa chữa'
                   WHEN 'HC' THEN 'hiệu chuẩn'
                   ELSE 'kiểm định'
               END,
           'Tiến độ ' || wo.progress || '%. ' || COALESCE(wo.description, ''),
           COALESCE(u.full_name, ''),
           wo.code
    FROM work_orders wo
    LEFT JOIN users u ON u.user_id = wo.assignee_id

    UNION ALL

    SELECT i.equipment_id,
           i.created_at,
           'INCIDENT',
           'Báo hỏng: ' || CASE i.severity WHEN 'KHAN' THEN 'khẩn cấp' ELSE 'sơ bộ' END,
           i.description,
           COALESCE(u.full_name, ''),
           NULL::varchar(20)
    FROM incidents i
    LEFT JOIN users u ON u.user_id = i.reported_by;


/* --- 9.3. Màn "Phiếu công tác" + "Việc của tôi" + "Phiếu của khoa" --- */
CREATE VIEW v_work_orders AS
SELECT  wo.work_order_id,
        wo.code,
        wo.order_type,
        wo.status,
        wo.priority,
        wo.progress,
        wo.created_at,
        wo.deadline,
        (wo.deadline - CURRENT_DATE)::integer                      AS days_to_deadline,
        (wo.deadline < CURRENT_DATE
         AND wo.status NOT IN ('HOAN_THANH'))                     AS is_overdue,
        e.code                                                    AS equipment_code,
        e.name                                                    AS equipment_name,
        e.serial,
        v.department,
        v.department_id,
        e.status                                                  AS equipment_status,
        v.days_left                                               AS calibration_days_left,
        COALESCE(u.full_name, '')                                 AS assignee,
        wo.assignee_id,
        (SELECT count(*) FROM work_order_steps s
          WHERE s.work_order_id = wo.work_order_id)              AS total_steps,
        (SELECT count(*) FROM work_order_steps s
          WHERE s.work_order_id = wo.work_order_id AND s.done)    AS done_steps,
        (SELECT count(*) FROM work_order_steps s
          WHERE s.work_order_id = wo.work_order_id
            AND s.result = 'KHONG_DAT')                           AS failed_steps,
        (SELECT count(*) FROM required_evidence_config c
          WHERE c.order_type = wo.order_type AND c.is_required)   AS evidence_required,
        (SELECT count(DISTINCT ev.evidence_code) FROM evidence ev
          WHERE ev.work_order_id = wo.work_order_id)              AS evidence_provided,
        COALESCE(wo.description, '')                              AS description
FROM work_orders wo
JOIN equipment   e ON e.equipment_id = wo.equipment_id
LEFT JOIN v_equipment v ON v.equipment_id = wo.equipment_id
LEFT JOIN users  u ON u.user_id = wo.assignee_id;


/* --- 9.4. Màn "Admin > Audit Log": kiểm tra toàn vẹn chuỗi hash ---
   row_ok  = hash của dòng này còn khớp nội dung lưu trong CSDL không
   chain_ok= hash của dòng này có nối đúng với dòng trước không
   Nếu ai sửa/xóa bằng tay, hai cột này lập tức lệch. --- */
CREATE VIEW v_audit_chain_verify AS
SELECT  a.audit_id,
        a.occurred_at,
        a.actor,
        a.action,
        a.target,
        a.detail,
        a.prev_hash,
        a.row_hash,
        CASE WHEN fn_bam_audit(a.prev_hash, a.actor, a.action, a.target, a.detail) = a.row_hash
             THEN 1 ELSE 0 END                                     AS row_ok,
        CASE WHEN a.prev_hash = LAG(a.row_hash) OVER (ORDER BY a.audit_id)
                  THEN 1
             WHEN LAG(a.audit_id) OVER (ORDER BY a.audit_id) IS NULL
                  THEN 1        -- dòng đầu tiên: prev_hash phải là 64 số 0
             ELSE 0 END                                              AS chain_ok
FROM audit_log a;


/* --- 9.5. Màn "Bảng điều khiển" (điều phối) --- */
CREATE VIEW v_bang_dieu_khien AS
SELECT  (SELECT count(*) FROM equipment
          WHERE status = 'HOAT_DONG')                             AS thiet_bi_hoat_dong,
        (SELECT count(*) FROM equipment
          WHERE status = 'SAP_HAN')                               AS thiet_bi_sap_han,
        (SELECT count(*) FROM equipment
          WHERE status = 'CHO_HIEU_CHUAN')                        AS thiet_bi_qua_han,
        (SELECT count(*) FROM equipment
          WHERE status = 'DANG_SUA')                              AS thiet_bi_dang_sua,
        (SELECT count(*) FROM equipment
          WHERE status = 'THANH_LY')                              AS thiet_bi_thanh_ly,
        (SELECT count(*) FROM equipment)                           AS tong_thiet_bi,
        (SELECT count(*) FROM work_orders
          WHERE status = 'CHO_PHAN_CONG')                         AS cho_phan_cong,
        (SELECT count(*) FROM work_orders
          WHERE status = 'DANG_THUC_HIEN')                        AS dang_thuc_hien,
        (SELECT count(*) FROM work_orders
          WHERE status = 'CHO_NGHIEM_THU')                        AS cho_nghiem_thu,
        (SELECT count(*) FROM work_orders
          WHERE status = 'HOAN_THANH')                            AS hoan_thanh,
        (SELECT count(*) FROM work_orders
          WHERE status = 'TRA_LAI')                                AS tra_lai,
        (SELECT count(*) FROM work_orders
          WHERE status NOT IN ('HOAN_THANH'))                     AS phieu_dang_mo,
        (SELECT count(*) FROM work_orders
          WHERE deadline < CURRENT_DATE
            AND status NOT IN ('HOAN_THANH'))                     AS phieu_qua_han,
        (SELECT count(*) FROM work_orders
          WHERE priority = 'KHAN' AND status NOT IN ('HOAN_THANH')) AS phieu_khan,
        -- Tỷ lệ PM hoàn thành ĐÚNG HẠN trong 6 tháng gần nhất.
        -- Mẫu số chỉ tính những phiếu ĐÃ hoàn thành — phiếu còn đang mở
        -- thì chưa có kết quả để đánh giá, tính vào sẽ làm sai lệch chỉ số.
        (SELECT CASE WHEN count(*) FILTER (WHERE wo.status = 'HOAN_THANH') = 0 THEN 0
                     ELSE round(100.0 * count(*) FILTER (
                                WHERE wo.status = 'HOAN_THANH'
                                  AND wo.completed_at::date <= wo.deadline)
                            / count(*) FILTER (WHERE wo.status = 'HOAN_THANH'), 1)
                END
         FROM work_orders wo
         WHERE wo.order_type = 'PM'
           AND wo.created_at >= CURRENT_DATE - interval '6 months')  AS pm_on_time_rate_6m,
        (SELECT count(*) FROM work_orders
          WHERE order_type = 'PM' AND status = 'HOAN_THANH')       AS pm_da_hoan_thanh,
        -- Số sự cố 12 tháng gần nhất
        (SELECT count(*) FROM incidents
          WHERE created_at >= now() - interval '12 months')         AS su_co_12_thang,
        -- Số lần bị chặn theo BR-01 — thước đo mức độ tuân thủ luật
        (SELECT count(*) FROM audit_log WHERE action = 'ASSIGN_BLOCKED') AS lan_bi_chan_br01;


/* --- 9.6. Báo cáo hiệu chuẩn --- */
CREATE VIEW v_bao_cao_hieu_chuan AS
SELECT  code, model, manufacturer, department, serial,
        calibration_expiry, days_left, status
FROM v_equipment
WHERE calibration_expiry IS NOT NULL
ORDER BY days_left ASC;


/* --- 9.7. Báo cáo sự cố --- */
CREATE VIEW v_bao_cao_su_co AS
-- Theo model: thiết bị nào hay hỏng nhất
SELECT  'THEO_MODEL'::varchar(20)  AS khoa,
        v.model                  AS ten,
        count(*)                 AS so_luong,
        NULL::integer            AS thang
FROM incidents i
JOIN equipment e ON e.equipment_id = i.equipment_id
JOIN v_equipment v ON v.equipment_id = e.equipment_id
GROUP BY v.model

UNION ALL

-- Theo tháng: xu hướng 12 tháng
SELECT  'THEO_THANG',
        to_char(date_trunc('month', i.created_at), 'MM-YYYY'),
        count(*),
        EXTRACT(YEAR  FROM date_trunc('month', i.created_at))::integer * 100
            + EXTRACT(MONTH FROM date_trunc('month', i.created_at))::integer
FROM incidents i
WHERE i.created_at >= now() - interval '12 months'
GROUP BY date_trunc('month', i.created_at);


/* --- 9.8. Báo cáo PM theo kỹ thuật viên ---
   Hai tỷ lệ tách bạch để không nhầm lẫn:
     completion_rate = đã hoàn thành / tổng phiếu được giao
     on_time_rate   = trong số phiếu ĐÃ hoàn thành, số làm đúng hạn
   ---------------------------------------------------------------- */
CREATE VIEW v_bao_cao_pm AS
SELECT  COALESCE(u.full_name, 'Chưa phân công')    AS technician,
        count(*)                                 AS total,
        count(*) FILTER (WHERE wo.status = 'HOAN_THANH')            AS completed,
        count(*) FILTER (WHERE wo.status = 'HOAN_THANH'
                           AND wo.completed_at::date <= wo.deadline)  AS on_time,
        count(*) FILTER (WHERE wo.status = 'TRA_LAI')                AS returned,
        count(*) FILTER (WHERE wo.status IN ('DANG_THUC_HIEN','CHO_NGHIEM_THU')) AS dang_lam,
        CASE WHEN count(*) = 0 THEN 0
             ELSE round(100.0 * count(*) FILTER (WHERE wo.status = 'HOAN_THANH')
                        / count(*), 1)
        END                                        AS completion_rate,
        CASE WHEN count(*) FILTER (WHERE wo.status = 'HOAN_THANH') = 0 THEN 0
             ELSE round(100.0 * count(*) FILTER (
                        WHERE wo.status = 'HOAN_THANH'
                          AND wo.completed_at::date <= wo.deadline)
                        / count(*) FILTER (WHERE wo.status = 'HOAN_THANH'), 1)
        END                                        AS on_time_rate
FROM work_orders wo
LEFT JOIN users u ON u.user_id = wo.assignee_id
WHERE wo.order_type = 'PM'
GROUP BY u.full_name;


/* --- 9.9. Báo cáo đủ bằng chứng theo phiếu --- */
CREATE VIEW v_bao_cao_bang_chung AS
SELECT  wo.code,
        wo.order_type,
        (SELECT count(*) FROM required_evidence_config c
          WHERE c.order_type = wo.order_type AND c.is_required)   AS required,
        (SELECT count(DISTINCT ev.evidence_code) FROM evidence ev
          WHERE ev.work_order_id = wo.work_order_id)              AS provided,
        (SELECT count(*) FROM required_evidence_config c
          WHERE c.order_type = wo.order_type AND c.is_required)
        = (SELECT count(DISTINCT ev.evidence_code) FROM evidence ev
           WHERE ev.work_order_id = wo.work_order_id)             AS complete
FROM work_orders wo
WHERE wo.status IN ('CHO_NGHIEM_THU','HOAN_THANH');

/* =====================================================================
   MỤC 10. DỮ LIỆU MẪU
   ---------------------------------------------------------------------
   Bối cảnh thời gian: "hôm nay" lấy theo CURRENT_DATE của PostgreSQL.
   Vì vậy dữ liệu được bố trí quanh mốc 29/09/2026: có thiết bị ĐÃ quá
   hạn (để thấy cảnh báo đỏ), SẮP hạn trong 7 ngày (cảnh báo vàng),
   còn hạn (bình thường), và đang sửa chữa.

   Nếu chạy vào một ngày khác, các khoảng "sắp hạn / quá hạn" sẽ dịch
   chuyển theo — đó chính là hành vi đúng của hệ thống theo thời gian.
   ===================================================================== */

/* ---------------------------------------------------------------
   10.1. KHOA PHÒNG  (14 khoa: 10 lâm sàng + 4 chức năng)
   --------------------------------------------------------------- */
INSERT INTO departments (name, is_clinical, address, phone) VALUES
    ('Hóa sinh',            true,  'Tầng 1, khu khám chữa bệnh',   '2401'),
    ('Huyết học',           true,  'Tầng 1, khu khám chữa bệnh',   '2402'),
    ('Hồi sức cấp cứu',     true,  'Tầng 3, khu hồi sức',          '2410'),
    ('Chẩn đoán hình ảnh',  true,  'Tầng 1, khu chẩn đoán hình ảnh','2403'),
    ('Tim mạch',            true,  'Tầng 2, khu nội khoa',         '2420'),
    ('Nhi khoa',            true,  'Tầng 2, khu nhi khoa',          '2421'),
    ('Sản phụ khoa',        true,  'Tầng 3, khu sản phụ khoa',      '2411'),
    ('Ngoại khoa',          true,  'Tầng 4, khu ngoại khoa',       '2430'),
    ('Tai Mũi Răng',        true,  'Tầng 2, khu tai mũi răng',     '2422'),
    ('Mắt',                 true,  'Tầng 2, khu mắt',              '2423'),
    ('Dây chuyền ngoại trú',true,  'Tầng 1, khu khám ngoại trú',   '2404'),
    ('Phòng Vật tư - Thiết bị y tế', false, 'Tầng 1, nhà khối tham mưu', '2450'),
    ('Phòng Quản lý hành chính',   false, 'Tầng 1, khối hành chính', '2210'),
    ('Phòng Công nghệ thông tin',  false, 'Tầng 1, khối kỹ thuật',   '2260');


/* ---------------------------------------------------------------
   10.2. HÃNG SẢN XUẤT (17 hãng)
   --------------------------------------------------------------- */
INSERT INTO manufacturers (name, country, website) VALUES
    ('Mindray',            'Trung Quốc',        'https://www.mindray.com'),
    ('Sysmex',             'Nhật Bản',          'https://www.sysmex.co.jp'),
    ('Hamilton Medical',   'Thụy Sĩ',           'https://www.hamiltonmedical.com'),
    ('GE Healthcare',      'Hoa Kỳ',            'https://www.gehealthcare.com'),
    ('Nihon Kohden',       'Nhật Bản',          'https://www.nihonkohden.com'),
    ('Carestream',         'Hoa Kỳ',            'https://www.carestream.com'),
    ('Eppendorf',          'Đức',              'https://www.eppendorf.com'),
    ('Roche Diagnostics',  'Thụy Sĩ',           'https://www.roche.com'),
    ('Siemens Healthineers','Đức',              'https://www.siemens-healthineers.com'),
    ('Philips',            'Hà Lan',            'https://www.philips.com'),
    ('Baxter',             'Hoa Kỳ',            'https://www.baxter.com'),
    ('Dräger',             'Đức',              'https://www.draeger.com'),
    ('Canon Medical',      'Nhật Bản',          'https://global.canon/en/health'),
    ('Medtronic',          'Hoa Kỳ',            'https://www.medtronic.com'),
    ('Olympus',            'Nhật Bản',          'https://www.olympus.com'),
    ('Stryker',            'Hoa Kỳ',            'https://www.stryker.com'),
    ('Fresenius',          'Đức',              'https://www.freseniusmedicalcare.com');


/* ---------------------------------------------------------------
   10.3. NHÀ CUNG CẤP / ĐƠN VỊ BẢO HÀNH (12 đơn vị)
   --------------------------------------------------------------- */
INSERT INTO suppliers (name, contact_person, phone, contract_no) VALUES
    ('Dräger Vietnam',           'Nguyễn Văn Hùng',    '0903 100 200', 'HD-DR-2024-01'),
    ('Sysmex Vietnam',           'Trần Minh Quân',     '0903 100 201', 'HD-SY-2024-02'),
    ('BMT Medical',              'Lê Thanh Hà',        '0903 100 202', 'HD-BMT-2024-03'),
    ('GE Healthcare Vietnam',    'Phạm Gia Linh',      '0903 100 203', 'HD-GE-2024-04'),
    ('Nihon Kohden Vietnam',     'Đỗ Tuấn Kiệt',       '0903 100 204', 'HD-NK-2024-05'),
    ('Carestream Asia',          'Vũ Đức Trí',         '0903 100 205', 'HD-CS-2024-06'),
    ('Eppendorf Vietnam',        'Hoàng Thanh Tùng',   '0903 100 206', 'HD-EP-2024-07'),
    ('Roche Diagnostics VN',     'Vũ Thị Thu Hà',      '0903 100 207', 'HD-RC-2024-08'),
    ('Siemens Healthineers VN',  'Đặng Quốc Bảo',      '0903 100 208', 'HD-SI-2024-09'),
    ('Philips Vietnam',          'Bùi Thanh Sơn',      '0903 100 209', 'HD-PH-2024-10'),
    ('Medtronic Vietnam',        'Lý Hải Đăng',        '0903 100 210', 'HD-MD-2024-11'),
    ('Công ty Bảo Long Thiết bị Y tế', 'Đỗ Thành Long', '0903 100 211', 'HD-BL-2024-12');


/* ---------------------------------------------------------------
   10.4. MODEL THIẾT BỊ (18 model)

   Hai con số quan trọng nhất của từng model:
     pm_cycle_days    — cứ bao nhiêu ngày phải bảo trì phòng ngừa một lần
     hc_tolerance_pct — sai số đo hiệu chuẩn cho phép (%). Máy đo tay
                        càng cần độ chính xác cao thì dung sai càng nhỏ.
   --------------------------------------------------------------- */
INSERT INTO equipment_models
    (name, manufacturer_id, category, pm_cycle_days, hc_cycle_days, hc_tolerance_pct, notes) VALUES
    ('Mindray BS-240',              1,  'Máy sinh phẩm',        90,  365, 2.50, 'Máy sinh phẩm hóa sinh tự động, 200 test/giờ'),
    ('Sysmex XN-1000',              2,  'Máy huyết học',        60,  365, 2.50, 'Phân tích tế bào máu 5 kênh, tốc độ 80 mẫu/giờ'),
    ('Hamilton G5',                 3,  'Máy thở',              180, 365, 3.00, 'Máy thở chuyên sâu dành cho hồi sức'),
    ('GE LOGIQ E9',                 4,  'Máy siêu âm',          180, 365, 5.00, 'Siêu âm Doppler màu, ứng dụng tim mạch'),
    ('Nihon Kohden ECG-2150',       5,  'Máy điện tim',         180, 365, 5.00, 'Điện tim 12 kênh, in 3 bản sao'),
    ('Carestream DR 600',           6,  'Máy X-quang',          365, 730, 3.00, 'X-quang kỹ thuật số, chụp tổng quang'),
    ('Eppendorf 5430 R',            7,  'Máy ly tâm',           180, 365, 2.00, 'Ly tâm lạnh tốc độ cao, 4.680 vòng/phút'),
    ('Roche cobas e701',            8,  'Máy sinh phẩm',        90,  365, 2.50, 'Sinh phẩm tự động, 800 test/giờ'),
    ('Siemens Atrium',              9,  'Máy tạo lập điện',     180, 730, 4.00, 'Tạo lập điện liên hồi 12 kênh'),
    ('Philips IntelliVue MX750',   10,  'Màn hình theo dõi',    180, 365, 5.00, 'Monitor đa thông số trung tâm ICU'),
    ('Baxter Infusor',             11,  'Bơm tiêm điện',         90,  365, 5.00, 'Bơm tiêm điện 300 ml/h, thuốc độc'),
    ('Dräger Perseus A500',        12,  'Máy gây mê',           180, 365, 3.50, 'Máy gây mê kèm máy thở tích hợp'),
    ('Canon Aplio i800',           13,  'Máy siêu âm',          180, 365, 5.00, 'Siêu âm chuyên sâu, dùng nội soi'),
    ('Medtronic PurFiltr',         14,  'Máy lọc máu',           90,  365, 3.00, 'Lọc máu liên tục, dùng hồi sức'),
    ('Olympus CV-190',             15,  'Máy nội soi',          180, 730, 4.00, 'Nội soi dạ dày – ruột'),
    ('Stryker Prime Series',      16,  'Đèn mổ',               365, 730, 5.00, 'Đèn mổ trần, độ rọi 160.000 lux'),
    ('Fresenius 4008 Dialysis',   17,  'Máy lọc máu',           90,  365, 3.00, 'Thận nhân tạo, lọc màng HDF'),
    ('Mindray WATO EX-65',         1,  'Máy gây mê',           180, 365, 3.50, 'Máy gây mê kỹ thuật số dùng cho sản phụ khoa');


/* ---------------------------------------------------------------
   10.5. NGƯỜI DÙNG (15 tài khoản, đủ 4 vai trò)
   --------------------------------------------------------------- */
INSERT INTO users
    (username, full_name, email, employee_no, role, department_id, phone, last_login, is_active) VALUES
    ('minhvt',   'Nguyễn Minh Vĩnh Thịnh', 'minhvt@bvtw.vn',   'NV001', 'KY_THUAT_VIEN', 12, '0912 001 101', '2026-09-29 07:42', true),
    ('hungtv',   'Trần Văn Hùng',          'hungtv@bvtw.vn',   'NV002', 'KY_THUAT_VIEN', 12, '0912 001 102', '2026-09-29 07:20', true),
    ('lthimai',  'Lê Thị Mai',             'lthimai@bvtw.vn',  'NV003', 'KY_THUAT_VIEN', 12, '0912 001 103', '2026-09-28 16:45', true),
    ('bichlan',  'Đỗ Thị Bích Lan',        'bichlan@bvtw.vn',  'NV004', 'KY_THUAT_VIEN', 12, '0912 001 104', '2026-09-29 08:05', true),
    ('quanghai', 'Nguyễn Quang Hải',       'quanghai@bvtw.vn', 'NV005', 'KY_THUAT_VIEN', 12, '0912 001 105', '2026-09-27 14:10', true),
    ('thanhson', 'Vũ Thanh Sơn',           'thanhson@bvtw.vn', 'NV006', 'KY_THUAT_VIEN', 12, '0912 001 106', '2026-08-30 09:00', false),
    ('dphuong',  'Phạm Thị Diễm Phương',  'dphuong@bvtw.vn',  'NV010', 'DIEU_PHOI',     12, '0912 001 201', '2026-09-29 08:02', true),
    ('ducvu',    'Nguyễn Đức Vũ',          'ducvu@bvtw.vn',    'NV011', 'DIEU_PHOI',     12, '0912 001 202', '2026-09-29 08:18', true),
    ('vanna',    'Nguyễn Thị Ánh Vân',     'vanna@bvtw.vn',    'NV020', 'DAU_MOI_KHOA',   1, '0912 001 301', '2026-09-29 07:55', true),
    ('khaibq',   'Bùi Quang Khải',         'khaibq@bvtw.vn',   'NV021', 'DAU_MOI_KHOA',   3, '0912 001 302', '2026-09-26 09:10', true),
    ('thuytrang','Phạm Thùy Trang',        'thuytrang@bvtw.vn','NV022', 'DAU_MOI_KHOA',   6, '0912 001 303', '2026-09-28 10:22', true),
    ('hoangminh','Lê Hoàng Minh',          'hoangminh@bvtw.vn','NV023', 'DAU_MOI_KHOA',   9, '0912 001 304', '2026-09-25 15:40', true),
    ('thanhthuy','Ngô Thanh Thùy',         'thanhthuy@bvtw.vn','NV024', 'DAU_MOI_KHOA',   4, '0912 001 305', '2026-09-29 08:30', true),
    ('ngocttb',  'Trịnh Thị Bích Ngọc',    'ngocttb@bvtw.vn',  'NV025', 'DAU_MOI_KHOA',   5, '0912 001 306', '2026-07-15 11:20', false),
    ('longhduc', 'Hoàng Đức Long',          'longhduc@bvtw.vn', 'NV001', 'ADMIN',         14, '0912 001 001', '2026-09-29 08:00', true);


/* ---------------------------------------------------------------
   10.6. THIẾT BỊ (45 máy, trải đều 11 khoa lâm sàng)

   Bố trí trạng thái có chủ đích để mỗi màn giao diện đều có dữ liệu
   đẹp để trình diễn:
     • 6 máy ĐÃ quá hạn hiệu chuẩn  → cảnh báo đỏ, BR-01 chặn phân công
     • 6 máy SẮP hết hạn            → cảnh báo vàng
     • 3 máy ĐANG SỬA CHỮA
     • 1 máy THANH LÝ (đã thu hồi)
     • phần còn lại hoạt động bình thường
   --------------------------------------------------------------- */
INSERT INTO equipment
    (code, name, model_id, serial, department_id, location, status,
     calibration_expiry, next_pm, import_date, warranty_months, purchase_price, maintenance_supplier_id, notes) VALUES
    -- HÓA SINH (khoa 1) — có cả máy quá hạn để demo chặn BR-01
    ('DEV-001','Máy sinh phẩm BS-240 số 1',1,'SN-12345',1,'Phòng thí nghiệm số 1','HOAT_DONG',     '2027-02-15','2026-11-10','2022-03-15',24, 1850000000,1,NULL),
    ('DEV-002','Máy sinh phẩm BS-240 số 2',1,'SN-12346',1,'Phòng thí nghiệm số 1','CHO_HIEU_CHUAN','2026-08-01',NULL,      '2022-03-15',24, 1850000000,1,'Chứng thư VC-2026-0112 đã hết hạn — chờ kỹ thuật viên hiệu chuẩn lại'),
    ('DEV-008','Máy ly tâm 5430 R số 1',   7,'SN-20034',1,'Phòng thí nghiệm số 1','HOAT_DONG',     '2027-01-12','2027-01-12','2023-01-30',12,  420000000,7,NULL),
    ('DEV-025','Máy sinh phẩm BS-240 số 3',1,'SN-12347',1,'Phòng thí nghiệm số 2','HOAT_DONG',     '2027-04-30','2026-11-30','2023-04-30',24, 1850000000,1,NULL),
    ('DEV-029','Máy ly tâm 5430 R số 2',   7,'SN-20035',1,'Phòng thí nghiệm số 2','SAP_HAN',       '2026-11-30','2026-11-30','2022-11-30',24,  420000000,7,NULL),
    ('DEV-042','Máy ly tâm 5430 R số 3',   7,'SN-20036',1,'Phòng thí nghiệm số 2','SAP_HAN',       '2026-09-29','2026-09-29','2022-01-15',24,  420000000,7,'Đến hạn hiệu chuẩn đúng hôm nay — cần ưu tiên lên lịch'),
    ('DEV-009','Máy sinh phẩm cobas e701 số 1',8,'SN-30871',1,'Phòng thí nghiệm số 3','SAP_HAN',  '2026-10-03','2026-10-25','2022-05-18',24, 2450000000,8,'Còn 4 ngày đến hạn — ưu tiên cao'),
    ('DEV-010','Máy sinh phẩm cobas e701 số 2',8,'SN-30872',1,'Phòng thí nghiệm số 3','HOAT_DONG','2027-03-10','2027-03-10','2023-03-10',24, 2450000000,8,NULL),
    ('DEV-043','Máy sinh phẩm cobas e701 số 3',8,'SN-30873',1,'Phòng thí nghiệm số 3','HOAT_DONG','2027-08-19','2027-02-19','2023-08-19',24, 2450000000,8,NULL),
    -- HUYẾT HỌC (khoa 2)
    ('DEV-003','Máy huyết học XN-1000 số 1',2,'SN-00912',2,'Phòng huyết học','DANG_SUA',           '2026-11-20',NULL,      '2021-06-08',36, 3100000000,2,'Bơm hút bị nghẹt — đang chờ linh kiện thay thế từ nhà cung cấp'),
    ('DEV-023','Máy huyết học XN-1000 số 2',2,'SN-00913',2,'Phòng huyết học','HOAT_DONG',          '2027-02-14','2026-11-14','2022-02-14',36, 3100000000,2,NULL),
    ('DEV-024','Máy huyết học XN-1000 số 3',2,'SN-00914',2,'Phòng huyết học','SAP_HAN',            '2026-10-28','2026-10-28','2020-11-20',36, 3100000000,2,NULL),
    ('DEV-040','Máy huyết học XN-1000 số 4',2,'SN-00915',2,'Phòng huyết học','HOAT_DONG',          '2027-06-14','2026-12-14','2022-06-14',36, 3100000000,2,NULL),
    -- HỒI SỨC CẤP CỨU (khoa 3)
    ('DEV-004','Máy thở Hamilton G5 số 1', 3,'SN-44210',3,'Buồng hồi sức 1','SAP_HAN',       '2026-10-18','2026-10-18','2020-09-01',24, 5200000000,3,NULL),
    ('DEV-012','Monitor IntelliVue MX750 số 1',10,'SN-66740',3,'Buồng hồi sức 1','HOAT_DONG',   '2027-01-20','2027-01-20','2022-10-11',24, 980000000,10,NULL),
    ('DEV-013','Monitor IntelliVue MX750 số 2',10,'SN-66741',3,'Buồng hồi sức 2','SAP_HAN',     '2026-10-20','2026-10-20','2021-11-02',24, 980000000,10,NULL),
    ('DEV-014','Bơm tiêm điện Baxter Infusor số 1',11,'SN-77451',3,'Buồng hồi sức 1','HOAT_DONG','2027-02-28','2026-11-28','2023-02-28',12, 380000000,11,NULL),
    ('DEV-018','Máy lọc máu PurFiltr số 1',14,'SN-44310',3,'Buồng lọc máu','CHO_HIEU_CHUAN',  '2026-09-10',NULL,      '2021-04-25',24, 4600000000,11,'Có máy lọc máu dự phòng DEV-034 nên tạm khoá, không ảnh hưởng lâm sàng'),
    ('DEV-021','Máy lọc máu 4008 số 1',   17,'SN-33220',3,'Buồng lọc máu','SAP_HAN',         '2026-10-25','2026-10-25','2021-12-01',24, 4200000000,11,NULL),
    ('DEV-033','Bơm tiêm điện Baxter Infusor số 2',11,'SN-77452',3,'Buồng hồi sức 2','CHO_HIEU_CHUAN','2026-07-15',NULL,  '2020-08-30',12, 380000000,11,'Quá hạn lâu nhất trong bệnh viện — cần lên lịch hiệu chuẩn gấp'),
    ('DEV-034','Máy lọc máu 4008 số 2',   17,'SN-33221',3,'Buồng lọc máu','HOAT_DONG',        '2027-05-22','2026-11-22','2021-05-22',24, 4200000000,11,NULL),
    ('DEV-037','Máy thở Hamilton G5 số 2',3,'SN-44211',3,'Buồng hồi sức 3','HOAT_DONG',       '2027-03-11','2026-09-11','2021-03-11',24, 5200000000,3,NULL),
    ('DEV-038','Máy thở Hamilton G5 số 3',3,'SN-44212',3,'Buồng hồi sức 3','CHO_HIEU_CHUAN',  '2026-09-20',NULL,      '2020-06-18',24, 5200000000,3,'Chỉ còn 1 máy thở hoạt động trong khoa — rủi ro lâm sàng, cần xử lý gấp'),
    -- CHẨN ĐOÁN HÌNH ẢNH (khoa 4)
    ('DEV-005','Máy siêu âm LOGIQ E9 số 1',4,'SN-78123',4,'Phòng siêu âm 1','HOAT_DONG',     '2027-04-05','2027-04-05','2023-04-20',24, 3200000000,4,NULL),
    ('DEV-007','Máy X-quang DR 600 số 1',  6,'SN-55820',4,'Phòng chụp X-quang','CHO_HIEU_CHUAN','2026-08-10',NULL,  '2020-07-14',36, 2900000000,6,'Tự động khóa do quá hạn 50 ngày'),
    ('DEV-016','Máy siêu âm Aplio i800 số 1',13,'SN-11560',4,'Phòng siêu âm 1','HOAT_DONG',   '2027-07-20','2027-01-20','2023-07-20',24, 3400000000,4,NULL),
    ('DEV-017','Máy siêu âm Aplio i800 số 2',13,'SN-11561',4,'Phòng siêu âm 2','DANG_SUA',     '2026-12-05',NULL,        '2022-09-12',24, 3400000000,4,'Đầu dò bị nứt, đang chờ gửi bảo hành'),
    ('DEV-028','Máy siêu âm LOGIQ E9 số 2',4,'SN-78124',4,'Phòng siêu âm 2','HOAT_DONG',     '2027-06-05','2026-12-05','2023-06-05',24, 3200000000,4,NULL),
    ('DEV-045','Máy X-quang DR 600 số 2',  6,'SN-55821',4,'Phòng chụp X-quang','HOAT_DONG',  '2028-02-14','2027-02-14','2022-02-14',36, 2900000000,6,NULL),
    -- TIM MẠCH (khoa 5)
    ('DEV-006','Máy điện tim ECG-2150 số 1',5,'SN-33901',5,'Phòng thăm dò chức năng','HOAT_DONG',   '2026-12-29','2026-12-29','2022-12-10',24, 480000000,5,NULL),
    ('DEV-011','Máy tạo lập điện Atrium số 1',9,'SN-91120',5,'Phòng can thiệp tim mạch','HOAT_DONG','2027-06-30','2026-12-10','2021-08-05',36, 1500000000,9,NULL),
    ('DEV-026','Máy điện tim ECG-2150 số 2',5,'SN-33902',5,'Phòng thăm dò chức năng','HOAT_DONG',  '2027-05-18','2026-11-18','2022-11-18',24, 480000000,5,NULL),
    ('DEV-027','Máy điện tim ECG-2150 số 3',5,'SN-33903',5,'Kho lưu trữ thiết bị',    'THANH_LY',   '2026-06-30',NULL,        '2018-03-15',24, 480000000,5,'Hỏng vĩnh viễn, đã lập biên bản thanh lý số 15/2026'),
    ('DEV-032','Máy tạo lập điện Atrium số 2',9,'SN-91121',5,'Phòng can thiệp tim mạch','DANG_SUA','2026-12-18',NULL,        '2021-02-11',36, 1500000000,9,'Bộ phát xung bị rò rỉ, đang thay thế'),
    ('DEV-041','Máy điện tim ECG-2150 số 4',5,'SN-33904',5,'Phòng thăm dò chức năng','HOAT_DONG',  '2027-08-08','2026-11-08','2023-08-08',24, 480000000,5,NULL),
    -- NHI KHOA (khoa 6)
    ('DEV-031','Monitor IntelliVue MX750 số 3',10,'SN-66742',6,'Buồng nhi cấp cứu','HOAT_DONG',  '2027-02-08','2026-11-08','2023-02-08',24, 980000000,10,NULL),
    -- SẢN PHỤ KHOA (khoa 7)
    ('DEV-015','Máy gây mê Perseus A500 số 1',12,'SN-88320',7,'Phòng mổ sản phụ khoa 1','HOAT_DONG',   '2027-05-15','2026-11-15','2022-05-15',24, 3900000000,12,NULL),
    ('DEV-022','Máy gây mê WATO EX-65 số 1',18,'SN-66070',7,'Phòng mổ sản phụ khoa 2','HOAT_DONG',   '2027-03-25','2026-09-25','2023-03-25',24, 3400000000,1,NULL),
    ('DEV-036','Máy siêu âm Aplio i800 số 3',13,'SN-11562',7,'Phòng siêu âm sản phụ khoa','SAP_HAN','2026-10-05','2026-10-05','2022-10-05',24, 3400000000,4,NULL),
    ('DEV-044','Máy gây mê Perseus A500 số 2',12,'SN-88321',7,'Phòng mổ sản phụ khoa 1','SAP_HAN',   '2026-10-12','2026-10-12','2021-10-12',24, 3900000000,12,NULL),
    -- NGOẠI KHOA (khoa 8)
    ('DEV-020','Đèn mổ Stryker Prime số 1',16,'SN-55080',8,'Phòng mổ ngoại khoa 1','HOAT_DONG',   '2027-09-15','2027-03-15','2023-09-15',24, 2700000000,12,NULL),
    -- TAI MŨI RẰNG (khoa 9)
    ('DEV-019','Máy nội soi CV-190 số 1',15,'SN-90021',9,'Phòng nội soi TMH','HOAT_DONG',     '2027-08-30','2026-11-30','2022-08-30',36, 1900000000,12,NULL),
    -- MẮT (khoa 10)
    ('DEV-035','Máy gây mê WATO EX-65 số 2',18,'SN-66071',10,'Phòng mổ mắt','HOAT_DONG',    '2027-04-11','2026-10-11','2023-04-11',24, 3400000000,1,NULL),
    -- DÂY CHUYỀN NGOẠI TRÚ (khoa 11)
    ('DEV-030','Máy sinh phẩm cobas e701 số 4',8,'SN-30874',11,'Phòng lấy mẫu ngoại trú','HOAT_DONG','2027-07-01','2027-01-01','2023-07-01',24, 2450000000,8,NULL),
    ('DEV-039','Máy sinh phẩm BS-240 số 4',1,'SN-12348',11,'Phòng lấy mẫu ngoại trú','HOAT_DONG','2027-01-25','2026-10-25','2023-01-25',24, 1850000000,1,NULL);

/* ---------------------------------------------------------------
   10.6.1. TƯƠNG ĐỐI HOÁ "HÔM NAY CỦA KỊCH BẢN"  (T0 = 2026-09-29)

   Mọi hạn hiệu chuẩn / hạn PM phía trên được viết theo ngày tuyệt
   đối quanh T0. Nạp script vào một ngày khác thì số máy "quá hạn /
   sắp hạn" lệch khỏi thiết kế, và tệ hơn: trigger BR-01 (MỤC 8.4)
   từ chối phiếu PM/SC trỏ tới máy đã quá hạn → script không nạp được.
   Cách xử lý: dồn T0 về CURRENT_DATE, giữ nguyên mọi khoảng cách
   tương đối của câu chuyện (máy "đến hạn hôm nay" vẫn đến hạn hôm
   nay, máy "còn 4 ngày" vẫn còn 4 ngày...):

       ngày mới = CURRENT_DATE + (ngày cũ − DATE '2026-09-29')

   Phải chạy TRƯỚC khối INSERT phiếu công tác để trigger BR-01 đọc
   ngày đã dịch, nhờ đó script nạp được bằng psql thuần (không cần
   tắt trigger) vào bất kỳ ngày nào.
   --------------------------------------------------------------- */
DO $shift_seed$
DECLARE d integer := CURRENT_DATE - DATE '2026-09-29';
BEGIN
    IF d <> 0 THEN
        UPDATE equipment
        SET calibration_expiry = calibration_expiry + d,
            next_pm            = next_pm + d;
    END IF;
END
$shift_seed$;


/* ---------------------------------------------------------------
   10.7. QUY TẮC BẰNG CHỨNG BẮT BUỘC THEO LOẠI PHIẾU
   Bảng này điều khiển việc phiếu có được phép chuyển sang "Chờ nghiệm
   thu" hay chưa — khớp màn "Admin > Cấu hình hệ thống".
   --------------------------------------------------------------- */
INSERT INTO required_evidence_config
    (order_type, evidence_code, label, is_required, max_files, accept_mime, sort_order) VALUES
    -- Hiệu chuẩn: bắt buộc đủ 4 nhóm, thiếu 1 là trả lại phiếu
    ('HC','ANH_TRUOC',      'Ảnh thiết bị trước khi hiệu chuẩn',  true,  3, 'image/jpeg,image/png',          1),
    ('HC','ANH_KET_QUA',    'Ảnh kết quả chuẩn hóa',           true,  3, 'image/jpeg,image/png',          2),
    ('HC','ANH_TEM',        'Ảnh tem hiệu chuẩn mới dán',      true,  1, 'image/jpeg,image/png',          3),
    ('HC','CHUNG_CHI_PDF',  'Chứng chỉ hiệu chuẩn (PDF)',     true,  1, 'application/pdf',               4),
    -- Sửa chữa: chứng minh trước – sau và linh kiện thay thế
    ('SC','ANH_TRUOC_SUA',  'Ảnh thiết bị trước khi sửa chữa', true,  3, 'image/jpeg,image/png',          1),
    ('SC','ANH_SAU_SUA',    'Ảnh thiết bị sau khi sửa chữa',   true,  3, 'image/jpeg,image/png',          2),
    ('SC','BIEN_BAN_LK',    'Biên bản thay linh kiện (PDF)',    true,  1, 'application/pdf',               3),
    -- Bảo trì định kỳ: nhẹ hơn, biên bản không bắt buộc
    ('PM','ANH_NHOM_BUOC',  'Ảnh từng nhóm bước đã thực hiện',  true,  5, 'image/jpeg,image/png',          1),
    ('PM','CHECKLIST_DAY_DU','Checklist hoàn thành 100% (PDF)',  true,  1, 'application/pdf',               2),
    ('PM','BIEN_BAN_TAM_NGHI','Biên bản tạm ngưng thiết bị',   false, 1, 'application/pdf',               3),
    -- Kiểm định: theo quy định pháp lý về kiểm định thiết bị y tế
    ('KT','HO_SO_KY_THUAT', 'Hồ sơ kỹ thuật và phụ kiện kèm theo', true, 1, 'application/pdf',            1),
    ('KT','ANH_THIET_BI',   'Ảnh thiết bị tại thời điểm kiểm định', true, 3, 'image/jpeg,image/png',        2),
    ('KT','BAO_CAO_KIEM_DINH','Báo cáo kết quả kiểm định (PDF)', true, 1, 'application/pdf',              3);

/* ---------------------------------------------------------------
   10.8. PHIẾU CÔNG TÁC (46 phiếu)

   Phân bố theo trạng thái để mỗi màn giao diện đều có dữ liệu:
     • Chờ phân công  — màn Lịch bảo trì (kéo-thả phân công)
     • Đang thực hiện — màn Việc của tôi của kỹ thuật viên
     • Chờ nghiệm thu — màn Nghiệm thu của điều phối
     • Hoàn thành     — lịch sử, báo cáo PM
     • Trả lại        — phiếu bị nghiệm thu trả về làm lại

   LƯU Ý: mọi phiếu PM/SC ở đây đều trỏ tới thiết bị CHƯA quá hạn
   hiệu chuẩn. Nếu không, trigger BR-01 (MỤC 8.4) sẽ từ chối — đó
   chính là bằng chứng luật đang hoạt động đúng.
   --------------------------------------------------------------- */
INSERT INTO work_orders
    (code, order_type, equipment_id, department_id, assignee_id, status, priority,
     created_at, deadline, progress, description)
SELECT  t.code, t.order_type, e.equipment_id, e.department_id, u.user_id,
        t.status, t.priority, t.created_at, t.deadline, t.progress, t.description
FROM (VALUES
    -- ============ PHIẾU HIỆU CHUẨN (HC) — 8 phiếu ============
    ('HC-2026-0087','HC','DEV-002','minhvt', 'DANG_THUC_HIEN','KHAN',      DATE '2026-09-02', DATE '2026-09-25', 40,'Hiệu chuẩn lại sau khi quá hạn 59 ngày — phục vụ xét nghiệm hóa sinh'),
    ('HC-2026-0091','HC','DEV-007','lthimai','CHO_PHAN_CONG', 'KHAN',      DATE '2026-09-21', DATE '2026-09-28',  0,'Hiệu chuẩn máy X-quang, chứng thư cũ đã hết hạn 50 ngày'),
    ('HC-2026-0092','HC','DEV-033','hungtv', 'CHO_PHAN_CONG', 'KHAN',      DATE '2026-09-22', DATE '2026-10-02',  0,'Bơm tiêm điện hồi sức quá hạn — cần hiệu chuẩn gấp do thiếu máy dự phòng'),
    ('HC-2026-0093','HC','DEV-018','bichlan','CHO_NGHIEM_THU','BINH_THUONG',DATE '2026-09-05', DATE '2026-09-20',100,'Hiệu chuẩn máy lọc máu, đã đo đạt 3/3 mức chuẩn'),
    ('HC-2026-0094','HC','DEV-038','quanghai','TRA_LAI',      'KHAN',      DATE '2026-09-10', DATE '2026-09-24', 80,'Hiệu chuẩn máy thở — chuẩn cao lệch 4,0% vượt dung sai, nghiệm thu trả lại'),
    ('HC-2026-0095','HC','DEV-021','hungtv', 'HOAN_THANH',    'BINH_THUONG',DATE '2026-08-20', DATE '2026-09-01',100,'Hiệu chuẩn định kỳ máy lọc máu 4008'),
    ('HC-2026-0096','HC','DEV-009','minhvt', 'CHO_PHAN_CONG', 'KHAN',      DATE '2026-09-28', DATE '2026-10-10',  0,'Còn 4 ngày đến hạn hiệu chuẩn — lên lịch trước khi quá hạn'),
    ('HC-2026-0097','HC','DEV-036','bichlan','DANG_THUC_HIEN','KHAN',      DATE '2026-09-20', DATE '2026-10-05', 60,'Hiệu chuẩn máy siêu âm sản phụ khoa, còn 6 ngày đến hạn'),

    -- ============ PHIẾU BẢO TRÌ ĐỊNH KỲ (PM) — 25 phiếu ============
    ('PM-2026-0195','PM','DEV-005','minhvt', 'CHO_NGHIEM_THU','BINH_THUONG',DATE '2026-09-10', DATE '2026-09-20',100,'Bảo trì định kỳ máy siêu âm LOGIQ E9, đủ 5/5 bước'),
    ('PM-2026-0201','PM','DEV-004','hungtv', 'CHO_PHAN_CONG', 'BINH_THUONG',DATE '2026-09-20', DATE '2026-10-10',  0,'Bảo trì định kỳ máy thở Hamilton G5 theo chu kỳ 180 ngày'),
    ('PM-2026-0202','PM','DEV-012','lthimai','DANG_THUC_HIEN','BINH_THUONG',DATE '2026-09-18', DATE '2026-10-05', 40,'Bảo trì định kỳ monitor trung tâm ICU số 1'),
    ('PM-2026-0203','PM','DEV-006','quanghai','HOAN_THANH',   'BINH_THUONG',DATE '2026-08-15', DATE '2026-09-01',100,'Bảo trì định kỳ máy điện tim ECG-2150'),
    ('PM-2026-0204','PM','DEV-016','minhvt', 'HOAN_THANH',    'BINH_THUONG',DATE '2026-08-20', DATE '2026-09-05',100,'Bảo trì định kỳ máy siêu âm Aplio i800'),
    ('PM-2026-0205','PM','DEV-011','hungtv', 'DANG_THUC_HIEN','BINH_THUONG',DATE '2026-09-15', DATE '2026-10-12', 20,'Bảo trì định kỳ máy tạo lập điện Atrium'),
    ('PM-2026-0206','PM','DEV-015','bichlan','HOAN_THANH',    'BINH_THUONG',DATE '2026-08-25', DATE '2026-09-10',100,'Bảo trì định kỳ máy gây mê Perseus A500'),
    ('PM-2026-0207','PM','DEV-020','quanghai','CHO_PHAN_CONG','BINH_THUONG',DATE '2026-09-25', DATE '2026-11-20',  0,'Bảo trì định kỳ đèn mổ, chu kỳ 365 ngày'),
    ('PM-2026-0208','PM','DEV-031','lthimai','HOAN_THANH',    'BINH_THUONG',DATE '2026-08-10', DATE '2026-08-28',100,'Bảo trì định kỳ monitor nhi khoa'),
    ('PM-2026-0209','PM','DEV-025','minhvt', 'HOAN_THANH',    'BINH_THUONG',DATE '2026-09-01', DATE '2026-09-15',100,'Bảo trì định kỳ máy sinh phẩm BS-240 số 3'),
    ('PM-2026-0210','PM','DEV-014','hungtv', 'CHO_PHAN_CONG', 'KHAN',      DATE '2026-09-27', DATE '2026-10-20',  0,'Bảo trì gấp bơm tiêm điện truyền thuốc độc tại hồi sức'),
    ('PM-2026-0211','PM','DEV-023','bichlan','HOAN_THANH',    'BINH_THUONG',DATE '2026-08-12', DATE '2026-08-30',100,'Bảo trì định kỳ máy huyết học XN-1000 số 2'),
    ('PM-2026-0212','PM','DEV-022','quanghai','DANG_THUC_HIEN','BINH_THUONG',DATE '2026-09-22', DATE '2026-10-18', 40,'Bảo trì định kỳ máy gây mê WATO EX-65'),
    ('PM-2026-0213','PM','DEV-044','lthimai','CHO_PHAN_CONG', 'KHAN',      DATE '2026-09-28', DATE '2026-10-15',  0,'Bảo trì gấp máy gây mê sản phụ khoa số 2'),
    ('PM-2026-0214','PM','DEV-010','minhvt', 'HOAN_THANH',    'BINH_THUONG',DATE '2026-08-18', DATE '2026-09-02',100,'Bảo trì định kỳ máy sinh phẩm cobas e701 số 2'),
    ('PM-2026-0215','PM','DEV-019','hungtv', 'CHO_PHAN_CONG', 'BINH_THUONG',DATE '2026-09-24', DATE '2026-12-20',  0,'Bảo trì định kỳ máy nội soi CV-190, chu kỳ 180 ngày'),
    ('PM-2026-0216','PM','DEV-030','bichlan','HOAN_THANH',    'BINH_THUONG',DATE '2026-08-28', DATE '2026-09-12',100,'Bảo trì định kỳ máy sinh phẩm khoa ngoại trú'),
    ('PM-2026-0217','PM','DEV-026','quanghai','CHO_PHAN_CONG','BINH_THUONG',DATE '2026-09-26', DATE '2026-12-20',  0,'Bảo trì định kỳ máy điện tim ECG-2150 số 2'),
    ('PM-2026-0218','PM','DEV-035','lthimai','HOAN_THANH',    'BINH_THUONG',DATE '2026-09-05', DATE '2026-09-18',100,'Bảo trì định kỳ máy gây mê khoa mắt'),
    ('PM-2026-0219','PM','DEV-037','hungtv', 'HOAN_THANH',    'BINH_THUONG',DATE '2026-08-30', DATE '2026-09-10',100,'Bảo trì định kỳ máy thở Hamilton G5 số 2'),
    ('PM-2026-0220','PM','DEV-034','minhvt', 'CHO_PHAN_CONG', 'KHAN',      DATE '2026-09-28', DATE '2026-10-10',  0,'Bảo trì gấp máy lọc máu dự phòng của hồi sức'),
    ('PM-2026-0221','PM','DEV-040','bichlan','CHO_PHAN_CONG', 'BINH_THUONG',DATE '2026-09-26', DATE '2026-11-25',  0,'Bảo trì định kỳ máy huyết học XN-1000 số 4'),
    ('PM-2026-0222','PM','DEV-028','quanghai','HOAN_THANH',   'BINH_THUONG',DATE '2026-08-22', DATE '2026-09-06',100,'Bảo trì định kỳ máy siêu âm LOGIQ E9 số 2'),
    ('PM-2026-0223','PM','DEV-045','hungtv', 'CHO_PHAN_CONG', 'BINH_THUONG',DATE '2026-09-29', DATE '2028-02-01',  0,'Bảo trì định kỳ máy X-quang DR 600 số 2'),
    ('PM-2026-0224','PM','DEV-041','lthimai','HOAN_THANH',    'BINH_THUONG',DATE '2026-09-02', DATE '2026-09-16',100,'Bảo trì định kỳ máy điện tim ECG-2150 số 4'),
    ('PM-2026-0225','PM','DEV-029','minhvt', 'CHO_PHAN_CONG', 'BINH_THUONG',DATE '2026-09-27', DATE '2026-11-30',  0,'Bảo trì định kỳ máy ly tâm 5430 R số 2'),

    -- ============ PHIẾU SỬA CHỮA (SC) — 9 phiếu ============
    ('SC-2026-0102','SC','DEV-003','hungtv', 'DANG_THUC_HIEN','KHAN',      DATE '2026-09-18', DATE '2026-09-26', 70,'Bơm hút mẫu bị nghẹt — chờ linh kiện thay thế từ Sysmex'),
    ('SC-2026-0088','SC','DEV-024',NULL,      'CHO_PHAN_CONG', 'KHAN',      DATE '2026-09-15', DATE '2026-09-30',  0,'Máy huyết học báo lỗi tắc đường hút mẫu, cần kỹ thuật viên xử lý'),
    ('SC-2026-0103','SC','DEV-032','quanghai','DANG_THUC_HIEN','KHAN',      DATE '2026-09-20', DATE '2026-10-05', 40,'Bộ phát xung bị rò rỉ — thay thế linh kiện'),
    ('SC-2026-0104','SC','DEV-017','lthimai','CHO_PHAN_CONG', 'KHAN',      DATE '2026-09-24', DATE '2026-10-15',  0,'Đầu dò siêu âm bị nứt — đang chờ bảo hành Canon'),
    ('SC-2026-0105','SC','DEV-013','hungtv', 'HOAN_THANH',    'KHAN',      DATE '2026-08-28', DATE '2026-09-10',100,'Monitor hồi sức mất tín hiệu ECG — đã thay cáp và module'),
    ('SC-2026-0106','SC','DEV-005','minhvt', 'HOAN_THANH',    'KHAN',      DATE '2026-08-15', DATE '2026-08-25',100,'Máy siêu âm bị nhiễu hình ảnh — vệ sinh đầu dò, thay gel'),
    ('SC-2026-0107','SC','DEV-012','bichlan','TRA_LAI',      'KHAN',      DATE '2026-09-08', DATE '2026-09-20', 80,'Monitor ICU số 1 mất tín hiệu — thiếu ảnh sau sửa nên trả lại'),
    ('SC-2026-0108','SC','DEV-006','quanghai','HOAN_THANH',   'BINH_THUONG',DATE '2026-08-20', DATE '2026-09-01',100,'Máy điện tim in mờ — thay bộ giấy và làm sạch đầu ghi'),
    ('SC-2026-0109','SC','DEV-025','hungtv', 'HOAN_THANH',    'BINH_THUONG',DATE '2026-08-25', DATE '2026-09-05',100,'Máy sinh phẩm báo nghẽn ống hút — thay ống và vệ sinh'),

    -- ============ PHIẾU KIỂM ĐỊNH (KT) — 4 phiếu ============
    ('KT-2026-0031','KT','DEV-016','lthimai','DANG_THUC_HIEN','BINH_THUONG',DATE '2026-09-12', DATE '2026-10-12', 40,'Kiểm định máy siêu âm theo quy định pháp lý về thiết bị y tế'),
    ('KT-2026-0032','KT','DEV-020','hungtv', 'CHO_PHAN_CONG', 'BINH_THUONG',DATE '2026-09-25', DATE '2026-11-25',  0,'Kiểm định đèn mổ — hồ sơ kỹ thuật cần bổ sung'),
    ('KT-2026-0033','KT','DEV-007','quanghai','CHO_PHAN_CONG','BINH_THUONG',DATE '2026-09-26', DATE '2026-12-26',  0,'Kiểm định máy X-quang kèm hiệu chuẩn trong cùng đợt'),
    ('KT-2026-0034','KT','DEV-015','bichlan','HOAN_THANH',   'BINH_THUONG',DATE '2026-08-10', DATE '2026-10-10',100,'Kiểm định máy gây mê, đạt yêu cầu về độ chính xác')
) AS t(code, order_type, equip_code, assignee, status, priority, created_at, deadline, progress, description)
JOIN equipment e ON e.code = t.equip_code
LEFT JOIN users u ON u.username = t.assignee
WHERE t.code IS NOT NULL AND t.status IS NOT NULL;

-- 10.8.1. Dịch created_at/deadline của phiếu theo cùng độ lệch T0 như
-- thiết bị (10.6.1). Đặt TRƯỚC khối "ghi thời điểm hoàn thành" và trước
-- các INSERT checklist/bằng chứng/phân công vì tất cả đều PHÁI SINH từ
-- hai cột này — dịch sớm thì cả chuỗi tự dịch theo, không phải sửa từng bảng.
DO $shift_seed$
DECLARE d integer := CURRENT_DATE - DATE '2026-09-29';
BEGIN
    IF d <> 0 THEN
        UPDATE work_orders
        SET created_at = created_at + d,
            deadline   = deadline + d;
    END IF;
END
$shift_seed$;

-- Ghi thời điểm hoàn thành / nghiệm thu cho các phiếu đã đóng.
-- Hầu hết hoàn thành TRƯỚC hạn (đúng hạn); cố ý để 3 phiếu trễ hạn để
-- chỉ số "PM đúng hạn" và cảnh báo quá hạn trên bảng điều khiển có dữ liệu.
UPDATE work_orders SET
    completed_at = deadline::timestamp - (interval '1 day' + (hashtext(code) % 8) * interval '2 hours'),
    reviewed_at  = deadline::timestamp + interval '1 day'
WHERE status = 'HOAN_THANH';

UPDATE work_orders SET
    completed_at = deadline::timestamp + interval '3 days',
    return_reason = 'Bước đo chuẩn cao lệch 4,0%, vượt dung sai cho phép 2,5%. Đề nghị hiệu chuẩn lại bằng dung dịch chuẩn mới và nộp đủ ảnh kết quả.'
WHERE status = 'TRA_LAI';

-- Ba phiếu hoàn thành trễ hạn (vẫn được nghiệm thu) để minh họa cảnh báo
UPDATE work_orders SET completed_at = deadline::timestamp + interval '2 days'
WHERE code IN ('PM-2026-0222', 'SC-2026-0108', 'PM-2026-0218');


/* ---------------------------------------------------------------
   10.9. CHECKLIST TỪNG BƯỚC

   Sinh tự động theo khuôn mẫu của từng loại phiếu, rồi đánh dấu số
   bước đã làm theo tiến độ của phiếu. Bước có standard_value là
   bước ĐO HIỆU CHUẨN — cần nhập giá trị đo, kỹ thuật viên không tự
   quyết định ĐẠT/KHÔNG ĐẠT mà do máy chấm theo dung sai.
   --------------------------------------------------------------- */

/* --- Khuôn mẫu bước cho phiếu HIỆU CHUẨN (5 bước, 3 điểm chuẩn) --- */
INSERT INTO work_order_steps
    (work_order_id, ordinal, title, require_photo, standard_value, unit,
     tolerance_pct, measured_value, result, done, performed_at, performed_by)
SELECT  wo.work_order_id, t.ordinal, t.title, t.require_photo, t.std, t.unit, t.tol,
        CASE WHEN b_is_done AND t.std IS NOT NULL
             THEN round(t.std * (1 + COALESCE(t.dev, 0)), 4) END,
        CASE WHEN b_is_done AND t.std IS NOT NULL THEN 'DAT' END,
        b_is_done,
        CASE WHEN b_is_done THEN wo.created_at::timestamp + (t.ordinal * interval '90 minutes') END,
        CASE WHEN b_is_done THEN wo.assignee_id END
FROM work_orders wo
CROSS JOIN (VALUES
    (1, 'Kiểm tra ngoại hình, vệ sinh buồng phản ứng',           true,  NULL::numeric, NULL::varchar, NULL::numeric, NULL::numeric),
    (2, 'Đo chuẩn thấp 5,0 mmol/L',                              false, 5.0,   'mmol/L', 2.5,  0.008),
    (3, 'Đo chuẩn cao 12,0 mmol/L',                              false, 12.0,  'mmol/L', 2.5, -0.011),
    (4, 'Kiểm tra độ tuyến tính qua 3 mức nồng độ',              false, 8.0,   'mmol/L', 3.0,  0.015),
    (5, 'Dán tem hiệu chuẩn, nhập số hiệu chứng chỉ',           true,  NULL,   NULL,      NULL,  NULL)
) AS t(ordinal, title, require_photo, std, unit, tol, dev)
CROSS JOIN LATERAL (
    SELECT (t.ordinal <= round(wo.progress::numeric / 100 * 5)) AS b_is_done
) AS calc
WHERE wo.order_type = 'HC';

/* --- Khuôn mẫu bước cho phiếu BẢO TRÌ ĐỊNH KỲ (5 bước, không đo) --- */
INSERT INTO work_order_steps
    (work_order_id, ordinal, title, require_photo, done, performed_at, performed_by)
SELECT  wo.work_order_id, t.ordinal, t.title, t.require_photo,
        (t.ordinal <= round(wo.progress::numeric / 100 * 5)),
        CASE WHEN t.ordinal <= round(wo.progress::numeric / 100 * 5)
             THEN wo.created_at::timestamp + (t.ordinal * interval '75 minutes') END,
        CASE WHEN t.ordinal <= round(wo.progress::numeric / 100 * 5) THEN wo.assignee_id END
FROM work_orders wo
CROSS JOIN (VALUES
    (1, 'Kiểm tra ngoại hình và vệ sinh bề mặt thiết bị',   true),
    (2, 'Kiểm tra nguồn điện và tiến trình nguồn dự phòng',   false),
    (3, 'Kiểm tra hệ thống khí nén, bình khí, đường hút',    true),
    (4, 'Chạy chương trình tự kiểm tra của hãng sản xuất',   false),
    (5, 'Vệ sinh tổng thể, dán nhãn PM, ghi số phiếu',       true)
) AS t(ordinal, title, require_photo)
WHERE wo.order_type = 'PM';

/* --- Khuôn mẫu bước cho phiếu SỬA CHỮA (5 bước, không đo) --- */
INSERT INTO work_order_steps
    (work_order_id, ordinal, title, require_photo, done, performed_at, performed_by)
SELECT  wo.work_order_id, t.ordinal, t.title, t.require_photo,
        (t.ordinal <= round(wo.progress::numeric / 100 * 5)),
        CASE WHEN t.ordinal <= round(wo.progress::numeric / 100 * 5)
             THEN wo.created_at::timestamp + (t.ordinal * interval '100 minutes') END,
        CASE WHEN t.ordinal <= round(wo.progress::numeric / 100 * 5) THEN wo.assignee_id END
FROM work_orders wo
CROSS JOIN (VALUES
    (1, 'Tiếp nhận thiết bị, ghi nhận tình trạng hư hỏng',        true),
    (2, 'Tháo rời, xác định linh kiện bị hư hỏng',               true),
    (3, 'Thay thế hoặc sửa chữa linh kiện bị hỏng',              false),
    (4, 'Lắp ráp, kiểm tra hoạt động sau sửa chữa',              false),
    (5, 'Vệ sinh, lập biên bản linh kiện thay thế',              true)
) AS t(ordinal, title, require_photo)
WHERE wo.order_type = 'SC';

/* --- Khuôn mẫu bước cho phiếu KIỂM ĐỊNH (4 bước, 1 điểm chuẩn) --- */
INSERT INTO work_order_steps
    (work_order_id, ordinal, title, require_photo, standard_value, unit,
     tolerance_pct, measured_value, result, done, performed_at, performed_by)
SELECT  wo.work_order_id, t.ordinal, t.title, t.require_photo, t.std, t.unit, t.tol,
        CASE WHEN b_is_done AND t.std IS NOT NULL
             THEN round(t.std * (1 + COALESCE(t.dev, 0)), 4) END,
        CASE WHEN b_is_done AND t.std IS NOT NULL THEN 'DAT' END,
        b_is_done,
        CASE WHEN b_is_done THEN wo.created_at::timestamp + (t.ordinal * interval '80 minutes') END,
        CASE WHEN b_is_done THEN wo.assignee_id END
FROM work_orders wo
CROSS JOIN (VALUES
    (1, 'Kiểm tra hồ sơ kỹ thuật và phụ kiện đi kèm',     true,  NULL::numeric, NULL::varchar, NULL::numeric, NULL::numeric),
    (2, 'Đo kiểm tra sai số hiệu chuẩn của thiết bị',     false, 100.0,  '%',  4.0,  0.020),
    (3, 'Kiểm tra an toàn điện, rò rỉ dòng điện',        true,  NULL,   NULL, NULL,  NULL),
    (4, 'Lập báo cáo và cấp giấy chứng nhận kiểm định',  false, NULL,   NULL, NULL,  NULL)
) AS t(ordinal, title, require_photo, std, unit, tol, dev)
CROSS JOIN LATERAL (
    SELECT (t.ordinal <= round(wo.progress::numeric / 100 * 4)) AS b_is_done
) AS calc
WHERE wo.order_type = 'KT';


/* --- 10.9.1. BỔ SUNG TÌNH HUỐNG THẬT: có bước KHÔNG ĐẠT và có bước bị bỏ ---
   Đây là hai tình huống mà màn "Nghiệm thu" cần thấy để chứng minh
   hệ thống không phải lúc nào cũng cho duyệt phiếu. --- */

/* Phiếu HC-2026-0094 bị trả lại vì đo chuẩn cao lệch 4,0% > dung sai 2,5% */
UPDATE work_order_steps
SET measured_value = 12.4800,
    result         = 'KHONG_DAT',
    note           = 'Sai số 4,0% vượt dung sai 2,5%. Nguyên nhân: dung dịch chuẩn đã mất hiệu lực. Đề nghị hiệu chuẩn lại bằng dung dịch mới.'
WHERE work_order_id = (SELECT work_order_id FROM work_orders WHERE code = 'HC-2026-0094')
  AND ordinal = 3;

/* Phiếu SC-2026-0107 bị bỏ bước vệ sinh tổng thể, phải ghi lý do */
UPDATE work_order_steps
SET done        = false,
    skip_reason = 'Buồng thí nghiệm đang chuyển ca, thống nhất dọn dẹp tổng thể vào cuối tuần. Đã ghi nhận vào biên bản.'
WHERE work_order_id = (SELECT work_order_id FROM work_orders WHERE code = 'SC-2026-0107')
  AND ordinal = 5;

-- Chỉnh lại tiến độ cho khớp sau khi bỏ bước
UPDATE work_orders SET progress = 60 WHERE code = 'SC-2026-0107';


/* ---------------------------------------------------------------
   10.10. BẰNG CHỨNG ĐÃ NỘP

   Sinh tự động: phiếu HOAN_THÀNH thì có đủ bằng chứng bắt buộc;
   phiếu CHỜ NGHIỆM THU thì cố tình để thiếu một phần — đúng tình
   huống mà điều phối phải trả lại. sha256 tính từ tên phiếu và mã
   bằng chứng nên luôn khớp khi kiểm tra lại.
   --------------------------------------------------------------- */
INSERT INTO evidence
    (work_order_id, evidence_code, file_name, file_path, file_mime,
     sha256, file_size_kb, uploaded_by, uploaded_at)
SELECT  wo.work_order_id,
        c.evidence_code,
        c.evidence_code || '_' || wo.code || v.seq || v.ext,
        '/bang-chung/' || wo.code || '/' || c.evidence_code || v.seq || v.ext,
        v.mime,
        encode(digest(wo.code || '|' || c.evidence_code || v.seq, 'sha256'), 'hex'),
        180 + (abs(hashtext(wo.code || c.evidence_code)) % 640),
        wo.assignee_id,
        wo.created_at::timestamp + interval '2 days' + (v.seq * interval '35 minutes')
FROM work_orders wo
JOIN required_evidence_config c
     ON c.order_type = wo.order_type AND c.is_required
CROSS JOIN (VALUES
    (1, '.jpg', 'image/jpeg'),
    (2, '.jpg', 'image/jpeg'),
    (3, '.pdf', 'application/pdf')
) AS v(seq, ext, mime)
WHERE wo.status = 'HOAN_THANH'
  AND v.seq <= c.max_files;

-- Phiếu chờ nghiệm thu: nộp mới 2/4 nhóm bằng chứng để điều phối thấy
-- phần thiếu và có lý do để trả lại.
INSERT INTO evidence
    (work_order_id, evidence_code, file_name, file_path, file_mime,
     sha256, file_size_kb, uploaded_by, uploaded_at)
SELECT  wo.work_order_id,
        c.evidence_code,
        c.evidence_code || '_' || wo.code || '.jpg',
        '/bang-chung/' || wo.code || '/' || c.evidence_code || '.jpg',
        'image/jpeg',
        encode(digest(wo.code || '|' || c.evidence_code || '|cho', 'sha256'), 'hex'),
        240 + (abs(hashtext(wo.code || c.evidence_code)) % 480),
        wo.assignee_id,
        wo.created_at::timestamp + interval '1 day'
FROM work_orders wo
JOIN required_evidence_config c
     ON c.order_type = wo.order_type AND c.is_required
WHERE wo.status IN ('CHO_NGHIEM_THU','DANG_THUC_HIEN')
  AND c.evidence_code IN ('ANH_TRUOC','ANH_NHOM_BUOC','ANH_TRUOC_SUA')
  AND wo.assignee_id IS NOT NULL;


/* ---------------------------------------------------------------
   10.11. SỰ CỐ (BÁO HỎNG) — 18 sự cố trong 12 tháng
   Dùng để vẽ biểu đồ cột "Sự cố theo tháng" trên bảng điều khiển
   và báo cáo sự cố.
   --------------------------------------------------------------- */
INSERT INTO incidents
    (code, equipment_id, reported_by, description, severity, photo_count, status, created_at, work_order_id, resolution)
SELECT  t.code, e.equipment_id, u.user_id, t.description, t.severity, t.photo_count,
        t.status, t.created_at,
        wo.work_order_id,
        t.resolution
FROM (VALUES
    ('INC-2026-0001','DEV-005','vanna',   'Màn hình bị nhiễu, ảnh siêu âm có vạch kẻ ngang',        'SO_BO', 2,'DONG',        timestamp '2025-10-08 09:12', NULL,       'Vệ sinh đầu dò và thay gel siêu âm, hình ảnh trở lại bình thường'),
    ('INC-2026-0002','DEV-003','khaibq',  'Bơm hút mẫu không hút được, báo lỗi tắc',            'KHAN',  1,'DA_TAO_PHIEU',timestamp '2025-10-22 14:30', NULL,       NULL),
    ('INC-2026-0003','DEV-006','ngocttb', 'Máy điện tim không kết nối được với máy trung tâm',  'SO_BO', 1,'DONG',        timestamp '2025-11-14 08:05', NULL,       'Thay cáp kết nối, máy hoạt động ổn định'),
    ('INC-2026-0004','DEV-012','khaibq',  'Monitor báo mất tín hiệu ECG, cảnh báo liên tục',     'KHAN',  3,'DA_TAO_PHIEU',timestamp '2025-12-03 22:41', NULL,       NULL),
    ('INC-2026-0005','DEV-025','vanna',   'Máy sinh phẩm báo nghẽn ống hút mẫu',                'SO_BO', 1,'DONG',        timestamp '2025-12-19 10:15', NULL,       'Thay ống hút và vệ sinh đường ống'),
    ('INC-2026-0006','DEV-004','khaibq',  'Máy thở báo lỗi van, áp lực không ổn định',         'KHAN',  2,'DA_TAO_PHIEU',timestamp '2026-01-11 03:27', NULL,       NULL),
    ('INC-2026-0007','DEV-016','thanhthuy','Máy siêu âm không lên hình sau khi bật',            'KHAN',  1,'DONG',        timestamp '2026-01-28 16:22', NULL,       'Khởi động lại hệ thống và cập nhật phần mềm'),
    ('INC-2026-0008','DEV-040','vanna',   'Kết quả tế bào máu lệch so với kết quả thủ công',    'SO_BO', 2,'DA_TAO_PHIEU',timestamp '2026-02-09 11:08', NULL,       NULL),
    ('INC-2026-0009','DEV-015','hoangminh','Máy gây mê báo lỗi dòng khí thở, âm báo lặp',       'KHAN',  2,'DONG',        timestamp '2026-02-24 20:15', NULL,       'Thay cảm biến dòng khí, kiểm tra lại toàn bộ đường thở'),
    ('INC-2026-0010','DEV-031','thuytrang','Monitor nhi khoa mờ màn, khó đọc chỉ số',             'SO_BO', 1,'DONG',        timestamp '2026-03-06 07:50', NULL,       'Tăng độ sáng, vệ sinh mặt kính'),
    ('INC-2026-0011','DEV-007','thanhthuy','Máy X-quang báo lỗi tấm detector',                  'KHAN',  3,'DA_TAO_PHIEU',timestamp '2026-03-21 13:37', NULL,       NULL),
    ('INC-2026-0012','DEV-021','khaibq',  'Máy lọc máu báo rò rỉ máu trong hệ thống',          'KHAN',  1,'DA_TAO_PHIEU',timestamp '2026-04-02 02:18', NULL,       NULL),
    ('INC-2026-0013','DEV-019','hoangminh','Ống nội soi bị mờ, hình ảnh không rõ',              'SO_BO', 2,'DONG',        timestamp '2026-04-17 09:44', NULL,       'Vệ sinh ống và đầu dò, hình ảnh rõ nét'),
    ('INC-2026-0014','DEV-010','vanna',   'Máy sinh phẩm tắc nghẽn vòng lặp liên tục',          'SO_BO', 1,'DONG',        timestamp '2026-05-08 15:26', NULL,       'Thay vòng lặp và vệ sinh bộ phận đo'),
    ('INC-2026-0015','DEV-032','ngocttb', 'Máy tạo lập điện báo rò rỉ, không tạo được xung',    'KHAN',  2,'DA_TAO_PHIEU',timestamp '2026-05-29 19:03', NULL,       NULL),
    ('INC-2026-0016','DEV-038','khaibq',  'Máy thở báo nghẽn đường hút bệnh nhân',             'KHAN',  1,'DA_TIEP_NHAN', timestamp '2026-09-20 21:47', NULL,       NULL),
    ('INC-2026-0017','DEV-013','khaibq',  'Monitor hồi sức mất tín hiệu đường mạch vành',      'KHAN',  3,'DONG',        timestamp '2026-08-30 23:15', NULL,       'Thay cáp điện cực và module khuếch đại'),
    ('INC-2026-0018','DEV-003','vanna',   'Bơm hút mẫu nghẹt, tắc nghẽn nghiêm trọng',          'KHAN',  2,'DA_TAO_PHIEU', timestamp '2026-09-18 08:12', 'SC-2026-0102', NULL)
) AS t(code, equip_code, reporter, description, severity, photo_count, status, created_at, wo_code, resolution)
JOIN equipment e ON e.code = t.equip_code
JOIN users     u ON u.username = t.reporter
LEFT JOIN work_orders wo ON wo.code = t.wo_code;

-- 10.11.1. Sự cố DONG phải có thời điểm đóng — trước đây cột closed_at
-- để trống hết nên màn xử lý sự cố không biết sự cố đóng khi nào, báo
-- cáo "sự cố mở" cũng sai. Đóng ngay sau khi tạo ~1,5 ngày.
UPDATE incidents SET closed_at = created_at + interval '36 hours'
WHERE status = 'DONG' AND closed_at IS NULL;

-- 10.11.2. Dịch created_at sự cố theo cùng độ lệch T0 — biểu đồ "Sự cố
-- 12 tháng" của bảng điều khiển lọc theo ngày hiện tại, nếu không dịch
-- thì nạp vào ngày xa T0 mọi cột đều trống.
DO $shift_seed$
DECLARE d integer := CURRENT_DATE - DATE '2026-09-29';
BEGIN
    IF d <> 0 THEN
        UPDATE incidents SET created_at = created_at + make_interval(days => d);
    END IF;
END
$shift_seed$;


/* ---------------------------------------------------------------
   10.12. PHÂN CÔNG

   Mỗi phiếu đã có người thực hiện và đã bắt đầu đều có một dòng phân
   công. Đây cũng chính là bảng mà trigger BR-01 bảo vệ — thử tạo
   một dòng phân công sai sẽ bị PostgreSQL từ chối (xem MỤC 11).
   --------------------------------------------------------------- */
INSERT INTO assignments
    (work_order_id, equipment_id, assignee_id, scheduled_date, status, created_by, created_at)
SELECT  wo.work_order_id, wo.equipment_id, wo.assignee_id,
        wo.created_at + 1,
        CASE wo.status WHEN 'HOAN_THANH' THEN 'HOAN_THANH' ELSE 'DANG_THUC_HIEN' END,
        7,                                     -- điều phối dphuong tạo phiếu phân công
        wo.created_at::timestamp + interval '3 hours'
FROM work_orders wo
WHERE wo.assignee_id IS NOT NULL
  AND wo.status IN ('DANG_THUC_HIEN','CHO_NGHIEM_THU','HOAN_THANH','TRA_LAI');


/* ---------------------------------------------------------------
   10.13. LỊCH SỬ THAY ĐỔI TRẠNG THÁI THIẾT BỊ

   Nguồn dữ liệu cho dòng thời gian ở màn "Chi tiết thiết bị".
   10.13.1 ghi lịch sử nghiệm thu nhập kho cho tất cả 45 máy.
   10.13.2 ghi lịch sử các lần khóa do quá hạn hiệu chuẩn.
   --------------------------------------------------------------- */
INSERT INTO equipment_status_history (equipment_id, from_status, to_status, changed_by, reason, changed_at)
SELECT e.equipment_id, 'CHUA_DUA_VAO_SD', 'HOAT_DONG', 'hệ thống',
       'Nghiệm thu nhập kho, biên bản số ' || 'BB-' || e.code || '-2026', e.import_date::timestamp + interval '10 hours'
FROM equipment e;

INSERT INTO equipment_status_history (equipment_id, from_status, to_status, changed_by, reason, changed_at)
SELECT e.equipment_id, 'HOAT_DONG', 'CHO_HIEU_CHUAN', 'hệ thống',
       'Quá hạn hiệu chuẩn ' || (CURRENT_DATE - e.calibration_expiry) || ' ngày — tự động khóa theo BR-01',
       e.calibration_expiry::timestamp + interval '8 hours'
FROM equipment e
WHERE e.status = 'CHO_HIEU_CHUAN';

INSERT INTO equipment_status_history (equipment_id, from_status, to_status, changed_by, reason, changed_at)
SELECT e.equipment_id, 'HOAT_DONG', 'SAP_HAN', 'hệ thống',
       'Còn ' || (e.calibration_expiry - CURRENT_DATE) || ' ngày đến hạn hiệu chuẩn — chuyển sang cảnh báo sớm',
       e.calibration_expiry::timestamp - interval '30 days'
FROM equipment e
WHERE e.status = 'SAP_HAN';

INSERT INTO equipment_status_history (equipment_id, from_status, to_status, changed_by, reason, changed_at)
SELECT e.equipment_id, 'HOAT_DONG', 'DANG_SUA', COALESCE(u.username, 'dphuong'),
       COALESCE(e.notes, 'Chuyển sang sửa chữa'),
       (SELECT min(wo.created_at)::timestamp FROM work_orders wo WHERE wo.equipment_id = e.equipment_id)
FROM equipment e
LEFT JOIN work_orders wo ON wo.equipment_id = e.equipment_id AND wo.order_type = 'SC'
LEFT JOIN users u ON u.user_id = wo.assignee_id
WHERE e.status = 'DANG_SUA';

INSERT INTO equipment_status_history (equipment_id, from_status, to_status, changed_by, reason, changed_at)
SELECT e.equipment_id, 'DANG_SUA', 'THANH_LY', 'longhduc',
       'Biên bản thanh lý số 15/2026 — hỏng vĩnh viễn, không khắc phục được',
       timestamp '2026-05-08 10:00'
FROM equipment e
WHERE e.status = 'THANH_LY';

-- Vài sự kiện thay đổi trạng thái đáng chú ý trong quý trình bảo trì
-- (mốc thời gian viết tương đối theo T0 = 2026-09-29, khớp 10.6.1)
INSERT INTO equipment_status_history (equipment_id, from_status, to_status, changed_by, reason, changed_at) VALUES
    ((SELECT equipment_id FROM equipment WHERE code='DEV-003'), 'HOAT_DONG', 'DANG_SUA', 'vanna',
     'Khoa Huyết học báo hỏng: bơm hút mẫu nghẹt, tạm ngưng sử dụng', (CURRENT_DATE - 11) + time '08:15'),
    ((SELECT equipment_id FROM equipment WHERE code='DEV-003'), 'DANG_SUA', 'HOAT_DONG', 'hungtv',
     'Đã thay bơm hút, đo đạt chuẩn, mở khóa trở lại sử dụng',           (CURRENT_DATE - 3) + time '16:40'),
    ((SELECT equipment_id FROM equipment WHERE code='DEV-018'), 'HOAT_DONG', 'CHO_HIEU_CHUAN', 'hệ thống',
     'Quá hạn hiệu chuẩn 19 ngày — tự động khóa, có máy 4008 dự phòng',  (CURRENT_DATE - 19) + time '08:00'),
    ((SELECT equipment_id FROM equipment WHERE code='DEV-018'), 'CHO_HIEU_CHUAN', 'HOAT_DONG', 'bichlan',
     'Nghiệm thu phiếu HC-2026-0093 đạt — mở khóa thiết bị',             (CURRENT_DATE - 7) + time '10:30'),
    ((SELECT equipment_id FROM equipment WHERE code='DEV-002'), 'CHO_HIEU_CHUAN', 'HOAT_DONG', 'dphuong',
     'Phiếu HC-2026-0087 chưa hoàn thành — thiết bị vẫn giữ trạng thái khóa', (CURRENT_DATE - 4) + time '09:00');


/* ---------------------------------------------------------------
   10.14. NHẬT KÝ HỆ THỐNG — CHUỖI HASH 52 DÒNG

   Dựng chuỗi bằng vòng lặp: mỗi dòng bám hash của dòng trước nên không
   thể nhập "bừa" — muốn thêm dòng mới phải nối đúng vào cuối chuỗi.

   Chuỗi này cũng là bằng chứng cho điểm nhấn 2 của đề tài: các dòng
   ASSIGN_BLOCKED cho thấy BR-01 đã thực sự chạy và từ chối người dùng.
   --------------------------------------------------------------- */
DO $$
DECLARE
    r      record;
    v_prev char(64) := repeat('0', 64)::char(64);
    v_hash char(64);
BEGIN
    FOR r IN
        SELECT * FROM (VALUES
            (timestamp '2025-10-08 09:12:04','vanna',    'FAULT_REPORT',     'thiết bị #DEV-005','Khoa Chẩn đoán hình ảnh báo hỏng: màn hình bị nhiễu, ảnh có vạch kẻ. Mức độ: sơ bộ'),
            (timestamp '2025-10-22 14:30:11','khaibq',   'FAULT_REPORT',     'thiết bị #DEV-003','Khoa Huyết học báo hỏng: bơm hút mẫu nghẹt. Mức độ: khẩn cấp'),
            (timestamp '2025-11-14 08:05:52','ngocttb',  'FAULT_REPORT',     'thiết bị #DEV-006','Khoa Tim mạch báo hỏng: máy điện tim mất kết nối. Mức độ: sơ bộ'),
            (timestamp '2025-12-03 22:41:07','khaibq',   'FAULT_REPORT',     'thiết bị #DEV-012','Buồng hồi sức báo hỏng: monitor mất tín hiệu ECG. Mức độ: khẩn cấp'),
            (timestamp '2025-12-19 10:15:33','vanna',    'FAULT_REPORT',     'thiết bị #DEV-025','Khoa Hóa sinh báo hỏng: máy sinh phẩm nghẽn ống hút. Mức độ: sơ bộ'),
            (timestamp '2026-01-11 03:27:19','khaibq',   'FAULT_REPORT',     'thiết bị #DEV-004','Buồng hồi sức báo hỏng: máy thở báo lỗi van. Mức độ: khẩn cấp'),
            (timestamp '2026-01-28 16:22:44','thanhthuy','FAULT_REPORT',     'thiết bị #DEV-016','Khoa Chẩn đoán hình ảnh báo hỏng: máy siêu âm không lên hình. Mức độ: khẩn cấp'),
            (timestamp '2026-02-09 11:08:25','vanna',    'FAULT_REPORT',     'thiết bị #DEV-040','Khoa Huyết học báo lệch kết quả tế bào máu. Mức độ: sơ bộ'),
            (timestamp '2026-02-24 20:15:58','hoangminh','FAULT_REPORT',     'thiết bị #DEV-015','Phòng mổ sản phụ khoa báo hỏng: máy gây mê báo lỗi dòng khí. Mức độ: khẩn cấp'),
            (timestamp '2026-03-06 07:50:12','thuytrang','FAULT_REPORT',     'thiết bị #DEV-031','Buồng nhi cấp cứu báo màn mờ. Mức độ: sơ bộ'),
            (timestamp '2026-03-21 13:37:41','thanhthuy','FAULT_REPORT',     'thiết bị #DEV-007','Phòng chụp X-quang báo lỗi tấm detector. Mức độ: khẩn cấp'),
            (timestamp '2026-04-02 02:18:30','khaibq',   'FAULT_REPORT',     'thiết bị #DEV-021','Buồng lọc máu báo rò rỉ máu. Mức độ: khẩn cấp'),
            (timestamp '2026-04-17 09:44:06','hoangminh','FAULT_REPORT',     'thiết bị #DEV-019','Khoa Tai Mũi Răng báo ống nội soi mờ hình. Mức độ: sơ bộ'),
            (timestamp '2026-05-08 10:00:15','longhduc', 'LIQUIDATE',        'thiết bị #DEV-027','Lập biên bản thanh lý số 15/2026 — máy điện tim hỏng vĩnh viễn'),
            (timestamp '2026-05-08 10:02:47','longhduc', 'UPDATE',           'thiết bị #DEV-027','Trạng thái: DANG_SUA → THANH_LY'),
            (timestamp '2026-05-29 19:03:21','ngocttb',  'FAULT_REPORT',     'thiết bị #DEV-032','Khoa Tim mạch báo máy tạo lập điện rò rỉ. Mức độ: khẩn cấp'),
            (timestamp '2026-06-02 07:58:44','dphuong',  'ASSIGN_BLOCKED',   'thiết bị #DEV-033','Lý do: bơm tiêm điện quá hạn hiệu chuẩn 83 ngày. Căn cứ: chứng thư VC-2025-0871'),
            (timestamp '2026-06-02 08:00:00','hệ thống', 'AUTO_LOCK',        'thiết bị #DEV-033','Quá hạn hiệu chuẩn 83 ngày — tự động khóa'),
            (timestamp '2026-06-15 09:30:11','hungtv',   'WO_START',         'phiếu #PM-2026-0161','Bắt đầu thực hiện phiếu bảo trì định kỳ'),
            (timestamp '2026-07-08 14:02:11','hệ thống', 'AUTO_LOCK',        'thiết bị #DEV-038','Quá hạn hiệu chuẩn 53 ngày — tự động khóa'),
            (timestamp '2026-07-08 14:05:30','dphuong',  'ASSIGN_BLOCKED',   'phiếu #PM-2026-0172','Lý do: máy thở đã quá hạn hiệu chuẩn. Căn cứ: chứng thư VC-2025-0903'),
            (timestamp '2026-07-20 10:45:22','longhduc', 'CONFIG_UPDATE',     'warning_days_early','Giá trị: 30 → 45 ngày. Lý do: tăng cảnh báo sớm cho thiết bị hiệu chuẩn'),
            (timestamp '2026-08-01 08:12:05','hệ thống', 'AUTO_LOCK',        'thiết bị #DEV-002','Quá hạn hiệu chuẩn 31 ngày — tự động khóa'),
            (timestamp '2026-08-01 08:14:19','dphuong',  'WO_CREATE',        'phiếu #HC-2026-0087','Tạo phiếu hiệu chuẩn cho thiết bị DEV-002 quá hạn 31 ngày'),
            (timestamp '2026-08-01 08:15:02','dphuong',  'ASSIGN',           'phiếu #HC-2026-0087','Phân công kỹ thuật viên Nguyễn Minh Vĩnh Thịnh, hạn 25/09/2026'),
            (timestamp '2026-08-02 09:30:11','minhvt',   'WO_START',         'phiếu #HC-2026-0087','Bắt đầu thực hiện phiếu hiệu chuẩn'),
            (timestamp '2026-08-10 08:12:05','hệ thống', 'AUTO_LOCK',        'thiết bị #DEV-007','Quá hạn hiệu chuẩn 22 ngày — tự động khóa'),
            (timestamp '2026-08-15 16:45:00','minhvt',   'EVIDENCE_UPLOADED','phiếu #PM-2026-0203','Nộp ảnh từng nhóm bước và checklist hoàn thành'),
            (timestamp '2026-08-16 09:15:33','dphuong',  'WO_ACCEPT',        'phiếu #PM-2026-0203','Nghiệm thu đạt, bằng chứng đầy đủ 2/2 nhóm'),
            (timestamp '2026-08-28 23:15:44','khaibq',   'FAULT_REPORT',     'thiết bị #DEV-013','Buồng hồi sức báo monitor mất tín hiệu. Mức độ: khẩn cấp'),
            (timestamp '2026-09-01 11:20:03','dphuong',  'WO_ACCEPT',        'phiếu #HC-2026-0095','Nghiệm thu hiệu chuẩn đạt, cập nhật hạn hiệu chuẩn mới'),
            (timestamp '2026-09-05 08:00:00','hệ thống', 'AUTO_LOCK',        'thiết bị #DEV-018','Quá hạn hiệu chuẩn 19 ngày — tự động khóa'),
            (timestamp '2026-09-08 10:30:17','dphuong',  'ASSIGN_BLOCKED',   'phiếu #SC-2026-0107','Lý do: monitor ICU số 1 chưa hiệu chuẩn đủ 6 ngày. Căn cứ: chứng thư VC-2026-0098'),
            (timestamp '2026-09-10 08:00:00','hệ thống', 'AUTO_LOCK',        'thiết bị #DEV-038','Quá hạn hiệu chuẩn 9 ngày — tự động khóa'),
            (timestamp '2026-09-10 08:05:41','dphuong',  'WO_CREATE',        'phiếu #HC-2026-0094','Tạo phiếu hiệu chuẩn cho máy thở DEV-038'),
            (timestamp '2026-09-12 14:00:00','lthimai',  'WO_START',         'phiếu #KT-2026-0031','Bắt đầu kiểm định máy siêu âm Aplio i800'),
            (timestamp '2026-09-14 10:22:08','dphuong',  'WO_RETURN',        'phiếu #HC-2026-0094','Trả lại: chuẩn cao lệch 4,0% vượt dung sai 2,5%, thiếu ảnh tem hiệu chuẩn'),
            (timestamp '2026-09-15 16:48:20','hungtv',   'EVIDENCE_UPLOADED','phiếu #HC-2026-0093','Nộp đủ 4/4 nhóm bằng chứng hiệu chuẩn'),
            (timestamp '2026-09-16 09:30:55','dphuong',  'WO_ACCEPT',        'phiếu #HC-2026-0093','Nghiệm thu đạt — mở khóa thiết bị DEV-018'),
            (timestamp '2026-09-18 08:12:00','vanna',    'FAULT_REPORT',     'thiết bị #DEV-003','Khoa Huyết học báo bơm hút mẫu nghẹt. Mức độ: khẩn cấp'),
            (timestamp '2026-09-18 08:30:44','dphuong',  'WO_CREATE',        'phiếu #SC-2026-0102','Tạo phiếu sửa chữa từ sự cố INC-2026-0018'),
            (timestamp '2026-09-20 07:15:36','dphuong',  'WO_CREATE',        'phiếu #HC-2026-0092','Tạo phiếu hiệu chuẩn cho bơm tiêm điện DEV-033 quá hạn 76 ngày'),
            (timestamp '2026-09-21 09:05:12','dphuong',  'WO_CREATE',        'phiếu #HC-2026-0091','Tạo phiếu hiệu chuẩn cho máy X-quang DEV-007'),
            (timestamp '2026-09-22 10:30:00','dphuong',  'WO_ACCEPT',        'phiếu #HC-2026-0093','Cập nhật hạn hiệu chuẩn mới cho thiết bị DEV-018'),
            (timestamp '2026-09-24 14:01:58','dphuong',  'ASSIGN_BLOCKED',   'phiếu #PM-2026-0210','Lý do: bơm tiêm điện DEV-014 nhiễu điện, cần sửa chữa xong mới được bảo trì. Căn cứ: biên bản kỹ thuật số 22/2026'),
            (timestamp '2026-09-25 10:44:03','dphuong',  'WO_RETURN',        'phiếu #SC-2026-0107','Trả lại: thiếu ảnh sau sửa chữa và biên bản linh kiện'),
            (timestamp '2026-09-26 08:00:00','hệ thống', 'AUTO_LOCK',        'thiết bị #DEV-007','Nhắc nhở: quá hạn hiệu chuẩn 47 ngày, chưa có phiếu hiệu chuẩn hoàn thành'),
            (timestamp '2026-09-27 09:18:40','ducvu',    'CATALOG_CREATE',   'model #Aplio i800','Thêm model Aplio i800 — chu kỳ PM 180 ngày, chu kỳ HC 365 ngày, dung sai 5,00%'),
            (timestamp '2026-09-28 10:05:12','dphuong',  'WO_CREATE',        'phiếu #HC-2026-0096','Tạo phiếu hiệu chuẩn sớm cho cobas e701 DEV-009 còn 4 ngày đến hạn'),
            (timestamp '2026-09-28 11:26:37','dphuong',  'ASSIGN_BLOCKED',   'phiếu #SC-2026-0110','Lý do: thiết bị DEV-002 đang khóa chờ hiệu chuẩn, không được phân công phiếu khai thác. Căn cứ: BR-01'),
            (timestamp '2026-09-28 11:28:04','dphuong',  'WO_CREATE',        'phiếu #HC-2026-0088','Gỡ tình huống BR-01 bằng cách tạo phiếu hiệu chuẩn cho DEV-002'),
            (timestamp '2026-09-29 07:15:00','ducvu',    'CONFIG_UPDATE',     'pm_on_time_alert','Thêm cấu hình nhắc nhở khi tỷ lệ PM đúng hạn dưới 85%')
        ) AS v(occurred_at, actor, action, target, detail)
    LOOP
        v_hash := fn_bam_audit(v_prev, r.actor, r.action, r.target, r.detail);
        INSERT INTO audit_log (occurred_at, actor, action, target, detail, prev_hash, row_hash)
        VALUES (r.occurred_at, r.actor, r.action, r.target, r.detail, v_prev, v_hash);
        v_prev := v_hash;
    END LOOP;
END $$;


/* ---------------------------------------------------------------
   10.15. CẤU HÌNH HỆ THỐNG
   Khớp màn "Admin > Cấu hình hệ thống".
   --------------------------------------------------------------- */
INSERT INTO system_config (config_key, config_value, description, updated_by) VALUES
    ('warning_days_early',    '30',  'Cảnh báo sớm (badge vàng) trước khi hết hạn hiệu chuẩn',      'longhduc'),
    ('warning_days_urgent',   '7',   'Cảnh báo gấp (badge đỏ nhấp nháy) cho điều phối',              'longhduc'),
    ('warning_days_critical', '1',   'Cảnh báo khẩn cấp, gửi thêm thông báo cho trưởng khoa',      'longhduc'),
    ('auto_lock_on_expiry',   'true','Tự động khóa thiết bị khi hết hạn hiệu chuẩn (BR-01)',        'longhduc'),
    ('evidence_immutable_after_complete','true','Sau khi phiếu hoàn thành thì bằng chứng không được sửa hoặc xóa','longhduc'),
    ('require_photo_on_check','true','Bước có đánh dấu bắt buộc chụp ảnh thì phải có ảnh mới đóng phiếu','dphuong'),
    ('require_evidence_before_review','true','Chỉ chuyển sang chờ nghiệm thu khi đủ bằng chứng bắt buộc','dphuong'),
    ('reject_reason_required','true','Trả lại phiếu bắt buộc phải ghi lý do (ghi vào nhật ký hệ thống)','dphuong'),
    ('assign_blocked_logging','true','Mỗi lần chặn theo BR-01 đều ghi một dòng ASSIGN_BLOCKED',      'dphuong'),
    ('max_open_orders_per_tech','8',  'Số phiếu tối đa một kỹ thuật viên được nhận cùng lúc',        'dphuong'),
    ('pm_on_time_alert',      '85',  'Cảnh báo khi tỷ lệ PM hoàn thành đúng hạn dưới ngưỡng này (%)','ducvu'),
    ('evidence_max_size_kb',  '10240','Dung lượng tối đa cho mỗi tệp bằng chứng (KB)',              'longhduc');


/* ---------------------------------------------------------------
   10.16. THÔNG BÁO
   Khớp danh sách thông báo trên thanh công cụ và màn đầu mối khoa.
   --------------------------------------------------------------- */
INSERT INTO notifications (user_id, type, message, link, is_read, created_at)
SELECT u.user_id, t.type, t.message, t.link, t.is_read, t.created_at
FROM (VALUES
    ('dphuong','HC_QUA_HAN',      'Bơm tiêm điện DEV-033 quá hạn hiệu chuẩn 76 ngày — đã tự động khóa',            '/coordinator/devices/DEV-033', false, timestamp '2026-09-20 08:00'),
    ('dphuong','HC_QUA_HAN',      'Máy thở Hamilton G5 số 3 (DEV-038) quá hạn hiệu chuẩn 9 ngày',                    '/coordinator/devices/DEV-038', false, timestamp '2026-09-10 08:00'),
    ('dphuong','HC_QUA_HAN',      'Máy X-quang DR 600 số 1 (DEV-007) quá hạn 50 ngày, chờ phiếu HC-2026-0091',        '/coordinator/devices/DEV-007', false, timestamp '2026-09-26 08:00'),
    ('dphuong','HC_SAP_HAN',      'Máy sinh phẩm cobas e701 (DEV-009) còn 4 ngày đến hạn hiệu chuẩn',              '/coordinator/devices/DEV-009', false, timestamp '2026-09-25 09:00'),
    ('dphuong','HC_SAP_HAN',      'Máy thở Hamilton G5 số 1 (DEV-004) còn 19 ngày đến hạn hiệu chuẩn',               '/coordinator/devices/DEV-004', true,  timestamp '2026-09-10 09:00'),
    ('dphuong','HC_SAP_HAN',      'Monitor hồi sức số 2 (DEV-013) còn 21 ngày đến hạn hiệu chuẩn',                     '/coordinator/devices/DEV-013', true,  timestamp '2026-09-08 09:00'),
    ('dphuong','WO_CHO_NGHIEM_THU','Phiếu PM-2026-0195 đã hoàn thành, chờ nghiệm thu',                                '/coordinator/review',          false, timestamp '2026-09-20 17:00'),
    ('dphuong','WO_QUA_HAN',      'Phiếu HC-2026-0087 quá hạn 4 ngày mà chưa hoàn thành',                            '/coordinator/orders',          false, timestamp '2026-09-29 07:00'),
    ('dphuong','WO_KHAN',         'Có 3 phiếu khẩn cấp chưa có người thực hiện',                                     '/coordinator/orders',          false, timestamp '2026-09-28 08:00'),
    ('dphuong','BR01_BLOCKED',    'Hệ thống đã chặn 1 lần phân công phiếu khai thác lên thiết bị quá hạn hiệu chuẩn',  '/coordinator/orders',          false, timestamp '2026-09-28 11:26'),
    ('ducvu',  'HC_QUA_HAN',      'Máy sinh phẩm BS-240 số 2 (DEV-002) quá hạn 59 ngày, chờ hiệu chuẩn lại',            '/coordinator/devices/DEV-002', false, timestamp '2026-09-01 08:00'),
    ('minhvt', 'WO_MOI',          'Bạn được phân công phiếu HC-2026-0087 — hiệu chuẩn máy sinh phẩm BS-240',          '/technician/work-order/HC-2026-0087', false, timestamp '2026-09-02 08:10'),
    ('minhvt', 'WO_MOI',          'Bạn được phân công phiếu HC-2026-0096 — hiệu chuẩn cobas e701',                     '/technician/work-order/HC-2026-0096', false, timestamp '2026-09-28 10:10'),
    ('hungtv', 'WO_TRA_LAI',      'Phiếu HC-2026-0094 bị trả lại: chuẩn cao lệch 4,0% vượt dung sai',                  '/technician/work-order/HC-2026-0094', false, timestamp '2026-09-14 10:22'),
    ('bichlan','WO_MOI',          'Bạn được phân công phiếu HC-2026-0097 — hiệu chuẩn máy siêu âm sản phụ khoa',         '/technician/work-order/HC-2026-0097', false, timestamp '2026-09-20 08:05'),
    ('lthimai','WO_MOI',          'Bạn được phân công phiếu HC-2026-0091 — hiệu chuẩn máy X-quang DR 600',              '/technician/work-order/HC-2026-0091', false, timestamp '2026-09-21 09:10'),
    ('vanna',  'INCIDENT_TRA_LAI','Thiết bị DEV-002 đã quá hạn hiệu chuẩn, khoa không được tiếp nhận sử dụng',          '/department/devices/DEV-002',  false, timestamp '2026-08-01 08:15'),
    ('khaibq', 'INCIDENT_TRA_LAI','Máy thở DEV-038 khóa chờ hiệu chuẩn, buồng hồi sức chỉ còn 1 máy hoạt động',        '/department/devices/DEV-038',  false, timestamp '2026-09-10 08:15'),
    ('thanhthuy','INCIDENT_MOI',  'Phiếu HC-2026-0091 chưa được phân công — máy X-quang khoa đang chờ',                 '/department/orders',           false, timestamp '2026-09-21 09:30'),
    ('thuytrang','PM_DEN_HAN',    'Phiếu PM-2026-0212 đến hạn sau 19 ngày',                                          '/technician/my-work',          true,  timestamp '2026-09-22 08:00')
) AS t(username, type, message, link, is_read, created_at)
JOIN users u ON u.username = t.username;

/* ---------------------------------------------------------------
   10.17. DỊCH PHẦN CÒN LẠI CỦA CÂU CHUYỆN THEO T0

   Các cột còn lại mang ngày tuyệt đối quanh T0: lần đăng nhập cuối,
   nhật ký hệ thống, thông báo. Dịch cùng một độ lệch để màn quản trị
   thấy "hoạt động gần đây" thay vì dữ liệu của một ngày cố định.
   Nhật ký kiểm toán an toàn khi dịch: row_hash chỉ băm
   prev|actor|action|target|detail — KHÔNG có occurred_at.
   --------------------------------------------------------------- */
DO $shift_seed$
DECLARE d integer := CURRENT_DATE - DATE '2026-09-29';
BEGIN
    IF d <> 0 THEN
        UPDATE users SET last_login = last_login + make_interval(days => d)
        WHERE last_login IS NOT NULL;

        UPDATE audit_log SET occurred_at = occurred_at + make_interval(days => d);

        UPDATE notifications SET created_at = created_at + make_interval(days => d);
    END IF;
END
$shift_seed$;


/* =====================================================================
   MỤC 11. KIỂM TRA SAU KHI NẠP
   ---------------------------------------------------------------------
   Chạy từng câu sau để tự kiểm tra. Nếu mọi kết quả đều đúng, CSDL đã
   sẵn sàng nối với ASP.NET Core.
   ===================================================================== */

-- [1] Tổng quan: số dòng của từng bảng
--      SELECT 'departments' bang, count(*) FROM departments
--      UNION ALL SELECT 'equipment', count(*) FROM equipment
--      UNION ALL SELECT 'users', count(*) FROM users
--      UNION ALL SELECT 'work_orders', count(*) FROM work_orders
--      UNION ALL SELECT 'work_order_steps', count(*) FROM work_order_steps
--      UNION ALL SELECT 'evidence', count(*) FROM evidence
--      UNION ALL SELECT 'incidents', count(*) FROM incidents
--      UNION ALL SELECT 'assignments', count(*) FROM assignments
--      UNION ALL SELECT 'audit_log', count(*) FROM audit_log
--      UNION ALL SELECT 'notifications', count(*) FROM notifications
--      ORDER BY 1;

-- [2] CHUỖI HASH AUDIT — cảm ứng phải là 0
--      Nếu kết quả khác 0, nghĩa là dữ liệu bị sửa tay ngoài ý muốn.
--      SELECT count(*) FILTER (WHERE row_ok = 0) AS dong_bam_sai,
--             count(*) FILTER (WHERE chain_ok = 0) AS chuoi_bi_duc
--      FROM v_audit_chain_verify;

-- [3] DANH SÁCH THIẾT BỊ QUÁ HẠN — nguồn cảnh báo đỏ trên bảng điều khiển
--      SELECT code, ten_thiet_bi, department, calibration_expiry, days_left
--      FROM v_equipment WHERE days_left < 0 ORDER BY days_left;

-- [4] SẮP ĐẾN HẠN TRONG 30 NGÀY
--      SELECT code, ten_thiet_bi, department, days_left
--      FROM v_equipment WHERE days_left BETWEEN 0 AND 30 ORDER BY days_left;

-- [5] THỬ BR-01 — cả hai câu dưới đây đều phải BÁO LỖI:
--      (a) Phân công phiếu khai thác SC lên thiết bị đã khóa → phải bị chặn
--      INSERT INTO assignments (work_order_id, equipment_id, assignee_id, scheduled_date, created_by)
--      VALUES ((SELECT work_order_id FROM work_orders WHERE code='SC-2026-0102'),
--              (SELECT equipment_id FROM equipment WHERE code='DEV-002'), 1, CURRENT_DATE + 5, 7);
--
--      (b) Tạo phiếu PM cho thiết bị đã khóa → cũng phải bị chặn
--      INSERT INTO work_orders (code, order_type, equipment_id, department_id, status, priority, created_at, deadline)
--      VALUES ('PM-TEST-01','PM', (SELECT equipment_id FROM equipment WHERE code='DEV-007'),
--              4,'CHO_PHAN_CONG','BINH_THUONG', CURRENT_DATE, CURRENT_DATE + 30);
--
--      (c) Còn phiếu HC lên thiết bị đã khóa thì ĐƯỢC PHÉP — đây là lối thoát
--      INSERT INTO work_orders (code, order_type, equipment_id, department_id, status, priority, created_at, deadline)
--      VALUES ('HC-TEST-01','HC', (SELECT equipment_id FROM equipment WHERE code='DEV-002'),
--              1,'CHO_PHAN_CONG','KHAN', CURRENT_DATE, CURRENT_DATE + 7);
--      DELETE FROM work_orders WHERE code = 'HC-TEST-01';   -- dọn sau khi thử

-- [6] THỬ BR-03 — ghi kết quả ĐẠT khi sai số vượt dung sai → phải bị chặn
--      UPDATE work_order_steps SET result = 'DAT', measured_value = 20.0
--      WHERE work_order_id = (SELECT work_order_id FROM work_orders WHERE code='HC-2026-0087')
--        AND ordinal = 2;     -- chuẩn 5,0 dung sai 2,5% → sai số 300% → phải báo lỗi

-- [7] SỐ LIỆU BẢNG ĐIỀU KHIỂN
--      SELECT * FROM v_bang_dieu_khien;

-- [8] BẰNG CHỨNG CÒN THIẾU CỦA CÁC PHIẾU CHỜ NGHIỆM THU
--      SELECT * FROM v_bao_cao_bang_chung WHERE NOT complete;

-- [9] HIỆU SUẤT BẢO TRÌ ĐỊNH KỲ THEO KỸ THUẬT VIÊN
--      SELECT * FROM v_bao_cao_pm ORDER BY on_time_rate DESC;

-- [10] TỔNG HỢP SỰ CỐ 12 THÁNG GẦN NHẤT
--      SELECT * FROM v_bao_cao_su_co WHERE khoa = 'THEO_THANG' ORDER BY thang;

-- [11] GỢI Ý LẬP LỊCH BẢO TRÌ — máy sắp đến hạn nhưng chưa có phiếu PM
--      SELECT v.code, v.ten_thiet_bi, v.department, v.next_pm, v.days_to_pm
--      FROM v_equipment v
--      WHERE v.next_pm IS NOT NULL
--        AND NOT EXISTS (SELECT 1 FROM work_orders wo
--                        WHERE wo.equipment_id = v.equipment_id
--                          AND wo.order_type = 'PM'
--                          AND wo.status <> 'HOAN_THANH')
--      ORDER BY v.next_pm;

-- [12] CHẠY JOB TỰ ĐỘNG KHÓA THIẾT BỊ QUÁ HẠN (nên chạy hằng ngày)
--      SELECT * FROM fn_khoa_thiet_bi_qua_han();
--      Sau khi chạy, kiểm tra lại [2] — chuỗi hash vẫn phải còn nguyên vẹn.


/* =====================================================================
   KẾT THÚC SCRIPT
   ---------------------------------------------------------------------
   Sau khi nạp xong, kết nối ASP.NET Core bằng chuỗi:
       Host=localhost;Port=5432;Database=qltbyt;Username=sa;Password=123456
   ===================================================================== */

