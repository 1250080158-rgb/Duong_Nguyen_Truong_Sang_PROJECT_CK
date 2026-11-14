using System.Security.Cryptography;
using System.Text;
using MedEquip.Domain.Entities;
using MedEquip.Domain;
using Microsoft.EntityFrameworkCore;

namespace MedEquip.Infrastructure.Services;

public class AuditService : IAuditService
{
    readonly DataContext _db;
    public AuditService(DataContext db) => _db = db;

    public async Task AppendAsync(string actor, string action, string target, string? detail)
    {
        var prev = await _db.AuditLog
            .OrderByDescending(a => a.IdKiemToan)
            .Select(a => a.MaBam)
            .FirstOrDefaultAsync() ?? new string('0', 64);

        var entry = new AuditLog
        {
            TaoLuc = DateTime.UtcNow,
            NguoiThucHien = actor,
            HanhDong = action,
            DoiTuong = target,
            ChiTiet = detail,
            PrevHash = prev,
        };
        entry.MaBam = ComputeHash(entry.PrevHash, entry.NguoiThucHien, entry.HanhDong, entry.DoiTuong, entry.ChiTiet);
        _db.AuditLog.Add(entry);
        await _db.SaveChangesAsync();
    }

    public async Task<List<AuditChainRow>> VerifyChainAsync()
    {
        var rows = await _db.AuditLog.OrderBy(a => a.IdKiemToan).ToListAsync();
        var result = new List<AuditChainRow>(rows.Count);
        string expectedPrev = new string('0', 64);
        foreach (var r in rows)
        {
            var rowOk = ComputeHash(r.PrevHash, r.NguoiThucHien, r.HanhDong, r.DoiTuong, r.ChiTiet) == r.MaBam;
            var chainOk = r.PrevHash == expectedPrev;
            result.Add(new AuditChainRow { Entry = r, RowOk = rowOk, ChainOk = chainOk });
            expectedPrev = r.MaBam;
        }
        return result;
    }

    /// Chuỗi băm phải khớp chính xác với hàm fn_bam_audit trong
    /// database/QLTBYT.sql. PostgreSQL lưu chuỗi ở UTF-8 nên C# cũng băm
    /// trên UTF-8 (bản SQL Server cũ dùng UTF-16LE vì HASHBYTES băm kiểu
    /// nvarchar — chuyển CSDL thì đổi cả hai phía cùng lúc).
    internal static string ComputeHash(string prevHash, string actor, string action, string target, string? detail)
    {
        var payload = $"{prevHash}|{actor}|{action}|{target}|{detail ?? ""}";
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(payload));
        // PostgreSQL encode(..., 'hex') trả về chữ thường, nên C# cũng phải
        // trả chữ thường — nếu dùng Convert.ToHexString (chữ hoa) thì so khớp
        // với giá trị đang lưu trong CSDL luôn thất bại.
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }
}
