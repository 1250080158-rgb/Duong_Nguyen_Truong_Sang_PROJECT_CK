#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Script đổi tên bảng và cột trong file SQL theo mapping
Giữ nguyên comment tiếng Việt có dấu và giá trị dữ liệu
"""

import re

sql_file = r"E:\BAITAP\CK Thứ 6\database\QLTBYT.sql"
output_file = r"E:\BAITAP\CK Thứ 6\database\QLTBYT_NEW.sql"

# Mapping bảng
table_mappings = {
    'departments': 'khoa_phong',
    'manufacturers': 'hang_san_xuat',
    'suppliers': 'nha_cung_cap',
    'equipment_models': 'model_thiet_bi',
    'equipment': 'thiet_bi',
    'equipment_status_history': 'lich_su_trang_thai_tb',
    'users': 'nguoi_dung',
    'work_orders': 'phieu_cong_tac',
    'work_order_steps': 'buoc_phieu',
    'required_evidence_config': 'cau_hinh_bang_chung',
    'evidence': 'bang_chung',
    'incidents': 'su_co',
    'assignments': 'phan_cong',
    'audit_log': 'nhat_ky_kiem_toan',
    'system_config': 'cau_hinh_he_thong',
    'notifications': 'thong_bao',
}

# Mapping cột - dạng {old: new}
column_mappings = {
    # departments/khoa_phong
    'department_id': 'id_khoa',
    'name': 'ten',
    'is_clinical': 'la_lam_sang',
    'address': 'dia_chi',
    'phone': 'dien_thoai',
    'created_at': 'tao_luc',

    # manufacturers/hang_san_xuat
    'manufacturer_id': 'id_hang',
    'country': 'quoc_gia',
    'website': 'website',

    # suppliers/nha_cung_cap
    'supplier_id': 'id_ncc',
    'contact_person': 'nguoi_lien_he',
    'contract_no': 'so_hop_dong',

    # equipment_models/model_thiet_bi
    'model_id': 'id_model',
    'category': 'loai',
    'pm_cycle_days': 'chu_ky_pm_ngay',
    'hc_cycle_days': 'chu_ky_hc_ngay',
    'hc_tolerance_pct': 'dung_sai_hc_phan_tram',
    'is_active': 'hoat_dong',
    'notes': 'ghi_chu',

    # equipment/thiet_bi
    'equipment_id': 'id_thiet_bi',
    'code': 'ma',
    'serial': 'serial',
    'department_id': 'id_khoa',
    'location': 'vi_tri',
    'status': 'trang_thai',
    'calibration_expiry': 'han_hieu_chuan',
    'next_pm': 'pm_ke_tiep',
    'import_date': 'ngay_nhap',
    'warranty_months': 'thang_bao_hanh',
    'purchase_price': 'gia_mua',
    'maintenance_supplier_id': 'id_ncc_bao_tri',

    # users/nguoi_dung
    'user_id': 'id_nguoi_dung',
    'username': 'ten_dang_nhap',
    'full_name': 'ho_ten',
    'email': 'email',
    'employee_no': 'ma_nhan_vien',
    'role': 'vai_tro',
    'last_login': 'dang_nhap_cuoi',

    # work_orders/phieu_cong_tac
    'work_order_id': 'id_phieu',
    'order_type': 'loai_phieu',
    'equipment_id': 'id_thiet_bi',
    'department_id': 'id_khoa',
    'assignee_id': 'id_nguoi_thuc_hien',
    'created_at': 'ngay_tao',
    'deadline': 'han_chot',
    'completed_at': 'hoan_thanh_luc',
    'reviewed_at': 'nghiem_thu_luc',
    'description': 'mo_ta',
    'return_reason': 'ly_do_tra',

    # work_order_steps/buoc_phieu
    'step_id': 'id_buoc',
    'work_order_id': 'id_phieu',
    'ordinal': 'thu_tu',
    'title': 'tieu_de',
    'is_measurement': 'la_do',
    'standard_value': 'gia_tri_chuan',
    'tolerance_pct': 'dung_sai_phan_tram',
    'measured_value': 'gia_tri_do',
    'is_pass': 'dat',
    'done': 'hoan_thanh',
    'skip_reason': 'ly_do_bo',

    # evidence/bang_chung
    'evidence_id': 'id_bang_chung',
    'work_order_id': 'id_phieu',
    'evidence_code': 'ma_bang_chung',
    'file_name': 'ten_tep',
    'file_path': 'duong_dan_tep',
    'file_size': 'kich_thuoc',
    'sha256': 'ma_bam',
    'uploaded_by': 'tai_boi',
    'uploaded_at': 'tai_luc',

    # incidents/su_co
    'incident_id': 'id_su_co',
    'equipment_id': 'id_thiet_bi',
    'department_id': 'id_khoa',
    'reported_by': 'bao_boi',
    'reported_at': 'bao_luc',
    'acknowledged_by': 'tiep_nhan_boi',
    'acknowledged_at': 'tiep_nhan_luc',
    'work_order_id': 'id_phieu',

    # assignments/phan_cong
    'assignment_id': 'id_phan_cong',
    'work_order_id': 'id_phieu',
    'user_id': 'id_nguoi_dung',
    'assigned_at': 'phan_cong_luc',
    'assigned_by': 'phan_cong_boi',

    # audit_log/nhat_ky_kiem_toan
    'audit_id': 'id_kiem_toan',
    'action': 'hanh_dong',
    'actor': 'nguoi_thuc_hien',
    'target': 'doi_tuong',
    'details': 'chi_tiet',
    'audit_hash': 'ma_bam',
    'created_at': 'tao_luc',

    # equipment_status_history/lich_su_trang_thai_tb
    'history_id': 'id_lich_su',
    'equipment_id': 'id_thiet_bi',
    'from_status': 'trang_thai_cu',
    'to_status': 'trang_thai_moi',
    'changed_by': 'doi_boi',
    'reason': 'ly_do',
    'changed_at': 'doi_luc',
}

# Mapping view/function/trigger
view_function_mappings = {
    'v_audit_chain_verify': 'v_xac_minh_chuoi_kiem_toan',
    'v_work_orders': 'v_phieu_cong_tac',
    'v_equipment': 'v_thiet_bi',
    'v_timeline_thiet_bi': 'v_thoi_gian_thiet_bi',
    'fn_khoa_thiet_bi_qua_han': 'fn_khoa_tb_qua_han',
    'fn_bam_audit': 'fn_bam_kiem_toan',
    'trg_assignments_block_overdue': 'trg_phan_cong_chan_qua_han',
    'trg_work_orders_block_khai_thac': 'trg_phieu_chan_khai_thac',
}

# Đọc file
with open(sql_file, 'r', encoding='utf-8') as f:
    content = f.read()

# Thực hiện thay thế bảng
for old, new in table_mappings.items():
    # Thay thế tên bảng trong DROP TABLE, CREATE TABLE, v.v.
    pattern = r'\b' + re.escape(old) + r'\b'
    content = re.sub(pattern, new, content)

# Thực hiện thay thế view/function/trigger
for old, new in view_function_mappings.items():
    pattern = r'\b' + re.escape(old) + r'\b'
    content = re.sub(pattern, new, content)

# Thực hiện thay thế cột - cẩn thận hơn
# Sắp xếp theo độ dài giảm dần để tránh thay thế chuỗi con
sorted_columns = sorted(column_mappings.items(), key=lambda x: len(x[0]), reverse=True)

for old, new in sorted_columns:
    # Các pattern để thay thế tên cột:
    # 1. Trong định nghĩa cột CREATE TABLE: column_name data_type
    # 2. Trong REFERENCES table_name(column_name)
    # 3. Trong SELECT, WHERE, ORDER BY: table.column_name hoặc column_name
    # 4. Trong INSERT INTO table (col1, col2)

    # Pattern 1: column_name data_type (ở đầu dòng hoặc sau khoảng trắng)
    pattern1 = r'(\n\s+)' + re.escape(old) + r'(\s+)'
    content = re.sub(pattern1, r'\1' + new + r'\2', content)

    # Pattern 2: REFERENCES table_name(column_name)
    pattern2 = r'REFERENCES\s+\w+\(' + re.escape(old) + r'\)'
    def replace_ref(match):
        table_name = match.group(0).split('(')[0].replace('REFERENCES ', '')
        return f'REFERENCES {table_name}({new})'
    content = re.sub(pattern2, replace_ref, content)

    # Pattern 3: Trong SELECT, WHERE, v.v. - sau dấu ngoặc, khoảng trắng, hoặc dấu phẩy
    pattern3 = r'([\(,\s])' + re.escape(old) + r'([,\s\)])'
    content = re.sub(pattern3, r'\1' + new + r'\2', content)

    # Pattern 4: table.column_name
    pattern4 = r'\w+\.' + re.escape(old) + r'\b'
    def replace_table_col(match):
        table = match.group(0).split('.')[0]
        return f'{table}.{new}'
    content = re.sub(pattern4, replace_table_col, content)

# Ghi file mới
with open(output_file, 'w', encoding='utf-8') as f:
    f.write(content)

print(f"Đã hoàn thành chuyển đổi. File mới: {output_file}")
