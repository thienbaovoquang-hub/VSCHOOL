export type SubjectId =
  | 'english'
  | 'math'
  | 'physics'
  | 'chemistry'
  | 'literature'
  | 'history'
  | 'geography';

export interface SubjectSubTabSpec {
  id: string;
  label: string;
}

export interface SubjectDefinition {
  id: SubjectId;
  title: string;
  appTitle: string;
  shortTagline: string;
  description: string;
  accentHex: string;
  iconName:
    | 'Languages'
    | 'Calculator'
    | 'Atom'
    | 'FlaskConical'
    | 'Feather'
    | 'Landmark'
    | 'Compass';
  iconBgClass: string;
  softBgClass: string;
  textAccentClass: string;
  /** Keywords used to unify VSCHOOL Timetable, Assignments, AcademicRecords, LearningMaterials */
  matchAliases: string[];
  capabilities: string[];
  subTabs: SubjectSubTabSpec[];
  status: 'active';
}

export const SUBJECT_CATALOG: SubjectDefinition[] = [
  {
    id: 'english',
    title: 'Tiếng Anh',
    appTitle: 'Tiếng Anh',
    shortTagline: 'Từ vựng · Ngữ pháp · Từ điển · Đề thi',
    description: 'Flashcards phát âm, ngữ pháp, tra từ điển và bài tập.',
    accentHex: '#0284C7',
    iconName: 'Languages',
    iconBgClass: 'bg-sky-600',
    softBgClass: 'bg-sky-500/12',
    textAccentClass: 'text-sky-700 dark:text-sky-300',
    matchAliases: ['tieng anh', 'tiếng anh', 'anh', 'anh van', 'anh văn', 'english', 'ngoai ngu', 'ngoại ngữ'],
    capabilities: [
      'Flashcards & phát âm',
      'Ngữ pháp & ghép câu',
      'Từ điển Datamuse + Wiktionary',
      'Luyện tập & lớp học',
    ],
    subTabs: [
      { id: 'vocab', label: 'Từ vựng' },
      { id: 'grammar', label: 'Ngữ pháp' },
      { id: 'dict', label: 'Từ điển' },
      { id: 'practice', label: 'Luyện tập' },
    ],
    status: 'active',
  },
  {
    id: 'math',
    title: 'Toán',
    appTitle: 'Toán học',
    shortTagline: 'Công thức · Đồ thị · Hình 2D · Luyện tập',
    description: 'Sổ tay công thức, vẽ đồ thị f(x), tam giác 2D và bài tập.',
    accentHex: '#7C3AED',
    iconName: 'Calculator',
    iconBgClass: 'bg-violet-600',
    softBgClass: 'bg-violet-500/12',
    textAccentClass: 'text-violet-700 dark:text-violet-300',
    matchAliases: ['toan', 'toán', 'toan hoc', 'toán học', 'math', 'dai so', 'giai tich', 'hinh hoc'],
    capabilities: [
      'Sổ tay công thức',
      'Đồ thị hàm số y = f(x)',
      'Hình học tam giác 2D',
      'Luyện tập & lớp học',
    ],
    subTabs: [
      { id: 'theory', label: 'Công thức' },
      { id: 'graph', label: 'Đồ thị & 2D' },
      { id: 'practice', label: 'Luyện tập' },
    ],
    status: 'active',
  },
  {
    id: 'physics',
    title: 'Vật Lý',
    appTitle: 'Vật Lý',
    shortTagline: 'Công thức · Mô phỏng SI · Hồi quy · NASA',
    description: 'Mô phỏng ném xiên, con lắc, va chạm 1D, hồi quy và NASA.',
    accentHex: '#DB2777',
    iconName: 'Atom',
    iconBgClass: 'bg-pink-600',
    softBgClass: 'bg-pink-500/12',
    textAccentClass: 'text-pink-700 dark:text-pink-300',
    matchAliases: ['vat ly', 'vật lý', 'vat li', 'vật lí', 'ly', 'physics'],
    capabilities: [
      'Công thức & hằng số SI',
      'Mô phỏng chuyển động SI',
      'Đo đạc & hồi quy tuyến tính',
      'Dữ liệu thiên văn NASA',
    ],
    subTabs: [
      { id: 'theory', label: 'Công thức' },
      { id: 'lab', label: 'Mô phỏng' },
      { id: 'regression', label: 'Hồi quy' },
      { id: 'nasa', label: 'NASA' },
      { id: 'practice', label: 'Luyện tập' },
    ],
    status: 'active',
  },
  {
    id: 'chemistry',
    title: 'Hóa Học',
    appTitle: 'Hóa Học',
    shortTagline: 'Tuần hoàn 118 · Mol · Chuẩn độ pH · PubChem',
    description: 'Bảng tuần hoàn 118, tính mol, đường cong chuẩn độ và PubChem.',
    accentHex: '#059669',
    iconName: 'FlaskConical',
    iconBgClass: 'bg-emerald-600',
    softBgClass: 'bg-emerald-500/12',
    textAccentClass: 'text-emerald-700 dark:text-emerald-300',
    matchAliases: ['hoa hoc', 'hóa học', 'hoa', 'hóa', 'chemistry'],
    capabilities: [
      'Bảng tuần hoàn 118 nguyên tố',
      'Tính khối lượng mol M',
      'Thí nghiệm chuẩn độ pH',
      'Tra cứu PubChem',
    ],
    subTabs: [
      { id: 'periodic', label: 'Tuần hoàn' },
      { id: 'calculator', label: 'Mol & PTHH' },
      { id: 'titration', label: 'Chuẩn độ pH' },
      { id: 'pubchem', label: 'PubChem' },
      { id: 'practice', label: 'Luyện tập' },
    ],
    status: 'active',
  },
  {
    id: 'literature',
    title: 'Ngữ Văn',
    appTitle: 'Ngữ Văn',
    shortTagline: 'Tác phẩm · Tu từ · Luyện viết · Đọc hiểu',
    description: 'Đọc tác phẩm, nhập Word/PDF, luyện viết và chấm Rubric AI.',
    accentHex: '#9F1239',
    iconName: 'Feather',
    iconBgClass: 'bg-rose-700',
    softBgClass: 'bg-rose-500/12',
    textAccentClass: 'text-rose-700 dark:text-rose-300',
    matchAliases: ['ngu van', 'ngữ văn', 'van', 'văn', 'van hoc', 'văn học', 'literature'],
    capabilities: [
      'Tác phẩm & bút ký cá nhân',
      'Tu từ & đọc hiểu',
      'Soạn bài & AI chấm Rubric',
      'Nhập Word / PDF / TXT',
    ],
    subTabs: [
      { id: 'works', label: 'Tác phẩm' },
      { id: 'knowledge', label: 'Tu từ' },
      { id: 'writing', label: 'Luyện viết' },
      { id: 'practice', label: 'Luyện tập' },
    ],
    status: 'active',
  },
  {
    id: 'history',
    title: 'Lịch Sử',
    appTitle: 'Lịch Sử',
    shortTagline: 'Bài học · Dòng thời gian · Atlat · Tư liệu',
    description: 'Kho bài học, dòng thời gian, bản đồ niên đại và bảo tàng tư liệu.',
    accentHex: '#B45309',
    iconName: 'Landmark',
    iconBgClass: 'bg-amber-700',
    softBgClass: 'bg-amber-500/12',
    textAccentClass: 'text-amber-700 dark:text-amber-300',
    matchAliases: ['lich su', 'lịch sử', 'su', 'sử', 'history'],
    capabilities: [
      'Bài học & ghi chú sử học',
      'Dòng thời gian sự kiện',
      'Atlat & tư liệu lịch sử',
      'Luyện tập 5 dạng câu hỏi',
    ],
    subTabs: [
      { id: 'lessons', label: 'Bài học' },
      { id: 'timeline', label: 'Dòng thời gian' },
      { id: 'atlas', label: 'Atlat' },
      { id: 'archive', label: 'Tư liệu' },
      { id: 'practice', label: 'Luyện tập' },
    ],
    status: 'active',
  },
  {
    id: 'geography',
    title: 'Địa Lý',
    appTitle: 'Địa Lý',
    shortTagline: 'Kiến thức · Atlat số · Biểu đồ · World Bank',
    description: 'Kiến thức, Atlat 8 lớp, vẽ biểu đồ, chỉ số và World Bank.',
    accentHex: '#0E7490',
    iconName: 'Compass',
    iconBgClass: 'bg-cyan-700',
    softBgClass: 'bg-cyan-500/12',
    textAccentClass: 'text-cyan-700 dark:text-cyan-300',
    matchAliases: ['dia ly', 'địa lý', 'dia li', 'địa lí', 'dia', 'địa', 'geography'],
    capabilities: [
      'Kiến thức theo phân mảng',
      'Atlat & tọa độ OpenStreetMap',
      'Biểu đồ số liệu & chỉ số',
      'Tra cứu Quốc gia & World Bank',
    ],
    subTabs: [
      { id: 'knowledge', label: 'Kiến thức' },
      { id: 'atlas', label: 'Atlat số' },
      { id: 'charts', label: 'Biểu đồ' },
      { id: 'world', label: 'Thế giới' },
      { id: 'practice', label: 'Luyện tập' },
    ],
    status: 'active',
  },
];

export const GAUTH_URL = 'https://www.gauth.com/';

export interface GauthTabSpec {
  id: 'gauth';
  label: 'Gauth';
  url: string;
  subjectId: SubjectId;
  subjectName: string;
}

export function getActiveSubjects(): SubjectDefinition[] {
  return SUBJECT_CATALOG.filter((subject) => subject.status === 'active');
}

export function getSubjectById(subjectId: string): SubjectDefinition | undefined {
  return SUBJECT_CATALOG.find((subject) => subject.id === subjectId);
}

export function getGauthTabSpec(
  subject: Pick<SubjectDefinition, 'id' | 'title'>
): GauthTabSpec {
  return {
    id: 'gauth',
    label: 'Gauth',
    url: GAUTH_URL,
    subjectId: subject.id,
    subjectName: subject.title,
  };
}

export function resolveSubjectThemeMode(darkMode: boolean): 'dark' | 'light' {
  return darkMode ? 'dark' : 'light';
}
