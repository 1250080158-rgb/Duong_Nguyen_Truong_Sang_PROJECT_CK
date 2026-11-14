using System.Data;
using System.Data.Common;
using MedEquip.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace MedEquip.Api.Services;

/// <summary>
/// Đọc trực tiếp các VIEW báo cáo trong CSDL (v_bao_cao_*, v_bang_dieu_khien,
/// v_timeline_thiet_bi).
///
/// Vì sao không dùng EF: các view này không được ánh xạ thành thực thể, mà
/// báo cáo đồ án quy định máy chủ lấy số liệu báo cáo TỪ VIEW — nếu máy chủ
/// tự tính lại thì định nghĩa sẽ có hai chỗ phải giữ đồng bộ và dễ lệch.
/// Đọc thẳng view giữ đúng một nguồn sự thật: SQL.
/// </summary>
public static class ViewReader
{
    /// <summary>Chạy một câu truy vấn và trả về các dòng (tên cột lowercase).</summary>
    public static async Task<List<Row>> QueryAsync(
        DataContext db, string sql, params (string Name, object? Value)[] parameters)
    {
        var rows = new List<Row>();
        var connection = db.Database.GetDbConnection();
        var opened = connection.State != ConnectionState.Open;
        if (opened) await connection.OpenAsync();

        try
        {
            await using var cmd = connection.CreateCommand();
            cmd.CommandText = sql;
            foreach (var (name, value) in parameters)
            {
                var p = cmd.CreateParameter();
                p.ParameterName = "@" + name;
                p.Value = value ?? DBNull.Value;
                cmd.Parameters.Add(p);
            }

            await using var reader = await cmd.ExecuteReaderAsync();
            while (await reader.ReadAsync())
            {
                var row = new Row();
                for (var i = 0; i < reader.FieldCount; i++)
                {
                    var value = await reader.IsDBNullAsync(i) ? null : reader.GetValue(i);
                    row[reader.GetName(i).ToLowerInvariant()] = value;
                }
                rows.Add(row);
            }
        }
        finally
        {
            if (opened) await connection.CloseAsync();
        }

        return rows;
    }
}

/// <summary>Một dòng kết quả truy vấn view, tra cứu theo tên cột.</summary>
public class Row : Dictionary<string, object?>
{
    private object? Raw(string key) => TryGetValue(key, out var v) ? v : null;

    public string? Str(string key) => Raw(key)?.ToString();

    public int Int(string key) =>
        Raw(key) is null or DBNull ? 0 : Convert.ToInt32(Raw(key));

    public decimal Dec(string key) =>
        Raw(key) is null or DBNull ? 0m : Convert.ToDecimal(Raw(key));

    /// <summary>Ngày dạng ISO (yyyy-MM-dd) để giao diện hiển thị.</summary>
    public string? DateIso(string key)
    {
        var raw = Raw(key);
        if (raw is null or DBNull) return null;
        if (raw is DateTime dt) return dt.ToString("yyyy-MM-dd");
        if (raw is DateOnly d) return d.ToString("yyyy-MM-dd");
        return Convert.ToString(raw);
    }

    public DateTime? DateTimeValue(string key)
    {
        var raw = Raw(key);
        if (raw is null or DBNull) return null;
        if (raw is DateTime dt) return dt;
        if (raw is DateOnly d) return d.ToDateTime(TimeOnly.MinValue);
        return Convert.ToDateTime(raw);
    }
}
