export type UserRole =
  | 'admin'
  | 'principal'
  | 'homeroom_teacher'
  | 'subject_teacher'
  | 'librarian'
  | 'counselor'
  | 'staff'
  | 'student';

export type SuperAppId =
  | 'admin'
  | 'school'
  | 'learning'
  | 'library'
  | 'services'
  | 'communication'
  | 'facilities'
  | 'analytics'
  | 'subjects';

export type AppModuleId =
  | 'dashboard'
  | 'students'
  | 'staff'
  | 'classes'
  | 'timetable'
  | 'library'
  | 'surveys'
  | 'feedback'
  | 'counseling'
  | 'academic'
  | 'announcements'
  | 'facilities'
  | 'reports'
  | 'datacenter'
  | 'permissions'
  | 'emulation'
  | 'rules';

export type AppAction = 'view' | 'create' | 'edit' | 'delete' | 'approve' | 'export';

export type PermissionMatrix = Record<UserRole, Record<AppModuleId, AppAction[]>>;

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  preDevRole?: UserRole;
  secondaryRoles?: UserRole[];
  status?: 'active' | 'locked' | 'disabled';
  schoolId?: string;
  version?: number;
  linkedProfileId?: string;
  assignedClasses?: string[];
  assignedSubjects?: string[];
  permissionsOverride?: Partial<Record<AppModuleId, AppAction[]>>;
  avatarUrl?: string;
  rfidCardId?: string;
  studentCode?: string;
  teacherCode?: string;
  classId?: string;
  className?: string;
  grade?: number;
  phone?: string;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
}

export interface UserInvite {
  id: string;
  email: string;
  emailLower: string;
  displayName: string;
  role: UserRole;
  secondaryRoles?: UserRole[];
  status: 'active' | 'locked' | 'disabled';
  schoolId: string;
  linkedProfileId?: string;
  assignedClasses?: string[];
  assignedSubjects?: string[];
  permissionsOverride?: Partial<Record<AppModuleId, AppAction[]>>;
  rfidCardId?: string;
  studentCode?: string;
  teacherCode?: string;
  classId?: string;
  className?: string;
  grade?: number;
  phone?: string;
  claimedByUid?: string;
  claimedAt?: string;
  version?: number;
  createdBy?: string;
  createdAt: string;
  updatedBy?: string;
  updatedAt: string;
}

export interface ExternalDatasetRecord {
  id: string;
  code: string;
  name: string;
  category?: string;
  value?: string | number;
  unit?: string;
  notes?: string;
  sourceName?: string;
  schoolId?: string;
  version?: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  updatedBy?: string;
  [key: string]: unknown;
}

export interface Student {
  id: string;
  studentCode: string;
  fullName: string;
  classId: string;
  className: string;
  grade: number;
  academicYear?: string;
  rfidCardId: string;
  dateOfBirth: string;
  gender: 'Nam' | 'Nữ' | 'Khác';
  parentName?: string;
  parentRelation?: 'Bố' | 'Mẹ' | 'Người giám hộ';
  parentPhone: string;
  email?: string;
  status: 'Đang học' | 'Đã tốt nghiệp' | 'Chuyển trường' | 'Nghỉ học' | 'Tạm dừng học';
  address: string;
  gpa?: number;
  conduct?: 'Tốt' | 'Khá' | 'Trung bình' | 'Yếu';
  attendanceRate?: number;
  ethnicity?: string;
  policyGroup?: string;
  dossierStatus?: string;
  notes?: string;
  schoolId?: string;
  version?: number;
  createdBy?: string;
  updatedBy?: string;
}

export interface StudentGuardianContact {
  id: string;
  studentCode: string;
  fullName: string;
  relation: 'Bố' | 'Mẹ' | 'Người giám hộ';
  phone: string;
  email?: string;
  isPrimary?: boolean;
}

export interface ClassPlacement {
  id: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  classId: string;
  className: string;
  grade: number;
  academicYear: string;
  placementType: 'Xếp lớp đầu năm' | 'Chuyển lớp' | 'Bổ sung';
  effectiveDate: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

export interface TeachingAssignment {
  id: string;
  teacherId: string;
  teacherCode?: string;
  teacherName: string;
  classId: string;
  className: string;
  subject: string;
  academicYear: string;
  semester: 'HK1' | 'HK2' | 'Cả năm';
  role: 'Giáo viên bộ môn' | 'Giáo viên chủ nhiệm';
  createdAt: string;
}

export interface Teacher {
  id: string;
  teacherCode?: string;
  fullName: string;
  dateOfBirth?: string;
  subject: string;
  email: string;
  phone: string;
  isHomeroom: boolean;
  homeroomClassId?: string;
  homeroomClassName?: string;
  assignedClasses?: string[];
  status: 'Đang công tác' | 'Nghỉ phép';
  gender?: 'Nam' | 'Nữ' | 'Khác';
  position?: string;
  department?: string;
  employmentType?: string;
  role: UserRole;
  notes?: string;
  schoolId?: string;
  version?: number;
  createdBy?: string;
  updatedBy?: string;
}

export interface StaffMember {
  id: string;
  staffCode: string;
  fullName: string;
  dateOfBirth?: string;
  department: string;
  position: string;
  gender?: 'Nam' | 'Nữ' | 'Khác';
  employmentType?: string;
  email: string;
  phone: string;
  status: 'Đang công tác' | 'Nghỉ phép';
  notes?: string;
  schoolId?: string;
  version?: number;
  createdBy?: string;
  updatedBy?: string;
}

export interface AcademicYearConfig {
  id: string;
  name: string;
  currentSemester: 'HK1' | 'HK2';
  startDate: string;
  endDate: string;
  status: 'Đang diễn ra' | 'Sắp tới' | 'Đã kết thúc';
  schoolId?: string;
  version?: number;
}

export interface SchoolClass {
  id: string;
  code: string;
  name: string;
  grade: number;
  academicYear: string;
  homeroomTeacherId: string;
  homeroomTeacherName: string;
  room: string;
  studentCount: number;
  status?: 'active' | 'inactive';
  schoolId?: string;
  version?: number;
  createdBy?: string;
  updatedBy?: string;
}

export interface Book {
  id: string;
  bookCode?: string;
  isbn: string;
  title: string;
  author: string;
  category: string;
  publisher: string;
  publishYear: number;
  totalCopies: number;
  availableCopies: number;
  shelfLocation: string;
  coverUrl: string;
  description: string;
  status?: string;
  notes?: string;
}

export interface BookCopy {
  id: string;
  bookId: string;
  copyBarcode: string;
  rfidTag?: string;
  status: 'available' | 'borrowed' | 'reserved' | 'overdue' | 'damaged' | 'lost' | 'maintenance';
  condition: 'Tốt' | 'Khá' | 'Cần sửa' | 'Hỏng';
  currentTransactionId?: string;
  notes?: string;
  updatedAt: string;
}

export interface LibraryTransactionHistoryEntry {
  id: string;
  transactionId: string;
  transactionCode: string;
  bookTitle: string;
  borrowerName: string;
  actionType: 'borrow' | 'return' | 'renew_approved' | 'due_date_edited' | 'marked_overdue';
  oldDueDate?: string;
  newDueDate?: string;
  changedBy: string;
  changedByRole: UserRole;
  changedAt: string;
  reason: string;
}

export interface LibraryRenewalRequest {
  id: string;
  transactionId: string;
  transactionCode: string;
  bookId: string;
  bookTitle: string;
  copyBarcode: string;
  borrowerId: string;
  borrowerName: string;
  borrowerRole: UserRole;
  currentDueDate: string;
  requestedDueDate: string;
  requestedDays: number;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewedAt?: string;
  reviewNote?: string;
  createdAt: string;
}

export type LibraryBorrowerGroup = 'student' | 'teacher' | 'staff';

export interface LibraryRolePolicy {
  group: LibraryBorrowerGroup;
  label: string;
  loanDays: number;
  maxDays: number;
  maxBooks: number;
  maxRenewals: number;
  renewDays: number;
  reborrowCooldownDays: number;
  allowOverdueRenewal: boolean;
  overdueFinePerDay: number;
}

export interface LibraryPolicyConfig {
  student: LibraryRolePolicy;
  teacher: LibraryRolePolicy;
  staff: LibraryRolePolicy;
  updatedBy?: string;
  updatedAt?: string;
}

export interface BorrowTransaction {
  id: string;
  transactionCode: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  borrowerRole?: UserRole;
  bookId: string;
  bookTitle: string;
  copyId?: string;
  copyBarcode: string;
  borrowDate: string;
  dueDate: string;
  returnDate?: string;
  renewCount?: number;
  fineAmount?: number;
  conditionOnReturn?: 'Tốt' | 'Hư hỏng nhẹ' | 'Hỏng' | 'Mất';
  status: 'borrowed' | 'returned' | 'overdue' | 'lost';
  notes?: string;
  dueDateHistory?: LibraryTransactionHistoryEntry[];
}

export interface BookReservation {
  id: string;
  bookId: string;
  bookTitle: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  reservedAt: string;
  pickupDeadline: string;
  status: 'pending' | 'ready' | 'fulfilled' | 'cancelled' | 'expired';
}

export interface InventoryAudit {
  id: string;
  auditCode: string;
  date: string;
  conductedBy: string;
  totalBooks: number;
  totalCopiesExpected: number;
  scannedBarcodes: string[];
  matchedCount: number;
  missingBarcodes: string[];
  notes?: string;
  status: 'in_progress' | 'completed';
}

export interface SurveyQuestion {
  id: string;
  text: string;
  type: 'single' | 'multiple' | 'rating' | 'text';
  options?: string[];
  required: boolean;
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  targetAudience: 'Toàn trường' | 'Theo khối' | 'Theo lớp';
  targetGrade?: number;
  targetClassId?: string;
  startDate: string;
  endDate: string;
  isAnonymous: boolean;
  allowMultipleSubmissions?: boolean;
  submittedByIds?: string[];
  status: 'active' | 'closed' | 'draft';
  questions: SurveyQuestion[];
  responsesCount: number;
  createdBy: string;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  studentId: string;
  isAnonymous: boolean;
  answers: Record<string, unknown>;
  submittedAt: string;
}

export interface FeedbackReport {
  id: string;
  reportCode: string;
  title: string;
  category: 'Cơ sở vật chất' | 'Môi trường học đường' | 'Kiến nghị đào tạo' | 'Báo cáo vi phạm' | 'Khác';
  content: string;
  location: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  isAnonymous: boolean;
  studentId: string;
  studentName: string;
  studentClass: string;
  status: 'submitted' | 'acknowledged' | 'investigating' | 'in_progress' | 'resolved' | 'closed';
  assignedTo?: string;
  resolutionNote?: string;
  linkedMaintenanceId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CounselingRequest {
  id: string;
  requestCode: string;
  type: 'psychological' | 'academic' | 'career';
  studentId: string;
  studentName: string;
  studentClass: string;
  topic: string;
  preferredDate: string;
  preferredTimeSlot: string;
  notes: string;
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  counselorId?: string;
  counselorName?: string;
  meetingNotes?: string;
  createdAt: string;
}

export interface StudentLeaveRequest {
  id: string;
  requestCode: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  className: string;
  type: 'Nghỉ ốm' | 'Việc gia đình' | 'Chuyển lớp' | 'Xác nhận học sinh';
  fromDate: string;
  toDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewNote?: string;
  createdAt: string;
}

export interface SupportTicket {
  id: string;
  ticketCode: string;
  category: 'Tài khoản & Mật khẩu' | 'Thẻ RFID' | 'Phần mềm SchoolHub' | 'Thiết bị lớp học' | 'Khác';
  title: string;
  description: string;
  requesterId: string;
  requesterName: string;
  requesterRole: UserRole;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  assignedTo?: string;
  resolutionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TimetableEntry {
  id: string;
  academicYear?: string;
  semester?: string;
  grade?: number;
  classId: string;
  className: string;
  dayOfWeek: number; // 2 to 7
  period: number; // 1 to 10
  startTime?: string;
  endTime?: string;
  subject: string;
  teacherId?: string;
  teacherName: string;
  room: string;
  notes?: string;
}

export interface Assignment {
  id: string;
  title: string;
  subject: string;
  classId: string;
  className: string;
  dueDate: string;
  description: string;
  teacherName: string;
  points?: number;
  status: 'open' | 'closed';
  createdAt: string;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  className: string;
  content: string;
  submittedAt: string;
  status: 'submitted' | 'graded';
  score?: number;
  feedback?: string;
  gradedBy?: string;
}

export interface LearningMaterial {
  id: string;
  title: string;
  subject: string;
  grade: number;
  type: 'PDF' | 'Bài giảng' | 'Video' | 'Đề thi';
  urlOrNote: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  category: 'Toàn trường' | 'Học tập' | 'Đoàn - Đội' | 'Khảo thí' | 'Khẩn cấp';
  targetAudience: 'Toàn trường' | 'Khối 10' | 'Khối 11' | 'Khối 12' | 'Giáo viên';
  isPinned: boolean;
  priority: 'normal' | 'important' | 'urgent';
  status?: 'draft' | 'published' | 'recalled';
  readByIds?: string[];
  authorName: string;
  authorRole: string;
  publishedAt: string;
}

export interface SchoolEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  location: string;
  organizer: string;
  category: 'Học thuật' | 'Văn hóa' | 'Thể thao' | 'Đoàn - Đội';
  status: 'upcoming' | 'ongoing' | 'completed';
  capacity?: number;
  registeredUserIds?: string[];
  description: string;
}

export interface AttendanceRecord {
  id: string;
  date: string;
  classId: string;
  className: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  status: 'present' | 'absent_excused' | 'absent_unexcused' | 'late';
  reason?: string;
  recordedBy: string;
}

export interface GradeWeightConfig {
  regularWeight: number;
  midtermWeight: number;
  finalWeight: number;
}

export interface AcademicRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentCode: string;
  classId: string;
  className: string;
  subjectId: string;
  subjectName: string;
  semester: 'HK1' | 'HK2';
  academicYear?: string;
  scoreRegular: number[];
  scoreMidterm: number;
  scoreFinal: number;
  averageScore: number;
  status?: 'draft' | 'published';
  schoolId?: string;
  version?: number;
  createdBy?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface SchoolRoom {
  id: string;
  code: string;
  name: string;
  building: string;
  floor: string;
  capacity: number;
  roomType: 'Phòng học' | 'Phòng thí nghiệm' | 'Phòng máy' | 'Thư viện' | 'Hội trường' | 'Phòng chức năng';
  status: 'Sẵn sàng' | 'Đang sử dụng' | 'Bảo trì';
  assignedClassName?: string;
}

export interface FacilityAsset {
  id: string;
  code: string;
  name: string;
  category: 'Thiết bị trình chiếu' | 'Máy tính' | 'Bàn ghế' | 'Điều hòa - Quạt' | 'Thiết bị thí nghiệm';
  assetGroup?: string;
  assetType?: string;
  quantity?: number;
  unit?: string;
  roomLocation: string;
  receivedDate?: string;
  condition: 'Tốt' | 'Cần bảo trì' | 'Hỏng hóc';
  status: 'Đang sử dụng' | 'Đang sửa chữa' | 'Ngừng sử dụng';
  manager?: string;
  lastInspected: string;
  notes?: string;
}

export interface MaintenanceRequest {
  id: string;
  requestCode: string;
  assetId?: string;
  assetName: string;
  roomLocation: string;
  reportedBy: string;
  reporterRole: string;
  issueDescription: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'reported' | 'assigned' | 'in_repair' | 'completed';
  assignedStaff?: string;
  linkedFeedbackId?: string;
  reportedAt: string;
  completedAt?: string;
  notes?: string;
}

export interface AuditLogEntry {
  id: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  target: string;
  before?: string;
  after?: string;
  source?: string;
  status?: 'success' | 'denied' | 'error';
  timestamp: string;
}

export interface SchoolSlideshowImage {
  id: string;
  url: string;
  caption?: string;
}

export interface SchoolSlideshowConfig {
  images: SchoolSlideshowImage[];
  autoPlay: boolean;
  intervalSeconds: number;
}

export interface SystemBrandingConfig {
  appName: string;
  logoUrl?: string | null;
}

export interface SystemFooterConfig {
  visible: boolean;
  title: string;
  description: string;
  logoUrl?: string | null;
  contactEmail?: string;
  contactPhone?: string;
  contactAddress?: string;
  copyright: string;
  ownershipStatement?: string;
  facebookUrl?: string;
  instagramUrl?: string;
}

export type SystemWallpaperMode = 'aurora' | 'preset' | 'image';

export interface SystemWallpaperConfig {
  mode: SystemWallpaperMode;
  presetId?: string | null;
  imageUrl?: string | null;
  blurPx: number;
  overlayOpacity: number;
}

export interface SystemSettings {
  schoolName: string;
  academicYear: string;
  defaultLoanDays: number;
  maxBorrowLimit: number;
  compactMode: boolean;
  glassIntensity: 'standard' | 'high';
  gradeWeights?: GradeWeightConfig;
  customPermissions?: PermissionMatrix;
  libraryPolicy?: LibraryPolicyConfig;
  emulationPolicy?: EmulationPolicy;
  dataCatalogs?: DataCatalogDefinition[];
  subjectsCatalog?: string[];
  schoolSlideshow?: SchoolSlideshowConfig;
  systemBranding?: SystemBrandingConfig;
  systemFooter?: SystemFooterConfig;
  systemWallpaper?: SystemWallpaperConfig;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  appId: SuperAppId;
  tabId?: string;
  recordId?: string;
  priority: 'normal' | 'important' | 'urgent';
}

/* ================== EMULATION, RULES & COMPETITIONS TYPES ================== */
export type RuleDocumentStatus = 'draft' | 'approved' | 'archived';

export interface RuleDocument {
  id: string;
  title: string;
  academicYear: string;
  effectiveDate: string;
  fileName: string;
  fileType: 'docx' | 'pdf' | 'txt';
  fileSize?: number;
  extractedText: string;
  versionNumber: number;
  status: RuleDocumentStatus;
  notes?: string;
  uploadedBy: string;
  uploadedAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface RuleVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  title: string;
  academicYear: string;
  effectiveDate: string;
  status: RuleDocumentStatus;
  criteriaCount: number;
  notes?: string;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface RuleCategory {
  id: string;
  code: string;
  name: string;
  description?: string;
  order: number;
  status: 'active' | 'inactive';
}

export type RuleCriterionType = 'violation' | 'achievement';
export type RuleTargetScope = 'individual' | 'class' | 'group';

export interface RuleCriterionChangeEntry {
  changedAt: string;
  changedBy: string;
  summary: string;
}

export interface RuleCriterion {
  id: string;
  code: string;
  categoryId: string;
  categoryName: string;
  name: string;
  description: string;
  behavior: string;
  type: RuleCriterionType;
  points: number | null;
  pointsSpecified: boolean;
  targetScope: RuleTargetScope;
  severity?: 'Nhẹ' | 'Trung bình' | 'Nghiêm trọng';
  condition?: string;
  sourceClause?: string;
  documentId?: string;
  versionNumber?: number;
  status: 'draft' | 'active' | 'inactive';
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
  changeHistory?: RuleCriterionChangeEntry[];
  schoolId?: string;
  version?: number;
  updatedBy?: string;
}

export interface AIExtractedRuleItem {
  tempId: string;
  group: string;
  name: string;
  description: string;
  behavior: string;
  type: RuleCriterionType;
  pointsSpecified: boolean;
  points: number | null;
  target: RuleTargetScope;
  condition?: string;
  sourceClause?: string;
  confidence?: number;
  selected?: boolean;
}

export type EmulationClassFormula =
  | 'sum_students'
  | 'class_events_only'
  | 'average_students'
  | 'combined_formula';

export type EmulationCycleType = 'week' | 'month' | 'semester' | 'year';

export interface EmulationTitleConfig {
  id: string;
  name: string;
  targetScope: 'student' | 'class';
  minScore: number;
  maxViolations?: number;
  minAchievements?: number;
  badgeColor: string;
  description: string;
}

export interface EmulationPolicy {
  startingScore: number;
  minScore: number;
  maxScore: number;
  cycleType: EmulationCycleType;
  requireApprovalForRecord: boolean;
  includeVerifiedBeforeApproval: boolean;
  allowStudentAppealDays: number;
  rankingEligibilityMinRecords: number;
  classFormula: EmulationClassFormula;
  studentWeight: number;
  classEventWeight: number;
  updatedBy?: string;
  updatedAt?: string;
}

export type EmulationRecordWorkflowStatus =
  | 'draft'
  | 'pending_verification'
  | 'verified'
  | 'pending_approval'
  | 'recorded'
  | 'insufficient_evidence'
  | 'cancelled';

export interface EmulationRecord {
  id: string;
  recordCode: string;
  targetType: RuleTargetScope;
  studentId?: string;
  studentCode?: string;
  studentName?: string;
  classId?: string;
  className?: string;
  grade?: number;
  groupName?: string;
  criterionId: string;
  criterionName: string;
  categoryName: string;
  type: RuleCriterionType;
  severity?: 'Nhẹ' | 'Trung bình' | 'Nghiêm trọng';
  pointsApplied: number; // positive for achievement, negative for violation
  pointsOverridden?: boolean;
  overrideReason?: string;
  occurredAt: string; // YYYY-MM-DD
  location?: string;
  description: string;
  isSensitive?: boolean;
  evidenceNote?: string;
  evidenceAttachmentName?: string;
  reporterId: string;
  reporterName: string;
  reporterRole: UserRole;
  status: EmulationRecordWorkflowStatus;
  verifiedBy?: string;
  verifiedAt?: string;
  approvedBy?: string;
  approvedAt?: string;
  periodId?: string;
  sourceCompetitionId?: string;
  sourceTransferId?: string;
  createdAt: string;
  updatedAt?: string;
  schoolId?: string;
  version?: number;
  createdBy?: string;
  updatedBy?: string;
}

export type EmulationAppealStatus =
  | 'submitted'
  | 'reviewing'
  | 'need_info'
  | 'accepted'
  | 'rejected';

export interface EmulationAppealHistoryEntry {
  timestamp: string;
  actorName: string;
  actorRole: UserRole;
  status: EmulationAppealStatus;
  note: string;
}

export interface EmulationAppeal {
  id: string;
  recordId: string;
  recordCode: string;
  studentId: string;
  studentName: string;
  className: string;
  reason: string;
  evidenceNote?: string;
  status: EmulationAppealStatus;
  reviewedBy?: string;
  resolutionNote?: string;
  adjustedPoints?: number;
  history: EmulationAppealHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface EmulationPeriod {
  id: string;
  name: string;
  academicYear: string;
  cycleType: EmulationCycleType;
  startDate: string;
  endDate: string;
  status: 'open' | 'closed' | 'locked';
  closedBy?: string;
  closedAt?: string;
  notes?: string;
}

export interface EmulationSnapshotEntry {
  targetType: 'student' | 'class';
  targetId: string;
  targetName: string;
  className?: string;
  grade?: number;
  rank: number;
  totalScore: number;
  achievementPoints: number;
  violationPoints: number;
  transferPoints: number;
  recordCount: number;
  titleAwarded?: string;
}

export interface EmulationSnapshot {
  id: string;
  periodId: string;
  periodName: string;
  academicYear: string;
  createdAt: string;
  createdBy: string;
  entries: EmulationSnapshotEntry[];
}

export type CompetitionTransferMode =
  | 'standalone'
  | 'transfer_on_close'
  | 'direct_sync'
  | 'ratio_transfer';

export type CompetitionStatus = 'upcoming' | 'ongoing' | 'closed' | 'archived';

export interface Competition {
  id: string;
  code: string;
  name: string;
  description: string;
  category: 'Học tập' | 'Nề nếp' | 'Văn thể mỹ' | 'Kỹ năng' | 'Sáng tạo' | 'Tình nguyện';
  academicYear: string;
  startDate: string;
  endDate: string;
  participantScope: 'student' | 'class' | 'group' | 'mixed';
  transferMode: CompetitionTransferMode;
  ratioDivisor?: number; // e.g., 10 competition points = 1 emulation point, or ratioPercent
  maxTransferPoints?: number;
  targetCriterionId?: string;
  status: CompetitionStatus;
  manualStatusLocked?: boolean;
  organizerName: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CompetitionCriterion {
  id: string;
  competitionId: string;
  name: string;
  description: string;
  maxPoints: number;
  weight: number;
  order: number;
}

export interface CompetitionParticipant {
  id: string;
  competitionId: string;
  targetType: 'student' | 'class' | 'group';
  targetId: string;
  targetName: string;
  className?: string;
  grade?: number;
  registeredAt: string;
  status: 'active' | 'withdrawn';
}

export interface CompetitionScore {
  id: string;
  competitionId: string;
  participantId: string;
  criterionId: string;
  criterionName: string;
  score: number;
  note?: string;
  scoredBy: string;
  scoredAt: string;
}

export interface CompetitionAward {
  id: string;
  competitionId: string;
  participantId: string;
  targetName: string;
  targetType: 'student' | 'class' | 'group';
  className?: string;
  awardTitle: string; // e.g., Giải Nhất, Giải Nhì
  rank: number;
  totalPoints: number;
  awardedBy: string;
  awardedAt: string;
}

export interface ScoreTransferRecord {
  id: string;
  sourceId: string; // `${competitionId}__${participantId}`
  competitionId: string;
  competitionName: string;
  participantId: string;
  targetType: 'student' | 'class' | 'group';
  targetId: string;
  targetName: string;
  className?: string;
  emulationRecordId: string;
  rawCompetitionPoints: number;
  pointsTransferred: number;
  transferMode: CompetitionTransferMode;
  syncStatus: 'synced' | 'reverted';
  syncedAt: string;
  approvedBy: string;
  revertedAt?: string;
  revertedBy?: string;
  revertReason?: string;
}

/* ================== UNIFIED IMPORT / EXPORT ENGINE TYPES ================== */
export type ImportModuleKey =
  | 'users'
  | 'role_assignments'
  | 'students'
  | 'teachers'
  | 'staff'
  | 'classes'
  | 'academic_years'
  | 'class_placements'
  | 'teaching_assignments'
  | 'timetable'
  | 'grades'
  | 'attendance'
  | 'assignments'
  | 'materials'
  | 'books'
  | 'book_copies'
  | 'inventory_audits'
  | 'borrow_migration'
  | 'survey_questions'
  | 'leave_migration'
  | 'feedback_migration'
  | 'announcements'
  | 'events'
  | 'rooms'
  | 'facilities'
  | 'maintenance_plans'
  | 'external_datasets'
  | 'rule_criteria'
  | 'emulation_records';

export type SchemaFieldType =
  | 'string'
  | 'number'
  | 'integer'
  | 'date'
  | 'email'
  | 'phone'
  | 'boolean'
  | 'enum'
  | 'textarea';

export type CatalogKey =
  | 'classes'
  | 'academicYears'
  | 'rooms'
  | 'teachers'
  | 'students'
  | 'books'
  | 'subjects'
  | 'roles'
  | 'surveys'
  | 'ruleCategories';

export interface SchemaFieldDef {
  key: string;
  header: string;
  label: string;
  group: string;
  type: SchemaFieldType;
  required?: boolean;
  uniqueKey?: boolean;
  lookupCatalog?: CatalogKey;
  catalogId?: string;
  parentFieldKey?: string;
  options?: string[];
  min?: number;
  max?: number;
  pattern?: string;
  patternMessage?: string;
  width?: number;
  description: string;
  formatHint: string;
  exampleFormat: string;
  defaultValue?: string | number | boolean;
  sensitive?: boolean;
  readOnlyOnEdit?: boolean;
  aliases?: string[];
}

export interface ExtraSheetDef {
  sheetName: string;
  title: string;
  description: string;
  fields: SchemaFieldDef[];
}

export interface ImportModuleSchema {
  key: ImportModuleKey;
  appId: SuperAppId;
  title: string;
  subtitle: string;
  permissionModule: AppModuleId;
  templateFileName: string;
  version: string;
  primaryKeyHeader: string;
  allowUpdate: boolean;
  migrationOnly?: boolean;
  migrationWarning?: string;
  blockedMessage?: string;
  groups: string[];
  fields: SchemaFieldDef[];
  extraSheets?: ExtraSheetDef[];
}

export type ImportMode = 'only_add' | 'update_existing';
export type ErrorPolicy = 'only_valid' | 'abort_on_error';

export interface FieldDiff {
  field: string;
  label: string;
  before: string;
  after: string;
}

export interface ValidationIssue {
  rowNumber: number; // 1-based data row (Excel row index starting at 2)
  sheetName: string;
  field: string;
  header: string;
  value: string;
  message: string;
  severity: 'error' | 'warning';
}

export type RowImportStatus = 'valid_create' | 'valid_update' | 'invalid' | 'duplicate' | 'skipped';

export interface ValidatedImportRow {
  rowNumber: number;
  sheetName?: string;
  rawData: Record<string, unknown>;
  normalizedData: Record<string, unknown>;
  status: RowImportStatus;
  existingId?: string;
  diffs?: FieldDiff[];
  issues: ValidationIssue[];
}

export interface ImportPreviewReport {
  schemaKey: ImportModuleKey;
  fileName: string;
  templateVersionFound?: string;
  tabNames?: string[];
  headersFound: string[];
  missingRequiredHeaders: string[];
  unrecognizedHeaders: string[];
  headerErrors: string[];
  totalRows: number;
  validCreateCount: number;
  validUpdateCount: number;
  invalidCount: number;
  duplicateCount: number;
  warningCount: number;
  rows: ValidatedImportRow[];
  extraSheetRows?: Record<string, Record<string, unknown>[]>;
}

export interface ImportExecutionResult {
  schemaKey: ImportModuleKey;
  fileName: string;
  mode: ImportMode;
  errorPolicy: ErrorPolicy;
  totalRows: number;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
  skippedCount: number;
  issues: ValidationIssue[];
  completedAt: string;
  aborted: boolean;
}

export interface ImportHistoryRecord {
  id: string;
  moduleKey: ImportModuleKey;
  moduleTitle: string;
  appId: SuperAppId;
  fileName: string;
  mode: ImportMode;
  errorPolicy: ErrorPolicy;
  totalRows: number;
  successCount: number;
  createdCount: number;
  updatedCount: number;
  failedCount: number;
  skippedCount: number;
  actorName: string;
  actorRole: UserRole;
  status: 'completed' | 'partial' | 'aborted';
  timestamp: string;
  summaryNote?: string;
}

export interface ExportHistoryRecord {
  id: string;
  moduleKey: ImportModuleKey;
  moduleTitle: string;
  appId: SuperAppId;
  format: 'xlsx' | 'docx' | 'csv';
  scope: 'all' | 'filtered' | 'selected';
  rowCount: number;
  columnCount: number;
  fileName: string;
  actorName: string;
  actorRole: UserRole;
  timestamp: string;
}

export interface ExportRequestOptions {
  format: 'xlsx' | 'csv';
  scope: 'all' | 'filtered' | 'selected';
  selectedFieldKeys: string[];
  templateCompatible: boolean;
  fileName?: string;
}

/* ================== CENTRALIZED DATA CATALOGS & VALIDATION ================== */
export type CatalogGroupKey =
  | 'students'
  | 'teachers_staff'
  | 'library'
  | 'emulation'
  | 'facilities'
  | 'communication_services';

export interface DataCatalogOption {
  id: string;
  value: string;
  label: string;
  order: number;
  isDefault?: boolean;
  active: boolean;
  parentValue?: string;
  description?: string;
}

export interface DataCatalogDefinition {
  id: string;
  code: string;
  name: string;
  group: CatalogGroupKey;
  description: string;
  required: boolean;
  allowEmpty?: boolean;
  isReportCritical?: boolean;
  parentCatalogId?: string;
  isSystemDynamic?: boolean;
  options: DataCatalogOption[];
  updatedAt: string;
  updatedBy?: string;
}

export interface SheetValidationColumnSpec {
  header: string;
  fieldKey: string;
  values: string[];
  strict?: boolean;
  allowBlank?: boolean;
  helpText?: string;
}

export type SyncConnectionState =
  | 'connecting'
  | 'synced'
  | 'syncing'
  | 'offline'
  | 'error'
  | 'conflict';

export interface SyncConflictFieldEntry {
  field: string;
  localValue: unknown;
  serverValue: unknown;
  baseValue: unknown;
}

export interface SyncConflictPrompt {
  id: string;
  collectionName: string;
  collectionLabel: string;
  docId: string;
  recordLabel: string;
  expectedVersion: number;
  serverVersion: number;
  localRecord: Record<string, unknown>;
  serverRecord: Record<string, unknown>;
  conflictingFields: SyncConflictFieldEntry[];
  mergedPreview: Record<string, unknown>;
  detectedAt: string;
}

export interface LegacyCollectionMigrationStats {
  collectionName: string;
  localStorageKey: string;
  localCount: number;
  newCount: number;
  duplicateCount: number;
  itemsToUpload: Record<string, unknown>[];
}

export interface LegacyMigrationSummary {
  totalLocalRecords: number;
  totalNewRecords: number;
  totalDuplicateRecords: number;
  legacyKeysFound: string[];
  collections: LegacyCollectionMigrationStats[];
}

/* ================== UNIFIED DATA SOURCES (EXCEL ONLY) ================== */
export type DataSourceGroupKey =
  | 'students'
  | 'staff'
  | 'learning'
  | 'books'
  | 'facilities';

export type DataSourceMethod = 'excel';

export type DataSourceSyncMode = 'manual';

export type DataSourceStatus =
  | 'unconfigured'
  | 'connected'
  | 'syncing'
  | 'synced'
  | 'error';

export interface DataSourceConfig {
  id: string;
  groupKey: DataSourceGroupKey;
  activeMethod: DataSourceMethod;
  sourceName: string;
  sheetTabs?: string[];
  columnStructure?: Record<string, string[]>;
  syncMode: DataSourceSyncMode;
  syncIntervalMinutes: number;
  status: DataSourceStatus;
  lastSyncAt?: string;
  lastSyncMessage?: string;
  lastError?: string;
  lastRowCount?: number;
  lastCreatedCount?: number;
  lastUpdatedCount?: number;
  configuredBy?: string;
  configuredAt?: string;
  updatedAt?: string;
  schoolId?: string;
  version?: number;
}

export interface AfternoonScheduleEntry {
  id: string;
  academicYear?: string;
  date?: string;
  dayOfWeek: number; // 2 to 7
  grade?: number;
  className?: string;
  startTime: string;
  endTime: string;
  activity: string;
  location: string;
  coordinator: string;
  notes?: string;
  schoolId?: string;
  version?: number;
}

