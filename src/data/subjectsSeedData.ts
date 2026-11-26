import type {
  AtlasFeature,
  GeoDataset,
  GeoLesson,
  GeoQuestion,
} from '../utils/geographyRules.ts';

/* ============================================================================
   1. TIẾNG ANH (LINGO)
   ============================================================================ */

export interface EnglishVocabItem {
  id: string;
  word: string;
  phonetic: string;
  partOfSpeech: string;
  level: 'A1' | 'A2' | 'B1' | 'B2' | 'C1';
  topic: string;
  meaning: string;
  example: string;
}

export interface EnglishGrammarPoint {
  id: string;
  title: string;
  unit: string;
  level: 'A2' | 'B1' | 'B2';
  structure: string;
  usage: string;
  example: string;
  quickQuiz: {
    question: string;
    options: string[];
    correctIndex: number;
    explain: string;
  };
}

export interface EnglishQuizItem {
  id: string;
  skill: 'Vocabulary' | 'Grammar' | 'Reading';
  level: 'A2' | 'B1' | 'B2';
  passage?: string;
  question: string;
  options: string[];
  correctIndex: number;
  explain: string;
}

export const ENGLISH_VOCAB_SEED: EnglishVocabItem[] = [
  {
    id: 'en-v1',
    word: 'curriculum',
    phonetic: '/kəˈrɪkjələm/',
    partOfSpeech: 'noun',
    level: 'B1',
    topic: 'School',
    meaning: 'chương trình giảng dạy',
    example: 'The new curriculum encourages hands-on science projects.',
  },
  {
    id: 'en-v2',
    word: 'sustainable',
    phonetic: '/səˈsteɪnəbl/',
    partOfSpeech: 'adjective',
    level: 'B2',
    topic: 'Environment',
    meaning: 'bền vững, thân thiện lâu dài',
    example: 'Solar panels provide sustainable electricity for rural schools.',
  },
  {
    id: 'en-v3',
    word: 'collaborate',
    phonetic: '/kəˈlæbəreɪt/',
    partOfSpeech: 'verb',
    level: 'B1',
    topic: 'School',
    meaning: 'hợp tác, cộng tác',
    example: 'Students collaborate in groups to solve physics experiments.',
  },
  {
    id: 'en-v4',
    word: 'breakthrough',
    phonetic: '/ˈbreɪkθruː/',
    partOfSpeech: 'noun',
    level: 'B2',
    topic: 'Technology',
    meaning: 'bước đột phá',
    example: 'Battery storage was a major breakthrough for electric vehicles.',
  },
  {
    id: 'en-v5',
    word: 'punctual',
    phonetic: '/ˈpʌŋktʃuəl/',
    partOfSpeech: 'adjective',
    level: 'A2',
    topic: 'Daily Life',
    meaning: 'đúng giờ',
    example: 'Being punctual shows respect for teachers and classmates.',
  },
  {
    id: 'en-v6',
    word: 'biodiversity',
    phonetic: '/ˌbaɪəʊdaɪˈvɜːsəti/',
    partOfSpeech: 'noun',
    level: 'B2',
    topic: 'Environment',
    meaning: 'đa dạng sinh học',
    example: 'National parks help protect tropical biodiversity.',
  },
  {
    id: 'en-v7',
    word: 'persevere',
    phonetic: '/ˌpɜːsɪˈvɪə(r)/',
    partOfSpeech: 'verb',
    level: 'C1',
    topic: 'Academic',
    meaning: 'kiên trì theo đuổi đến cùng',
    example: 'Even when problems feel tough, persevere step by step.',
  },
  {
    id: 'en-v8',
    word: 'itinerary',
    phonetic: '/aɪˈtɪnərəri/',
    partOfSpeech: 'noun',
    level: 'B1',
    topic: 'Travel',
    meaning: 'lịch trình chuyến đi',
    example: 'Our field trip itinerary includes a museum visit in the morning.',
  },
];

export const ENGLISH_GRAMMAR_SEED: EnglishGrammarPoint[] = [
  {
    id: 'en-g1',
    title: 'Present Perfect vs. Past Simple',
    unit: 'Tenses',
    level: 'B1',
    structure: 'S + have/has + V3/ed  vs.  S + V2/ed (+ mốc quá khứ xác định)',
    usage:
      'Hiện tại hoàn thành nhấn mạnh kinh nghiệm hoặc kết quả còn liên hệ hiện tại; Quá khứ đơn đi với thời điểm đã kết thúc (yesterday, in 2022).',
    example: 'She has joined three science fairs, and she won first prize last year.',
    quickQuiz: {
      question: 'We ___ our chemistry lab report two days ago.',
      options: ['have submitted', 'submitted', 'submit', 'were submit'],
      correctIndex: 1,
      explain: '"two days ago" là mốc thời gian quá khứ xác định nên dùng Past Simple (submitted).',
    },
  },
  {
    id: 'en-g2',
    title: 'Conditional Sentences (Type 1 & Type 2)',
    unit: 'Conditionals',
    level: 'B1',
    structure: 'Loại 1: If + S + V(hiện tại), S + will + V | Loại 2: If + S + V2/were, S + would + V',
    usage:
      'Loại 1 diễn tả điều kiện có thật ở hiện tại/tương lai; Loại 2 giả định trái với hiện tại.',
    example: 'If students review flashcards daily, they will remember vocabulary faster.',
    quickQuiz: {
      question: 'If I ___ closer to school, I would ride my bike every morning.',
      options: ['live', 'lived', 'will live', 'have lived'],
      correctIndex: 1,
      explain: 'Mệnh đề chính dùng "would ride" -> Câu điều kiện loại 2, dùng quá khứ giả định (lived).',
    },
  },
  {
    id: 'en-g3',
    title: 'Relative Clauses (Defining & Non-defining)',
    unit: 'Relative Clauses',
    level: 'B2',
    structure: 'N + who / which / that / whose / where + clause',
    usage:
      'Không dùng "that" sau dấu phẩy trong mệnh đề quan hệ không xác định.',
    example: 'Hanoi, which is the capital of Vietnam, has a thousand-year history.',
    quickQuiz: {
      question: 'The scientist ___ discovered radium won two Nobel Prizes.',
      options: ['which', 'who', 'whom', 'whose'],
      correctIndex: 1,
      explain: 'Thay thế cho danh từ chỉ người làm chủ ngữ ("discovered") nên dùng "who".',
    },
  },
  {
    id: 'en-g4',
    title: 'Passive Voice (Câu bị động)',
    unit: 'Passive Voice',
    level: 'A2',
    structure: 'S + be (chia theo thì) + V3/ed (+ by O)',
    usage:
      'Nhấn mạnh đối tượng chịu tác động của hành động thay vì chủ thể thực hiện.',
    example: 'The annual science exhibition is held in the school hall every spring.',
    quickQuiz: {
      question: 'Thousands of trees ___ across the city next month.',
      options: ['will plant', 'will be planted', 'are planting', 'were planted'],
      correctIndex: 1,
      explain: 'Chủ ngữ chỉ vật ("trees") kết hợp mốc tương lai ("next month") -> Bị động tương lai đơn.',
    },
  },
];

export const ENGLISH_QUIZ_SEED: EnglishQuizItem[] = [
  {
    id: 'en-q1',
    skill: 'Grammar',
    level: 'B1',
    question: 'Hardly ___ the classroom when the bell rang.',
    options: ['had I entered', 'I had entered', 'did I entered', 'have I entered'],
    correctIndex: 0,
    explain: 'Cấu trúc đảo ngữ với "Hardly + had + S + V3 + when + S + V2".',
  },
  {
    id: 'en-q2',
    skill: 'Vocabulary',
    level: 'B1',
    question: 'Students need to ___ their time wisely during final exams.',
    options: ['allocate', 'hesitate', 'evaporate', 'imitate'],
    correctIndex: 0,
    explain: '"allocate" nghĩa là phân bổ (thời gian, nguồn lực) hợp lý.',
  },
  {
    id: 'en-q3',
    skill: 'Reading',
    level: 'B2',
    passage:
      'Active recall is a study technique in which learners stimulate their memory by testing themselves rather than passively rereading notes. Research shows that spaced repetition combined with active recall significantly improves long-term retention.',
    question: 'According to the passage, what makes active recall effective?',
    options: [
      'Highlighting every sentence in a textbook',
      'Testing memory actively instead of passive rereading',
      'Studying only right before an exam',
      'Listening to music while copying notes',
    ],
    correctIndex: 1,
    explain: 'Đoạn văn nêu rõ người học tự kiểm tra trí nhớ thay vì đọc lướt thụ động.',
  },
  {
    id: 'en-q4',
    skill: 'Grammar',
    level: 'A2',
    question: 'She is interested ___ learning how renewable energy works.',
    options: ['on', 'at', 'in', 'with'],
    correctIndex: 2,
    explain: 'Cụm tính từ cố định "to be interested in + V-ing / Noun".',
  },
];

/* ============================================================================
   2. TOÁN HỌC (MATHBUDDY)
   ============================================================================ */

export interface MathFormulaCard {
  id: string;
  grade: 'Lớp 10' | 'Lớp 11' | 'Lớp 12';
  topic: 'Đại số' | 'Giải tích' | 'Hình học' | 'Lượng giác' | 'Xác suất';
  title: string;
  expression: string;
  note: string;
}

export interface MathQuestionItem {
  id: string;
  qtype: 'mcq' | 'num' | 'essay';
  grade: 'Lớp 10' | 'Lớp 11' | 'Lớp 12';
  topic: string;
  question: string;
  options?: string[];
  correctIndex?: number;
  numericAnswer?: string;
  solution: string;
}

export const MATH_FORMULAS_SEED: MathFormulaCard[] = [
  {
    id: 'm-f1',
    grade: 'Lớp 10',
    topic: 'Đại số',
    title: 'Đỉnh & Trục đối xứng Parabol y = ax² + bx + c (a ≠ 0)',
    expression: 'x_I = -b / (2a)  ;  y_I = -Δ / (4a)  với Δ = b² - 4ac',
    note: 'Nếu a > 0 parabol bề lõm quay lên (đạt GTNN tại đỉnh); nếu a < 0 bề lõm quay xuống.',
  },
  {
    id: 'm-f2',
    grade: 'Lớp 10',
    topic: 'Hình học',
    title: 'Định lý Côsin & Công thức Heron trong tam giác ABC',
    expression: 'a² = b² + c² - 2bc·cos(A)   |   S = √[p(p-a)(p-b)(p-c)], p = (a+b+c)/2',
    note: 'Áp dụng tính cạnh còn lại hoặc diện tích khi biết độ dài 3 cạnh.',
  },
  {
    id: 'm-f3',
    grade: 'Lớp 11',
    topic: 'Lượng giác',
    title: 'Công thức cộng & Nhân đôi lượng giác',
    expression: 'sin(2α) = 2sinα·cosα  |  cos(2α) = cos²α - sin²α = 2cos²α - 1',
    note: 'Hệ thức cơ bản: sin²α + cos²α = 1 với mọi góc α.',
  },
  {
    id: 'm-f4',
    grade: 'Lớp 11',
    topic: 'Xác suất',
    title: 'Chỉnh hợp, Tổ hợp & Xác suất cổ điển',
    expression: 'C(n, k) = n! / [k!(n-k)!]   |   P(A) = n(A) / n(Ω)',
    note: 'Tổ hợp không phân biệt thứ tự, Chỉnh hợp A(n, k) có phân biệt thứ tự.',
  },
  {
    id: 'm-f5',
    grade: 'Lớp 12',
    topic: 'Giải tích',
    title: 'Đạo hàm sơ cấp & Cực trị hàm số',
    expression: "(xⁿ)' = n·xⁿ⁻¹  |  (sin x)' = cos x  |  (eˣ)' = eˣ  |  (ln x)' = 1/x",
    note: 'Điểm x₀ là cực trị nếu f\'(x) đổi dấu khi qua x₀.',
  },
  {
    id: 'm-f6',
    grade: 'Lớp 12',
    topic: 'Giải tích',
    title: 'Nguyên hàm – Tích phân Newton–Leibniz',
    expression: '∫ₐᵇ f(x)dx = F(b) - F(a)  với F\'(x) = f(x)',
    note: 'Diện tích hình phẳng giới hạn bởi y=f(x), y=g(x) trên [a; b] là ∫|f(x)-g(x)|dx.',
  },
];

export const MATH_QUESTIONS_SEED: MathQuestionItem[] = [
  {
    id: 'm-q1',
    qtype: 'mcq',
    grade: 'Lớp 10',
    topic: 'Đại số',
    question: 'Tọa độ đỉnh của parabol (P): y = x² - 4x + 5 là:',
    options: ['I(2; 1)', 'I(-2; 17)', 'I(2; 5)', 'I(4; 5)'],
    correctIndex: 0,
    solution: 'Hoành độ đỉnh x_I = -(-4)/(2·1) = 2. Thay x = 2 => y_I = 4 - 8 + 5 = 1.',
  },
  {
    id: 'm-q2',
    qtype: 'num',
    grade: 'Lớp 10',
    topic: 'Hình học',
    question: 'Tam giác có độ dài 3 cạnh là 3, 4, 5. Hãy tính diện tích tam giác đó (chỉ nhập số):',
    numericAnswer: '6',
    solution: 'Đây là tam giác vuông tại góc đối diện cạnh 5 (3² + 4² = 5²), nên S = (3 × 4)/2 = 6.',
  },
  {
    id: 'm-q3',
    qtype: 'mcq',
    grade: 'Lớp 12',
    topic: 'Giải tích',
    question: 'Đạo hàm của hàm số f(x) = x³ - 3x² + 2 tại điểm x = 1 bằng:',
    options: ['-3', '0', '3', '1'],
    correctIndex: 0,
    solution: "f'(x) = 3x² - 6x => f'(1) = 3(1) - 6(1) = -3.",
  },
  {
    id: 'm-q4',
    qtype: 'essay',
    grade: 'Lớp 11',
    topic: 'Lượng giác',
    question: 'Trình bày các bước giải phương trình sin(2x) = √3 / 2 trên đoạn [0; π].',
    solution:
      'sin(2x) = sin(π/3) <=> 2x = π/3 + k2π hoặc 2x = 2π/3 + k2π <=> x = π/6 + kπ hoặc x = π/3 + kπ. Với x ∈ [0; π], nhận x = π/6 và x = π/3.',
  },
];

/* ============================================================================
   3. VẬT LÝ (PHYSICS LAB)
   ============================================================================ */

export interface PhysicsConstantCard {
  id: string;
  symbol: string;
  name: string;
  value: string;
  unit: string;
  formulaNote: string;
}

export interface PhysicsTheoryCard {
  id: string;
  grade: 'Lớp 10' | 'Lớp 11' | 'Lớp 12';
  topic: string;
  title: string;
  formula: string;
  summary: string;
}

export interface PhysicsQuestionItem {
  id: string;
  grade: 'Lớp 10' | 'Lớp 11' | 'Lớp 12';
  topic: string;
  question: string;
  options: string[];
  correctIndex: number;
  explain: string;
}

export const PHYSICS_CONSTANTS_SEED: PhysicsConstantCard[] = [
  { id: 'pc-1', symbol: 'g', name: 'Gia tốc trọng trường chuẩn', value: '9.81', unit: 'm/s²', formulaNote: 'P = m·g' },
  { id: 'pc-2', symbol: 'c', name: 'Tốc độ ánh sáng trong chân không', value: '2.998 × 10⁸', unit: 'm/s', formulaNote: 'λ = c / f' },
  { id: 'pc-3', symbol: 'G', name: 'Hằng số hấp dẫn', value: '6.674 × 10⁻¹¹', unit: 'N·m²/kg²', formulaNote: 'F = G·m₁m₂/r²' },
  { id: 'pc-4', symbol: 'h', name: 'Hằng số Planck', value: '6.626 × 10⁻³⁴', unit: 'J·s', formulaNote: 'ε = h·f' },
  { id: 'pc-5', symbol: 'e', name: 'Điện tích nguyên tố', value: '1.602 × 10⁻¹⁹', unit: 'C', formulaNote: 'q = n·e' },
  { id: 'pc-6', symbol: 'R', name: 'Hằng số khí lý tưởng', value: '8.314', unit: 'J/(mol·K)', formulaNote: 'pV = nRT' },
];

export const PHYSICS_THEORY_SEED: PhysicsTheoryCard[] = [
  {
    id: 'pt-1',
    grade: 'Lớp 10',
    topic: 'Cơ học',
    title: 'Chuyển động ném xiên (không ma sát)',
    formula: 'x = (v₀cosα)·t   |   y = h₀ + (v₀sinα)·t - ½gt²',
    summary: 'Theo phương ngang vật chuyển động thẳng đều; theo phương thẳng đứng vật chịu gia tốc g hướng xuống.',
  },
  {
    id: 'pt-2',
    grade: 'Lớp 11',
    topic: 'Dao động & Sóng',
    title: 'Con lắc lò xo dao động điều hòa',
    formula: 'ω = √(k/m)   |   T = 2π√(m/k)   |   W = ½kA²',
    summary: 'Cơ năng bảo toàn khi bỏ qua ma sát; động năng cực đại tại vị trí cân bằng, thế năng cực đại ở hai biên.',
  },
  {
    id: 'pt-3',
    grade: 'Lớp 10',
    topic: 'Động lượng',
    title: 'Định luật bảo toàn động lượng trong va chạm 1D',
    formula: 'm₁v₁ + m₂v₂ = m₁v₁\' + m₂v₂\'',
    summary: 'Trong hệ cô lập, tổng động lượng luôn bảo toàn; riêng va chạm đàn hồi (e=1) bảo toàn cả động năng.',
  },
];

export const PHYSICS_QUESTIONS_SEED: PhysicsQuestionItem[] = [
  {
    id: 'pq-1',
    grade: 'Lớp 10',
    topic: 'Cơ học',
    question: 'Khi ném một vật từ mặt đất với góc ném α (bỏ qua sức cản không khí), tầm xa đạt cực đại ở góc ném nào?',
    options: ['30°', '45°', '60°', '75°'],
    correctIndex: 1,
    explain: 'Tầm xa L = (v₀²·sin2α)/g đạt cực đại khi sin2α = 1 => 2α = 90° => α = 45°.',
  },
  {
    id: 'pq-2',
    grade: 'Lớp 11',
    topic: 'Dao động điều hòa',
    question: 'Con lắc lò xo gồm vật m = 0.25 kg gắn vào lò xo k = 100 N/m. Tần số góc ω bằng:',
    options: ['10 rad/s', '20 rad/s', '40 rad/s', '25 rad/s'],
    correctIndex: 1,
    explain: 'ω = √(k/m) = √(100 / 0.25) = √400 = 20 rad/s.',
  },
  {
    id: 'pq-3',
    grade: 'Lớp 10',
    topic: 'Động lượng',
    question: 'Đại lượng nào sau đây KHÔNG bảo toàn trong va chạm mềm (hai vật dính vào nhau sau va chạm)?',
    options: ['Động lượng toàn phần', 'Tổng khối lượng', 'Tổng động năng', 'Phương chuyển động'],
    correctIndex: 2,
    explain: 'Va chạm mềm (e = 0) vẫn bảo toàn động lượng nhưng một phần động năng chuyển hóa thành nhiệt và biến dạng.',
  },
];

/* ============================================================================
   4. HÓA HỌC (CHEMILAB)
   ============================================================================ */

export interface ChemicalReactionEntry {
  id: string;
  category: 'Vô cơ' | 'Oxi hóa - Khử' | 'Axit - Bazơ' | 'Hữu cơ';
  equation: string;
  condition: string;
  phenomenon: string;
}

export interface ChemistryQuestionItem {
  id: string;
  topic: string;
  grade: 'Lớp 10' | 'Lớp 11' | 'Lớp 12';
  question: string;
  options: string[];
  correctIndex: number;
  explain: string;
}

export const CHEMICAL_REACTIONS_SEED: ChemicalReactionEntry[] = [
  {
    id: 'cr-1',
    category: 'Axit - Bazơ',
    equation: 'HCl + NaOH → NaCl + H₂O',
    condition: 'Nhiệt độ thường',
    phenomenon: 'Phản ứng trung hòa tỏa nhiệt; điểm tương đương có pH = 7 (làm quỳ tím giữ nguyên màu).',
  },
  {
    id: 'cr-2',
    category: 'Oxi hóa - Khử',
    equation: 'Cu + 4HNO₃ (đặc) → Cu(NO₃)₂ + 2NO₂↑ + 2H₂O',
    condition: 'Nhiệt độ thường / đun nhẹ',
    phenomenon: 'Đồng tan dần, dung dịch chuyển màu xanh lam và thoát khí NO₂ màu nâu đỏ.',
  },
  {
    id: 'cr-3',
    category: 'Vô cơ',
    equation: 'Fe + CuSO₄ → FeSO₄ + Cu↓',
    condition: 'Dung dịch',
    phenomenon: 'Kim loại đồng màu đỏ bám ngoài đinh sắt, màu xanh dung dịch CuSO₄ nhạt dần.',
  },
  {
    id: 'cr-4',
    category: 'Hữu cơ',
    equation: 'CH₃COOH + C₂H₅OH ⇌ CH₃COOC₂H₅ + H₂O',
    condition: 'H₂SO₄ đặc, đun nóng',
    phenomenon: 'Phản ứng este hóa tạo etyl axetat có mùi thơm hoa quả đặc trưng, ít tan trong nước.',
  },
];

export const CHEMISTRY_QUESTIONS_SEED: ChemistryQuestionItem[] = [
  {
    id: 'cq-1',
    grade: 'Lớp 10',
    topic: 'Bảng tuần hoàn',
    question: 'Nguyên tố có độ âm điện lớn nhất trong Bảng tuần hoàn là:',
    options: ['Oxi (O)', 'Clo (Cl)', 'Flo (F)', 'Nitơ (N)'],
    correctIndex: 2,
    explain: 'Flo (Z = 9) có độ âm điện lớn nhất (3.98 theo thang Pauling), chỉ thể hiện số oxi hóa -1 trong hợp chất.',
  },
  {
    id: 'cq-2',
    grade: 'Lớp 11',
    topic: 'Dung dịch & pH',
    question: 'Trộn 20 mL dung dịch HCl 0.1M với 20 mL dung dịch NaOH 0.1M thu được dung dịch có pH bằng:',
    options: ['1.0', '7.0', '13.0', '5.5'],
    correctIndex: 1,
    explain: 'n(H⁺) = n(OH⁻) = 0.002 mol => Trung hòa hoàn toàn, pH = 7.0.',
  },
  {
    id: 'cq-3',
    grade: 'Lớp 10',
    topic: 'Mol & Nồng độ',
    question: 'Khối lượng mol phân tử của axit sunfuric (H₂SO₄) là:',
    options: ['64 g/mol', '82 g/mol', '98 g/mol', '100 g/mol'],
    correctIndex: 2,
    explain: 'M(H₂SO₄) = 2×1 + 32 + 4×16 = 98 g/mol.',
  },
];

/* ============================================================================
   5. NGỮ VĂN (VĂN HIẾN)
   ============================================================================ */

export interface LiteratureWorkItem {
  id: string;
  title: string;
  author: string;
  period: 'Văn học dân gian' | 'Văn học trung đại' | 'Văn học hiện đại';
  genre: string;
  grade: 'Lớp 10' | 'Lớp 11' | 'Lớp 12';
  summary: string;
  keyValues: string;
  excerpt: string[];
}

export interface LiteratureKnowledgeCard {
  id: string;
  category: 'Biện pháp tu từ' | 'Đọc hiểu' | 'Nghị luận văn học' | 'Nghị luận xã hội';
  title: string;
  summary: string;
  example: string;
}

export interface LiteratureWritingPrompt {
  id: string;
  genre: 'Nghị luận văn học' | 'Nghị luận xã hội';
  title: string;
  outline: string[];
  evidencePool: string[];
}

export interface LiteratureQuestionItem {
  id: string;
  qtype: 'mcq' | 'tf' | 'essay';
  topic: string;
  prompt: string;
  options?: string[];
  correctIndex?: number;
  correctBool?: boolean;
  explain: string;
}

export const LITERATURE_WORKS_SEED: LiteratureWorkItem[] = [
  {
    id: 'lit-w1',
    title: 'Bình Ngô đại cáo (trích phần mở đầu)',
    author: 'Nguyễn Trãi',
    period: 'Văn học trung đại',
    genre: 'Cáo (Nghị luận chính luận)',
    grade: 'Lớp 10',
    summary:
      'Bản tuyên ngôn độc lập hào hùng khẳng định tư tưởng nhân nghĩa gắn liền với chủ quyền lãnh thổ, văn hiến và hào kiệt nước Đại Việt.',
    keyValues: 'Tư tưởng nhân nghĩa là "yên dân" và "trừ bạo"; ý thức độc lập dân tộc sánh ngang các triều đại phương Bắc.',
    excerpt: [
      'Việc nhân nghĩa cốt ở yên dân,',
      'Quân điếu phạt trước lo trừ bạo.',
      'Như nước Đại Việt ta từ trước,',
      'Vốn xưng nền văn hiến đã lâu.',
      'Núi sông bờ cõi đã chia,',
      'Phong tục Bắc Nam cũng khác.',
      'Từ Triệu, Đinh, Lý, Trần bao đời gây nền độc lập,',
      'Cùng Hán, Đường, Tống, Nguyên mỗi bên xưng đế một phương.',
    ],
  },
  {
    id: 'lit-w2',
    title: 'Vội vàng (trích)',
    author: 'Xuân Diệu',
    period: 'Văn học hiện đại',
    genre: 'Thơ mới',
    grade: 'Lớp 11',
    summary:
      'Niềm khát khao sống mãnh liệt, say đắm trước vẻ đẹp trần thế và cảm thức chạy đua với thời gian một đi không trở lại.',
    keyValues: 'Cái tôi cá nhân bùng nổ cùng nhịp điệu dồn dập, hình ảnh tươi mới giàu giác quan.',
    excerpt: [
      'Tôi muốn tắt nắng đi',
      'Cho màu đừng nhạt mất;',
      'Tôi muốn buộc gió lại',
      'Cho hương đừng bay đi.',
      'Của ong bướm này đây tuần tháng mật;',
      'Này đây hoa của đồng nội xanh rì;',
      'Này đây lá của cành tơ phơ phất;',
      'Của yến anh này đây khúc tình si.',
    ],
  },
  {
    id: 'lit-w3',
    title: 'Tây Tiến (trích khổ 1)',
    author: 'Quang Dũng',
    period: 'Văn học hiện đại',
    genre: 'Thơ kháng chiến',
    grade: 'Lớp 12',
    summary:
      'Nỗi nhớ da diết về thiên nhiên Tây Bắc hùng vĩ, khắc nghiệt mà thơ mộng cùng hình ảnh đoàn quân Tây Tiến lãng mạn, bi tráng.',
    keyValues: 'Sự kết hợp hài hòa giữa bút pháp hiện thực gân guốc và cảm hứng lãng mạn hào hoa.',
    excerpt: [
      'Sông Mã xa rồi Tây Tiến ơi!',
      'Nhớ về rừng núi nhớ chơi vơi',
      'Sài Khao sương lấp đoàn quân mỏi',
      'Mường Lát hoa về trong đêm hơi',
      'Dốc lên khúc khuỷu dốc thăm thẳm',
      'Heo hút cồn mây súng ngửi trời',
      'Ngàn thước lên cao, ngàn thước xuống',
      'Nhà ai Pha Luông mưa xa khơi.',
    ],
  },
];

export const LITERATURE_KNOWLEDGE_SEED: LiteratureKnowledgeCard[] = [
  {
    id: 'lit-k1',
    category: 'Biện pháp tu từ',
    title: 'Ẩn dụ & Hoán dụ',
    summary:
      'Ẩn dụ dựa trên quan hệ tương đồng (giống nhau về nét nghĩa); Hoán dụ dựa trên quan hệ tương cận (gần gũi, đi liền nhau).',
    example: '"Thuyền về có nhớ bến chăng" (ẩn dụ người đi - người ở); "Áo chàm đưa buổi phân ly" (hoán dụ đồng bào Việt Bắc).',
  },
  {
    id: 'lit-k2',
    category: 'Đọc hiểu',
    title: '6 Phương thức biểu đạt',
    summary:
      'Gồm: Tự sự (kể diễn biến), Miêu tả (tái hiện đặc điểm), Biểu cảm (bộc lộ tình cảm), Thuyết minh (tri thức khách quan), Nghị luận (bàn luận quan điểm), Hành chính - công vụ.',
    example: 'Trong "Bình Ngô đại cáo", phương thức biểu đạt chính là Nghị luận kết hợp Biểu cảm.',
  },
  {
    id: 'lit-k3',
    category: 'Nghị luận xã hội',
    title: 'Công thức đoạn văn 200 chữ (4 bước)',
    summary:
      'Mở đoạn (nêu vấn đề) -> Giải thích & Phân tích ý nghĩa -> Dẫn chứng thực tế ngắn gọn -> Phản đề & Bài học nhận thức hành động.',
    example: 'Dẫn chứng nên cụ thể, giàu tính thời sự (như tấm gương học sinh sáng tạo khoa học kỹ thuật, thiện nguyện).',
  },
];

export const LITERATURE_WRITING_PROMPTS: LiteratureWritingPrompt[] = [
  {
    id: 'lit-wp1',
    genre: 'Nghị luận văn học',
    title: 'Cảm nhận vẻ đẹp hùng vĩ của thiên nhiên Tây Bắc trong đoạn trích "Tây Tiến" (Quang Dũng)',
    outline: [
      '1. Mở bài: Giới thiệu tác giả Quang Dũng, hoàn cảnh sáng tác bài thơ Tây Tiến (1948) và vấn đề đoạn trích.',
      '2. Thân bài - Luận điểm 1: Nỗi nhớ chơi vơi mở đầu bằng tiếng gọi Sông Mã và những địa danh miền Tây.',
      '3. Thân bài - Luận điểm 2: Địa hình hiểm trở qua thanh trắc ("khúc khuỷu", "thăm thẳm") và nhân hóa "súng ngửi trời".',
      '4. Thân bài - Luận điểm 3: Vẻ đẹp thơ mộng bình yên nơi "Nhà ai Pha Luông mưa xa khơi".',
      '5. Kết bài: Khái quát nghệ thuật lãng mạn pha chất hiện thực và tình yêu đồng đội sâu sắc.',
    ],
    evidencePool: [
      'Điệp từ "nhớ" kết hợp từ láy "chơi vơi" gợi nỗi nhớ lan tỏa mênh mang.',
      'Câu thơ toàn thanh bằng "Nhà ai Pha Luông mưa xa khơi" làm dịu lại sự căng thẳng của 3 câu toàn thanh trắc trước đó.',
      'Hình ảnh "súng ngửi trời" vừa miêu tả độ cao ngất trời vừa thể hiện nét hóm hỉnh trẻ trung của người lính.',
    ],
  },
  {
    id: 'lit-wp2',
    genre: 'Nghị luận xã hội',
    title: 'Viết bài luận ngắn bàn về sức mạnh của sự kiên trì và tinh thần tự học trong kỷ nguyên số',
    outline: [
      '1. Mở bài: Dẫn dắt bối cảnh tri thức thay đổi nhanh và đặt vấn đề vai trò của tự học, kiên trì.',
      '2. Thân bài - Giải thích: Tự học là chủ động tìm tòi, kiên trì là bền bỉ vượt qua thất bại ban đầu.',
      '3. Thân bài - Phân tích & Dẫn chứng: Giúp biến công cụ số thành đòn bẩy tri thức thay vì lệ thuộc.',
      '4. Thân bài - Phản đề & Mở rộng: Phê phán tâm lý nóng vội, sao chép thụ động thiếu tư duy.',
      '5. Kết bài: Rút ra kế hoạch rèn luyện thói quen học tập chủ động mỗi ngày.',
    ],
    evidencePool: [
      'Thomas Edison trải qua hàng nghìn lần thử nghiệm dây tóc bóng đèn trước khi thắp sáng thế giới.',
      'Chủ tịch Hồ Chí Minh tự học ngoại ngữ mỗi ngày bằng cách ghi lên tay áo khi lao động trên tàu viễn dương.',
    ],
  },
];

export const LITERATURE_QUESTIONS_SEED: LiteratureQuestionItem[] = [
  {
    id: 'lq-1',
    qtype: 'mcq',
    topic: 'Văn học trung đại',
    prompt: 'Trong "Bình Ngô đại cáo", tư tưởng "Nhân nghĩa" của Nguyễn Trãi được xác định cốt lõi ở điều gì?',
    options: [
      'Xưng đế ngang hàng phương Bắc',
      'Yên dân và trừ bạo',
      'Kế thừa triều đại Lý – Trần',
      'Mở rộng giao thương',
    ],
    correctIndex: 1,
    explain: 'Hai câu đầu khẳng định rõ: "Việc nhân nghĩa cốt ở yên dân / Quân điếu phạt trước lo trừ bạo".',
  },
  {
    id: 'lq-2',
    qtype: 'tf',
    topic: 'Biện pháp tu từ',
    prompt: 'Nhận định: Câu thơ "Này đây hoa của đồng nội xanh rì; Này đây lá của cành tơ phơ phất" sử dụng phép điệp cấu trúc để tăng nhịp điệu hân hoan. Đúng hay Sai?',
    correctBool: true,
    explain: 'Đúng. Điệp ngữ "Này đây..." tạo nhịp liệt kê dồn dập, bày ra trước mắt một bữa tiệc trần thế rực rỡ.',
  },
  {
    id: 'lq-3',
    qtype: 'essay',
    topic: 'Đọc hiểu',
    prompt: 'Phân tích ngắn gọn tác dụng của hình ảnh "súng ngửi trời" trong bài thơ Tây Tiến (3–5 câu).',
    explain: 'Gợi ý: Kết hợp nhân hóa táo bạo và chất tinh nghịch trẻ trung của lính trẻ Hà Thành giữa đỉnh dốc núi cao chạm mây.',
  },
];

/* ============================================================================
   6. ĐỊA LÝ (ATLAT & KHÁM PHÁ)
   ============================================================================ */

export const GEOGRAPHY_LESSONS_SEED: GeoLesson[] = [
  {
    id: 'geo-l1',
    title: 'Đặc điểm chung của Địa hình Việt Nam & Hướng núi chính',
    grade: 'Lớp 12',
    chapter: 'Địa lý tự nhiên Việt Nam',
    topic: 'Địa hình',
    domain: 'Tự nhiên',
    summary:
      'Đồi núi chiếm 3/4 diện tích lãnh thổ nhưng chủ yếu là đồi núi thấp dưới 1000m; địa hình có hai hướng chính là Tây Bắc – Đông Nam và vòng cung.',
    keyPoints:
      '• Đồng bằng chỉ chiếm 1/4 diện tích (châu thổ sông Hồng & sông Cửu Long).\n• Địa hình thấp dần từ Tây Bắc xuống Đông Nam.\n• Vùng núi Đông Bắc nổi bật với 4 cánh cung mở rộng về phía Bắc và Đông.',
    examples: 'Dãy Hoàng Liên Sơn (đỉnh Phanxipăng 3.143m) chạy theo hướng Tây Bắc – Đông Nam.',
    dataNotes: 'Đồi núi < 1000m chiếm ~85% diện tích vùng đồi núi.',
    source: 'SGK Địa Lý 12',
    yearRef: '2024',
    media: [],
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  {
    id: 'geo-l2',
    title: 'Tính chất nhiệt đới ẩm gió mùa của Khí hậu Việt Nam',
    grade: 'Lớp 12',
    chapter: 'Địa lý tự nhiên Việt Nam',
    topic: 'Khí hậu',
    domain: 'Tự nhiên',
    summary:
      'Nằm trong vùng nội chí tuyến Bắc bán cầu, lượng bức xạ lớn, tổng lượng mưa trung bình 1500–2000mm/năm và chịu tác động hai mùa gió rõ rệt.',
    keyPoints:
      '• Nhiệt độ trung bình năm trên 20°C (trừ vùng núi cao).\n• Gió mùa Đông Bắc (mùa đông lạnh ở miền Bắc) và Gió mùa Tây Nam (mưa mùa hạ).\n• Độ ẩm không khí thường xuyên trên 80%.',
    examples: 'Miền Bắc có mùa đông lạnh 2–3 tháng; miền Nam phân hóa hai mùa mưa – khô rõ rệt.',
    dataNotes: 'Nhiệt độ trung bình năm Hà Nội ~23.5°C, TP.HCM ~27.1°C.',
    source: 'SGK Địa Lý 12',
    yearRef: '2024',
    media: [],
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  {
    id: 'geo-l3',
    title: 'Đô thị hóa & Cơ cấu dân số theo khu vực kinh tế',
    grade: 'Lớp 12',
    chapter: 'Địa lý dân cư',
    topic: 'Dân cư & Đô thị hóa',
    domain: 'Dân cư',
    summary:
      'Việt Nam có quy mô dân số trên 100 triệu người; tỉ lệ dân thành thị tăng đều, cơ cấu lao động dịch chuyển từ nông-lâm-ngư sang công nghiệp và dịch vụ.',
    keyPoints:
      '• Mật độ dân số trung bình năm 2023 khoảng 303 người/km².\n• Đồng bằng sông Hồng có mật độ dân số cao nhất cả nước (>1.000 người/km²).\n• Quá trình đô thị hóa gắn với các hành lang kinh tế công nghiệp – dịch vụ.',
    examples: 'Hà Nội, TP.HCM, Đà Nẵng, Hải Phòng, Cần Thơ là các đô thị trung tâm cấp quốc gia.',
    dataNotes: 'Tỉ lệ dân thành thị tăng từ 30.5% (2010) lên 38.1% (2023).',
    source: 'Niên giám Thống kê Việt Nam',
    yearRef: '2023',
    media: [],
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  {
    id: 'geo-l4',
    title: 'Chuyển dịch cơ cấu kinh tế & Kinh tế biển bền vững',
    grade: 'Lớp 12',
    chapter: 'Địa lý kinh tế',
    topic: 'Kinh tế',
    domain: 'Kinh tế',
    summary:
      'Tỉ trọng Nông-Lâm-Ngư nghiệp giảm dần trong GDP, nhường chỗ cho Công nghiệp–Xây dựng và Dịch vụ công nghệ cao.',
    keyPoints:
      '• Vùng kinh tế trọng điểm phía Nam và Bắc đóng góp trên 65% GDP cả nước.\n• Kinh tế biển gồm cảng biển nước sâu, du lịch biển đảo và năng lượng tái tạo ngoài khơi.',
    examples: 'Cụm cảng Cái Mép – Thị Vải, cảng Lạch Huyện là cửa ngõ xuất nhập khẩu lớn.',
    dataNotes: 'Khu vực Dịch vụ chiếm ~42.5% GDP năm 2023.',
    source: 'Tổng cục Thống kê',
    yearRef: '2023',
    media: [],
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
];

export const GEOGRAPHY_ATLAS_SEED: AtlasFeature[] = [
  {
    id: 'ga-hn',
    name: 'Hà Nội',
    scope: 'vietnam',
    layer: 'administrative',
    kind: 'point',
    lat: 21.0285,
    lon: 105.8542,
    region: 'Đồng bằng sông Hồng',
    country: 'Việt Nam',
    summary: 'Thủ đô nước CHXHCN Việt Nam, trung tâm chính trị – văn hóa – giáo dục lớn bên sông Hồng.',
    metricsText: 'Dân số ~8.5 triệu · Mật độ ~2.530 người/km²',
    source: 'Atlat Địa lý Việt Nam',
    yearRef: '2024',
  },
  {
    id: 'ga-hcm',
    name: 'TP. Hồ Chí Minh',
    scope: 'vietnam',
    layer: 'economy',
    kind: 'point',
    lat: 10.7769,
    lon: 106.7009,
    region: 'Đông Nam Bộ',
    country: 'Việt Nam',
    summary: 'Đầu tàu kinh tế, tài chính, dịch vụ và cảng biển lớn nhất khu vực phía Nam.',
    metricsText: 'Đóng góp ~15–16% GDP cả nước · Dân số ~9.4 triệu',
    source: 'Atlat Địa lý Việt Nam',
    yearRef: '2024',
  },
  {
    id: 'ga-dn',
    name: 'Đà Nẵng',
    scope: 'vietnam',
    layer: 'transport',
    kind: 'point',
    lat: 16.0544,
    lon: 108.2022,
    region: 'Duyên hải Nam Trung Bộ',
    country: 'Việt Nam',
    summary: 'Cửa ngõ hành lang kinh tế Đông – Tây ra Biển Đông, trung tâm du lịch và công nghệ miền Trung.',
    metricsText: 'Cảng Liên Chiểu – Tiên Sa · Sân bay Quốc tế Đà Nẵng',
    source: 'Atlat Địa lý Việt Nam',
    yearRef: '2024',
  },
  {
    id: 'ga-pxp',
    name: 'Đỉnh Phanxipăng',
    scope: 'vietnam',
    layer: 'topography',
    kind: 'point',
    lat: 22.3033,
    lon: 103.775,
    region: 'Tây Bắc (Dãy Hoàng Liên Sơn)',
    country: 'Việt Nam',
    summary: 'Đỉnh núi cao nhất Việt Nam và ba nước Đông Dương, đặc trưng khí hậu ôn đới núi cao.',
    metricsText: 'Độ cao: 3.143 m · Địa hình núi cao chia cắt mạnh',
    source: 'Atlat Địa lý Việt Nam',
    yearRef: '2024',
  },
  {
    id: 'ga-mekong',
    name: 'Châu thổ Sông Cửu Long (Cần Thơ)',
    scope: 'vietnam',
    layer: 'hydrology',
    kind: 'point',
    lat: 10.0452,
    lon: 105.7469,
    region: 'Đồng bằng sông Cửu Long',
    country: 'Việt Nam',
    summary: 'Vùng trọng điểm sản xuất lương thực và thủy sản số 1 cả nước nhờ phù sa sông Tiền, sông Hậu.',
    metricsText: 'Sản lượng lúa > 50% cả nước · Hệ thống sông rạch chằng chịt',
    source: 'Atlat Địa lý Việt Nam',
    yearRef: '2024',
  },
  {
    id: 'ga-taynguyen',
    name: 'Cao nguyên Đắk Lắk',
    scope: 'vietnam',
    layer: 'resources',
    kind: 'point',
    lat: 12.6667,
    lon: 108.05,
    region: 'Tây Nguyên',
    country: 'Việt Nam',
    summary: 'Vùng đất đỏ bazan màu mỡ bậc nhất thích hợp cây công nghiệp lâu năm (cà phê, hồ tiêu, cao su).',
    metricsText: 'Trữ lượng bôxit lớn · Tiềm năng thủy điện sông Sêrêpôk',
    source: 'Atlat Địa lý Việt Nam',
    yearRef: '2024',
  },
  {
    id: 'ga-hsa',
    name: 'Quần đảo Hoàng Sa & Trường Sa',
    scope: 'vietnam',
    layer: 'administrative',
    kind: 'point',
    lat: 16.5,
    lon: 112.0,
    region: 'Biển Đông',
    country: 'Việt Nam',
    summary: 'Hai quần đảo tiền tiêu có vị trí chiến lược đặc biệt về chủ quyền, hàng hải và ngư trường Biển Đông.',
    metricsText: 'TP. Đà Nẵng (Hoàng Sa) & Tỉnh Khánh Hòa (Trường Sa)',
    source: 'Atlat Địa lý Việt Nam',
    yearRef: '2024',
  },
];

export const GEOGRAPHY_DATASETS_SEED: GeoDataset[] = [
  {
    id: 'gd-1',
    title: 'Cơ cấu GDP Việt Nam theo khu vực kinh tế (%)',
    category: 'Kinh tế',
    unit: '%',
    chartType: 'bar',
    columns: ['2015', '2019', '2021', '2023'],
    rows: [
      { label: 'Nông – Lâm – Thủy sản', values: [14.5, 13.9, 12.6, 11.9] },
      { label: 'Công nghiệp – Xây dựng', values: [34.3, 34.5, 37.5, 37.1] },
      { label: 'Dịch vụ (gồm thuế SP)', values: [51.2, 51.6, 49.9, 51.0] },
    ],
    analysis: 'Tỉ trọng Nông–Lâm–Thủy sản giảm đều, Công nghiệp–Xây dựng và Dịch vụ giữ vai trò trụ cột tăng trưởng.',
    source: 'Tổng cục Thống kê',
    yearRange: '2015–2023',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
  {
    id: 'gd-2',
    title: 'Lượng mưa trung bình các tháng mùa mưa (mm)',
    category: 'Khí hậu',
    unit: 'mm',
    chartType: 'line',
    columns: ['Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10'],
    rows: [
      { label: 'Hà Nội', values: [188, 240, 288, 318, 265, 130] },
      { label: 'TP. Hồ Chí Minh', values: [218, 312, 294, 270, 327, 267] },
    ],
    analysis: 'Hà Nội đạt đỉnh mưa tháng 8 do gió mùa và dải hội tụ nhiệt đới; TP.HCM mưa kéo dài đến tháng 10.',
    source: 'Trung tâm Dự báo KTTV Quốc gia',
    yearRange: 'Trung bình nhiều năm',
    createdAt: '2025-01-01',
    updatedAt: '2025-01-01',
  },
];

export const GEOGRAPHY_QUESTIONS_SEED: GeoQuestion[] = [
  {
    id: 'gq-1',
    type: 'mcq',
    grade: 'Lớp 12',
    chapter: 'Địa lý tự nhiên',
    topic: 'Địa hình',
    prompt: 'Dãy núi nào cao nhất nước ta với đỉnh Phanxipăng cao 3.143 m?',
    options: ['Dãy Trường Sơn Bắc', 'Dãy Hoàng Liên Sơn', 'Dãy Bạch Mã', 'Cánh cung Đông Triều'],
    correctIndex: 1,
    methodGuide: 'Xem Atlat trang Địa hình tự nhiên vùng Tây Bắc.',
    explanation: 'Dãy Hoàng Liên Sơn chạy theo hướng Tây Bắc – Đông Nam là nóc nhà Đông Dương.',
  },
  {
    id: 'gq-2',
    type: 'tf',
    grade: 'Lớp 12',
    chapter: 'Địa lý dân cư',
    topic: 'Mật độ dân số',
    prompt: 'Nhận định: Đồng bằng sông Hồng là vùng có mật độ dân số cao nhất cả nước.',
    correctBool: true,
    methodGuide: 'So sánh dân số chia diện tích giữa các vùng kinh tế.',
    explanation: 'Đúng. Đồng bằng sông Hồng có mật độ trên 1.000 người/km², cao gấp hơn 3 lần mức trung bình cả nước.',
  },
  {
    id: 'gq-3',
    type: 'short',
    grade: 'Lớp 12',
    chapter: 'Kỹ năng bảng số liệu',
    topic: 'Biểu đồ & Số liệu',
    prompt: 'Để thể hiện sự chuyển dịch CƠ CẤU GDP theo ngành qua nhiều năm (tổng luôn bằng 100%), loại biểu đồ nào thích hợp nhất?',
    correctAnswerText: 'Biểu đồ miền',
    acceptedKeywords: ['miền', 'mien', 'cột chồng', 'cot chong'],
    methodGuide: 'Phân biệt biểu đồ tròn (1–3 năm) với biểu đồ miền (chuỗi nhiều năm, đơn vị %).',
    explanation: 'Biểu đồ miền là lựa chọn chuẩn xác nhất để thể hiện cơ cấu thay đổi qua chuỗi thời gian >= 4 năm.',
  },
];
