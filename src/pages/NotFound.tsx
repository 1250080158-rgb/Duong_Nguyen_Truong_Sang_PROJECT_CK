import { Link, useLocation } from 'react-router';

// Trang báo "không tìm thấy" — dùng cho mọi đường dẫn không hợp lệ và cho
// trường hợp màn h��nh ném lỗi. Không dùng trang trắng để người dùng biết
// đang ở sai chỗ và có đường quay lại.
export default function NotFound() {
  const { pathname } = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm max-w-md w-full p-8 text-center space-y-4">
        <div className="text-5xl">🔍</div>
        <h1 className="text-xl font-bold text-slate-800">Không tìm thấy trang</h1>
        <p className="text-sm text-slate-500">
          Đường dẫn <span className="font-mono text-slate-700">{pathname}</span> không tồn tại hoặc
          không thuộc phần bạn được phép xem.
        </p>
        <div className="flex justify-center gap-2 pt-1">
          <Link
            to="/"
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700"
          >
            Về trang chủ
          </Link>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 border border-slate-200 text-slate-600 text-sm rounded-lg hover:bg-slate-50"
          >
            Quay lại
          </button>
        </div>
      </div>
    </div>
  );
}
