# Mapping đổi tên Database sang tiếng Việt không dấu

## Bảng (Tables)

| Tiếng Anh                | Tiếng Việt không dấu  |
| ------------------------ | --------------------- |
| departments              | khoa_phong            |
| manufacturers            | hang_san_xuat         |
| suppliers                | nha_cung_cap          |
| equipment_models         | model_thiet_bi        |
| equipment                | thiet_bi              |
| equipment_status_history | lich_su_trang_thai_tb |
| users                    | nguoi_dung            |
| work_orders              | phieu_cong_tac        |
| work_order_steps         | buoc_phieu            |
| required_evidence_config | cau_hinh_bang_chung   |
| evidence                 | bang_chung            |
| incidents                | su_co                 |
| assignments              | phan_cong             |
| audit_log                | nhat_ky_kiem_toan     |
| system_config            | cau_hinh_he_thong     |
| notifications            | thong_bao             |

## Cột chính (Columns) - departments/khoa_phong

| Tiếng Anh     | Tiếng Việt không dấu |
| ------------- | -------------------- |
| department_id | id_khoa              |
| name          | ten                  |
| is_clinical   | la_lam_sang          |
| address       | dia_chi              |
| phone         | dien_thoai           |
| created_at    | tao_luc              |

## Cột chính (Columns) - manufacturers/hang_san_xuat

| Tiếng Anh       | Tiếng Việt không dấu |
| --------------- | -------------------- |
| manufacturer_id | id_hang              |
| name            | ten                  |
| country         | quoc_gia             |
| website         | website              |

## Cột chính (Columns) - suppliers/nha_cung_cap

| Tiếng Anh      | Tiếng Việt không dấu |
| -------------- | -------------------- |
| supplier_id    | id_ncc               |
| name           | ten                  |
| contact_person | nguoi_lien_he        |
| phone          | dien_thoai           |
| contract_no    | so_hop_dong          |

## Cột chính (Columns) - equipment_models/model_thiet_bi

| Tiếng Anh        | Tiếng Việt không dấu  |
| ---------------- | --------------------- |
| model_id         | id_model              |
| name             | ten                   |
| manufacturer_id  | id_hang               |
| category         | loai                  |
| pm_cycle_days    | chu_ky_pm_ngay        |
| hc_cycle_days    | chu_ky_hc_ngay        |
| hc_tolerance_pct | dung_sai_hc_phan_tram |
| is_active        | hoat_dong             |
| notes            | ghi_chu               |

## Cột chính (Columns) - equipment/thiet_bi

| Tiếng Anh               | Tiếng Việt không dấu |
| ----------------------- | -------------------- |
| equipment_id            | id_thiet_bi          |
| code                    | ma                   |
| name                    | ten                  |
| model_id                | id_model             |
| serial                  | serial               |
| department_id           | id_khoa              |
| location                | vi_tri               |
| status                  | trang_thai           |
| calibration_expiry      | han_hieu_chuan       |
| next_pm                 | pm_ke_tiep           |
| import_date             | ngay_nhap            |
| warranty_months         | thang_bao_hanh       |
| purchase_price          | gia_mua              |
| maintenance_supplier_id | id_ncc_bao_tri       |
| notes                   | ghi_chu              |

## Cột chính (Columns) - users/nguoi_dung

| Tiếng Anh     | Tiếng Việt không dấu |
| ------------- | -------------------- |
| user_id       | id_nguoi_dung        |
| username      | ten_dang_nhap        |
| full_name     | ho_ten               |
| email         | email                |
| employee_no   | ma_nhan_vien         |
| role          | vai_tro              |
| department_id | id_khoa              |
| phone         | dien_thoai           |
| last_login    | dang_nhap_cuoi       |
| is_active     | hoat_dong            |

## Cột chính (Columns) - work_orders/phieu_cong_tac

| Tiếng Anh     | Tiếng Việt không dấu |
| ------------- | -------------------- |
| work_order_id | id_phieu             |
| code          | ma                   |
| order_type    | loai_phieu           |
| equipment_id  | id_thiet_bi          |
| department_id | id_khoa              |
| assignee_id   | id_nguoi_thuc_hien   |
| status        | trang_thai           |
| priority      | uu_tien              |
| created_at    | ngay_tao             |
| deadline      | han_chot             |
| completed_at  | hoan_thanh_luc       |
| reviewed_at   | nghiem_thu_luc       |
| description   | mo_ta                |
| return_reason | ly_do_tra            |

## Cột chính (Columns) - work_order_steps/buoc_phieu

| Tiếng Anh      | Tiếng Việt không dấu |
| -------------- | -------------------- |
| step_id        | id_buoc              |
| work_order_id  | id_phieu             |
| ordinal        | thu_tu               |
| title          | tieu_de              |
| is_measurement | la_do                |
| standard_value | gia_tri_chuan        |
| tolerance_pct  | dung_sai_phan_tram   |
| measured_value | gia_tri_do           |
| is_pass        | dat                  |
| done           | hoan_thanh           |
| skip_reason    | ly_do_bo             |
| completed_at   | hoan_thanh_luc       |

## Cột chính (Columns) - evidence/bang_chung

| Tiếng Anh     | Tiếng Việt không dấu |
| ------------- | -------------------- |
| evidence_id   | id_bang_chung        |
| work_order_id | id_phieu             |
| evidence_code | ma_bang_chung        |
| file_name     | ten_tep              |
| file_path     | duong_dan_tep        |
| file_size     | kich_thuoc           |
| sha256        | ma_bam               |
| uploaded_by   | tai_boi              |
| uploaded_at   | tai_luc              |

## Cột chính (Columns) - incidents/su_co

| Tiếng Anh       | Tiếng Việt không dấu |
| --------------- | -------------------- |
| incident_id     | id_su_co             |
| code            | ma                   |
| equipment_id    | id_thiet_bi          |
| department_id   | id_khoa              |
| reported_by     | bao_boi              |
| reported_at     | bao_luc              |
| status          | trang_thai           |
| severity        | muc_do               |
| description     | mo_ta                |
| acknowledged_by | tiep_nhan_boi        |
| acknowledged_at | tiep_nhan_luc        |
| work_order_id   | id_phieu             |

## Cột chính (Columns) - assignments/phan_cong

| Tiếng Anh     | Tiếng Việt không dấu |
| ------------- | -------------------- |
| assignment_id | id_phan_cong         |
| work_order_id | id_phieu             |
| user_id       | id_nguoi_dung        |
| assigned_at   | phan_cong_luc        |
| assigned_by   | phan_cong_boi        |

## Cột chính (Columns) - audit_log/nhat_ky_kiem_toan

| Tiếng Anh  | Tiếng Việt không dấu |
| ---------- | -------------------- |
| audit_id   | id_kiem_toan         |
| action     | hanh_dong            |
| actor      | nguoi_thuc_hien      |
| target     | doi_tuong            |
| details    | chi_tiet             |
| audit_hash | ma_bam               |
| created_at | tao_luc              |

## Cột chính (Columns) - equipment_status_history/lich_su_trang_thai_tb

| Tiếng Anh    | Tiếng Việt không dấu |
| ------------ | -------------------- |
| history_id   | id_lich_su           |
| equipment_id | id_thiet_bi          |
| from_status  | trang_thai_cu        |
| to_status    | trang_thai_moi       |
| changed_by   | doi_boi              |
| reason       | ly_do                |
| changed_at   | doi_luc              |

## View/Function/Trigger

| Tiếng Anh                       | Tiếng Việt không dấu        |
| ------------------------------- | --------------------------- |
| v_bao_cao_bang_chung            | v_bao_cao_bang_chung        |
| v_bao_cao_pm                    | v_bao_cao_pm                |
| v_bao_cao_su_co                 | v_bao_cao_su_co             |
| v_bao_cao_hieu_chuan            | v_bao_cao_hieu_chuan        |
| v_bang_dieu_khien               | v_bang_dieu_khien           |
| v_audit_chain_verify            | v_xac_minh_chuoi_kiem_toan  |
| v_work_orders                   | v_phieu_cong_tac            |
| v_equipment                     | v_thiet_bi                  |
| v_timeline_thiet_bi             | v_thoi_gian_thiet_bi        |
| fn_khoa_thiet_bi_qua_han        | fn_khoa_tb_qua_han          |
| fn_bam_audit                    | fn_bam_kiem_toan            |
| fn_so_thang                     | fn_so_thang                 |
| fn_chan_phan_cong_qua_han       | fn_chan_phan_cong_qua_han   |
| fn_chan_tao_phieu_khai_thac     | fn_chan_tao_phieu_khai_thac |
| trg_assignments_block_overdue   | trg_phan_cong_chan_qua_han  |
| trg_work_orders_block_khai_thac | trg_phieu_chan_khai_thac    |
