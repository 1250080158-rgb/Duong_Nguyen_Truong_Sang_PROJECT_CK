# Script đổi tên bảng và cột trong file SQL theo mapping
# Giữ nguyên comment tiếng Việt có dấu và giá trị dữ liệu

$sqlFile = "E:\BAITAP\CK Thứ 6\database\QLTBYT.sql"
$outputFile = "E:\BAITAP\CK Thứ 6\database\QLTBYT_NEW.sql"

# Đọc file
$content = Get-Content -Path $sqlFile -Raw

# Mapping bảng
$tableMappings = @{
    'departments' = 'khoa_phong'
    'manufacturers' = 'hang_san_xuat'
    'suppliers' = 'nha_cung_cap'
    'equipment_models' = 'model_thiet_bi'
    'equipment' = 'thiet_bi'
    'equipment_status_history' = 'lich_su_trang_thai_tb'
    'users' = 'nguoi_dung'
    'work_orders' = 'phieu_cong_tac'
    'work_order_steps' = 'buoc_phieu'
    'required_evidence_config' = 'cau_hinh_bang_chung'
    'evidence' = 'bang_chung'
    'incidents' = 'su_co'
    'assignments' = 'phan_cong'
    'audit_log' = 'nhat_ky_kiem_toan'
    'system_config' = 'cau_hinh_he_thong'
    'notifications' = 'thong_bao'
}

# Mapping cột
$columnMappings = @{
    'department_id' = 'id_khoa'
    'name' = 'ten'
    'is_clinical' = 'la_lam_sang'
    'address' = 'dia_chi'
    'phone' = 'dien_thoai'
    'created_at' = 'tao_luc'
    'manufacturer_id' = 'id_hang'
    'country' = 'quoc_gia'
    'website' = 'website'
    'supplier_id' = 'id_ncc'
    'contact_person' = 'nguoi_lien_he'
    'contract_no' = 'so_hop_dong'
    'model_id' = 'id_model'
    'category' = 'loai'
    'pm_cycle_days' = 'chu_ky_pm_ngay'
    'hc_cycle_days' = 'chu_ky_hc_ngay'
    'hc_tolerance_pct' = 'dung_sai_hc_phan_tram'
    'is_active' = 'hoat_dong'
    'notes' = 'ghi_chu'
    'equipment_id' = 'id_thiet_bi'
    'code' = 'ma'
    'serial' = 'serial'
    'location' = 'vi_tri'
    'status' = 'trang_thai'
    'calibration_expiry' = 'han_hieu_chuan'
    'next_pm' = 'pm_ke_tiep'
    'import_date' = 'ngay_nhap'
    'warranty_months' = 'thang_bao_hanh'
    'purchase_price' = 'gia_mua'
    'maintenance_supplier_id' = 'id_ncc_bao_tri'
    'user_id' = 'id_nguoi_dung'
    'username' = 'ten_dang_nhap'
    'full_name' = 'ho_ten'
    'email' = 'email'
    'employee_no' = 'ma_nhan_vien'
    'role' = 'vai_tro'
    'last_login' = 'dang_nhap_cuoi'
    'work_order_id' = 'id_phieu'
    'order_type' = 'loai_phieu'
    'assignee_id' = 'id_nguoi_thuc_hien'
    'deadline' = 'han_chot'
    'completed_at' = 'hoan_thanh_luc'
    'reviewed_at' = 'nghiem_thu_luc'
    'description' = 'mo_ta'
    'return_reason' = 'ly_do_tra'
    'step_id' = 'id_buoc'
    'ordinal' = 'thu_tu'
    'title' = 'tieu_de'
    'is_measurement' = 'la_do'
    'standard_value' = 'gia_tri_chuan'
    'tolerance_pct' = 'dung_sai_phan_tram'
    'measured_value' = 'gia_tri_do'
    'is_pass' = 'dat'
    'done' = 'hoan_thanh'
    'skip_reason' = 'ly_do_bo'
    'evidence_id' = 'id_bang_chung'
    'evidence_code' = 'ma_bang_chung'
    'file_name' = 'ten_tep'
    'file_path' = 'duong_dan_tep'
    'file_size' = 'kich_thuoc'
    'sha256' = 'ma_bam'
    'uploaded_by' = 'tai_boi'
    'uploaded_at' = 'tai_luc'
    'incident_id' = 'id_su_co'
    'reported_by' = 'bao_boi'
    'reported_at' = 'bao_luc'
    'acknowledged_by' = 'tiep_nhan_boi'
    'acknowledged_at' = 'tiep_nhan_luc'
    'assignment_id' = 'id_phan_cong'
    'assigned_at' = 'phan_cong_luc'
    'assigned_by' = 'phan_cong_boi'
    'audit_id' = 'id_kiem_toan'
    'action' = 'hanh_dong'
    'actor' = 'nguoi_thuc_hien'
    'target' = 'doi_tuong'
    'details' = 'chi_tiet'
    'audit_hash' = 'ma_bam'
    'history_id' = 'id_lich_su'
    'from_status' = 'trang_thai_cu'
    'to_status' = 'trang_thai_moi'
    'changed_by' = 'doi_boi'
    'reason' = 'ly_do'
    'changed_at' = 'doi_luc'
}

# Mapping view/function/trigger
$viewFunctionMappings = @{
    'v_audit_chain_verify' = 'v_xac_minh_chuoi_kiem_toan'
    'v_work_orders' = 'v_phieu_cong_tac'
    'v_equipment' = 'v_thiet_bi'
    'v_timeline_thiet_bi' = 'v_thoi_gian_thiet_bi'
    'fn_khoa_thiet_bi_qua_han' = 'fn_khoa_tb_qua_han'
    'fn_bam_audit' = 'fn_bam_kiem_toan'
    'trg_assignments_block_overdue' = 'trg_phan_cong_chan_qua_han'
    'trg_work_orders_block_khai_thac' = 'trg_phieu_chan_khai_thac'
}

# Thực hiện thay thế bảng
foreach ($mapping in $tableMappings.GetEnumerator()) {
    $old = [regex]::Escape($mapping.Key)
    $new = $mapping.Value
    $pattern = "\b$old\b"
    $content = $content -replace $pattern, $new
}

# Thực hiện thay thế view/function/trigger
foreach ($mapping in $viewFunctionMappings.GetEnumerator()) {
    $old = [regex]::Escape($mapping.Key)
    $new = $mapping.Value
    $pattern = "\b$old\b"
    $content = $content -replace $pattern, $new
}

# Thực hiện thay thế cột - sắp xếp theo độ dài giảm dần
$sortedColumns = $columnMappings.GetEnumerator() | Sort-Object { $_.Key.Length } -Descending

foreach ($mapping in $sortedColumns) {
    $old = [regex]::Escape($mapping.Key)
    $new = $mapping.Value

    # Pattern 1: column_name data_type (ở đầu dòng hoặc sau khoảng trắng)
    $pattern1 = "(\n\s+)$old(\s+)"
    $content = $content -replace $pattern1, "`$1$new`$2"

    # Pattern 2: REFERENCES table_name(column_name)
    $pattern2 = "REFERENCES\s+\w+\($old\)"
    $content = $content -replace $pattern2, {
        param($match)
        $table = ($match -split '\(')[0] -replace 'REFERENCES ', ''
        "REFERENCES $table($new)"
    }

    # Pattern 3: Trong SELECT, WHERE, v.v. - sau dấu ngoặc, khoảng trắng, hoặc dấu phẩy
    $pattern3 = "([\(,\s])$old([,\s\)])"
    $content = $content -replace $pattern3, "`$1$new`$2"

    # Pattern 4: table.column_name
    $pattern4 = "\w+\.$old\b"
    $content = $content -replace $pattern4, {
        param($match)
        $table = ($match -split '\.')[0]
        "$table.$new"
    }
}

# Ghi file mới
$content | Out-File -FilePath $outputFile -NoNewline

Write-Host "Đã hoàn thành chuyển đổi. File mới: $outputFile"
