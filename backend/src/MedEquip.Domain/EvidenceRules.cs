namespace MedEquip.Domain;

/// <summary>
/// Quy tắc thuộc về bằng chứng hiệu chuẩn. Đặt ở tầng Domain dạng hàm
/// thuần để kiểm thử được mà không cần CSDL, đúng như
/// <see cref="CalibrationRules"/>.
/// </summary>
public static class EvidenceRules
{
    /// <summary>
    /// Quy đổi số byte sang KB để lưu vào cột <c>evidence.file_size_kb</c>.
    ///
    /// Phải làm tròn LÊN và tối thiểu 1. Chia nguyên kiểu cũ
    /// (<c>bytes / 1024</c>) làm mọi tệp dưới 1 KB ra 0, mà CSDL có ràng
    /// buộc <c>file_size_kb &gt; 0</c> — Postgres từ chối INSERT và cả lượt
    /// tải lên trả về HTTP 500 thay vì báo cho người dùng biết nguyên nhân.
    /// </summary>
    public static int ToKilobytes(long bytes)
    {
        if (bytes < 0) throw new ArgumentOutOfRangeException(nameof(bytes));
        return (int)Math.Max(1, Math.Ceiling(bytes / 1024.0));
    }

    /// <summary>
    /// Kích thước tối đa cho một tệp bằng chứng: 10 MB.
    /// </summary>
    public const long MaxBytes = 10 * 1024 * 1024;

    /// <summary>Các MIME type được phép tải lên.</summary>
    public static readonly string[] AllowedContentTypes =
    [
        "image/jpeg", "image/png", "image/webp", "application/pdf",
    ];

    public static bool IsAllowedContentType(string? contentType) =>
        contentType is not null && AllowedContentTypes.Contains(contentType);

    /// <summary>
    /// Chữ ký đầu tệp phải khớp với định dạng khai báo, để đổi đuôi tệp
    /// không vượt được tầng ứng dụng.
    /// </summary>
    public static bool HasKnownSignature(ReadOnlySpan<byte> header)
    {
        if (header.Length < 4) return false;
        if (header[0] == 0xFF && header[1] == 0xD8) return true;                 // JPEG
        if (header[0] == 0x89 && header[1] == 0x50 && header[2] == 0x4E) return true; // PNG
        if (header[0] == 0x25 && header[1] == 0x50 && header[2] == 0x44 && header[3] == 0x46) return true; // %PDF
        if (header[0] == 0x52 && header[1] == 0x49 && header[2] == 0x46 && header[3] == 0x46) return true; // RIFF/WEBP
        return false;
    }
}
