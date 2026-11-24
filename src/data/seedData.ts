import { 
  UserProfile, Student, Teacher, SchoolClass, Book, 
  BorrowTransaction, Survey, FeedbackReport, CounselingRequest, 
  TimetableEntry, Announcement, AttendanceRecord, AcademicRecord, 
  FacilityAsset, MaintenanceRequest 
} from '../types';

/**
 * Clean role profiles for RBAC testing and demonstration of permissions
 * No fake student records, fake phone numbers, or dummy academic history.
 */
export const DEMO_PERSONAS: UserProfile[] = [
  {
    id: 'role_admin',
    email: 'nguyenvandung14102010@gmail.com',
    displayName: 'Quản trị viên Hệ thống',
    role: 'admin',
    phone: ''
  },
  {
    id: 'role_principal',
    email: 'bgh@schoolhub.edu.vn',
    displayName: 'Ban Giám Hiệu',
    role: 'principal',
    phone: ''
  },
  {
    id: 'role_homeroom',
    email: 'gvcn@schoolhub.edu.vn',
    displayName: 'Giáo viên Chủ nhiệm',
    role: 'homeroom_teacher',
    className: '10A1',
    grade: 10,
    phone: ''
  },
  {
    id: 'role_subject',
    email: 'gvbm@schoolhub.edu.vn',
    displayName: 'Giáo viên Bộ môn',
    role: 'subject_teacher',
    phone: ''
  },
  {
    id: 'role_librarian',
    email: 'thuthu@schoolhub.edu.vn',
    displayName: 'Cán bộ Thư viện RFID',
    role: 'librarian',
    phone: ''
  },
  {
    id: 'role_counselor',
    email: 'tuvan@schoolhub.edu.vn',
    displayName: 'Chuyên viên Tư vấn Tâm lý',
    role: 'counselor',
    phone: ''
  },
  {
    id: 'role_staff',
    email: 'csvc@schoolhub.edu.vn',
    displayName: 'Cán bộ Cơ sở vật chất',
    role: 'staff',
    phone: ''
  },
  {
    id: 'role_student',
    email: 'hocsinh@schoolhub.edu.vn',
    displayName: 'Học sinh Trường',
    role: 'student',
    className: '10A1',
    grade: 10,
    phone: ''
  }
];

// All initial datasets start EMPTY as required - no hardcoded mock/seed records
export const INITIAL_CLASSES: SchoolClass[] = [];
export const INITIAL_STUDENTS: Student[] = [];
export const INITIAL_TEACHERS: Teacher[] = [];
export const INITIAL_BOOKS: Book[] = [];
export const INITIAL_TRANSACTIONS: BorrowTransaction[] = [];
export const INITIAL_SURVEYS: Survey[] = [];
export const INITIAL_FEEDBACKS: FeedbackReport[] = [];
export const INITIAL_COUNSELING: CounselingRequest[] = [];
export const INITIAL_ANNOUNCEMENTS: Announcement[] = [];
export const INITIAL_TIMETABLE: TimetableEntry[] = [];
export const INITIAL_ATTENDANCE: AttendanceRecord[] = [];
export const INITIAL_ACADEMIC_RECORDS: AcademicRecord[] = [];
export const INITIAL_FACILITIES: FacilityAsset[] = [];
export const INITIAL_MAINTENANCE: MaintenanceRequest[] = [];
