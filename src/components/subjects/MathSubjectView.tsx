import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Plus, Trash2 } from '../icons/UiIcons';
import type { MathFormulaCard, MathQuestionItem } from '../../data/subjectsSeedData';
import {
  loadSubjectCollection,
  saveSubjectCollection,
} from '../../utils/subjects/subjectDataStore';
import {
  computeTriangleMetrics,
  evaluateMathExpression,
  sampleMathFunction,
} from '../../utils/subjects/subjectWorkspaceEngine';
import { Modal } from '../common/Modal';
import {
  SubjectEmptyState,
  SubjectWorkspaceShell,
  type GeneratedAiCardItem,
  type GeneratedAiQuizItem,
  type SubjectHostWorkspaceProps,
} from './SubjectWorkspaceShared';

export const MathSubjectView: React.FC<SubjectHostWorkspaceProps> = (props) => {
  const userId = props.currentUser.id;
  const [subTab, setSubTab] = useState<string>('theory');
  const [formulas, setFormulas] = useState<MathFormulaCard[]>(() =>
    loadSubjectCollection<MathFormulaCard>(userId, 'math', 'formulas')
  );
  const [questions, setQuestions] = useState<MathQuestionItem[]>(() =>
    loadSubjectCollection<MathQuestionItem>(userId, 'math', 'questions')
  );
  const [topicFilter, setTopicFilter] = useState<string>('all');

  useEffect(() => {
    saveSubjectCollection(userId, 'math', 'formulas', formulas);
  }, [userId, formulas]);
  useEffect(() => {
    saveSubjectCollection(userId, 'math', 'questions', questions);
  }, [userId, questions]);

  // Interactive Lab switcher + Function Grapher state
  const [graphTool, setGraphTool] = useState<'plotter' | 'triangle'>('plotter');
  const [expr1, setExpr1] = useState('');
  const [expr2, setExpr2] = useState('');
  const [xRange, setXRange] = useState(6);
  const [probeX, setProbeX] = useState(1);

  // Triangle 2D Explorer state
  const [sideA, setSideA] = useState(5);
  const [sideB, setSideB] = useState(4);
  const [sideC, setSideC] = useState(3);

  // Practice state
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, number>>({});
  const [textAnswers, setTextAnswers] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);

  // Modals
  const [formulaModalOpen, setFormulaModalOpen] = useState(false);
  const [fGrade, setFGrade] = useState<MathFormulaCard['grade']>('Lớp 10');
  const [fTopic, setFTopic] = useState<MathFormulaCard['topic']>('Đại số');
  const [fTitle, setFTitle] = useState('');
  const [fExpr, setFExpr] = useState('');
  const [fNote, setFNote] = useState('');

  const [questionModalOpen, setQuestionModalOpen] = useState(false);
  const [qType, setQType] = useState<MathQuestionItem['qtype']>('mcq');
  const [qGrade, setQGrade] = useState<MathQuestionItem['grade']>('Lớp 10');
  const [qTopic, setQTopic] = useState('Đại số');
  const [qPrompt, setQPrompt] = useState('');
  const [qOptA, setQOptA] = useState('');
  const [qOptB, setQOptB] = useState('');
  const [qOptC, setQOptC] = useState('');
  const [qOptD, setQOptD] = useState('');
  const [qCorrectIdx, setQCorrectIdx] = useState(0);
  const [qNumAns, setQNumAns] = useState('');
  const [qSolution, setQSolution] = useState('');

  const filteredFormulas = useMemo(
    () => formulas.filter((f) => topicFilter === 'all' || f.topic === topicFilter),
    [formulas, topicFilter]
  );

  // Compute SVG Plot paths for f(x) and g(x)
  const plotData = useMemo(() => {
    const xMin = -xRange;
    const xMax = xRange;
    const yMin = -xRange;
    const yMax = xRange;
    const width = 460;
    const height = 280;
    const toPx = (x: number, y: number) => ({
      px: ((x - xMin) / (xMax - xMin)) * width,
      py: height - ((y - yMin) / (yMax - yMin)) * height,
    });

    const buildPath = (expr: string) => {
      if (!expr.trim()) return '';
      const samples = sampleMathFunction(expr, xMin, xMax, 140);
      let d = '';
      let penUp = true;
      for (const s of samples) {
        if (s.y === null || s.y < yMin * 2 || s.y > yMax * 2) {
          penUp = true;
          continue;
        }
        const { px, py } = toPx(s.x, s.y);
        d += `${penUp ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)} `;
        penUp = false;
      }
      return d.trim();
    };

    const y1AtProbe = expr1.trim() ? evaluateMathExpression(expr1, probeX) : null;
    const y2AtProbe = expr2.trim() ? evaluateMathExpression(expr2, probeX) : null;

    return {
      width,
      height,
      origin: toPx(0, 0),
      path1: buildPath(expr1),
      path2: buildPath(expr2),
      probe1: y1AtProbe !== null ? toPx(probeX, y1AtProbe) : null,
      y1AtProbe,
      y2AtProbe,
    };
  }, [expr1, expr2, probeX, xRange]);

  const triangle = useMemo(
    () => computeTriangleMetrics(sideA, sideB, sideC),
    [sideA, sideB, sideC]
  );

  const triangleSvg = useMemo(() => {
    if (!triangle.valid) return null;
    const cosA = (sideB * sideB + sideC * sideC - sideA * sideA) / (2 * sideB * sideC);
    const sinA = Math.sqrt(Math.max(0, 1 - cosA * cosA));
    const ax = 0;
    const ay = 0;
    const bx = sideC;
    const by = 0;
    const cx = sideB * cosA;
    const cy = sideB * sinA;

    const minX = Math.min(ax, bx, cx);
    const maxX = Math.max(ax, bx, cx);
    const maxY = Math.max(ay, by, cy, 0.5);
    const spanX = Math.max(1, maxX - minX);
    const scale = Math.min(220 / spanX, 130 / maxY);
    const padX = (320 - spanX * scale) / 2 - minX * scale;
    const baseY = 166;

    const mapPt = (x: number, y: number) => ({
      x: padX + x * scale,
      y: baseY - y * scale,
    });

    return {
      pA: mapPt(ax, ay),
      pB: mapPt(bx, by),
      pC: mapPt(cx, cy),
    };
  }, [sideA, sideB, sideC, triangle.valid]);

  const handleAddFormula = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fTitle.trim() || !fExpr.trim()) return;
    setFormulas((prev) => [
      {
        id: `m-f-${Date.now()}`,
        grade: fGrade,
        topic: fTopic,
        title: fTitle.trim(),
        expression: fExpr.trim(),
        note: fNote.trim(),
      },
      ...prev,
    ]);
    setFTitle('');
    setFExpr('');
    setFNote('');
    setFormulaModalOpen(false);
  };

  const handleAddQuestion = (e: React.FormEvent) => {
    e.preventDefault();
    if (!qPrompt.trim()) return;
    const opts = [qOptA, qOptB, qOptC, qOptD].map((s) => s.trim()).filter(Boolean);
    setQuestions((prev) => [
      {
        id: `m-q-${Date.now()}`,
        qtype: qType,
        grade: qGrade,
        topic: qTopic.trim() || 'Đại số',
        question: qPrompt.trim(),
        ...(qType === 'mcq' && opts.length >= 2
          ? { options: opts, correctIndex: Math.min(qCorrectIdx, opts.length - 1) }
          : {}),
        ...(qType === 'num' ? { numericAnswer: qNumAns.trim() } : {}),
        solution: qSolution.trim(),
      },
      ...prev,
    ]);
    setQPrompt('');
    setQOptA('');
    setQOptB('');
    setQOptC('');
    setQOptD('');
    setQNumAns('');
    setQSolution('');
    setQuestionModalOpen(false);
  };

  const handleGradeMath = () => {
    if (questions.length === 0) return;
    setSubmitted(true);
    let earned = 0;
    let gradable = 0;
    for (const q of questions) {
      if (q.qtype === 'mcq') {
        gradable++;
        if (mcqAnswers[q.id] === q.correctIndex) earned++;
      } else if (q.qtype === 'num') {
        gradable++;
        const userNum = Number((textAnswers[q.id] || '').trim().replace(',', '.'));
        const expected = Number(q.numericAnswer || '');
        if (Number.isFinite(userNum) && Math.abs(userNum - expected) < 0.01) earned++;
      }
    }
    if (gradable > 0) {
      props.onRecordPracticeResult(earned, gradable, 'Toán học');
    }
  };

  const handleImportExcelRows = (rows: Array<Record<string, unknown>>) => {
    if (subTab === 'practice') {
      const mapped: MathQuestionItem[] = rows
        .map((r, i) => {
          if (!r.question) return null;
          const qtype = (String(r.qtype || 'mcq') as MathQuestionItem['qtype']) || 'mcq';
          const opts = [r.optionA, r.optionB, r.optionC, r.optionD]
            .map((x) => String(x || '').trim())
            .filter(Boolean);
          const ansLetter = String(r.answer || 'A').trim().toUpperCase();
          const idx = ['A', 'B', 'C', 'D'].indexOf(ansLetter);
          return {
            id: `m-imp-q-${Date.now()}-${i}`,
            qtype,
            grade: (String(r.grade || 'Lớp 10') as MathQuestionItem['grade']) || 'Lớp 10',
            topic: String(r.topic || 'Đại số'),
            question: String(r.question),
            ...(qtype === 'mcq' && opts.length >= 2
              ? { options: opts, correctIndex: idx >= 0 ? idx : 0 }
              : {}),
            ...(qtype === 'num' ? { numericAnswer: String(r.answer || '') } : {}),
            solution: String(r.solution || ''),
          };
        })
        .filter((x): x is MathQuestionItem => Boolean(x));
      if (mapped.length > 0) setQuestions((prev) => [...mapped, ...prev]);
    } else {
      const mapped: MathFormulaCard[] = rows
        .map((r, i) => {
          if (!r.name && !r.title) return null;
          return {
            id: `m-imp-f-${Date.now()}-${i}`,
            grade: (String(r.grade || 'Lớp 10') as MathFormulaCard['grade']) || 'Lớp 10',
            topic: (String(r.topic || 'Đại số') as MathFormulaCard['topic']) || 'Đại số',
            title: String(r.name || r.title),
            expression: String(r.expression || r.formula || ''),
            note: String(r.note || r.summary || ''),
          };
        })
        .filter((x): x is MathFormulaCard => Boolean(x));
      if (mapped.length > 0) setFormulas((prev) => [...mapped, ...prev]);
    }
  };

  return (
    <SubjectWorkspaceShell
      {...props}
      activeSubTab={subTab}
      onChangeSubTab={setSubTab}
      liveContextSummary={`Toán học${expr1 ? ` · f(x)=${expr1}` : ''} · Tam giác (${sideA}, ${sideB}, ${sideC})`}
      excelModuleKey={subTab === 'practice' ? 'questions' : 'formula'}
      excelExportRecords={
        subTab === 'practice'
          ? questions.map((q) => ({
              qtype: q.qtype,
              topic: q.topic,
              grade: q.grade,
              question: q.question,
              optionA: q.options?.[0] || '',
              optionB: q.options?.[1] || '',
              optionC: q.options?.[2] || '',
              optionD: q.options?.[3] || '',
              answer:
                q.qtype === 'mcq'
                  ? ['A', 'B', 'C', 'D'][q.correctIndex ?? 0]
                  : q.numericAnswer || '',
              solution: q.solution,
            }))
          : formulas.map((f) => ({
              name: f.title,
              grade: f.grade,
              topic: f.topic,
              expression: f.expression,
              note: f.note,
            }))
      }
      onImportExcelRows={handleImportExcelRows}
      onInjectGeneratedQuiz={(generated: GeneratedAiQuizItem[]) => {
        const next: MathQuestionItem[] = generated.map((g, i) => ({
          id: `m-ai-q-${Date.now()}-${i}`,
          qtype: 'mcq',
          grade: 'Lớp 12',
          topic: g.topic || 'Đại số',
          question: g.question,
          options: g.options,
          correctIndex: g.correctIndex,
          solution: g.explanation,
        }));
        setQuestions((prev) => [...next, ...prev]);
        setSubTab('practice');
      }}
      onInjectGeneratedCards={(cards: GeneratedAiCardItem[]) => {
        const next: MathFormulaCard[] = cards.map((c, i) => ({
          id: `m-ai-f-${Date.now()}-${i}`,
          grade: 'Lớp 12',
          topic: 'Giải tích',
          title: c.front,
          expression: c.back,
          note: c.example || c.tip,
        }));
        setFormulas((prev) => [...next, ...prev]);
        setSubTab('theory');
      }}
    >
      {subTab === 'theory' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {['all', 'Đại số', 'Giải tích', 'Hình học', 'Lượng giác', 'Xác suất'].map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopicFilter(t)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                    topicFilter === t
                      ? 'bg-violet-600 text-white'
                      : 'glass-subsurface text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {t === 'all' ? 'Tất cả' : t}
                </button>
              ))}
            </div>
            <button
              type="button"
              data-testid="math-add-formula-btn"
              onClick={() => setFormulaModalOpen(true)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm công thức</span>
            </button>
          </div>

          {filteredFormulas.length === 0 ? (
            <SubjectEmptyState
              testId="math-formulas-empty"
              title="Chưa có công thức nào."
              actions={[
                { label: '+ Thêm công thức', onClick: () => setFormulaModalOpen(true), primary: true },
                { label: 'Mở đồ thị', onClick: () => setSubTab('graph') },
                { label: 'Tạo bằng AI', onClick: () => setSubTab('ai-tutor') },
              ]}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredFormulas.map((f) => {
                const mastered = props.progress.masteredIds.includes(f.id);
                return (
                  <div key={f.id} className="liquid-glass-panel rounded-2xl p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="text-[11px] font-semibold text-violet-700 dark:text-violet-300">
                          {f.grade} · {f.topic}
                        </span>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                          {f.title}
                        </h3>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => props.onToggleMastered(f.id)}
                          className={`p-1.5 rounded-lg cursor-pointer ${
                            mastered
                              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                              : 'text-slate-400 hover:text-slate-700'
                          }`}
                          title="Đã nhớ"
                        >
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setFormulas((prev) => prev.filter((item) => item.id !== f.id))
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                          title="Xóa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                    <p className="rounded-xl bg-slate-900/5 dark:bg-white/5 px-3 py-2 text-xs sm:text-sm font-mono-tabular font-semibold text-slate-900 dark:text-white">
                      {f.expression}
                    </p>
                    {f.note && (
                      <p className="text-xs text-slate-600 dark:text-slate-300">{f.note}</p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {subTab === 'graph' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex items-center gap-1 p-1 rounded-xl glass-subsurface">
              <button
                type="button"
                onClick={() => setGraphTool('plotter')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  graphTool === 'plotter'
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                Đồ thị hàm số
              </button>
              <button
                type="button"
                onClick={() => setGraphTool('triangle')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                  graphTool === 'triangle'
                    ? 'bg-violet-600 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                Tam giác 2D
              </button>
            </div>

            {graphTool === 'plotter' && (
              <div className="flex items-center gap-1.5">
                {[
                  { label: 'Parabol', f1: 'x^2 - 2*x - 3', f2: '2*x + 1' },
                  { label: 'Lượng giác', f1: '2*sin(x)', f2: 'cos(x)' },
                  { label: 'Bậc 3', f1: '0.2*x^3 - 2*x', f2: '' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => {
                      setExpr1(preset.f1);
                      setExpr2(preset.f2);
                    }}
                    className="px-2.5 py-1.5 rounded-xl glass-subsurface hover:bg-white/80 dark:hover:bg-slate-800/80 text-xs font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap cursor-pointer"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {graphTool === 'plotter' ? (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-8 liquid-glass-panel rounded-2xl p-4 flex flex-col items-center justify-center">
                <svg
                  viewBox={`0 0 ${plotData.width} ${plotData.height}`}
                  className="w-full h-auto max-h-[340px] select-none"
                >
                  {[-4, -2, 0, 2, 4].map((tick) => {
                    const gx = ((tick + xRange) / (2 * xRange)) * plotData.width;
                    const gy =
                      plotData.height - ((tick + xRange) / (2 * xRange)) * plotData.height;
                    return (
                      <g key={tick}>
                        <line x1={gx} y1={0} x2={gx} y2={plotData.height} stroke="currentColor" strokeOpacity={0.08} />
                        <line x1={0} y1={gy} x2={plotData.width} y2={gy} stroke="currentColor" strokeOpacity={0.08} />
                      </g>
                    );
                  })}
                  <line x1={0} y1={plotData.origin.py} x2={plotData.width} y2={plotData.origin.py} stroke="currentColor" strokeOpacity={0.4} strokeWidth={1.5} />
                  <line x1={plotData.origin.px} y1={0} x2={plotData.origin.px} y2={plotData.height} stroke="currentColor" strokeOpacity={0.4} strokeWidth={1.5} />
                  {plotData.path1 && (
                    <path d={plotData.path1} fill="none" stroke="#7C3AED" strokeWidth={2.5} strokeLinecap="round" />
                  )}
                  {plotData.path2 && (
                    <path d={plotData.path2} fill="none" stroke="#0284C7" strokeWidth={2} strokeDasharray="5 4" strokeLinecap="round" />
                  )}
                  {plotData.probe1 && (
                    <circle cx={plotData.probe1.px} cy={plotData.probe1.py} r={5} fill="#7C3AED" stroke="#ffffff" strokeWidth={1.5} />
                  )}
                </svg>
                {!expr1.trim() && !expr2.trim() && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 pt-1">
                    Nhập f(x) hoặc chọn hàm mẫu để vẽ đồ thị
                  </p>
                )}
              </div>

              <div className="lg:col-span-4 liquid-glass-panel rounded-2xl p-4 space-y-3 text-xs">
                <div className="space-y-2">
                  <label className="block space-y-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Hàm f(x)</span>
                    <input
                      type="text"
                      data-testid="math-expr1-input"
                      value={expr1}
                      onChange={(e) => setExpr1(e.target.value)}
                      placeholder="vd: x^2 - 2*x - 3"
                      className="w-full rounded-xl glass-subsurface px-3 py-2 text-xs font-mono-tabular text-slate-900 dark:text-white"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="font-semibold text-slate-700 dark:text-slate-200">Hàm g(x)</span>
                    <input
                      type="text"
                      value={expr2}
                      onChange={(e) => setExpr2(e.target.value)}
                      placeholder="Tùy chọn"
                      className="w-full rounded-xl glass-subsurface px-3 py-2 text-xs font-mono-tabular text-slate-900 dark:text-white"
                    />
                  </label>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-slate-900/10 dark:border-white/10">
                  <label className="block space-y-1">
                    <span className="flex justify-between font-medium text-slate-700 dark:text-slate-200 font-mono-tabular">
                      <span>Phạm vi trục</span>
                      <span>±{xRange}</span>
                    </span>
                    <input
                      type="range"
                      min={3}
                      max={15}
                      step={1}
                      value={xRange}
                      onChange={(e) => setXRange(Number(e.target.value))}
                      className="w-full accent-violet-600"
                    />
                  </label>
                  <label className="block space-y-1">
                    <span className="flex justify-between font-medium text-slate-700 dark:text-slate-200 font-mono-tabular">
                      <span>Điểm x = {probeX}</span>
                      <span>
                        f({probeX}) = {plotData.y1AtProbe !== null ? plotData.y1AtProbe.toFixed(2) : '—'}
                      </span>
                    </span>
                    <input
                      type="range"
                      min={-xRange}
                      max={xRange}
                      step={0.5}
                      value={probeX}
                      onChange={(e) => setProbeX(Number(e.target.value))}
                      className="w-full accent-violet-600"
                    />
                  </label>
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
              <div className="lg:col-span-7 liquid-glass-panel rounded-2xl p-4 flex flex-col items-center justify-center min-h-[260px]">
                {triangleSvg && triangle.valid ? (
                  <svg viewBox="0 0 320 185" className="w-full max-w-[360px] h-auto">
                    <polygon
                      points={`${triangleSvg.pA.x},${triangleSvg.pA.y} ${triangleSvg.pB.x},${triangleSvg.pB.y} ${triangleSvg.pC.x},${triangleSvg.pC.y}`}
                      fill="rgba(124, 58, 237, 0.16)"
                      stroke="#7C3AED"
                      strokeWidth={2.5}
                      strokeLinejoin="round"
                    />
                    <text x={triangleSvg.pA.x - 10} y={triangleSvg.pA.y + 14} fontSize="12" fill="currentColor" fontWeight="bold">A</text>
                    <text x={triangleSvg.pB.x + 4} y={triangleSvg.pB.y + 14} fontSize="12" fill="currentColor" fontWeight="bold">B</text>
                    <text x={triangleSvg.pC.x - 4} y={triangleSvg.pC.y - 8} fontSize="12" fill="currentColor" fontWeight="bold">C</text>
                  </svg>
                ) : (
                  <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 text-center">
                    {triangle.reason}
                  </p>
                )}
              </div>

              <div className="lg:col-span-5 liquid-glass-panel rounded-2xl p-4 space-y-3 text-xs">
                <div className="space-y-2">
                  {[
                    { label: 'Cạnh a', val: sideA, set: setSideA },
                    { label: 'Cạnh b', val: sideB, set: setSideB },
                    { label: 'Cạnh c', val: sideC, set: setSideC },
                  ].map((s) => (
                    <label key={s.label} className="block space-y-1">
                      <span className="flex justify-between font-semibold text-slate-700 dark:text-slate-200 font-mono-tabular">
                        <span>{s.label}</span>
                        <span>{s.val}</span>
                      </span>
                      <input
                        type="range"
                        min={1}
                        max={12}
                        step={0.5}
                        value={s.val}
                        onChange={(e) => s.set(Number(e.target.value))}
                        className="w-full accent-violet-600"
                      />
                    </label>
                  ))}
                </div>

                {triangle.valid && (
                  <div className="grid grid-cols-3 gap-x-3 gap-y-2 pt-2 border-t border-slate-900/10 dark:border-white/10 font-mono-tabular">
                    <div>
                      <span className="text-[11px] text-slate-500 block">Loại</span>
                      <strong className="text-slate-900 dark:text-white">{triangle.classification}</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Diện tích</span>
                      <strong className="text-violet-700 dark:text-violet-300">{triangle.area}</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">Chu vi</span>
                      <strong className="text-slate-900 dark:text-white">{triangle.perimeter}</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">∠A</span>
                      <strong>{triangle.angleA}°</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">∠B</span>
                      <strong>{triangle.angleB}°</strong>
                    </div>
                    <div>
                      <span className="text-[11px] text-slate-500 block">∠C</span>
                      <strong>{triangle.angleC}°</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === 'practice' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Bài tập Toán ({questions.length})
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuestionModalOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl glass-subsurface text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm bài</span>
              </button>
              {submitted && questions.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMcqAnswers({});
                    setTextAnswers({});
                    setSubmitted(false);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl glass-subsurface text-xs font-semibold cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Làm lại</span>
                </button>
              )}
              {questions.length > 0 && (
                <button
                  type="button"
                  onClick={handleGradeMath}
                  className="px-4 py-1.5 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Chấm bài
                </button>
              )}
            </div>
          </div>

          {questions.length === 0 ? (
            <SubjectEmptyState
              testId="math-practice-empty"
              title="Chưa có bài tập Toán nào."
              actions={[
                { label: '+ Thêm bài tập', onClick: () => setQuestionModalOpen(true), primary: true },
                { label: 'Tạo đề bằng AI', onClick: () => setSubTab('ai-tutor') },
              ]}
            />
          ) : (
            <div className="space-y-2.5">
              {questions.map((q, idx) => (
                <div key={q.id} className="liquid-glass-panel rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-violet-700 dark:text-violet-300">
                      Bài {idx + 1} · {q.grade} · {q.topic}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setQuestions((prev) => prev.filter((item) => item.id !== q.id))
                      }
                      className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                      title="Xóa"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {q.question}
                  </p>

                  {q.qtype === 'mcq' && q.options && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt, oIdx) => {
                        const sel = mcqAnswers[q.id] === oIdx;
                        const isRight = oIdx === q.correctIndex;
                        let cls = 'glass-subsurface text-slate-800 dark:text-slate-100';
                        if (!submitted && sel) cls = 'bg-violet-600 text-white';
                        else if (submitted) {
                          if (isRight) cls = 'bg-emerald-600 text-white';
                          else if (sel) cls = 'bg-rose-600 text-white';
                        }
                        return (
                          <button
                            key={oIdx}
                            type="button"
                            disabled={submitted}
                            onClick={() =>
                              setMcqAnswers((prev) => ({ ...prev, [q.id]: oIdx }))
                            }
                            className={`px-3 py-2 rounded-xl text-left text-xs font-medium cursor-pointer ${cls}`}
                          >
                            {String.fromCharCode(65 + oIdx)}. {opt}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {q.qtype === 'num' && (
                    <input
                      type="text"
                      disabled={submitted}
                      value={textAnswers[q.id] || ''}
                      onChange={(e) =>
                        setTextAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                      }
                      placeholder="Nhập đáp số…"
                      className="w-full sm:w-64 rounded-xl glass-subsurface px-3 py-2 text-sm font-mono-tabular text-slate-900 dark:text-white"
                    />
                  )}

                  {q.qtype === 'essay' && (
                    <textarea
                      rows={3}
                      value={textAnswers[q.id] || ''}
                      onChange={(e) =>
                        setTextAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                      }
                      placeholder="Hướng giải…"
                      className="w-full rounded-xl glass-subsurface px-3 py-2 text-xs text-slate-900 dark:text-white"
                    />
                  )}

                  {submitted && q.solution && (
                    <p className="text-xs text-slate-700 dark:text-slate-200 pt-1">
                      <strong>Lời giải:</strong> {q.solution}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Thêm công thức */}
      <Modal
        isOpen={formulaModalOpen}
        onClose={() => setFormulaModalOpen(false)}
        title="Thêm công thức Toán"
        maxWidth="md"
      >
        <form onSubmit={handleAddFormula} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={fGrade}
              onChange={(e) => setFGrade(e.target.value as MathFormulaCard['grade'])}
              className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value="Lớp 10">Lớp 10</option>
              <option value="Lớp 11">Lớp 11</option>
              <option value="Lớp 12">Lớp 12</option>
            </select>
            <select
              value={fTopic}
              onChange={(e) => setFTopic(e.target.value as MathFormulaCard['topic'])}
              className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value="Đại số">Đại số</option>
              <option value="Giải tích">Giải tích</option>
              <option value="Hình học">Hình học</option>
              <option value="Lượng giác">Lượng giác</option>
              <option value="Xác suất">Xác suất</option>
            </select>
          </div>
          <input
            type="text"
            required
            value={fTitle}
            onChange={(e) => setFTitle(e.target.value)}
            placeholder="Tên công thức (vd: Đỉnh Parabol)"
            className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white"
          />
          <input
            type="text"
            required
            value={fExpr}
            onChange={(e) => setFExpr(e.target.value)}
            placeholder="Biểu thức (vd: x_I = -b / (2a))"
            className="w-full rounded-xl glass-subsurface px-3 py-2 font-mono-tabular text-slate-900 dark:text-white"
          />
          <input
            type="text"
            value={fNote}
            onChange={(e) => setFNote(e.target.value)}
            placeholder="Ghi chú (tùy chọn)"
            className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFormulaModalOpen(false)} className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer">
              Đóng
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-violet-600 text-white font-semibold cursor-pointer">
              Lưu công thức
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Thêm bài tập Toán */}
      <Modal
        isOpen={questionModalOpen}
        onClose={() => setQuestionModalOpen(false)}
        title="Thêm bài tập Toán"
        maxWidth="md"
      >
        <form onSubmit={handleAddQuestion} className="space-y-3 text-xs">
          <div className="grid grid-cols-3 gap-2">
            <select
              value={qType}
              onChange={(e) => setQType(e.target.value as MathQuestionItem['qtype'])}
              className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value="mcq">Trắc nghiệm</option>
              <option value="num">Điền số</option>
              <option value="essay">Tự luận</option>
            </select>
            <select
              value={qGrade}
              onChange={(e) => setQGrade(e.target.value as MathQuestionItem['grade'])}
              className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value="Lớp 10">Lớp 10</option>
              <option value="Lớp 11">Lớp 11</option>
              <option value="Lớp 12">Lớp 12</option>
            </select>
            <input
              type="text"
              value={qTopic}
              onChange={(e) => setQTopic(e.target.value)}
              placeholder="Chuyên đề"
              className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <textarea
            rows={2}
            required
            value={qPrompt}
            onChange={(e) => setQPrompt(e.target.value)}
            placeholder="Đề bài…"
            className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white"
          />
          {qType === 'mcq' && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" required value={qOptA} onChange={(e) => setQOptA(e.target.value)} placeholder="A" className="rounded-xl glass-subsurface px-3 py-1.5 text-slate-900 dark:text-white" />
                <input type="text" required value={qOptB} onChange={(e) => setQOptB(e.target.value)} placeholder="B" className="rounded-xl glass-subsurface px-3 py-1.5 text-slate-900 dark:text-white" />
                <input type="text" value={qOptC} onChange={(e) => setQOptC(e.target.value)} placeholder="C" className="rounded-xl glass-subsurface px-3 py-1.5 text-slate-900 dark:text-white" />
                <input type="text" value={qOptD} onChange={(e) => setQOptD(e.target.value)} placeholder="D" className="rounded-xl glass-subsurface px-3 py-1.5 text-slate-900 dark:text-white" />
              </div>
              <select
                value={qCorrectIdx}
                onChange={(e) => setQCorrectIdx(Number(e.target.value))}
                className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white"
              >
                <option value={0}>Đáp án đúng: A</option>
                <option value={1}>Đáp án đúng: B</option>
                <option value={2}>Đáp án đúng: C</option>
                <option value={3}>Đáp án đúng: D</option>
              </select>
            </>
          )}
          {qType === 'num' && (
            <input
              type="text"
              required
              value={qNumAns}
              onChange={(e) => setQNumAns(e.target.value)}
              placeholder="Đáp số chuẩn (vd: 6)"
              className="w-full rounded-xl glass-subsurface px-3 py-2 font-mono-tabular text-slate-900 dark:text-white"
            />
          )}
          <input
            type="text"
            value={qSolution}
            onChange={(e) => setQSolution(e.target.value)}
            placeholder="Lời giải (tùy chọn)"
            className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white"
          />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setQuestionModalOpen(false)} className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer">
              Đóng
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-violet-600 text-white font-semibold cursor-pointer">
              Lưu bài tập
            </button>
          </div>
        </form>
      </Modal>
    </SubjectWorkspaceShell>
  );
};
