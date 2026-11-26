import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  ArrowRight,
  Award,
  BookOpen,
  Bot,
  CalendarDays,
  ClipboardCheck,
  GraduationCap,
  Layers,
  TrendingUp,
} from '../icons/UiIcons';
import type {
  AcademicRecord,
  Assignment,
  AssignmentSubmission,
  LearningMaterial,
  PermissionMatrix,
  PresetClassConfig,
  SchoolClass,
  SuperAppId,
  SystemSettings,
  Teacher,
  TimetableEntry,
  UserProfile,
} from '../../types';
import { DEFAULT_PERMISSIONS } from '../../utils/rbac';
import { resolveAppTabAlias } from '../../utils/streamlinedHelpers';
import {
  getActiveSubjects,
  getSubjectById,
  type SubjectId,
} from '../../utils/subjectRegistry';
import {
  computeOverviewMetrics,
  emptySubjectProgress,
  loadUserSubjectProgressMap,
  matchSubjectSchoolContext,
  saveUserSubjectProgressMap,
  updateSubjectProgress,
  type SubjectProgressMap,
  type SubjectSchoolContext,
} from '../../utils/subjects/subjectWorkspaceEngine';
import { AppWindowShell } from '../shared/AppWindowShell';
import { PresetClassesModal } from '../shared/PresetClassesModal';
import {
  SUBJECT_ICON_MAP,
  type SubjectHostWorkspaceProps,
} from '../subjects/SubjectWorkspaceShared';
import { ChemistrySubjectView } from '../subjects/ChemistrySubjectView';
import { EnglishSubjectView } from '../subjects/EnglishSubjectView';
import { GeographySubjectView } from '../subjects/GeographySubjectView';
import { HistorySubjectView } from '../subjects/HistorySubjectView';
import { LiteratureSubjectView } from '../subjects/LiteratureSubjectView';
import { MathSubjectView } from '../subjects/MathSubjectView';
import { PhysicsSubjectView } from '../subjects/PhysicsSubjectView';

interface SubjectsAppProps {
  activeTab: string;
  currentUser: UserProfile;
  customPermissions?: PermissionMatrix;
  darkMode: boolean;
  classes?: SchoolClass[];
  presetClasses?: PresetClassConfig[];
  systemSettings?: SystemSettings;
  academicRecords?: AcademicRecord[];
  timetable?: TimetableEntry[];
  assignments?: Assignment[];
  assignmentSubmissions?: AssignmentSubmission[];
  learningMaterials?: LearningMaterial[];
  teachers?: Teacher[];
  onSaveSettings?: (nextSettings: SystemSettings) => Promise<void> | void;
  onCreateClassesOnWeb?: (newClasses: SchoolClass[]) => Promise<void> | void;
  onSyncSubjectClasses?: (subjectId: SubjectId, classNames: string[]) => Promise<void> | void;
  onSaveAssignment?: (assignment: Assignment) => Promise<void> | void;
  onSaveSubmission?: (submission: AssignmentSubmission) => Promise<void> | void;
  onSaveMaterial?: (material: LearningMaterial) => Promise<void> | void;
  onSaveAcademicRecord?: (record: AcademicRecord) => Promise<void> | void;
  onLogExport?: (entry: {
    module: string;
    format: 'excel' | 'pdf';
    fileName: string;
    recordCount: number;
  }) => Promise<void> | void;
  onOpenTargetApp?: (appId: SuperAppId, tabId?: string) => void;
  onSelectTab: (tabId: string) => void;
}

export const SubjectsApp: React.FC<SubjectsAppProps> = ({
  activeTab,
  currentUser,
  customPermissions = DEFAULT_PERMISSIONS,
  classes = [],
  presetClasses = [],
  systemSettings,
  academicRecords = [],
  timetable = [],
  assignments = [],
  assignmentSubmissions = [],
  learningMaterials = [],
  teachers = [],
  onSaveSettings,
  onCreateClassesOnWeb,
  onSyncSubjectClasses,
  onSaveAssignment,
  onSaveSubmission,
  onSaveMaterial,
  onSaveAcademicRecord,
  onLogExport,
  onOpenTargetApp,
  onSelectTab,
}) => {
  const [isPresetClassesOpen, setIsPresetClassesOpen] = useState(false);
  const [requestedSubTabBySubject, setRequestedSubTabBySubject] = useState<
    Partial<Record<SubjectId, string>>
  >({});
  const [subTabRequestKey, setSubTabRequestKey] = useState(0);

  const [progressMap, setProgressMap] = useState<SubjectProgressMap>(() =>
    loadUserSubjectProgressMap(currentUser.id)
  );

  useEffect(() => {
    setProgressMap(loadUserSubjectProgressMap(currentUser.id));
  }, [currentUser.id]);

  const activeSubjects = getActiveSubjects();
  const resolvedInitialTab = resolveAppTabAlias('subjects', activeTab);
  const initialSelectedSubject = getSubjectById(resolvedInitialTab);

  // Unified cross-VSCHOOL school context computed for every subject
  const schoolContextBySubject = useMemo(() => {
    const map = {} as Record<SubjectId, SubjectSchoolContext>;
    for (const subj of activeSubjects) {
      map[subj.id] = matchSubjectSchoolContext({
        subjectId: subj.id,
        currentUser,
        academicRecords,
        timetable,
        assignments,
        assignmentSubmissions,
        learningMaterials,
        teachers,
      });
    }
    return map;
  }, [
    academicRecords,
    activeSubjects,
    assignmentSubmissions,
    assignments,
    currentUser,
    learningMaterials,
    teachers,
    timetable,
  ]);

  const overviewMetrics = useMemo(() => {
    const raw = computeOverviewMetrics({
      progressMap,
      schoolContexts: schoolContextBySubject,
    });
    const totalTimetableSlots = raw.perSubject.reduce((acc, s) => acc + s.timetableCount, 0);
    const rated = raw.perSubject.filter((s) => s.schoolAverage != null);
    const averageSchoolGrade =
      rated.length > 0
        ? Number(
            (rated.reduce((acc, s) => acc + (s.schoolAverage || 0), 0) / rated.length).toFixed(2)
          )
        : null;
    return {
      ...raw,
      totalTimetableSlots,
      averageSchoolGrade,
    };
  }, [progressMap, schoolContextBySubject]);

  const handleToggleMastered = useCallback(
    (subjectId: SubjectId, itemId: string) => {
      setProgressMap((prev) => {
        const nextMap = updateSubjectProgress(prev, subjectId, (current) => {
          const mastered = current.masteredIds || [];
          const nextMastered = mastered.includes(itemId)
            ? mastered.filter((id) => id !== itemId)
            : [...mastered, itemId];
          return {
            ...current,
            masteredIds: nextMastered,
          };
        });
        saveUserSubjectProgressMap(currentUser.id, nextMap);
        return nextMap;
      });
    },
    [currentUser.id]
  );

  const handleRecordPracticeResult = useCallback(
    (subjectId: SubjectId, score: number, total: number, label: string) => {
      setProgressMap((prev) => {
        const nextMap = updateSubjectProgress(prev, subjectId, (current) => ({
          ...current,
          practiceAttempts: (current.practiceAttempts || 0) + 1,
          lastScoreLabel: label || `${score}/${total}`,
          lastScorePercent: total > 0 ? Math.round((score / total) * 100) : undefined,
        }));
        saveUserSubjectProgressMap(currentUser.id, nextMap);
        return nextMap;
      });
    },
    [currentUser.id]
  );

  const handleSaveStudyNote = useCallback(
    (subjectId: SubjectId, itemId: string, note: string) => {
      setProgressMap((prev) => {
        const nextMap = updateSubjectProgress(prev, subjectId, (current) => ({
          ...current,
          notesByItemId: {
            ...(current.notesByItemId || {}),
            [itemId]: note,
          },
        }));
        saveUserSubjectProgressMap(currentUser.id, nextMap);
        return nextMap;
      });
    },
    [currentUser.id]
  );

  const openSubjectAtSubTab = (subjectId: SubjectId, subTab?: string) => {
    if (subTab) {
      setRequestedSubTabBySubject((prev) => ({ ...prev, [subjectId]: subTab }));
      setSubTabRequestKey((k) => k + 1);
    }
    onSelectTab(subjectId);
  };

  const renderSubjectWorkspace = (subjectId: SubjectId) => {
    const subject = getSubjectById(subjectId);
    if (!subject) return null;

    const hostProps: SubjectHostWorkspaceProps = {
      subject,
      currentUser,
      classes,
      presetClasses,
      schoolContext: schoolContextBySubject[subjectId],
      progress: progressMap[subjectId] || emptySubjectProgress(),
      onToggleMastered: (itemId) => handleToggleMastered(subjectId, itemId),
      onRecordPracticeResult: (score, total, label) =>
        handleRecordPracticeResult(subjectId, score, total, label),
      onSaveStudyNote: (itemId, note) => handleSaveStudyNote(subjectId, itemId, note),
      onSaveAssignment,
      onSaveSubmission,
      onSaveMaterial,
      onSaveAcademicRecord,
      onSyncSubjectClasses,
      onOpenPresetClasses:
        systemSettings && onSaveSettings ? () => setIsPresetClassesOpen(true) : undefined,
      onLogExport,
      onOpenTargetApp,
      onBackToOverview: () => onSelectTab('overview'),
      initialSubTab: requestedSubTabBySubject[subjectId],
      subTabRequestKey: requestedSubTabBySubject[subjectId] ? subTabRequestKey : undefined,
    };

    switch (subjectId) {
      case 'english':
        return <EnglishSubjectView key={`english-${currentUser.id}`} {...hostProps} />;
      case 'math':
        return <MathSubjectView key={`math-${currentUser.id}`} {...hostProps} />;
      case 'physics':
        return <PhysicsSubjectView key={`physics-${currentUser.id}`} {...hostProps} />;
      case 'chemistry':
        return <ChemistrySubjectView key={`chemistry-${currentUser.id}`} {...hostProps} />;
      case 'literature':
        return <LiteratureSubjectView key={`literature-${currentUser.id}`} {...hostProps} />;
      case 'history':
        return <HistorySubjectView key={`history-${currentUser.id}`} {...hostProps} />;
      case 'geography':
        return <GeographySubjectView key={`geography-${currentUser.id}`} {...hostProps} />;
    }
  };

  const chartSeriesData = useMemo(
    () =>
      activeSubjects.map((s) => {
        const ctx = schoolContextBySubject[s.id];
        const prog = progressMap[s.id];
        return {
          name: s.title,
          daNam: prog?.masteredIds.length || 0,
          diemTB: ctx?.myAverageScore ?? 0,
          baiTap: ctx?.assignments.length || 0,
        };
      }),
    [activeSubjects, progressMap, schoolContextBySubject]
  );

  return (
    <AppWindowShell
      appId="subjects"
      activeTab={activeTab}
      userRole={currentUser.role}
      userProfile={currentUser}
      customPermissions={customPermissions}
      contentClassName={
        initialSelectedSubject ? 'flex-1 min-h-0 overflow-y-auto p-3 sm:p-4' : undefined
      }
      onSelectTab={onSelectTab}
    >
      {(resolvedTab) => {
        const selectedSubject = getSubjectById(resolvedTab);

        return (
          <>
            {systemSettings && onSaveSettings && (
              <PresetClassesModal
                isOpen={isPresetClassesOpen}
                onClose={() => setIsPresetClassesOpen(false)}
                systemSettings={systemSettings}
                existingClasses={classes}
                onSaveSettings={onSaveSettings}
                onCreateClassesOnWeb={onCreateClassesOnWeb}
              />
            )}

            {selectedSubject ? (
              <div data-testid={`subjects-${selectedSubject.id}-workspace`}>
                {renderSubjectWorkspace(selectedSubject.id)}
              </div>
            ) : (
              <div data-testid="subjects-overview" className="max-w-6xl mx-auto space-y-4 pb-6">
                {/* Compact Header + Flat Inline Metrics */}
                <section className="liquid-glass-panel rounded-2xl px-4 py-3 sm:px-5 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight truncate">
                        Môn học
                      </h2>
                      <span className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        · {currentUser.displayName}
                      </span>
                    </div>
                    {systemSettings && onSaveSettings && (
                      <button
                        type="button"
                        data-testid="subjects-preset-classes-btn"
                        onClick={() => setIsPresetClassesOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Layers className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 shrink-0" />
                        <span>{presetClasses.length > 0 ? `Lớp (${presetClasses.length})` : 'Lớp'}</span>
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-slate-900/10 dark:border-white/10">
                    <div className="flex items-center gap-2">
                      <Award className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Đã nắm</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white font-mono-tabular">
                          {overviewMetrics.totalMastered}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <ClipboardCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Cần nộp</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white font-mono-tabular">
                          {overviewMetrics.totalPendingAssignments}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <CalendarDays className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Tiết TKB</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white font-mono-tabular">
                          {overviewMetrics.totalTimetableSlots}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-violet-600 dark:text-violet-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-[11px] text-slate-500 dark:text-slate-400">Điểm TB</p>
                        <p className="text-sm font-bold text-slate-900 dark:text-white font-mono-tabular">
                          {overviewMetrics.averageSchoolGrade != null
                            ? overviewMetrics.averageSchoolGrade
                            : '—'}
                        </p>
                      </div>
                    </div>
                  </div>
                </section>

                {/* Clean 7 Subject Cards Grid */}
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-stretch">
                  {activeSubjects.map((subject) => {
                    const SubjectIcon = SUBJECT_ICON_MAP[subject.iconName] || BookOpen;
                    const progress = progressMap[subject.id];
                    const ctx = schoolContextBySubject[subject.id];
                    const masteredCount = progress?.masteredIds.length || 0;
                    const assignmentCount = ctx?.assignments.length || 0;
                    const materialCount = ctx?.materials.length || 0;
                    const slotCount = ctx?.timetableSlots.length || 0;
                    const statParts = [
                      masteredCount > 0 ? `${masteredCount} đã nắm` : '',
                      assignmentCount + materialCount > 0 ? `${assignmentCount + materialCount} bài & TL` : '',
                      slotCount > 0 ? `${slotCount} tiết` : '',
                    ].filter(Boolean);

                    return (
                      <article
                        key={subject.id}
                        data-testid={`subject-card-${subject.id}`}
                        className="liquid-glass-panel rounded-2xl p-4 flex flex-col justify-between gap-3 transition-transform duration-150 hover:-translate-y-0.5"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-10 h-10 rounded-xl ${subject.iconBgClass} text-white flex items-center justify-center shrink-0 shadow-sm ring-1 ring-white/25`}
                            >
                              <SubjectIcon className="w-5 h-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center justify-between gap-2">
                                <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight truncate">
                                  {subject.title}
                                </h3>
                                {ctx?.myAverageScore != null && (
                                  <span className="text-xs font-bold font-mono-tabular text-emerald-700 dark:text-emerald-300 shrink-0">
                                    TB {ctx.myAverageScore}
                                  </span>
                                )}
                              </div>
                              <p className={`text-[11px] font-medium truncate ${subject.textAccentClass}`}>
                                {subject.shortTagline}
                              </p>
                            </div>
                          </div>

                          {statParts.length > 0 && (
                            <p className="text-[11px] text-slate-600 dark:text-slate-300 font-mono-tabular">
                              {statParts.join(' · ')}
                            </p>
                          )}
                        </div>

                        <div className="pt-2.5 border-t border-slate-900/10 dark:border-white/10 flex items-center justify-between gap-1.5">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              data-testid={`open-school-subject-${subject.id}`}
                              onClick={() => openSubjectAtSubTab(subject.id, 'school-hub')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <GraduationCap className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                              <span>Lớp</span>
                            </button>
                            <button
                              type="button"
                              data-testid={`ask-ai-subject-${subject.id}`}
                              onClick={() => openSubjectAtSubTab(subject.id, 'ai-tutor')}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/80 text-slate-700 dark:text-slate-200 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <Bot className="w-3.5 h-3.5 text-violet-600 dark:text-violet-400" />
                              <span>AI</span>
                            </button>
                          </div>

                          <button
                            type="button"
                            data-testid={`open-subject-${subject.id}`}
                            onClick={() => openSubjectAtSubTab(subject.id, subject.subTabs[0]?.id)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold shadow-sm whitespace-nowrap shrink-0 cursor-pointer"
                          >
                            <span>Vào học</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </section>

                {/* Cross-subject Progress Chart (only shown when activity exists) */}
                {chartSeriesData.some((d) => d.daNam > 0 || d.diemTB > 0 || d.baiTap > 0) && (
                  <section className="liquid-glass-panel rounded-2xl p-4 space-y-2">
                    <h3 className="text-xs font-bold text-slate-900 dark:text-white">
                      Tổng hợp tiến độ &amp; điểm môn học
                    </h3>
                    <div className="h-44 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartSeriesData}>
                          <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                          <YAxis tick={{ fontSize: 11 }} />
                          <Tooltip />
                          <Bar dataKey="daNam" name="Đã nắm" fill="#0284C7" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="diemTB" name="Điểm TB" fill="#10B981" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="baiTap" name="Bài tập" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </section>
                )}
              </div>
            )}
          </>
        );
      }}
    </AppWindowShell>
  );
};
