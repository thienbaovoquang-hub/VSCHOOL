import type {
  AcademicRecord,
  Announcement,
  Book,
  BorrowTransaction,
  ExternalDatasetRecord,
  FacilityAsset,
  FeedbackReport,
  MaintenanceRequest,
  SchoolClass,
  Student,
  Teacher,
  UserProfile,
  UserRole,
} from '../types';
import {
  buildRoleScopedAISummary,
  filterAcademicRecordsByScope,
  filterFeedbacksByScope,
  filterStudentsByScope,
} from './rbac';

export interface AiAssistantChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  time: string;
  isError?: boolean;
}

export interface AiAssistantMetricsSummary {
  studentsCount: number;
  teachersCount: number;
  classesCount: number;
  booksCount: number;
  totalTransactions: number;
  activeLoans: number;
  overdueLoans: number;
  announcementsCount: number;
  feedbackCount: number;
  resolvedFeedback: number;
  facilitiesCount: number;
  openMaintenance: number;
  externalBenchmarksCount: number;
  ownGradesCount: number;
  ownAvgScore: number | null;
  roleSummaryText: string;
}

export interface BuildAiContextInput {
  currentUser: UserProfile;
  students: Student[];
  teachers: Teacher[];
  classes: SchoolClass[];
  books: Book[];
  borrowTransactions: BorrowTransaction[];
  academicRecords: AcademicRecord[];
  feedbacks: FeedbackReport[];
  announcements: Announcement[];
  facilities: FacilityAsset[];
  maintenance: MaintenanceRequest[];
  externalDatasets?: ExternalDatasetRecord[];
}

export function buildAiAssistantContextSummary(
  input: BuildAiContextInput
): AiAssistantMetricsSummary {
  const {
    currentUser,
    students,
    teachers,
    classes,
    books,
    borrowTransactions,
    academicRecords,
    feedbacks,
    announcements,
    facilities,
    maintenance,
    externalDatasets = [],
  } = input;

  const isPureStudent =
    currentUser.role === 'student' &&
    (!currentUser.secondaryRoles || currentUser.secondaryRoles.length === 0);

  const scopedStudents = filterStudentsByScope(students, currentUser, teachers);
  const scopedAcademic = filterAcademicRecordsByScope(academicRecords, currentUser);
  const scopedFeedbacks = filterFeedbacksByScope(feedbacks, currentUser);

  const relevantBorrows = isPureStudent
    ? borrowTransactions.filter(
        (t) =>
          t.studentId === currentUser.id ||
          (currentUser.linkedProfileId && t.studentId === currentUser.linkedProfileId) ||
          (currentUser.studentCode && t.studentCode === currentUser.studentCode)
      )
    : borrowTransactions;

  const activeLoans = relevantBorrows.filter(
    (t) => t.status !== 'returned' && t.status !== 'lost'
  ).length;
  const overdueLoans = relevantBorrows.filter((t) => t.status === 'overdue').length;
  const openMaintenance = isPureStudent
    ? 0
    : maintenance.filter((m) => m.status !== 'completed').length;
  const resolvedFeedback = scopedFeedbacks.filter(
    (f) => f.status === 'resolved' || f.status === 'closed'
  ).length;

  const ownAvgScore =
    scopedAcademic.length > 0
      ? Number(
          (
            scopedAcademic.reduce((acc, r) => acc + r.averageScore, 0) /
            scopedAcademic.length
          ).toFixed(2)
        )
      : null;

  const roleSummaryText = buildRoleScopedAISummary({
    currentUser,
    studentsCount: scopedStudents.length,
    teachersCount: isPureStudent ? 0 : teachers.length,
    classesCount: isPureStudent ? 1 : classes.length,
    booksCount: books.length,
    activeBorrowsCount: activeLoans,
    overdueBorrowsCount: overdueLoans,
    openFeedbacksCount: scopedFeedbacks.length - resolvedFeedback,
    openMaintenanceCount: openMaintenance,
    ownGradesCount: scopedAcademic.length,
    ownAvgScore,
  });

  const externalBenchmarksSummary =
    !isPureStudent && externalDatasets.length > 0
      ? ` | Tham chiếu ngoài (${externalDatasets.length} chỉ tiêu): ${externalDatasets
          .slice(0, 4)
          .map((d) => `${d.name}: ${d.value}${d.unit ? ` ${d.unit}` : ''}`)
          .join('; ')}`
      : '';

  return {
    studentsCount: scopedStudents.length,
    teachersCount: isPureStudent ? 0 : teachers.length,
    classesCount: isPureStudent ? 1 : classes.length,
    booksCount: books.length,
    totalTransactions: relevantBorrows.length,
    activeLoans,
    overdueLoans,
    announcementsCount: announcements.filter(
      (a) => (a.status || 'published') === 'published'
    ).length,
    feedbackCount: scopedFeedbacks.length,
    resolvedFeedback,
    facilitiesCount: isPureStudent ? 0 : facilities.length,
    openMaintenance,
    externalBenchmarksCount: isPureStudent ? 0 : externalDatasets.length,
    ownGradesCount: scopedAcademic.length,
    ownAvgScore,
    roleSummaryText: `${roleSummaryText}${externalBenchmarksSummary}`,
  };
}

export type PromptCategoryId = 'all' | 'learning' | 'library' | 'services' | 'management';

export interface AssistantPromptTemplate {
  id: string;
  category: Exclude<PromptCategoryId, 'all'>;
  categoryLabel: string;
  title: string;
  description: string;
  prompt: string;
  managementOnly?: boolean;
}

const ALL_PROMPT_TEMPLATES: AssistantPromptTemplate[] = [
  {
    id: 'learn-math-plan',
    category: 'learning',
    categoryLabel: 'Học tập & Ôn thi',
    title: 'Lập kế hoạch ôn thi Toán 7 ngày',
    description: 'Chia nhỏ chuyên đề trọng tâm và bài tập tự luyện theo ngày.',
    prompt:
      'Hãy lập kế hoạch ôn tập môn Toán trong 7 ngày tới theo từng bước cụ thể, cân bằng giữa lý thuyết và luyện đề.',
  },
  {
    id: 'learn-english-vocab',
    category: 'learning',
    categoryLabel: 'Học tập & Ôn thi',
    title: 'Phương pháp học từ vựng Tiếng Anh nhớ lâu',
    description: 'Áp dụng lặp lại ngắt quãng và đặt câu theo ngữ cảnh THPT.',
    prompt:
      'Hướng dẫn quy trình học 15 từ vựng Tiếng Anh THPT mỗi ngày bằng phương pháp lặp lại ngắt quãng và đặt câu thực tế.',
  },
  {
    id: 'learn-literature-outline',
    category: 'learning',
    categoryLabel: 'Học tập & Ôn thi',
    title: 'Dàn ý nghị luận văn học chuẩn cấu trúc',
    description: 'Gợi ý khung mở bài, luận điểm thân bài và kết bài mạch lạc.',
    prompt:
      'Cho mình xin khung dàn ý từng bước cho bài nghị luận văn học THPT giúp đạt điểm mạch lạc và dẫn chứng thuyết phục.',
  },
  {
    id: 'lib-rfid-flow',
    category: 'library',
    categoryLabel: 'Thư viện RFID',
    title: 'Quy trình mượn – trả sách RFID',
    description: 'Các bước quét thẻ học sinh, quét mã sách và gia hạn hạn trả.',
    prompt:
      'Hướng dẫn chi tiết từng bước quy trình mượn, trả và gia hạn sách bằng thẻ RFID tại Thư viện trường.',
  },
  {
    id: 'lib-book-suggest',
    category: 'library',
    categoryLabel: 'Thư viện RFID',
    title: 'Gợi ý đầu sách tham khảo & kỹ năng',
    description: 'Đề xuất sách bồi dưỡng kiến thức và phương pháp tự học.',
    prompt:
      'Dựa trên kho sách thư viện hiện có, hãy gợi ý các nhóm sách nên đọc để rèn kỹ năng tự học và ôn thi học sinh giỏi.',
  },
  {
    id: 'srv-feedback',
    category: 'services',
    categoryLabel: 'Dịch vụ & Nội quy',
    title: 'Cách gửi phản ánh & yêu cầu hỗ trợ',
    description: 'Hướng dẫn gửi góp ý ẩn danh hoặc báo hỏng thiết bị lớp học.',
    prompt:
      'Hướng dẫn từng bước cách gửi phản ánh ẩn danh hoặc phiếu hỗ trợ học đường trên hệ thống.',
  },
  {
    id: 'srv-leave',
    category: 'services',
    categoryLabel: 'Dịch vụ & Nội quy',
    title: 'Quy trình xin phép nghỉ học trực tuyến',
    description: 'Các thông tin cần điền để GVCN duyệt đơn nhanh chóng.',
    prompt:
      'Trình bày các bước tạo đơn xin nghỉ phép trực tuyến và những lưu ý để giáo viên chủ nhiệm phê duyệt nhanh.',
  },
  {
    id: 'mgmt-class-emulation',
    category: 'management',
    categoryLabel: 'Điều hành & Lớp học',
    title: 'Đề xuất cải thiện thi đua & chuyên cần',
    description: 'Dựa trên số liệu trong phạm vi vai trò để đề xuất 3 việc ưu tiên.',
    prompt:
      'Dựa trên số liệu thực tế trong phạm vi vai trò của tôi, hãy phân tích nhanh và đề xuất 3 hành động ưu tiên tuần tới về học tập và nền nếp.',
    managementOnly: true,
  },
  {
    id: 'mgmt-library-overdue',
    category: 'management',
    categoryLabel: 'Điều hành & Lớp học',
    title: 'Kế hoạch nhắc trả sách quá hạn thư viện',
    description: 'Quy trình rà soát phiếu quá hạn và phối hợp GVCN nhắc nhở.',
    prompt:
      'Đề xuất quy trình phối hợp giữa thư viện và giáo viên chủ nhiệm để xử lý các phiếu mượn sách quá hạn hiệu quả.',
    managementOnly: true,
  },
  {
    id: 'mgmt-facility-priority',
    category: 'management',
    categoryLabel: 'Điều hành & Lớp học',
    title: 'Ưu tiên xử lý phiếu bảo trì cơ sở vật chất',
    description: 'Phân loại mức độ khẩn cấp và kiểm soát an toàn phòng học.',
    prompt:
      'Dựa trên số liệu bảo trì và phản ánh hiện tại, hãy gợi ý tiêu chí phân loại ưu tiên xử lý sự cố cơ sở vật chất trong tuần.',
    managementOnly: true,
  },
];

export function getAssistantPromptCatalog(role: UserRole): AssistantPromptTemplate[] {
  if (role === 'student') {
    return ALL_PROMPT_TEMPLATES.filter((item) => !item.managementOnly);
  }
  return ALL_PROMPT_TEMPLATES;
}

export function getAssistantQuickChips(role: UserRole): string[] {
  if (role === 'student') {
    return [
      'Quy trình mượn sách RFID?',
      'Mẹo ôn thi Toán hiệu quả',
      'Cách gửi phản ánh ẩn danh',
      'Cách tạo đơn xin nghỉ phép',
    ];
  }
  return [
    'Đề xuất 3 việc ưu tiên tuần tới',
    'Quy trình mượn sách RFID?',
    'Xử lý phiếu mượn quá hạn',
    'Cách tạo lịch dạy & điểm danh',
  ];
}

export function createWelcomeAssistantMessage(user: UserProfile): AiAssistantChatMessage {
  const isStudent =
    user.role === 'student' && (!user.secondaryRoles || user.secondaryRoles.length === 0);
  const scopeNote = isStudent
    ? 'học tập các môn, lịch học, thư viện RFID và dịch vụ học sinh'
    : 'điều hành lớp học, thư viện RFID, cơ sở vật chất và hướng dẫn nghiệp vụ trường học';

  return {
    id: 'welcome',
    sender: 'assistant',
    text: `Xin chào ${user.displayName}! Tôi là Trợ lý AI độc lập của trường — sẵn sàng hỗ trợ theo đúng phạm vi vai trò về ${scopeNote}. Hãy đặt câu hỏi hoặc chọn nhanh một gợi ý bên dưới.`,
    time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  };
}
