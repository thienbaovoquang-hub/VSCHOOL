import type {
  DataSourceConfig,
  DataSourceGroupKey,
  DataSourceMethod,
  DataSourceStatus,
  DataSourceSyncMode,
} from '../../types';
import { normalizeDateValue, normalizePhoneValue, validateEmailValue, normalizeText } from '../importExport/validator';

export interface GroupColumnSpec {
  key: string;
  header: string;
  label: string;
  required?: boolean;
  danhMucKey?: string;
  width?: number;
  aliases: string[];
  description: string;
  example: string;
}

export interface DataSourceGroupSpec {
  key: DataSourceGroupKey;
  title: string;
  shortTitle: string;
  description: string;
  defaultFileName: string;
  dataTabNames: string[];
  guideSteps: string[];
}

export const DATA_SOURCE_GROUP_SPECS: Record<DataSourceGroupKey, DataSourceGroupSpec> = {
  students: {
    key: 'students',
    title: 'Học sinh',
    shortTitle: 'Học sinh',
    description: 'Quản lý hồ sơ học sinh phân tách theo từng sheet tab lớp (HocSinh_<Lop>) và năm học.',
    defaultFileName: 'SchoolHub_Mau_HocSinh',
    dataTabNames: ['HocSinh_<Lop>'],
    guideSteps: [
      'Mỗi lớp đang hoạt động có một sheet tab riêng dạng HocSinh_<TenLop> (ví dụ HocSinh_10A1).',
      'Cột MaHocSinh dùng để nhận diện duy nhất khi cập nhật hoặc chuyển lớp theo năm học.',
      'Các cột GioiTinh, Khoi, Lop, NamHoc, TrangThai đều có sẵn Drop-down list từ tab DanhMuc.',
    ],
  },
  staff: {
    key: 'staff',
    title: 'Nhân sự',
    shortTitle: 'Nhân sự',
    description: 'Quản lý danh sách Giáo viên (sheet GiaoVien) và Nhân viên (sheet NhanVien) trong cùng một tệp Excel.',
    defaultFileName: 'SchoolHub_Mau_NhanSu',
    dataTabNames: ['GiaoVien', 'NhanVien'],
    guideSteps: [
      'Sheet GiaoVien lưu hồ sơ giáo viên bộ môn và giáo viên chủ nhiệm.',
      'Sheet NhanVien lưu cán bộ hành chính, thư viện, y tế, thiết bị, bảo vệ.',
      'Cột MaNhanSu (hoặc Email) dùng để đối chiếu cập nhật và chọn từ Drop-down list.',
    ],
  },
  learning: {
    key: 'learning',
    title: 'Lịch học',
    shortTitle: 'Lịch học',
    description: 'Đồng bộ Thời khóa biểu toàn trường (TKB_ToanTruong), theo từng lớp (TKB_<Lop>) và Lịch buổi chiều (ThoiGianBieu_BuoiChieu).',
    defaultFileName: 'SchoolHub_Mau_LichHoc',
    dataTabNames: ['TKB_ToanTruong', 'ThoiGianBieu_BuoiChieu'],
    guideSteps: [
      'Sheet TKB_ToanTruong chứa thời khóa biểu chính khóa tất cả các lớp.',
      'Các sheet TKB_<TenLop> phân tách riêng cho từng lớp, tự động điền lớp theo tên sheet.',
      'Sheet ThoiGianBieu_BuoiChieu lưu lịch phụ đạo, CLB buổi chiều kèm Drop-down list.',
    ],
  },
  books: {
    key: 'books',
    title: 'Sách thư viện',
    shortTitle: 'Sách thư viện',
    description: 'Đồng bộ danh mục đầu sách thư viện phân chia theo sheet tab thể loại (Sach_<TheLoai>). Không làm thay đổi lịch sử mượn/trả đang diễn ra.',
    defaultFileName: 'SchoolHub_Mau_SachThuVien',
    dataTabNames: ['Sach_<TheLoai>'],
    guideSteps: [
      'Mỗi thể loại sách được chia vào một sheet tab riêng dạng Sach_<TheLoai> kèm Drop-down list.',
      'Khi đồng bộ chỉ cập nhật thông tin đầu sách và số lượng; lịch sử mượn trả luôn được bảo toàn.',
      'Các cột TheLoai và TrangThai có sẵn Drop-down list từ tab DanhMuc.',
    ],
  },
  facilities: {
    key: 'facilities',
    title: 'Cơ sở vật chất',
    shortTitle: 'Cơ sở vật chất',
    description: 'Quản lý danh mục tài sản, thiết bị phòng học chia theo sheet tab nhóm tài sản (CSVC_<Nhom>).',
    defaultFileName: 'SchoolHub_Mau_CoSoVatChat',
    dataTabNames: ['CSVC_<Nhom>'],
    guideSteps: [
      'Mỗi nhóm tài sản được tổ chức thành sheet tab riêng dạng CSVC_<NhomTaiSan>.',
      'Các cột NhomTaiSan, LoaiTaiSan, DonViTinh, ViTri, TinhTrang đều có sẵn Drop-down list từ tab DanhMuc.',
    ],
  },
};

export const STUDENT_COLUMNS: GroupColumnSpec[] = [
  { key: 'studentCode', header: 'MaHocSinh', label: 'Mã học sinh', required: true, width: 16, aliases: ['MaHocSinh', 'Mã học sinh', 'Mã HS', 'studentCode'], description: 'Mã định danh duy nhất của học sinh', example: 'HS2026001' },
  { key: 'fullName', header: 'HoTen', label: 'Họ và tên', required: true, width: 24, aliases: ['HoTen', 'Họ và tên', 'Họ tên', 'fullName'], description: 'Họ tên đầy đủ của học sinh', example: 'Nguyễn Minh An' },
  { key: 'dateOfBirth', header: 'NgaySinh', label: 'Ngày sinh', required: false, width: 14, aliases: ['NgaySinh', 'Ngày sinh', 'dateOfBirth'], description: 'Định dạng YYYY-MM-DD hoặc DD/MM/YYYY', example: '2010-05-14' },
  { key: 'gender', header: 'GioiTinh', label: 'Giới tính', required: false, danhMucKey: 'GioiTinh', width: 12, aliases: ['GioiTinh', 'Giới tính', 'gender'], description: 'Nam / Nữ / Khác', example: 'Nam' },
  { key: 'grade', header: 'Khoi', label: 'Khối', required: false, danhMucKey: 'Khoi', width: 10, aliases: ['Khoi', 'Khối', 'grade'], description: 'Khối lớp (10, 11, 12...)', example: '10' },
  { key: 'className', header: 'Lop', label: 'Lớp', required: false, danhMucKey: 'Lop', width: 14, aliases: ['Lop', 'Lớp', 'Tên lớp', 'className'], description: 'Tên lớp đang theo học (khớp với tên tab nếu bỏ trống)', example: '10A1' },
  { key: 'academicYear', header: 'NamHoc', label: 'Năm học', required: false, danhMucKey: 'NamHoc', width: 15, aliases: ['NamHoc', 'Năm học', 'academicYear'], description: 'Năm học áp dụng', example: '2026 - 2027' },
  { key: 'address', header: 'DiaChi', label: 'Địa chỉ', required: false, width: 28, aliases: ['DiaChi', 'Địa chỉ', 'address'], description: 'Địa chỉ liên hệ', example: '12 Nguyễn Trãi, Hà Nội' },
  { key: 'phone', header: 'SoDienThoai', label: 'Số điện thoại', required: false, width: 15, aliases: ['SoDienThoai', 'Số điện thoại', 'SĐT học sinh', 'phone'], description: 'Số điện thoại liên hệ học sinh', example: '0912000111' },
  { key: 'email', header: 'Email', label: 'Email', required: false, width: 24, aliases: ['Email', 'email'], description: 'Địa chỉ email', example: 'an.nm@schoolhub.edu.vn' },
  { key: 'parentName', header: 'HoTenPhuHuynh', label: 'Họ tên phụ huynh', required: false, width: 22, aliases: ['HoTenPhuHuynh', 'Họ tên phụ huynh', 'Phụ huynh', 'parentName'], description: 'Họ tên người giám hộ/phụ huynh', example: 'Nguyễn Văn Bình' },
  { key: 'parentPhone', header: 'SoDienThoaiPhuHuynh', label: 'SĐT phụ huynh', required: false, width: 16, aliases: ['SoDienThoaiPhuHuynh', 'Số điện thoại phụ huynh', 'SĐT phụ huynh', 'parentPhone'], description: 'Số điện thoại phụ huynh', example: '0912345678' },
  { key: 'status', header: 'TrangThai', label: 'Trạng thái', required: false, danhMucKey: 'TrangThaiHocSinh', width: 16, aliases: ['TrangThai', 'Trạng thái', 'status'], description: 'Đang học / Chuyển trường / Đã tốt nghiệp / Tạm dừng học', example: 'Đang học' },
];

export const STAFF_COLUMNS: GroupColumnSpec[] = [
  { key: 'code', header: 'MaNhanSu', label: 'Mã nhân sự', required: true, width: 15, aliases: ['MaNhanSu', 'Mã nhân sự', 'Mã giáo viên', 'Mã nhân viên', 'teacherCode', 'staffCode'], description: 'Mã định danh giáo viên hoặc nhân viên', example: 'GV001' },
  { key: 'fullName', header: 'HoTen', label: 'Họ và tên', required: true, width: 24, aliases: ['HoTen', 'Họ và tên', 'Họ tên', 'fullName'], description: 'Họ tên đầy đủ', example: 'Trần Thị Lan' },
  { key: 'dateOfBirth', header: 'NgaySinh', label: 'Ngày sinh', required: false, width: 14, aliases: ['NgaySinh', 'Ngày sinh', 'dateOfBirth'], description: 'Định dạng YYYY-MM-DD hoặc DD/MM/YYYY', example: '1988-09-20' },
  { key: 'gender', header: 'GioiTinh', label: 'Giới tính', required: false, danhMucKey: 'GioiTinh', width: 12, aliases: ['GioiTinh', 'Giới tính', 'gender'], description: 'Nam / Nữ / Khác', example: 'Nữ' },
  { key: 'email', header: 'Email', label: 'Email', required: false, width: 25, aliases: ['Email', 'email'], description: 'Email công tác', example: 'lan.tt@schoolhub.edu.vn' },
  { key: 'phone', header: 'SoDienThoai', label: 'Số điện thoại', required: false, width: 15, aliases: ['SoDienThoai', 'Số điện thoại', 'SĐT', 'phone'], description: 'Số điện thoại liên hệ', example: '0987654321' },
  { key: 'staffType', header: 'LoaiNhanSu', label: 'Loại nhân sự', required: false, danhMucKey: 'LoaiNhanSu', width: 14, aliases: ['LoaiNhanSu', 'Loại nhân sự', 'Phân loại'], description: 'Giáo viên hoặc Nhân viên', example: 'Giáo viên' },
  { key: 'position', header: 'ChucVu', label: 'Chức vụ', required: false, danhMucKey: 'ChucVu', width: 22, aliases: ['ChucVu', 'Chức vụ', 'Vị trí công tác', 'position'], description: 'Chức vụ / chức danh', example: 'Giáo viên chủ nhiệm' },
  { key: 'professionalGroup', header: 'ToChuyenMon', label: 'Tổ chuyên môn', required: false, danhMucKey: 'ToChuyenMon', width: 20, aliases: ['ToChuyenMon', 'Tổ chuyên môn', 'Tổ bộ môn'], description: 'Tổ chuyên môn đối với giáo viên', example: 'Tổ Toán - Tin' },
  { key: 'department', header: 'BoPhan', label: 'Bộ phận', required: false, danhMucKey: 'BoPhan', width: 20, aliases: ['BoPhan', 'Bộ phận', 'Phòng ban', 'department'], description: 'Bộ phận công tác đối với nhân viên', example: 'Văn phòng' },
  { key: 'subject', header: 'MonGiangDay', label: 'Môn giảng dạy', required: false, danhMucKey: 'MonHoc', width: 18, aliases: ['MonGiangDay', 'Môn giảng dạy', 'Bộ môn', 'subject'], description: 'Môn giảng dạy chính (nếu là giáo viên)', example: 'Toán học' },
  { key: 'status', header: 'TrangThaiCongTac', label: 'Trạng thái công tác', required: false, danhMucKey: 'TrangThaiNhanSu', width: 18, aliases: ['TrangThaiCongTac', 'Trạng thái công tác', 'Trạng thái', 'status'], description: 'Đang công tác / Nghỉ phép', example: 'Đang công tác' },
];

export const TIMETABLE_COLUMNS: GroupColumnSpec[] = [
  { key: 'academicYear', header: 'NamHoc', label: 'Năm học', required: false, danhMucKey: 'NamHoc', width: 15, aliases: ['NamHoc', 'Năm học', 'academicYear'], description: 'Năm học áp dụng', example: '2026 - 2027' },
  { key: 'semester', header: 'HocKy', label: 'Học kỳ', required: false, danhMucKey: 'HocKy', width: 12, aliases: ['HocKy', 'Học kỳ', 'semester'], description: 'HK1 / HK2 / Cả năm', example: 'HK1' },
  { key: 'grade', header: 'Khoi', label: 'Khối', required: false, danhMucKey: 'Khoi', width: 10, aliases: ['Khoi', 'Khối', 'grade'], description: 'Khối lớp', example: '10' },
  { key: 'className', header: 'Lop', label: 'Lớp', required: false, danhMucKey: 'Lop', width: 12, aliases: ['Lop', 'Lớp', 'Tên lớp', 'className'], description: 'Lớp học (tự nhận từ tab TKB_<Lop> nếu bỏ trống)', example: '10A1' },
  { key: 'dayOfWeek', header: 'Thu', label: 'Thứ', required: true, danhMucKey: 'Thu', width: 10, aliases: ['Thu', 'Thứ', 'dayOfWeek'], description: 'Từ 2 đến 7 (hoặc Thứ 2..Thứ 7)', example: '2' },
  { key: 'period', header: 'Tiet', label: 'Tiết', required: true, danhMucKey: 'Tiet', width: 10, aliases: ['Tiet', 'Tiết', 'Tiết học', 'period'], description: 'Tiết từ 1 đến 10', example: '1' },
  { key: 'startTime', header: 'GioBatDau', label: 'Giờ bắt đầu', required: false, width: 12, aliases: ['GioBatDau', 'Giờ bắt đầu', 'startTime'], description: 'HH:MM', example: '07:15' },
  { key: 'endTime', header: 'GioKetThuc', label: 'Giờ kết thúc', required: false, width: 12, aliases: ['GioKetThuc', 'Giờ kết thúc', 'endTime'], description: 'HH:MM', example: '08:00' },
  { key: 'subject', header: 'MonHoc', label: 'Môn học', required: true, danhMucKey: 'MonHoc', width: 18, aliases: ['MonHoc', 'Môn học', 'Môn', 'subject'], description: 'Tên môn học chuẩn theo DanhMuc', example: 'Toán học' },
  { key: 'teacherName', header: 'GiaoVien', label: 'Giáo viên', required: false, width: 22, aliases: ['GiaoVien', 'Giáo viên', 'GV giảng dạy', 'teacherName'], description: 'Giáo viên đứng lớp', example: 'Trần Thị Lan' },
  { key: 'room', header: 'PhongHoc', label: 'Phòng học', required: false, danhMucKey: 'PhongHoc', width: 14, aliases: ['PhongHoc', 'Phòng học', 'Phòng', 'room'], description: 'Mã hoặc tên phòng học', example: 'P101' },
  { key: 'notes', header: 'GhiChu', label: 'Ghi chú', required: false, width: 22, aliases: ['GhiChu', 'Ghi chú', 'notes'], description: 'Ghi chú bổ sung', example: '' },
];

export const AFTERNOON_COLUMNS: GroupColumnSpec[] = [
  { key: 'academicYear', header: 'NamHoc', label: 'Năm học', required: false, danhMucKey: 'NamHoc', width: 15, aliases: ['NamHoc', 'Năm học', 'academicYear'], description: 'Năm học', example: '2026 - 2027' },
  { key: 'date', header: 'Ngay', label: 'Ngày', required: false, width: 14, aliases: ['Ngay', 'Ngày', 'date'], description: 'YYYY-MM-DD (tùy chọn)', example: '2026-09-10' },
  { key: 'dayOfWeek', header: 'Thu', label: 'Thứ', required: true, danhMucKey: 'Thu', width: 10, aliases: ['Thu', 'Thứ', 'dayOfWeek'], description: 'Từ 2 đến 7', example: '4' },
  { key: 'grade', header: 'Khoi', label: 'Khối', required: false, danhMucKey: 'Khoi', width: 10, aliases: ['Khoi', 'Khối', 'grade'], description: 'Khối áp dụng (nếu có)', example: '10' },
  { key: 'className', header: 'Lop', label: 'Lớp', required: false, danhMucKey: 'Lop', width: 14, aliases: ['Lop', 'Lớp', 'className'], description: 'Lớp áp dụng hoặc Toàn trường', example: '10A1' },
  { key: 'startTime', header: 'GioBatDau', label: 'Giờ bắt đầu', required: true, width: 13, aliases: ['GioBatDau', 'Giờ bắt đầu', 'startTime'], description: 'Giờ bắt đầu buổi chiều', example: '14:00' },
  { key: 'endTime', header: 'GioKetThuc', label: 'Giờ kết thúc', required: true, width: 13, aliases: ['GioKetThuc', 'Giờ kết thúc', 'endTime'], description: 'Giờ kết thúc buổi chiều', example: '15:30' },
  { key: 'activity', header: 'HoatDong', label: 'Hoạt động', required: true, width: 28, aliases: ['HoatDong', 'Hoạt động', 'Nội dung', 'activity'], description: 'Tên hoạt động / tiết bồi dưỡng buổi chiều', example: 'Bồi dưỡng HSG Toán' },
  { key: 'location', header: 'DiaDiem', label: 'Địa điểm', required: false, danhMucKey: 'PhongHoc', width: 16, aliases: ['DiaDiem', 'Địa điểm', 'Phòng học', 'location'], description: 'Phòng hoặc khu vực tổ chức', example: 'P203' },
  { key: 'coordinator', header: 'NguoiPhuTrach', label: 'Người phụ trách', required: false, width: 22, aliases: ['NguoiPhuTrach', 'Người phụ trách', 'Giáo viên', 'coordinator'], description: 'Giáo viên / cán bộ phụ trách', example: 'Nguyễn Văn Hùng' },
  { key: 'notes', header: 'GhiChu', label: 'Ghi chú', required: false, width: 22, aliases: ['GhiChu', 'Ghi chú', 'notes'], description: 'Ghi chú thêm', example: 'Mang theo máy tính' },
];

export const BOOK_COLUMNS: GroupColumnSpec[] = [
  { key: 'bookCode', header: 'MaSach', label: 'Mã sách', required: false, width: 15, aliases: ['MaSach', 'Mã sách', 'bookCode'], description: 'Mã đầu sách nội bộ', example: 'SH-BOOK-001' },
  { key: 'isbn', header: 'ISBN', label: 'ISBN', required: false, width: 18, aliases: ['ISBN', 'isbn'], description: 'Mã ISBN quốc tế (MaSach hoặc ISBN phải có)', example: '978-604-0-12345-6' },
  { key: 'title', header: 'TenSach', label: 'Tên sách', required: true, width: 28, aliases: ['TenSach', 'Tên sách', 'Nhan đề', 'title'], description: 'Tên đầu sách', example: 'Giải tích 10 nâng cao' },
  { key: 'author', header: 'TacGia', label: 'Tác giả', required: true, width: 22, aliases: ['TacGia', 'Tác giả', 'author'], description: 'Tên tác giả / chủ biên', example: 'Phan Huy Khải' },
  { key: 'publisher', header: 'NhaXuatBan', label: 'Nhà xuất bản', required: false, width: 20, aliases: ['NhaXuatBan', 'Nhà xuất bản', 'NXB', 'publisher'], description: 'Nhà xuất bản', example: 'NXB Giáo dục' },
  { key: 'publishYear', header: 'NamXuatBan', label: 'Năm xuất bản', required: false, width: 14, aliases: ['NamXuatBan', 'Năm xuất bản', 'publishYear'], description: 'Năm xuất bản (VD: 2024)', example: '2024' },
  { key: 'category', header: 'TheLoai', label: 'Thể loại', required: true, danhMucKey: 'TheLoaiSach', width: 22, aliases: ['TheLoai', 'Thể loại', 'category'], description: 'Thể loại theo danh mục thư viện', example: 'Sách giáo khoa & Tham khảo' },
  { key: 'shelfLocation', header: 'ViTriKe', label: 'Vị trí kệ', required: false, width: 16, aliases: ['ViTriKe', 'Vị trí kệ', 'Kệ sách', 'shelfLocation'], description: 'Vị trí kệ sách', example: 'Kệ A1-Tầng 2' },
  { key: 'totalCopies', header: 'SoLuongTong', label: 'Số lượng tổng', required: true, width: 14, aliases: ['SoLuongTong', 'Số lượng tổng', 'Tổng số bản', 'totalCopies'], description: 'Tổng số bản sách (>= 0)', example: '15' },
  { key: 'availableCopies', header: 'SoLuongHienCo', label: 'Số lượng hiện có', required: false, width: 16, aliases: ['SoLuongHienCo', 'Số lượng hiện có', 'Hiện có', 'availableCopies'], description: 'Số bản còn tại kệ (tự bảo toàn phiếu đang mượn nếu trống)', example: '15' },
  { key: 'status', header: 'TrangThai', label: 'Trạng thái', required: false, danhMucKey: 'TrangThaiSach', width: 16, aliases: ['TrangThai', 'Trạng thái', 'status'], description: 'Sẵn sàng / Ngừng lưu hành', example: 'Sẵn sàng' },
  { key: 'notes', header: 'GhiChu', label: 'Ghi chú', required: false, width: 22, aliases: ['GhiChu', 'Ghi chú', 'notes'], description: 'Ghi chú biên mục', example: '' },
];

export const FACILITY_COLUMNS: GroupColumnSpec[] = [
  { key: 'code', header: 'MaTaiSan', label: 'Mã tài sản', required: true, width: 15, aliases: ['MaTaiSan', 'Mã tài sản', 'Mã thiết bị', 'code'], description: 'Mã tài sản duy nhất', example: 'TS-PC-001' },
  { key: 'name', header: 'TenTaiSan', label: 'Tên tài sản', required: true, width: 26, aliases: ['TenTaiSan', 'Tên tài sản', 'Tên thiết bị', 'name'], description: 'Tên trang thiết bị / tài sản', example: 'Máy chiếu Epson EB-X06' },
  { key: 'assetGroup', header: 'NhomTaiSan', label: 'Nhóm tài sản', required: true, danhMucKey: 'NhomTaiSan', width: 20, aliases: ['NhomTaiSan', 'Nhóm tài sản', 'Danh mục', 'category'], description: 'Nhóm thiết bị chuẩn SchoolHub', example: 'Thiết bị trình chiếu' },
  { key: 'assetType', header: 'LoaiTaiSan', label: 'Loại tài sản', required: false, danhMucKey: 'LoaiTaiSan', width: 18, aliases: ['LoaiTaiSan', 'Loại tài sản', 'assetType'], description: 'Phân loại chi tiết', example: 'Thiết bị giảng dạy' },
  { key: 'quantity', header: 'SoLuong', label: 'Số lượng', required: false, width: 11, aliases: ['SoLuong', 'Số lượng', 'quantity'], description: 'Số lượng (>= 1)', example: '1' },
  { key: 'unit', header: 'DonViTinh', label: 'Đơn vị tính', required: false, danhMucKey: 'DonViTinh', width: 13, aliases: ['DonViTinh', 'Đơn vị tính', 'unit'], description: 'Cái / Bộ / Chiếc / Phòng', example: 'Bộ' },
  { key: 'roomLocation', header: 'ViTri', label: 'Vị trí', required: true, danhMucKey: 'PhongHoc', width: 16, aliases: ['ViTri', 'Vị trí', 'Phòng', 'roomLocation'], description: 'Phòng học hoặc khu vực đặt tài sản', example: 'P101' },
  { key: 'receivedDate', header: 'NgayTiepNhan', label: 'Ngày tiếp nhận', required: false, width: 15, aliases: ['NgayTiepNhan', 'Ngày tiếp nhận', 'Ngày kiểm tra gần nhất', 'receivedDate'], description: 'YYYY-MM-DD hoặc DD/MM/YYYY', example: '2026-08-15' },
  { key: 'condition', header: 'TinhTrang', label: 'Tình trạng', required: false, danhMucKey: 'TinhTrangCSVC', width: 16, aliases: ['TinhTrang', 'Tình trạng', 'Tình trạng kỹ thuật', 'condition'], description: 'Tốt / Cần bảo trì / Hỏng hóc', example: 'Tốt' },
  { key: 'manager', header: 'NguoiQuanLy', label: 'Người quản lý', required: false, width: 20, aliases: ['NguoiQuanLy', 'Người quản lý', 'Phụ trách', 'manager'], description: 'Cán bộ quản lý trực tiếp', example: 'Lê Minh Tuấn' },
  { key: 'notes', header: 'GhiChu', label: 'Ghi chú', required: false, width: 22, aliases: ['GhiChu', 'Ghi chú', 'notes'], description: 'Ghi chú bảo trì / bàn giao', example: '' },
  { key: 'className', header: 'Lop', label: 'Lớp học', required: false, danhMucKey: 'Lop', width: 12, aliases: ['Lop', 'Lớp', 'Lớp học', 'className'], description: 'Lớp học sử dụng thiết bị (tùy chọn)', example: '10A1' },
  { key: 'powerWatts', header: 'CongSuatW', label: 'Công suất (W)', required: false, width: 14, aliases: ['CongSuatW', 'Công suất (W)', 'Công suất', 'powerWatts'], description: 'Công suất định mức (Watt)', example: '140' },
  { key: 'dailyUsageHours', header: 'GioDungNgay', label: 'Giờ dùng/ngày', required: false, width: 14, aliases: ['GioDungNgay', 'Giờ dùng/ngày', 'dailyUsageHours'], description: 'Số giờ dùng mỗi ngày (0-24)', example: '4' },
  { key: 'academicYear', header: 'NamHoc', label: 'Năm học', required: false, danhMucKey: 'NamHoc', width: 15, aliases: ['NamHoc', 'Năm học', 'academicYear'], description: 'Năm học áp dụng', example: '2026 - 2027' },
];

export function sanitizeSheetTabName(raw: string): string {
  const cleaned = String(raw || '')
    .replace(/[\[\]:*?/\\]/g, '_')
    .trim();
  return (cleaned || 'DuLieu').slice(0, 31);
}

export function normalizeHeaderMatchToken(header: string): string {
  return String(header || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\*+/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

export function resolveCellByColumnSpec(
  row: Record<string, unknown>,
  spec: GroupColumnSpec
): unknown {
  if (spec.header in row && normalizeText(row[spec.header]) !== '') {
    return row[spec.header];
  }
  const targetTokens = new Set<string>([
    normalizeHeaderMatchToken(spec.header),
    normalizeHeaderMatchToken(spec.key),
    normalizeHeaderMatchToken(spec.label),
    ...spec.aliases.map(normalizeHeaderMatchToken),
  ]);
  for (const [k, v] of Object.entries(row)) {
    if (targetTokens.has(normalizeHeaderMatchToken(k))) {
      return v;
    }
  }
  return '';
}

export function createConfigDocId(groupKey: DataSourceGroupKey): string {
  return `DSCFG_${groupKey}`;
}

export function applySourceConfiguration(
  existingConfigs: DataSourceConfig[],
  incoming: Omit<DataSourceConfig, 'id'> & { id?: string }
): { nextConfigs: DataSourceConfig[]; savedConfig: DataSourceConfig } {
  const id = createConfigDocId(incoming.groupKey);
  const now = new Date().toISOString();
  const savedConfig: DataSourceConfig = {
    ...incoming,
    id,
    updatedAt: now,
    configuredAt: incoming.configuredAt || now,
  };
  // Enforce strictly ONE active Excel configuration per groupKey
  const filtered = existingConfigs.filter(
    (c) => c.groupKey !== incoming.groupKey && c.id !== id
  );
  return {
    nextConfigs: [savedConfig, ...filtered],
    savedConfig,
  };
}

export function prepareSourceSwitch(params: {
  currentConfig: DataSourceConfig | undefined;
  targetMethod: DataSourceMethod;
  confirmed: boolean;
}): {
  allowed: boolean;
  requiresConfirmation: boolean;
  message: string;
} {
  const { currentConfig, targetMethod, confirmed } = params;
  if (!currentConfig || currentConfig.status === 'unconfigured') {
    return {
      allowed: true,
      requiresConfirmation: false,
      message: 'Nhóm dữ liệu chưa thiết lập nguồn Excel, có thể tải lên trực tiếp.',
    };
  }
  if (currentConfig.activeMethod === targetMethod) {
    return {
      allowed: true,
      requiresConfirmation: false,
      message: 'Cập nhật lại nguồn dữ liệu Excel.',
    };
  }
  if (!confirmed) {
    return {
      allowed: false,
      requiresConfirmation: true,
      message: `Đang sử dụng nguồn Excel (${currentConfig.sourceName}). Dữ liệu hiện có trong SchoolHub sẽ được giữ nguyên.`,
    };
  }
  return {
    allowed: true,
    requiresConfirmation: false,
    message: 'Đã xác nhận cập nhật nguồn dữ liệu Excel.',
  };
}

export function buildSourceStatusUpdate(
  cfg: DataSourceConfig,
  patch: {
    status: DataSourceStatus;
    lastSyncAt?: string;
    lastSyncMessage?: string;
    lastError?: string;
    lastRowCount?: number;
    lastCreatedCount?: number;
    lastUpdatedCount?: number;
    syncMode?: DataSourceSyncMode;
    syncIntervalMinutes?: number;
  }
): DataSourceConfig {
  return {
    ...cfg,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
}

/* ================== CONCURRENT SYNC LOCK MANAGER ================== */
const activeGroupSyncLocks = new Set<DataSourceGroupKey>();

export function acquireGroupSyncLock(groupKey: DataSourceGroupKey): boolean {
  if (activeGroupSyncLocks.has(groupKey)) return false;
  activeGroupSyncLocks.add(groupKey);
  return true;
}

export function releaseGroupSyncLock(groupKey: DataSourceGroupKey): void {
  activeGroupSyncLocks.delete(groupKey);
}

export function isGroupSyncLocked(groupKey: DataSourceGroupKey): boolean {
  return activeGroupSyncLocks.has(groupKey);
}

export function formatSyncDayOfWeekInput(raw: unknown): number | null {
  const txt = normalizeText(raw);
  if (!txt) return null;
  const numMatch = txt.match(/(\d+)/);
  if (numMatch) {
    const n = Number(numMatch[1]);
    if (n >= 2 && n <= 7) return n;
  }
  const lower = txt.toLowerCase();
  if (lower.includes('hai')) return 2;
  if (lower.includes('ba')) return 3;
  if (lower.includes('tư') || lower.includes('tu')) return 4;
  if (lower.includes('năm') || lower.includes('nam')) return 5;
  if (lower.includes('sáu') || lower.includes('sau')) return 6;
  if (lower.includes('bảy') || lower.includes('bay')) return 7;
  return null;
}

export function parseTimeHHMM(raw: unknown): { valid: boolean; value: string } {
  const txt = normalizeText(raw);
  if (!txt) return { valid: true, value: '' };
  const m = txt.match(/^(\d{1,2})[:h](\d{2})$/i);
  if (!m) return { valid: false, value: txt };
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return { valid: false, value: txt };
  return { valid: true, value: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}` };
}

export { normalizeDateValue, normalizePhoneValue, validateEmailValue, normalizeText };
