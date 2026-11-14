namespace MedEquip.Domain;

/// <summary>
/// Lỗi nghiệp vụ có mã máy — middleware của API map Code thành HTTP status
/// và body { code, message, details, actions } đúng như hợp đồng đã đặc tả
/// (VD: CALIBRATION_OVERDUE → 422 kèm số ngày quá hạn + chứng thư căn cứ).
/// </summary>
public class BusinessException : Exception
{
    public string Code { get; }
    public int HttpStatus { get; }
    public object? Details { get; }
    public string[]? Actions { get; }

    public BusinessException(string code, string message, int httpStatus = 422,
        object? details = null, string[]? actions = null) : base(message)
    {
        Code = code;
        HttpStatus = httpStatus;
        Details = details;
        Actions = actions;
    }
}
