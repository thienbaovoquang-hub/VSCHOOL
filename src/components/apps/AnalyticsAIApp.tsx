import React, { useState, useMemo } from 'react';
import ExcelJS from 'exceljs';
import {
  PieChart as PieChartIcon, BarChart3, BrainCircuit,
  Sparkles, Download, Users, BookOpen, GraduationCap, MessageSquare
} from '../icons/UiIcons';
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  AcademicRecord,
  Announcement,
  Book,
  BorrowTransaction,
  ExportHistoryRecord,
  ExternalDatasetRecord,
  FacilityAsset,
  FeedbackReport,
  ImportHistoryRecord,
  ImportModuleKey,
  MaintenanceRequest,
  PermissionMatrix,
  SchoolClass,
  Student,
  SuperAppId,
  Teacher,
  UserProfile,
} from '../../types';
import { AppWindowShell } from '../shared/AppWindowShell';
import { EmptyState } from '../shared/EmptyState';
import { LiquidCard } from '../common/LiquidCard';
import { Badge } from '../common/Badge';
import { StatCard } from '../common/StatCard';
import { DataCenterView } from '../../views/DataCenterView';
import { triggerBinaryDownload } from '../../utils/importExport/excelEngine';
import type { ValidationDbContext } from '../../utils/importExport/validator';
import {
  DEFAULT_PERMISSIONS,
  filterAcademicRecordsByScope,
  filterFeedbacksByScope,
  filterStudentsByScope,
} from '../../utils/rbac';
import { buildAiAssistantContextSummary } from '../../utils/aiAssistantHelpers';
import { FormattedAiText } from '../common/FormattedAiText';
import { postSseWithFallback } from '../../utils/aiStreamClient';

interface AnalyticsAIAppProps {
  activeTab: string;
  currentUser: UserProfile;
  customPermissions?: PermissionMatrix;
  validationContext?: ValidationDbContext;
  importHistory?: ImportHistoryRecord[];
  exportHistory?: ExportHistoryRecord[];
  externalDatasets?: ExternalDatasetRecord[];
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
  onSelectTab: (tabId: string) => void;
  onImportStudents: (students: Student[]) => void;
  onImportBooks: (books: Book[]) => void;
  onImportTeachers: (teachers: Teacher[]) => void;
  onOpenTargetApp: (appId: SuperAppId, tabId?: string) => void;
  onUnifiedImportCommit?: (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => Promise<void> | void;
  onLogExport?: (record: ExportHistoryRecord) => Promise<void> | void;
}

const CHART_COLORS = ['#0ea5e9', '#14b8a6', '#8b5cf6', '#f59e0b', '#f43f5e'];

export const AnalyticsAIApp: React.FC<AnalyticsAIAppProps> = ({
  activeTab,
  currentUser,
  customPermissions = DEFAULT_PERMISSIONS,
  validationContext = {},
  importHistory = [],
  exportHistory = [],
  externalDatasets = [],
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
  onSelectTab,
  onImportStudents,
  onImportBooks,
  onImportTeachers,
  onOpenTargetApp,
  onUnifiedImportCommit,
  onLogExport,
}) => {
  const scopedStudents = useMemo(
    () => filterStudentsByScope(students, currentUser, teachers),
    [students, currentUser, teachers]
  );
  const scopedAcademic = useMemo(
    () => filterAcademicRecordsByScope(academicRecords, currentUser),
    [academicRecords, currentUser]
  );
  const scopedFeedbacks = useMemo(
    () => filterFeedbacksByScope(feedbacks, currentUser),
    [feedbacks, currentUser]
  );

  // Live computed charts from scoped records
  const gradeData = useMemo(() => {
    const counts = { 'Xuất sắc': 0, 'Giỏi': 0, 'Khá': 0, 'Trung bình': 0 };
    const scores =
      scopedAcademic.length > 0
        ? scopedAcademic.map((r) => r.averageScore)
        : scopedStudents.map((s) => s.gpa || 0).filter((g) => g > 0);
    scores.forEach((g) => {
      if (g >= 9) counts['Xuất sắc'] += 1;
      else if (g >= 8) counts['Giỏi'] += 1;
      else if (g >= 6.5) counts['Khá'] += 1;
      else counts['Trung bình'] += 1;
    });
    return Object.entries(counts).map(([tier, count]) => ({ tier, count }));
  }, [scopedAcademic, scopedStudents]);

  const bookCategoryData = useMemo(() => {
    const map = new Map<string, number>();
    books.forEach((b) => {
      map.set(b.category, (map.get(b.category) || 0) + b.totalCopies);
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [books]);

  const metricsSummary = useMemo(
    () =>
      buildAiAssistantContextSummary({
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
        externalDatasets,
      }),
    [
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
      externalDatasets,
    ]
  );

  // AI Analysis state
  const [analysisScope, setAnalysisScope] = useState('Tổng hợp điều hành toàn trường');
  const [analysisQuestion, setAnalysisQuestion] = useState('');
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [analysisError, setAnalysisError] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const handleRunAnalysis = async (customScope?: string) => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    setAnalysisError(false);
    setAnalysisResult('');
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 65_000);
    try {
      const finalText = await postSseWithFallback({
        streamUrl: '/api/ai/analyze-stream',
        fallbackUrl: '/api/ai/analyze',
        signal: controller.signal,
        isTimedOut: () => timedOut,
        payload: {
          focus: customScope || analysisScope,
          stats: metricsSummary,
          role: currentUser.role,
          question: analysisQuestion.trim() || undefined,
        },
        onUpdate: (partialText) => {
          setAnalysisResult(partialText);
        },
      });
      setAnalysisResult(finalText);
    } catch (err) {
      setAnalysisError(true);
      setAnalysisResult(
        timedOut
          ? 'Yêu cầu phân tích AI vượt quá thời gian chờ phản hồi. Vui lòng thử lại sau giây lát.'
          : err instanceof Error && err.message
            ? err.message
            : 'Không thể kết nối máy chủ AI để phân tích dữ liệu.'
      );
    } finally {
      window.clearTimeout(timeoutId);
      setIsAnalyzing(false);
    }
  };

  const handleExportReport = async () => {
    const summaryRows = [
      { metric: 'Học sinh (trong phạm vi)', value: metricsSummary.studentsCount },
      { metric: 'Giáo viên', value: metricsSummary.teachersCount },
      { metric: 'Lớp học', value: metricsSummary.classesCount },
      { metric: 'Tổng đầu sách thư viện', value: metricsSummary.booksCount },
      { metric: 'Sách đang mượn', value: metricsSummary.activeLoans },
      { metric: 'Phản ánh (trong phạm vi)', value: metricsSummary.feedbackCount },
      { metric: 'Phiếu bảo trì đang mở', value: metricsSummary.openMaintenance },
    ];

    const wb = new ExcelJS.Workbook();
    wb.creator = 'SchoolHub Analytics Export';
    const wsSummary = wb.addWorksheet('TONG_HOP_KPI');
    wsSummary.columns = [
      { header: 'Chỉ số vận hành (theo phạm vi RBAC)', key: 'metric', width: 36 },
      { header: 'Giá trị thực tế', key: 'value', width: 18 },
    ];
    summaryRows.forEach((r) => wsSummary.addRow(r));

    const wsGrades = wb.addWorksheet('PHAN_BO_HOC_LUC');
    wsGrades.columns = [
      { header: 'Xếp loại', key: 'tier', width: 22 },
      { header: 'Số lượng', key: 'count', width: 14 },
    ];
    gradeData.forEach((g) => wsGrades.addRow(g));

    const wsBooks = wb.addWorksheet('CO_CAU_SACH');
    wsBooks.columns = [
      { header: 'Thể loại', key: 'name', width: 28 },
      { header: 'Số bản', key: 'value', width: 14 },
    ];
    bookCategoryData.forEach((b) => wsBooks.addRow(b));

    if (externalDatasets.length > 0) {
      const wsExt = wb.addWorksheet('THAM_CHIEU_QUOC_TE');
      wsExt.columns = [
        { header: 'Mã chỉ số', key: 'code', width: 24 },
        { header: 'Tên chỉ tiêu', key: 'name', width: 38 },
        { header: 'Giá trị', key: 'value', width: 16 },
        { header: 'Đơn vị', key: 'unit', width: 14 },
        { header: 'Nguồn xác minh', key: 'notes', width: 34 },
      ];
      externalDatasets.forEach((d) =>
        wsExt.addRow({
          code: d.code,
          name: d.name,
          value: d.value ?? '',
          unit: d.unit ?? '',
          notes: d.notes ?? '',
        })
      );
    }

    const fileName = `Bao_cao_Tong_hop_SchoolHub_${new Date().toISOString().split('T')[0]}.xlsx`;
    const buffer = await wb.xlsx.writeBuffer();
    triggerBinaryDownload(
      new Uint8Array(buffer as ArrayBuffer),
      fileName,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );

    if (onLogExport) {
      await onLogExport({
        id: `EXP-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        moduleKey: 'external_datasets',
        moduleTitle: 'Báo cáo Thống kê Tổng hợp',
        appId: 'analytics',
        format: 'xlsx',
        scope: 'filtered',
        rowCount: summaryRows.length + gradeData.length + bookCategoryData.length,
        columnCount: 2,
        fileName,
        actorName: currentUser.displayName,
        actorRole: currentUser.role,
        timestamp: new Date().toISOString(),
      });
    }
  };

  return (
    <AppWindowShell
      appId="analytics"
      activeTab={activeTab}
      userRole={currentUser.role}
      userProfile={currentUser}
      customPermissions={customPermissions}
      onSelectTab={onSelectTab}
    >
      {(tabId) => (
        <>
          {tabId === 'dashboard' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                  title="Học sinh (phạm vi)"
                  value={metricsSummary.studentsCount}
                  subtitle={`${metricsSummary.classesCount} lớp học`}
                  icon={Users}
                  gradient="blue-cyan"
                />
                <StatCard
                  title="Giáo viên"
                  value={metricsSummary.teachersCount}
                  subtitle="Đội ngũ giảng dạy"
                  icon={GraduationCap}
                  gradient="purple-blue"
                />
                <StatCard
                  title="Thư viện RFID"
                  value={metricsSummary.booksCount}
                  subtitle={`${metricsSummary.activeLoans} đang mượn`}
                  icon={BookOpen}
                  gradient="cyan-mint"
                />
                <StatCard
                  title="Phản ánh & Bảo trì"
                  value={metricsSummary.feedbackCount + metricsSummary.openMaintenance}
                  subtitle={`${metricsSummary.openMaintenance} phiếu sửa chữa mở`}
                  icon={MessageSquare}
                  gradient="peach-pink"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <LiquidCard className="p-5 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      Phân tích Thông minh bằng Groq AI
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Tổng hợp chỉ số thực tế thành báo cáo điều hành trong vài giây
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectTab('ai-analysis')}
                    className="px-3.5 py-2 rounded-xl bg-purple-600 text-white text-xs font-bold shrink-0 cursor-pointer"
                  >
                    Mở Phân tích AI
                  </button>
                </LiquidCard>

                <LiquidCard className="p-5 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      Dữ liệu &amp; Đối chiếu World Bank ({externalDatasets.length})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {externalDatasets.length > 0
                        ? `Đang tích hợp ${externalDatasets.length} chỉ số quốc tế (World Bank / Excel) vào báo cáo & AI`
                        : 'Nhập Excel chuẩn hóa hoặc đồng bộ chỉ số giáo dục từ World Bank & REST Countries'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectTab('data')}
                    className="px-3.5 py-2 rounded-xl bg-sky-600 text-white text-xs font-bold shrink-0 cursor-pointer"
                  >
                    Quản lý dữ liệu
                  </button>
                </LiquidCard>
              </div>
            </div>
          )}

          {tabId === 'reports' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  data-testid="btn-export-analytics-unified"
                  onClick={() => void handleExportReport()}
                  className="px-3.5 py-2 rounded-xl glass-subsurface text-xs font-semibold text-slate-800 dark:text-slate-100 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                >
                  <Download className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" /> Xuất Excel
                </button>
                <button
                  type="button"
                  onClick={() => handleRunAnalysis('Báo cáo điều hành Ban Giám Hiệu')}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm whitespace-nowrap shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isAnalyzing ? 'Đang phân tích...' : 'AI Tóm tắt Báo cáo'}
                </button>
              </div>

              {(analysisResult || isAnalyzing) && (
                <LiquidCard className="p-4 border-purple-400/50 dark:border-purple-500/40">
                  <p className="text-xs font-bold text-purple-700 dark:text-purple-300 mb-1.5 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Tóm tắt phân tích AI
                  </p>
                  {analysisResult ? (
                    <FormattedAiText
                      text={analysisResult}
                      isStreaming={isAnalyzing}
                      className="text-xs text-slate-700 dark:text-slate-200"
                    />
                  ) : (
                    <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                      Đang tổng hợp số liệu...
                    </div>
                  )}
                </LiquidCard>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <LiquidCard className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Phân bố Học lực Thực tế</h3>
                    <Badge variant="blue" size="sm">
                      {scopedAcademic.length > 0 ? `${scopedAcademic.length} điểm môn` : `${scopedStudents.length} HS`}
                    </Badge>
                  </div>
                  {scopedStudents.length === 0 && scopedAcademic.length === 0 ? (
                    <EmptyState
                      icon={BarChart3}
                      title="Chưa có dữ liệu điểm"
                      description="Thêm học sinh hoặc cập nhật kết quả trong ứng dụng Nhà trường để xem biểu đồ phân bố."
                      action={
                        <button
                          type="button"
                          onClick={() => onOpenTargetApp('school', 'students-classes')}
                          className="px-3 py-1.5 rounded-xl bg-sky-600 text-white text-xs font-semibold cursor-pointer"
                        >
                          Mở Nhà trường
                        </button>
                      }
                    />
                  ) : (
                    <div className="h-60 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={gradeData}>
                          <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.25} />
                          <XAxis dataKey="tier" tick={{ fontSize: 11 }} />
                          <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'rgba(15, 23, 42, 0.96)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              borderRadius: '12px',
                              color: '#f8fafc',
                              fontSize: '12px',
                            }}
                            itemStyle={{ color: '#f8fafc' }}
                            labelStyle={{ color: '#e2e8f0', fontWeight: 700 }}
                          />
                          <Bar dataKey="count" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </LiquidCard>

                <LiquidCard className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-white">Cơ cấu Đầu sách Thư viện</h3>
                    <Badge variant="mint" size="sm">{books.length} đầu sách</Badge>
                  </div>
                  {bookCategoryData.length === 0 ? (
                    <EmptyState
                      icon={BookOpen}
                      title="Chưa có sách trong thư viện"
                      description="Thêm đầu sách ở ứng dụng Thư viện để hiển thị biểu đồ cơ cấu thể loại."
                      action={
                        <button
                          type="button"
                          onClick={() => onOpenTargetApp('library', 'catalog')}
                          className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                        >
                          Mở Thư viện
                        </button>
                      }
                    />
                  ) : (
                    <div className="h-60 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={bookCategoryData}
                            cx="50%"
                            cy="50%"
                            innerRadius={48}
                            outerRadius={78}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {bookCategoryData.map((_, idx) => (
                              <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip
                            contentStyle={{
                              backgroundColor: 'rgba(15, 23, 42, 0.96)',
                              border: '1px solid rgba(255,255,255,0.2)',
                              borderRadius: '12px',
                              color: '#f8fafc',
                              fontSize: '12px',
                            }}
                            itemStyle={{ color: '#f8fafc' }}
                            labelStyle={{ color: '#e2e8f0', fontWeight: 700 }}
                          />
                          <Legend wrapperStyle={{ fontSize: '11px' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </LiquidCard>
              </div>
            </div>
          )}

          {tabId === 'ai-analysis' && (
            <div className="space-y-4 max-w-4xl">
              <LiquidCard className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Phạm vi phân tích</label>
                    <select
                      value={analysisScope}
                      onChange={(e) => setAnalysisScope(e.target.value)}
                      className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                    >
                      <option value="Tổng hợp điều hành toàn trường">Tổng hợp điều hành toàn trường</option>
                      <option value="Học tập, chuyên cần & chất lượng lớp học">Học tập, chuyên cần &amp; chất lượng lớp học</option>
                      <option value="Lưu thông sách & hiệu suất Thư viện RFID">Lưu thông sách &amp; hiệu suất Thư viện RFID</option>
                      <option value="Cơ sở vật chất, bảo trì & phản ánh học sinh">Cơ sở vật chất, bảo trì &amp; phản ánh học sinh</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Câu hỏi trọng tâm (tùy chọn)</label>
                    <input
                      type="text"
                      value={analysisQuestion}
                      onChange={(e) => setAnalysisQuestion(e.target.value)}
                      placeholder="VD: Đề xuất 3 việc ưu tiên tuần tới..."
                      className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl glass-subsurface font-mono-tabular text-[11px] flex flex-wrap gap-3 text-slate-700 dark:text-slate-200">
                  <span>HS: {metricsSummary.studentsCount}</span>
                  <span>GV: {metricsSummary.teachersCount}</span>
                  <span>Lớp: {metricsSummary.classesCount}</span>
                  <span>Sách: {metricsSummary.booksCount}</span>
                  <span>Đang mượn: {metricsSummary.activeLoans}</span>
                  <span>Bảo trì mở: {metricsSummary.openMaintenance}</span>
                </div>

                <button
                  type="button"
                  disabled={isAnalyzing}
                  onClick={() => handleRunAnalysis()}
                  className="px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-sm whitespace-nowrap"
                >
                  <Sparkles className="w-4 h-4" />
                  {isAnalyzing ? 'Đang phân tích dữ liệu...' : 'Chạy Phân tích AI'}
                </button>
              </LiquidCard>

              {(analysisResult || isAnalyzing) && (
                <LiquidCard className={`p-5 space-y-3 ${analysisError ? 'border-rose-400/50 bg-rose-500/10' : ''}`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className={`flex flex-wrap items-center gap-2 font-bold text-xs ${analysisError ? 'text-rose-700 dark:text-rose-300' : 'text-purple-700 dark:text-purple-300'}`}>
                      <Sparkles className="w-4 h-4" /> {analysisError ? 'Thông báo từ Trợ lý AI' : 'Kết quả Phân tích AI'}
                    </div>
                    {!analysisError && !isAnalyzing && analysisResult && (
                      <button
                        type="button"
                        onClick={() => {
                          const content = `# Phân tích AI: ${analysisScope}\n\n${analysisResult}`;
                          triggerBinaryDownload(
                            new TextEncoder().encode(content),
                            `Phan_tich_AI_${new Date().toISOString().split('T')[0]}.md`,
                            'text/markdown;charset=utf-8'
                          );
                        }}
                        className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <Download className="w-3 h-3" /> Tải kết quả (.md)
                      </button>
                    )}
                  </div>
                  {analysisResult ? (
                    <FormattedAiText
                      text={analysisResult}
                      isStreaming={isAnalyzing && !analysisError}
                      className={`text-xs sm:text-sm ${analysisError ? 'text-rose-800 dark:text-rose-200' : 'text-slate-700 dark:text-slate-200'}`}
                    />
                  ) : (
                    <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                      Đang phân tích dữ liệu...
                    </div>
                  )}
                </LiquidCard>
              )}
            </div>
          )}

          {tabId === 'data' && (
            <DataCenterView
              currentUser={currentUser}
              customPermissions={customPermissions}
              validationContext={validationContext}
              importHistory={importHistory}
              exportHistory={exportHistory}
              externalDatasets={externalDatasets}
              onUnifiedImportCommit={onUnifiedImportCommit}
              onLogExport={onLogExport}
              onOpenTargetApp={onOpenTargetApp}
              onImportStudents={onImportStudents}
              onImportBooks={onImportBooks}
              onImportTeachers={onImportTeachers}
            />
          )}
        </>
      )}
    </AppWindowShell>
  );
};
