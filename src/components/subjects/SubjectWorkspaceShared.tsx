import React, { useRef, useState } from 'react';
import {
  Atom,
  BookOpen,
  Bot,
  Calculator,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ClipboardCheck,
  Compass,
  Download,
  ExternalLink,
  Feather,
  FileSpreadsheet,
  FlaskConical,
  GraduationCap,
  ImagePlus,
  Landmark,
  Languages,
  Layers,
  Plus,
  Send,
  Sparkles,
  Trash2,
  Upload,
  X,
} from '../icons/UiIcons';
import type {
  AcademicRecord,
  Assignment,
  AssignmentSubmission,
  LearningMaterial,
  PresetClassConfig,
  SchoolClass,
  SuperAppId,
  UserProfile,
} from '../../types';
import {
  GAUTH_URL,
  getSubjectById,
  type SubjectDefinition,
  type SubjectId,
} from '../../utils/subjectRegistry';
import {
  SUBJECT_AI_PROFILES,
  getSubjectAiPresets,
  type SubjectAiChatTurn,
  type SubjectAiMode,
} from '../../utils/subjectAi';
import type {
  SubjectSchoolContext,
  SubjectStudyProgress,
} from '../../utils/subjects/subjectWorkspaceEngine';
import { FormattedAiText } from '../common/FormattedAiText';
import { Modal } from '../common/Modal';

export const SUBJECT_ICON_MAP = {
  Languages,
  Calculator,
  Atom,
  FlaskConical,
  Feather,
  Landmark,
  Compass,
} as const;

export interface GeneratedAiQuizItem {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topic: string;
}

export interface GeneratedAiCardItem {
  front: string;
  back: string;
  example: string;
  tip: string;
}

export interface SubjectHostWorkspaceProps {
  subject: SubjectDefinition;
  currentUser: UserProfile;
  classes: SchoolClass[];
  presetClasses: PresetClassConfig[];
  schoolContext: SubjectSchoolContext;
  progress: SubjectStudyProgress;
  onToggleMastered: (itemId: string) => void;
  onRecordPracticeResult: (score: number, total: number, label: string) => void;
  onSaveStudyNote: (itemId: string, note: string) => void;
  onSaveAssignment?: (assignment: Assignment) => Promise<void> | void;
  onSaveSubmission?: (submission: AssignmentSubmission) => Promise<void> | void;
  onSaveMaterial?: (material: LearningMaterial) => Promise<void> | void;
  onSaveAcademicRecord?: (record: AcademicRecord) => Promise<void> | void;
  onSyncSubjectClasses?: (subjectId: SubjectId, classNames: string[]) => Promise<void> | void;
  onOpenPresetClasses?: () => void;
  onLogExport?: (entry: {
    module: string;
    format: 'excel' | 'pdf';
    fileName: string;
    recordCount: number;
  }) => Promise<void> | void;
  onOpenTargetApp?: (appId: SuperAppId, tabId?: string) => void;
  onBackToOverview?: () => void;
  initialSubTab?: string;
  subTabRequestKey?: number;
}

interface SubjectWorkspaceShellProps extends SubjectHostWorkspaceProps {
  activeSubTab: string;
  onChangeSubTab: (tabId: string) => void;
  liveContextSummary: string;
  excelModuleKey: string;
  excelExportRecords?: Array<Record<string, unknown>>;
  onImportExcelRows?: (rows: Array<Record<string, unknown>>, result: Record<string, unknown>) => void;
  onInjectGeneratedQuiz?: (questions: GeneratedAiQuizItem[]) => void;
  onInjectGeneratedCards?: (cards: GeneratedAiCardItem[]) => void;
  children: React.ReactNode;
}

const MODE_LABELS: Array<{ value: SubjectAiMode; label: string }> = [
  { value: 'tutor_chat', label: 'Hỏi đáp gia sư' },
  { value: 'solve_step_by_step', label: 'Giải bài từng bước' },
  { value: 'wrong_answer_coach', label: 'Giải thích lỗi sai' },
  { value: 'similar_problems', label: 'Tạo bài tương tự' },
  { value: 'writing_outline', label: 'Lập dàn ý' },
  { value: 'writing_feedback', label: 'Nhận xét bài viết' },
  { value: 'grammar_check', label: 'Sửa lỗi Tiếng Anh' },
  { value: 'event_analysis', label: 'Phân tích sự kiện Sử' },
  { value: 'chart_analysis', label: 'Phân tích bản đồ & biểu đồ' },
  { value: 'geo_calc', label: 'Tính chỉ số địa lý' },
];

const DAY_NAMES: Record<number, string> = {
  2: 'Thứ 2',
  3: 'Thứ 3',
  4: 'Thứ 4',
  5: 'Thứ 5',
  6: 'Thứ 6',
  7: 'Thứ 7',
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không đọc được tệp đã chọn.'));
    reader.readAsDataURL(file);
  });
}

export const SubjectWorkspaceShell: React.FC<SubjectWorkspaceShellProps> = ({
  subject,
  currentUser,
  classes,
  presetClasses,
  schoolContext,
  progress,
  activeSubTab,
  onChangeSubTab,
  liveContextSummary,
  excelModuleKey,
  excelExportRecords = [],
  onImportExcelRows,
  onInjectGeneratedQuiz,
  onInjectGeneratedCards,
  onSaveAssignment,
  onSaveSubmission,
  onSaveMaterial,
  onSyncSubjectClasses,
  onOpenPresetClasses,
  onLogExport,
  onOpenTargetApp,
  onBackToOverview,
  initialSubTab,
  subTabRequestKey,
  children,
}) => {
  const IconComp = SUBJECT_ICON_MAP[subject.iconName] || BookOpen;
  const [excelModalOpen, setExcelModalOpen] = useState(false);

  React.useEffect(() => {
    if (initialSubTab && subTabRequestKey) {
      onChangeSubTab(initialSubTab);
    }
  }, [initialSubTab, subTabRequestKey, onChangeSubTab]);

  const metaParts: string[] = [
    progress.masteredIds.length > 0 ? `${progress.masteredIds.length} đã nắm` : '',
    progress.lastScoreLabel ? `Điểm: ${progress.lastScoreLabel}` : '',
    schoolContext.myAverageScore != null ? `TB: ${schoolContext.myAverageScore}` : '',
    schoolContext.pendingAssignmentCount > 0
      ? `${schoolContext.pendingAssignmentCount} cần nộp`
      : '',
  ].filter(Boolean);
  const schoolBadgeCount = schoolContext.assignments.length + schoolContext.materials.length;

  return (
    <div
      data-testid={`subject-workspace-${subject.id}`}
      className="flex flex-col gap-3 max-w-6xl mx-auto w-full pb-6"
    >
      {/* Compact Header + Single-Line Sub-Navigation */}
      <section className="liquid-glass-panel rounded-2xl px-3.5 py-2.5 sm:px-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            {onBackToOverview && (
              <button
                type="button"
                data-testid={`subject-back-overview-${subject.id}`}
                onClick={onBackToOverview}
                aria-label="Tất cả môn học"
                title="Tất cả môn học"
                className="w-8 h-8 rounded-xl glass-subsurface hover:bg-white/85 dark:hover:bg-slate-800/85 text-slate-700 dark:text-slate-200 flex items-center justify-center shrink-0 cursor-pointer transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div
              className={`w-8 h-8 rounded-lg ${subject.iconBgClass} text-white flex items-center justify-center shrink-0 shadow-xs`}
            >
              <IconComp className="w-4 h-4" />
            </div>
            <div className="min-w-0 flex flex-wrap items-baseline gap-x-2">
              <h2 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight truncate">
                {subject.title}
              </h2>
              {metaParts.length > 0 && (
                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-tabular truncate">
                  {metaParts.join(' · ')}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              data-testid={`subject-excel-btn-${subject.id}`}
              onClick={() => setExcelModalOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Excel</span>
            </button>
            <button
              type="button"
              data-testid={`subject-school-tab-btn-${subject.id}`}
              onClick={() => onChangeSubTab('school-hub')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                activeSubTab === 'school-hub'
                  ? 'bg-sky-600 text-white shadow-sm'
                  : 'glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200'
              }`}
            >
              <GraduationCap className="w-3.5 h-3.5" />
              <span>{schoolBadgeCount > 0 ? `Lớp (${schoolBadgeCount})` : 'Lớp'}</span>
            </button>
            <button
              type="button"
              data-testid={`subject-ai-tab-btn-${subject.id}`}
              onClick={() => onChangeSubTab('ai-tutor')}
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
                activeSubTab === 'ai-tutor'
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span>AI</span>
            </button>
          </div>
        </div>

        {/* Sleek Single-Line Sub-Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-1.5 border-t border-slate-900/10 dark:border-white/10">
          {subject.subTabs.map((tab) => {
            const active = activeSubTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                data-testid={`subject-subtab-${subject.id}-${tab.id}`}
                onClick={() => onChangeSubTab(tab.id)}
                className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  active
                    ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-900/5 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </section>

      {/* Body Switch: Built-in School Hub / AI Workspace / Specific Subject View */}
      {activeSubTab === 'school-hub' ? (
        <SubjectSchoolHubPanel
          subject={subject}
          currentUser={currentUser}
          classes={classes}
          presetClasses={presetClasses}
          schoolContext={schoolContext}
          onSaveAssignment={onSaveAssignment}
          onSaveSubmission={onSaveSubmission}
          onSaveMaterial={onSaveMaterial}
          onSyncSubjectClasses={onSyncSubjectClasses}
          onOpenPresetClasses={onOpenPresetClasses}
          onOpenTargetApp={onOpenTargetApp}
        />
      ) : activeSubTab === 'ai-tutor' ? (
        <SubjectAiWorkspace
          subject={subject}
          liveContextSummary={liveContextSummary}
          onInjectGeneratedQuiz={onInjectGeneratedQuiz}
          onInjectGeneratedCards={onInjectGeneratedCards}
        />
      ) : (
        children
      )}

      {/* Excel Template / Import / Export Modal */}
      <SubjectExcelModal
        isOpen={excelModalOpen}
        onClose={() => setExcelModalOpen(false)}
        subject={subject}
        moduleKey={excelModuleKey}
        presetClasses={presetClasses.map((p) => p.name)}
        exportRecords={excelExportRecords}
        onImportRows={onImportExcelRows}
        onLogExport={onLogExport}
      />
    </div>
  );
};

/* ============================================================================
   UNIFIED SCHOOL HUB PANEL (Timetable + Grades + Assignments + Materials)
   ============================================================================ */

const SubjectSchoolHubPanel: React.FC<{
  subject: SubjectDefinition;
  currentUser: UserProfile;
  classes: SchoolClass[];
  presetClasses: PresetClassConfig[];
  schoolContext: SubjectSchoolContext;
  onSaveAssignment?: (assignment: Assignment) => Promise<void> | void;
  onSaveSubmission?: (submission: AssignmentSubmission) => Promise<void> | void;
  onSaveMaterial?: (material: LearningMaterial) => Promise<void> | void;
  onSyncSubjectClasses?: (subjectId: SubjectId, classNames: string[]) => Promise<void> | void;
  onOpenPresetClasses?: () => void;
  onOpenTargetApp?: (appId: SuperAppId, tabId?: string) => void;
}> = ({
  subject,
  currentUser,
  classes,
  presetClasses,
  schoolContext,
  onSaveAssignment,
  onSaveSubmission,
  onSaveMaterial,
  onSyncSubjectClasses,
  onOpenPresetClasses,
  onOpenTargetApp,
}) => {
  const isStaffEducator =
    currentUser.role === 'admin' ||
    currentUser.role === 'principal' ||
    currentUser.role === 'homeroom_teacher' ||
    currentUser.role === 'subject_teacher';

  const [submitModalAssignment, setSubmitModalAssignment] = useState<Assignment | null>(null);
  const [submissionText, setSubmissionText] = useState('');
  const [newAssignModal, setNewAssignModal] = useState(false);
  const [assignTitle, setAssignTitle] = useState('');
  const [assignClass, setAssignClass] = useState(
    currentUser.className || classes[0]?.name || presetClasses[0]?.name || '10A1'
  );
  const [assignDue, setAssignDue] = useState(() => {
    const d = new Date(Date.now() + 7 * 86400_000);
    return d.toISOString().slice(0, 10);
  });
  const [assignDesc, setAssignDesc] = useState('');

  const [newMatModal, setNewMatModal] = useState(false);
  const [matTitle, setMatTitle] = useState('');
  const [matGrade, setMatGrade] = useState(currentUser.grade || 10);
  const [matType, setMatType] = useState<LearningMaterial['type']>('Bài giảng');
  const [matUrlOrNote, setMatUrlOrNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const handleSubmitHomework = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitModalAssignment || !onSaveSubmission || !submissionText.trim()) return;
    setSaving(true);
    try {
      const existing = schoolContext.submissionByAssignmentId[submitModalAssignment.id];
      await onSaveSubmission({
        id: existing?.id || `SUB-${Date.now()}`,
        assignmentId: submitModalAssignment.id,
        studentId: currentUser.linkedProfileId || currentUser.id,
        studentName: currentUser.displayName,
        studentCode: currentUser.studentCode || currentUser.id.slice(0, 8),
        className: currentUser.className || submitModalAssignment.className,
        content: submissionText.trim(),
        submittedAt: new Date().toISOString(),
        status: 'submitted',
      });
      setSubmitModalAssignment(null);
      setSubmissionText('');
      setStatusMsg('Đã nộp bài tập lên hệ thống lớp học.');
    } finally {
      setSaving(false);
    }
  };

  const handleCreateAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveAssignment || !assignTitle.trim()) return;
    setSaving(true);
    try {
      const matchedClass = classes.find((c) => c.name === assignClass);
      await onSaveAssignment({
        id: `ASG-${Date.now()}`,
        title: assignTitle.trim(),
        subject: subject.title,
        classId: matchedClass?.id || `CLS-${assignClass}`,
        className: assignClass,
        dueDate: assignDue,
        description: assignDesc.trim() || `Hoàn thành nội dung ôn tập môn ${subject.title}.`,
        teacherName: currentUser.displayName,
        points: 10,
        status: 'open',
        createdAt: new Date().toISOString(),
      });
      setNewAssignModal(false);
      setAssignTitle('');
      setAssignDesc('');
      setStatusMsg(`Đã giao bài tập mới cho lớp ${assignClass}.`);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveMaterial || !matTitle.trim() || !matUrlOrNote.trim()) return;
    setSaving(true);
    try {
      await onSaveMaterial({
        id: `MAT-${Date.now()}`,
        title: matTitle.trim(),
        subject: subject.title,
        grade: matGrade,
        type: matType,
        urlOrNote: matUrlOrNote.trim(),
        uploadedBy: currentUser.displayName,
        uploadedAt: new Date().toISOString(),
      });
      setNewMatModal(false);
      setMatTitle('');
      setMatUrlOrNote('');
      setStatusMsg(`Đã đăng học liệu mới cho môn ${subject.title}.`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid={`subject-school-hub-${subject.id}`} className="space-y-3">
      {statusMsg && (
        <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3.5 py-2 text-xs font-medium text-emerald-800 dark:text-emerald-200 flex items-center justify-between gap-2">
          <span>{statusMsg}</span>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            className="text-emerald-700 dark:text-emerald-300 hover:opacity-75 cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Top School Integration Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Grades Card */}
        <div className="liquid-glass-panel rounded-2xl p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <GraduationCap className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>Bảng điểm</span>
            </h3>
            {onOpenTargetApp && (
              <button
                type="button"
                onClick={() => onOpenTargetApp('learning', 'timetable')}
                className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer whitespace-nowrap"
              >
                TKB ↗
              </button>
            )}
          </div>
          {schoolContext.academicRecords.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">Chưa có điểm.</p>
          ) : (
            <div className="divide-y divide-slate-900/10 dark:divide-white/10 max-h-44 overflow-y-auto pr-1">
              {schoolContext.academicRecords.slice(0, 6).map((rec) => (
                <div
                  key={rec.id}
                  className="py-2 first:pt-0 last:pb-0 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white truncate">
                      {rec.studentName} · {rec.className}
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-tabular">
                      {rec.semester} · TX {rec.scoreRegular.join(', ') || '—'} · GK {rec.scoreMidterm} · CK {rec.scoreFinal}
                    </p>
                  </div>
                  <span className="font-bold text-sm font-mono-tabular text-sky-700 dark:text-sky-300 shrink-0">
                    {rec.averageScore}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Timetable Slots Card */}
        <div className="liquid-glass-panel rounded-2xl p-4 space-y-2">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <CalendarDays className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <span>TKB tuần{schoolContext.timetableSlots.length > 0 ? ` (${schoolContext.timetableSlots.length})` : ''}</span>
          </h3>
          {schoolContext.timetableSlots.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400">Chưa có tiết học.</p>
          ) : (
            <div className="divide-y divide-slate-900/10 dark:divide-white/10 max-h-44 overflow-y-auto pr-1">
              {schoolContext.timetableSlots.slice(0, 8).map((slot) => (
                <div key={slot.id} className="py-2 first:pt-0 last:pb-0 text-xs">
                  <p className="font-semibold text-slate-900 dark:text-white">
                    {DAY_NAMES[slot.dayOfWeek] || `Thứ ${slot.dayOfWeek}`} · Tiết {slot.period}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                    {slot.className} · P.{slot.room || '—'} · {slot.teacherName}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Classes Sync & Teachers Card */}
        <div className="liquid-glass-panel rounded-2xl p-4 space-y-2">
          <h3 className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <span>Tổ &amp; Lớp ({classes.length})</span>
          </h3>
          <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
            {schoolContext.teachers.length > 0
              ? `GV: ${schoolContext.teachers.map((t) => t.fullName).slice(0, 3).join(', ')}`
              : `${presetClasses.length} lớp`}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {onOpenPresetClasses && (
              <button
                type="button"
                onClick={onOpenPresetClasses}
                className="px-2.5 py-1.5 rounded-xl glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/80 text-xs font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap cursor-pointer"
              >
                Lớp ({presetClasses.length})
              </button>
            )}
            {isStaffEducator && onSyncSubjectClasses && presetClasses.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  void onSyncSubjectClasses(
                    subject.id,
                    presetClasses.map((p) => p.name)
                  )
                }
                className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                Đồng bộ
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Assignments + Learning Materials */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Assignments */}
        <div className="liquid-glass-panel rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <ClipboardCheck className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              <span>Bài tập ({schoolContext.assignments.length})</span>
            </h3>
            {isStaffEducator && onSaveAssignment && (
              <button
                type="button"
                data-testid={`create-subject-assignment-${subject.id}`}
                onClick={() => setNewAssignModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Giao bài</span>
              </button>
            )}
          </div>
          {schoolContext.assignments.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
              Chưa có bài tập.
            </p>
          ) : (
            <div className="divide-y divide-slate-900/10 dark:divide-white/10">
              {schoolContext.assignments.map((asg) => {
                const sub = schoolContext.submissionByAssignmentId[asg.id];
                return (
                  <div key={asg.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white">
                          {asg.title}
                        </p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono-tabular">
                          {asg.className} · Hạn {asg.dueDate} · {asg.teacherName}
                        </p>
                      </div>
                      {onSaveSubmission && asg.status === 'open' && (
                        <button
                          type="button"
                          onClick={() => {
                            setSubmitModalAssignment(asg);
                            setSubmissionText(sub?.content || '');
                          }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                            sub
                              ? 'bg-emerald-600/15 text-emerald-700 dark:text-emerald-300'
                              : 'bg-sky-600 hover:bg-sky-700 text-white'
                          }`}
                        >
                          {sub ? (sub.status === 'graded' ? `Điểm: ${sub.score}` : 'Sửa bài') : 'Nộp bài'}
                        </button>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                      {asg.description}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Learning Materials */}
        <div className="liquid-glass-panel rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <BookOpen className="w-4 h-4 text-sky-600 dark:text-sky-400" />
              <span>Học liệu ({schoolContext.materials.length})</span>
            </h3>
            {isStaffEducator && onSaveMaterial && (
              <button
                type="button"
                data-testid={`create-subject-material-${subject.id}`}
                onClick={() => setNewMatModal(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Đăng tài liệu</span>
              </button>
            )}
          </div>
          {schoolContext.materials.length === 0 ? (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-4 text-center">
              Chưa có học liệu.
            </p>
          ) : (
            <div className="divide-y divide-slate-900/10 dark:divide-white/10">
              {schoolContext.materials.map((mat) => (
                <div key={mat.id} className="py-2.5 first:pt-0 last:pb-0 space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white truncate">
                      {mat.title}
                    </p>
                    <span className="text-[11px] font-semibold text-sky-700 dark:text-sky-300 shrink-0">
                      {mat.type} · K{mat.grade}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-300 break-words">
                    {mat.urlOrNote}
                  </p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {mat.uploadedBy}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals for Student Submit / Teacher Assignment / Teacher Material */}
      <Modal
        isOpen={Boolean(submitModalAssignment)}
        onClose={() => setSubmitModalAssignment(null)}
        title={`Nộp bài: ${submitModalAssignment?.title || ''}`}
        description={`Môn ${subject.title} · Hạn ${submitModalAssignment?.dueDate || ''}`}
        maxWidth="lg"
      >
        <form onSubmit={handleSubmitHomework} className="space-y-3">
          <textarea
            rows={6}
            required
            value={submissionText}
            onChange={(e) => setSubmissionText(e.target.value)}
            placeholder="Nhập bài làm, lời giải hoặc đường dẫn tệp bài nộp của bạn…"
            className="w-full rounded-xl glass-subsurface px-3.5 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSubmitModalAssignment(null)}
              className="px-4 py-2 rounded-xl glass-subsurface text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving || !submissionText.trim()}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Đang lưu…' : 'Xác nhận nộp bài'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={newAssignModal}
        onClose={() => setNewAssignModal(false)}
        title={`Giao bài tập — ${subject.title}`}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateAssignment} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
              Tiêu đề bài tập
            </label>
            <input
              type="text"
              required
              value={assignTitle}
              onChange={(e) => setAssignTitle(e.target.value)}
              placeholder={`Ví dụ: Ôn tập chương 1 ${subject.title}`}
              className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Lớp nhận bài
              </label>
              <input
                type="text"
                required
                value={assignClass}
                onChange={(e) => setAssignClass(e.target.value)}
                list="subject-class-suggestions"
                className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
              <datalist id="subject-class-suggestions">
                {Array.from(
                  new Set([
                    ...classes.map((c) => c.name),
                    ...presetClasses.map((p) => p.name),
                  ])
                ).map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Hạn nộp
              </label>
              <input
                type="date"
                required
                value={assignDue}
                onChange={(e) => setAssignDue(e.target.value)}
                className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
              Yêu cầu chi tiết
            </label>
            <textarea
              rows={4}
              value={assignDesc}
              onChange={(e) => setAssignDesc(e.target.value)}
              placeholder="Mô tả nội dung bài tập, tiêu chí đánh giá…"
              className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setNewAssignModal(false)}
              className="px-4 py-2 rounded-xl glass-subsurface text-xs font-semibold cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer"
            >
              {saving ? 'Đang giao…' : 'Giao bài ngay'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={newMatModal}
        onClose={() => setNewMatModal(false)}
        title={`Đăng học liệu môn ${subject.title}`}
        maxWidth="lg"
      >
        <form onSubmit={handleCreateMaterial} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
              Tên học liệu
            </label>
            <input
              type="text"
              required
              value={matTitle}
              onChange={(e) => setMatTitle(e.target.value)}
              placeholder="Tên bài giảng, đề cương hoặc tài liệu tham khảo"
              className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Khối lớp
              </label>
              <select
                value={matGrade}
                onChange={(e) => setMatGrade(Number(e.target.value))}
                className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                <option value={10}>Khối 10</option>
                <option value={11}>Khối 11</option>
                <option value={12}>Khối 12</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Loại học liệu
              </label>
              <select
                value={matType}
                onChange={(e) => setMatType(e.target.value as LearningMaterial['type'])}
                className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white"
              >
                <option value="Bài giảng">Bài giảng</option>
                <option value="PDF">PDF</option>
                <option value="Đề thi">Đề thi</option>
                <option value="Video">Video</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
              Nội dung tóm tắt hoặc liên kết tài liệu
            </label>
            <textarea
              rows={4}
              required
              value={matUrlOrNote}
              onChange={(e) => setMatUrlOrNote(e.target.value)}
              placeholder="Dán đường dẫn hoặc ghi chú hướng dẫn học sinh…"
              className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setNewMatModal(false)}
              className="px-4 py-2 rounded-xl glass-subsurface text-xs font-semibold cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
            >
              {saving ? 'Đang đăng…' : 'Lưu học liệu'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

/* ============================================================================
   EMBEDDED NATIVE AI TUTOR & STRUCTURED CONTENT GENERATOR
   ============================================================================ */

interface ChatMsg {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isError?: boolean;
}

const SubjectAiWorkspace: React.FC<{
  subject: SubjectDefinition;
  liveContextSummary: string;
  onInjectGeneratedQuiz?: (questions: GeneratedAiQuizItem[]) => void;
  onInjectGeneratedCards?: (cards: GeneratedAiCardItem[]) => void;
}> = ({ subject, liveContextSummary, onInjectGeneratedQuiz, onInjectGeneratedCards }) => {
  const profile = SUBJECT_AI_PROFILES[subject.id];
  const presets = getSubjectAiPresets(subject.id);

  const [mode, setMode] = useState<SubjectAiMode>('tutor_chat');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [attachedImage, setAttachedImage] = useState<{
    name: string;
    mimeType: string;
    dataBase64: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const [genTopic, setGenTopic] = useState('');
  const [genBusy, setGenBusy] = useState<'quiz' | 'cards' | null>(null);
  const [genFeedback, setGenFeedback] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      setAttachedImage({
        name: file.name,
        mimeType: file.type || 'image/png',
        dataBase64: dataUrl,
      });
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: `err-${Date.now()}`, role: 'assistant', content: 'Không thể đọc tệp ảnh đã chọn.', isError: true },
      ]);
    }
  };

  const handleSend = async (overridePrompt?: string, overrideMode?: SubjectAiMode) => {
    const text = (overridePrompt ?? input).trim();
    if ((!text && !attachedImage) || isLoading) return;
    const activeMode = overrideMode ?? mode;

    const userMsg: ChatMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text || `(Đính kèm ảnh: ${attachedImage?.name || 'đề bài'})`,
    };
    const historyTurns: SubjectAiChatTurn[] = messages
      .filter((m) => !m.isError)
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content }));

    const assistantId = `a-${Date.now()}`;
    setMessages((prev) => [...prev, userMsg]);
    if (!overridePrompt) setInput('');
    const imgPayload = attachedImage
      ? { mimeType: attachedImage.mimeType, dataBase64: attachedImage.dataBase64 }
      : null;
    setAttachedImage(null);
    if (fileRef.current) fileRef.current.value = '';

    setIsLoading(true);
    setStreamingId(assistantId);

    const upsert = (content: string, isError = false) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === assistantId)) {
          return prev.map((m) => (m.id === assistantId ? { ...m, content, isError } : m));
        }
        return [...prev, { id: assistantId, role: 'assistant', content, isError }];
      });
    };

    try {
      const payload = {
        subjectId: subject.id,
        mode: activeMode,
        messages: [...historyTurns, { role: 'user', content: userMsg.content }],
        contextText: liveContextSummary,
        image: imgPayload,
      };
      const res = await fetch('/api/ai/subject-assist-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        upsert(errData.error || 'Không thể kết nối Trợ lý AI lúc này.', true);
        return;
      }

      if (ct.includes('text/event-stream') && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';
        let full = '';
        while (true) {
          const step = await reader.read();
          if (step.done) break;
          buffer += decoder.decode(step.value, { stream: true }).replace(/\r\n/g, '\n');
          const blocks = buffer.split('\n\n');
          buffer = blocks.pop() || '';
          for (const blk of blocks) {
            const dataStr = blk
              .split('\n')
              .filter((l) => l.startsWith('data:'))
              .map((l) => l.slice(5).trimStart())
              .join('\n')
              .trim();
            if (!dataStr || dataStr === '[DONE]') continue;
            try {
              const ev = JSON.parse(dataStr) as {
                delta?: string;
                replace?: string;
                done?: boolean;
                text?: string;
                error?: string;
              };
              if (ev.error) throw new Error(ev.error);
              if (ev.replace) {
                full = ev.replace;
                upsert(full, false);
              }
              if (ev.delta) {
                full += ev.delta;
                upsert(full, false);
              }
              if (ev.done && ev.text && ev.text.length >= full.length) {
                full = ev.text;
                upsert(full, false);
              }
            } catch (e) {
              if (e instanceof Error && !e.message.includes('JSON')) throw e;
            }
          }
        }
        if (!full.trim()) {
          upsert('Trợ lý AI chưa trả về nội dung phù hợp.', true);
        }
        return;
      }

      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
      if (!data.text) {
        upsert(data.error || 'Trợ lý AI chưa trả về nội dung phù hợp.', true);
      } else {
        upsert(data.text, false);
      }
    } catch (err) {
      upsert(
        err instanceof Error ? err.message : 'Lỗi kết nối máy chủ Trợ lý AI.',
        true
      );
    } finally {
      setIsLoading(false);
      setStreamingId(null);
    }
  };

  const handleGenerateStructured = async (action: 'generate_quiz' | 'generate_study_cards') => {
    setGenBusy(action === 'generate_quiz' ? 'quiz' : 'cards');
    setGenFeedback(null);
    try {
      const res = await fetch('/api/ai/subject-structured', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: subject.id,
          action,
          topic: genTopic.trim() || subject.title,
          count: 4,
          contextText: liveContextSummary,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        questions?: GeneratedAiQuizItem[];
        cards?: GeneratedAiCardItem[];
        error?: string;
      };
      if (!res.ok) {
        setGenFeedback(data.error || 'Không thể sinh dữ liệu ôn tập.');
        return;
      }
      if (action === 'generate_quiz' && data.questions && data.questions.length > 0) {
        onInjectGeneratedQuiz?.(data.questions);
        setGenFeedback(`Đã thêm ${data.questions.length} câu hỏi mới vào mục Luyện tập.`);
      } else if (action === 'generate_study_cards' && data.cards && data.cards.length > 0) {
        onInjectGeneratedCards?.(data.cards);
        setGenFeedback(`Đã thêm ${data.cards.length} thẻ ghi nhớ mới vào môn ${subject.title}.`);
      } else {
        setGenFeedback('AI chưa trả về dữ liệu phù hợp, vui lòng thử lại.');
      }
    } catch {
      setGenFeedback('Lỗi kết nối khi tạo bộ ôn tập AI.');
    } finally {
      setGenBusy(null);
    }
  };

  return (
    <div data-testid={`subject-ai-workspace-${subject.id}`} className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      {/* Left Column: Structured Quiz/Card Generators & Gauth */}
      <div className="space-y-3">
        <div className="liquid-glass-panel rounded-2xl p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-violet-600 dark:text-violet-400" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Tạo nhanh bằng AI
            </h3>
          </div>
          <input
            type="text"
            value={genTopic}
            onChange={(e) => setGenTopic(e.target.value)}
            placeholder={`Chủ đề ${subject.title}…`}
            className="w-full rounded-xl glass-subsurface px-3 py-2 text-xs text-slate-900 dark:text-white"
          />
          <div className="flex flex-col gap-2">
            {onInjectGeneratedQuiz && (
              <button
                type="button"
                disabled={genBusy !== null}
                onClick={() => void handleGenerateStructured('generate_quiz')}
                className="w-full px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white text-xs font-semibold whitespace-nowrap cursor-pointer"
              >
                {genBusy === 'quiz' ? 'Đang tạo 4 câu hỏi…' : 'Tạo 4 câu hỏi'}
              </button>
            )}
            {onInjectGeneratedCards && (
              <button
                type="button"
                disabled={genBusy !== null}
                onClick={() => void handleGenerateStructured('generate_study_cards')}
                className="w-full px-3 py-2 rounded-xl glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/80 text-xs font-semibold text-slate-800 dark:text-slate-100 whitespace-nowrap cursor-pointer"
              >
                {genBusy === 'cards' ? 'Đang tạo 4 thẻ…' : 'Tạo 4 thẻ nhớ'}
              </button>
            )}
          </div>
          {genFeedback && (
            <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
              {genFeedback}
            </p>
          )}
        </div>

        {/* Gauth External Reference */}
        <div className="liquid-glass-panel rounded-2xl p-3.5 flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            Tham khảo
          </span>
          <a
            href={GAUTH_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid={`gauth-link-${subject.id}`}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/80 text-xs font-semibold text-sky-700 dark:text-sky-300 whitespace-nowrap"
          >
            <span>Gauth</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Right Column: Live Streaming AI Tutor Chat */}
      <div className="lg:col-span-2 liquid-glass-panel rounded-2xl p-4 flex flex-col gap-3 min-h-[440px]">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-900/10 dark:border-white/10">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">
            {profile.tutorTitle}
          </h3>
          <div className="flex items-center gap-2">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as SubjectAiMode)}
              className="rounded-xl glass-subsurface px-2.5 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
            >
              {MODE_LABELS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            {messages.length > 0 && (
              <button
                type="button"
                onClick={() => setMessages([])}
                title="Làm mới hội thoại"
                className="p-1.5 rounded-xl glass-subsurface text-slate-500 hover:text-rose-600 cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 min-h-[250px] max-h-[420px] overflow-y-auto space-y-2.5 pr-1">
          {messages.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {presets.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setMode(p.mode);
                    setInput(p.prompt);
                  }}
                  className="text-left p-2.5 rounded-xl glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/80 transition-colors cursor-pointer"
                >
                  <p className="text-xs font-bold text-slate-900 dark:text-white">{p.label}</p>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 line-clamp-1 mt-0.5">
                    {p.prompt}
                  </p>
                </button>
              ))}
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed ${
                  msg.role === 'user'
                    ? 'ml-8 bg-sky-600 text-white'
                    : msg.isError
                      ? 'mr-6 bg-rose-500/15 border border-rose-400/40 text-rose-800 dark:text-rose-200'
                      : 'mr-6 glass-subsurface text-slate-900 dark:text-slate-100'
                }`}
              >
                {msg.role === 'user' ? (
                  msg.content
                ) : (
                  <FormattedAiText
                    text={msg.content}
                    isStreaming={isLoading && streamingId === msg.id}
                  />
                )}
              </div>
            ))
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void handleSend();
          }}
          className="space-y-2 pt-2 border-t border-slate-900/10 dark:border-white/10"
        >
          {attachedImage && (
            <div className="flex items-center justify-between px-3 py-1.5 rounded-xl glass-subsurface text-xs">
              <span className="truncate">Ảnh đính kèm: {attachedImage.name}</span>
              <button
                type="button"
                onClick={() => {
                  setAttachedImage(null);
                  if (fileRef.current) fileRef.current.value = '';
                }}
                className="text-rose-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <div className="flex gap-2 items-end">
            <textarea
              rows={2}
              data-testid={`subject-ai-input-${subject.id}`}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Hỏi gia sư ${subject.title}…`}
              className="flex-1 rounded-xl glass-subsurface px-3 py-2 text-xs sm:text-sm text-slate-900 dark:text-white resize-none focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            <label className="p-2.5 rounded-xl glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/80 cursor-pointer shrink-0" title="Đính kèm ảnh đề">
              <ImagePlus className="w-4 h-4 text-slate-700 dark:text-slate-200" />
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleImagePick}
                className="hidden"
              />
            </label>
            <button
              type="submit"
              data-testid={`subject-ai-send-${subject.id}`}
              disabled={isLoading || (!input.trim() && !attachedImage)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isLoading ? 'Đang gửi…' : 'Gửi'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
   UNIFIED EXCEL MODAL (Download Template + Import + Export via /api/subjects/*)
   ============================================================================ */

const SubjectExcelModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  subject: SubjectDefinition;
  moduleKey: string;
  presetClasses: string[];
  exportRecords: Array<Record<string, unknown>>;
  onImportRows?: (rows: Array<Record<string, unknown>>, result: Record<string, unknown>) => void;
  onLogExport?: (entry: {
    module: string;
    format: 'excel' | 'pdf';
    fileName: string;
    recordCount: number;
  }) => Promise<void> | void;
}> = ({
  isOpen,
  onClose,
  subject,
  moduleKey,
  presetClasses,
  exportRecords,
  onImportRows,
  onLogExport,
}) => {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDownloadTemplate = () => {
    const clsParam = encodeURIComponent(presetClasses.join(','));
    const url = `/api/subjects/excel-template?subject=${encodeURIComponent(
      subject.id
    )}&module=${encodeURIComponent(moduleKey)}&classes=${clsParam}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `Mau_${subject.id}_${moduleKey}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setMessage('Đang tải tệp mẫu Excel chuẩn cấu trúc có sẵn danh sách lớp.');
  };

  const handleUploadExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const dataUrl = await readFileAsDataUrl(file);
      const res = await fetch('/api/subjects/parse-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: subject.id,
          moduleKey,
          fileBase64: dataUrl,
          presetClasses,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        rows?: Array<Record<string, unknown>>;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || 'Không thể đọc tệp Excel.');
        return;
      }
      const rows = Array.isArray(data.rows) ? data.rows : [];
      onImportRows?.(rows, data as Record<string, unknown>);
      setMessage(`Đã nhập thành công ${rows.length} dòng dữ liệu vào môn ${subject.title}.`);
    } catch {
      setError('Lỗi xử lý tệp Excel.');
    } finally {
      setBusy(false);
      e.target.value = '';
    }
  };

  const handleExportExcel = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const fileName = `Xuat_${subject.id}_${moduleKey}.xlsx`;
      const res = await fetch('/api/subjects/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subjectId: subject.id,
          moduleKey,
          records: exportRecords,
          presetClasses,
          fileName,
        }),
      });
      if (!res.ok) {
        setError('Không thể xuất dữ liệu Excel.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      await onLogExport?.({
        module: `subject_${subject.id}`,
        format: 'excel',
        fileName,
        recordCount: exportRecords.length,
      });
      setMessage(`Đã xuất ${exportRecords.length} bản ghi ra tệp ${fileName} và lưu lịch sử hệ thống.`);
    } catch {
      setError('Lỗi khi xuất tệp Excel.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Excel — ${subject.title}`}
      maxWidth="lg"
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={handleDownloadTemplate}
            className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/80 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
          >
            <Download className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            <span>Tải mẫu (.xlsx)</span>
          </button>

          <label className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/80 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer">
            <Upload className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            <span>{busy ? 'Đang nhập…' : 'Nhập Excel'}</span>
            <input
              type="file"
              accept=".xlsx,.xls"
              disabled={busy}
              onChange={handleUploadExcel}
              className="hidden"
            />
          </label>

          <button
            type="button"
            disabled={busy}
            onClick={() => void handleExportExcel()}
            className="flex flex-col items-center justify-center gap-1.5 p-4 rounded-2xl glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/80 text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer disabled:opacity-50"
          >
            <FileSpreadsheet className="w-5 h-5 text-violet-600 dark:text-violet-400" />
            <span>Xuất ({exportRecords.length})</span>
          </button>
        </div>

        {message && (
          <div className="rounded-xl bg-emerald-500/15 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{message}</span>
          </div>
        )}
        {error && (
          <div className="rounded-xl bg-rose-500/15 border border-rose-500/30 px-3 py-2 text-xs text-rose-800 dark:text-rose-200">
            {error}
          </div>
        )}
      </div>
    </Modal>
  );
};

export interface EmptyActionItem {
  label: string;
  onClick: () => void;
  primary?: boolean;
}

export const SubjectEmptyState: React.FC<{
  title: string;
  actions?: EmptyActionItem[];
  testId?: string;
}> = ({ title, actions = [], testId }) => (
  <div
    data-testid={testId}
    className="liquid-glass-panel rounded-2xl px-5 py-8 text-center space-y-3"
  >
    <p className="text-xs sm:text-sm font-medium text-slate-600 dark:text-slate-300">
      {title}
    </p>
    {actions.length > 0 && (
      <div className="flex flex-wrap items-center justify-center gap-2">
        {actions.map((act) => (
          <button
            key={act.label}
            type="button"
            onClick={act.onClick}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold cursor-pointer transition-colors ${
              act.primary
                ? 'bg-sky-600 hover:bg-sky-700 text-white shadow-xs'
                : 'border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800/80 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100'
            }`}
          >
            {act.label}
          </button>
        ))}
      </div>
    )}
  </div>
);

export function getSubjectTitleHelper(id: SubjectId): string {
  return getSubjectById(id)?.title || id;
}
