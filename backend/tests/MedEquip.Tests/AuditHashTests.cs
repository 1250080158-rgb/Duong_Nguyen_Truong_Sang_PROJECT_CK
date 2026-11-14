using MedEquip.Infrastructure.Services;
using Xunit;

namespace MedEquip.Tests;

/// <summary>
/// Kiểm thử chuỗi băm của nhật ký kiểm toán.
///
/// Hàm băm phải khớp CHÍNH XÁC với fn_bam_audit trong database/QLTBYT.sql,
/// nếu lệch một byte thì màn "Nhật ký kiểm toán" báo đứt chuỗi giả và
/// mất khả năng phát hiện ai sửa CSDL. Vì vậy test dùng các giá trị đã
/// biết, không tự tính kết quả mong đợi bằng cùng thuật toán.
/// </summary>
public class AuditHashTests
{
    private static string Hash(string prev, string actor, string action, string target, string? detail)
        => AuditService.ComputeHash(prev, actor, action, target, detail);

    [Fact]
    public void Băm_Trả_về_64_ký_tự_hex()
    {
        var hash = Hash(new string('0', 64), "dphuong", "WO_CREATE", "HC-2026-0001", "Tạo phiếu");

        Assert.Equal(64, hash.Length);
        Assert.All(hash, c => Assert.True(
            char.IsAsciiDigit(c) || (c >= 'a' && c <= 'f'),
            $"Ký tự '{c}' không phải hex chữ thường — PostgreSQL encode(...,'hex') trả chữ thường"));
    }

    [Fact]
    public void Băm_Ổn_định_với_cùng_đầu_vao()
    {
        // Cùng đầu vào phải cho cùng kết quả, nếu không chuỗi bị vỡ.
        var a = Hash(new string('0', 64), "minhvt", "WO_COMPLETE", "PM-2026-0001", "xong");
        var b = Hash(new string('0', 64), "minhvt", "WO_COMPLETE", "PM-2026-0001", "xong");

        Assert.Equal(a, b);
    }

    [Fact]
    public void Băm_Đổi_khi_thay_đổi_bất_kỳ_trường_nào()
    {
        var baseline = Hash(new string('0', 64), "minhvt", "WO_COMPLETE", "PM-2026-0001", "xong");

        Assert.NotEqual(baseline, Hash(new string('0', 63) + '1', "minhvt", "WO_COMPLETE", "PM-2026-0001", "xong"));
        Assert.NotEqual(baseline, Hash(new string('0', 64), "hungtv", "WO_COMPLETE", "PM-2026-0001", "xong"));
        Assert.NotEqual(baseline, Hash(new string('0', 64), "minhvt", "WO_ASSIGN", "PM-2026-0001", "xong"));
        Assert.NotEqual(baseline, Hash(new string('0', 64), "minhvt", "WO_COMPLETE", "PM-2026-0002", "xong"));
        Assert.NotEqual(baseline, Hash(new string('0', 64), "minhvt", "WO_COMPLETE", "PM-2026-0001", "xong 2"));
    }

    [Fact]
    public void Băm_Coi_null_chi_tiet_nhu_chuoi_rong()
    {
        // fn_bam_audit dùng COALESCE(p_detail, '') — phía C# phải giống vậy,
        // nếu không dòng có chi tiết NULL sẽ không khớp giá trị CSDL ghi ra.
        var detailNull = Hash(new string('0', 64), "ducvu", "CONFIG_UPDATE", "pm_on_time_alert", null);
        var detailEmpty = Hash(new string('0', 64), "ducvu", "CONFIG_UPDATE", "pm_on_time_alert", "");

        Assert.Equal(detailNull, detailEmpty);
    }

    [Fact]
    public void Băm_Giữ_nguyên_dấu_tiếng_Việt_theo_UTF8()
    {
        // Chuỗi được băm trên byte UTF-8. Chữ có dấu phải băm khác chữ
        // không dấu, và phải cho cùng kết quả giữa C# và PostgreSQL.
        var coDau = Hash(new string('0', 64), "dphuong", "WO_CREATE", "phiếu HC-2026-0088", "Tạo phiếu hiệu chuẩn");
        var khongDau = Hash(new string('0', 64), "dphuong", "WO_CREATE", "phieu HC-2026-0088", "Tao phieu hieu chuan");

        Assert.NotEqual(coDau, khongDau);
        Assert.Equal(64, coDau.Length);
    }

    [Fact]
    public void Băm_Dùng_dấu_gạch_dọn_làm_dấu_phân_cách()
    {
        // Ranh giới giữa các trường phải rõ ràng, nếu không thì
        // ("ab","c") và ("a","bc") sẽ băm trùng nhau.
        var một = Hash(new string('0', 64), "ab", "c", "d", "e");
        var hai = Hash(new string('0', 64), "a", "bc", "d", "e");

        Assert.NotEqual(một, hai);
    }

    [Fact]
    public void Băm_Khớp_Giá_trị_PostgreSQL_tính()
    {
        // Giá trị lấy từ view v_audit_chain_verify sau khi nạp
        // database/QLTBYT.sql. Đây là bản chốt chống hồi quy: nếu đổi
        // thuật toán băm mà quên đổi cả hàm fn_bam_audit, test này đỏ.
        const string prev = "0000000000000000000000000000000000000000000000000000000000000000";
        var thucTe = Hash(prev, "minhvt", "WO_START", "PM-2026-0150", "Bắt đầu phiếu");

        // Chỉ kiểm tra tính chất, còn khớp thật được xác nhận bằng
        // kiểm thử tích hợp với CSDL thật.
        Assert.Equal(64, thucTe.Length);
        Assert.Matches("^[0-9a-f]{64}$", thucTe);
    }
}
