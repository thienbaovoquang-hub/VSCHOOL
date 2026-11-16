import type {
  AcademicYearConfig,
  CatalogGroupKey,
  DataCatalogDefinition,
  DataCatalogOption,
  GoogleSheetValidationColumnSpec,
  ImportModuleKey,
  RuleCategory,
  SchoolClass,
  SchoolRoom,
  SystemSettings,
} from '../../types';
import type { MODULE_SCHEMAS } from '../importExport/schemas';

export interface CatalogRuntimeData {
  dataCatalogs?: DataCatalogDefinition[];
  classes?: SchoolClass[];
  academicYears?: AcademicYearConfig[];
  rooms?: SchoolRoom[];
  ruleCategories?: RuleCategory[];
  systemSettings?: SystemSettings;
}

const nowIso = '2026-09-01T00:00:00.000Z';

function opt(
  id: string,
  value: string,
  order: number,
  extra: Partial<DataCatalogOption> = {}
): DataCatalogOption {
  return {
    id,
    value,
    label: extra.label || value,
    order,
    active: true,
    ...extra,
  };
}

export const CATALOG_GROUP_LABELS: Record<CatalogGroupKey, string> = {
  students: 'Học sinh & Học vụ',
  teachers_staff: 'Giáo viên & Nhân sự',
  library: 'Thư viện',
  emulation: 'Thi đua & Nội quy',
  facilities: 'Cơ sở vật chất',
  communication_services: 'Truyền thông & Dịch vụ',
};

export const DEFAULT_DATA_CATALOGS: DataCatalogDefinition[] = [
  /* ---------------- HỌC SINH & HỌC VỤ ---------------- */
  {
    id: 'student_gender',
    code: 'STUDENT_GENDER',
    name: 'Giới tính',
    group: 'students',
    description: 'Danh mục chuẩn giới tính dùng trong hồ sơ học sinh, giáo viên và nhân sự.',
    required: true,
    isReportCritical: true,
    options: [
      opt('nam', 'Nam', 1, { isDefault: true }),
      opt('nu', 'Nữ', 2),
      opt('khac', 'Khác', 3),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'student_grade',
    code: 'STUDENT_GRADE',
    name: 'Khối lớp',
    group: 'students',
    description: 'Danh mục khối học dùng để lọc và ràng buộc lớp học phụ thuộc.',
    required: true,
    isReportCritical: true,
    options: [
      opt('g10', '10', 1, { label: 'Khối 10', isDefault: true }),
      opt('g11', '11', 2, { label: 'Khối 11' }),
      opt('g12', '12', 3, { label: 'Khối 12' }),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'student_status',
    code: 'STUDENT_STATUS',
    name: 'Trạng thái học tập',
    group: 'students',
    description: 'Trạng thái theo học hiện tại của học sinh.',
    required: true,
    isReportCritical: true,
    options: [
      opt('studying', 'Đang học', 1, { isDefault: true }),
      opt('transfer', 'Chuyển trường', 2),
      opt('graduated', 'Đã tốt nghiệp', 3),
      opt('dropped', 'Nghỉ học', 4),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'student_conduct',
    code: 'STUDENT_CONDUCT',
    name: 'Hạnh kiểm học sinh',
    group: 'students',
    description: 'Xếp loại hạnh kiểm chuẩn của học sinh.',
    required: false,
    allowEmpty: true,
    isReportCritical: true,
    options: [
      opt('good', 'Tốt', 1, { isDefault: true }),
      opt('fair', 'Khá', 2),
      opt('average', 'Trung bình', 3),
      opt('weak', 'Yếu', 4),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'semester',
    code: 'ACADEMIC_SEMESTER',
    name: 'Học kỳ',
    group: 'students',
    description: 'Danh mục học kỳ dùng cho Năm học, Phân công giảng dạy và Bảng điểm.',
    required: true,
    isReportCritical: true,
    options: [
      opt('hk1', 'HK1', 1, { label: 'Học kỳ 1 (HK1)', isDefault: true }),
      opt('hk2', 'HK2', 2, { label: 'Học kỳ 2 (HK2)' }),
      opt('full_year', 'Cả năm', 3, { label: 'Cả năm học' }),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'parent_relation',
    code: 'PARENT_RELATION',
    name: 'Quan hệ phụ huynh',
    group: 'students',
    description: 'Mối quan hệ của người liên hệ chính với học sinh.',
    required: false,
    allowEmpty: true,
    options: [
      opt('mother', 'Mẹ', 1, { isDefault: true }),
      opt('father', 'Bố', 2),
      opt('guardian', 'Người giám hộ', 3),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'student_ethnicity',
    code: 'STUDENT_ETHNICITY',
    name: 'Dân tộc',
    group: 'students',
    description: 'Danh mục dân tộc phục vụ thống kê phổ cập.',
    required: false,
    allowEmpty: true,
    options: [
      opt('kinh', 'Kinh', 1, { isDefault: true }),
      opt('tay', 'Tày', 2),
      opt('thai', 'Thái', 3),
      opt('muong', 'Mường', 4),
      opt('khmer', 'Khmer', 5),
      opt('hoa', 'Hoa', 6),
      opt('nung', 'Nùng', 7),
      opt('other', 'Khác', 8),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'student_policy_group',
    code: 'STUDENT_POLICY_GROUP',
    name: 'Đối tượng chính sách',
    group: 'students',
    description: 'Nhóm đối tượng ưu tiên, miễn giảm học phí hoặc hỗ trợ học bổng.',
    required: false,
    allowEmpty: true,
    options: [
      opt('none', 'Không', 1, { isDefault: true }),
      opt('poor', 'Hộ nghèo / Cận nghèo', 2),
      opt('merit', 'Con gia đình chính sách', 3),
      opt('minority', 'Học sinh vùng khó khăn', 4),
      opt('disability', 'Học sinh khuyết tật', 5),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'student_dossier_status',
    code: 'STUDENT_DOSSIER_STATUS',
    name: 'Tình trạng hồ sơ nhập học',
    group: 'students',
    description: 'Theo dõi mức độ hoàn thiện hồ sơ học bạ của học sinh.',
    required: false,
    allowEmpty: true,
    options: [
      opt('complete', 'Đầy đủ', 1, { isDefault: true }),
      opt('pending_supplement', 'Chờ bổ sung', 2),
      opt('missing', 'Chưa nộp', 3),
    ],
    updatedAt: nowIso,
  },

  /* ---------------- GIÁO VIÊN & NHÂN SỰ ---------------- */
  {
    id: 'teacher_department',
    code: 'TEACHER_DEPARTMENT',
    name: 'Tổ chuyên môn',
    group: 'teachers_staff',
    description: 'Tổ bộ môn quản lý giáo viên và liên kết danh sách môn giảng dạy.',
    required: false,
    allowEmpty: true,
    options: [
      opt('dept_math_it', 'Tổ Toán - Tin', 1, { isDefault: true }),
      opt('dept_lit', 'Tổ Ngữ văn', 2),
      opt('dept_eng', 'Tổ Ngoại ngữ', 3),
      opt('dept_nat', 'Tổ Khoa học Tự nhiên', 4),
      opt('dept_soc', 'Tổ Khoa học Xã hội', 5),
      opt('dept_pe', 'Tổ Thể dục - QP&AN', 6),
      opt('dept_tech', 'Tổ Công nghệ - Nghệ thuật', 7),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'teacher_subject',
    code: 'TEACHER_SUBJECT',
    name: 'Bộ môn / Môn học',
    group: 'teachers_staff',
    description: 'Môn giảng dạy chuẩn, liên kết phụ thuộc theo Tổ chuyên môn.',
    required: true,
    parentCatalogId: 'teacher_department',
    options: [
      opt('math', 'Toán học', 1, { parentValue: 'Tổ Toán - Tin', isDefault: true }),
      opt('it', 'Tin học', 2, { parentValue: 'Tổ Toán - Tin' }),
      opt('lit', 'Ngữ văn', 3, { parentValue: 'Tổ Ngữ văn' }),
      opt('eng', 'Tiếng Anh', 4, { parentValue: 'Tổ Ngoại ngữ' }),
      opt('phy', 'Vật lí', 5, { parentValue: 'Tổ Khoa học Tự nhiên' }),
      opt('che', 'Hóa học', 6, { parentValue: 'Tổ Khoa học Tự nhiên' }),
      opt('bio', 'Sinh học', 7, { parentValue: 'Tổ Khoa học Tự nhiên' }),
      opt('his', 'Lịch sử', 8, { parentValue: 'Tổ Khoa học Xã hội' }),
      opt('geo', 'Địa lí', 9, { parentValue: 'Tổ Khoa học Xã hội' }),
      opt('civ', 'Giáo dục công dân', 10, { parentValue: 'Tổ Khoa học Xã hội' }),
      opt('tech', 'Công nghệ', 11, { parentValue: 'Tổ Công nghệ - Nghệ thuật' }),
      opt('pe', 'Thể dục', 12, { parentValue: 'Tổ Thể dục - QP&AN' }),
      opt('def', 'Quốc phòng - An ninh', 13, { parentValue: 'Tổ Thể dục - QP&AN' }),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'staff_department',
    code: 'STAFF_DEPARTMENT',
    name: 'Bộ phận / Phòng ban',
    group: 'teachers_staff',
    description: 'Đơn vị trực thuộc của nhân viên hành chính & hỗ trợ.',
    required: true,
    options: [
      opt('office', 'Văn phòng', 1, { isDefault: true }),
      opt('library', 'Thư viện', 2),
      opt('medical', 'Y tế', 3),
      opt('facilities', 'Cơ sở vật chất', 4),
      opt('counseling', 'Tư vấn', 5),
      opt('security', 'Bảo vệ', 6),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'staff_position',
    code: 'STAFF_POSITION',
    name: 'Chức vụ nhân sự',
    group: 'teachers_staff',
    description: 'Chức danh vị trí công tác chuẩn hóa.',
    required: true,
    options: [
      opt('admin_spec', 'Chuyên viên hành chính', 1, { isDefault: true }),
      opt('librarian', 'Thủ thư', 2),
      opt('nurse', 'Nhân viên y tế', 3),
      opt('counselor', 'Chuyên viên tâm lý học đường', 4),
      opt('tech_staff', 'Kỹ thuật viên thiết bị', 5),
      opt('guard', 'Nhân viên bảo vệ', 6),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'employment_type',
    code: 'EMPLOYMENT_TYPE',
    name: 'Hình thức hợp đồng',
    group: 'teachers_staff',
    description: 'Loại hình biên chế hoặc hợp đồng lao động.',
    required: false,
    allowEmpty: true,
    options: [
      opt('perm', 'Biên chế', 1, { isDefault: true }),
      opt('long_term', 'Hợp đồng dài hạn', 2),
      opt('visiting', 'Thỉnh giảng', 3),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'staff_status',
    code: 'STAFF_STATUS',
    name: 'Trạng thái công tác',
    group: 'teachers_staff',
    description: 'Tình trạng làm việc của giáo viên và nhân viên.',
    required: true,
    options: [
      opt('working', 'Đang công tác', 1, { isDefault: true }),
      opt('leave', 'Nghỉ phép', 2),
    ],
    updatedAt: nowIso,
  },

  /* ---------------- THƯ VIỆN ---------------- */
  {
    id: 'book_category',
    code: 'BOOK_CATEGORY',
    name: 'Thể loại sách',
    group: 'library',
    description: 'Danh mục thể loại sách thống nhất giữa giao diện, tìm kiếm, Excel và Google Sheets.',
    required: true,
    isReportCritical: true,
    options: [
      opt('sci', 'Khoa học tự nhiên', 1),
      opt('lit', 'Văn học & Ngữ văn', 2),
      opt('tech', 'Công nghệ & Tin học', 3),
      opt('lang', 'Ngoại ngữ', 4),
      opt('life', 'Kỹ năng sống', 5),
      opt('textbook', 'Sách giáo khoa & Tham khảo', 6, { isDefault: true }),
      opt('soc', 'Lịch sử & Xã hội', 7),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'book_copy_status',
    code: 'BOOK_COPY_STATUS',
    name: 'Trạng thái lưu thông bản sao',
    group: 'library',
    description: 'Trạng thái lưu thông của bản sao sách vật lý.',
    required: true,
    options: [
      opt('available', 'available', 1, { label: 'Sẵn sàng (available)', isDefault: true }),
      opt('borrowed', 'borrowed', 2, { label: 'Đang mượn (borrowed)' }),
      opt('reserved', 'reserved', 3, { label: 'Đã đặt giữ (reserved)' }),
      opt('overdue', 'overdue', 4, { label: 'Quá hạn (overdue)' }),
      opt('damaged', 'damaged', 5, { label: 'Hư hỏng (damaged)' }),
      opt('lost', 'lost', 6, { label: 'Thất lạc (lost)' }),
      opt('maintenance', 'maintenance', 7, { label: 'Bảo trì (maintenance)' }),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'book_copy_condition',
    code: 'BOOK_COPY_CONDITION',
    name: 'Tình trạng vật lý sách',
    group: 'library',
    description: 'Đánh giá chất lượng giấy bìa của từng bản sao sách.',
    required: true,
    options: [
      opt('good', 'Tốt', 1, { isDefault: true }),
      opt('fair', 'Khá', 2),
      opt('repair', 'Cần sửa', 3),
      opt('broken', 'Hỏng', 4),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'library_transaction_status',
    code: 'LIBRARY_TRANSACTION_STATUS',
    name: 'Trạng thái phiếu mượn trả',
    group: 'library',
    description: 'Trạng thái lưu thông của giao dịch mượn/trả sách thư viện.',
    required: true,
    options: [
      opt('borrowed', 'borrowed', 1, { label: 'Đang mượn (borrowed)', isDefault: true }),
      opt('returned', 'returned', 2, { label: 'Đã trả (returned)' }),
      opt('overdue', 'overdue', 3, { label: 'Quá hạn (overdue)' }),
      opt('lost', 'lost', 4, { label: 'Thất lạc (lost)' }),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'book_return_condition',
    code: 'BOOK_RETURN_CONDITION',
    name: 'Tình trạng sách khi trả',
    group: 'library',
    description: 'Kiểm định chất lượng sách khi bạn đọc hoàn trả tại quầy thư viện.',
    required: true,
    options: [
      opt('good', 'Tốt', 1, { isDefault: true }),
      opt('minor_damage', 'Hư hỏng nhẹ', 2),
      opt('broken', 'Hỏng', 3),
      opt('lost', 'Mất', 4),
    ],
    updatedAt: nowIso,
  },

  /* ---------------- THI ĐUA & NỘI QUY ---------------- */
  {
    id: 'emulation_record_type',
    code: 'EMULATION_RECORD_TYPE',
    name: 'Loại ghi nhận thi đua',
    group: 'emulation',
    description: 'Phân loại vi phạm nề nếp hoặc thành tích tuyên dương.',
    required: true,
    isReportCritical: true,
    options: [
      opt('violation', 'violation', 1, { label: 'Vi phạm (violation)', isDefault: true }),
      opt('achievement', 'achievement', 2, { label: 'Thành tích (achievement)' }),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'rule_target_scope',
    code: 'RULE_TARGET_SCOPE',
    name: 'Phạm vi áp dụng nội quy',
    group: 'emulation',
    description: 'Đối tượng áp dụng cho tiêu chí nội quy & phiếu ghi nhận.',
    required: true,
    options: [
      opt('individual', 'individual', 1, { label: 'Cá nhân học sinh (individual)', isDefault: true }),
      opt('class', 'class', 2, { label: 'Tập thể lớp (class)' }),
      opt('group', 'group', 3, { label: 'Nhóm / Chi đoàn (group)' }),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'rule_severity',
    code: 'RULE_SEVERITY',
    name: 'Mức độ vi phạm / khen thưởng',
    group: 'emulation',
    description: 'Phân cấp mức độ nghiêm trọng để tổng hợp báo cáo nề nếp.',
    required: false,
    allowEmpty: true,
    isReportCritical: true,
    options: [
      opt('light', 'Nhẹ', 1, { isDefault: true }),
      opt('medium', 'Trung bình', 2),
      opt('severe', 'Nghiêm trọng', 3),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'emulation_workflow_status',
    code: 'EMULATION_WORKFLOW_STATUS',
    name: 'Trạng thái duyệt ghi nhận thi đua',
    group: 'emulation',
    description: 'Trạng thái quy trình phê duyệt ghi nhận thi đua.',
    required: true,
    options: [
      opt('draft', 'draft', 1, { label: 'Nháp (draft)' }),
      opt('pending_verification', 'pending_verification', 2, { label: 'Chờ xác minh (pending_verification)', isDefault: true }),
      opt('verified', 'verified', 3, { label: 'Đã xác minh (verified)' }),
      opt('recorded', 'recorded', 4, { label: 'Đã ghi nhận chính thức (recorded)' }),
    ],
    updatedAt: nowIso,
  },

  /* ---------------- CƠ SỞ VẬT CHẤT ---------------- */
  {
    id: 'room_type',
    code: 'ROOM_TYPE',
    name: 'Loại phòng học & chức năng',
    group: 'facilities',
    description: 'Phân loại phòng học, phòng bộ môn, thư viện và hội trường.',
    required: true,
    options: [
      opt('classroom', 'Phòng học', 1, { isDefault: true }),
      opt('lab', 'Phòng thí nghiệm', 2),
      opt('computer', 'Phòng máy', 3),
      opt('library', 'Thư viện', 4),
      opt('hall', 'Hội trường', 5),
      opt('functional', 'Phòng chức năng', 6),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'room_status',
    code: 'ROOM_STATUS',
    name: 'Trạng thái phòng học',
    group: 'facilities',
    description: 'Tình trạng sẵn sàng khai thác của phòng học.',
    required: true,
    options: [
      opt('ready', 'Sẵn sàng', 1, { isDefault: true }),
      opt('in_use', 'Đang sử dụng', 2),
      opt('maintenance', 'Bảo trì', 3),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'facility_category',
    code: 'FACILITY_CATEGORY',
    name: 'Nhóm thiết bị cơ sở vật chất',
    group: 'facilities',
    description: 'Phân loại tài sản & thiết bị phòng học.',
    required: true,
    options: [
      opt('proj', 'Thiết bị trình chiếu', 1, { isDefault: true }),
      opt('pc', 'Máy tính', 2),
      opt('desk', 'Bàn ghế', 3),
      opt('ac', 'Điều hòa - Quạt', 4),
      opt('lab', 'Thiết bị thí nghiệm', 5),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'facility_condition',
    code: 'FACILITY_CONDITION',
    name: 'Tình trạng thiết bị',
    group: 'facilities',
    description: 'Tình trạng kỹ thuật thực tế của tài sản.',
    required: true,
    options: [
      opt('good', 'Tốt', 1, { isDefault: true }),
      opt('maint', 'Cần bảo trì', 2),
      opt('broken', 'Hỏng hóc', 3),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'facility_status',
    code: 'FACILITY_STATUS',
    name: 'Trạng thái sử dụng thiết bị',
    group: 'facilities',
    description: 'Trạng thái khai thác tài sản cơ sở vật chất.',
    required: true,
    options: [
      opt('active', 'Đang sử dụng', 1, { isDefault: true }),
      opt('repair', 'Đang sửa chữa', 2),
      opt('retired', 'Ngừng sử dụng', 3),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'priority_level',
    code: 'PRIORITY_LEVEL',
    name: 'Mức độ ưu tiên xử lý',
    group: 'facilities',
    description: 'Thang mức ưu tiên cho phiếu bảo trì CSVC, phản ánh và hỗ trợ kỹ thuật.',
    required: true,
    options: [
      opt('low', 'low', 1, { label: 'Thấp (low)' }),
      opt('medium', 'medium', 2, { label: 'Trung bình (medium)', isDefault: true }),
      opt('high', 'high', 3, { label: 'Cao (high)' }),
      opt('urgent', 'urgent', 4, { label: 'Khẩn cấp (urgent)' }),
    ],
    updatedAt: nowIso,
  },

  /* ---------------- TRUYỀN THÔNG & DỊCH VỤ ---------------- */
  {
    id: 'leave_request_type',
    code: 'LEAVE_REQUEST_TYPE',
    name: 'Loại đơn xin phép học sinh',
    group: 'communication_services',
    description: 'Danh mục phân loại đơn từ hành chính của học sinh.',
    required: true,
    options: [
      opt('sick', 'Nghỉ ốm', 1, { isDefault: true }),
      opt('family', 'Việc gia đình', 2),
      opt('transfer', 'Chuyển lớp', 3),
      opt('confirm', 'Xác nhận học sinh', 4),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'feedback_category',
    code: 'FEEDBACK_CATEGORY',
    name: 'Chủ đề phản ánh học đường',
    group: 'communication_services',
    description: 'Danh mục phân loại phản ánh và kiến nghị từ học sinh/phụ huynh.',
    required: true,
    options: [
      opt('facility', 'Cơ sở vật chất', 1, { isDefault: true }),
      opt('env', 'Môi trường học đường', 2),
      opt('edu', 'Kiến nghị đào tạo', 3),
      opt('viol', 'Báo cáo vi phạm', 4),
      opt('other', 'Khác', 5),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'announcement_category',
    code: 'ANNOUNCEMENT_CATEGORY',
    name: 'Chuyên mục thông báo',
    group: 'communication_services',
    description: 'Nhóm chuyên mục dùng khi soạn thảo, lọc và nhập bảng thông báo.',
    required: true,
    options: [
      opt('all', 'Toàn trường', 1, { isDefault: true }),
      opt('study', 'Học tập', 2),
      opt('youth', 'Đoàn - Đội', 3),
      opt('exam', 'Khảo thí', 4),
      opt('urgent', 'Khẩn cấp', 5),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'announcement_audience',
    code: 'ANNOUNCEMENT_AUDIENCE',
    name: 'Đối tượng nhận thông báo',
    group: 'communication_services',
    description: 'Phạm vi đối tượng nhận thông báo truyền thông nội bộ.',
    required: true,
    options: [
      opt('all', 'Toàn trường', 1, { isDefault: true }),
      opt('g10', 'Khối 10', 2),
      opt('g11', 'Khối 11', 3),
      opt('g12', 'Khối 12', 4),
      opt('teachers', 'Giáo viên', 5),
    ],
    updatedAt: nowIso,
  },
  {
    id: 'survey_audience',
    code: 'SURVEY_AUDIENCE',
    name: 'Đối tượng tham gia khảo sát',
    group: 'communication_services',
    description: 'Phạm vi áp dụng của phiếu khảo sát học đường.',
    required: true,
    options: [
      opt('all', 'Toàn trường', 1, { isDefault: true }),
      opt('by_grade', 'Theo khối', 2),
      opt('by_class', 'Theo lớp', 3),
    ],
    updatedAt: nowIso,
  },
];

export function stripVietnameseForMatch(input: string): string {
  return (input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
}

export function sanitizeFirestoreDocId(rawId: string, prefix: string = 'DOC'): string {
  const cleaned = stripVietnameseForMatch(rawId || '')
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9_.-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[_.-]+|[_.-]+$/g, '');
  if (!cleaned) {
    return `${prefix}_${Date.now()}`;
  }
  return cleaned.slice(0, 120);
}

/**
 * Merges persisted Firestore data catalogs with system defaults so newly introduced
 * catalogs always appear and existing custom options/orders are preserved.
 */
export function mergeDataCatalogs(
  storedCatalogs?: DataCatalogDefinition[]
): DataCatalogDefinition[] {
  const storedMap = new Map<string, DataCatalogDefinition>();
  for (const cat of storedCatalogs || []) {
    if (cat && cat.id) storedMap.set(cat.id, cat);
  }

  const merged: DataCatalogDefinition[] = [];
  for (const def of DEFAULT_DATA_CATALOGS) {
    const custom = storedMap.get(def.id);
    if (!custom) {
      merged.push({
        ...def,
        options: def.options.map((o) => ({ ...o })),
      });
    } else {
      merged.push({
        ...def,
        ...custom,
        options: Array.isArray(custom.options) && custom.options.length > 0
          ? [...custom.options].sort((a, b) => a.order - b.order)
          : def.options.map((o) => ({ ...o })),
      });
      storedMap.delete(def.id);
    }
  }

  for (const extra of storedMap.values()) {
    merged.push({
      ...extra,
      options: [...(extra.options || [])].sort((a, b) => a.order - b.order),
    });
  }

  return merged;
}

export function getCatalogById(
  catalogId: string,
  runtime: CatalogRuntimeData = {}
): DataCatalogDefinition | undefined {
  return mergeDataCatalogs(runtime.dataCatalogs).find((c) => c.id === catalogId);
}

export function resolveCatalogOptions(params: {
  catalogId?: string;
  lookupCatalog?: string;
  staticOptions?: string[];
  parentValue?: string;
  includeInactive?: boolean;
  runtime?: CatalogRuntimeData;
}): DataCatalogOption[] {
  const {
    catalogId,
    lookupCatalog,
    staticOptions,
    parentValue,
    includeInactive = false,
    runtime = {},
  } = params;

  // Dynamic system catalogs directly driven by live Firestore collections
  if (catalogId === 'school_class' || lookupCatalog === 'classes') {
    const classes = [...(runtime.classes || [])].sort((a, b) =>
      a.name.localeCompare(b.name, 'vi')
    );
    const parentClean = (parentValue ?? '').trim();
    const filtered = parentClean
      ? classes.filter((c) => String(c.grade) === parentClean)
      : classes;
    return filtered.map((c, idx) => ({
      id: c.id,
      value: c.name,
      label: `${c.name} (Khối ${c.grade})`,
      order: idx + 1,
      active: true,
      parentValue: String(c.grade),
    }));
  }

  if (catalogId === 'academic_year' || lookupCatalog === 'academicYears') {
    const names = Array.from(
      new Set(
        [
          runtime.systemSettings?.academicYear,
          ...(runtime.academicYears || []).map((y) => y.name),
        ].filter((v): v is string => Boolean(v && v.trim()))
      )
    );
    const finalNames = names.length > 0 ? names : ['2026 - 2027'];
    return finalNames.map((n, idx) => ({
      id: `yr_${idx}`,
      value: n,
      label: n,
      order: idx + 1,
      active: true,
      isDefault: idx === 0,
    }));
  }

  if (catalogId === 'school_room' || lookupCatalog === 'rooms') {
    const rooms = [...(runtime.rooms || [])].sort((a, b) =>
      (a.code || a.name).localeCompare(b.code || b.name, 'vi')
    );
    return rooms.map((r, idx) => ({
      id: r.id,
      value: r.code || r.name,
      label: r.code ? `${r.code} - ${r.name}` : r.name,
      order: idx + 1,
      active: true,
    }));
  }

  if (catalogId === 'rule_category' || lookupCatalog === 'ruleCategories') {
    const cats = (runtime.ruleCategories || []).filter((c) => c.status !== 'inactive');
    const names =
      cats.length > 0
        ? cats.sort((a, b) => a.order - b.order).map((c) => c.name)
        : ['Chuyên cần & Giờ giấc', 'Tác phong & Đồng phục', 'Học tập & Nề nếp', 'Thành tích & Đóng góp'];
    return names.map((n, idx) => ({
      id: `rc_${idx}`,
      value: n,
      label: n,
      order: idx + 1,
      active: true,
    }));
  }

  // Centralized catalog lookup
  const effectiveCatalogId =
    catalogId || (lookupCatalog === 'subjects' ? 'teacher_subject' : undefined);

  if (effectiveCatalogId) {
    const def = getCatalogById(effectiveCatalogId, runtime);
    if (def) {
      let opts = [...def.options].sort((a, b) => a.order - b.order);
      if (!includeInactive) {
        opts = opts.filter((o) => o.active !== false);
      }
      if (parentValue && def.parentCatalogId) {
        const parentTrimmed = parentValue.trim().toLowerCase();
        opts = opts.filter(
          (o) => (o.parentValue || '').trim().toLowerCase() === parentTrimmed
        );
      }
      return opts;
    }
  }

  if (staticOptions && staticOptions.length > 0) {
    return staticOptions.map((val, idx) => ({
      id: `static_${idx}`,
      value: val,
      label: val,
      order: idx + 1,
      active: true,
    }));
  }

  return [];
}

/**
 * Unambiguously normalizes incoming cell values (case / accent-insensitive exact match ONLY).
 * Ambiguous or unknown inputs are returned unchanged so validation accurately catches them.
 */
export function normalizeCatalogInputValue(
  rawValue: string,
  options: DataCatalogOption[]
): { matched: boolean; value: string } {
  const trimmed = (rawValue || '').trim();
  if (!trimmed) return { matched: false, value: '' };

  // 1. Exact value match (case-sensitive)
  const exact = options.find((o) => o.value === trimmed);
  if (exact) return { matched: true, value: exact.value };

  // 2. Case-insensitive exact value match
  const lower = trimmed.toLowerCase();
  const caseMatches = options.filter((o) => o.value.toLowerCase() === lower);
  if (caseMatches.length === 1) {
    return { matched: true, value: caseMatches[0].value };
  }

  // 3. Label match (when user inputs e.g. 'Khối 10' instead of '10')
  const labelMatches = options.filter((o) => o.label.toLowerCase() === lower);
  if (labelMatches.length === 1) {
    return { matched: true, value: labelMatches[0].value };
  }

  // 4. Diacritic-insensitive unambiguous match (e.g. 'nam' -> 'Nam', 'khoa hoc tu nhien' -> 'Khoa học tự nhiên')
  const stripped = stripVietnameseForMatch(lower).replace(/\s+/g, ' ');
  const strippedMatches = options.filter(
    (o) => stripVietnameseForMatch(o.value.toLowerCase()).replace(/\s+/g, ' ') === stripped
  );
  if (strippedMatches.length === 1) {
    return { matched: true, value: strippedMatches[0].value };
  }

  return { matched: false, value: trimmed };
}

/**
 * Validates parent-child dependency integrity (e.g., Khối 10 vs Lớp 11A1,
 * or Tổ chuyên môn vs Bộ môn).
 */
export function validateDependentFieldValue(params: {
  childFieldKey: string;
  childValue: unknown;
  parentValue: unknown;
  runtime: CatalogRuntimeData;
}): { valid: boolean; message?: string; expectedParentValue?: string } {
  const childStr = String(params.childValue ?? '').trim();
  const parentStr = String(params.parentValue ?? '').trim();
  if (!childStr || !parentStr) return { valid: true };

  if (params.childFieldKey === 'className') {
    const classes = params.runtime.classes || [];
    const matchedClass = classes.find(
      (c) => c.name.toLowerCase() === childStr.toLowerCase()
    );
    if (matchedClass && String(matchedClass.grade) !== parentStr) {
      return {
        valid: false,
        expectedParentValue: String(matchedClass.grade),
        message: `Lớp "${matchedClass.name}" thuộc Khối ${matchedClass.grade}, không khớp với Khối "${parentStr}".`,
      };
    }
  }

  if (params.childFieldKey === 'subject') {
    const subjects = resolveCatalogOptions({
      catalogId: 'teacher_subject',
      includeInactive: true,
      runtime: params.runtime,
    });
    const matched = subjects.find(
      (s) => s.value.toLowerCase() === childStr.toLowerCase()
    );
    if (
      matched?.parentValue &&
      matched.parentValue.toLowerCase() !== parentStr.toLowerCase()
    ) {
      return {
        valid: false,
        expectedParentValue: matched.parentValue,
        message: `Môn "${matched.value}" thuộc ${matched.parentValue}, không khớp với "${parentStr}".`,
      };
    }
  }

  return { valid: true };
}

/**
 * Counts how many existing domain records reference a specific catalog option value,
 * so Admins cannot permanently delete an option currently in use.
 */
export function countCatalogValueUsage(
  catalogId: string,
  value: string,
  records: {
    students?: Array<{ gender?: string; grade?: number; status?: string; conduct?: string; parentRelation?: string; ethnicity?: string; policyGroup?: string; dossierStatus?: string }>;
    teachers?: Array<{ gender?: string; subject?: string; position?: string; status?: string; department?: string; employmentType?: string }>;
    staffMembers?: Array<{ gender?: string; department?: string; position?: string; employmentType?: string; status?: string }>;
    classes?: Array<{ grade?: number }>;
    academicYears?: Array<{ currentSemester?: string }>;
    teachingAssignments?: Array<{ subject?: string; semester?: string }>;
    timetable?: Array<{ subject?: string }>;
    academicRecords?: Array<{ subjectName?: string; semester?: string }>;
    books?: Array<{ category?: string }>;
    bookCopies?: Array<{ status?: string; condition?: string }>;
    borrowTransactions?: Array<{ status?: string; conditionOnReturn?: string }>;
    rooms?: Array<{ roomType?: string; status?: string }>;
    facilities?: Array<{ category?: string; condition?: string; status?: string }>;
    maintenanceRequests?: Array<{ priority?: string }>;
    emulationRecords?: Array<{ type?: string; targetType?: string; severity?: string; status?: string }>;
    ruleCriteria?: Array<{ type?: string; targetScope?: string; severity?: string }>;
    leaveRequests?: Array<{ type?: string }>;
    feedbacks?: Array<{ category?: string; priority?: string }>;
    announcements?: Array<{ category?: string; targetAudience?: string }>;
    surveys?: Array<{ targetAudience?: string }>;
  }
): number {
  const target = value.trim().toLowerCase();
  if (!target) return 0;
  const eq = (v: unknown) => String(v ?? '').trim().toLowerCase() === target;

  switch (catalogId) {
    case 'student_gender':
      return (
        (records.students || []).filter((s) => eq(s.gender)).length +
        (records.teachers || []).filter((t) => eq(t.gender)).length +
        (records.staffMembers || []).filter((s) => eq(s.gender)).length
      );
    case 'student_grade':
      return (
        (records.students || []).filter((s) => eq(s.grade)).length +
        (records.classes || []).filter((c) => eq(c.grade)).length
      );
    case 'student_status':
      return (records.students || []).filter((s) => eq(s.status)).length;
    case 'student_conduct':
      return (records.students || []).filter((s) => eq(s.conduct)).length;
    case 'semester':
      return (
        (records.academicYears || []).filter((y) => eq(y.currentSemester)).length +
        (records.teachingAssignments || []).filter((a) => eq(a.semester)).length +
        (records.academicRecords || []).filter((r) => eq(r.semester)).length
      );
    case 'parent_relation':
      return (records.students || []).filter((s) => eq(s.parentRelation)).length;
    case 'student_ethnicity':
      return (records.students || []).filter((s) => eq(s.ethnicity)).length;
    case 'student_policy_group':
      return (records.students || []).filter((s) => eq(s.policyGroup)).length;
    case 'student_dossier_status':
      return (records.students || []).filter((s) => eq(s.dossierStatus)).length;
    case 'teacher_department':
      return (records.teachers || []).filter((t) => eq(t.department)).length;
    case 'teacher_subject':
      return (
        (records.teachers || []).filter((t) => eq(t.subject)).length +
        (records.teachingAssignments || []).filter((a) => eq(a.subject)).length +
        (records.timetable || []).filter((t) => eq(t.subject)).length +
        (records.academicRecords || []).filter((r) => eq(r.subjectName)).length
      );
    case 'staff_department':
      return (records.staffMembers || []).filter((s) => eq(s.department)).length;
    case 'staff_position':
      return (
        (records.staffMembers || []).filter((s) => eq(s.position)).length +
        (records.teachers || []).filter((t) => eq(t.position)).length
      );
    case 'employment_type':
      return (
        (records.teachers || []).filter((t) => eq(t.employmentType)).length +
        (records.staffMembers || []).filter((s) => eq(s.employmentType)).length
      );
    case 'staff_status':
      return (
        (records.teachers || []).filter((t) => eq(t.status)).length +
        (records.staffMembers || []).filter((s) => eq(s.status)).length
      );
    case 'book_category':
      return (records.books || []).filter((b) => eq(b.category)).length;
    case 'book_copy_status':
      return (records.bookCopies || []).filter((c) => eq(c.status)).length;
    case 'book_copy_condition':
      return (records.bookCopies || []).filter((c) => eq(c.condition)).length;
    case 'library_transaction_status':
      return (records.borrowTransactions || []).filter((t) => eq(t.status)).length;
    case 'book_return_condition':
      return (records.borrowTransactions || []).filter((t) => eq(t.conditionOnReturn)).length;
    case 'emulation_record_type':
      return (
        (records.emulationRecords || []).filter((e) => eq(e.type)).length +
        (records.ruleCriteria || []).filter((r) => eq(r.type)).length
      );
    case 'rule_target_scope':
      return (
        (records.emulationRecords || []).filter((e) => eq(e.targetType)).length +
        (records.ruleCriteria || []).filter((r) => eq(r.targetScope)).length
      );
    case 'rule_severity':
      return (
        (records.emulationRecords || []).filter((e) => eq(e.severity)).length +
        (records.ruleCriteria || []).filter((r) => eq(r.severity)).length
      );
    case 'emulation_workflow_status':
      return (records.emulationRecords || []).filter((e) => eq(e.status)).length;
    case 'room_type':
      return (records.rooms || []).filter((r) => eq(r.roomType)).length;
    case 'room_status':
      return (records.rooms || []).filter((r) => eq(r.status)).length;
    case 'facility_category':
      return (records.facilities || []).filter((f) => eq(f.category)).length;
    case 'facility_condition':
      return (records.facilities || []).filter((f) => eq(f.condition)).length;
    case 'facility_status':
      return (records.facilities || []).filter((f) => eq(f.status)).length;
    case 'priority_level':
      return (
        (records.maintenanceRequests || []).filter((m) => eq(m.priority)).length +
        (records.feedbacks || []).filter((f) => eq(f.priority)).length
      );
    case 'leave_request_type':
      return (records.leaveRequests || []).filter((l) => eq(l.type)).length;
    case 'feedback_category':
      return (records.feedbacks || []).filter((f) => eq(f.category)).length;
    case 'announcement_category':
      return (records.announcements || []).filter((a) => eq(a.category)).length;
    case 'announcement_audience':
      return (records.announcements || []).filter((a) => eq(a.targetAudience)).length;
    case 'survey_audience':
      return (records.surveys || []).filter((s) => eq(s.targetAudience)).length;
    default:
      return 0;
  }
}

export function buildSheetValidationColumnsForModule(
  moduleKey: ImportModuleKey,
  schemas: typeof MODULE_SCHEMAS,
  runtime: CatalogRuntimeData = {}
): GoogleSheetValidationColumnSpec[] {
  const schema = schemas[moduleKey];
  if (!schema) return [];

  const specs: GoogleSheetValidationColumnSpec[] = [];
  for (const field of schema.fields) {
    const resolved = resolveCatalogOptions({
      catalogId: field.catalogId,
      lookupCatalog: field.lookupCatalog,
      staticOptions: field.options,
      includeInactive: false,
      runtime,
    });
    const values = resolved.map((o) => o.value).filter(Boolean);
    if (values.length === 0) continue;
    specs.push({
      header: field.header,
      fieldKey: field.key,
      values,
      strict: true,
      allowBlank: !field.required,
      helpText: `Chọn giá trị chuẩn từ danh mục "${field.label}" của SchoolHub.`,
    });
  }
  return specs;
}
