import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Play,
  Plus,
  RotateCcw,
  Search,
  Trash2,
} from '../icons/UiIcons';
import type {
  EnglishGrammarPoint,
  EnglishQuizItem,
  EnglishVocabItem,
} from '../../data/subjectsSeedData';
import {
  loadSubjectCollection,
  saveSubjectCollection,
} from '../../utils/subjects/subjectDataStore';
import { gradeWordOrderSentence } from '../../utils/subjects/subjectWorkspaceEngine';
import { Modal } from '../common/Modal';
import {
  SubjectEmptyState,
  SubjectWorkspaceShell,
  type GeneratedAiCardItem,
  type GeneratedAiQuizItem,
  type SubjectHostWorkspaceProps,
} from './SubjectWorkspaceShared';

interface LexiconLookupResult {
  word?: string;
  phonetic?: string;
  definitions?: Array<{ partOfSpeech?: string; definition: string; example?: string }>;
  synonyms?: string[];
  relatedWords?: string[];
  source?: string;
}

interface SentenceExercise {
  id: string;
  target: string;
  hint?: string;
}

function shuffleWords(sentence: string): string[] {
  const words = sentence.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return words;
  // Deterministic deterministic-looking scramble that never matches the original order when >1 word
  const copy = [...words];
  return copy.sort((a, b) => a.localeCompare(b)).reverse();
}

export const EnglishSubjectView: React.FC<SubjectHostWorkspaceProps> = (props) => {
  const userId = props.currentUser.id;
  const [subTab, setSubTab] = useState<string>('vocab');

  const [vocabList, setVocabList] = useState<EnglishVocabItem[]>(() =>
    loadSubjectCollection<EnglishVocabItem>(userId, 'english', 'vocab')
  );
  const [grammarList, setGrammarList] = useState<EnglishGrammarPoint[]>(() =>
    loadSubjectCollection<EnglishGrammarPoint>(userId, 'english', 'grammar')
  );
  const [sentenceList, setSentenceList] = useState<SentenceExercise[]>(() =>
    loadSubjectCollection<SentenceExercise>(userId, 'english', 'sentences')
  );
  const [quizList, setQuizList] = useState<EnglishQuizItem[]>(() =>
    loadSubjectCollection<EnglishQuizItem>(userId, 'english', 'quiz')
  );

  useEffect(() => {
    saveSubjectCollection(userId, 'english', 'vocab', vocabList);
  }, [userId, vocabList]);
  useEffect(() => {
    saveSubjectCollection(userId, 'english', 'grammar', grammarList);
  }, [userId, grammarList]);
  useEffect(() => {
    saveSubjectCollection(userId, 'english', 'sentences', sentenceList);
  }, [userId, sentenceList]);
  useEffect(() => {
    saveSubjectCollection(userId, 'english', 'quiz', quizList);
  }, [userId, quizList]);

  // Vocab & Flashcard state
  const [levelFilter, setLevelFilter] = useState<string>('all');
  const [vocabSearch, setVocabSearch] = useState('');
  const [cardIdx, setCardIdx] = useState(0);
  const [cardFlipped, setCardFlipped] = useState(false);

  // Add Vocab modal
  const [vocabModalOpen, setVocabModalOpen] = useState(false);
  const [vWord, setVWord] = useState('');
  const [vPhonetic, setVPhonetic] = useState('');
  const [vPos, setVPos] = useState('noun');
  const [vLevel, setVLevel] = useState<EnglishVocabItem['level']>('B1');
  const [vTopic, setVTopic] = useState('');
  const [vMeaning, setVMeaning] = useState('');
  const [vExample, setVExample] = useState('');

  // Grammar & Sentence state
  const [grammarAnswers, setGrammarAnswers] = useState<Record<string, number>>({});
  const [grammarModalOpen, setGrammarModalOpen] = useState(false);
  const [gTitle, setGTitle] = useState('');
  const [gUnit, setGUnit] = useState('');
  const [gLevel, setGLevel] = useState<EnglishGrammarPoint['level']>('B1');
  const [gStructure, setGStructure] = useState('');
  const [gUsage, setGUsage] = useState('');
  const [gExample, setGExample] = useState('');

  const [sentenceModalOpen, setSentenceModalOpen] = useState(false);
  const [sTarget, setSTarget] = useState('');
  const [sHint, setSHint] = useState('');
  const [activeSentenceIdx, setActiveSentenceIdx] = useState(0);
  const [chosenWords, setChosenWords] = useState<string[]>([]);
  const [orderChecked, setOrderChecked] = useState<boolean | null>(null);

  // Dictionary (Datamuse + Wiktionary via /api/external/lexicon)
  const [dictQuery, setDictQuery] = useState('');
  const [dictLoading, setDictLoading] = useState(false);
  const [dictError, setDictError] = useState<string | null>(null);
  const [dictResult, setDictResult] = useState<LexiconLookupResult | null>(null);

  // Practice Quiz state
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizModalOpen, setQuizModalOpen] = useState(false);
  const [qSkill, setQSkill] = useState<EnglishQuizItem['skill']>('Grammar');
  const [qLevel, setQLevel] = useState<EnglishQuizItem['level']>('B1');
  const [qPrompt, setQPrompt] = useState('');
  const [qOptA, setQOptA] = useState('');
  const [qOptB, setQOptB] = useState('');
  const [qOptC, setQOptC] = useState('');
  const [qOptD, setQOptD] = useState('');
  const [qCorrectIdx, setQCorrectIdx] = useState(0);
  const [qExplain, setQExplain] = useState('');

  const filteredVocab = useMemo(() => {
    const q = vocabSearch.trim().toLowerCase();
    return vocabList.filter((item) => {
      if (levelFilter !== 'all' && item.level !== levelFilter) return false;
      if (!q) return true;
      return (
        item.word.toLowerCase().includes(q) ||
        item.meaning.toLowerCase().includes(q) ||
        item.topic.toLowerCase().includes(q)
      );
    });
  }, [levelFilter, vocabList, vocabSearch]);

  const activeCard =
    filteredVocab.length > 0 ? filteredVocab[cardIdx % filteredVocab.length] : null;

  const activeSentence =
    sentenceList.length > 0
      ? sentenceList[activeSentenceIdx % sentenceList.length]
      : null;

  const wordBank = useMemo(
    () => (activeSentence ? shuffleWords(activeSentence.target) : []),
    [activeSentence]
  );

  const speakWord = (text: string) => {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = 'en-US';
        utter.rate = 0.92;
        window.speechSynthesis.speak(utter);
      }
    } catch {
      // ignore if speech synthesis unavailable
    }
  };

  const handleAddVocab = (e: React.FormEvent) => {
    e.preventDefault();
    if (!vWord.trim() || !vMeaning.trim()) return;
    setVocabList((prev) => [
      {
        id: `en-v-${Date.now()}`,
        word: vWord.trim(),
        phonetic: vPhonetic.trim(),
        partOfSpeech: vPos.trim() || 'noun',
        level: vLevel,
        topic: vTopic.trim() || 'Chung',
        meaning: vMeaning.trim(),
        example: vExample.trim(),
      },
      ...prev,
    ]);
    setVWord('');
    setVPhonetic('');
    setVTopic('');
    setVMeaning('');
    setVExample('');
    setCardIdx(0);
    setCardFlipped(false);
    setVocabModalOpen(false);
  };

  const handleAddGrammar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!gTitle.trim() || !gStructure.trim()) return;
    setGrammarList((prev) => [
      {
        id: `en-g-${Date.now()}`,
        title: gTitle.trim(),
        unit: gUnit.trim() || 'Ngữ pháp',
        level: gLevel,
        structure: gStructure.trim(),
        usage: gUsage.trim(),
        example: gExample.trim(),
        quickQuiz: {
          question: '',
          options: [],
          correctIndex: 0,
          explain: '',
        },
      },
      ...prev,
    ]);
    setGTitle('');
    setGUnit('');
    setGStructure('');
    setGUsage('');
    setGExample('');
    setGrammarModalOpen(false);
  };

  const handleAddSentence = (e: React.FormEvent) => {
    e.preventDefault();
    if (!sTarget.trim()) return;
    setSentenceList((prev) => [
      ...prev,
      { id: `en-s-${Date.now()}`, target: sTarget.trim(), hint: sHint.trim() || undefined },
    ]);
    setSTarget('');
    setSHint('');
    setChosenWords([]);
    setOrderChecked(null);
    setSentenceModalOpen(false);
  };

  const handleAddQuiz = (e: React.FormEvent) => {
    e.preventDefault();
    const opts = [qOptA, qOptB, qOptC, qOptD].map((s) => s.trim()).filter(Boolean);
    if (!qPrompt.trim() || opts.length < 2) return;
    setQuizList((prev) => [
      {
        id: `en-q-${Date.now()}`,
        skill: qSkill,
        level: qLevel,
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

  const handleLookupLexicon = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const w = dictQuery.trim();
    if (!w) return;
    setDictLoading(true);
    setDictError(null);
    try {
      const res = await fetch(`/api/external/lexicon?word=${encodeURIComponent(w)}&lang=en`);
      const data = (await res.json().catch(() => ({}))) as {
        entry?: {
          word?: string;
          ipa?: string;
          meanings?: Array<{
            partOfSpeech?: string;
            definitions?: Array<{ definition: string; example?: string }>;
          }>;
          synonyms?: string[];
          relatedTriggers?: string[];
          sources?: string[];
        };
        error?: string;
      };
      if (!res.ok || !data.entry) {
        setDictError(data.error || `Không tìm thấy "${w}".`);
        setDictResult(null);
        return;
      }
      const flatDefs = (data.entry.meanings || []).flatMap((m) =>
        (m.definitions || []).map((d) => ({
          partOfSpeech: m.partOfSpeech,
          definition: d.definition,
          example: d.example,
        }))
      );
      setDictResult({
        word: data.entry.word || w,
        phonetic: data.entry.ipa || '',
        definitions: flatDefs,
        synonyms: data.entry.synonyms || [],
        relatedWords: data.entry.relatedTriggers || [],
        source: (data.entry.sources || ['Wiktionary', 'Datamuse']).join(' + '),
      });
    } catch {
      setDictError('Không thể kết nối từ điển Datamuse / Wiktionary.');
    } finally {
      setDictLoading(false);
    }
  };

  const handleSaveDictToDeck = () => {
    if (!dictResult?.word) return;
    const exists = vocabList.some(
      (v) => v.word.toLowerCase() === dictResult.word!.toLowerCase()
    );
    if (exists) return;
    const firstDef = dictResult.definitions?.[0];
    setVocabList((prev) => [
      {
        id: `en-dict-${Date.now()}`,
        word: dictResult.word!,
        phonetic: dictResult.phonetic || '',
        partOfSpeech: firstDef?.partOfSpeech || 'noun',
        level: 'B1',
        topic: 'Tra cứu',
        meaning: firstDef?.definition || dictResult.word!,
        example: firstDef?.example || '',
      },
      ...prev,
    ]);
  };

  const handleSubmitPractice = () => {
    if (quizList.length === 0) return;
    setQuizSubmitted(true);
    const correctCount = quizList.filter((q) => quizAnswers[q.id] === q.correctIndex).length;
    props.onRecordPracticeResult(correctCount, quizList.length, 'Tiếng Anh');
  };

  const handleImportExcelRows = (rows: Array<Record<string, unknown>>) => {
    if (subTab === 'practice') {
      const mapped: EnglishQuizItem[] = rows
        .map((r, i) => {
          const opts = [r.optionA, r.optionB, r.optionC, r.optionD].map((x) =>
            String(x || '').trim()
          );
          if (!r.question || opts.some((o) => !o)) return null;
          const ansLetter = String(r.answer || 'A').trim().toUpperCase();
          const idx = ['A', 'B', 'C', 'D'].indexOf(ansLetter);
          return {
            id: `en-imp-q-${Date.now()}-${i}`,
            skill: (String(r.skill || 'Grammar') as EnglishQuizItem['skill']) || 'Grammar',
            level: (String(r.level || 'B1') as EnglishQuizItem['level']) || 'B1',
            question: String(r.question),
            options: opts,
            correctIndex: idx >= 0 ? idx : 0,
            explain: String(r.explain || ''),
          };
        })
        .filter((x): x is EnglishQuizItem => Boolean(x));
      if (mapped.length > 0) setQuizList((prev) => [...mapped, ...prev]);
    } else {
      const mapped: EnglishVocabItem[] = rows
        .map((r, i) => {
          if (!r.word || !r.meaning) return null;
          return {
            id: `en-imp-v-${Date.now()}-${i}`,
            word: String(r.word),
            phonetic: String(r.phonetic || ''),
            partOfSpeech: String(r.partOfSpeech || 'noun'),
            level: (String(r.level || 'B1') as EnglishVocabItem['level']) || 'B1',
            topic: String(r.topic || 'Chung'),
            meaning: String(r.meaning),
            example: String(r.example || ''),
          };
        })
        .filter((x): x is EnglishVocabItem => Boolean(x));
      if (mapped.length > 0) setVocabList((prev) => [...mapped, ...prev]);
    }
  };

  const handleInjectAiQuiz = (generated: GeneratedAiQuizItem[]) => {
    const next: EnglishQuizItem[] = generated.map((g, i) => ({
      id: `en-ai-q-${Date.now()}-${i}`,
      skill: 'Grammar',
      level: 'B1',
      question: g.question,
      options: g.options,
      correctIndex: g.correctIndex,
      explain: g.explanation,
    }));
    setQuizList((prev) => [...next, ...prev]);
    setSubTab('practice');
  };

  const handleInjectAiCards = (cards: GeneratedAiCardItem[]) => {
    const next: EnglishVocabItem[] = cards.map((c, i) => ({
      id: `en-ai-v-${Date.now()}-${i}`,
      word: c.front,
      phonetic: '',
      partOfSpeech: 'phrase',
      level: 'B1',
      topic: 'AI',
      meaning: c.back,
      example: c.example || c.tip,
    }));
    setVocabList((prev) => [...next, ...prev]);
    setSubTab('vocab');
  };

  const liveSummary = activeCard
    ? `Từ hiện tại: ${activeCard.word} (${activeCard.phonetic}) — ${activeCard.meaning}`
    : 'Môn Tiếng Anh';

  return (
    <SubjectWorkspaceShell
      {...props}
      activeSubTab={subTab}
      onChangeSubTab={setSubTab}
      liveContextSummary={liveSummary}
      excelModuleKey={subTab === 'practice' ? 'quiz' : 'vocab'}
      excelExportRecords={
        subTab === 'practice'
          ? quizList.map((q) => ({
              question: q.question,
              optionA: q.options[0],
              optionB: q.options[1],
              optionC: q.options[2],
              optionD: q.options[3],
              answer: ['A', 'B', 'C', 'D'][q.correctIndex] || 'A',
              level: q.level,
              skill: q.skill,
              explain: q.explain,
            }))
          : (vocabList as unknown as Array<Record<string, unknown>>)
      }
      onImportExcelRows={handleImportExcelRows}
      onInjectGeneratedQuiz={handleInjectAiQuiz}
      onInjectGeneratedCards={handleInjectAiCards}
    >
      {subTab === 'vocab' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="relative flex-1 min-w-[180px] sm:max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={vocabSearch}
                onChange={(e) => {
                  setVocabSearch(e.target.value);
                  setCardIdx(0);
                }}
                placeholder="Lọc từ vựng…"
                className="w-full rounded-xl glass-subsurface pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-white"
              />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
                {['all', 'A2', 'B1', 'B2', 'C1'].map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => {
                      setLevelFilter(lvl);
                      setCardIdx(0);
                    }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                      levelFilter === lvl
                        ? 'bg-sky-600 text-white'
                        : 'glass-subsurface text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {lvl === 'all' ? 'Tất cả' : lvl}
                  </button>
                ))}
              </div>
              <button
                type="button"
                data-testid="english-add-vocab-btn"
                onClick={() => setVocabModalOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer whitespace-nowrap shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm từ</span>
              </button>
            </div>
          </div>

          {vocabList.length === 0 ? (
            <SubjectEmptyState
              testId="english-vocab-empty"
              title="Chưa có từ vựng nào."
              actions={[
                { label: '+ Thêm từ', onClick: () => setVocabModalOpen(true), primary: true },
                { label: 'Tra từ điển', onClick: () => setSubTab('dict') },
                { label: 'Tạo bằng AI', onClick: () => setSubTab('ai-tutor') },
              ]}
            />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-3">
              {/* Interactive Flashcard Stage */}
              <div className="lg:col-span-2 liquid-glass-panel rounded-2xl p-4 flex flex-col justify-between gap-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    Thẻ ghi nhớ
                  </h3>
                  <span className="text-xs font-mono-tabular text-slate-600 dark:text-slate-300">
                    {filteredVocab.length > 0 ? `${(cardIdx % filteredVocab.length) + 1}/${filteredVocab.length}` : '0/0'}
                  </span>
                </div>

                {activeCard ? (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setCardFlipped((f) => !f)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setCardFlipped((f) => !f);
                      }
                    }}
                    className="min-h-[200px] rounded-xl border border-slate-900/10 dark:border-white/10 p-5 flex flex-col items-center justify-center text-center gap-2 cursor-pointer transition-colors hover:bg-white/40 dark:hover:bg-white/5"
                  >
                    {!cardFlipped ? (
                      <>
                        <span className="text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                          {activeCard.level} · {activeCard.partOfSpeech}
                        </span>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">
                          {activeCard.word}
                        </p>
                        {activeCard.phonetic && (
                          <p className="text-xs font-mono-tabular text-slate-500 dark:text-slate-400">
                            {activeCard.phonetic}
                          </p>
                        )}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            speakWord(activeCard.word);
                          }}
                          className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer"
                        >
                          <Play className="w-3 h-3" />
                          <span>Nghe</span>
                        </button>
                      </>
                    ) : (
                      <>
                        <p className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                          {activeCard.meaning}
                        </p>
                        {activeCard.example && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 italic max-w-sm">
                            "{activeCard.example}"
                          </p>
                        )}
                      </>
                    )}
                  </div>
                ) : (
                  <div className="min-h-[200px] flex items-center justify-center text-xs text-slate-500">
                    Không khớp bộ lọc.
                  </div>
                )}

                {activeCard && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setCardFlipped(false);
                        setCardIdx((i) => (i - 1 + filteredVocab.length) % filteredVocab.length);
                      }}
                      className="p-2 rounded-xl glass-subsurface cursor-pointer"
                      aria-label="Thẻ trước"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => props.onToggleMastered(activeCard.id)}
                      className={`flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                        props.progress.masteredIds.includes(activeCard.id)
                          ? 'bg-emerald-600 text-white'
                          : 'glass-subsurface text-slate-800 dark:text-slate-100'
                      }`}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span>
                        {props.progress.masteredIds.includes(activeCard.id) ? 'Đã thuộc' : 'Chưa thuộc'}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCardFlipped(false);
                        setCardIdx((i) => (i + 1) % filteredVocab.length);
                      }}
                      className="p-2 rounded-xl glass-subsurface cursor-pointer"
                      aria-label="Thẻ sau"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Vocab List */}
              <div className="lg:col-span-3 liquid-glass-panel rounded-2xl p-4">
                <div className="divide-y divide-slate-900/10 dark:divide-white/10 max-h-[340px] overflow-y-auto pr-1">
                  {filteredVocab.map((item, idx) => {
                    const mastered = props.progress.masteredIds.includes(item.id);
                    return (
                      <div
                        key={item.id}
                        onClick={() => {
                          setCardIdx(idx);
                          setCardFlipped(false);
                        }}
                        className="py-2.5 flex items-start justify-between gap-3 cursor-pointer hover:bg-white/30 dark:hover:bg-white/5 px-2 rounded-lg"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-white">
                              {item.word}
                            </span>
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                              {[item.phonetic, item.partOfSpeech, item.level].filter(Boolean).join(' · ')}
                            </span>
                          </div>
                          <p className="text-xs font-medium text-sky-700 dark:text-sky-300">
                            {item.meaning}
                          </p>
                          {item.example && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 italic">
                              {item.example}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              props.onToggleMastered(item.id);
                            }}
                            className={`p-1.5 rounded-lg cursor-pointer ${
                              mastered
                                ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                            }`}
                            title="Đã thuộc"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setVocabList((prev) => prev.filter((v) => v.id !== item.id));
                            }}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 cursor-pointer"
                            title="Xóa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === 'grammar' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Ngữ pháp &amp; Ghép câu ({grammarList.length})
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSentenceModalOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl glass-subsurface text-xs font-semibold text-slate-800 dark:text-slate-100 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm câu ghép</span>
              </button>
              <button
                type="button"
                onClick={() => setGrammarModalOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm cấu trúc</span>
              </button>
            </div>
          </div>

          {grammarList.length === 0 && sentenceList.length === 0 ? (
            <SubjectEmptyState
              testId="english-grammar-empty"
              title="Chưa có cấu trúc ngữ pháp hay bài ghép câu nào."
              actions={[
                { label: '+ Thêm cấu trúc', onClick: () => setGrammarModalOpen(true), primary: true },
                { label: '+ Thêm câu ghép', onClick: () => setSentenceModalOpen(true) },
                { label: 'Hỏi Gia sư AI', onClick: () => setSubTab('ai-tutor') },
              ]}
            />
          ) : (
            <>
              {grammarList.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {grammarList.map((g) => {
                    const selected = grammarAnswers[g.id];
                    return (
                      <div key={g.id} className="liquid-glass-panel rounded-2xl p-4 space-y-2">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <span className="text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                              {g.unit} · {g.level}
                            </span>
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              {g.title}
                            </h4>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setGrammarList((prev) => prev.filter((item) => item.id !== g.id))
                            }
                            className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                            title="Xóa"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <p className="rounded-xl bg-slate-900/5 dark:bg-white/5 px-3 py-2 text-xs font-mono-tabular font-semibold text-slate-900 dark:text-white">
                          {g.structure}
                        </p>
                        {g.usage && (
                          <p className="text-xs text-slate-600 dark:text-slate-300">{g.usage}</p>
                        )}
                        {g.example && (
                          <p className="text-xs text-sky-800 dark:text-sky-200 italic">
                            {g.example}
                          </p>
                        )}
                        {g.quickQuiz.question && g.quickQuiz.options.length > 0 && (
                          <div className="pt-2 border-t border-slate-900/10 dark:border-white/10 space-y-1.5">
                            <p className="text-xs font-semibold text-slate-900 dark:text-white">
                              {g.quickQuiz.question}
                            </p>
                            <div className="grid grid-cols-2 gap-1.5">
                              {g.quickQuiz.options.map((opt, idx) => {
                                const isPicked = selected === idx;
                                const isRight = idx === g.quickQuiz.correctIndex;
                                let cls = 'glass-subsurface text-slate-800 dark:text-slate-100';
                                if (selected !== undefined) {
                                  if (isRight) cls = 'bg-emerald-600 text-white';
                                  else if (isPicked) cls = 'bg-rose-600 text-white';
                                }
                                return (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() =>
                                      setGrammarAnswers((prev) => ({ ...prev, [g.id]: idx }))
                                    }
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium text-left cursor-pointer ${cls}`}
                                  >
                                    {opt}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {activeSentence && (
                <div className="liquid-glass-panel rounded-2xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Ghép câu ({(activeSentenceIdx % sentenceList.length) + 1}/{sentenceList.length})
                      </h4>
                      {activeSentence.hint && (
                        <span className="text-xs text-slate-500 dark:text-slate-400">
                          · {activeSentence.hint}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {sentenceList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setActiveSentenceIdx((i) => (i + 1) % sentenceList.length);
                            setChosenWords([]);
                            setOrderChecked(null);
                          }}
                          className="text-xs font-semibold text-sky-600 dark:text-sky-400 cursor-pointer"
                        >
                          Câu khác
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setChosenWords([]);
                          setOrderChecked(null);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-slate-600 dark:text-slate-300 cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Làm lại</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSentenceList((prev) =>
                            prev.filter((s) => s.id !== activeSentence.id)
                          );
                          setChosenWords([]);
                          setOrderChecked(null);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                        title="Xóa câu"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="min-h-[42px] rounded-xl glass-subsurface p-2 flex flex-wrap gap-1.5 items-center">
                    {chosenWords.length === 0 ? (
                      <span className="text-xs text-slate-500">Chọn từ theo đúng thứ tự…</span>
                    ) : (
                      chosenWords.map((w, idx) => (
                        <button
                          key={`${w}-${idx}`}
                          type="button"
                          onClick={() => {
                            setChosenWords((prev) => prev.filter((_, i) => i !== idx));
                            setOrderChecked(null);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-sky-600 text-white text-xs font-semibold cursor-pointer"
                        >
                          {w}
                        </button>
                      ))
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {wordBank.map((w, idx) => {
                      const totalCount = wordBank.filter((x) => x === w).length;
                      const usedCount = chosenWords.filter((x) => x === w).length;
                      const firstMatchIdx = wordBank.indexOf(w);
                      const disabled = usedCount >= totalCount || (usedCount > 0 && idx < firstMatchIdx + usedCount);
                      return (
                        <button
                          key={`${w}-${idx}`}
                          type="button"
                          disabled={disabled}
                          onClick={() => {
                            setChosenWords((prev) => [...prev, w]);
                            setOrderChecked(null);
                          }}
                          className="px-2.5 py-1 rounded-lg glass-subsurface disabled:opacity-35 text-xs font-medium text-slate-800 dark:text-slate-100 cursor-pointer"
                        >
                          {w}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      disabled={chosenWords.length === 0}
                      onClick={() => {
                        const res = gradeWordOrderSentence(chosenWords, activeSentence.target);
                        setOrderChecked(res.isCorrect);
                      }}
                      className="ml-auto px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white text-xs font-semibold cursor-pointer"
                    >
                      Kiểm tra
                    </button>
                  </div>
                  {orderChecked !== null && (
                    <p
                      className={`text-xs font-semibold ${
                        orderChecked
                          ? 'text-emerald-700 dark:text-emerald-300'
                          : 'text-rose-600 dark:text-rose-400'
                      }`}
                    >
                      {orderChecked ? `Chính xác: "${activeSentence.target}".` : 'Chưa đúng thứ tự.'}
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {subTab === 'dict' && (
        <div className="liquid-glass-panel rounded-2xl p-4 space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Tra từ tiếng Anh
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Wiktionary · Datamuse
            </span>
          </div>
          <form onSubmit={handleLookupLexicon} className="flex gap-2">
            <input
              type="text"
              data-testid="english-dict-input"
              value={dictQuery}
              onChange={(e) => setDictQuery(e.target.value)}
              placeholder="Nhập từ tiếng Anh cần tra…"
              className="flex-1 rounded-xl glass-subsurface px-3.5 py-2 text-sm text-slate-900 dark:text-white"
            />
            <button
              type="submit"
              data-testid="english-dict-search-btn"
              disabled={dictLoading || !dictQuery.trim()}
              className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
            >
              {dictLoading ? 'Đang tra…' : 'Tra từ'}
            </button>
          </form>

          {dictError && <p className="text-xs text-rose-600 dark:text-rose-400">{dictError}</p>}

          {dictResult && (
            <div className="pt-2 border-t border-slate-900/10 dark:border-white/10 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-lg font-bold text-slate-900 dark:text-white">
                    {dictResult.word}{' '}
                    <span className="text-sm font-normal font-mono-tabular text-sky-700 dark:text-sky-300">
                      {dictResult.phonetic}
                    </span>
                  </h4>
                  {dictResult.source && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {dictResult.source}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => speakWord(dictResult.word || '')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl glass-subsurface text-xs font-semibold cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Phát âm</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveDictToDeck}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Lưu thẻ</span>
                  </button>
                </div>
              </div>

              {dictResult.definitions && dictResult.definitions.length > 0 && (
                <div className="space-y-1.5">
                  {dictResult.definitions.slice(0, 5).map((d, i) => (
                    <div key={i} className="text-xs text-slate-800 dark:text-slate-100 leading-relaxed">
                      <span className="font-semibold text-sky-700 dark:text-sky-300">
                        [{d.partOfSpeech || 'word'}]
                      </span>{' '}
                      {d.definition}
                      {d.example && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 italic ml-3">
                          "{d.example}"
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {dictResult.synonyms && dictResult.synonyms.length > 0 && (
                <p className="text-xs text-slate-700 dark:text-slate-200">
                  <span className="font-semibold">Đồng nghĩa: </span>
                  {dictResult.synonyms.slice(0, 8).join(', ')}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {subTab === 'practice' && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              Bài tập Tiếng Anh ({quizList.length})
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
              {quizSubmitted && quizList.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setQuizAnswers({});
                    setQuizSubmitted(false);
                  }}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl glass-subsurface text-xs font-semibold cursor-pointer"
                >
                  <Clock className="w-3.5 h-3.5" />
                  <span>Làm lại</span>
                </button>
              )}
              {quizList.length > 0 && (
                <button
                  type="button"
                  onClick={handleSubmitPractice}
                  className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Chấm điểm
                </button>
              )}
            </div>
          </div>

          {quizList.length === 0 ? (
            <SubjectEmptyState
              testId="english-quiz-empty"
              title="Chưa có câu hỏi luyện tập nào."
              actions={[
                { label: '+ Thêm câu hỏi', onClick: () => setQuizModalOpen(true), primary: true },
                { label: 'Tạo đề bằng AI', onClick: () => setSubTab('ai-tutor') },
              ]}
            />
          ) : (
            <div className="space-y-2.5">
              {quizList.map((q, idx) => {
                const picked = quizAnswers[q.id];
                return (
                  <div key={q.id} className="liquid-glass-panel rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[11px] font-semibold text-sky-700 dark:text-sky-300">
                        Câu {idx + 1} · {q.skill} · {q.level}
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setQuizList((prev) => prev.filter((item) => item.id !== q.id))
                        }
                        className="p-1 text-slate-400 hover:text-rose-500 cursor-pointer"
                        title="Xóa"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {q.passage && (
                      <div className="rounded-xl bg-slate-900/5 dark:bg-white/5 p-3 text-xs text-slate-700 dark:text-slate-200 leading-relaxed">
                        {q.passage}
                      </div>
                    )}
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {q.question}
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {q.options.map((opt, oIdx) => {
                        const isSel = picked === oIdx;
                        const isCorrect = oIdx === q.correctIndex;
                        let cls = 'glass-subsurface text-slate-800 dark:text-slate-100';
                        if (!quizSubmitted && isSel) cls = 'bg-sky-600 text-white';
                        else if (quizSubmitted) {
                          if (isCorrect) cls = 'bg-emerald-600 text-white';
                          else if (isSel) cls = 'bg-rose-600 text-white';
                        }
                        return (
                          <button
                            key={oIdx}
                            type="button"
                            disabled={quizSubmitted}
                            onClick={() =>
                              setQuizAnswers((prev) => ({ ...prev, [q.id]: oIdx }))
                            }
                            className={`px-3 py-2 rounded-xl text-left text-xs font-medium cursor-pointer ${cls}`}
                          >
                            {String.fromCharCode(65 + oIdx)}. {opt}
                          </button>
                        );
                      })}
                    </div>
                    {quizSubmitted && q.explain && (
                      <p className="text-xs text-slate-600 dark:text-slate-300 pt-1">
                        {q.explain}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Thêm từ vựng */}
      <Modal
        isOpen={vocabModalOpen}
        onClose={() => setVocabModalOpen(false)}
        title="Thêm từ vựng mới"
        maxWidth="md"
      >
        <form onSubmit={handleAddVocab} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2.5">
            <input
              type="text"
              required
              value={vWord}
              onChange={(e) => setVWord(e.target.value)}
              placeholder="Từ vựng (vd: persevere)"
              className="rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white"
            />
            <input
              type="text"
              value={vPhonetic}
              onChange={(e) => setVPhonetic(e.target.value)}
              placeholder="Phiên âm IPA"
              className="rounded-xl glass-subsurface px-3 py-2 text-sm font-mono-tabular text-slate-900 dark:text-white"
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="text"
              value={vPos}
              onChange={(e) => setVPos(e.target.value)}
              placeholder="Từ loại (noun/verb)"
              className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white"
            />
            <select
              value={vLevel}
              onChange={(e) => setVLevel(e.target.value as EnglishVocabItem['level'])}
              className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white"
            >
              {['A1', 'A2', 'B1', 'B2', 'C1'].map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
            <input
              type="text"
              value={vTopic}
              onChange={(e) => setVTopic(e.target.value)}
              placeholder="Chủ đề"
              className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <input
            type="text"
            required
            value={vMeaning}
            onChange={(e) => setVMeaning(e.target.value)}
            placeholder="Nghĩa tiếng Việt"
            className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white"
          />
          <input
            type="text"
            value={vExample}
            onChange={(e) => setVExample(e.target.value)}
            placeholder="Câu ví dụ (tùy chọn)"
            className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setVocabModalOpen(false)}
              className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-sky-600 text-white font-semibold cursor-pointer"
            >
              Lưu từ
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Thêm ngữ pháp */}
      <Modal
        isOpen={grammarModalOpen}
        onClose={() => setGrammarModalOpen(false)}
        title="Thêm cấu trúc ngữ pháp"
        maxWidth="md"
      >
        <form onSubmit={handleAddGrammar} className="space-y-3 text-xs">
          <input
            type="text"
            required
            value={gTitle}
            onChange={(e) => setGTitle(e.target.value)}
            placeholder="Tên điểm ngữ pháp (vd: Câu điều kiện loại 2)"
            className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white"
          />
          <div className="grid grid-cols-2 gap-2">
            <input
              type="text"
              value={gUnit}
              onChange={(e) => setGUnit(e.target.value)}
              placeholder="Chuyên đề (Tenses, Passive...)"
              className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white"
            />
            <select
              value={gLevel}
              onChange={(e) => setGLevel(e.target.value as EnglishGrammarPoint['level'])}
              className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value="A2">A2</option>
              <option value="B1">B1</option>
              <option value="B2">B2</option>
            </select>
          </div>
          <input
            type="text"
            required
            value={gStructure}
            onChange={(e) => setGStructure(e.target.value)}
            placeholder="Công thức (vd: If + S + V2/ed, S + would + V)"
            className="w-full rounded-xl glass-subsurface px-3 py-2 font-mono-tabular text-slate-900 dark:text-white"
          />
          <textarea
            rows={2}
            value={gUsage}
            onChange={(e) => setGUsage(e.target.value)}
            placeholder="Cách dùng ngắn gọn"
            className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white"
          />
          <input
            type="text"
            value={gExample}
            onChange={(e) => setGExample(e.target.value)}
            placeholder="Ví dụ minh họa"
            className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setGrammarModalOpen(false)}
              className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-sky-600 text-white font-semibold cursor-pointer"
            >
              Lưu cấu trúc
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Thêm câu ghép */}
      <Modal
        isOpen={sentenceModalOpen}
        onClose={() => setSentenceModalOpen(false)}
        title="Thêm bài tập ghép câu"
        maxWidth="md"
      >
        <form onSubmit={handleAddSentence} className="space-y-3 text-xs">
          <input
            type="text"
            required
            value={sTarget}
            onChange={(e) => setSTarget(e.target.value)}
            placeholder="Nhập câu tiếng Anh hoàn chỉnh…"
            className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white"
          />
          <input
            type="text"
            value={sHint}
            onChange={(e) => setSHint(e.target.value)}
            placeholder="Nghĩa tiếng Việt / gợi ý (tùy chọn)"
            className="w-full rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white"
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setSentenceModalOpen(false)}
              className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer"
            >
              Đóng
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-sky-600 text-white font-semibold cursor-pointer"
            >
              Tạo bài ghép
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal: Thêm câu hỏi trắc nghiệm */}
      <Modal
        isOpen={quizModalOpen}
        onClose={() => setQuizModalOpen(false)}
        title="Thêm câu hỏi Tiếng Anh"
        maxWidth="md"
      >
        <form onSubmit={handleAddQuiz} className="space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <select
              value={qSkill}
              onChange={(e) => setQSkill(e.target.value as EnglishQuizItem['skill'])}
              className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value="Grammar">Grammar</option>
              <option value="Vocabulary">Vocabulary</option>
              <option value="Reading">Reading</option>
            </select>
            <select
              value={qLevel}
              onChange={(e) => setQLevel(e.target.value as EnglishQuizItem['level'])}
              className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value="A2">A2</option>
              <option value="B1">B1</option>
              <option value="B2">B2</option>
            </select>
          </div>
          <textarea
            rows={2}
            required
            value={qPrompt}
            onChange={(e) => setQPrompt(e.target.value)}
            placeholder="Nội dung câu hỏi…"
            className="w-full rounded-xl glass-subsurface px-3 py-2 text-sm text-slate-900 dark:text-white"
          />
          <div className="grid grid-cols-2 gap-2">
            <input type="text" required value={qOptA} onChange={(e) => setQOptA(e.target.value)} placeholder="Đáp án A" className="rounded-xl glass-subsurface px-3 py-1.5 text-slate-900 dark:text-white" />
            <input type="text" required value={qOptB} onChange={(e) => setQOptB(e.target.value)} placeholder="Đáp án B" className="rounded-xl glass-subsurface px-3 py-1.5 text-slate-900 dark:text-white" />
            <input type="text" value={qOptC} onChange={(e) => setQOptC(e.target.value)} placeholder="Đáp án C" className="rounded-xl glass-subsurface px-3 py-1.5 text-slate-900 dark:text-white" />
            <input type="text" value={qOptD} onChange={(e) => setQOptD(e.target.value)} placeholder="Đáp án D" className="rounded-xl glass-subsurface px-3 py-1.5 text-slate-900 dark:text-white" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select
              value={qCorrectIdx}
              onChange={(e) => setQCorrectIdx(Number(e.target.value))}
              className="rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white"
            >
              <option value={0}>Đúng: A</option>
              <option value={1}>Đúng: B</option>
              <option value={2}>Đúng: C</option>
              <option value={3}>Đúng: D</option>
            </select>
            <input
              type="text"
              value={qExplain}
              onChange={(e) => setQExplain(e.target.value)}
              placeholder="Giải thích (tùy chọn)"
              className="col-span-2 rounded-xl glass-subsurface px-3 py-2 text-slate-900 dark:text-white"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setQuizModalOpen(false)} className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer">
              Đóng
            </button>
            <button type="submit" className="px-4 py-2 rounded-xl bg-sky-600 text-white font-semibold cursor-pointer">
              Lưu câu hỏi
            </button>
          </div>
        </form>
      </Modal>
    </SubjectWorkspaceShell>
  );
};
