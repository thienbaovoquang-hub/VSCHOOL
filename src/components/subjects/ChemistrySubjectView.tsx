import React, { useEffect, useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Clock, Plus, Search, Trash2 } from '../icons/UiIcons';
import {
  ELEMENT_CATEGORY_META,
  PERIODIC_ELEMENTS,
  type ChemicalElement,
  type ElementCategory,
} from '../../data/chemistryElements';
import type {
  ChemicalReactionEntry,
  ChemistryQuestionItem,
} from '../../data/subjectsSeedData';
import {
  loadSubjectCollection,
  saveSubjectCollection,
} from '../../utils/subjects/subjectDataStore';
import {
  calculateMolarMass,
  computeAcidBaseTitration,
  generateTitrationCurve,
} from '../../utils/subjects/subjectWorkspaceEngine';
import { Modal } from '../common/Modal';
import {
  SubjectEmptyState,
  SubjectWorkspaceShell,
  type GeneratedAiQuizItem,
  type SubjectHostWorkspaceProps,
} from './SubjectWorkspaceShared';

interface PubChemCompoundResult {
  cid: number;
  title: string;
  iupacName?: string;
  molecularFormula: string;
  molecularWeight: number;
  canonicalSmiles?: string;
  description?: string;
}

export const ChemistrySubjectView: React.FC<SubjectHostWorkspaceProps> = (props) => {
  const userId = props.currentUser.id;
  const [subTab, setSubTab] = useState<string>('periodic');
  const [reactions, setReactions] = useState<ChemicalReactionEntry[]>(() =>
    loadSubjectCollection<ChemicalReactionEntry>(userId, 'chemistry', 'reactions')
  );
  const [questions, setQuestions] = useState<ChemistryQuestionItem[]>(() =>
    loadSubjectCollection<ChemistryQuestionItem>(userId, 'chemistry', 'questions')
  );

  useEffect(() => {
    saveSubjectCollection(userId, 'chemistry', 'reactions', reactions);
  }, [userId, reactions]);
  useEffect(() => {
    saveSubjectCollection(userId, 'chemistry', 'questions', questions);
  }, [userId, questions]);

  // Periodic table state
  const [elemSearch, setElemSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ElementCategory | 'all'>('all');
  const [selectedElem, setSelectedElem] = useState<ChemicalElement>(PERIODIC_ELEMENTS[5]);

  // Molar Mass & Reactions
  const [formulaInput, setFormulaInput] = useState('');
  const [reactionFilter, setReactionFilter] = useState('all');

  // Modals
  const [rxModalOpen, setRxModalOpen] = useState(false);
  const [rxCat, setRxCat] = useState<ChemicalReactionEntry['category']>('Vô cơ');
  const [rxEq, setRxEq] = useState('');
  const [rxCond, setRxCond] = useState('');
  const [rxPhenom, setRxPhenom] = useState('');

  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [qGrade, setQGrade] = useState<ChemistryQuestionItem['grade']>('Lớp 10');
  const [qTopic, setQTopic] = useState('Hóa học');
  const [qPrompt, setQPrompt] = useState('');
  const [qOptA, setQOptA] = useState('');
  const [qOptB, setQOptB] = useState('');
  const [qOptC, setQOptC] = useState('');
  const [qOptD, setQOptD] = useState('');
  const [qCorrectIdx, setQCorrectIdx] = useState(0);
  const [qExplain, setQExplain] = useState('');

  // Acid-Base Titration Lab
  const [acidM, setAcidM] = useState(0.1);
  const [acidVolMl, setAcidVolMl] = useState(25);
  const [baseM, setBaseM] = useState(0.1);
  const [baseVolAddedMl, setBaseVolAddedMl] = useState(20);

  // PubChem lookup
  const [pubQuery, setPubQuery] = useState('');
  const [pubLoading, setPubLoading] = useState(false);
  const [pubError, setPubError] = useState<string | null>(null);
  const [pubCompound, setPubCompound] = useState<PubChemCompoundResult | null>(null);

  // Practice
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitted, setSubmitted] = useState(false);

  const matchingElementsSet = useMemo(() => {
    const q = elemSearch.trim().toLowerCase();
    const set = new Set<number>();
    for (const el of PERIODIC_ELEMENTS) {
      const catOk = categoryFilter === 'all' || el.category === categoryFilter;
      const qOk =
        !q ||
        String(el.z) === q ||
        el.symbol.toLowerCase().includes(q) ||
        el.nameVi.toLowerCase().includes(q) ||
        el.nameEn.toLowerCase().includes(q);
      if (catOk && qOk) set.add(el.z);
    }
    return set;
  }, [categoryFilter, elemSearch]);

  const molarResult = useMemo(() => {
    if (!formulaInput.trim()) return null;
    try {
      return { ok: true as const, data: calculateMolarMass(formulaInput) };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : 'Công thức không hợp lệ',
      };
    }
  }, [formulaInput]);

  const titrationNow = useMemo(
    () =>
      computeAcidBaseTitration({
        acidM,
        acidVolMl,
        baseM,
        baseVolAddedMl,
      }),
    [acidM, acidVolMl, baseM, baseVolAddedMl]
  );

  const titrationCurve = useMemo(
    () =>
      generateTitrationCurve(
        acidM,
        acidVolMl,
        baseM,
        Math.max(40, titrationNow.equivalenceVolMl * 2)
      ),
    [acidM, acidVolMl, baseM, titrationNow.equivalenceVolMl]
  );

  const handlePubChemSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = pubQuery.trim();
    if (!q) return;
    setPubLoading(true);
    setPubError(null);
    try {
      const res = await fetch(`/api/external/pubchem?q=${encodeURIComponent(q)}`);
      const data = (await res.json().catch(() => ({}))) as {
        compound?: PubChemCompoundResult;
        error?: string;
      };
      if (!res.ok || !data.compound) {
        setPubError(data.error || `Không tìm thấy "${q}" trên PubChem.`);
        setPubCompound(null);
        return;
      }
      setPubCompound(data.compound);
    } catch {
      setPubError('Không thể kết nối PubChem API.');
    } finally {
      setPubLoading(false);
    }
  };

  const handleAddReaction = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rxEq.trim()) return;
    setReactions((prev) => [
      {
        id: `cr-${Date.now()}`,
        category: rxCat,
        equation: rxEq.trim(),
        condition: rxCond.trim() || 'Thường',
        phenomenon: rxPhenom.trim(),
      },
      ...prev,
    ]);
    setRxEq('');
    setRxCond('');
    setRxPhenom('');
    setRxModalOpen(false);
  };

  const handleAddQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    const opts = [qOptA, qOptB, qOptC, qOptD].map((s) => s.trim()).filter(Boolean);
    if (!qPrompt.trim() || opts.length < 2) return;
    setQuestions((prev) => [
      {
        id: `cq-${Date.now()}`,
        grade: qGrade,
        topic: qTopic.trim() || 'Hóa Học',
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

  const handleGrade = () => {
    if (questions.length === 0) return;
    setSubmitted(true);
    const score = questions.filter((q) => answers[q.id] === q.correctIndex).length;
    props.onRecordPracticeResult(score, questions.length, 'Hóa Học');
  };

  const filteredReactions = reactions.filter(
    (r) => reactionFilter === 'all' || r.category === reactionFilter
  );

  return (
    <SubjectWorkspaceShell
      {...props}
      activeSubTab={subTab}
      onChangeSubTab={setSubTab}
      liveContextSummary={`Hóa Học · ${selectedElem.nameVi} (${selectedElem.symbol}) · pH=${titrationNow.ph}`}
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
        const mapped: ChemistryQuestionItem[] = rows
          .map((r, i) => {
            const opts = [r.optionA, r.optionB, r.optionC, r.optionD].map((x) =>
              String(x || '').trim()
            );
            if (!r.question || opts.some((o) => !o)) return null;
            const idx = ['A', 'B', 'C', 'D'].indexOf(
              String(r.answer || 'A').trim().toUpperCase()
            );
            return {
              id: `c-imp-${Date.now()}-${i}`,
              grade: (String(r.grade || 'Lớp 10') as ChemistryQuestionItem['grade']) || 'Lớp 10',
              topic: String(r.topic || 'Hóa Học'),
              question: String(r.question),
              options: opts,
              correctIndex: idx >= 0 ? idx : 0,
              explain: String(r.explain || ''),
            };
          })
          .filter((x): x is ChemistryQuestionItem => Boolean(x));
        if (mapped.length > 0) setQuestions((prev) => [...mapped, ...prev]);
      }}
      onInjectGeneratedQuiz={(gen: GeneratedAiQuizItem[]) => {
        const next: ChemistryQuestionItem[] = gen.map((g, i) => ({
          id: `c-ai-${Date.now()}-${i}`,
          grade: 'Lớp 11',
          topic: g.topic || 'Hóa Học',
          question: g.question,
          options: g.options,
          correctIndex: g.correctIndex,
          explain: g.explanation,
        }));
        setQuestions((prev) => [...next, ...prev]);
        setSubTab('practice');
      }}
    >
      {subTab === 'periodic' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[180px] sm:max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={elemSearch}
                onChange={(e) => setElemSearch(e.target.value)}
                placeholder="Tìm Z, ký hiệu, tên…"
                className="w-full rounded-xl glass-subsurface pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value as ElementCategory | 'all')}
              className="rounded-xl glass-subsurface px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100"
            >
              <option value="all">Tất cả 118 nguyên tố</option>
              {(Object.keys(ELEMENT_CATEGORY_META) as ElementCategory[]).map((k) => (
                <option key={k} value={k}>
                  {ELEMENT_CATEGORY_META[k].label}
                </option>
              ))}
            </select>
          </div>

          <div className="liquid-glass-panel rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`w-12 h-12 rounded-xl border flex flex-col items-center justify-center shrink-0 ${
                  ELEMENT_CATEGORY_META[selectedElem.category].bgClass
                }`}
              >
                <span className="text-[10px] font-mono-tabular leading-none">{selectedElem.z}</span>
                <span className="text-base font-bold leading-tight">{selectedElem.symbol}</span>
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {selectedElem.nameVi} · <span className="font-normal text-slate-500 dark:text-slate-400">{selectedElem.nameEn}</span>
                </p>
                <p className="text-xs font-mono-tabular text-slate-600 dark:text-slate-300 truncate">
                  {selectedElem.electronConfig}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 text-xs font-mono-tabular">
              <div>
                <span className="text-[11px] text-slate-500 block">Khối lượng</span>
                <strong className="text-slate-900 dark:text-white">{selectedElem.mass}</strong>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Hóa trị</span>
                <strong className="text-slate-900 dark:text-white">{selectedElem.valenceHint}</strong>
              </div>
              {selectedElem.electronegativity != null && (
                <div>
                  <span className="text-[11px] text-slate-500 block">Độ âm điện</span>
                  <strong className="text-emerald-700 dark:text-emerald-300">{selectedElem.electronegativity}</strong>
                </div>
              )}
            </div>
          </div>

          <div className="liquid-glass-panel rounded-2xl p-3 overflow-x-auto">
            <div
              className="grid gap-1 min-w-[780px]"
              style={{ gridTemplateColumns: 'repeat(18, minmax(38px, 1fr))' }}
            >
              {PERIODIC_ELEMENTS.map((el) => {
                const matched = matchingElementsSet.has(el.z);
                const isSel = selectedElem.z === el.z;
                const meta = ELEMENT_CATEGORY_META[el.category];
                return (
                  <button
                    key={el.z}
                    type="button"
                    data-testid={`chem-el-${el.symbol}`}
                    onClick={() => setSelectedElem(el)}
                    style={{ gridColumn: el.gridCol, gridRow: el.gridRow }}
                    className={`rounded-lg border p-1 flex flex-col items-center justify-center transition-all cursor-pointer ${
                      meta.bgClass
                    } ${isSel ? 'ring-2 ring-emerald-500 scale-105 z-10' : ''} ${
                      matched ? 'opacity-100' : 'opacity-25'
                    }`}
                    title={`${el.z} ${el.nameVi} (${el.mass})`}
                  >
                    <span className="text-[9px] font-mono-tabular leading-none">{el.z}</span>
                    <span className="text-xs font-bold leading-tight">{el.symbol}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {subTab === 'calculator' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {/* Molar Mass Calculator */}
          <div className="liquid-glass-panel rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Tính khối lượng mol M
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {['H2SO4', 'Cu(NO3)2', 'Al2(SO4)3', 'CuSO4.5H2O', 'Ca(OH)2'].map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setFormulaInput(ex)}
                  className="px-2.5 py-1 rounded-lg glass-subsurface text-xs font-mono-tabular font-semibold cursor-pointer"
                >
                  {ex}
                </button>
              ))}
            </div>
            <input
              type="text"
              data-testid="chem-formula-input"
              value={formulaInput}
              onChange={(e) => setFormulaInput(e.target.value)}
              placeholder="Nhập công thức (vd: Cu(NO3)2, CuSO4.5H2O)…"
              className="w-full rounded-xl glass-subsurface px-3.5 py-2 text-sm font-mono-tabular text-slate-900 dark:text-white"
            />
            {!molarResult ? (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Nhập công thức để tính khối lượng mol M.
              </p>
            ) : molarResult.ok ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between pt-2 border-t border-slate-900/10 dark:border-white/10">
                  <span className="text-xs font-semibold text-slate-700 dark:text-slate-200">
                    M({molarResult.data.formula})
                  </span>
                  <strong
                    data-testid="chem-molar-mass-output"
                    className="text-lg font-bold font-mono-tabular text-emerald-700 dark:text-emerald-300"
                  >
                    {molarResult.data.molarMass} g/mol
                  </strong>
                </div>
                <div className="divide-y divide-slate-900/10 dark:divide-white/10">
                  {molarResult.data.breakdown.map((b) => (
                    <div key={b.symbol} className="py-1.5 flex justify-between text-xs font-mono-tabular">
                      <span>
                        <strong>{b.symbol}</strong> ({b.nameVi}) × {b.count}
                      </span>
                      <span>
                        {b.subtotalMass} g/mol · {b.percentMass}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-rose-600 dark:text-rose-400">{molarResult.error}</p>
            )}
          </div>

          {/* Chemical Reactions Bank */}
          <div className="liquid-glass-panel rounded-2xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Phương trình ({reactions.length})
              </h3>
              <div className="flex items-center gap-2">
                <select
                  value={reactionFilter}
                  onChange={(e) => setReactionFilter(e.target.value)}
                  className="rounded-xl glass-subsurface px-2.5 py-1 text-xs font-semibold"
                >
                  <option value="all">Tất cả</option>
                  <option value="Vô cơ">Vô cơ</option>
                  <option value="Axit - Bazơ">Axit - Bazơ</option>
                  <option value="Oxi hóa - Khử">Oxi hóa - Khử</option>
                  <option value="Hữu cơ">Hữu cơ</option>
                </select>
                <button
                  type="button"
                  onClick={() => setRxModalOpen(true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Thêm PTHH</span>
                </button>
              </div>
            </div>

            {filteredReactions.length === 0 ? (
              <div className="py-8 text-center space-y-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">Chưa có phương trình nào.</p>
                <button
                  type="button"
                  onClick={() => setRxModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold cursor-pointer"
                >
                  + Thêm phương trình
                </button>
              </div>
            ) : (
              <div className="divide-y divide-slate-900/10 dark:divide-white/10 max-h-[300px] overflow-y-auto pr-1">
                {filteredReactions.map((rx) => (
                  <div key={rx.id} className="py-2.5 flex items-start justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                        {rx.category} · {rx.condition}
                      </span>
                      <p className="text-xs sm:text-sm font-bold font-mono-tabular text-slate-900 dark:text-white">
                        {rx.equation}
                      </p>
                      {rx.phenomenon && (
                        <p className="text-xs text-slate-600 dark:text-slate-300">{rx.phenomenon}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setReactions((prev) => prev.filter((item) => item.id !== rx.id))
                      }
                      className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {subTab === 'titration' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2 liquid-glass-panel rounded-2xl p-4 space-y-3 text-xs">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Chuẩn độ HCl — NaOH
            </h3>

            <div className="rounded-xl glass-subsurface p-3.5 flex items-center justify-around">
              <svg viewBox="0 0 120 130" className="w-24 h-24">
                <path
                  d="M46,14 L74,14 L74,40 L102,108 C105,115 100,122 92,122 L28,122 C20,122 15,115 18,108 L46,40 Z"
                  fill="none"
                  stroke="currentColor"
                  strokeOpacity={0.5}
                  strokeWidth={2.5}
                />
                <path
                  d="M31,78 L89,78 L100,108 C102,114 98,119 91,119 L29,119 C22,119 18,114 20,108 Z"
                  fill={titrationNow.liquidHex}
                  fillOpacity={0.85}
                />
              </svg>
              <div className="space-y-0.5 font-mono-tabular">
                <p className="text-[11px] text-slate-500">pH</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{titrationNow.ph}</p>
                <p className="font-semibold text-emerald-700 dark:text-emerald-300">
                  {titrationNow.stateLabel}
                </p>
                <p className="text-[11px] text-slate-600 dark:text-slate-300">
                  Quỳ: {titrationNow.litmusColor} · PP: {titrationNow.phenolColor}
                </p>
              </div>
            </div>

            {[
              { label: 'V(NaOH)', val: baseVolAddedMl, unit: 'mL', min: 0, max: 60, step: 0.5, set: setBaseVolAddedMl },
              { label: 'CM HCl', val: acidM, unit: 'M', min: 0.05, max: 0.5, step: 0.05, set: setAcidM },
              { label: 'V(HCl)', val: acidVolMl, unit: 'mL', min: 10, max: 50, step: 5, set: setAcidVolMl },
              { label: 'CM NaOH', val: baseM, unit: 'M', min: 0.05, max: 0.5, step: 0.05, set: setBaseM },
            ].map((c) => (
              <label key={c.label} className="block space-y-1">
                <span className="flex justify-between font-semibold font-mono-tabular">
                  <span>{c.label}</span>
                  <span>
                    {c.val} {c.unit}
                  </span>
                </span>
                <input
                  type="range"
                  min={c.min}
                  max={c.max}
                  step={c.step}
                  value={c.val}
                  onChange={(e) => c.set(Number(e.target.value))}
                  className="w-full accent-emerald-600"
                />
              </label>
            ))}
            <p className="text-[11px] font-mono-tabular text-slate-600 dark:text-slate-300">
              Điểm tương đương: V(NaOH) = {titrationNow.equivalenceVolMl} mL
            </p>
          </div>

          <div className="lg:col-span-3 liquid-glass-panel rounded-2xl p-4 space-y-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Đường cong chuẩn độ pH</h3>
            <div className="h-[310px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={titrationCurve}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                  <XAxis dataKey="vBaseMl" tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 14]} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="ph" name="pH" stroke="#059669" fill="#10B981" fillOpacity={0.2} strokeWidth={2.5} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {subTab === 'pubchem' && (
        <div className="liquid-glass-panel rounded-2xl p-4 space-y-3">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Tra cứu PubChem</h3>
          <form onSubmit={handlePubChemSearch} className="flex gap-2">
            <input
              type="text"
              value={pubQuery}
              onChange={(e) => setPubQuery(e.target.value)}
              placeholder="Tên hợp chất hoặc công thức (aspirin, glucose, NaCl)…"
              className="flex-1 rounded-xl glass-subsurface px-3.5 py-2 text-sm text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              disabled={pubLoading || !pubQuery.trim()}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
            >
              {pubLoading ? 'Đang tra…' : 'Tra PubChem'}
            </button>
          </form>
          {pubError && <p className="text-xs text-rose-600 dark:text-rose-400">{pubError}</p>}
          {pubCompound && (
            <div className="pt-3 border-t border-slate-900/10 dark:border-white/10 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
              <div className="bg-white rounded-xl p-3 flex items-center justify-center">
                <img
                  src={`/api/external/pubchem/image/${pubCompound.cid}`}
                  alt={pubCompound.title}
                  className="max-h-44 object-contain"
                />
              </div>
              <div className="md:col-span-2 space-y-1.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-base font-bold text-slate-900 dark:text-white">
                    {pubCompound.title}{' '}
                    <span className="font-mono-tabular text-emerald-700 dark:text-emerald-300">
                      ({pubCompound.molecularFormula})
                    </span>
                  </p>
                  {pubCompound.molecularFormula && pubCompound.molecularFormula !== '—' && (
                    <button
                      type="button"
                      onClick={() => {
                        setFormulaInput(pubCompound.molecularFormula);
                        setSubTab('calculator');
                      }}
                      className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-semibold cursor-pointer"
                    >
                      Tính M({pubCompound.molecularFormula})
                    </button>
                  )}
                </div>
                <p className="font-mono-tabular text-slate-700 dark:text-slate-200">
                  CID: {pubCompound.cid} · {pubCompound.molecularWeight} g/mol
                </p>
                {pubCompound.iupacName && (
                  <p className="text-slate-600 dark:text-slate-300">IUPAC: {pubCompound.iupacName}</p>
                )}
                {pubCompound.canonicalSmiles && (
                  <p className="font-mono-tabular text-[11px] text-slate-500 break-all">
                    SMILES: {pubCompound.canonicalSmiles}
                  </p>
                )}
                {pubCompound.description && (
                  <p className="text-slate-700 dark:text-slate-200 leading-relaxed pt-1 line-clamp-4">
                    {pubCompound.description}
                  </p>
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
              Bài tập Hóa Học ({questions.length})
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
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Chấm điểm
                </button>
              )}
            </div>
          </div>

          {questions.length === 0 ? (
            <SubjectEmptyState
              testId="chem-practice-empty"
              title="Chưa có câu hỏi Hóa Học nào."
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
                    <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
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
                      if (!submitted && sel) cls = 'bg-emerald-600 text-white';
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

      {/* Modal: Thêm phương trình hóa học */}
      <Modal isOpen={rxModalOpen} onClose={() => setRxModalOpen(false)} title="Thêm phương trình hóa học" maxWidth="md">
        <form onSubmit={handleAddReaction} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <select value={rxCat} onChange={(e) => setRxCat(e.target.value as ChemicalReactionEntry['category'])} className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white">
              <option value="Vô cơ">Vô cơ</option>
              <option value="Axit - Bazơ">Axit - Bazơ</option>
              <option value="Oxi hóa - Khử">Oxi hóa - Khử</option>
              <option value="Hữu cơ">Hữu cơ</option>
            </select>
            <input type="text" value={rxCond} onChange={(e) => setRxCond(e.target.value)} placeholder="Điều kiện (vd: t°, H2SO4 đặc)" className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          </div>
          <input type="text" required value={rxEq} onChange={(e) => setRxEq(e.target.value)} placeholder="Phương trình (vd: Fe + CuSO4 -> FeSO4 + Cu)" className="w-full rounded-xl glass-subsurface px-3 py-2 font-mono-tabular text-sm text-slate-900 dark:text-white" />
          <input type="text" value={rxPhenom} onChange={(e) => setRxPhenom(e.target.value)} placeholder="Hiện tượng (tùy chọn)" className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white" />
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setRxModalOpen(false)} className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer">Đóng</button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold cursor-pointer">Lưu</button>
          </div>
        </form>
      </Modal>

      {/* Modal: Thêm câu hỏi Hóa Học */}
      <Modal isOpen={quizModalOpen} onClose={() => setQuizModalOpen(false)} title="Thêm câu hỏi Hóa Học" maxWidth="md">
        <form onSubmit={handleAddQuiz} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <select value={qGrade} onChange={(e) => setQGrade(e.target.value as ChemistryQuestionItem['grade'])} className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white">
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
            <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-semibold cursor-pointer">Lưu</button>
          </div>
        </form>
      </Modal>
    </SubjectWorkspaceShell>
  );
};
