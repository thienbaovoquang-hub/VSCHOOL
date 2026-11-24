export type SubjectId = 'english' | 'math' | 'physics' | 'chemistry' | 'literature' | 'history' | 'geography';

export interface SubjectDefinition {
  id: SubjectId;
  title: string;
  appTitle: string;
  description: string;
  htmlPath: string;
  accentHex: string;
  iconName: 'Languages' | 'Calculator' | 'Atom' | 'FlaskConical' | 'Feather' | 'Landmark' | 'Compass';
  iconGradient: string;
  capabilities: string[];
  status: 'active';
}

export const SUBJECT_CATALOG: SubjectDefinition[] = [
  {
    id: 'english',
    title: 'Tiếng Anh',
    appTitle: 'Lingo – Học tiếng Anh',
    description:
      'Không gian học tiếng Anh tương tác gồm từ vựng, ngữ pháp, flashcard lật thẻ, luyện tập trắc nghiệm, làm bài thi và bảng xếp hạng.',
    htmlPath: '/assets/aistudio/anh_40c06e4c.html',
    accentHex: '#0284C7',
    iconName: 'Languages',
    iconGradient: 'from-sky-500 to-teal-500',
    capabilities: [
      'Từ vựng theo chủ đề & cấp độ',
      'Ngữ pháp & ví dụ tự sinh bài tập',
      'Flashcards ghi nhớ chủ động',
      'Luyện tập & Đề thi Reading / Listening',
      'Trợ lý AI sửa câu, giải thích & tạo câu hỏi',
    ],
    status: 'active',
  },
  {
    id: 'math',
    title: 'Toán',
    appTitle: 'MathBuddy – Học Toán',
    description:
      'Không gian học Toán tương tác gồm lý thuyết, công thức LaTeX, luyện tập trắc nghiệm & tự luận, vẽ đồ thị hàm số, hình học 2D/3D và bài kiểm tra.',
    htmlPath: '/assets/aistudio/MathBuddy___H_c_To_n_4da2fcc3.html',
    accentHex: '#8B7BFF',
    iconName: 'Calculator',
    iconGradient: 'from-violet-500 to-pink-500',
    capabilities: [
      'Lý thuyết & Sổ tay công thức LaTeX',
      'Bài tập trắc nghiệm, điền đáp số & tự luận',
      'Vẽ đồ thị hàm số & Hình học 2D / 3D',
      'Đề kiểm tra bấm giờ & Bảng xếp hạng',
      'Trợ lý AI giải Toán từng bước & đọc ảnh đề',
    ],
    status: 'active',
  },
  {
    id: 'physics',
    title: 'Vật Lý',
    appTitle: 'Vật Lý Cute',
    description:
      'Không gian học Vật Lý tương tác gồm lý thuyết, sổ tay công thức & hằng số LaTeX, bài tập, mô phỏng chuyển động – dao động – va chạm, đồ thị hồi quy và trợ lý giải bài.',
    htmlPath: '/assets/aistudio/V_t_L__Cute_54063342.html',
    accentHex: '#FF6FAE',
    iconName: 'Atom',
    iconGradient: 'from-pink-500 to-indigo-500',
    capabilities: [
      'Lý thuyết & Sổ tay công thức – hằng số LaTeX',
      'Mô phỏng: Ném xiên, Con lắc lò xo, Va chạm 1D',
      'Vẽ đồ thị hàm số & Hồi quy tuyến tính dữ liệu đo',
      'Trợ lý AI giải bài chuẩn SI & đọc ảnh đề',
      'Nhập dữ liệu Excel & Bảng xếp hạng tích lũy',
    ],
    status: 'active',
  },
  {
    id: 'chemistry',
    title: 'Hóa Học',
    appTitle: 'ChemiLab – Học Hóa vui',
    description:
      'Không gian học Hóa học tương tác gồm lý thuyết, bảng tuần hoàn 118 nguyên tố, cân bằng phương trình, phân tử 3D, thí nghiệm pha trộn – chuẩn độ và kiểm tra.',
    htmlPath: '/assets/aistudio/ChemiLab___H_c_H_a_vui_d8d22fe2.html',
    accentHex: '#10B981',
    iconName: 'FlaskConical',
    iconGradient: 'from-emerald-500 to-teal-500',
    capabilities: [
      'Lý thuyết & Sổ tay công thức Hóa học',
      'Bảng tuần hoàn 118 nguyên tố tương tác',
      'Cân bằng phương trình & Tính khối lượng mol',
      'Mô hình phân tử 3D & Thí nghiệm chuẩn độ',
      'Trợ lý AI giải Hóa, cân bằng & đọc ảnh đề',
    ],
    status: 'active',
  },
  {
    id: 'literature',
    title: 'Ngữ Văn',
    appTitle: 'Văn Hiến',
    description:
      'Thư phòng Ngữ văn Văn Hiến gồm đọc hiểu tác phẩm & đánh dấu bút ký, kho kiến thức chuyên đề, luyện tập bấm giờ, góc luyện viết dàn ý – dẫn chứng và trợ lý AI.',
    htmlPath: '/assets/aistudio/3gemini-code-1795352432020_cdd2c619.html',
    accentHex: '#782A32',
    iconName: 'Feather',
    iconGradient: 'from-rose-700 to-amber-700',
    capabilities: [
      'Thư viện tác phẩm & Đọc văn bản – đánh dấu bút ký',
      'Kho kiến thức Ngữ văn (thể loại, tu từ, lý luận)',
      'Luyện tập bấm giờ (Trắc nghiệm, Đúng/Sai, Tự luận)',
      'Luyện viết: Lập dàn ý, chèn dẫn chứng & xuất .txt',
      'Nhập Excel mẫu & Trợ lý AI đọc PDF / Word / ảnh đề',
    ],
    status: 'active',
  },
  {
    id: 'history',
    title: 'Lịch Sử',
    appTitle: 'Sử Ký – Kho lưu trữ Lịch sử',
    description:
      'Không gian học Lịch sử phong cách bảo tàng & kho lưu trữ cổ gồm kho bài học, dòng thời gian liên kết sự kiện, thư viện tư liệu, luyện tập đa dạng, nhập Excel và trợ lý AI.',
    htmlPath: '/assets/aistudio/SuKy_LichSu.html',
    accentHex: '#8A6237',
    iconName: 'Landmark',
    iconGradient: 'from-amber-800 to-rose-900',
    capabilities: [
      'Kho kiến thức Lịch sử & đánh dấu, ghi chú bút ký',
      'Dòng thời gian trực quan & liên kết nhân quả sự kiện',
      'Thư viện tư liệu (ảnh, văn kiện, hiện vật) kèm xuất xứ',
      'Luyện tập đa dạng (Trắc nghiệm, Nối mốc, Sắp xếp, Đọc hiểu)',
      'Nhập Excel/PDF/Word/Ảnh & Trợ lý AI Lịch sử',
    ],
    status: 'active',
  },
  {
    id: 'geography',
    title: 'Địa Lý',
    appTitle: 'Địa Lý – Atlat & Khám phá',
    description:
      'Không gian học Địa lý hiện đại gồm kho kiến thức phân mảng, Atlat tương tác đa lớp tọa độ, bảng số liệu & biểu đồ tự động, luyện tập – kiểm tra và Trợ lý AI Địa lý.',
    htmlPath: '/assets/aistudio/DiaLy_Atlat.html',
    accentHex: '#0B4F6C',
    iconName: 'Compass',
    iconGradient: 'from-cyan-700 to-emerald-700',
    capabilities: [
      'Kho kiến thức Địa lý tự nhiên, dân cư, kinh tế – xã hội',
      'Atlat tương tác đa lớp (phóng to, di chuyển, tọa độ, GeoJSON)',
      'Bảng số liệu & Biểu đồ (cột, đường, tròn, kết hợp) tự động',
      'Tính cơ cấu, mật độ dân số, tốc độ tăng trưởng & bình quân',
      'Nhập Excel/PDF/Word/Ảnh & Trợ lý AI Địa lý',
    ],
    status: 'active',
  },
];

export function getActiveSubjects(): SubjectDefinition[] {
  return SUBJECT_CATALOG.filter((subject) => subject.status === 'active');
}

export function getSubjectById(subjectId: string): SubjectDefinition | undefined {
  return SUBJECT_CATALOG.find((subject) => subject.id === subjectId);
}

export function resolveSubjectThemeMode(darkMode: boolean): 'dark' | 'light' {
  return darkMode ? 'dark' : 'light';
}

const MATHBUDDY_THEME_OVERRIDE_CSS = `
:root[data-theme="light"] {
  color-scheme: light;
  --b1: #ffe3f1;
  --b2: #e3ecff;
  --b3: #e2fff0;
  --c: rgba(255, 255, 255, .65);
  --t: #3b3558;
  --m: #7a7499;
  --bd: rgba(255, 255, 255, .9);
  --in: rgba(255, 255, 255, .85);
  --g: rgba(120, 110, 170, .18);
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --b1: #2b2040;
  --b2: #1b2542;
  --b3: #1a3336;
  --c: rgba(44, 40, 78, .62);
  --t: #f0ecff;
  --m: #b0a9d6;
  --bd: rgba(255, 255, 255, .12);
  --in: rgba(30, 28, 56, .8);
  --g: rgba(200, 190, 255, .15);
}
`;

const CHEMILAB_THEME_OVERRIDE_CSS = `
:root[data-theme="light"] {
  color-scheme: light;
  --b1: #ffe3f1;
  --b2: #dbe9ff;
  --cd: rgba(255, 255, 255, .62);
  --tx: #3b3558;
  --mu: #7a7498;
  --bd: rgba(255, 255, 255, .85);
}
:root[data-theme="dark"] {
  color-scheme: dark;
  --b1: #2a1f45;
  --b2: #12263f;
  --cd: rgba(50, 44, 86, .6);
  --tx: #eeeaff;
  --mu: #aaa4cc;
  --bd: rgba(255, 255, 255, .14);
}
`;

const VANHIEN_THEME_OVERRIDE_CSS = `
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #171412;
  --paper: #231E1B;
  --card: #1E1A17;
  --ink: #F3ECE2;
  --muted: #B6A999;
  --moss: #4B745B;
  --moss-bg: rgba(75, 116, 91, 0.22);
  --wine: #B94854;
  --wine-bg: rgba(185, 72, 84, 0.2);
  --line: #3A322C;
}
:root[data-theme="dark"] header {
  background: rgba(23, 20, 18, 0.92);
}
:root[data-theme="dark"] .page-sheet,
:root[data-theme="dark"] .editor-area {
  background: #201B18;
}
:root[data-theme="dark"] .opt.ok {
  background: rgba(44, 106, 69, 0.28);
  border-color: #4B9A6B;
}
`;

const SUKY_THEME_OVERRIDE_CSS = `
:root[data-theme="dark"] {
  color-scheme: dark;
  --bg: #171310;
  --paper: #231D18;
  --card: #1E1915;
  --ink: #F2EBE0;
  --muted: #B6A795;
  --wine: #C25963;
  --wine-bg: rgba(194, 89, 99, 0.18);
  --moss: #4E7A60;
  --moss-bg: rgba(78, 122, 96, 0.2);
  --bronze: #C99D62;
  --line: #3C322A;
}
`;

export function syncSubjectIframeTheme(
  iframe: HTMLIFrameElement | null,
  darkMode: boolean
): boolean {
  if (!iframe) return false;
  try {
    const doc = iframe.contentDocument;
    const docEl = doc?.documentElement;
    if (!doc || !docEl) return false;

    const mode = resolveSubjectThemeMode(darkMode);
    docEl.setAttribute('data-theme', mode);
    docEl.style.colorScheme = mode;

    if (doc.head) {
      const css = doc.title.includes('MathBuddy')
        ? MATHBUDDY_THEME_OVERRIDE_CSS
        : doc.title.includes('ChemiLab')
          ? CHEMILAB_THEME_OVERRIDE_CSS
          : doc.title.includes('Văn Hiến')
            ? VANHIEN_THEME_OVERRIDE_CSS
            : doc.title.includes('Sử Ký')
              ? SUKY_THEME_OVERRIDE_CSS
              : null;
      if (css) {
        let styleEl = doc.getElementById('schoolhub-theme-sync') as HTMLStyleElement | null;
        if (!styleEl) {
          styleEl = doc.createElement('style');
          styleEl.id = 'schoolhub-theme-sync';
          styleEl.textContent = css;
          doc.head.appendChild(styleEl);
        }
      }
    }
    return true;
  } catch {
    return false;
  }
}
