const fs = require('fs');

const sqlFile = 'E:\\BAITAP\\CK Thứ 6\\database\\QLTBYT.sql';
const outputFile = 'E:\\BAITAP\\CK Thứ 6\\database\\QLTBYT_NEW.sql';

// Mapping bảng
const tableMappings = {
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
};

// Mapping cột
const columnMappings = {
    'department_id': 'id_khoa',
    'name': 'ten',
    'is_clinical': 'la_lam_sang',
    'address': 'dia_chi',
    'phone': 'dien_thoai',
    'created_at': 'tao_luc',
    'manufacturer_id': 'id_hang',
    'country': 'quoc_gia',
    'website': 'website',
    'supplier_id': 'id_ncc',
    'contact_person': 'nguoi_lien_he',
    'contract_no': 'so_hop_dong',
    'model_id': 'id_model',
    'category': 'loai',
    'pm_cycle_days': 'chu_ky_pm_ngay',
    'hc_cycle_days': 'chu_ky_hc_ngay',
    'hc_tolerance_pct': 'dung_sai_hc_phan_tram',
    'is_active': 'hoat_dong',
    'notes': 'ghi_chu',
    'equipment_id': 'id_thiet_bi',
    'code': 'ma',
    'serial': 'serial',
    'location': 'vi_tri',
    'status': 'trang_thai',
    'calibration_expiry': 'han_hieu_chuan',
    'next_pm': 'pm_ke_tiep',
    'import_date': 'ngay_nhap',
    'warranty_months': 'thang_bao_hanh',
    'purchase_price': 'gia_mua',
    'maintenance_supplier_id': 'id_ncc_bao_tri',
    'user_id': 'id_nguoi_dung',
    'username': 'ten_dang_nhap',
    'full_name': 'ho_ten',
    'email': 'email',
    'employee_no': 'ma_nhan_vien',
    'role': 'vai_tro',
    'last_login': 'dang_nhap_cuoi',
    'work_order_id': 'id_phieu',
    'order_type': 'loai_phieu',
    'assignee_id': 'id_nguoi_thuc_hien',
    'priority': 'uu_tien',
    'deadline': 'han_chot',
    'completed_at': 'hoan_thanh_luc',
    'reviewed_at': 'nghiem_thu_luc',
    'description': 'mo_ta',
    'return_reason': 'ly_do_tra',
    'progress': 'progress',
    'step_id': 'id_buoc',
    'ordinal': 'thu_tu',
    'title': 'tieu_de',
    'is_measurement': 'la_do',
    'standard_value': 'gia_tri_chuan',
    'tolerance_pct': 'dung_sai_phan_tram',
    'measured_value': 'gia_tri_do',
    'is_pass': 'dat',
    'done': 'hoan_thanh',
    'skip_reason': 'ly_do_bo',
    'evidence_id': 'id_bang_chung',
    'evidence_code': 'ma_bang_chung',
    'file_name': 'ten_tep',
    'file_path': 'duong_dan_tep',
    'file_size': 'kich_thuoc',
    'sha256': 'ma_bam',
    'uploaded_by': 'tai_boi',
    'uploaded_at': 'tai_luc',
    'file_mime': 'file_mime',
    'file_size_kb': 'file_size_kb',
    'config_id': 'config_id',
    'label': 'label',
    'is_required': 'is_required',
    'max_files': 'max_files',
    'accept_mime': 'accept_mime',
    'sort_order': 'sort_order',
    'require_photo': 'require_photo',
    'note': 'note',
    'performed_at': 'performed_at',
    'performed_by': 'performed_by',
    'config_key': 'config_key',
    'config_value': 'config_value',
    'description': 'description',
    'updated_at': 'updated_at',
    'updated_by': 'updated_by',
    'notification_id': 'notification_id',
    'type': 'type',
    'message': 'message',
    'link': 'link',
    'is_read': 'is_read',
    'incident_id': 'id_su_co',
    'reported_by': 'bao_boi',
    'reported_at': 'bao_luc',
    'photo_count': 'photo_count',
    'closed_at': 'closed_at',
    'resolution': 'resolution',
    'acknowledged_by': 'tiep_nhan_boi',
    'acknowledged_at': 'tiep_nhan_luc',
    'assignment_id': 'id_phan_cong',
    'scheduled_date': 'scheduled_date',
    'created_by': 'created_by',
    'assigned_at': 'phan_cong_luc',
    'assigned_by': 'phan_cong_boi',
    'audit_id': 'id_kiem_toan',
    'occurred_at': 'occurred_at',
    'action': 'hanh_dong',
    'actor': 'nguoi_thuc_hien',
    'target': 'doi_tuong',
    'detail': 'chi_tiet',
    'prev_hash': 'prev_hash',
    'row_hash': 'row_hash',
    'audit_hash': 'ma_bam',
    'history_id': 'id_lich_su',
    'from_status': 'trang_thai_cu',
    'to_status': 'trang_thai_moi',
    'changed_by': 'doi_boi',
    'reason': 'ly_do',
    'changed_at': 'doi_luc',
};

// Mapping view/function/trigger
const viewFunctionMappings = {
    'v_audit_chain_verify': 'v_xac_minh_chuoi_kiem_toan',
    'v_work_orders': 'v_phieu_cong_tac',
    'v_equipment': 'v_thiet_bi',
    'v_timeline_thiet_bi': 'v_thoi_gian_thiet_bi',
    'fn_khoa_thiet_bi_qua_han': 'fn_khoa_tb_qua_han',
    'fn_bam_audit': 'fn_bam_kiem_toan',
    'trg_assignments_block_overdue': 'trg_phan_cong_chan_qua_han',
    'trg_work_orders_block_khai_thac': 'trg_phieu_chan_khai_thac',
};

// Đọc file
let content = fs.readFileSync(sqlFile, 'utf8');

// Thực hiện thay thế bảng
for (const [old, new_] of Object.entries(tableMappings)) {
    const regex = new RegExp(`\\b${old}\\b`, 'g');
    content = content.replace(regex, new_);
}

// Thực hiện thay thế view/function/trigger
for (const [old, new_] of Object.entries(viewFunctionMappings)) {
    const regex = new RegExp(`\\b${old}\\b`, 'g');
    content = content.replace(regex, new_);
}

// Thực hiện thay thế cột - sắp xếp theo độ dài giảm dần
const sortedColumns = Object.entries(columnMappings).sort((a, b) => b[0].length - a[0].length);

for (const [old, new_] of sortedColumns) {
    const escapedOld = old.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Pattern 1: column_name data_type (ở đầu dòng hoặc sau khoảng trắng)
    const pattern1 = new RegExp(`(\\n\\s+)${escapedOld}(\\s+)`, 'g');
    content = content.replace(pattern1, `$1${new_}$2`);

    // Pattern 2: REFERENCES table_name(column_name)
    const pattern2 = new RegExp(`REFERENCES\\s+\\w+\\(${escapedOld}\\)`, 'g');
    content = content.replace(pattern2, (match) => {
        const table = match.split('(')[0].replace('REFERENCES ', '');
        return `REFERENCES ${table}(${new_})`;
    });

    // Pattern 3: Trong SELECT, WHERE, v.v. - sau dấu ngoặc, khoảng trắng, hoặc dấu phẩy
    const pattern3 = new RegExp(`([\\(,\\s])${escapedOld}([,\\s\\)])`, 'g');
    content = content.replace(pattern3, `$1${new_}$2`);

    // Pattern 4: table.column_name
    const pattern4 = new RegExp(`\\w+\\.${escapedOld}\\b`, 'g');
    content = content.replace(pattern4, (match) => {
        const table = match.split('.')[0];
        return `${table}.${new_}`;
    });
}

// Ghi file mới
fs.writeFileSync(outputFile, content, 'utf8');

console.log(`Đã hoàn thành chuyển đổi. File mới: ${outputFile}`);
