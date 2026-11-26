import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CheckCircle2,
  Clock,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Trash2,
} from '../icons/UiIcons';
import {
  PHYSICS_CONSTANTS_SEED,
  type PhysicsQuestionItem,
  type PhysicsTheoryCard,
} from '../../data/subjectsSeedData';
import {
  loadSubjectCollection,
  saveSubjectCollection,
} from '../../utils/subjects/subjectDataStore';
import {
  computeLinearRegression,
  simulateCollision1D,
  simulateProjectileMotion,
  simulateSpringOscillator,
} from '../../utils/subjects/subjectWorkspaceEngine';
import { Modal } from '../common/Modal';
import {
  SubjectEmptyState,
  SubjectWorkspaceShell,
  type GeneratedAiQuizItem,
  type SubjectHostWorkspaceProps,
} from './SubjectWorkspaceShared';

interface NasaApodItem {
  title: string;
  date: string;
  explanation: string;
  url: string;
  mediaType?: 'image' | 'video';
}

interface NasaNeoItem {
  id: string;
  name: string;
  diameterMinM: number;
  diameterMaxM: number;
  isPotentiallyHazardous: boolean;
  closeApproachDate: string;
  velocityKmS: number;
  missDistanceKm: number;
}

export const PhysicsSubjectView: React.FC<SubjectHostWorkspaceProps> = (props) => {
  const userId = props.currentUser.id;
  const [subTab, setSubTab] = useState<string>('lab');
  const [labMode, setLabMode] = useState<'projectile' | 'spring' | 'collision'>('projectile');

  const [theoryList, setTheoryList] = useState<PhysicsTheoryCard[]>(() =>
    loadSubjectCollection<PhysicsTheoryCard>(userId, 'physics', 'theory')
  );
  const [questions, setQuestions] = useState<PhysicsQuestionItem[]>(() =>
    loadSubjectCollection<PhysicsQuestionItem>(userId, 'physics', 'questions')
  );
  const [regPoints, setRegPoints] = useState<Array<{ x: number; y: number }>>(() =>
    loadSubjectCollection<{ x: number; y: number }>(userId, 'physics', 'regression')
  );
  const [showConstants, setShowConstants] = useState(false);

  useEffect(() => {
    saveSubjectCollection(userId, 'physics', 'theory', theoryList);
  }, [userId, theoryList]);
  useEffect(() => {
    saveSubjectCollection(userId, 'physics', 'questions', questions);
  }, [userId, questions]);
  useEffect(() => {
    saveSubjectCollection(userId, 'physics', 'regression', regPoints);
  }, [userId, regPoints]);

  // Modals
  const [theoryModalOpen, setTheoryModalOpen] = useState(false);
  const [tGrade, setTGrade] = useState<PhysicsTheoryCard['grade']>('Lớp 10');
  const [tTopic, setTTopic] = useState('Cơ học');
  const [tTitle, setTTitle] = useState('');
  const [tFormula, setTFormula] = useState('');
  const [tSummary, setTSummary] = useState('');

  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [qGrade, setQGrade] = useState<PhysicsQuestionItem['grade']>('Lớp 10');
  const [qTopic, setQTopic] = useState('Cơ học');
  const [qPrompt, setQPrompt] = useState('');
  const [qOptA, setQOptA] = useState('');
  const [qOptB, setQOptB] = useState('');
  const [qOptC, setQOptC] = useState('');
  const [qOptD, setQOptD] = useState('');
  const [qCorrectIdx, setQCorrectIdx] = useState(0);
  const [qExplain, setQExplain] = useState('');

  // Inline point input for Regression
  const [newX, setNewX] = useState('');
  const [newY, setNewY] = useState('');

  // Projectile sliders & animation
  const [v0, setV0] = useState(22);
  const [angleDeg, setAngleDeg] = useState(45);
  const [h0, setH0] = useState(2);
  const [gVal, setGVal] = useState(9.81);
  const [isPlaying, setIsPlaying] = useState(false);
  const [simProgress, setSimProgress] = useState(0.5);

  // Spring sliders
  const [ampCm, setAmpCm] = useState(12);
  const [kSpring, setKSpring] = useState(40);
  const [massKg, setMassKg] = useState(0.5);

  // Collision sliders
  const [m1, setM1] = useState(2);
  const [v1, setV1] = useState(4);
  const [m2, setM2] = useState(3);
  const [v2, setV2] = useState(-1);
  const [restitution, setRestitution] = useState(1);

  // NASA Explorer
  const [nasaLoading, setNasaLoading] = useState(false);
  const [nasaError, setNasaError] = useState<string | null>(null);
  const [apod, setApod] = useState<NasaApodItem | null>(null);
  const [neos, setNeos] = useState<NasaNeoItem[]>([]);

  // Quiz
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    let lastTs = performance.now();
    const tick = (now: number) => {
      const dt = (now - lastTs) / 1000;
      lastTs = now;
      setSimProgress((prev) => {
        const next = prev + dt * 0.28;
        return next >= 1 ? 0 : next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, labMode]);

  const projResult = useMemo(
    () => simulateProjectileMotion({ v0, angleDeg, g: gVal, h0 }),
    [v0, angleDeg, gVal, h0]
  );

  const projSampleNow = useMemo(() => {
    const idx = Math.min(
      projResult.points.length - 1,
      Math.max(0, Math.round(simProgress * (projResult.points.length - 1)))
    );
    return projResult.points[idx];
  }, [projResult.points, simProgress]);

  const springResult = useMemo(
    () => simulateSpringOscillator({ amplitudeCm: ampCm, k: kSpring, massKg }),
    [ampCm, kSpring, massKg]
  );

  const springSampleNow = useMemo(() => {
    const idx = Math.min(
      springResult.samples.length - 1,
      Math.max(0, Math.round(simProgress * (springResult.samples.length - 1)))
    );
    return springResult.samples[idx];
  }, [springResult.samples, simProgress]);

  const collisionResult = useMemo(
    () => simulateCollision1D({ m1, v1, m2, v2, restitution }),
    [m1, v1, m2, v2, restitution]
  );

  const regStats = useMemo(() => computeLinearRegression(regPoints), [regPoints]);

  const regChartData = useMemo(() => {
    if (!regStats) return regPoints.map((p) => ({ x: p.x, measured: p.y, fitted: p.y }));
    return [...regPoints]
      .sort((a, b) => a.x - b.x)
      .map((p) => ({
        x: p.x,
        measured: p.y,
        fitted: Number((regStats.slope * p.x + regStats.intercept).toFixed(3)),
      }));
  }, [regPoints, regStats]);

  const handleLoadNasa = async () => {
    setNasaLoading(true);
    setNasaError(null);
    try {
      const [apodRes, neoRes] = await Promise.all([
        fetch('/api/external/nasa/apod'),
        fetch('/api/external/nasa/neo'),
      ]);
      if (apodRes.ok) {
        const d = (await apodRes.json()) as { apod?: NasaApodItem };
        if (d.apod) setApod(d.apod);
      }
      if (neoRes.ok) {
        const d = (await neoRes.json()) as { items?: NasaNeoItem[] };
        if (Array.isArray(d.items)) setNeos(d.items.slice(0, 6));
      }
      if (!apodRes.ok && !neoRes.ok) {
        setNasaError('Không thể tải dữ liệu từ NASA API.');
      }
    } catch {
      setNasaError('Lỗi kết nối tới dịch vụ NASA.');
    } finally {
      setNasaLoading(false);
    }
  };

  const projSvg = useMemo(() => {
    const w = 480;
    const h = 220;
    const pad = 24;
    const maxX = Math.max(10, projResult.range * 1.08);
    const maxY = Math.max(5, projResult.maxHeight * 1.18);
    const toSvg = (x: number, y: number) => ({
      sx: pad + (x / maxX) * (w - pad * 2),
      sy: h - pad - (y / maxY) * (h - pad * 2),
    });
    const d = projResult.points
      .map((pt, i) => {
        const { sx, sy } = toSvg(pt.x, pt.y);
        return `${i === 0 ? 'M' : 'L'}${sx.toFixed(1)},${sy.toFixed(1)}`;
      })
      .join(' ');
    const cur = toSvg(projSampleNow.x, projSampleNow.y);
    return { w, h, pad, d, cur };
  }, [projResult, projSampleNow]);

  const handleAddTheory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tTitle.trim() || !tFormula.trim()) return;
    setTheoryList((prev) => [
      {
        id: `pt-${Date.now()}`,
        grade: tGrade,
        topic: tTopic.trim() || 'Cơ học',
        title: tTitle.trim(),
        formula: tFormula.trim(),
        summary: tSummary.trim(),
      },
      ...prev,
    ]);
    setTTitle('');
    setTFormula('');
    setTSummary('');
    setTheoryModalOpen(false);
  };

  const handleAddQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    const opts = [qOptA, qOptB, qOptC, qOptD].map((s) => s.trim()).filter(Boolean);
    if (!qPrompt.trim() || opts.length < 2) return;
    setQuestions((prev) => [
      {
        id: `pq-${Date.now()}`,
        grade: qGrade,
        topic: qTopic.trim() || 'Vật Lý',
        question: qPrompt.trim(),
        options: opts,
        correctIndex: Math.min(qCorrectIdx, opts.length - 1),
        explain: qExplain.trim(),
      },
      ...prev,
    ]);
    setQPrompt('');
    setQOptA('');
    setQOptB('');
    setQOptC('');
    setQOptD('');
    setQExplain('');
    setQuizModalOpen(false);
  };

  const handleAddRegPoint = (e: React.FormEvent) => {
    e.preventDefault();
    const xVal = Number(newX);
    const yVal = Number(newY);
    if (!Number.isFinite(xVal) || !Number.isFinite(yVal) || newX.trim() === '' || newY.trim() === '') return;
    setRegPoints((prev) => [...prev, { x: xVal, y: yVal }]);
    setNewX('');
    setNewY('');
  };

  const handleGrade = () => {
    if (questions.length === 0) return;
    setSubmitted(true);
    const score = questions.filter((q) => answers[q.id] === q.correctIndex).length;
    props.onRecordPracticeResult(score, questions.length, 'Vật Lý');
  };

  return (
    <SubjectWorkspaceShell
      {...props}
      activeSubTab={subTab}
      onChangeSubTab={setSubTab}
      liveContextSummary={`Vật Lý · Thí nghiệm ${labMode} · v0=${v0}m/s, α=${angleDeg}°`}
      excelModuleKey="questions"
      excelExportRecords={questions.map((q) => ({
        topic: q.topic,
        grade: q.grade,
        question: q.question,
        optionA: q.options[0],
        optionB: q.options[1],
        optionC: q.options[2],
        optionD: q.options[3],
        answer: ['A', 'B', 'C', 'D'][q.correctIndex] || 'A',
        explain: q.explain,
      }))}
      onImportExcelRows={(rows) => {
        const mapped: PhysicsQuestionItem[] = rows
          .map((r, i) => {
            const opts = [r.optionA, r.optionB, r.optionC, r.optionD].map((x) =>
              String(x || '').trim()
            );
            if (!r.question || opts.some((o) => !o)) return null;
            const idx = ['A', 'B', 'C', 'D'].indexOf(
              String(r.answer || 'A').trim().toUpperCase()
            );
            return {
              id: `p-imp-${Date.now()}-${i}`,
              grade: (String(r.grade || 'Lớp 10') as PhysicsQuestionItem['grade']) || 'Lớp 10',
              topic: String(r.topic || 'Cơ học'),
              question: String(r.question),
              options: opts,
              correctIndex: idx >= 0 ? idx : 0,
              explain: String(r.explain || ''),
            };
          })
          .filter((x): x is PhysicsQuestionItem => Boolean(x));
        if (mapped.length > 0) setQuestions((prev) => [...mapped, ...prev]);
      }}
      onInjectGeneratedQuiz={(gen: GeneratedAiQuizItem[]) => {
        const next: PhysicsQuestionItem[] = gen.map((g, i) => ({
          id: `p-ai-${Date.now()}-${i}`,
          grade: 'Lớp 10',
          topic: g.topic || 'Vật Lý',
          question: g.question,
          options: g.options,
          correctIndex: g.correctIndex,
          explain: g.explanation,
        }));
        setQuestions((prev) => [...next, ...prev]);
        setSubTab('practice');
      }}
    >
      {subTab === 'theory' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Công thức Vật Lý ({theoryList.length})
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowConstants((s) => !s)}
                className="px-3 py-1.5 rounded-xl glass-subsurface text-xs font-semibold text-slate-700 dark:text-slate-200 cursor-pointer"
              >
                {showConstants ? 'Ẩn hằng số SI' : `Hằng số SI (${PHYSICS_CONSTANTS_SEED.length})`}
              </button>
              <button
                type="button"
                data-testid="physics-add-theory-btn"
                onClick={() => setTheoryModalOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm công thức</span>
              </button>
            </div>
          </div>

          {showConstants && (
            <div className="liquid-glass-panel rounded-2xl p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 divide-y sm:divide-y-0 sm:gap-y-2">
                {PHYSICS_CONSTANTS_SEED.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-900/10 dark:border-white/10"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                        {c.symbol} · {c.name}
                      </p>
                      <p className="text-[11px] text-slate-500 font-mono-tabular">{c.formulaNote}</p>
                    </div>
                    <span className="text-xs font-bold font-mono-tabular text-pink-700 dark:text-pink-300 shrink-0">
                      {c.value} {c.unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {theoryList.length === 0 ? (
            <SubjectEmptyState
              testId="physics-theory-empty"
              title="Chưa có công thức nào."
              actions={[
                { label: '+ Thêm công thức', onClick: () => setTheoryModalOpen(true), primary: true },
                { label: 'Mở mô phỏng', onClick: () => setSubTab('lab') },
                { label: 'Tạo bằng AI', onClick: () => setSubTab('ai-tutor') },
              ]}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {theoryList.map((t) => (
                <div key={t.id} className="liquid-glass-panel rounded-2xl p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-semibold text-pink-700 dark:text-pink-300">
                        {t.grade} · {t.topic}
                      </span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">
                        {t.title}
                      </h4>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => props.onToggleMastered(t.id)}
                        className={`p-1.5 rounded-lg cursor-pointer ${
                          props.progress.masteredIds.includes(t.id)
                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                            : 'text-slate-400'
                        }`}
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setTheoryList((prev) => prev.filter((item) => item.id !== t.id))
                        }
                        className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                        title="Xóa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="rounded-xl bg-slate-900/5 dark:bg-white/5 px-3 py-2 text-xs font-mono-tabular font-semibold text-slate-900 dark:text-white">
                    {t.formula}
                  </p>
                  {t.summary && (
                    <p className="text-xs text-slate-600 dark:text-slate-300">{t.summary}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'lab' && (
        <div className="space-y-3">
          <div className="liquid-glass-panel rounded-2xl px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'projectile' as const, label: 'Ném xiên' },
                { id: 'spring' as const, label: 'Con lắc lò xo' },
                { id: 'collision' as const, label: 'Va chạm 1D' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  data-testid={`physics-lab-mode-${m.id}`}
                  onClick={() => {
                    setLabMode(m.id);
                    setIsPlaying(false);
                    setSimProgress(0.35);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold cursor-pointer ${
                    labMode === m.id
                      ? 'bg-pink-600 text-white'
                      : 'glass-subsurface text-slate-700 dark:text-slate-200'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                data-testid="physics-sim-toggle-play"
                onClick={() => setIsPlaying((p) => !p)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer"
              >
                {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlaying ? 'Tạm dừng' : 'Chạy'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsPlaying(false);
                  setSimProgress(0);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl glass-subsurface text-xs font-semibold cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Đặt lại</span>
              </button>
            </div>
          </div>

          {labMode === 'projectile' && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
              <div className="lg:col-span-3 liquid-glass-panel rounded-2xl p-4 space-y-3">
                <div className="rounded-xl glass-subsurface p-2">
                  <svg viewBox={`0 0 ${projSvg.w} ${projSvg.h}`} className="w-full h-auto">
                    <line
                      x1={projSvg.pad}
                      y1={projSvg.h - projSvg.pad}
                      x2={projSvg.w - projSvg.pad}
                      y2={projSvg.h - projSvg.pad}
                      stroke="currentColor"
                      strokeOpacity={0.35}
                      strokeWidth={1.5}
                    />
                    <path d={projSvg.d} fill="none" stroke="#DB2777" strokeWidth={2.5} strokeDasharray="6 4" />
                    <circle cx={projSvg.cur.sx} cy={projSvg.cur.sy} r={7} fill="#DB2777" stroke="#ffffff" strokeWidth={2} />
                  </svg>
                </div>

                <label className="block space-y-1 text-xs">
                  <span className="flex justify-between font-mono-tabular text-slate-700 dark:text-slate-200">
                    <span>t = {projSampleNow.t} s</span>
                    <span>
                      x = {projSampleNow.x} m · y = {projSampleNow.y} m · v = {projSampleNow.speed} m/s
                    </span>
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={simProgress}
                    onChange={(e) => {
                      setIsPlaying(false);
                      setSimProgress(Number(e.target.value));
                    }}
                    className="w-full accent-pink-600"
                  />
                </label>

                <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-900/10 dark:border-white/10 text-xs font-mono-tabular">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Độ cao H</span>
                    <strong className="text-pink-700 dark:text-pink-300">{projResult.maxHeight} m</strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Tầm xa R</span>
                    <strong>{projResult.range} m</strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Thời gian bay</span>
                    <strong>{projResult.flightTime} s</strong>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 liquid-glass-panel rounded-2xl p-4 space-y-3 text-xs">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Tham số Ném xiên</h3>
                {[
                  { label: 'v₀', val: v0, unit: 'm/s', min: 5, max: 50, step: 1, set: setV0 },
                  { label: 'α', val: angleDeg, unit: '°', min: 5, max: 85, step: 1, set: setAngleDeg },
                  { label: 'h₀', val: h0, unit: 'm', min: 0, max: 30, step: 1, set: setH0 },
                  { label: 'g', val: gVal, unit: 'm/s²', min: 1.6, max: 20, step: 0.1, set: setGVal },
                ].map((ctrl) => (
                  <label key={ctrl.label} className="block space-y-1">
                    <span className="flex justify-between font-semibold font-mono-tabular text-slate-700 dark:text-slate-200">
                      <span>{ctrl.label}</span>
                      <span>
                        {ctrl.val} {ctrl.unit}
                      </span>
                    </span>
                    <input
                      type="range"
                      min={ctrl.min}
                      max={ctrl.max}
                      step={ctrl.step}
                      value={ctrl.val}
                      onChange={(e) => ctrl.set(Number(e.target.value))}
                      className="w-full accent-pink-600"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {labMode === 'spring' && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
              <div className="lg:col-span-3 liquid-glass-panel rounded-2xl p-4 space-y-3">
                <div className="rounded-xl glass-subsurface p-3">
                  {(() => {
                    const centerX = 240;
                    const boxX = centerX + (springSampleNow.xCm / Math.max(1, ampCm)) * 110;
                    const coils = 10;
                    const startX = 24;
                    const endX = boxX - 18;
                    const seg = (endX - startX) / coils;
                    let springPath = `M${startX},70 `;
                    for (let i = 0; i < coils; i++) {
                      const cx1 = startX + i * seg + seg * 0.25;
                      const cx2 = startX + i * seg + seg * 0.75;
                      const ex = startX + (i + 1) * seg;
                      springPath += `L${cx1.toFixed(1)},52 L${cx2.toFixed(1)},88 L${ex.toFixed(1)},70 `;
                    }
                    return (
                      <svg viewBox="0 0 480 140" className="w-full h-auto">
                        <rect x={14} y={34} width={10} height={72} rx={3} fill="currentColor" fillOpacity={0.5} />
                        <line x1={centerX} y1={24} x2={centerX} y2={116} stroke="currentColor" strokeOpacity={0.25} strokeDasharray="4 4" />
                        <path d={springPath} fill="none" stroke="#DB2777" strokeWidth={2.5} strokeLinejoin="round" />
                        <rect x={boxX - 18} y={48} width={36} height={44} rx={8} fill="#0284C7" stroke="#ffffff" strokeWidth={2} />
                        <text x={boxX} y={74} textAnchor="middle" fill="#ffffff" fontSize="11" fontWeight="bold">m</text>
                      </svg>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-900/10 dark:border-white/10 text-xs font-mono-tabular">
                  <div>
                    <span className="text-[11px] text-slate-500 block">Li độ x(t)</span>
                    <strong className="text-pink-700 dark:text-pink-300">{springSampleNow.xCm} cm</strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Chu kỳ T</span>
                    <strong>{springResult.period} s</strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">ω</span>
                    <strong>{springResult.omega} rad/s</strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Cơ năng W</span>
                    <strong>{springResult.totalEnergyJ} J</strong>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 liquid-glass-panel rounded-2xl p-4 space-y-3 text-xs">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Tham số Lò xo</h3>
                {[
                  { label: 'Biên độ A', val: ampCm, unit: 'cm', min: 2, max: 25, step: 1, set: setAmpCm },
                  { label: 'Độ cứng k', val: kSpring, unit: 'N/m', min: 10, max: 150, step: 5, set: setKSpring },
                  { label: 'Khối lượng m', val: massKg, unit: 'kg', min: 0.1, max: 3, step: 0.1, set: setMassKg },
                ].map((ctrl) => (
                  <label key={ctrl.label} className="block space-y-1">
                    <span className="flex justify-between font-semibold font-mono-tabular">
                      <span>{ctrl.label}</span>
                      <span>
                        {ctrl.val} {ctrl.unit}
                      </span>
                    </span>
                    <input
                      type="range"
                      min={ctrl.min}
                      max={ctrl.max}
                      step={ctrl.step}
                      value={ctrl.val}
                      onChange={(e) => ctrl.set(Number(e.target.value))}
                      className="w-full accent-pink-600"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}

          {labMode === 'collision' && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
              <div className="lg:col-span-3 liquid-glass-panel rounded-2xl p-4 space-y-3">
                <div className="rounded-xl glass-subsurface p-4 flex items-center justify-around">
                  <div className="text-center space-y-1">
                    <div className="w-16 h-16 rounded-2xl bg-sky-600 text-white flex flex-col items-center justify-center font-mono-tabular shadow">
                      <span className="text-xs font-bold">m₁={m1}</span>
                      <span className="text-[11px]">v₁={v1}</span>
                    </div>
                    <p className="text-xs font-bold font-mono-tabular text-sky-700 dark:text-sky-300">
                      v₁&apos; = {collisionResult.v1After} m/s
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-500">
                    e = {restitution}
                  </span>
                  <div className="text-center space-y-1">
                    <div className="w-16 h-16 rounded-2xl bg-pink-600 text-white flex flex-col items-center justify-center font-mono-tabular shadow">
                      <span className="text-xs font-bold">m₂={m2}</span>
                      <span className="text-[11px]">v₂={v2}</span>
                    </div>
                    <p className="text-xs font-bold font-mono-tabular text-pink-700 dark:text-pink-300">
                      v₂&apos; = {collisionResult.v2After} m/s
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-900/10 dark:border-white/10 text-xs font-mono-tabular">
                  <div>
                    <span className="text-[11px] text-slate-500 block">p trước</span>
                    <strong>{collisionResult.momentumBefore}</strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">p sau</span>
                    <strong className="text-emerald-700 dark:text-emerald-300">
                      {collisionResult.momentumAfter}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Wđ trước/sau</span>
                    <strong>
                      {collisionResult.kineticBefore} / {collisionResult.kineticAfter} J
                    </strong>
                  </div>
                  <div>
                    <span className="text-[11px] text-slate-500 block">Hao hụt</span>
                    <strong>{collisionResult.energyLossPercent}%</strong>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-2 liquid-glass-panel rounded-2xl p-4 space-y-2.5 text-xs">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">Tham số Va chạm</h3>
                {[
                  { label: 'm₁ (kg)', val: m1, min: 0.5, max: 10, step: 0.5, set: setM1 },
                  { label: 'v₁ (m/s)', val: v1, min: -10, max: 10, step: 0.5, set: setV1 },
                  { label: 'm₂ (kg)', val: m2, min: 0.5, max: 10, step: 0.5, set: setM2 },
                  { label: 'v₂ (m/s)', val: v2, min: -10, max: 10, step: 0.5, set: setV2 },
                  { label: 'Hệ số e', val: restitution, min: 0, max: 1, step: 0.1, set: setRestitution },
                ].map((c) => (
                  <label key={c.label} className="block space-y-0.5">
                    <span className="flex justify-between font-semibold font-mono-tabular">
                      <span>{c.label}</span>
                      <span>{c.val}</span>
                    </span>
                    <input
                      type="range"
                      min={c.min}
                      max={c.max}
                      step={c.step}
                      value={c.val}
                      onChange={(e) => c.set(Number(e.target.value))}
                      className="w-full accent-pink-600"
                    />
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === 'regression' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="liquid-glass-panel rounded-2xl p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Số liệu đo (x, y)
              </h3>
              {regPoints.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRegPoints([])}
                  className="text-xs font-semibold text-rose-600 dark:text-rose-400 cursor-pointer"
                >
                  Xóa hết
                </button>
              )}
            </div>

            <form onSubmit={handleAddRegPoint} className="flex items-center gap-2 text-xs">
              <input
                type="number"
                step="any"
                required
                value={newX}
                onChange={(e) => setNewX(e.target.value)}
                placeholder="Giá trị x"
                className="flex-1 rounded-xl glass-subsurface px-3 py-1.5 font-mono-tabular"
              />
              <input
                type="number"
                step="any"
                required
                value={newY}
                onChange={(e) => setNewY(e.target.value)}
                placeholder="Giá trị y"
                className="flex-1 rounded-xl glass-subsurface px-3 py-1.5 font-mono-tabular"
              />
              <button
                type="submit"
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-pink-600 text-white font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm</span>
              </button>
            </form>

            {regPoints.length === 0 ? (
              <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
                Nhập ít nhất 2 cặp (x, y).
              </p>
            ) : (
              <>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {regPoints.map((pt, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-7 font-mono-tabular text-slate-500">#{i + 1}</span>
                      <input
                        type="number"
                        step="any"
                        value={pt.x}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setRegPoints((prev) =>
                            prev.map((item, idx) => (idx === i ? { ...item, x: v } : item))
                          );
                        }}
                        className="flex-1 rounded-lg glass-subsurface px-2.5 py-1 font-mono-tabular"
                      />
                      <input
                        type="number"
                        step="any"
                        value={pt.y}
                        onChange={(e) => {
                          const v = Number(e.target.value);
                          setRegPoints((prev) =>
                            prev.map((item, idx) => (idx === i ? { ...item, y: v } : item))
                          );
                        }}
                        className="flex-1 rounded-lg glass-subsurface px-2.5 py-1 font-mono-tabular"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setRegPoints((prev) => prev.filter((_, idx) => idx !== i))
                        }
                        className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                {regStats && (
                  <div className="pt-2 border-t border-slate-900/10 dark:border-white/10 flex flex-wrap justify-between gap-2 text-xs font-mono-tabular">
                    <span>
                      Phương trình: <strong>y = {regStats.slope}x + {regStats.intercept}</strong>
                    </span>
                    <strong className="text-emerald-700 dark:text-emerald-300">
                      R² = {regStats.rSquared}
                    </strong>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="liquid-glass-panel rounded-2xl p-4 space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Đồ thị hồi quy</h3>
            <div className="h-[260px] w-full flex items-center justify-center">
              {regPoints.length === 0 ? (
                <span className="text-xs text-slate-500 dark:text-slate-400">Chưa có số liệu</span>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={regChartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                    <XAxis dataKey="x" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="measured" name="Số đo" stroke="#0284C7" strokeWidth={2} />
                    <Line type="linear" dataKey="fitted" name="Hồi quy" stroke="#DB2777" strokeDasharray="5 5" dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>
      )}

      {subTab === 'nasa' && (
        <div className="liquid-glass-panel rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Thiên văn NASA (APOD &amp; NEO)
            </h3>
            <button
              type="button"
              onClick={() => void handleLoadNasa()}
              disabled={nasaLoading}
              className="px-4 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
            >
              {nasaLoading ? 'Đang tải…' : 'Tải dữ liệu NASA'}
            </button>
          </div>
          {nasaError && <p className="text-xs text-rose-600 dark:text-rose-400">{nasaError}</p>}
          {!apod && neos.length === 0 && !nasaLoading && (
            <p className="text-xs text-slate-500 dark:text-slate-400 py-6 text-center">
              Nhấn &ldquo;Tải dữ liệu NASA&rdquo; để xem ảnh thiên văn và tiểu hành tinh.
            </p>
          )}
          {apod && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 border-t border-slate-900/10 dark:border-white/10">
              {apod.mediaType !== 'video' && apod.url && (
                <img src={apod.url} alt={apod.title} className="w-full h-56 object-cover rounded-xl" />
              )}
              <div className="space-y-1.5">
                <p className="text-[11px] font-semibold text-pink-700 dark:text-pink-300">
                  {apod.date}
                </p>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white">{apod.title}</h4>
                <p className="text-xs text-slate-700 dark:text-slate-200 leading-relaxed line-clamp-6">
                  {apod.explanation}
                </p>
              </div>
            </div>
          )}
          {neos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2 border-t border-slate-900/10 dark:border-white/10">
              {neos.map((n) => (
                <div key={n.id} className="rounded-xl glass-subsurface p-3 text-xs space-y-0.5">
                  <p className="font-bold text-slate-900 dark:text-white">{n.name}</p>
                  <p className="font-mono-tabular text-slate-600 dark:text-slate-300">
                    {Math.round(n.diameterMinM)}–{Math.round(n.diameterMaxM)} m · {n.velocityKmS.toFixed(1)} km/s
                  </p>
                  <p className="font-mono-tabular text-[11px] text-slate-500">{n.closeApproachDate}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {subTab === 'practice' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Bài tập Vật Lý ({questions.length})
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQuizModalOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl glass-subsurface text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm câu hỏi</span>
              </button>
              {submitted && questions.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setAnswers({});
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
                  onClick={handleGrade}
                  className="px-4 py-1.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Chấm điểm
                </button>
              )}
            </div>
          </div>

          {questions.length === 0 ? (
            <SubjectEmptyState
              testId="physics-practice-empty"
              title="Chưa có câu hỏi Vật Lý nào."
              actions={[
                { label: '+ Thêm câu hỏi', onClick: () => setQuizModalOpen(true), primary: true },
                { label: 'Tạo đề bằng AI', onClick: () => setSubTab('ai-tutor') },
              ]}
            />
          ) : (
            <div className="space-y-2.5">
              {questions.map((q, idx) => (
                <div key={q.id} className="liquid-glass-panel rounded-2xl p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] font-semibold text-pink-700 dark:text-pink-300">
                      Câu {idx + 1} · {q.grade} · {q.topic}
                    </p>
                    <button
                      type="button"
                      onClick={() =>
                        setQuestions((prev) => prev.filter((item) => item.id !== q.id))
                      }
                      className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{q.question}</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {q.options.map((opt, oIdx) => {
                      const sel = answers[q.id] === oIdx;
                      const right = oIdx === q.correctIndex;
                      let cls = 'glass-subsurface text-slate-800 dark:text-slate-100';
                      if (!submitted && sel) cls = 'bg-pink-600 text-white';
                      else if (submitted) {
                        if (right) cls = 'bg-emerald-600 text-white';
                        else if (sel) cls = 'bg-rose-600 text-white';
                      }
                      return (
                        <button
                          key={oIdx}
                          type="button"
                          disabled={submitted}
                          onClick={() => setAnswers((p) => ({ ...p, [q.id]: oIdx }))}
                          className={`px-3 py-2 rounded-xl text-left text-xs font-medium cursor-pointer ${cls}`}
                        >
                          {String.fromCharCode(65 + oIdx)}. {opt}
                        </button>
                      );
                    })}
                  </div>
                  {submitted && q.explain && (
                    <p className="text-xs text-slate-600 dark:text-slate-300 pt-1">{q.explain}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modal: Thêm công thức Vật Lý */}
      <Modal isOpen={theoryModalOpen} onClose={() => setTheoryModalOpen(false)} title="Thêm công thức Vật Lý" maxWidth="md">
        <form onSubmit={handleAddTheory} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <select value={tGrade} onChange={(e) => setTGrade(e.target.value as PhysicsTheoryCard['grade'])} className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white">
              <option value="Lớp 10">Lớp 10</option>
              <option value="Lớp 11">Lớp 11</option>
              <option value="Lớp 12">Lớp 12</option>
            </select>
            <input type="text" value={tTopic} onChange={(e) => setTTopic(e.target.value)} placeholder="Chủ đề (Cơ học, Điện...)" className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          </div>
          <input type="text" required value={tTitle} onChange={(e) => setTTitle(e.target.value)} placeholder="Tên định luật / công thức" className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white" />
          <input type="text" required value={tFormula} onChange={(e) => setTFormula(e.target.value)} placeholder="Biểu thức (vd: F = m * a)" className="w-full rounded-xl glass-subsurface px-3 py-2 font-mono-tabular text-slate-900 dark:text-white" />
          <input type="text" value={tSummary} onChange={(e) => setTSummary(e.target.value)} placeholder="Ghi chú ngắn (tùy chọn)" className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setTheoryModalOpen(false)} className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer">Đóng</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-pink-600 text-white font-semibold cursor-pointer">Lưu</button>
          </div>
        </form>
      </Modal>

      {/* Modal: Thêm câu hỏi Vật Lý */}
      <Modal isOpen={quizModalOpen} onClose={() => setQuizModalOpen(false)} title="Thêm câu hỏi Vật Lý" maxWidth="md">
        <form onSubmit={handleAddQuiz} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <select value={qGrade} onChange={(e) => setQGrade(e.target.value as PhysicsQuestionItem['grade'])} className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white">
              <option value="Lớp 10">Lớp 10</option>
              <option value="Lớp 11">Lớp 11</option>
              <option value="Lớp 12">Lớp 12</option>
            </select>
            <input type="text" value={qTopic} onChange={(e) => setQTopic(e.target.value)} placeholder="Chủ đề" className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          </div>
          <textarea rows={2} required value={qPrompt} onChange={(e) => setQPrompt(e.target.value)} placeholder="Nội dung câu hỏi…" className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white" />
          <div className="grid grid-cols-2 gap-2">
            <input type="text" required value={qOptA} onChange={(e) => setQOptA(e.target.value)} placeholder="A" className="rounded-xl glass-subsurface px-3 py-1.5 text-slate-900 dark:text-white" />
            <input type="text" required value={qOptB} onChange={(e) => setQOptB(e.target.value)} placeholder="B" className="rounded-xl glass-subsurface px-3 py-1.5 text-slate-900 dark:text-white" />
            <input type="text" value={qOptC} onChange={(e) => setQOptC(e.target.value)} placeholder="C" className="rounded-xl glass-subsurface px-3 py-1.5 text-slate-900 dark:text-white" />
            <input type="text" value={qOptD} onChange={(e) => setQOptD(e.target.value)} placeholder="D" className="rounded-xl glass-subsurface px-3 py-1.5 text-slate-900 dark:text-white" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select value={qCorrectIdx} onChange={(e) => setQCorrectIdx(Number(e.target.value))} className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white">
              <option value={0}>Đúng: A</option>
              <option value={1}>Đúng: B</option>
              <option value={2}>Đúng: C</option>
              <option value={3}>Đúng: D</option>
            </select>
            <input type="text" value={qExplain} onChange={(e) => setQExplain(e.target.value)} placeholder="Giải thích (tùy chọn)" className="col-span-2 rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setQuizModalOpen(false)} className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer">Đóng</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-pink-600 text-white font-semibold cursor-pointer">Lưu</button>
          </div>
        </form>
      </Modal>
    </SubjectWorkspaceShell>
  );
};
