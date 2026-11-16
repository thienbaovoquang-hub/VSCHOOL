import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ShieldAlert, X, RefreshCw, LogOut } from 'lucide-react';
import {
  AcademicRecord,
  AcademicYearConfig,
  Announcement,
  Assignment,
  AssignmentSubmission,
  AttendanceRecord,
  AuditLogEntry,
  Book,
  BookCopy,
  BookReservation,
  BorrowTransaction,
  ClassPlacement,
  Competition,
  CompetitionAward,
  CompetitionCriterion,
  CompetitionParticipant,
  CompetitionScore,
  CounselingRequest,
  EmulationAppeal,
  EmulationPeriod,
  EmulationRecord,
  EmulationSnapshot,
  EmulationTitleConfig,
  ExportHistoryRecord,
  ExternalDatasetRecord,
  FacilityAsset,
  FeedbackReport,
  ImportHistoryRecord,
  ImportModuleKey,
  InventoryAudit,
  LearningMaterial,
  LegacyMigrationSummary,
  LibraryRenewalRequest,
  LibraryTransactionHistoryEntry,
  MaintenanceRequest,
  NotificationItem,
  RuleCategory,
  RuleCriterion,
  RuleDocument,
  RuleVersion,
  SchoolClass,
  SchoolEvent,
  SchoolRoom,
  ScoreTransferRecord,
  StaffMember,
  Student,
  StudentLeaveRequest,
  SuperAppId,
  SupportTicket,
  Survey,
  SurveyResponse,
  SyncConflictPrompt,
  SyncConnectionState,
  SystemSettings,
  Teacher,
  TeachingAssignment,
  TimetableEntry,
  UserInvite,
  UserProfile,
  UserRole,
} from './types';
import { APP_REGISTRY, SUPER_APP_ORDER } from './data/appRegistry';
import { DEFAULT_SCHOOL_ID, dedupById, mergeRecordsById } from './utils/syncEngine';
import {
  appendAuditLog,
  appendExportHistory,
  appendImportHistory,
  applyConflictResolution,
  AuthRequiredError,
  clearAllCloudSystemData,
  DEFAULT_SYSTEM_SETTINGS,
  deleteAssignment,
  deleteBook,
  deleteClass,
  deleteCompetitionCriterion,
  deleteEmulationTitleConfig,
  deleteFacility,
  deleteLearningMaterial,
  deleteRoom,
  deleteRuleCriterion,
  deleteStaffMember,
  deleteStudent,
  deleteTeacher,
  deleteTimetableEntry,
  deleteUserAccount,
  deleteUserInvite,
  importFullBackupJson,
  migrateLegacyLocalStorageToCloud,
  OfflineSyncError,
  purgeAllLegacyLocalStorageKeys,
  recordBorrowBook,
  recordRenewBook,
  recordReturnBook,
  resolveOrProvisionAuthenticatedUser,
  saveAcademicRecord,
  saveAcademicYear,
  saveAnnouncement,
  saveAssignment,
  saveAssignmentSubmission,
  saveAttendanceRecords,
  saveBook,
  saveBookCopy,
  saveBookReservation,
  saveClass,
  saveCompetition,
  saveCompetitionAward,
  saveCompetitionCriterion,
  saveCompetitionParticipant,
  saveCompetitionScore,
  saveEmulationAppeal,
  saveEmulationPeriod,
  saveEmulationRecord,
  saveEmulationSnapshot,
  saveEmulationTitleConfig,
  saveExternalDatasetsBatch,
  saveFacility,
  saveInventoryAudit,
  saveLearningMaterial,
  saveLeaveRequest,
  saveLibraryRenewalRequest,
  saveRoom,
  saveRuleCategory,
  saveRuleCriterion,
  saveRuleDocument,
  saveRuleVersion,
  saveSchoolEvent,
  saveScoreTransferRecord,
  saveStaffMember,
  saveStudent,
  saveSupportTicket,
  saveSurvey,
  saveSystemSettings,
  saveTeacher,
  saveTimetableEntry,
  saveUserAccount,
  saveUserInviteFromProfile,
  scanLegacyLocalStorage,
  setActiveSchoolContext,
  submitCounselingRequest,
  submitFeedbackReport,
  submitMaintenanceRequest,
  submitSurveyResponse,
  subscribeSchoolCollections,
  SyncConflictError,
  updateBorrowDueDateWithHistory,
  updateCounselingStatus,
  updateFeedbackStatus,
  upsertBatchWithSync,
} from './firebase/services';
import { testConnection } from './firebase/connectionTest';
import { auth } from './firebase/config';
import { onAuthStateChanged, signOut, type User as FirebaseUser } from 'firebase/auth';
import { disconnectGoogleWorkspace } from './services/googleAuth';
import { canAccessSuperApp, DEFAULT_PERMISSIONS, getAllowedTabsForApp, ROLE_DEFINITIONS } from './utils/rbac';
import {
  type AuthPhase,
  AUTH_PHASE_LABELS,
  classifyAuthFailure,
  hasAccountIdentityChanged,
  isAuthLoadingPhase,
} from './utils/authSession';
import { checkIsOverdue, generateBookCopiesForBook, getEffectiveLibraryPolicy } from './utils/libraryRules';
import { resolveAppTabAlias } from './utils/streamlinedHelpers';
import {
  createMaintenanceFromFeedback,
  isUserActive,
  syncAssetAfterMaintenance,
} from './utils/crossAppSync';
import type { ValidationDbContext } from './utils/importExport/validator';
import { useWindowManager } from './hooks/useWindowManager';

import { LoginScreen } from './components/auth/LoginScreen';
import {
  LegacyMigrationModal,
  OfflineSyncBanner,
  SyncConflictModal,
} from './components/sync/SyncStatusAndConflictModal';
import { DesktopScreen } from './components/desktop/DesktopScreen';
import { WindowManager } from './components/desktop/WindowManager';
import { Taskbar } from './components/desktop/Taskbar';
import { StartMenu } from './components/desktop/StartMenu';
import { TaskViewModal } from './components/desktop/TaskViewModal';
import { NotificationCenter } from './components/desktop/NotificationCenter';
import { QuickSettingsPopover } from './components/desktop/QuickSettingsPopover';
import { DesktopContextMenu, ContextMenuState } from './components/desktop/DesktopContextMenu';
import { GlobalSearchModal } from './components/search/GlobalSearchModal';

import { AdministrationApp } from './components/apps/AdministrationApp';
import { SchoolManagementApp } from './components/apps/SchoolManagementApp';
import { LearningApp } from './components/apps/LearningApp';
import { LibraryApp } from './components/apps/LibraryApp';
import { StudentServicesApp } from './components/apps/StudentServicesApp';
import { CommunicationApp } from './components/apps/CommunicationApp';
import { FacilitiesApp } from './components/apps/FacilitiesApp';
import { AnalyticsAIApp } from './components/apps/AnalyticsAIApp';

const DEFAULT_PINNED_APPS: SuperAppId[] = ['school', 'learning', 'library', 'communication'];

interface AppErrorBoundaryProps {
  userEmail?: string | null;
  onSignOut: () => Promise<void> | void;
  children: React.ReactNode;
}

interface AppErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

class AppErrorBoundary extends React.Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  constructor(props: AppErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Đã xảy ra lỗi hiển thị không mong muốn.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('SchoolHub Desktop ErrorBoundary:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          data-testid="app-error-boundary"
          className="h-[100dvh] w-screen flex items-center justify-center p-6 bg-gradient-to-br from-sky-50 via-indigo-50 to-teal-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 text-slate-800 dark:text-slate-100"
        >
          <div className="max-w-md w-full rounded-3xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-rose-200/70 dark:border-rose-800/60 shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold">Không thể hiển thị giao diện Desktop</h2>
                {this.props.userEmail && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    Tài khoản: {this.props.userEmail}
                  </p>
                )}
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-slate-800/70 rounded-xl p-3 border border-slate-200/60 dark:border-slate-700/60">
              {this.state.errorMessage}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => this.setState({ hasError: false, errorMessage: '' })}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Thử tải lại giao diện</span>
              </button>
              <button
                type="button"
                onClick={() => void this.props.onSignOut()}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Đăng xuất &amp; đổi tài khoản</span>
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const workspaceRef = useRef<HTMLDivElement | null>(null);
  const {
    windows,
    activeWindowId,
    snapPreview,
    openWindow,
    setWindowTab,
    closeWindow,
    minimizeWindow,
    toggleMaximize,
    focusWindow,
    snapWindow,
    updateWindowBounds,
    minimizeAll,
    restoreAll,
    closeAllWindows,
    checkSnapPreview,
    clearSnapPreview,
  } = useWindowManager(workspaceRef);

  // Authenticated User, Sync & Migration State
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authPhase, setAuthPhase] = useState<AuthPhase>('checking_auth');
  const [showLoadingEscape, setShowLoadingEscape] = useState(false);
  const [authRetryNonce, setAuthRetryNonce] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);
  const [lockedAccountEmail, setLockedAccountEmail] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const activeUidRef = useRef<string | null>(null);
  const authSeqRef = useRef<number>(0);

  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [syncState, setSyncState] = useState<SyncConnectionState>('connecting');
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingConflict, setPendingConflict] = useState<SyncConflictPrompt | null>(null);
  const [legacyMigrationSummary, setLegacyMigrationSummary] =
    useState<LegacyMigrationSummary | null>(null);
  const [isMigrationModalOpen, setIsMigrationModalOpen] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);

  const [darkMode, setDarkMode] = useState<boolean>(() => {
    try {
      return localStorage.getItem('schoolhub_dark_mode') === 'true';
    } catch {
      return false;
    }
  });
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(DEFAULT_SYSTEM_SETTINGS);
  const customPermissions = systemSettings.customPermissions;

  const [pinnedApps, setPinnedApps] = useState<SuperAppId[]>(() => {
    try {
      const saved = localStorage.getItem('schoolhub_pinned_apps');
      if (saved) {
        const parsed = JSON.parse(saved) as SuperAppId[];
        if (Array.isArray(parsed)) return Array.from(new Set(parsed));
      }
    } catch {
      // Ignore malformed storage
    }
    return DEFAULT_PINNED_APPS;
  });

  const [isStartMenuOpen, setIsStartMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [isQuickSettingsOpen, setIsQuickSettingsOpen] = useState(false);
  const [isTaskViewOpen, setIsTaskViewOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    isOpen: false,
    x: 0,
    y: 0,
    appId: null,
  });
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [rbacAlert, setRbacAlert] = useState<string | null>(null);

  // Core Data State - Real-time Firestore Cloud Snapshots
  const [userAccounts, setUserAccounts] = useState<UserProfile[]>([]);
  const [userInvites, setUserInvites] = useState<UserInvite[]>([]);
  const [externalDatasets, setExternalDatasets] = useState<ExternalDatasetRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([]);
  const [academicYears, setAcademicYears] = useState<AcademicYearConfig[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [rooms, setRooms] = useState<SchoolRoom[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [bookCopies, setBookCopies] = useState<BookCopy[]>([]);
  const [borrowTransactions, setBorrowTransactions] = useState<BorrowTransaction[]>([]);
  const [bookReservations, setBookReservations] = useState<BookReservation[]>([]);
  const [inventoryAudits, setInventoryAudits] = useState<InventoryAudit[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveyResponses, setSurveyResponses] = useState<SurveyResponse[]>([]);
  const [feedbacks, setFeedbacks] = useState<FeedbackReport[]>([]);
  const [counseling, setCounseling] = useState<CounselingRequest[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<StudentLeaveRequest[]>([]);
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [schoolEvents, setSchoolEvents] = useState<SchoolEvent[]>([]);
  const [timetable, setTimetable] = useState<TimetableEntry[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [academicRecords, setAcademicRecords] = useState<AcademicRecord[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<AssignmentSubmission[]>([]);
  const [learningMaterials, setLearningMaterials] = useState<LearningMaterial[]>([]);
  const [facilities, setFacilities] = useState<FacilityAsset[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRequest[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [classPlacements, setClassPlacements] = useState<ClassPlacement[]>([]);
  const [teachingAssignments, setTeachingAssignments] = useState<TeachingAssignment[]>([]);
  const [importHistory, setImportHistory] = useState<ImportHistoryRecord[]>([]);
  const [exportHistory, setExportHistory] = useState<ExportHistoryRecord[]>([]);
  const [libraryRenewalRequests, setLibraryRenewalRequests] = useState<LibraryRenewalRequest[]>([]);
  const [libraryTransactionHistory, setLibraryTransactionHistory] = useState<LibraryTransactionHistoryEntry[]>([]);
  const [ruleDocuments, setRuleDocuments] = useState<RuleDocument[]>([]);
  const [ruleVersions, setRuleVersions] = useState<RuleVersion[]>([]);
  const [ruleCategories, setRuleCategories] = useState<RuleCategory[]>([]);
  const [ruleCriteria, setRuleCriteria] = useState<RuleCriterion[]>([]);
  const [emulationRecords, setEmulationRecords] = useState<EmulationRecord[]>([]);
  const [emulationAppeals, setEmulationAppeals] = useState<EmulationAppeal[]>([]);
  const [emulationPeriods, setEmulationPeriods] = useState<EmulationPeriod[]>([]);
  const [emulationSnapshots, setEmulationSnapshots] = useState<EmulationSnapshot[]>([]);
  const [emulationTitleConfigs, setEmulationTitleConfigs] = useState<EmulationTitleConfig[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);
  const [competitionCriteria, setCompetitionCriteria] = useState<CompetitionCriterion[]>([]);
  const [competitionParticipants, setCompetitionParticipants] = useState<CompetitionParticipant[]>([]);
  const [competitionScores, setCompetitionScores] = useState<CompetitionScore[]>([]);
  const [competitionAwards, setCompetitionAwards] = useState<CompetitionAward[]>([]);
  const [scoreTransferRecords, setScoreTransferRecords] = useState<ScoreTransferRecord[]>([]);

  // Sync dark mode class on <html>
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    try {
      localStorage.setItem('schoolhub_dark_mode', String(darkMode));
    } catch {
      // Ignore
    }
  }, [darkMode]);

  // Persist pinned taskbar apps
  useEffect(() => {
    try {
      localStorage.setItem('schoolhub_pinned_apps', JSON.stringify(pinnedApps));
    } catch {
      // Ignore
    }
  }, [pinnedApps]);

  // Auto-dismiss RBAC alert toast
  useEffect(() => {
    if (!rbacAlert) return;
    const timer = setTimeout(() => setRbacAlert(null), 4500);
    return () => clearTimeout(timer);
  }, [rbacAlert]);

  const resetInMemoryCollections = useCallback(() => {
    setUserAccounts([]);
    setUserInvites([]);
    setExternalDatasets([]);
    setStudents([]);
    setTeachers([]);
    setStaffMembers([]);
    setAcademicYears([]);
    setClasses([]);
    setRooms([]);
    setBooks([]);
    setBookCopies([]);
    setBorrowTransactions([]);
    setBookReservations([]);
    setInventoryAudits([]);
    setSurveys([]);
    setSurveyResponses([]);
    setFeedbacks([]);
    setCounseling([]);
    setLeaveRequests([]);
    setSupportTickets([]);
    setAnnouncements([]);
    setSchoolEvents([]);
    setTimetable([]);
    setAttendance([]);
    setAcademicRecords([]);
    setAssignments([]);
    setAssignmentSubmissions([]);
    setLearningMaterials([]);
    setFacilities([]);
    setMaintenance([]);
    setAuditLogs([]);
    setClassPlacements([]);
    setTeachingAssignments([]);
    setImportHistory([]);
    setExportHistory([]);
    setLibraryRenewalRequests([]);
    setLibraryTransactionHistory([]);
    setRuleDocuments([]);
    setRuleVersions([]);
    setRuleCategories([]);
    setRuleCriteria([]);
    setEmulationRecords([]);
    setEmulationAppeals([]);
    setEmulationPeriods([]);
    setEmulationSnapshots([]);
    setEmulationTitleConfigs([]);
    setCompetitions([]);
    setCompetitionCriteria([]);
    setCompetitionParticipants([]);
    setCompetitionScores([]);
    setCompetitionAwards([]);
    setScoreTransferRecords([]);
  }, []);

  const handleCollectionSnapshot = useCallback((collectionName: string, items: unknown[]) => {
    switch (collectionName) {
      case 'users':
        setUserAccounts(dedupById(items as UserProfile[]));
        break;
      case 'userInvites':
        setUserInvites(dedupById(items as UserInvite[]));
        break;
      case 'studentProfiles':
        setStudents(dedupById(items as Student[]));
        break;
      case 'teacherProfiles':
        setTeachers(dedupById(items as Teacher[]));
        break;
      case 'staffMembers':
        setStaffMembers(dedupById(items as StaffMember[]));
        break;
      case 'academicYears':
        setAcademicYears(dedupById(items as AcademicYearConfig[]));
        break;
      case 'classes':
        setClasses(dedupById(items as SchoolClass[]));
        break;
      case 'classPlacements':
        setClassPlacements(dedupById(items as ClassPlacement[]));
        break;
      case 'teachingAssignments':
        setTeachingAssignments(dedupById(items as TeachingAssignment[]));
        break;
      case 'timetable':
        setTimetable(dedupById(items as TimetableEntry[]));
        break;
      case 'assignments':
        setAssignments(dedupById(items as Assignment[]));
        break;
      case 'assignmentSubmissions':
        setAssignmentSubmissions(dedupById(items as AssignmentSubmission[]));
        break;
      case 'learningMaterials':
        setLearningMaterials(dedupById(items as LearningMaterial[]));
        break;
      case 'books':
        setBooks(dedupById(items as Book[]));
        break;
      case 'bookCopies':
        setBookCopies(dedupById(items as BookCopy[]));
        break;
      case 'borrowTransactions':
        setBorrowTransactions(dedupById(items as BorrowTransaction[]));
        break;
      case 'bookReservations':
        setBookReservations(dedupById(items as BookReservation[]));
        break;
      case 'libraryRenewalRequests':
        setLibraryRenewalRequests(dedupById(items as LibraryRenewalRequest[]));
        break;
      case 'libraryTransactionHistory': {
        const rows = dedupById(items as LibraryTransactionHistoryEntry[]).sort((a, b) =>
          (b.changedAt || '').localeCompare(a.changedAt || '')
        );
        setLibraryTransactionHistory(rows);
        break;
      }
      case 'inventoryAudits':
        setInventoryAudits(dedupById(items as InventoryAudit[]));
        break;
      case 'surveys':
        setSurveys(dedupById(items as Survey[]));
        break;
      case 'surveyResponses':
        setSurveyResponses(dedupById(items as SurveyResponse[]));
        break;
      case 'feedbackReports':
        setFeedbacks(dedupById(items as FeedbackReport[]));
        break;
      case 'counselingRequests':
        setCounseling(dedupById(items as CounselingRequest[]));
        break;
      case 'leaveRequests':
        setLeaveRequests(dedupById(items as StudentLeaveRequest[]));
        break;
      case 'supportTickets':
        setSupportTickets(dedupById(items as SupportTicket[]));
        break;
      case 'announcements':
        setAnnouncements(dedupById(items as Announcement[]));
        break;
      case 'schoolEvents':
        setSchoolEvents(dedupById(items as SchoolEvent[]));
        break;
      case 'attendanceRecords':
        setAttendance(dedupById(items as AttendanceRecord[]));
        break;
      case 'academicRecords':
        setAcademicRecords(dedupById(items as AcademicRecord[]));
        break;
      case 'rooms':
        setRooms(dedupById(items as SchoolRoom[]));
        break;
      case 'facilities':
        setFacilities(dedupById(items as FacilityAsset[]));
        break;
      case 'maintenanceRequests':
        setMaintenance(dedupById(items as MaintenanceRequest[]));
        break;
      case 'ruleDocuments':
        setRuleDocuments(dedupById(items as RuleDocument[]));
        break;
      case 'ruleVersions':
        setRuleVersions(dedupById(items as RuleVersion[]));
        break;
      case 'ruleCategories': {
        const rows = dedupById(items as RuleCategory[]).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setRuleCategories(rows);
        break;
      }
      case 'ruleCriteria':
        setRuleCriteria(dedupById(items as RuleCriterion[]));
        break;
      case 'emulationRecords':
        setEmulationRecords(dedupById(items as EmulationRecord[]));
        break;
      case 'emulationAppeals':
        setEmulationAppeals(dedupById(items as EmulationAppeal[]));
        break;
      case 'emulationPeriods':
        setEmulationPeriods(dedupById(items as EmulationPeriod[]));
        break;
      case 'emulationSnapshots':
        setEmulationSnapshots(dedupById(items as EmulationSnapshot[]));
        break;
      case 'emulationTitleConfigs':
        setEmulationTitleConfigs(dedupById(items as EmulationTitleConfig[]));
        break;
      case 'competitions':
        setCompetitions(dedupById(items as Competition[]));
        break;
      case 'competitionCriteria':
        setCompetitionCriteria(dedupById(items as CompetitionCriterion[]));
        break;
      case 'competitionParticipants':
        setCompetitionParticipants(dedupById(items as CompetitionParticipant[]));
        break;
      case 'competitionScores':
        setCompetitionScores(dedupById(items as CompetitionScore[]));
        break;
      case 'competitionAwards':
        setCompetitionAwards(dedupById(items as CompetitionAward[]));
        break;
      case 'scoreTransferRecords':
        setScoreTransferRecords(dedupById(items as ScoreTransferRecord[]));
        break;
      case 'auditLogs': {
        const rows = dedupById(items as AuditLogEntry[])
          .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
          .slice(0, 200);
        setAuditLogs(rows);
        break;
      }
      case 'importHistory': {
        const rows = dedupById(items as ImportHistoryRecord[])
          .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
          .slice(0, 300);
        setImportHistory(rows);
        break;
      }
      case 'exportHistory': {
        const rows = dedupById(items as ExportHistoryRecord[])
          .sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''))
          .slice(0, 300);
        setExportHistory(rows);
        break;
      }
      case 'externalDatasets':
        setExternalDatasets(dedupById(items as ExternalDatasetRecord[]));
        break;
    }
  }, []);

  // Track online / offline connectivity state
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setSyncError(null);
      setSyncState((prev) => (prev === 'offline' ? 'synced' : prev));
    };
    const handleOffline = () => {
      setIsOnline(false);
      setSyncState('offline');
    };
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Verify Firestore connection on boot
  useEffect(() => {
    void testConnection();
  }, []);

  // Keep latest cloud collections ref for accurate duplicate detection during legacy localStorage scan
  const cloudSnapshotByCollection = useMemo<
    Record<string, Array<{ id?: string; [k: string]: unknown }>>
  >(
    () => ({
      users: userAccounts as unknown as Array<{ id?: string; [k: string]: unknown }>,
      studentProfiles: students as unknown as Array<{ id?: string; [k: string]: unknown }>,
      teacherProfiles: teachers as unknown as Array<{ id?: string; [k: string]: unknown }>,
      staffMembers: staffMembers as unknown as Array<{ id?: string; [k: string]: unknown }>,
      academicYears: academicYears as unknown as Array<{ id?: string; [k: string]: unknown }>,
      classes: classes as unknown as Array<{ id?: string; [k: string]: unknown }>,
      classPlacements: classPlacements as unknown as Array<{ id?: string; [k: string]: unknown }>,
      teachingAssignments: teachingAssignments as unknown as Array<{ id?: string; [k: string]: unknown }>,
      timetable: timetable as unknown as Array<{ id?: string; [k: string]: unknown }>,
      assignments: assignments as unknown as Array<{ id?: string; [k: string]: unknown }>,
      assignmentSubmissions: assignmentSubmissions as unknown as Array<{ id?: string; [k: string]: unknown }>,
      learningMaterials: learningMaterials as unknown as Array<{ id?: string; [k: string]: unknown }>,
      books: books as unknown as Array<{ id?: string; [k: string]: unknown }>,
      bookCopies: bookCopies as unknown as Array<{ id?: string; [k: string]: unknown }>,
      borrowTransactions: borrowTransactions as unknown as Array<{ id?: string; [k: string]: unknown }>,
      bookReservations: bookReservations as unknown as Array<{ id?: string; [k: string]: unknown }>,
      libraryRenewalRequests: libraryRenewalRequests as unknown as Array<{ id?: string; [k: string]: unknown }>,
      libraryTransactionHistory: libraryTransactionHistory as unknown as Array<{ id?: string; [k: string]: unknown }>,
      inventoryAudits: inventoryAudits as unknown as Array<{ id?: string; [k: string]: unknown }>,
      surveys: surveys as unknown as Array<{ id?: string; [k: string]: unknown }>,
      surveyResponses: surveyResponses as unknown as Array<{ id?: string; [k: string]: unknown }>,
      feedbackReports: feedbacks as unknown as Array<{ id?: string; [k: string]: unknown }>,
      counselingRequests: counseling as unknown as Array<{ id?: string; [k: string]: unknown }>,
      leaveRequests: leaveRequests as unknown as Array<{ id?: string; [k: string]: unknown }>,
      supportTickets: supportTickets as unknown as Array<{ id?: string; [k: string]: unknown }>,
      announcements: announcements as unknown as Array<{ id?: string; [k: string]: unknown }>,
      schoolEvents: schoolEvents as unknown as Array<{ id?: string; [k: string]: unknown }>,
      attendanceRecords: attendance as unknown as Array<{ id?: string; [k: string]: unknown }>,
      academicRecords: academicRecords as unknown as Array<{ id?: string; [k: string]: unknown }>,
      rooms: rooms as unknown as Array<{ id?: string; [k: string]: unknown }>,
      facilities: facilities as unknown as Array<{ id?: string; [k: string]: unknown }>,
      maintenanceRequests: maintenance as unknown as Array<{ id?: string; [k: string]: unknown }>,
      ruleDocuments: ruleDocuments as unknown as Array<{ id?: string; [k: string]: unknown }>,
      ruleVersions: ruleVersions as unknown as Array<{ id?: string; [k: string]: unknown }>,
      ruleCategories: ruleCategories as unknown as Array<{ id?: string; [k: string]: unknown }>,
      ruleCriteria: ruleCriteria as unknown as Array<{ id?: string; [k: string]: unknown }>,
      emulationRecords: emulationRecords as unknown as Array<{ id?: string; [k: string]: unknown }>,
      emulationAppeals: emulationAppeals as unknown as Array<{ id?: string; [k: string]: unknown }>,
      emulationPeriods: emulationPeriods as unknown as Array<{ id?: string; [k: string]: unknown }>,
      emulationSnapshots: emulationSnapshots as unknown as Array<{ id?: string; [k: string]: unknown }>,
      emulationTitleConfigs: emulationTitleConfigs as unknown as Array<{ id?: string; [k: string]: unknown }>,
      competitions: competitions as unknown as Array<{ id?: string; [k: string]: unknown }>,
      competitionCriteria: competitionCriteria as unknown as Array<{ id?: string; [k: string]: unknown }>,
      competitionParticipants: competitionParticipants as unknown as Array<{ id?: string; [k: string]: unknown }>,
      competitionScores: competitionScores as unknown as Array<{ id?: string; [k: string]: unknown }>,
      competitionAwards: competitionAwards as unknown as Array<{ id?: string; [k: string]: unknown }>,
      scoreTransferRecords: scoreTransferRecords as unknown as Array<{ id?: string; [k: string]: unknown }>,
      auditLogs: auditLogs as unknown as Array<{ id?: string; [k: string]: unknown }>,
      importHistory: importHistory as unknown as Array<{ id?: string; [k: string]: unknown }>,
      exportHistory: exportHistory as unknown as Array<{ id?: string; [k: string]: unknown }>,
      externalDatasets: externalDatasets as unknown as Array<{ id?: string; [k: string]: unknown }>,
    }),
    [
      academicRecords,
      academicYears,
      announcements,
      assignmentSubmissions,
      assignments,
      attendance,
      auditLogs,
      bookCopies,
      bookReservations,
      books,
      borrowTransactions,
      classPlacements,
      classes,
      competitionAwards,
      competitionCriteria,
      competitionParticipants,
      competitionScores,
      competitions,
      counseling,
      emulationAppeals,
      emulationPeriods,
      emulationRecords,
      emulationSnapshots,
      emulationTitleConfigs,
      exportHistory,
      externalDatasets,
      facilities,
      feedbacks,
      importHistory,
      inventoryAudits,
      learningMaterials,
      leaveRequests,
      libraryRenewalRequests,
      libraryTransactionHistory,
      maintenance,
      rooms,
      ruleCategories,
      ruleCriteria,
      ruleDocuments,
      ruleVersions,
      schoolEvents,
      scoreTransferRecords,
      staffMembers,
      students,
      supportTickets,
      surveyResponses,
      surveys,
      teachers,
      teachingAssignments,
      timetable,
      userAccounts,
    ]
  );

  const cloudSnapshotRef = useRef(cloudSnapshotByCollection);
  useEffect(() => {
    cloudSnapshotRef.current = cloudSnapshotByCollection;
  }, [cloudSnapshotByCollection]);

  const closeAllOverlays = useCallback(() => {
    setIsStartMenuOpen(false);
    setIsNotificationOpen(false);
    setIsQuickSettingsOpen(false);
    setIsTaskViewOpen(false);
    setIsSearchOpen(false);
    setContextMenu((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const resetWorkspaceSession = useCallback(() => {
    resetInMemoryCollections();
    closeAllWindows();
    closeAllOverlays();
    setSystemSettings(DEFAULT_SYSTEM_SETTINGS);
    setActiveSchoolContext(DEFAULT_SCHOOL_ID);
    setPendingConflict(null);
    setLegacyMigrationSummary(null);
    setIsMigrationModalOpen(false);
    setIsMigrating(false);
    setReadNotificationIds([]);
    setRbacAlert(null);
    setSyncError(null);
    setSyncState('connecting');
  }, [closeAllOverlays, closeAllWindows, resetInMemoryCollections]);

  const handleForceSignOut = useCallback(async () => {
    authSeqRef.current += 1;
    activeUidRef.current = null;
    resetWorkspaceSession();
    setAuthError(null);
    setLockedAccountEmail(null);
    setCurrentUser(null);
    setFirebaseUser(null);
    try {
      await disconnectGoogleWorkspace({ signOutFirebase: true });
    } catch {
      try {
        await signOut(auth);
      } catch {
        // Ignore fallback signOut failure
      }
    }
    setAuthPhase('signed_out');
  }, [resetWorkspaceSession]);

  const handleRetryAuthSession = useCallback(() => {
    setAuthError(null);
    setLockedAccountEmail(null);
    setAuthPhase(auth.currentUser ? 'loading_profile' : 'checking_auth');
    setAuthRetryNonce((n) => n + 1);
  }, []);

  // Show escape button whenever loading phase takes > 4s
  useEffect(() => {
    if (!isAuthLoadingPhase(authPhase)) {
      setShowLoadingEscape(false);
      return;
    }
    const timer = setTimeout(() => setShowLoadingEscape(true), 4000);
    return () => clearTimeout(timer);
  }, [authPhase]);

  // Listen for real Firebase Auth changes & attach real-time onSnapshot listeners
  useEffect(() => {
    let active = true;
    let unsubscribeCollections: (() => void) | null = null;
    let migrationPromptTimer: ReturnType<typeof setTimeout> | null = null;
    let appBootGraceTimer: ReturnType<typeof setTimeout> | null = null;
    let authCheckTimeoutTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanupRuntimeListeners = () => {
      if (unsubscribeCollections) {
        unsubscribeCollections();
        unsubscribeCollections = null;
      }
      if (migrationPromptTimer) {
        clearTimeout(migrationPromptTimer);
        migrationPromptTimer = null;
      }
      if (appBootGraceTimer) {
        clearTimeout(appBootGraceTimer);
        appBootGraceTimer = null;
      }
    };

    // Guard against Firebase Auth initialization stalling indefinitely on checking_auth
    authCheckTimeoutTimer = setTimeout(() => {
      if (!active) return;
      setAuthPhase((prev) => {
        if (prev === 'checking_auth') {
          setAuthError('Không nhận được phản hồi từ dịch vụ xác thực Firebase Auth. Vui lòng thử lại.');
          return 'error';
        }
        return prev;
      });
    }, 10000);

    const processFirebaseUser = async (fireUser: FirebaseUser | null) => {
      if (authCheckTimeoutTimer) {
        clearTimeout(authCheckTimeoutTimer);
        authCheckTimeoutTimer = null;
      }

      const seq = ++authSeqRef.current;
      cleanupRuntimeListeners();

      if (!fireUser) {
        if (!active || authSeqRef.current !== seq) return;
        activeUidRef.current = null;
        setFirebaseUser(null);
        setCurrentUser(null);
        resetWorkspaceSession();
        setAuthPhase('signed_out');
        return;
      }

      const identityChanged = hasAccountIdentityChanged(activeUidRef.current, fireUser.uid);
      if (identityChanged) {
        resetWorkspaceSession();
        setCurrentUser(null);
      }
      activeUidRef.current = fireUser.uid;

      setFirebaseUser(fireUser);
      setLockedAccountEmail(null);
      setAuthError(null);
      setAuthPhase('loading_profile');
      setSyncState(typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'connecting');

      try {
        const resolved = await resolveOrProvisionAuthenticatedUser(fireUser, {
          onPhase: (nextPhase) => {
            if (active && authSeqRef.current === seq) {
              setAuthPhase(nextPhase);
            }
          },
        });
        if (!active || authSeqRef.current !== seq) return;

        if (!isUserActive(resolved)) {
          setLockedAccountEmail(resolved.email || fireUser.email || null);
          setCurrentUser(null);
          resetWorkspaceSession();
          setAuthPhase('access_denied');
          try {
            await disconnectGoogleWorkspace({ signOutFirebase: true });
          } catch {
            await signOut(auth);
          }
          return;
        }

        setAuthPhase('loading_app');
        setCurrentUser(resolved);

        let firstErrorNotified = false;
        let promotedToAuthenticated = false;
        const markAppReady = () => {
          if (!active || authSeqRef.current !== seq || promotedToAuthenticated) return;
          promotedToAuthenticated = true;
          if (appBootGraceTimer) {
            clearTimeout(appBootGraceTimer);
            appBootGraceTimer = null;
          }
          setAuthPhase('authenticated');
        };

        // Ensure empty/new school workspaces enter Desktop smoothly within 900ms even before all collections emit
        appBootGraceTimer = setTimeout(markAppReady, 900);

        unsubscribeCollections = subscribeSchoolCollections({
          user: resolved,
          schoolId: resolved.schoolId || DEFAULT_SCHOOL_ID,
          onCollectionData: (colName, items) => {
            if (!active || authSeqRef.current !== seq) return;
            handleCollectionSnapshot(colName, items);
            setSyncState((prev) =>
              prev === 'connecting' || prev === 'error'
                ? typeof navigator !== 'undefined' && navigator.onLine === false
                  ? 'offline'
                  : 'synced'
                : prev
            );
            setSyncError(null);
            markAppReady();
          },
          onSystemSettings: (settings) => {
            if (!active || authSeqRef.current !== seq) return;
            setSystemSettings(settings);
            markAppReady();
          },
          onUserProfileChanged: (updatedProfile) => {
            if (!active || authSeqRef.current !== seq) return;
            if (!isUserActive(updatedProfile)) {
              setLockedAccountEmail(updatedProfile.email || fireUser.email || null);
              setCurrentUser(null);
              resetWorkspaceSession();
              setAuthPhase('access_denied');
              void disconnectGoogleWorkspace({ signOutFirebase: true });
              return;
            }
            setCurrentUser(updatedProfile);
          },
          onError: (colName, err) => {
            if (!active || authSeqRef.current !== seq) return;
            console.error(`Realtime sync error [${colName}]:`, err);
            setSyncState('error');
            if (!firstErrorNotified) {
              firstErrorNotified = true;
              setSyncError(`Lỗi đồng bộ thời gian thực (${colName}): ${err.message}`);
            }
            markAppReady();
          },
        });

        // For admins, check if legacy browser localStorage has un-synced records
        const isAdminUser =
          resolved.role === 'admin' || Boolean(resolved.secondaryRoles?.includes('admin'));
        if (isAdminUser) {
          migrationPromptTimer = setTimeout(() => {
            if (!active || authSeqRef.current !== seq) return;
            const summary = scanLegacyLocalStorage(cloudSnapshotRef.current);
            setLegacyMigrationSummary(summary);
            if (summary.totalLocalRecords > 0) {
              setIsMigrationModalOpen(true);
            }
          }, 1200);
        } else {
          setLegacyMigrationSummary(null);
        }
      } catch (err) {
        if (!active || authSeqRef.current !== seq) return;
        console.error('Auth profile resolution error:', err);
        const failure = classifyAuthFailure(err);
        setAuthError(failure.message);
        setCurrentUser(null);
        setAuthPhase(failure.kind);
      }
    };

    if (authRetryNonce > 0 && auth.currentUser) {
      void processFirebaseUser(auth.currentUser);
    }

    const unsubscribeAuth = onAuthStateChanged(auth, (fireUser) => {
      void processFirebaseUser(fireUser);
    });

    return () => {
      active = false;
      authSeqRef.current += 1;
      if (authCheckTimeoutTimer) clearTimeout(authCheckTimeoutTimer);
      cleanupRuntimeListeners();
      unsubscribeAuth();
    };
  }, [authRetryNonce, handleCollectionSnapshot, resetWorkspaceSession]);

  // Keyboard shortcuts: Ctrl+K / Cmd+K for Search, Escape to close popovers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        closeAllOverlays();
        setIsSearchOpen(true);
      }
      if (e.key === 'Escape') {
        closeAllOverlays();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeAllOverlays]);

  const executeCloudWrite = useCallback(async <T,>(fn: () => Promise<T>): Promise<T> => {
    setSyncState('syncing');
    setSyncError(null);
    try {
      const result = await fn();
      setSyncState(
        typeof navigator !== 'undefined' && navigator.onLine === false ? 'offline' : 'synced'
      );
      return result;
    } catch (err) {
      if (err instanceof SyncConflictError) {
        setPendingConflict(err.conflict);
        setSyncState('conflict');
        setRbacAlert(err.message);
      } else if (err instanceof OfflineSyncError) {
        setSyncState('offline');
        setSyncError(err.message);
        setRbacAlert(err.message);
      } else if (err instanceof AuthRequiredError) {
        setAuthError(err.message);
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setSyncState('error');
        setSyncError(msg);
        setRbacAlert(`Không thể đồng bộ lên máy chủ: ${msg}`);
      }
      throw err;
    }
  }, []);

  const logAction = useCallback(
    async (action: string, target: string) => {
      if (!currentUser) return;
      const entry: AuditLogEntry = {
        id: `log_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        actorName: currentUser.displayName,
        actorRole: currentUser.role,
        action,
        target,
        timestamp: new Date().toISOString(),
      };
      await appendAuditLog(entry);
      setAuditLogs((prev) => mergeRecordsById(prev, [entry]).slice(0, 200));
    },
    [currentUser]
  );

  // Window Launching with RBAC Enforcement
  const handleOpenApp = useCallback(
    (appId: SuperAppId, tabId?: string) => {
      closeAllOverlays();
      if (!currentUser) return;
      if (!canAccessSuperApp(currentUser, appId, customPermissions)) {
        const roleLabel = ROLE_DEFINITIONS[currentUser.role]?.label || currentUser.role;
        const appTitle = APP_REGISTRY[appId].title;
        setRbacAlert(`Vai trò "${roleLabel}" không có quyền truy cập ứng dụng "${appTitle}".`);
        return;
      }

      const allowedTabs = getAllowedTabsForApp(currentUser, appId, customPermissions);
      let resolvedTab = tabId ? resolveAppTabAlias(appId, tabId) : undefined;
      if (resolvedTab && !allowedTabs.some((t) => t.id === resolvedTab)) {
        resolvedTab = allowedTabs[0]?.id;
      } else if (!resolvedTab) {
        const currentWin = windows[appId];
        if (!currentWin?.isOpen || !allowedTabs.some((t) => t.id === currentWin.activeTab)) {
          resolvedTab = allowedTabs[0]?.id;
        }
      }
      openWindow(appId, resolvedTab);
    },
    [closeAllOverlays, currentUser, customPermissions, openWindow, windows]
  );

  const handleTaskbarAppClick = useCallback(
    (appId: SuperAppId) => {
      if (!currentUser) return;
      const win = windows[appId];
      if (!canAccessSuperApp(currentUser, appId, customPermissions)) {
        const roleLabel = ROLE_DEFINITIONS[currentUser.role]?.label || currentUser.role;
        const appTitle = APP_REGISTRY[appId].title;
        setRbacAlert(`Vai trò "${roleLabel}" không có quyền truy cập ứng dụng "${appTitle}".`);
        return;
      }
      if (win?.isOpen) {
        if (activeWindowId === appId && !win.isMinimized) {
          minimizeWindow(appId);
        } else {
          focusWindow(appId);
        }
      } else {
        handleOpenApp(appId);
      }
    },
    [activeWindowId, currentUser, customPermissions, focusWindow, handleOpenApp, minimizeWindow, windows]
  );

  const handleShowDesktop = useCallback(() => {
    closeAllOverlays();
    const hasVisibleWindow = SUPER_APP_ORDER.some(
      (id) => windows[id]?.isOpen && !windows[id]?.isMinimized
    );
    if (hasVisibleWindow) {
      minimizeAll();
    } else {
      restoreAll();
    }
  }, [closeAllOverlays, minimizeAll, restoreAll, windows]);

  const handleTogglePin = useCallback((appId: SuperAppId) => {
    setPinnedApps((prev) =>
      prev.includes(appId) ? prev.filter((id) => id !== appId) : Array.from(new Set([...prev, appId]))
    );
  }, []);

  // Conflict resolution & Legacy localStorage migration handlers
  const handleResolveConflict = async (
    strategy: 'keep_server' | 'overwrite_local' | 'custom',
    customMerged?: Record<string, unknown>
  ) => {
    if (!pendingConflict) return;
    if (strategy === 'keep_server') {
      setPendingConflict(null);
      setSyncState(isOnline ? 'synced' : 'offline');
      return;
    }
    const payload =
      strategy === 'custom' && customMerged ? customMerged : pendingConflict.localRecord;
    await executeCloudWrite(() =>
      applyConflictResolution(pendingConflict.collectionName, pendingConflict.docId, payload)
    );
    await logAction('Xử lý xung đột đồng bộ', `${pendingConflict.collectionLabel}: ${pendingConflict.recordLabel}`);
    setPendingConflict(null);
  };

  const handleOpenLegacyMigration = () => {
    const summary = scanLegacyLocalStorage(cloudSnapshotRef.current);
    setLegacyMigrationSummary(summary);
    setIsMigrationModalOpen(true);
  };

  const handleConfirmLegacyMigration = async () => {
    const summary = scanLegacyLocalStorage(cloudSnapshotRef.current);
    setIsMigrating(true);
    try {
      const { uploadedCount } = await executeCloudWrite(() =>
        migrateLegacyLocalStorageToCloud(summary)
      );
      setLegacyMigrationSummary(scanLegacyLocalStorage(cloudSnapshotRef.current));
      setIsMigrationModalOpen(false);
      await logAction('Đồng bộ dữ liệu cục bộ cũ lên Cloud', `${uploadedCount} bản ghi`);
    } finally {
      setIsMigrating(false);
    }
  };

  const handlePurgeLegacyOnly = () => {
    purgeAllLegacyLocalStorageKeys();
    setLegacyMigrationSummary(scanLegacyLocalStorage(cloudSnapshotRef.current));
    setIsMigrationModalOpen(false);
  };

  /* ---------------- Business Handlers (Cloud-First + Optimistic Concurrency) ---------------- */
  const handleSaveUserAccount = async (user: UserProfile) => {
    const existing = userAccounts.find((u) => u.id === user.id);
    const baseRecord = existing && existing.version === user.version ? existing : undefined;
    await executeCloudWrite(() => saveUserAccount(user, { baseRecord }));
    setUserAccounts((prev) => mergeRecordsById(prev, [user]));
    await logAction(
      'Quản trị tài khoản',
      `${user.displayName} (${ROLE_DEFINITIONS[user.role]?.label || user.role})`
    );
  };

  const handleDeleteUserAccount = async (userId: string) => {
    const target = userAccounts.find((u) => u.id === userId);
    await executeCloudWrite(() => deleteUserAccount(userId));
    setUserAccounts((prev) => prev.filter((u) => u.id !== userId));
    await logAction('Xóa tài khoản', target ? target.displayName : userId);
  };

  const handleDeleteUserInvite = async (inviteId: string) => {
    const target = userInvites.find((inv) => inv.id === inviteId);
    await executeCloudWrite(() => deleteUserInvite(inviteId));
    setUserInvites((prev) => prev.filter((inv) => inv.id !== inviteId));
    await logAction('Thu hồi lời mời tài khoản', target ? target.email : inviteId);
  };

  const handleAddStudent = async (student: Student) => {
    await executeCloudWrite(() => saveStudent(student));
    setStudents((prev) => mergeRecordsById(prev, [student]));
    await logAction('Thêm học sinh', `${student.fullName} (${student.studentCode})`);
  };

  const handleUpdateStudent = async (student: Student) => {
    const existing = students.find((s) => s.id === student.id);
    const baseRecord = existing && existing.version === student.version ? existing : undefined;
    await executeCloudWrite(() => saveStudent(student, { baseRecord }));
    setStudents((prev) => mergeRecordsById(prev, [student]));
    await logAction('Cập nhật học sinh', `${student.fullName} (${student.studentCode})`);
  };

  const handleDeleteStudent = async (studentId: string) => {
    const target = students.find((s) => s.id === studentId);
    await executeCloudWrite(() => deleteStudent(studentId));
    setStudents((prev) => prev.filter((s) => s.id !== studentId));
    await logAction('Xóa học sinh', target ? `${target.fullName} (${target.studentCode})` : studentId);
  };

  const handleImportStudents = async (newStudents: Student[]) => {
    await executeCloudWrite(() => upsertBatchWithSync('studentProfiles', 'students', newStudents));
    setStudents((prev) => mergeRecordsById(prev, newStudents));
    await logAction('Import Excel học sinh', `${newStudents.length} hồ sơ`);
  };

  const handleAddTeacher = async (teacher: Teacher) => {
    await executeCloudWrite(() => saveTeacher(teacher));
    setTeachers((prev) => mergeRecordsById(prev, [teacher]));
    await logAction('Thêm giáo viên', `${teacher.fullName} (${teacher.subject})`);
  };

  const handleUpdateTeacher = async (teacher: Teacher) => {
    const existing = teachers.find((t) => t.id === teacher.id);
    const baseRecord = existing && existing.version === teacher.version ? existing : undefined;
    await executeCloudWrite(() => saveTeacher(teacher, { baseRecord }));
    setTeachers((prev) => mergeRecordsById(prev, [teacher]));
    await logAction('Cập nhật giáo viên', `${teacher.fullName} (${teacher.subject})`);
  };

  const handleDeleteTeacher = async (teacherId: string) => {
    const target = teachers.find((t) => t.id === teacherId);
    await executeCloudWrite(() => deleteTeacher(teacherId));
    setTeachers((prev) => prev.filter((t) => t.id !== teacherId));
    await logAction('Xóa giáo viên', target ? `${target.fullName} (${target.email || target.id})` : teacherId);
  };

  const handleImportTeachers = async (newTeachers: Teacher[]) => {
    await executeCloudWrite(() => upsertBatchWithSync('teacherProfiles', 'teachers', newTeachers, false));
    setTeachers((prev) => mergeRecordsById(prev, newTeachers));
    await logAction('Import Excel giáo viên', `${newTeachers.length} hồ sơ`);
  };

  const handleSaveStaffMember = async (member: StaffMember) => {
    const existing = staffMembers.find((m) => m.id === member.id);
    const baseRecord = existing && existing.version === member.version ? existing : undefined;
    await executeCloudWrite(() => saveStaffMember(member, { baseRecord }));
    setStaffMembers((prev) => mergeRecordsById(prev, [member]));
    await logAction('Cập nhật nhân sự', `${member.fullName} (${member.department})`);
  };

  const handleDeleteStaffMember = async (memberId: string) => {
    const target = staffMembers.find((m) => m.id === memberId);
    await executeCloudWrite(() => deleteStaffMember(memberId));
    setStaffMembers((prev) => prev.filter((m) => m.id !== memberId));
    await logAction('Xóa nhân sự', target ? target.fullName : memberId);
  };

  const handleAddClass = async (newClass: SchoolClass) => {
    await executeCloudWrite(() => saveClass(newClass));
    setClasses((prev) => mergeRecordsById(prev, [newClass]));
    await logAction('Tạo lớp học', `${newClass.name} (${newClass.room})`);
  };

  const handleUpdateClass = async (updatedClass: SchoolClass) => {
    const existing = classes.find((c) => c.id === updatedClass.id);
    const baseRecord = existing && existing.version === updatedClass.version ? existing : undefined;
    await executeCloudWrite(() => saveClass(updatedClass, { baseRecord }));
    setClasses((prev) => mergeRecordsById(prev, [updatedClass]));
    await logAction('Cập nhật lớp học', `${updatedClass.name} (${updatedClass.room})`);
  };

  const handleDeleteClass = async (classId: string) => {
    const target = classes.find((c) => c.id === classId);
    await executeCloudWrite(() => deleteClass(classId));
    setClasses((prev) => prev.filter((c) => c.id !== classId));
    await logAction('Xóa lớp học', target ? target.name : classId);
  };

  const handleSaveAcademicYear = async (year: AcademicYearConfig) => {
    await executeCloudWrite(() => saveAcademicYear(year));
    setAcademicYears((prev) => mergeRecordsById(prev, [year]));
    await logAction('Lưu năm học', `${year.name} - ${year.currentSemester}`);
  };

  const handleAddTimetableEntry = async (entry: TimetableEntry) => {
    await executeCloudWrite(() => saveTimetableEntry(entry));
    setTimetable((prev) => mergeRecordsById(prev, [entry]));
    await logAction('Thêm tiết thời khóa biểu', `${entry.className} - ${entry.subject}`);
  };

  const handleUpdateTimetableEntry = async (entry: TimetableEntry) => {
    await executeCloudWrite(() => saveTimetableEntry(entry));
    setTimetable((prev) => mergeRecordsById(prev, [entry]));
    await logAction('Cập nhật thời khóa biểu', `${entry.className} - ${entry.subject}`);
  };

  const handleDeleteTimetableEntry = async (entryId: string) => {
    const target = timetable.find((t) => t.id === entryId);
    await executeCloudWrite(() => deleteTimetableEntry(entryId));
    setTimetable((prev) => prev.filter((t) => t.id !== entryId));
    await logAction('Xóa tiết TKB', target ? `${target.className} - ${target.subject}` : entryId);
  };

  const handleSaveAttendance = async (records: AttendanceRecord[]) => {
    await executeCloudWrite(() => saveAttendanceRecords(records));
    setAttendance((prev) => {
      const copy = dedupById(prev);
      for (const rec of records) {
        const idx = copy.findIndex(
          (a) => a.id === rec.id || (a.date === rec.date && a.studentId === rec.studentId)
        );
        if (idx >= 0) copy[idx] = rec;
        else copy.push(rec);
      }
      return dedupById(copy);
    });
    await logAction('Lưu điểm danh', `${records.length} học sinh`);
  };

  const handleSaveAcademicRecord = async (rec: AcademicRecord) => {
    const existing = academicRecords.find((a) => a.id === rec.id);
    const baseRecord = existing && existing.version === rec.version ? existing : undefined;
    await executeCloudWrite(() => saveAcademicRecord(rec, { baseRecord }));
    setAcademicRecords((prev) => {
      const copy = dedupById(prev);
      const idx = copy.findIndex(
        (a) =>
          a.id === rec.id ||
          (a.studentId === rec.studentId &&
            a.subjectId === rec.subjectId &&
            a.semester === rec.semester)
      );
      if (idx >= 0) copy[idx] = rec;
      else copy.push(rec);
      return dedupById(copy);
    });
    await logAction('Cập nhật bảng điểm', `${rec.studentName} - ${rec.subjectName}`);
  };

  const handleSaveAssignment = async (assignment: Assignment) => {
    await executeCloudWrite(() => saveAssignment(assignment));
    setAssignments((prev) => mergeRecordsById(prev, [assignment]));
    await logAction('Giao bài tập', `${assignment.title} (${assignment.className})`);
  };

  const handleDeleteAssignment = async (assignmentId: string) => {
    const target = assignments.find((a) => a.id === assignmentId);
    await executeCloudWrite(() => deleteAssignment(assignmentId));
    setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
    await logAction('Xóa bài tập', target ? target.title : assignmentId);
  };

  const handleSaveSubmission = async (sub: AssignmentSubmission) => {
    await executeCloudWrite(() => saveAssignmentSubmission(sub));
    setAssignmentSubmissions((prev) => mergeRecordsById(prev, [sub]));
    await logAction(
      sub.status === 'graded' ? 'Chấm bài tập' : 'Nộp bài tập',
      `${sub.studentName} (${sub.score != null ? `${sub.score} điểm` : 'Đã nộp'})`
    );
  };

  const handleSaveMaterial = async (material: LearningMaterial) => {
    await executeCloudWrite(() => saveLearningMaterial(material));
    setLearningMaterials((prev) => mergeRecordsById(prev, [material]));
    await logAction('Đăng học liệu', `${material.title} (${material.subject})`);
  };

  const handleDeleteMaterial = async (materialId: string) => {
    const target = learningMaterials.find((m) => m.id === materialId);
    await executeCloudWrite(() => deleteLearningMaterial(materialId));
    setLearningMaterials((prev) => prev.filter((m) => m.id !== materialId));
    await logAction('Xóa học liệu', target ? target.title : materialId);
  };

  // Library with BookCopy sync, Renew & Multi-role borrower support (Atomic Firestore Transactions)
  const handleBorrowBook = async (
    borrower: { id: string; fullName: string; code: string; role: UserRole },
    book: Book,
    copyBarcode: string,
    copyId?: string
  ) => {
    const borrowerPolicy = getEffectiveLibraryPolicy(borrower.role, systemSettings);
    const trans = await executeCloudWrite(() =>
      recordBorrowBook(
        { id: borrower.id, fullName: borrower.fullName, studentCode: borrower.code },
        book,
        copyBarcode,
        borrowerPolicy.loanDays,
        copyId,
        borrower.role
      )
    );
    setBorrowTransactions((prev) => mergeRecordsById(prev, [trans]));
    setBooks((prev) =>
      prev.map((b) =>
        b.id === book.id ? { ...b, availableCopies: Math.max(0, b.availableCopies - 1) } : b
      )
    );
    setBookCopies((prev) =>
      prev.map((c) =>
        (copyId && c.id === copyId) ||
        c.copyBarcode.toUpperCase() === copyBarcode.toUpperCase() ||
        c.rfidTag?.toUpperCase() === copyBarcode.toUpperCase()
          ? {
              ...c,
              status: 'borrowed',
              currentTransactionId: trans.id,
              updatedAt: new Date().toISOString(),
            }
          : c
      )
    );
    await logAction('Cho mượn sách', `${book.title} → ${borrower.fullName}`);
  };

  const handleReturnBook = async (
    transactionId: string,
    conditionOnReturn: BorrowTransaction['conditionOnReturn'] = 'Tốt',
    fineAmount: number = 0
  ) => {
    await executeCloudWrite(() => recordReturnBook(transactionId, conditionOnReturn, fineAmount));
    const trans = borrowTransactions.find((t) => t.id === transactionId);
    const isLost = conditionOnReturn === 'Mất';
    const nextStatus: BorrowTransaction['status'] = isLost ? 'lost' : 'returned';
    const returnDate = new Date().toISOString().split('T')[0];

    setBorrowTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId
          ? { ...t, status: nextStatus, returnDate, conditionOnReturn, fineAmount }
          : t
      )
    );
    if (trans) {
      if (!isLost) {
        setBooks((prev) =>
          prev.map((b) =>
            b.id === trans.bookId
              ? { ...b, availableCopies: Math.min(b.totalCopies, b.availableCopies + 1) }
              : b
          )
        );
      }
      setBookCopies((prev) =>
        prev.map((c) =>
          (trans.copyId && c.id === trans.copyId) ||
          c.currentTransactionId === transactionId ||
          c.copyBarcode.toUpperCase() === trans.copyBarcode.toUpperCase()
            ? {
                ...c,
                status: isLost ? 'lost' : conditionOnReturn === 'Hỏng' ? 'damaged' : 'available',
                condition:
                  conditionOnReturn === 'Hỏng'
                    ? 'Hỏng'
                    : conditionOnReturn === 'Hư hỏng nhẹ'
                    ? 'Cần sửa'
                    : 'Tốt',
                currentTransactionId: undefined,
                updatedAt: new Date().toISOString(),
              }
            : c
        )
      );
      await logAction('Nhận trả sách', `${trans.bookTitle} (${trans.copyBarcode})`);
    }
  };

  const handleRenewBook = async (transactionId: string, newDueDate: string) => {
    await executeCloudWrite(() => recordRenewBook(transactionId, newDueDate));
    setBorrowTransactions((prev) =>
      prev.map((t) =>
        t.id === transactionId
          ? { ...t, dueDate: newDueDate, renewCount: (t.renewCount ?? 0) + 1 }
          : t
      )
    );
    await logAction('Gia hạn sách', `${transactionId} → ${newDueDate}`);
  };

  const handleAddBook = async (book: Book) => {
    const createdCopies = generateBookCopiesForBook(book, bookCopies);
    await executeCloudWrite(async () => {
      await saveBook(book);
      if (createdCopies.length > 0) {
        await upsertBatchWithSync('bookCopies', 'book_copies', createdCopies);
      }
    });
    setBooks((prev) => mergeRecordsById(prev, [book]));
    if (createdCopies.length > 0) {
      setBookCopies((prev) => mergeRecordsById(prev, createdCopies));
    }
    await logAction('Thêm đầu sách', `${book.title} (${createdCopies.length} bản sao)`);
  };

  const handleDeleteBook = async (bookId: string) => {
    const target = books.find((b) => b.id === bookId);
    await executeCloudWrite(() => deleteBook(bookId));
    setBooks((prev) => prev.filter((b) => b.id !== bookId));
    await logAction('Xóa đầu sách', target ? target.title : bookId);
  };

  const handleImportBooks = async (newBooks: Book[]) => {
    const allGenerated: BookCopy[] = [];
    const workingCopies = [...bookCopies];
    for (const b of newBooks) {
      const created = generateBookCopiesForBook(b, workingCopies);
      for (const copy of created) {
        workingCopies.push(copy);
        allGenerated.push(copy);
      }
    }
    await executeCloudWrite(async () => {
      await upsertBatchWithSync('books', 'books', newBooks);
      if (allGenerated.length > 0) {
        await upsertBatchWithSync('bookCopies', 'book_copies', allGenerated);
      }
    });
    setBooks((prev) => mergeRecordsById(prev, newBooks));
    if (allGenerated.length > 0) {
      setBookCopies((prev) => mergeRecordsById(prev, allGenerated));
    }
    await logAction('Import Excel sách', `${newBooks.length} đầu sách · ${allGenerated.length} bản sao`);
  };

  const handleSaveBookCopy = async (copy: BookCopy) => {
    await executeCloudWrite(() => saveBookCopy(copy));
    setBookCopies((prev) => mergeRecordsById(prev, [copy]));
    await logAction('Cập nhật bản sao sách', `${copy.copyBarcode} (${copy.status})`);
  };

  const handleSaveReservation = async (res: BookReservation) => {
    await executeCloudWrite(() => saveBookReservation(res));
    setBookReservations((prev) => mergeRecordsById(prev, [res]));
    await logAction('Đặt mượn sách', `${res.bookTitle} (${res.studentName})`);
  };

  const handleSaveInventoryAudit = async (audit: InventoryAudit) => {
    await executeCloudWrite(() => saveInventoryAudit(audit));
    setInventoryAudits((prev) => mergeRecordsById(prev, [audit]));
    await logAction('Kiểm kê thư viện', `${audit.matchedCount}/${audit.totalCopiesExpected} bản sao khớp`);
  };

  const handleSubmitRenewalRequest = async (req: LibraryRenewalRequest) => {
    await executeCloudWrite(() => saveLibraryRenewalRequest(req));
    setLibraryRenewalRequests((prev) => mergeRecordsById(prev, [req]));
    await logAction('Gửi yêu cầu gia hạn sách', `${req.bookTitle} (${req.borrowerName})`);
  };

  const handleApproveRenewalRequest = async (req: LibraryRenewalRequest) => {
    if (!currentUser) return;
    const res = await executeCloudWrite(() =>
      updateBorrowDueDateWithHistory(
        req.transactionId,
        req.requestedDueDate,
        currentUser.displayName,
        currentUser.role,
        req.reason ? `Duyệt gia hạn: ${req.reason}` : 'Duyệt yêu cầu gia hạn sách',
        true
      )
    );
    if (res.updatedTransaction) {
      setBorrowTransactions((prev) =>
        prev.map((t) => (t.id === req.transactionId ? res.updatedTransaction! : t))
      );
    }
    if (res.historyEntry) {
      setLibraryTransactionHistory((prev) => mergeRecordsById(prev, [res.historyEntry!]));
    }
    const updatedReq: LibraryRenewalRequest = {
      ...req,
      status: 'approved',
      reviewedBy: currentUser.displayName,
      reviewedAt: new Date().toISOString(),
    };
    await executeCloudWrite(() => saveLibraryRenewalRequest(updatedReq));
    setLibraryRenewalRequests((prev) =>
      prev.map((r) => (r.id === req.id ? updatedReq : r))
    );
    await logAction('Duyệt gia hạn sách', `${req.transactionCode} → ${req.requestedDueDate}`);
  };

  const handleRejectRenewalRequest = async (req: LibraryRenewalRequest, note: string) => {
    if (!currentUser) return;
    const updatedReq: LibraryRenewalRequest = {
      ...req,
      status: 'rejected',
      reviewedBy: currentUser.displayName,
      reviewedAt: new Date().toISOString(),
      reviewNote: note,
    };
    await executeCloudWrite(() => saveLibraryRenewalRequest(updatedReq));
    setLibraryRenewalRequests((prev) =>
      prev.map((r) => (r.id === req.id ? updatedReq : r))
    );
    await logAction('Từ chối gia hạn sách', `${req.transactionCode}: ${note}`);
  };

  const handleEditDueDate = async (transactionId: string, newDueDate: string, reason: string) => {
    if (!currentUser) return;
    const res = await executeCloudWrite(() =>
      updateBorrowDueDateWithHistory(
        transactionId,
        newDueDate,
        currentUser.displayName,
        currentUser.role,
        reason,
        false
      )
    );
    if (res.updatedTransaction) {
      setBorrowTransactions((prev) =>
        prev.map((t) => (t.id === transactionId ? res.updatedTransaction! : t))
      );
    }
    if (res.historyEntry) {
      setLibraryTransactionHistory((prev) => mergeRecordsById(prev, [res.historyEntry!]));
    }
    await logAction('Chỉnh sửa hạn trả sách', `${transactionId} → ${newDueDate} (${reason})`);
  };

  // Rules, Emulation & Competitions Handlers
  const handleSaveRuleDocument = async (docItem: RuleDocument) => {
    await executeCloudWrite(() => saveRuleDocument(docItem));
    setRuleDocuments((prev) => mergeById(prev, [docItem]));
    await logAction('Lưu văn bản nội quy', `${docItem.title} (${docItem.status})`);
  };

  const handleSaveRuleVersion = async (ver: RuleVersion) => {
    await executeCloudWrite(() => saveRuleVersion(ver));
    setRuleVersions((prev) => mergeById(prev, [ver]));
    await logAction('Cập nhật phiên bản nội quy', `Phiên bản ${ver.versionNumber} (${ver.status})`);
  };

  const handleSaveRuleCategory = async (cat: RuleCategory) => {
    await executeCloudWrite(() => saveRuleCategory(cat));
    setRuleCategories((prev) => mergeById(prev, [cat]));
    await logAction('Lưu nhóm quy định', cat.name);
  };

  const handleSaveRuleCriterion = async (crit: RuleCriterion) => {
    const existing = ruleCriteria.find((c) => c.id === crit.id);
    const baseRecord = existing && existing.version === crit.version ? existing : undefined;
    await executeCloudWrite(() => saveRuleCriterion(crit, { baseRecord }));
    setRuleCriteria((prev) => mergeById(prev, [crit]));
    await logAction('Lưu tiêu chí nội quy', `${crit.code} - ${crit.name}`);
  };

  const handleDeleteRuleCriterion = async (id: string) => {
    const target = ruleCriteria.find((c) => c.id === id);
    await executeCloudWrite(() => deleteRuleCriterion(id));
    setRuleCriteria((prev) => prev.filter((c) => c.id !== id));
    await logAction('Xóa tiêu chí nội quy', target ? target.name : id);
  };

  const handleSaveEmulationRecord = async (rec: EmulationRecord) => {
    const existing = emulationRecords.find((r) => r.id === rec.id);
    const baseRecord = existing && existing.version === rec.version ? existing : undefined;
    await executeCloudWrite(() => saveEmulationRecord(rec, { baseRecord }));
    setEmulationRecords((prev) => mergeById(prev, [rec]));
    await logAction(
      'Ghi nhận thi đua',
      `${rec.studentName || rec.className || rec.groupName || rec.recordCode} (${rec.status})`
    );
  };

  const handleSaveEmulationAppeal = async (appeal: EmulationAppeal) => {
    await executeCloudWrite(() => saveEmulationAppeal(appeal));
    setEmulationAppeals((prev) => mergeById(prev, [appeal]));
    await logAction('Cập nhật khiếu nại thi đua', `${appeal.studentName} (${appeal.status})`);
  };

  const handleSaveEmulationPeriod = async (period: EmulationPeriod) => {
    await executeCloudWrite(() => saveEmulationPeriod(period));
    setEmulationPeriods((prev) => mergeById(prev, [period]));
    await logAction('Cập nhật kỳ thi đua', `${period.name} (${period.status})`);
  };

  const handleSaveEmulationSnapshot = async (snap: EmulationSnapshot) => {
    await executeCloudWrite(() => saveEmulationSnapshot(snap));
    setEmulationSnapshots((prev) => mergeById(prev, [snap]));
    await logAction('Lưu snapshot xếp hạng', `${snap.periodName} (${snap.entries.length} mục)`);
  };

  const handleSaveTitleConfig = async (cfg: EmulationTitleConfig) => {
    await executeCloudWrite(() => saveEmulationTitleConfig(cfg));
    setEmulationTitleConfigs((prev) => mergeById(prev, [cfg]));
    await logAction('Cấu hình danh hiệu thi đua', cfg.name);
  };

  const handleDeleteTitleConfig = async (id: string) => {
    await executeCloudWrite(() => deleteEmulationTitleConfig(id));
    setEmulationTitleConfigs((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSaveCompetition = async (comp: Competition) => {
    await executeCloudWrite(() => saveCompetition(comp));
    setCompetitions((prev) => mergeById(prev, [comp]));
    await logAction('Lưu cuộc thi phong trào', `${comp.name} (${comp.status})`);
  };

  const handleSaveCompetitionCriterion = async (crit: CompetitionCriterion) => {
    await executeCloudWrite(() => saveCompetitionCriterion(crit));
    setCompetitionCriteria((prev) => mergeById(prev, [crit]));
  };

  const handleDeleteCompetitionCriterion = async (id: string) => {
    await executeCloudWrite(() => deleteCompetitionCriterion(id));
    setCompetitionCriteria((prev) => prev.filter((c) => c.id !== id));
  };

  const handleSaveCompetitionParticipant = async (part: CompetitionParticipant) => {
    await executeCloudWrite(() => saveCompetitionParticipant(part));
    setCompetitionParticipants((prev) => mergeById(prev, [part]));
  };

  const handleSaveCompetitionScore = async (score: CompetitionScore) => {
    await executeCloudWrite(() => saveCompetitionScore(score));
    setCompetitionScores((prev) => mergeById(prev, [score]));
  };

  const handleSaveCompetitionAward = async (award: CompetitionAward) => {
    await executeCloudWrite(() => saveCompetitionAward(award));
    setCompetitionAwards((prev) => mergeById(prev, [award]));
  };

  const handleSaveScoreTransfer = async (transfer: ScoreTransferRecord) => {
    await executeCloudWrite(() => saveScoreTransferRecord(transfer));
    setScoreTransferRecords((prev) => mergeById(prev, [transfer]));
    await logAction('Đồng bộ điểm cuộc thi', `${transfer.competitionName} (${transfer.syncStatus})`);
  };

  const handleSubmitSurveyResponse = async (response: SurveyResponse) => {
    await executeCloudWrite(() => submitSurveyResponse(response));
    setSurveyResponses((prev) => mergeRecordsById(prev, [response], false));
    setSurveys((prev) =>
      prev.map((s) => {
        if (s.id !== response.surveyId) return s;
        const existingIds = s.submittedByIds || [];
        return {
          ...s,
          responsesCount: s.responsesCount + 1,
          submittedByIds:
            response.studentId !== 'ANONYMOUS' && !existingIds.includes(response.studentId)
              ? [...existingIds, response.studentId]
              : existingIds,
        };
      })
    );
  };

  const handleCreateSurvey = async (survey: Survey) => {
    await executeCloudWrite(() => saveSurvey(survey));
    setSurveys((prev) => mergeRecordsById(prev, [survey]));
    await logAction('Tạo khảo sát', survey.title);
  };

  const handleUpdateFeedbackStatus = async (
    reportId: string,
    status: FeedbackReport['status'],
    resolutionNote?: string,
    assignedTo?: string
  ) => {
    await executeCloudWrite(() => updateFeedbackStatus(reportId, status, resolutionNote, assignedTo));
    setFeedbacks((prev) =>
      prev.map((f) =>
        f.id === reportId
          ? {
              ...f,
              status,
              ...(resolutionNote !== undefined ? { resolutionNote } : {}),
              ...(assignedTo !== undefined ? { assignedTo } : {}),
              updatedAt: new Date().toISOString(),
            }
          : f
      )
    );
    await logAction('Xử lý phản ánh', `${reportId} → ${status}`);
  };

  // Cross-app sync 3: Facility feedback -> automatic maintenance request
  const handleSubmitFeedback = async (report: FeedbackReport) => {
    const autoMnt =
      report.category === 'Cơ sở vật chất'
        ? createMaintenanceFromFeedback(report, maintenance.length)
        : null;
    const savedReport: FeedbackReport = autoMnt
      ? { ...report, linkedMaintenanceId: autoMnt.id }
      : report;

    await executeCloudWrite(() => submitFeedbackReport(savedReport));
    setFeedbacks((prev) => mergeRecordsById(prev, [savedReport]));

    if (autoMnt) {
      await executeCloudWrite(() => submitMaintenanceRequest(autoMnt));
      setMaintenance((prev) => mergeRecordsById(prev, [autoMnt]));
      await logAction(
        'Liên kết Phản ánh → Bảo trì',
        `${savedReport.reportCode} → ${autoMnt.requestCode}`
      );
    }
  };

  const handleSubmitCounselingRequest = async (req: CounselingRequest) => {
    await executeCloudWrite(() => submitCounselingRequest(req));
    setCounseling((prev) => mergeRecordsById(prev, [req]));
  };

  const handleUpdateCounselingStatus = async (
    id: string,
    status: CounselingRequest['status'],
    meetingNotes?: string
  ) => {
    await executeCloudWrite(() => updateCounselingStatus(id, status, meetingNotes));
    setCounseling((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              status,
              ...(meetingNotes !== undefined ? { meetingNotes } : {}),
            }
          : c
      )
    );
  };

  const handleSaveLeaveRequest = async (req: StudentLeaveRequest) => {
    if (!currentUser) return;
    await executeCloudWrite(() => saveLeaveRequest(req));
    setLeaveRequests((prev) => mergeRecordsById(prev, [req]));
    await logAction('Đơn xin phép', `${req.studentName} (${req.status})`);
  };

  const handleSaveSupportTicket = async (ticket: SupportTicket) => {
    await executeCloudWrite(() => saveSupportTicket(ticket));
    setSupportTickets((prev) => mergeRecordsById(prev, [ticket]));
    await logAction('Phiếu hỗ trợ', `${ticket.ticketCode} (${ticket.status})`);
  };

  const handleCreateAnnouncement = async (ann: Announcement) => {
    await executeCloudWrite(() => saveAnnouncement(ann));
    setAnnouncements((prev) => mergeRecordsById(prev, [ann]));
    await logAction('Đăng thông báo', ann.title);
  };

  const handleUpdateAnnouncement = async (ann: Announcement) => {
    await executeCloudWrite(() => saveAnnouncement(ann));
    setAnnouncements((prev) => mergeRecordsById(prev, [ann]));
    await logAction('Cập nhật thông báo', `${ann.title} (${ann.status || 'published'})`);
  };

  const handleSaveSchoolEvent = async (evt: SchoolEvent) => {
    await executeCloudWrite(() => saveSchoolEvent(evt));
    setSchoolEvents((prev) => mergeRecordsById(prev, [evt]));
    await logAction('Lưu sự kiện', evt.title);
  };

  const handleSaveRoom = async (room: SchoolRoom) => {
    await executeCloudWrite(() => saveRoom(room));
    setRooms((prev) => mergeRecordsById(prev, [room]));
    await logAction('Cập nhật phòng học', `${room.code} - ${room.name}`);
  };

  const handleDeleteRoom = async (roomId: string) => {
    const target = rooms.find((r) => r.id === roomId);
    await executeCloudWrite(() => deleteRoom(roomId));
    setRooms((prev) => prev.filter((r) => r.id !== roomId));
    await logAction('Xóa phòng học', target ? `${target.code} - ${target.name}` : roomId);
  };

  const handleSaveFacility = async (asset: FacilityAsset) => {
    await executeCloudWrite(() => saveFacility(asset));
    setFacilities((prev) => mergeRecordsById(prev, [asset]));
    await logAction('Cập nhật thiết bị', `${asset.name} (${asset.code})`);
  };

  const handleDeleteFacility = async (assetId: string) => {
    const target = facilities.find((f) => f.id === assetId);
    await executeCloudWrite(() => deleteFacility(assetId));
    setFacilities((prev) => prev.filter((f) => f.id !== assetId));
    await logAction('Xóa thiết bị', target ? `${target.name} (${target.code})` : assetId);
  };

  // Cross-app sync 4: Maintenance status -> Asset condition & Linked Feedback resolution
  const handleSubmitMaintenance = async (req: MaintenanceRequest) => {
    if (!currentUser) return;
    await executeCloudWrite(() => submitMaintenanceRequest(req));
    setMaintenance((prev) => mergeRecordsById(prev, [req]));
    await logAction('Phiếu bảo trì', `${req.assetName} (${req.status})`);

    const updatedAsset = syncAssetAfterMaintenance(facilities, req);
    if (updatedAsset) {
      await handleSaveFacility(updatedAsset);
    }

    if (req.status === 'completed' && req.linkedFeedbackId) {
      const linked = feedbacks.find((f) => f.id === req.linkedFeedbackId);
      if (linked && linked.status !== 'resolved' && linked.status !== 'closed') {
        await handleUpdateFeedbackStatus(
          linked.id,
          'resolved',
          'Đã hoàn tất bảo trì xử lý sự cố cơ sở vật chất.',
          req.assignedStaff || currentUser.displayName
        );
      }
    }
  };

  const handleSaveSystemSettings = async (settings: SystemSettings) => {
    await executeCloudWrite(() =>
      saveSystemSettings(settings, currentUser?.schoolId || DEFAULT_SCHOOL_ID)
    );
    setSystemSettings(settings);
    await logAction('Cập nhật cấu hình hệ thống', settings.schoolName);
  };

  const handleRestoreBackup = async (payload: Record<string, unknown>) => {
    await executeCloudWrite(() => importFullBackupJson(payload));
    await logAction('Khôi phục dữ liệu sao lưu JSON', 'Toàn hệ thống');
  };

  const handleClearAllData = async () => {
    await executeCloudWrite(() => clearAllCloudSystemData());
    resetInMemoryCollections();
  };

  // Live Runtime Validation Context (single source of truth for manual & Excel)
  const validationContext: ValidationDbContext = useMemo(
    () => ({
      dataCatalogs: systemSettings.dataCatalogs,
      classes,
      academicYears,
      rooms,
      teachers,
      students,
      books,
      surveys,
      systemSettings,
      userAccounts,
      staffMembers,
      teachingAssignments,
      timetable,
      academicRecords,
      attendanceRecords: attendance,
      leaveRequests,
      bookCopies,
      borrowTransactions,
      facilities,
      maintenanceRequests: maintenance,
      ruleCategories,
      ruleCriteria,
      emulationRecords,
      announcements,
    }),
    [
      academicRecords,
      academicYears,
      announcements,
      attendance,
      bookCopies,
      books,
      borrowTransactions,
      classes,
      emulationRecords,
      facilities,
      leaveRequests,
      maintenance,
      rooms,
      ruleCategories,
      ruleCriteria,
      staffMembers,
      students,
      surveys,
      systemSettings,
      teachers,
      teachingAssignments,
      timetable,
      userAccounts,
    ]
  );

  const mergeById = mergeRecordsById;

  const handleLogExport = async (record: ExportHistoryRecord) => {
    await appendExportHistory(record);
    setExportHistory((prev) => mergeRecordsById(prev, [record]).slice(0, 300));
    await logAction(
      `Export ${record.format.toUpperCase()} (${record.moduleTitle})`,
      `${record.rowCount} dòng · ${record.columnCount} cột (${record.fileName})`
    );
  };

  const handleUnifiedImportCommit = async (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => {
    switch (moduleKey) {
      case 'users':
      case 'role_assignments': {
        const items = entitiesToSave as unknown as UserProfile[];
        await executeCloudWrite(async () => {
          await upsertBatchWithSync('users', 'users', items);
          for (const item of items) {
            if (item.email && !item.id.match(/^[a-zA-Z0-9]{20,36}$/)) {
              await saveUserInviteFromProfile(item);
            }
          }
        });
        setUserAccounts((prev) => mergeById(prev, items));
        break;
      }
      case 'students': {
        const items = entitiesToSave as unknown as Student[];
        await upsertBatchWithSync('studentProfiles', 'students', items);
        setStudents((prev) => mergeById(prev, items));
        break;
      }
      case 'teachers': {
        const items = entitiesToSave as unknown as Teacher[];
        await upsertBatchWithSync('teacherProfiles', 'teachers', items, false);
        setTeachers((prev) => mergeById(prev, items, false));
        break;
      }
      case 'staff': {
        const items = entitiesToSave as unknown as StaffMember[];
        await upsertBatchWithSync('staffMembers', 'staff_members', items);
        setStaffMembers((prev) => mergeById(prev, items));
        break;
      }
      case 'classes': {
        const items = entitiesToSave as unknown as SchoolClass[];
        await upsertBatchWithSync('classes', 'classes', items, false);
        setClasses((prev) => mergeById(prev, items, false));
        break;
      }
      case 'academic_years': {
        const items = entitiesToSave as unknown as AcademicYearConfig[];
        await upsertBatchWithSync('academicYears', 'academic_years', items);
        setAcademicYears((prev) => mergeById(prev, items));
        break;
      }
      case 'class_placements': {
        const placements = entitiesToSave as unknown as ClassPlacement[];
        await upsertBatchWithSync('classPlacements', 'class_placements', placements);
        setClassPlacements((prev) => mergeById(prev, placements));
        // Sync active student class placement for current academic year without overwriting historical records
        const updatedStudents: Student[] = [];
        for (const plc of placements) {
          if (!systemSettings.academicYear || plc.academicYear === systemSettings.academicYear) {
            const stu = students.find(
              (s) => s.studentCode.toUpperCase() === plc.studentCode.toUpperCase()
            );
            if (stu) {
              updatedStudents.push({
                ...stu,
                classId: plc.classId,
                className: plc.className,
                grade: plc.grade,
                academicYear: plc.academicYear,
              });
            }
          }
        }
        if (updatedStudents.length > 0) {
          await upsertBatchWithSync('studentProfiles', 'students', updatedStudents);
          setStudents((prev) => mergeById(prev, updatedStudents));
        }
        break;
      }
      case 'teaching_assignments': {
        const items = entitiesToSave as unknown as TeachingAssignment[];
        await upsertBatchWithSync('teachingAssignments', 'teaching_assignments', items);
        setTeachingAssignments((prev) => mergeById(prev, items));
        break;
      }
      case 'timetable': {
        const items = entitiesToSave as unknown as TimetableEntry[];
        await upsertBatchWithSync('timetable', 'timetable', items, false);
        setTimetable((prev) => mergeById(prev, items, false));
        break;
      }
      case 'grades': {
        const items = entitiesToSave as unknown as AcademicRecord[];
        await upsertBatchWithSync('academicRecords', 'academic', items);
        setAcademicRecords((prev) => mergeById(prev, items));
        break;
      }
      case 'attendance': {
        const items = entitiesToSave as unknown as AttendanceRecord[];
        await saveAttendanceRecords(items);
        setAttendance((prev) => mergeById(prev, items));
        break;
      }
      case 'assignments': {
        const items = entitiesToSave as unknown as Assignment[];
        await upsertBatchWithSync('assignments', 'assignments', items);
        setAssignments((prev) => mergeById(prev, items));
        break;
      }
      case 'materials': {
        const items = entitiesToSave as unknown as LearningMaterial[];
        await upsertBatchWithSync('learningMaterials', 'learning_materials', items);
        setLearningMaterials((prev) => mergeById(prev, items));
        break;
      }
      case 'books': {
        const newBooks = entitiesToSave as unknown as Book[];
        await upsertBatchWithSync('books', 'books', newBooks);
        const generatedCopies: BookCopy[] = [];
        const workingCopies = [...bookCopies];
        for (const b of newBooks) {
          const created = generateBookCopiesForBook(b, workingCopies);
          for (const c of created) {
            workingCopies.push(c);
            generatedCopies.push(c);
          }
        }
        if (generatedCopies.length > 0) {
          await upsertBatchWithSync('bookCopies', 'book_copies', generatedCopies);
          setBookCopies((prev) => mergeById(prev, generatedCopies));
        }
        setBooks((prev) => mergeById(prev, newBooks));
        break;
      }
      case 'book_copies': {
        const items = entitiesToSave as unknown as BookCopy[];
        await upsertBatchWithSync('bookCopies', 'book_copies', items);
        setBookCopies((prev) => mergeById(prev, items));
        break;
      }
      case 'inventory_audits': {
        const items = entitiesToSave as unknown as InventoryAudit[];
        await upsertBatchWithSync('inventoryAudits', 'inventory_audits', items);
        setInventoryAudits((prev) => mergeById(prev, items));
        break;
      }
      case 'borrow_migration': {
        const items = entitiesToSave as unknown as BorrowTransaction[];
        await upsertBatchWithSync('borrowTransactions', 'borrow_transactions', items);
        setBorrowTransactions((prev) => mergeById(prev, items));
        break;
      }
      case 'survey_questions': {
        const items = entitiesToSave as unknown as Survey[];
        await upsertBatchWithSync('surveys', 'surveys', items);
        setSurveys((prev) => mergeById(prev, items));
        break;
      }
      case 'leave_migration': {
        const items = entitiesToSave as unknown as StudentLeaveRequest[];
        await upsertBatchWithSync('leaveRequests', 'leave_requests', items);
        setLeaveRequests((prev) => mergeById(prev, items));
        break;
      }
      case 'feedback_migration': {
        const items = entitiesToSave as unknown as FeedbackReport[];
        await upsertBatchWithSync('feedbackReports', 'feedbacks', items);
        setFeedbacks((prev) => mergeById(prev, items));
        break;
      }
      case 'announcements': {
        const items = entitiesToSave as unknown as Announcement[];
        await upsertBatchWithSync('announcements', 'announcements', items);
        setAnnouncements((prev) => mergeById(prev, items));
        break;
      }
      case 'events': {
        const items = entitiesToSave as unknown as SchoolEvent[];
        await upsertBatchWithSync('schoolEvents', 'school_events', items);
        setSchoolEvents((prev) => mergeById(prev, items));
        break;
      }
      case 'rooms': {
        const items = entitiesToSave as unknown as SchoolRoom[];
        await upsertBatchWithSync('rooms', 'rooms', items);
        setRooms((prev) => mergeById(prev, items));
        break;
      }
      case 'facilities': {
        const items = entitiesToSave as unknown as FacilityAsset[];
        await upsertBatchWithSync('facilities', 'facilities', items, false);
        setFacilities((prev) => mergeById(prev, items, false));
        break;
      }
      case 'maintenance_plans': {
        const items = entitiesToSave as unknown as MaintenanceRequest[];
        await upsertBatchWithSync('maintenanceRequests', 'maintenance', items);
        setMaintenance((prev) => mergeById(prev, items));
        break;
      }
      case 'rule_criteria': {
        const items = entitiesToSave as unknown as RuleCriterion[];
        await upsertBatchWithSync('ruleCriteria', 'rule_criteria', items);
        setRuleCriteria((prev) => mergeById(prev, items));
        break;
      }
      case 'emulation_records': {
        const items = entitiesToSave as unknown as EmulationRecord[];
        await upsertBatchWithSync('emulationRecords', 'emulation_records', items);
        setEmulationRecords((prev) => mergeById(prev, items));
        break;
      }
      case 'external_datasets': {
        const nowIso = new Date().toISOString();
        const normalized = entitiesToSave.map((item, idx) => ({
          ...(item as Record<string, unknown>),
          id: String(item.id || `EXT-${Date.now()}-${idx}`),
          createdAt: String(item.createdAt || nowIso),
        })) as unknown as ExternalDatasetRecord[];
        await executeCloudWrite(() => saveExternalDatasetsBatch(normalized));
        setExternalDatasets((prev) => mergeById(prev, normalized));
        break;
      }
    }

    await appendImportHistory(historyRecord);
    setImportHistory((prev) => mergeRecordsById(prev, [historyRecord]).slice(0, 300));
    await logAction(
      `Import Excel (${historyRecord.moduleTitle})`,
      `${historyRecord.fileName}: +${historyRecord.createdCount} mới, ↻${historyRecord.updatedCount} cập nhật, ✕${historyRecord.failedCount} lỗi`
    );
  };

  // Derived Notification Center Feed
  const notifications = useMemo<NotificationItem[]>(() => {
    const items: NotificationItem[] = [];

    announcements
      .filter((ann) => !ann.status || ann.status === 'published')
      .slice(0, 6)
      .forEach((ann) => {
        const id = `noti-ann-${ann.id}`;
        items.push({
          id,
          title: ann.title,
          message: ann.content,
          time: ann.publishedAt,
          read: readNotificationIds.includes(id),
          appId: 'communication',
          tabId: 'announcements',
          priority: ann.priority,
        });
      });

    borrowTransactions
      .filter(
        (t) =>
          t.status === 'overdue' ||
          (t.status === 'borrowed' && checkIsOverdue(t.dueDate).isOverdue)
      )
      .slice(0, 4)
      .forEach((t) => {
        const id = `noti-lib-${t.id}`;
        items.push({
          id,
          title: `Quá hạn trả sách: ${t.bookTitle}`,
          message: `${t.studentName} (${t.studentCode}) · Hạn ${t.dueDate}`,
          time: t.dueDate,
          read: readNotificationIds.includes(id),
          appId: 'library',
          tabId: 'circulation',
          priority: 'important',
        });
      });

    maintenance
      .filter((m) => m.status !== 'completed')
      .slice(0, 4)
      .forEach((m) => {
        const id = `noti-mnt-${m.id}`;
        items.push({
          id,
          title: `Bảo trì: ${m.assetName}`,
          message: `${m.roomLocation} · ${m.issueDescription}`,
          time: m.reportedAt,
          read: readNotificationIds.includes(id),
          appId: 'facilities',
          tabId: 'maintenance',
          priority: m.priority === 'urgent' || m.priority === 'high' ? 'urgent' : 'normal',
        });
      });

    return dedupById(items);
  }, [announcements, borrowTransactions, maintenance, readNotificationIds]);

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  // Render active Super App inside its floating/maximized AppWindow
  const renderAppContent = useCallback(
    (appId: SuperAppId, activeTab: string) => {
      if (!currentUser) return null;
      switch (appId) {
        case 'admin':
          return (
            <AdministrationApp
              activeTab={activeTab}
              currentUser={currentUser}
              userAccounts={userAccounts}
              userInvites={userInvites}
              auditLogs={auditLogs}
              importHistory={importHistory}
              exportHistory={exportHistory}
              validationContext={validationContext}
              backupDataSnapshot={cloudSnapshotByCollection}
              legacyMigrationCount={legacyMigrationSummary?.totalNewRecords || 0}
              systemSettings={systemSettings}
              darkMode={darkMode}
              stats={{
                studentsCount: students.length,
                teachersCount: teachers.length,
                booksCount: books.length,
                openMaintenanceCount: maintenance.filter((m) => m.status !== 'completed').length,
              }}
              onSelectTab={(tab) => setWindowTab('admin', tab)}
              onSaveUserAccount={handleSaveUserAccount}
              onDeleteUserAccount={handleDeleteUserAccount}
              onDeleteUserInvite={handleDeleteUserInvite}
              onSaveSettings={handleSaveSystemSettings}
              onToggleDarkMode={() => setDarkMode((prev) => !prev)}
              onClearAllData={handleClearAllData}
              onRestoreBackup={handleRestoreBackup}
              onOpenLegacyMigration={handleOpenLegacyMigration}
              onOpenTargetApp={handleOpenApp}
              onUnifiedImportCommit={handleUnifiedImportCommit}
              onLogExport={handleLogExport}
              onAppendAuditLog={logAction}
            />
          );
        case 'school':
          return (
            <SchoolManagementApp
              activeTab={activeTab}
              currentUser={currentUser}
              customPermissions={customPermissions}
              students={students}
              teachers={teachers}
              staffMembers={staffMembers}
              classes={classes}
              rooms={rooms}
              academicYears={academicYears}
              classPlacements={classPlacements}
              teachingAssignments={teachingAssignments}
              validationContext={validationContext}
              borrowTransactions={borrowTransactions}
              academicRecords={academicRecords}
              attendanceRecords={attendance}
              schoolEvents={schoolEvents}
              leaveRequests={leaveRequests}
              systemSettings={systemSettings}
              ruleDocuments={ruleDocuments}
              ruleVersions={ruleVersions}
              ruleCategories={ruleCategories}
              ruleCriteria={ruleCriteria}
              emulationRecords={emulationRecords}
              emulationAppeals={emulationAppeals}
              emulationPeriods={emulationPeriods}
              emulationSnapshots={emulationSnapshots}
              emulationTitleConfigs={emulationTitleConfigs}
              competitions={competitions}
              competitionCriteria={competitionCriteria}
              competitionParticipants={competitionParticipants}
              competitionScores={competitionScores}
              competitionAwards={competitionAwards}
              scoreTransfers={scoreTransferRecords}
              onSelectTab={(tab) => setWindowTab('school', tab)}
              onSaveSettings={handleSaveSystemSettings}
              onAddStudent={handleAddStudent}
              onUpdateStudent={handleUpdateStudent}
              onDeleteStudent={handleDeleteStudent}
              onAddTeacher={handleAddTeacher}
              onUpdateTeacher={handleUpdateTeacher}
              onDeleteTeacher={handleDeleteTeacher}
              onSaveStaffMember={handleSaveStaffMember}
              onDeleteStaffMember={handleDeleteStaffMember}
              onAddClass={handleAddClass}
              onUpdateClass={handleUpdateClass}
              onDeleteClass={handleDeleteClass}
              onSaveAcademicYear={handleSaveAcademicYear}
              onSaveRuleDocument={handleSaveRuleDocument}
              onSaveRuleVersion={handleSaveRuleVersion}
              onSaveRuleCategory={handleSaveRuleCategory}
              onSaveRuleCriterion={handleSaveRuleCriterion}
              onDeleteRuleCriterion={handleDeleteRuleCriterion}
              onSaveEmulationRecord={handleSaveEmulationRecord}
              onSaveEmulationAppeal={handleSaveEmulationAppeal}
              onSaveEmulationPeriod={handleSaveEmulationPeriod}
              onSaveEmulationSnapshot={handleSaveEmulationSnapshot}
              onSaveTitleConfig={handleSaveTitleConfig}
              onDeleteTitleConfig={handleDeleteTitleConfig}
              onSaveCompetition={handleSaveCompetition}
              onSaveCompetitionCriterion={handleSaveCompetitionCriterion}
              onDeleteCompetitionCriterion={handleDeleteCompetitionCriterion}
              onSaveCompetitionParticipant={handleSaveCompetitionParticipant}
              onSaveCompetitionScore={handleSaveCompetitionScore}
              onSaveCompetitionAward={handleSaveCompetitionAward}
              onSaveScoreTransfer={handleSaveScoreTransfer}
              onUnifiedImportCommit={handleUnifiedImportCommit}
              onLogExport={handleLogExport}
            />
          );
        case 'learning':
          return (
            <LearningApp
              activeTab={activeTab}
              currentUser={currentUser}
              customPermissions={customPermissions}
              validationContext={validationContext}
              students={students}
              teachers={teachers}
              classes={classes}
              rooms={rooms}
              timetable={timetable}
              schoolEvents={schoolEvents}
              onSelectTab={(tab) => setWindowTab('learning', tab)}
              onAddTimetableEntry={handleAddTimetableEntry}
              onUpdateTimetableEntry={handleUpdateTimetableEntry}
              onDeleteTimetableEntry={handleDeleteTimetableEntry}
              onSaveSchoolEvent={handleSaveSchoolEvent}
              onUnifiedImportCommit={handleUnifiedImportCommit}
              onLogExport={handleLogExport}
            />
          );
        case 'library':
          return (
            <LibraryApp
              activeTab={activeTab}
              currentUser={currentUser}
              customPermissions={customPermissions}
              validationContext={validationContext}
              books={books}
              bookCopies={bookCopies}
              transactions={borrowTransactions}
              reservations={bookReservations}
              renewalRequests={libraryRenewalRequests}
              transactionHistory={libraryTransactionHistory}
              inventoryAudits={inventoryAudits}
              students={students}
              teachers={teachers}
              staffMembers={staffMembers}
              systemSettings={systemSettings}
              onSelectTab={(tab) => setWindowTab('library', tab)}
              onSaveSettings={handleSaveSystemSettings}
              onBorrowBook={handleBorrowBook}
              onReturnBook={handleReturnBook}
              onRenewBook={handleRenewBook}
              onSubmitRenewalRequest={handleSubmitRenewalRequest}
              onApproveRenewalRequest={handleApproveRenewalRequest}
              onRejectRenewalRequest={handleRejectRenewalRequest}
              onEditDueDate={handleEditDueDate}
              onAddBook={handleAddBook}
              onDeleteBook={handleDeleteBook}
              onImportBooks={handleImportBooks}
              onSaveBookCopy={handleSaveBookCopy}
              onSaveReservation={handleSaveReservation}
              onSaveInventoryAudit={handleSaveInventoryAudit}
              onUnifiedImportCommit={handleUnifiedImportCommit}
              onLogExport={handleLogExport}
            />
          );
        case 'services':
          return (
            <StudentServicesApp
              activeTab={activeTab}
              currentUser={currentUser}
              customPermissions={customPermissions}
              validationContext={validationContext}
              teachers={teachers}
              surveys={surveys}
              surveyResponses={surveyResponses}
              counselingRequests={counseling}
              leaveRequests={leaveRequests}
              onSelectTab={(tab) => setWindowTab('services', tab)}
              onSubmitSurveyResponse={handleSubmitSurveyResponse}
              onCreateSurvey={handleCreateSurvey}
              onSubmitCounseling={handleSubmitCounselingRequest}
              onUpdateCounselingStatus={handleUpdateCounselingStatus}
              onSaveLeaveRequest={handleSaveLeaveRequest}
              onUnifiedImportCommit={handleUnifiedImportCommit}
              onLogExport={handleLogExport}
            />
          );
        case 'communication':
          return (
            <CommunicationApp
              activeTab={activeTab}
              currentUser={currentUser}
              customPermissions={customPermissions}
              validationContext={validationContext}
              announcements={announcements}
              events={schoolEvents}
              onSelectTab={(tab) => setWindowTab('communication', tab)}
              onCreateAnnouncement={handleCreateAnnouncement}
              onUpdateAnnouncement={handleUpdateAnnouncement}
              onSaveEvent={handleSaveSchoolEvent}
              onUnifiedImportCommit={handleUnifiedImportCommit}
              onLogExport={handleLogExport}
            />
          );
        case 'facilities':
          return (
            <FacilitiesApp
              activeTab={activeTab}
              currentUser={currentUser}
              customPermissions={customPermissions}
              validationContext={validationContext}
              classes={classes}
              rooms={rooms}
              facilities={facilities}
              maintenanceRequests={maintenance}
              onSelectTab={(tab) => setWindowTab('facilities', tab)}
              onSaveRoom={handleSaveRoom}
              onDeleteRoom={handleDeleteRoom}
              onSaveFacility={handleSaveFacility}
              onDeleteFacility={handleDeleteFacility}
              onSubmitMaintenance={handleSubmitMaintenance}
              onUnifiedImportCommit={handleUnifiedImportCommit}
              onLogExport={handleLogExport}
            />
          );
        case 'analytics':
          return (
            <AnalyticsAIApp
              activeTab={activeTab}
              currentUser={currentUser}
              customPermissions={customPermissions}
              validationContext={validationContext}
              importHistory={importHistory}
              exportHistory={exportHistory}
              externalDatasets={externalDatasets}
              students={students}
              teachers={teachers}
              classes={classes}
              books={books}
              borrowTransactions={borrowTransactions}
              academicRecords={academicRecords}
              feedbacks={feedbacks}
              announcements={announcements}
              facilities={facilities}
              maintenance={maintenance}
              onSelectTab={(tab) => setWindowTab('analytics', tab)}
              onImportStudents={handleImportStudents}
              onImportBooks={handleImportBooks}
              onImportTeachers={handleImportTeachers}
              onOpenTargetApp={handleOpenApp}
              onUnifiedImportCommit={handleUnifiedImportCommit}
              onLogExport={handleLogExport}
            />
          );
      }
    },
    [
      academicRecords,
      academicYears,
      announcements,
      assignmentSubmissions,
      assignments,
      attendance,
      auditLogs,
      bookCopies,
      bookReservations,
      books,
      borrowTransactions,
      classPlacements,
      classes,
      cloudSnapshotByCollection,
      competitionAwards,
      competitionCriteria,
      competitionParticipants,
      competitionScores,
      competitions,
      counseling,
      currentUser,
      customPermissions,
      darkMode,
      emulationAppeals,
      emulationPeriods,
      emulationRecords,
      emulationSnapshots,
      emulationTitleConfigs,
      exportHistory,
      externalDatasets,
      facilities,
      feedbacks,
      handleOpenApp,
      importHistory,
      inventoryAudits,
      learningMaterials,
      leaveRequests,
      legacyMigrationSummary,
      libraryRenewalRequests,
      libraryTransactionHistory,
      maintenance,
      rooms,
      ruleCategories,
      ruleCriteria,
      ruleDocuments,
      ruleVersions,
      schoolEvents,
      scoreTransferRecords,
      setWindowTab,
      staffMembers,
      students,
      supportTickets,
      surveyResponses,
      surveys,
      systemSettings,
      teachers,
      teachingAssignments,
      timetable,
      userAccounts,
      userInvites,
      validationContext,
    ]
  );

  const handleDeleteModuleRecord = useCallback(
    async (moduleKey: ImportModuleKey, recordId: string) => {
      switch (moduleKey) {
        case 'students':
          await handleDeleteStudent(recordId);
          break;
        case 'teachers':
          await handleDeleteTeacher(recordId);
          break;
        case 'staff':
          await handleDeleteStaffMember(recordId);
          break;
        case 'classes':
          await handleDeleteClass(recordId);
          break;
        case 'timetable':
          await handleDeleteTimetableEntry(recordId);
          break;
        case 'books':
          await handleDeleteBook(recordId);
          break;
        case 'rooms':
          await handleDeleteRoom(recordId);
          break;
        case 'facilities':
          await handleDeleteFacility(recordId);
          break;
        case 'rule_criteria':
          await handleDeleteRuleCriterion(recordId);
          break;
        case 'assignments':
          await handleDeleteAssignment(recordId);
          break;
        case 'materials':
          await handleDeleteMaterial(recordId);
          break;
        case 'users':
          await handleDeleteUserAccount(recordId);
          break;
        default:
          await logAction(`Bỏ qua xóa ngoài phạm vi (${moduleKey})`, recordId);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [students, teachers, staffMembers, classes, timetable, books, rooms, facilities, ruleCriteria, assignments, learningMaterials, userAccounts]
  );

  if (isAuthLoadingPhase(authPhase)) {
    const phaseInfo = AUTH_PHASE_LABELS[authPhase];
    return (
      <div
        data-testid="auth-loading-screen"
        data-auth-phase={authPhase}
        className="h-[100dvh] w-screen flex flex-col items-center justify-center bg-gradient-to-br from-sky-50 via-indigo-50 to-teal-50 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 text-slate-700 dark:text-slate-200 p-6"
      >
        <div className="max-w-md w-full rounded-3xl bg-white/85 dark:bg-slate-900/85 backdrop-blur-xl border border-white/60 dark:border-slate-700/60 shadow-2xl px-8 py-6 flex flex-col items-center text-center gap-3">
          <div className="w-10 h-10 rounded-full border-3 border-sky-500 border-t-transparent animate-spin" />
          <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{phaseInfo.title}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{phaseInfo.detail}</p>
          {firebaseUser?.email && (
            <p className="text-[11px] font-medium text-sky-700 dark:text-sky-300 bg-sky-500/10 px-3 py-1 rounded-full">
              {firebaseUser.email}
            </p>
          )}
          {(showLoadingEscape || Boolean(firebaseUser)) && (
            <button
              type="button"
              data-testid="loading-escape-signout-btn"
              onClick={() => void handleForceSignOut()}
              className="mt-2 inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Đăng xuất / Đổi tài khoản</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  if (
    !firebaseUser ||
    !currentUser ||
    authPhase === 'signed_out' ||
    authPhase === 'access_denied' ||
    authPhase === 'error'
  ) {
    return (
      <LoginScreen
        authError={authError}
        lockedAccountEmail={lockedAccountEmail}
        signedInEmail={firebaseUser?.email || null}
        isRetrying={isAuthLoadingPhase(authPhase)}
        onRetrySignedInSession={firebaseUser ? handleRetryAuthSession : undefined}
        onSignOutAndSwitch={handleForceSignOut}
      />
    );
  }

  return (
    <AppErrorBoundary userEmail={currentUser.email} onSignOut={handleForceSignOut}>
    <div className="h-[100dvh] w-screen overflow-hidden text-slate-800 dark:text-slate-100 relative selection:bg-sky-500 selection:text-white flex flex-col font-sans">
      {/* Fluent Aurora Wallpaper */}
      <div className="aurora-mesh" />

      <OfflineSyncBanner isOnline={isOnline} syncError={syncError} />

      {/* Main Desktop + Multi-Window Workspace */}
      <main
        ref={workspaceRef}
        className="flex-1 relative overflow-hidden z-10 min-h-0"
        onClick={() => {
          setIsStartMenuOpen(false);
          setIsNotificationOpen(false);
          setIsQuickSettingsOpen(false);
        }}
      >
        {/* Base Desktop Shell (8 Super Apps + Role Widgets) */}
        <DesktopScreen
          currentUser={currentUser}
          windows={windows}
          activeWindowId={activeWindowId}
          students={students}
          teachers={teachers}
          classes={classes}
          books={books}
          borrowTransactions={borrowTransactions}
          announcements={announcements}
          events={schoolEvents}
          surveys={surveys}
          facilities={facilities}
          maintenance={maintenance}
          timetable={timetable}
          compactMode={systemSettings.compactMode}
          customPermissions={customPermissions}
          onOpenApp={handleOpenApp}
          onContextMenuApp={(e, appId) => {
            closeAllOverlays();
            setContextMenu({ isOpen: true, x: e.clientX, y: e.clientY, appId });
          }}
        />

        {/* Floating Multi-Window Layer */}
        <WindowManager
          windows={windows}
          activeWindowId={activeWindowId}
          snapPreview={snapPreview}
          onFocusWindow={focusWindow}
          onCloseWindow={closeWindow}
          onMinimizeWindow={minimizeWindow}
          onToggleMaximize={toggleMaximize}
          onSnapWindow={snapWindow}
          onUpdateBounds={updateWindowBounds}
          onCheckSnapPreview={checkSnapPreview}
          onClearSnapPreview={clearSnapPreview}
          renderAppContent={renderAppContent}
        />

        {/* RBAC Access Denied Toast (In-app glass alert, never window.alert) */}
        {rbacAlert && (
          <div
            role="alert"
            data-testid="rbac-alert-toast"
            className="fixed top-4 right-4 z-[99995] max-w-sm rounded-2xl win11-acrylic border border-rose-300/70 dark:border-rose-700/60 px-4 py-3 flex items-start gap-3 shadow-xl"
          >
            <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                Thông báo hệ thống
              </p>
              <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-0.5 leading-relaxed">
                {rbacAlert}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setRbacAlert(null)}
              aria-label="Đóng cảnh báo"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </main>

      {/* Persistent Windows 11 Taskbar */}
      <Taskbar
        currentUser={currentUser}
        windows={windows}
        activeWindowId={activeWindowId}
        pinnedApps={pinnedApps}
        unreadNotifications={unreadNotifications}
        syncState={syncState}
        isStartMenuOpen={isStartMenuOpen}
        isNotificationOpen={isNotificationOpen}
        isQuickSettingsOpen={isQuickSettingsOpen}
        onToggleStartMenu={() => {
          setIsNotificationOpen(false);
          setIsQuickSettingsOpen(false);
          setIsStartMenuOpen((prev) => !prev);
        }}
        onOpenSearch={() => {
          closeAllOverlays();
          setIsSearchOpen(true);
        }}
        onOpenTaskView={() => {
          closeAllOverlays();
          setIsTaskViewOpen(true);
        }}
        onTaskbarAppClick={handleTaskbarAppClick}
        onFocusWindow={focusWindow}
        onMinimizeWindow={minimizeWindow}
        onCloseWindow={closeWindow}
        onToggleNotifications={() => {
          setIsStartMenuOpen(false);
          setIsQuickSettingsOpen(false);
          setIsNotificationOpen((prev) => !prev);
        }}
        onToggleQuickSettings={() => {
          setIsStartMenuOpen(false);
          setIsNotificationOpen(false);
          setIsQuickSettingsOpen((prev) => !prev);
        }}
        onShowDesktop={handleShowDesktop}
      />

      {/* Start Menu Overlay */}
      <StartMenu
        currentUser={currentUser}
        customPermissions={customPermissions}
        isOpen={isStartMenuOpen}
        onClose={() => setIsStartMenuOpen(false)}
        onOpenApp={handleOpenApp}
        onBeforeAccountChange={resetWorkspaceSession}
      />

      {/* Notification Center Overlay */}
      <NotificationCenter
        isOpen={isNotificationOpen}
        notifications={notifications}
        onClose={() => setIsNotificationOpen(false)}
        onMarkRead={(id) =>
          setReadNotificationIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
        }
        onMarkAllRead={() => setReadNotificationIds(notifications.map((n) => n.id))}
        onOpenTarget={handleOpenApp}
      />

      {/* Quick Settings Popover */}
      <QuickSettingsPopover
        isOpen={isQuickSettingsOpen}
        darkMode={darkMode}
        compactMode={systemSettings.compactMode}
        currentUser={currentUser}
        onToggleDarkMode={() => setDarkMode((prev) => !prev)}
        onToggleCompactMode={() => {
          const next = { ...systemSettings, compactMode: !systemSettings.compactMode };
          void handleSaveSystemSettings(next);
        }}
        onOpenStartRoles={() => {
          setIsQuickSettingsOpen(false);
          setIsStartMenuOpen(true);
        }}
        onOpenSystemSettings={handleOpenApp}
        onClose={() => setIsQuickSettingsOpen(false)}
      />

      {/* Desktop Right-Click Context Menu */}
      <DesktopContextMenu
        state={contextMenu}
        isPinned={contextMenu.appId ? pinnedApps.includes(contextMenu.appId) : false}
        isRunning={contextMenu.appId ? Boolean(windows[contextMenu.appId]?.isOpen) : false}
        onClose={() => setContextMenu((prev) => ({ ...prev, isOpen: false }))}
        onOpenApp={(appId) => handleOpenApp(appId)}
        onTogglePin={handleTogglePin}
        onCloseApp={closeWindow}
        onMinimizeApp={minimizeWindow}
      />

      {/* Task View Switcher */}
      <TaskViewModal
        isOpen={isTaskViewOpen}
        windows={windows}
        onClose={() => setIsTaskViewOpen(false)}
        onFocusWindow={focusWindow}
        onCloseWindow={closeWindow}
      />

      {/* Global Search (Ctrl+K) */}
      <GlobalSearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
        currentUser={currentUser}
        customPermissions={customPermissions}
        students={students}
        teachers={teachers}
        books={books}
        announcements={announcements}
        onNavigate={handleOpenApp}
      />

      {/* Optimistic Concurrency Conflict Resolution Modal */}
      <SyncConflictModal
        conflict={pendingConflict}
        onResolve={handleResolveConflict}
        onDismiss={() => {
          setPendingConflict(null);
          setSyncState(isOnline ? 'synced' : 'offline');
        }}
      />

      {/* Legacy localStorage to Cloud Migration Modal */}
      <LegacyMigrationModal
        isOpen={isMigrationModalOpen}
        summary={legacyMigrationSummary}
        isMigrating={isMigrating}
        onConfirmMigrate={handleConfirmLegacyMigration}
        onPurgeOnly={handlePurgeLegacyOnly}
        onClose={() => setIsMigrationModalOpen(false)}
      />
    </div>
    </AppErrorBoundary>
  );
}
