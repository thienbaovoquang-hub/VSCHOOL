import React, { useState, useMemo, useRef, useEffect } from 'react';
import ExcelJS from 'exceljs';
import {
  PieChart as PieChartIcon, BarChart3, BrainCircuit, Bot,
  Sparkles, Download, Send, Users, BookOpen, GraduationCap, MessageSquare, Trash2
} from 'lucide-react';
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
  buildRoleScopedAISummary,
  DEFAULT_PERMISSIONS,
  filterAcademicRecordsByScope,
  filterFeedbacksByScope,
  filterStudentsByScope,
} from '../../utils/rbac';

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

  const metricsSummary = useMemo(() => {
    const relevantBorrows =
      currentUser.role === 'student'
        ? borrowTransactions.filter((t) => t.studentId === currentUser.id)
        : borrowTransactions;
    const activeLoans = relevantBorrows.filter(
      (t) => t.status !== 'returned' && t.status !== 'lost'
    ).length;
    const overdueLoans = relevantBorrows.filter((t) => t.status === 'overdue').length;
    const openMaintenance = maintenance.filter((m) => m.status !== 'completed').length;
    const resolvedFeedback = scopedFeedbacks.filter(
      (f) => f.status === 'resolved' || f.status === 'closed'
    ).length;

    const ownAvgScore =
      scopedAcademic.length > 0
        ? scopedAcademic.reduce((acc, r) => acc + r.averageScore, 0) / scopedAcademic.length
        : null;

    const roleSummaryText = buildRoleScopedAISummary({
      currentUser,
      studentsCount: scopedStudents.length,
      teachersCount: currentUser.role === 'student' ? 0 : teachers.length,
      classesCount: currentUser.role === 'student' ? 1 : classes.length,
      booksCount: books.length,
      activeBorrowsCount: activeLoans,
      overdueBorrowsCount: overdueLoans,
      openFeedbacksCount: scopedFeedbacks.length - resolvedFeedback,
      openMaintenanceCount: openMaintenance,
      ownGradesCount: scopedAcademic.length,
      ownAvgScore,
    });

    return {
      studentsCount: scopedStudents.length,
      teachersCount: currentUser.role === 'student' ? 0 : teachers.length,
      classesCount: currentUser.role === 'student' ? 1 : classes.length,
      booksCount: books.length,
      totalTransactions: relevantBorrows.length,
      activeLoans,
      announcementsCount: announcements.filter((a) => (a.status || 'published') === 'published').length,
      feedbackCount: scopedFeedbacks.length,
      resolvedFeedback,
      facilitiesCount: currentUser.role === 'student' ? 0 : facilities.length,
      openMaintenance,
      roleSummaryText,
    };
  }, [
    currentUser,
    scopedStudents.length,
    teachers.length,
    classes.length,
    books.length,
    borrowTransactions,
    announcements,
    scopedFeedbacks,
    scopedAcademic,
    facilities.length,
    maintenance,
  ]);

  // AI Analysis state
  const [analysisScope, setAnalysisScope] = useState('Tổng hợp điều hành toàn trường');
  const [analysisQuestion, setAnalysisQuestion] = useState('');
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Embedded AI Assistant state
  const [chatMessages, setChatMessages] = useState<
    Array<{ id: string; sender: 'user' | 'assistant'; text: string; time: string }>
  >([
    {
      id: 'welcome',
      sender: 'assistant',
      text: `Xin chào ${currentUser.displayName}! Tôi là SchoolHub AI Copilot. Hãy đặt câu hỏi về học tập, quy chế thư viện RFID, hướng nghiệp hoặc dữ liệu trong phạm vi quyền của bạn.`,
      time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, isChatLoading]);

  const handleRunAnalysis = async (customScope?: string) => {
    if (isAnalyzing) return;
    setIsAnalyzing(true);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          focus: customScope || analysisScope,
          stats: metricsSummary,
          role: currentUser.role,
          question: analysisQuestion.trim() || undefined,
        }),
      });
      const data = await res.json();
      setAnalysisResult(
        res.ok && data?.text
          ? String(data.text)
          : String(data?.error || 'Không thể phân tích dữ liệu lúc này.')
      );
    } catch {
      setAnalysisResult('Không thể kết nối máy chủ AI để phân tích dữ liệu.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendChat = async (preset?: string) => {
    const q = (preset || chatInput).trim();
    if (!q || isChatLoading) return;
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    setChatMessages((prev) => [...prev, { id: String(Date.now()), sender: 'user', text: q, time: nowTime }]);
    setChatInput('');
    setIsChatLoading(true);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: q,
          contextSummary: metricsSummary.roleSummaryText,
          user: {
            displayName: currentUser.displayName,
            role: currentUser.role,
            className: currentUser.className || currentUser.studentCode || currentUser.email || 'THPT',
          },
        }),
      });
      const data = await res.json();
      setChatMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'assistant',
          text: res.ok && data?.text ? String(data.text) : String(data?.error || 'Lỗi phản hồi AI.'),
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'assistant',
          text: 'Không thể kết nối đến máy chủ AI lúc này.',
          time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsChatLoading(false);
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
              <div>
                <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <PieChartIcon className="w-5 h-5 text-purple-600" />
                  Dashboard Tổng hợp Dữ liệu Thực
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Số liệu được lọc theo đúng phạm vi vai trò RBAC (không bao gồm dữ liệu tư vấn tâm lý mật)
                </p>
              </div>

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
                      Phân tích Thông minh bằng Gemini AI
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
                      Nhập & Xuất Excel (.xlsx)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Tải file mẫu chuẩn hóa và nhập học sinh, giáo viên, sách hàng loạt
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
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-sky-600" />
                    Báo cáo & Biểu đồ Thống kê
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Tổng hợp trực tiếp từ hồ sơ học tập, kho sách và phản ánh trong phạm vi quyền
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    data-testid="btn-export-analytics-unified"
                    onClick={() => void handleExportReport()}
                    className="px-3.5 py-2 rounded-xl bg-white/85 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-600" /> Xuất Excel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRunAnalysis('Báo cáo điều hành Ban Giám Hiệu')}
                    className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {isAnalyzing ? 'Đang phân tích...' : 'AI Tóm tắt Báo cáo'}
                  </button>
                </div>
              </div>

              {analysisResult && (
                <LiquidCard className="p-4 border-purple-300/60 dark:border-purple-700/60">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-300 mb-1">
                    Tóm tắt phân tích AI
                  </p>
                  <div className="text-xs whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-200">
                    {analysisResult}
                  </div>
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
                          <Tooltip />
                          <Bar dataKey="count" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </LiquidCard>

                <LiquidCard className="p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">Cơ cấu Đầu sách Thư viện</h3>
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
                          <Tooltip />
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
              <div>
                <h2 className="text-lg font-extrabold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <BrainCircuit className="w-5 h-5 text-purple-600" />
                  Phân tích Dữ liệu Trường học bằng AI
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Gửi số liệu tổng hợp theo phạm vi quyền hạn tới mô hình Gemini phía máy chủ
                </p>
              </div>

              <LiquidCard className="p-5 space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold mb-1">Phạm vi phân tích</label>
                    <select
                      value={analysisScope}
                      onChange={(e) => setAnalysisScope(e.target.value)}
                      className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                    >
                      <option value="Tổng hợp điều hành toàn trường">Tổng hợp điều hành toàn trường</option>
                      <option value="Học tập, chuyên cần & chất lượng lớp học">Học tập, chuyên cần & chất lượng lớp học</option>
                      <option value="Lưu thông sách & hiệu suất Thư viện RFID">Lưu thông sách & hiệu suất Thư viện RFID</option>
                      <option value="Cơ sở vật chất, bảo trì & phản ánh học sinh">Cơ sở vật chất, bảo trì & phản ánh học sinh</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">Câu hỏi trọng tâm (tùy chọn)</label>
                    <input
                      type="text"
                      value={analysisQuestion}
                      onChange={(e) => setAnalysisQuestion(e.target.value)}
                      placeholder="VD: Đề xuất 3 việc ưu tiên tuần tới..."
                      className="w-full bg-white/80 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                    />
                  </div>
                </div>

                <div className="p-3 rounded-xl bg-slate-100/70 dark:bg-slate-800/70 font-mono-tabular text-[11px] flex flex-wrap gap-3">
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
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  {isAnalyzing ? 'Đang phân tích dữ liệu...' : 'Chạy Phân tích AI'}
                </button>
              </LiquidCard>

              {analysisResult && (
                <LiquidCard className="p-5 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-purple-700 dark:text-purple-300 font-bold text-xs uppercase tracking-wider">
                      <Sparkles className="w-4 h-4" /> Kết quả Phân tích AI
                    </div>
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
                      className="px-3 py-1 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-[11px] font-semibold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                    >
                      <Download className="w-3 h-3" /> Tải kết quả (.md)
                    </button>
                  </div>
                  <div className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-200">
                    {analysisResult}
                  </div>
                </LiquidCard>
              )}
            </div>
          )}

          {tabId === 'ai-assistant' && (
            <div className="h-full flex flex-col min-h-[420px] max-h-[600px] gap-3">
              <div className="flex items-center justify-between gap-2 shrink-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-purple-500 to-indigo-500 text-white flex items-center justify-center shrink-0">
                    <Bot className="w-4 h-4" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-sm font-extrabold text-slate-800 dark:text-slate-100 truncate">
                      SchoolHub AI Copilot
                    </h2>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                      Trợ lý hỏi đáp học đường kết nối Gemini phía máy chủ (bảo mật theo RBAC)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setChatMessages([chatMessages[0]])}
                  className="px-2.5 py-1.5 rounded-xl text-xs text-slate-500 hover:text-rose-600 inline-flex items-center gap-1 shrink-0 whitespace-nowrap cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Làm mới
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                {[
                  'Quy trình mượn sách RFID?',
                  'Mẹo ôn thi Toán hiệu quả',
                  'Cách gửi phản ánh ẩn danh',
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => handleSendChat(chip)}
                    className="px-3 py-1 rounded-xl bg-white/75 dark:bg-slate-800/75 border border-slate-200 dark:border-slate-700 text-[11px] font-medium hover:border-sky-400 cursor-pointer"
                  >
                    {chip}
                  </button>
                ))}
              </div>

              <div
                ref={chatScrollRef}
                className="flex-1 min-h-0 overflow-y-auto space-y-3 p-3 rounded-2xl bg-white/45 dark:bg-slate-900/45 border border-slate-200/60 dark:border-slate-700/60"
              >
                {chatMessages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[82%] rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed ${
                        m.sender === 'user'
                          ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white'
                          : 'bg-white/90 dark:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200/60 dark:border-slate-700'
                      }`}
                    >
                      {m.text}
                      <div className={`text-[10px] mt-1 ${m.sender === 'user' ? 'text-white/70 text-right' : 'text-slate-400'}`}>
                        {m.time}
                      </div>
                    </div>
                  </div>
                ))}
                {isChatLoading && (
                  <div className="text-xs text-slate-400 italic px-2">Copilot đang trả lời...</div>
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendChat();
                }}
                className="flex items-center gap-2 shrink-0"
              >
                <input
                  type="text"
                  data-testid="ai-chat-input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Nhập câu hỏi cho SchoolHub Copilot..."
                  className="flex-1 bg-white/85 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-slate-800 dark:text-slate-100"
                />
                <button
                  type="submit"
                  data-testid="ai-chat-send"
                  disabled={isChatLoading || !chatInput.trim()}
                  className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-xs font-bold disabled:opacity-40 inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-4 h-4" /> Gửi
                </button>
              </form>
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
