import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import {
  normalizeHistoryExcelRow,
  type HistoryExcelModule,
} from './historyRules.ts';
import {
  normalizeGeoDataMatrixRows,
  normalizeGeoExcelRow,
  type GeoExcelModule,
} from './geographyRules.ts';

export type SubjectExcelSubjectId =
  | 'english'
  | 'math'
  | 'physics'
  | 'chemistry'
  | 'literature'
  | 'history'
  | 'geography';

export interface SubjectExcelColumnSpec {
  key: string;
  header: string;
  width?: number;
  required?: boolean;
  dropdownKey?: string;
}

export interface SubjectExcelTabSpec {
  tabName: string;
  label: string;
  inferredDefaults: Record<string, string>;
  omittedKeys: string[];
  sampleRow?: Record<string, string>;
}

export interface SubjectExcelModuleSpec {
  subjectId: SubjectExcelSubjectId;
  moduleKey: string;
  fileName: string;
  title: string;
  headerColorHex: string;
  columns: SubjectExcelColumnSpec[];
  staticLists: Record<string, { header: string; values: string[] }>;
  tabs: SubjectExcelTabSpec[];
  usePresetClassesTabs?: boolean;
  presetClassColumnKey?: string;
  guideNotes: Array<{ Cot: string; MoTa: string; ViDu: string }>;
}

const DEFAULT_GRADE_OPTIONS = ['Lớp 10', 'Lớp 11', 'Lớp 12'];
const DEFAULT_MCQ_OPTIONS = ['A', 'B', 'C', 'D'];
const DEFAULT_Q_ANSWERS = ['A', 'B', 'C', 'D', 'Đúng', 'Sai'];
const DEFAULT_DIFFICULTY = ['Cơ bản', 'Thông hiểu', 'Vận dụng', 'Nâng cao'];

export function sanitizeSubjectSheetName(raw: string): string {
  const cleaned = String(raw || 'DuLieu')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[\\/?*[\]:]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return (cleaned || 'DuLieu').slice(0, 31);
}

function getModuleCatalogSpec(
  subjectId: SubjectExcelSubjectId,
  moduleKey: string,
  presetClasses: string[]
): SubjectExcelModuleSpec {
  const mod = moduleKey.trim().toLowerCase();

  if (subjectId === 'english') {
    if (mod === 'quiz' || mod === 'practice' || mod === 'exam') {
      return {
        subjectId,
        moduleKey: 'quiz',
        fileName: 'Mau_CauHoi_TiengAnh.xlsx',
        title: 'Câu hỏi Tiếng Anh (Lingo)',
        headerColorHex: 'FF0284C7',
        columns: [
          { key: 'question', header: 'Câu hỏi *', width: 42, required: true },
          { key: 'optionA', header: 'Phương án A *', width: 22, required: true },
          { key: 'optionB', header: 'Phương án B *', width: 22, required: true },
          { key: 'optionC', header: 'Phương án C *', width: 22, required: true },
          { key: 'optionD', header: 'Phương án D *', width: 22, required: true },
          { key: 'answer', header: 'Đáp án đúng *', width: 15, required: true, dropdownKey: 'answer' },
          { key: 'level', header: 'Cấp độ', width: 12, dropdownKey: 'level' },
          { key: 'skill', header: 'Kỹ năng', width: 16, dropdownKey: 'skill' },
          { key: 'topic', header: 'Chủ đề', width: 20, dropdownKey: 'topic' },
          { key: 'className', header: 'Lớp áp dụng', width: 16, dropdownKey: 'classes' },
          { key: 'explain', header: 'Giải thích', width: 32 },
        ],
        staticLists: {
          answer: { header: 'Đáp án', values: DEFAULT_MCQ_OPTIONS },
          level: { header: 'Cấp độ', values: ['A1', 'A2', 'B1', 'B2', 'C1'] },
          skill: { header: 'Kỹ năng', values: ['Vocabulary', 'Grammar', 'Reading', 'Listening'] },
          topic: { header: 'Chủ đề', values: ['Daily Life', 'School', 'Travel', 'Technology', 'Environment', 'Academic'] },
        },
        tabs: [
          {
            tabName: 'Level_A1_A2',
            label: 'Sơ cấp A1–A2',
            inferredDefaults: { level: 'A2' },
            omittedKeys: ['level'],
            sampleRow: {
              question: 'She ___ to school by bus every morning.',
              optionA: 'go',
              optionB: 'goes',
              optionC: 'going',
              optionD: 'went',
              answer: 'B',
              skill: 'Grammar',
              topic: 'School',
              className: presetClasses[0] || '',
              explain: 'Hiện tại đơn với chủ ngữ ngôi thứ 3 số ít thêm -es.',
            },
          },
          {
            tabName: 'Level_B1',
            label: 'Trung cấp B1',
            inferredDefaults: { level: 'B1' },
            omittedKeys: ['level'],
          },
          {
            tabName: 'Level_B2_Plus',
            label: 'Nâng cao B2+',
            inferredDefaults: { level: 'B2' },
            omittedKeys: ['level'],
          },
        ],
        guideNotes: [
          { Cot: 'Sheet Tab', MoTa: 'Chia sẵn theo Cấp độ (Level_A1_A2, Level_B1, Level_B2_Plus) nên không cần cột Cấp độ trên tab.', ViDu: 'Level_B1' },
          { Cot: 'Drop-down', MoTa: 'Cột Đáp án đúng, Kỹ năng, Chủ đề, Lớp áp dụng có sẵn danh sách chọn.', ViDu: 'B · Grammar · 10A1' },
        ],
      };
    }

    if (mod === 'grammar') {
      return {
        subjectId,
        moduleKey: 'grammar',
        fileName: 'Mau_NguPhap_TiengAnh.xlsx',
        title: 'Ngữ pháp Tiếng Anh (Lingo)',
        headerColorHex: 'FF0284C7',
        columns: [
          { key: 'title', header: 'Điểm ngữ pháp *', width: 28, required: true },
          { key: 'unit', header: 'Unit / Chuyên đề *', width: 22, required: true, dropdownKey: 'topic' },
          { key: 'level', header: 'Cấp độ', width: 12, dropdownKey: 'level' },
          { key: 'structure', header: 'Công thức / Cấu trúc *', width: 34, required: true },
          { key: 'usage', header: 'Cách dùng chính', width: 34 },
          { key: 'example', header: 'Ví dụ minh họa *', width: 38, required: true },
          { key: 'className', header: 'Lớp áp dụng', width: 16, dropdownKey: 'classes' },
        ],
        staticLists: {
          level: { header: 'Cấp độ', values: ['A1', 'A2', 'B1', 'B2', 'C1'] },
          topic: { header: 'Chuyên đề ngữ pháp', values: ['Tenses', 'Conditionals', 'Passive Voice', 'Relative Clauses', 'Reported Speech', 'Modals'] },
        },
        tabs: [
          {
            tabName: 'Grammar_A1_A2',
            label: 'Ngữ pháp A1–A2',
            inferredDefaults: { level: 'A2' },
            omittedKeys: ['level'],
            sampleRow: {
              title: 'Present Simple',
              unit: 'Tenses',
              structure: 'S + V(s/es) + O',
              usage: 'Diễn tả thói quen, sự thật hiển nhiên.',
              example: 'She goes to school every morning.',
              className: presetClasses[0] || '',
            },
          },
          { tabName: 'Grammar_B1', label: 'Ngữ pháp B1', inferredDefaults: { level: 'B1' }, omittedKeys: ['level'] },
          { tabName: 'Grammar_B2_Plus', label: 'Ngữ pháp B2+', inferredDefaults: { level: 'B2' }, omittedKeys: ['level'] },
        ],
        guideNotes: [
          { Cot: 'Sheet Tab', MoTa: 'Chia theo Cấp độ (Grammar_A1_A2, Grammar_B1, Grammar_B2_Plus); cột Cấp độ tự nhận.', ViDu: 'Grammar_B1' },
        ],
      };
    }

    if (mod === 'tests') {
      return {
        subjectId,
        moduleKey: 'tests',
        fileName: 'Mau_DeKiemTra_TiengAnh.xlsx',
        title: 'Đề kiểm tra Tiếng Anh (Lingo)',
        headerColorHex: 'FF0284C7',
        columns: [
          { key: 'testType', header: 'Loại bài kiểm tra', width: 18, dropdownKey: 'testType' },
          { key: 'question', header: 'Câu hỏi *', width: 42, required: true },
          { key: 'optionA', header: 'Phương án A *', width: 20, required: true },
          { key: 'optionB', header: 'Phương án B *', width: 20, required: true },
          { key: 'optionC', header: 'Phương án C *', width: 20, required: true },
          { key: 'optionD', header: 'Phương án D *', width: 20, required: true },
          { key: 'answer', header: 'Đáp án đúng *', width: 15, required: true, dropdownKey: 'answer' },
          { key: 'level', header: 'Cấp độ', width: 12, dropdownKey: 'level' },
          { key: 'skill', header: 'Kỹ năng', width: 16, dropdownKey: 'skill' },
          { key: 'className', header: 'Lớp áp dụng', width: 16, dropdownKey: 'classes' },
          { key: 'explain', header: 'Giải thích', width: 30 },
        ],
        staticLists: {
          testType: { header: 'Loại đề', values: ['15 phút', '1 tiết', 'Học kỳ'] },
          answer: { header: 'Đáp án', values: DEFAULT_MCQ_OPTIONS },
          level: { header: 'Cấp độ', values: ['A1', 'A2', 'B1', 'B2', 'C1'] },
          skill: { header: 'Kỹ năng', values: ['Vocabulary', 'Grammar', 'Reading', 'Listening'] },
        },
        tabs: [
          {
            tabName: 'KT_15Phut',
            label: 'Kiểm tra 15 phút',
            inferredDefaults: { testType: '15 phút' },
            omittedKeys: ['testType'],
            sampleRow: {
              question: 'If it ___ tomorrow, we will stay at home.',
              optionA: 'rain',
              optionB: 'rains',
              optionC: 'rained',
              optionD: 'will rain',
              answer: 'B',
              level: 'B1',
              skill: 'Grammar',
              className: presetClasses[0] || '',
              explain: 'Câu điều kiện loại 1 dùng hiện tại đơn ở mệnh đề if.',
            },
          },
          { tabName: 'KT_1Tiet', label: 'Kiểm tra 1 tiết', inferredDefaults: { testType: '1 tiết' }, omittedKeys: ['testType'] },
          { tabName: 'KT_HocKy', label: 'Kiểm tra Học kỳ', inferredDefaults: { testType: 'Học kỳ' }, omittedKeys: ['testType'] },
        ],
        guideNotes: [
          { Cot: 'Sheet Tab', MoTa: 'Chia theo loại đề kiểm tra (15 phút, 1 tiết, Học kỳ); không cần cột Loại bài kiểm tra.', ViDu: 'KT_15Phut' },
        ],
      };
    }

    return {
      subjectId,
      moduleKey: mod === 'cards' ? 'cards' : 'vocab',
      fileName: mod === 'cards' ? 'Mau_Flashcards_TiengAnh.xlsx' : 'Mau_TuVung_TiengAnh.xlsx',
      title: 'Từ vựng Tiếng Anh (Lingo)',
      headerColorHex: 'FF0284C7',
      columns: [
        { key: 'word', header: 'Từ vựng *', width: 22, required: true },
        { key: 'phonetic', header: 'Phiên âm', width: 18 },
        { key: 'partOfSpeech', header: 'Từ loại *', width: 14, required: true, dropdownKey: 'pos' },
        { key: 'meaning', header: 'Nghĩa tiếng Việt *', width: 28, required: true },
        { key: 'example', header: 'Ví dụ', width: 36 },
        { key: 'level', header: 'Cấp độ', width: 12, dropdownKey: 'level' },
        { key: 'topic', header: 'Chủ đề', width: 20, dropdownKey: 'topic' },
        { key: 'className', header: 'Lớp áp dụng', width: 16, dropdownKey: 'classes' },
      ],
      staticLists: {
        pos: { header: 'Từ loại', values: ['noun', 'verb', 'adjective', 'adverb', 'phrase'] },
        level: { header: 'Cấp độ', values: ['A1', 'A2', 'B1', 'B2', 'C1'] },
        topic: { header: 'Chủ đề', values: ['Daily Life', 'School', 'Travel', 'Technology', 'Environment', 'Academic'] },
      },
      tabs: [
        {
          tabName: 'Vocab_A1_A2',
          label: 'Cấp độ A1–A2',
          inferredDefaults: { level: 'A2' },
          omittedKeys: ['level'],
          sampleRow: {
            word: 'curriculum',
            phonetic: '/kəˈrɪkjələm/',
            partOfSpeech: 'noun',
            meaning: 'chương trình giảng dạy',
            example: 'The new curriculum focuses on practical communication skills.',
            topic: 'School',
            className: presetClasses[0] || '',
          },
        },
        {
          tabName: 'Vocab_B1',
          label: 'Cấp độ B1',
          inferredDefaults: { level: 'B1' },
          omittedKeys: ['level'],
        },
        {
          tabName: 'Vocab_B2_Plus',
          label: 'Cấp độ B2+',
          inferredDefaults: { level: 'B2' },
          omittedKeys: ['level'],
        },
      ],
      guideNotes: [
        { Cot: 'Sheet Tab', MoTa: 'Phân tách theo Cấp độ (A1–A2, B1, B2+); cột Cấp độ được tự động nhận theo tên Tab.', ViDu: 'Vocab_B1' },
        { Cot: 'Lớp áp dụng', MoTa: 'Chọn từ Drop-down các lớp hiện có và lớp cài đặt trước của trường.', ViDu: presetClasses[0] || '10A1' },
      ],
    };
  }

  if (subjectId === 'math') {
    if (mod === 'lessons') {
      return {
        subjectId,
        moduleKey: 'lessons',
        fileName: 'Mau_LyThuyet_Toan.xlsx',
        title: 'Lý thuyết & Công thức Toán',
        headerColorHex: 'FF6D28D9',
        columns: [
          { key: 'title', header: 'Tiêu đề bài học *', width: 32, required: true },
          { key: 'grade', header: 'Khối lớp', width: 14, dropdownKey: 'grade' },
          { key: 'topic', header: 'Chuyên đề *', width: 24, required: true, dropdownKey: 'topic' },
          { key: 'difficulty', header: 'Mức độ', width: 16, dropdownKey: 'difficulty' },
          { key: 'summary', header: 'Tóm tắt trọng tâm *', width: 40, required: true },
          { key: 'formula', header: 'Công thức (LaTeX)', width: 30 },
          { key: 'className', header: 'Lớp áp dụng', width: 16, dropdownKey: 'classes' },
        ],
        staticLists: {
          grade: { header: 'Khối lớp', values: DEFAULT_GRADE_OPTIONS },
          topic: { header: 'Chuyên đề', values: ['Đại số', 'Giải tích', 'Hình học phẳng', 'Hình học không gian', 'Xác suất - Thống kê'] },
          difficulty: { header: 'Mức độ', values: DEFAULT_DIFFICULTY },
        },
        tabs: [
          {
            tabName: 'Khoi_10',
            label: 'Toán Lớp 10',
            inferredDefaults: { grade: 'Lớp 10' },
            omittedKeys: ['grade'],
            sampleRow: {
              title: 'Hàm số bậc hai y = ax² + bx + c',
              topic: 'Đại số',
              difficulty: 'Cơ bản',
              summary: 'Xác định tọa độ đỉnh I(-b/2a; -Δ/4a), trục đối xứng và bảng biến thiên.',
              formula: 'x_I = -\\frac{b}{2a}',
              className: presetClasses[0] || '',
            },
          },
          { tabName: 'Khoi_11', label: 'Toán Lớp 11', inferredDefaults: { grade: 'Lớp 11' }, omittedKeys: ['grade'] },
          { tabName: 'Khoi_12', label: 'Toán Lớp 12', inferredDefaults: { grade: 'Lớp 12' }, omittedKeys: ['grade'] },
        ],
        guideNotes: [
          { Cot: 'Sheet Tab', MoTa: 'Chia theo Khối 10, 11, 12 (tự nhận Khối lớp, không cần điền lại cột Khối).', ViDu: 'Khoi_10' },
        ],
      };
    }

    if (mod === 'formula') {
      return {
        subjectId,
        moduleKey: 'formula',
        fileName: 'Mau_CongThuc_Toan.xlsx',
        title: 'Sổ tay Công thức Toán',
        headerColorHex: 'FF6D28D9',
        columns: [
          { key: 'name', header: 'Tên công thức *', width: 28, required: true },
          { key: 'grade', header: 'Khối lớp', width: 14, dropdownKey: 'grade' },
          { key: 'topic', header: 'Chuyên đề *', width: 22, required: true, dropdownKey: 'topic' },
          { key: 'expression', header: 'Biểu thức (LaTeX) *', width: 34, required: true },
          { key: 'note', header: 'Điều kiện / Ghi chú', width: 32 },
          { key: 'className', header: 'Lớp áp dụng', width: 16, dropdownKey: 'classes' },
        ],
        staticLists: {
          grade: { header: 'Khối lớp', values: DEFAULT_GRADE_OPTIONS },
          topic: { header: 'Chuyên đề', values: ['Đại số', 'Giải tích', 'Hình học phẳng', 'Hình học không gian', 'Lượng giác', 'Xác suất - Thống kê'] },
        },
        tabs: [
          {
            tabName: 'Khoi_10',
            label: 'Công thức Lớp 10',
            inferredDefaults: { grade: 'Lớp 10' },
            omittedKeys: ['grade'],
            sampleRow: {
              name: 'Định lý Côsin trong tam giác',
              topic: 'Hình học phẳng',
              expression: 'a^2 = b^2 + c^2 - 2bc\\cos A',
              note: 'Áp dụng cho mọi tam giác ABC.',
              className: presetClasses[0] || '',
            },
          },
          { tabName: 'Khoi_11', label: 'Công thức Lớp 11', inferredDefaults: { grade: 'Lớp 11' }, omittedKeys: ['grade'] },
          { tabName: 'Khoi_12', label: 'Công thức Lớp 12', inferredDefaults: { grade: 'Lớp 12' }, omittedKeys: ['grade'] },
        ],
        guideNotes: [
          { Cot: 'Sheet Tab', MoTa: 'Chia theo Khối 10, 11, 12; tự nhận Khối lớp và có Drop-down Chuyên đề, Lớp áp dụng.', ViDu: 'Khoi_10' },
        ],
      };
    }

    const useClassTabs = presetClasses.length > 0;
    return {
      subjectId,
      moduleKey: 'questions',
      fileName: 'Mau_BaiTap_Toan.xlsx',
      title: 'Câu hỏi & Bài tập Toán',
      headerColorHex: 'FF6D28D9',
      usePresetClassesTabs: true,
      presetClassColumnKey: 'className',
      columns: [
        { key: 'qtype', header: 'Dạng bài *', width: 16, required: true, dropdownKey: 'qtype' },
        { key: 'topic', header: 'Chuyên đề *', width: 22, required: true, dropdownKey: 'topic' },
        { key: 'grade', header: 'Khối lớp', width: 14, dropdownKey: 'grade' },
        { key: 'className', header: 'Lớp áp dụng', width: 15, dropdownKey: 'classes' },
        { key: 'question', header: 'Nội dung câu hỏi *', width: 42, required: true },
        { key: 'optionA', header: 'Phương án A', width: 18 },
        { key: 'optionB', header: 'Phương án B', width: 18 },
        { key: 'optionC', header: 'Phương án C', width: 18 },
        { key: 'optionD', header: 'Phương án D', width: 18 },
        { key: 'answer', header: 'Đáp án đúng *', width: 18, required: true, dropdownKey: 'answer' },
        { key: 'solution', header: 'Lời giải chi tiết', width: 34 },
      ],
      staticLists: {
        qtype: { header: 'Dạng bài', values: ['mcq', 'num', 'essay'] },
        topic: { header: 'Chuyên đề', values: ['Đại số', 'Giải tích', 'Hình học phẳng', 'Hình học không gian', 'Xác suất - Thống kê'] },
        grade: { header: 'Khối lớp', values: DEFAULT_GRADE_OPTIONS },
        answer: { header: 'Đáp án', values: DEFAULT_Q_ANSWERS },
      },
      tabs: useClassTabs
        ? presetClasses.map((cls, i) => ({
            tabName: sanitizeSubjectSheetName(`Toan_${cls}`),
            label: `Lớp ${cls}`,
            inferredDefaults: { className: cls, grade: `Lớp ${cls.match(/^(\d{1,2})/)?.[1] || '10'}` },
            omittedKeys: ['className'],
            sampleRow:
              i === 0
                ? {
                    qtype: 'mcq',
                    topic: 'Đại số',
                    grade: `Lớp ${cls.match(/^(\d{1,2})/)?.[1] || '10'}`,
                    question: 'Nghiệm của phương trình 2x - 6 = 0 là:',
                    optionA: 'x = 2',
                    optionB: 'x = 3',
                    optionC: 'x = -3',
                    optionD: 'x = 6',
                    answer: 'B',
                    solution: '2x = 6 => x = 3.',
                  }
                : undefined,
          }))
        : [
            {
              tabName: 'Khoi_10',
              label: 'Khối 10',
              inferredDefaults: { grade: 'Lớp 10' },
              omittedKeys: ['grade'],
              sampleRow: {
                qtype: 'mcq',
                topic: 'Đại số',
                className: '',
                question: 'Nghiệm của phương trình 2x - 6 = 0 là:',
                optionA: 'x = 2',
                optionB: 'x = 3',
                optionC: 'x = -3',
                optionD: 'x = 6',
                answer: 'B',
                solution: '2x = 6 => x = 3.',
              },
            },
            { tabName: 'Khoi_11', label: 'Khối 11', inferredDefaults: { grade: 'Lớp 11' }, omittedKeys: ['grade'] },
            { tabName: 'Khoi_12', label: 'Khối 12', inferredDefaults: { grade: 'Lớp 12' }, omittedKeys: ['grade'] },
          ],
      guideNotes: [
        { Cot: 'Sheet Tab', MoTa: 'Nếu đã cài đặt lớp, từng Sheet tab đại diện cho từng lớp (không cần cột Lớp trong Sheet).', ViDu: presetClasses[0] ? `Toan_${presetClasses[0]}` : 'Khoi_10' },
        { Cot: 'Dạng bài', MoTa: 'Chọn từ Drop-down: mcq (Trắc nghiệm), num (Điền số), essay (Tự luận).', ViDu: 'mcq' },
      ],
    };
  }

  if (subjectId === 'physics') {
    if (mod === 'lessons') {
      return {
        subjectId,
        moduleKey: 'lessons',
        fileName: 'Mau_LyThuyet_VatLy.xlsx',
        title: 'Lý thuyết & Công thức Vật Lý',
        headerColorHex: 'FFDB2777',
        columns: [
          { key: 'title', header: 'Tiêu đề bài học *', width: 32, required: true },
          { key: 'grade', header: 'Khối lớp', width: 14, dropdownKey: 'grade' },
          { key: 'topic', header: 'Chuyên đề *', width: 22, required: true, dropdownKey: 'topic' },
          { key: 'difficulty', header: 'Mức độ', width: 16, dropdownKey: 'difficulty' },
          { key: 'summary', header: 'Nội dung trọng tâm *', width: 42, required: true },
          { key: 'formula', header: 'Công thức chuẩn SI', width: 28 },
          { key: 'className', header: 'Lớp áp dụng', width: 16, dropdownKey: 'classes' },
        ],
        staticLists: {
          grade: { header: 'Khối lớp', values: DEFAULT_GRADE_OPTIONS },
          topic: { header: 'Chuyên đề', values: ['Cơ học', 'Dao động & Sóng', 'Nhiệt học', 'Điện - Từ', 'Quang học', 'Vật lý hạt nhân'] },
          difficulty: { header: 'Mức độ', values: DEFAULT_DIFFICULTY },
        },
        tabs: [
          {
            tabName: 'Khoi_10',
            label: 'Vật Lý 10',
            inferredDefaults: { grade: 'Lớp 10' },
            omittedKeys: ['grade'],
            sampleRow: {
              title: 'Định luật II Newton',
              topic: 'Cơ học',
              difficulty: 'Cơ bản',
              summary: 'Gia tốc cùng hướng với hợp lực, tỉ lệ thuận với độ lớn hợp lực và tỉ lệ nghịch với khối lượng.',
              formula: 'F = m * a (N)',
              className: presetClasses[0] || '',
            },
          },
          { tabName: 'Khoi_11', label: 'Vật Lý 11', inferredDefaults: { grade: 'Lớp 11' }, omittedKeys: ['grade'] },
          { tabName: 'Khoi_12', label: 'Vật Lý 12', inferredDefaults: { grade: 'Lớp 12' }, omittedKeys: ['grade'] },
        ],
        guideNotes: [
          { Cot: 'Sheet Tab', MoTa: 'Phân tách sẵn Khối 10, 11, 12; cột Khối lớp tự nhận theo tên Sheet.', ViDu: 'Khoi_10' },
        ],
      };
    }

    if (mod === 'formula') {
      return {
        subjectId,
        moduleKey: 'formula',
        fileName: 'Mau_CongThuc_VatLy.xlsx',
        title: 'Sổ tay Công thức Vật Lý',
        headerColorHex: 'FFDB2777',
        columns: [
          { key: 'name', header: 'Tên định luật / công thức *', width: 30, required: true },
          { key: 'grade', header: 'Khối lớp', width: 14, dropdownKey: 'grade' },
          { key: 'topic', header: 'Chuyên đề *', width: 22, required: true, dropdownKey: 'topic' },
          { key: 'expression', header: 'Biểu thức chuẩn SI *', width: 30, required: true },
          { key: 'unit', header: 'Đơn vị SI', width: 16 },
          { key: 'note', header: 'Ý nghĩa / Ghi chú', width: 32 },
          { key: 'className', header: 'Lớp áp dụng', width: 16, dropdownKey: 'classes' },
        ],
        staticLists: {
          grade: { header: 'Khối lớp', values: DEFAULT_GRADE_OPTIONS },
          topic: { header: 'Chuyên đề', values: ['Cơ học', 'Dao động & Sóng', 'Nhiệt học', 'Điện - Từ', 'Quang học', 'Vật lý hạt nhân'] },
        },
        tabs: [
          {
            tabName: 'Khoi_10',
            label: 'Vật Lý 10',
            inferredDefaults: { grade: 'Lớp 10' },
            omittedKeys: ['grade'],
            sampleRow: {
              name: 'Động năng',
              topic: 'Cơ học',
              expression: 'W_d = \\frac{1}{2}mv^2',
              unit: 'Joule (J)',
              note: 'm tính bằng kg, v tính bằng m/s.',
              className: presetClasses[0] || '',
            },
          },
          { tabName: 'Khoi_11', label: 'Vật Lý 11', inferredDefaults: { grade: 'Lớp 11' }, omittedKeys: ['grade'] },
          { tabName: 'Khoi_12', label: 'Vật Lý 12', inferredDefaults: { grade: 'Lớp 12' }, omittedKeys: ['grade'] },
        ],
        guideNotes: [
          { Cot: 'Sheet Tab', MoTa: 'Chia theo Khối 10, 11, 12; tự nhận Khối lớp và có Drop-down Chuyên đề, Lớp.', ViDu: 'Khoi_10' },
        ],
      };
    }

    return {
      subjectId,
      moduleKey: 'questions',
      fileName: 'Mau_CauHoi_VatLy.xlsx',
      title: 'Câu hỏi Vật Lý',
      headerColorHex: 'FFDB2777',
      columns: [
        { key: 'topic', header: 'Chuyên đề *', width: 22, required: true, dropdownKey: 'topic' },
        { key: 'grade', header: 'Khối lớp', width: 14, dropdownKey: 'grade' },
        { key: 'className', header: 'Lớp áp dụng', width: 16, dropdownKey: 'classes' },
        { key: 'question', header: 'Câu hỏi *', width: 42, required: true },
        { key: 'optionA', header: 'Phương án A *', width: 18, required: true },
        { key: 'optionB', header: 'Phương án B *', width: 18, required: true },
        { key: 'optionC', header: 'Phương án C *', width: 18, required: true },
        { key: 'optionD', header: 'Phương án D *', width: 18, required: true },
        { key: 'answer', header: 'Đáp án đúng *', width: 16, required: true, dropdownKey: 'answer' },
        { key: 'explain', header: 'Hướng dẫn giải (SI)', width: 32 },
      ],
      staticLists: {
        topic: { header: 'Chuyên đề', values: ['Cơ học', 'Dao động & Sóng', 'Nhiệt học', 'Điện - Từ', 'Quang học', 'Vật lý hạt nhân'] },
        grade: { header: 'Khối lớp', values: DEFAULT_GRADE_OPTIONS },
        answer: { header: 'Đáp án', values: DEFAULT_MCQ_OPTIONS },
      },
      tabs: [
        {
          tabName: 'Khoi_10',
          label: 'Vật Lý 10',
          inferredDefaults: { grade: 'Lớp 10' },
          omittedKeys: ['grade'],
          sampleRow: {
            topic: 'Cơ học',
            className: presetClasses[0] || '',
            question: 'Đơn vị chuẩn SI của lực là gì?',
            optionA: 'Joule (J)',
            optionB: 'Newton (N)',
            optionC: 'Watt (W)',
            optionD: 'Pascal (Pa)',
            answer: 'B',
            explain: 'Lực đo bằng Newton (1 N = 1 kg·m/s²).',
          },
        },
        { tabName: 'Khoi_11', label: 'Vật Lý 11', inferredDefaults: { grade: 'Lớp 11' }, omittedKeys: ['grade'] },
        { tabName: 'Khoi_12', label: 'Vật Lý 12', inferredDefaults: { grade: 'Lớp 12' }, omittedKeys: ['grade'] },
      ],
      guideNotes: [
        { Cot: 'Sheet Tab', MoTa: 'Chia sẵn Khối 10, 11, 12; có Drop-down cho Chuyên đề, Đáp án đúng và Lớp áp dụng.', ViDu: 'Khoi_10' },
      ],
    };
  }

  if (subjectId === 'chemistry') {
    if (mod === 'lessons') {
      return {
        subjectId,
        moduleKey: 'lessons',
        fileName: 'Mau_LyThuyet_HoaHoc.xlsx',
        title: 'Lý thuyết Hóa Học (ChemiLab)',
        headerColorHex: 'FF059669',
        columns: [
          { key: 'title', header: 'Tên bài học *', width: 32, required: true },
          { key: 'grade', header: 'Khối lớp', width: 14, dropdownKey: 'grade' },
          { key: 'topic', header: 'Chuyên đề *', width: 24, required: true, dropdownKey: 'topic' },
          { key: 'difficulty', header: 'Mức độ', width: 16, dropdownKey: 'difficulty' },
          { key: 'summary', header: 'Nội dung trọng tâm *', width: 42, required: true },
          { key: 'equation', header: 'Phương trình tiêu biểu', width: 30 },
          { key: 'className', header: 'Lớp áp dụng', width: 16, dropdownKey: 'classes' },
        ],
        staticLists: {
          grade: { header: 'Khối lớp', values: DEFAULT_GRADE_OPTIONS },
          topic: { header: 'Chuyên đề', values: ['Cấu tạo nguyên tử', 'Liên kết hóa học', 'Oxi hóa - Khử', 'Kim loại & Phi kim', 'Hóa hữu cơ', 'Dung dịch & pH'] },
          difficulty: { header: 'Mức độ', values: DEFAULT_DIFFICULTY },
        },
        tabs: [
          {
            tabName: 'Khoi_10',
            label: 'Hóa học 10',
            inferredDefaults: { grade: 'Lớp 10' },
            omittedKeys: ['grade'],
            sampleRow: {
              title: 'Cân bằng phản ứng oxi hóa - khử',
              topic: 'Oxi hóa - Khử',
              difficulty: 'Thông hiểu',
              summary: 'Tổng số electron nhường bằng tổng số electron nhận trong quá trình phản ứng.',
              equation: 'Cu + 4HNO3 -> Cu(NO3)2 + 2NO2 + 2H2O',
              className: presetClasses[0] || '',
            },
          },
          { tabName: 'Khoi_11', label: 'Hóa học 11', inferredDefaults: { grade: 'Lớp 11' }, omittedKeys: ['grade'] },
          { tabName: 'Khoi_12', label: 'Hóa học 12', inferredDefaults: { grade: 'Lớp 12' }, omittedKeys: ['grade'] },
        ],
        guideNotes: [
          { Cot: 'Sheet Tab', MoTa: 'Chia theo Khối 10, 11, 12; bỏ cột Khối trên sheet để nhập gọn hơn.', ViDu: 'Khoi_10' },
        ],
      };
    }

    if (mod === 'formula') {
      return {
        subjectId,
        moduleKey: 'formula',
        fileName: 'Mau_CongThuc_HoaHoc.xlsx',
        title: 'Công thức & Phương trình Hóa Học',
        headerColorHex: 'FF059669',
        columns: [
          { key: 'name', header: 'Tên công thức / Phản ứng *', width: 30, required: true },
          { key: 'grade', header: 'Khối lớp', width: 14, dropdownKey: 'grade' },
          { key: 'topic', header: 'Chuyên đề *', width: 22, required: true, dropdownKey: 'topic' },
          { key: 'expression', header: 'Biểu thức / PTHH *', width: 34, required: true },
          { key: 'note', header: 'Điều kiện / Hiện tượng', width: 32 },
          { key: 'className', header: 'Lớp áp dụng', width: 16, dropdownKey: 'classes' },
        ],
        staticLists: {
          grade: { header: 'Khối lớp', values: DEFAULT_GRADE_OPTIONS },
          topic: { header: 'Chuyên đề', values: ['Mol & Nồng độ', 'Oxi hóa - Khử', 'Kim loại & Phi kim', 'Hóa hữu cơ', 'Dung dịch & pH'] },
        },
        tabs: [
          {
            tabName: 'Khoi_10',
            label: 'Hóa học 10',
            inferredDefaults: { grade: 'Lớp 10' },
            omittedKeys: ['grade'],
            sampleRow: {
              name: 'Nồng độ mol dung dịch',
              topic: 'Mol & Nồng độ',
              expression: 'C_M = n / V',
              note: 'V tính theo lít (L), n tính theo mol.',
              className: presetClasses[0] || '',
            },
          },
          { tabName: 'Khoi_11', label: 'Hóa học 11', inferredDefaults: { grade: 'Lớp 11' }, omittedKeys: ['grade'] },
          { tabName: 'Khoi_12', label: 'Hóa học 12', inferredDefaults: { grade: 'Lớp 12' }, omittedKeys: ['grade'] },
        ],
        guideNotes: [
          { Cot: 'Sheet Tab', MoTa: 'Chia theo Khối 10, 11, 12; bỏ cột Khối trên sheet để nhập gọn hơn.', ViDu: 'Khoi_10' },
        ],
      };
    }

    if (mod === 'elements') {
      return {
        subjectId,
        moduleKey: 'elements',
        fileName: 'Mau_BangTuanHoan_HoaHoc.xlsx',
        title: 'Bảng tuần hoàn Hóa Học (ChemiLab)',
        headerColorHex: 'FF059669',
        columns: [
          { key: 'atomicNumber', header: 'Số hiệu Z *', width: 14, required: true },
          { key: 'symbol', header: 'Ký hiệu *', width: 12, required: true },
          { key: 'name', header: 'Tên nguyên tố *', width: 22, required: true },
          { key: 'atomicMass', header: 'Nguyên tử khối *', width: 16, required: true },
          { key: 'groupType', header: 'Nhóm nguyên tố', width: 18, dropdownKey: 'groupType' },
          { key: 'period', header: 'Chu kỳ', width: 12, dropdownKey: 'period' },
          { key: 'valence', header: 'Hóa trị / Lớp ngoài', width: 20 },
          { key: 'note', header: 'Tính chất / Ứng dụng', width: 32 },
        ],
        staticLists: {
          groupType: { header: 'Nhóm nguyên tố', values: ['Kim loại', 'Phi kim', 'Khí hiếm'] },
          period: { header: 'Chu kỳ', values: ['1', '2', '3', '4', '5', '6', '7'] },
        },
        tabs: [
          {
            tabName: 'KimLoai',
            label: 'Kim loại',
            inferredDefaults: { groupType: 'Kim loại' },
            omittedKeys: ['groupType'],
            sampleRow: {
              atomicNumber: '11',
              symbol: 'Na',
              name: 'Natri (Sodium)',
              atomicMass: '22.99',
              period: '3',
              valence: 'I (3s¹)',
              note: 'Kim loại kiềm hoạt động hóa học mạnh.',
            },
          },
          { tabName: 'PhiKim', label: 'Phi kim', inferredDefaults: { groupType: 'Phi kim' }, omittedKeys: ['groupType'] },
          { tabName: 'KhiHiem', label: 'Khí hiếm', inferredDefaults: { groupType: 'Khí hiếm' }, omittedKeys: ['groupType'] },
        ],
        guideNotes: [
          { Cot: 'Sheet Tab', MoTa: 'Phân loại theo Kim loại, Phi kim, Khí hiếm và tự nhận Nhóm nguyên tố.', ViDu: 'KimLoai' },
        ],
      };
    }

    return {
      subjectId,
      moduleKey: 'questions',
      fileName: 'Mau_CauHoi_HoaHoc.xlsx',
      title: 'Bài tập Hóa Học (ChemiLab)',
      headerColorHex: 'FF059669',
      columns: [
        { key: 'topic', header: 'Chuyên đề *', width: 22, required: true, dropdownKey: 'topic' },
        { key: 'grade', header: 'Khối lớp', width: 14, dropdownKey: 'grade' },
        { key: 'className', header: 'Lớp áp dụng', width: 16, dropdownKey: 'classes' },
        { key: 'question', header: 'Câu hỏi / Đề bài *', width: 42, required: true },
        { key: 'optionA', header: 'Phương án A *', width: 18, required: true },
        { key: 'optionB', header: 'Phương án B *', width: 18, required: true },
        { key: 'optionC', header: 'Phương án C *', width: 18, required: true },
        { key: 'optionD', header: 'Phương án D *', width: 18, required: true },
        { key: 'answer', header: 'Đáp án đúng *', width: 16, required: true, dropdownKey: 'answer' },
        { key: 'explain', header: 'Giải thích phản ứng', width: 34 },
      ],
      staticLists: {
        topic: { header: 'Chuyên đề', values: ['Cấu tạo nguyên tử', 'Liên kết hóa học', 'Oxi hóa - Khử', 'Kim loại & Phi kim', 'Hóa hữu cơ', 'Dung dịch & pH'] },
        grade: { header: 'Khối lớp', values: DEFAULT_GRADE_OPTIONS },
        answer: { header: 'Đáp án', values: DEFAULT_MCQ_OPTIONS },
      },
      tabs: [
        {
          tabName: 'Khoi_10',
          label: 'Hóa học 10',
          inferredDefaults: { grade: 'Lớp 10' },
          omittedKeys: ['grade'],
          sampleRow: {
            topic: 'Dung dịch & pH',
            className: presetClasses[0] || '',
            question: 'Dung dịch làm quỳ tím chuyển sang màu xanh là:',
            optionA: 'HCl',
            optionB: 'NaOH',
            optionC: 'NaCl',
            optionD: 'H2SO4',
            answer: 'B',
            explain: 'NaOH là bazơ mạnh có pH > 7.',
          },
        },
        { tabName: 'Khoi_11', label: 'Hóa học 11', inferredDefaults: { grade: 'Lớp 11' }, omittedKeys: ['grade'] },
        { tabName: 'Khoi_12', label: 'Hóa học 12', inferredDefaults: { grade: 'Lớp 12' }, omittedKeys: ['grade'] },
      ],
      guideNotes: [
        { Cot: 'Sheet Tab', MoTa: 'Tách theo Khối 10, 11, 12 và hỗ trợ Drop-down Chuyên đề, Đáp án, Lớp áp dụng.', ViDu: 'Khoi_10' },
      ],
    };
  }

  if (subjectId === 'literature') {
    if (mod === 'works') {
      return {
        subjectId,
        moduleKey: 'works',
        fileName: 'Mau_TacPham_NguVan.xlsx',
        title: 'Thư viện Tác phẩm Ngữ Văn',
        headerColorHex: 'FF9F1239',
        columns: [
          { key: 'title', header: 'Tên tác phẩm *', width: 30, required: true },
          { key: 'author', header: 'Tác giả *', width: 22, required: true },
          { key: 'period', header: 'Giai đoạn', width: 20, dropdownKey: 'period' },
          { key: 'genre', header: 'Thể loại *', width: 18, required: true, dropdownKey: 'genre' },
          { key: 'grade', header: 'Khối lớp', width: 14, dropdownKey: 'grade' },
          { key: 'className', header: 'Lớp áp dụng', width: 16, dropdownKey: 'classes' },
          { key: 'summary', header: 'Tóm tắt / Giá trị nội dung', width: 38 },
          { key: 'content', header: 'Văn bản trích đoạn *', width: 48, required: true },
        ],
        staticLists: {
          period: { header: 'Giai đoạn', values: ['Văn học dân gian', 'Văn học trung đại', 'Văn học hiện đại'] },
          genre: { header: 'Thể loại', values: ['Thơ', 'Truyện ngắn', 'Tùy bút - Ký', 'Kịch', 'Nghị luận', 'Truyện thơ Nôm'] },
          grade: { header: 'Khối lớp', values: DEFAULT_GRADE_OPTIONS },
        },
        tabs: [
          {
            tabName: 'VanHocDanGian',
            label: 'Văn học dân gian',
            inferredDefaults: { period: 'Văn học dân gian' },
            omittedKeys: ['period'],
          },
          {
            tabName: 'VanHocTrungDai',
            label: 'Văn học trung đại',
            inferredDefaults: { period: 'Văn học trung đại' },
            omittedKeys: ['period'],
            sampleRow: {
              title: 'Bình Ngô đại cáo (trích)',
              author: 'Nguyễn Trãi',
              genre: 'Nghị luận',
              grade: 'Lớp 10',
              className: presetClasses[0] || '',
              summary: 'Áng thiên cổ hùng văn khẳng định chủ quyền và tư tưởng nhân nghĩa.',
              content: 'Việc nhân nghĩa cốt ở yên dân, Quân điếu phạt trước lo trừ bạo...',
            },
          },
          {
            tabName: 'VanHocHienDai',
            label: 'Văn học hiện đại',
            inferredDefaults: { period: 'Văn học hiện đại' },
            omittedKeys: ['period'],
          },
        ],
        guideNotes: [
          { Cot: 'Sheet Tab', MoTa: 'Chia sẵn theo 3 giai đoạn văn học nên không lặp lại cột Giai đoạn trên từng sheet.', ViDu: 'VanHocTrungDai' },
        ],
      };
    }

    if (mod === 'knowledge') {
      return {
        subjectId,
        moduleKey: 'knowledge',
        fileName: 'Mau_KienThuc_NguVan.xlsx',
        title: 'Kiến thức & Chuyên đề Ngữ Văn',
        headerColorHex: 'FF9F1239',
        columns: [
          { key: 'title', header: 'Tên chuyên đề *', width: 30, required: true },
          { key: 'category', header: 'Mảng kiến thức', width: 20, dropdownKey: 'category' },
          { key: 'grade', header: 'Khối lớp', width: 14, dropdownKey: 'grade' },
          { key: 'summary', header: 'Kiến thức trọng tâm *', width: 42, required: true },
          { key: 'examples', header: 'Ví dụ / Dẫn chứng', width: 34 },
          { key: 'className', header: 'Lớp áp dụng', width: 16, dropdownKey: 'classes' },
        ],
        staticLists: {
          category: { header: 'Mảng kiến thức', values: ['Đọc hiểu', 'Nghị luận xã hội', 'Nghị luận văn học', 'Tiếng Việt'] },
          grade: { header: 'Khối lớp', values: DEFAULT_GRADE_OPTIONS },
        },
        tabs: [
          {
            tabName: 'DocHieu',
            label: 'Đọc hiểu',
            inferredDefaults: { category: 'Đọc hiểu' },
            omittedKeys: ['category'],
            sampleRow: {
              title: 'Các phương thức biểu đạt chính',
              grade: 'Lớp 10',
              summary: 'Tự sự, miêu tả, biểu cảm, thuyết minh, nghị luận, hành chính - công vụ.',
              examples: 'Văn bản nghị luận tập trung vào luận điểm, luận cứ và lập luận.',
              className: presetClasses[0] || '',
            },
          },
          { tabName: 'NghiLuanXaHoi', label: 'Nghị luận xã hội', inferredDefaults: { category: 'Nghị luận xã hội' }, omittedKeys: ['category'] },
          { tabName: 'NghiLuanVanHoc', label: 'Nghị luận văn học', inferredDefaults: { category: 'Nghị luận văn học' }, omittedKeys: ['category'] },
          { tabName: 'TiengViet', label: 'Thực hành Tiếng Việt', inferredDefaults: { category: 'Tiếng Việt' }, omittedKeys: ['category'] },
        ],
        guideNotes: [
          { Cot: 'Sheet Tab', MoTa: 'Chia theo Đọc hiểu, Nghị luận xã hội, Nghị luận văn học, Tiếng Việt (tự nhận Mảng kiến thức).', ViDu: 'DocHieu' },
        ],
      };
    }

    if (mod === 'writing') {
      return {
        subjectId,
        moduleKey: 'writing',
        fileName: 'Mau_LuyenViet_NguVan.xlsx',
        title: 'Đề luyện viết & Dàn ý Ngữ Văn',
        headerColorHex: 'FF9F1239',
        columns: [
          { key: 'title', header: 'Đề bài luyện viết *', width: 38, required: true },
          { key: 'genre', header: 'Dạng bài viết', width: 22, dropdownKey: 'genre' },
          { key: 'grade', header: 'Khối lớp', width: 14, dropdownKey: 'grade' },
          { key: 'outline', header: 'Dàn ý gợi ý *', width: 44, required: true },
          { key: 'rubric', header: 'Tiêu chí chấm điểm', width: 30 },
          { key: 'className', header: 'Lớp áp dụng', width: 16, dropdownKey: 'classes' },
        ],
        staticLists: {
          genre: { header: 'Dạng bài viết', values: ['Nghị luận văn học', 'Nghị luận xã hội', 'Phân tích tác phẩm'] },
          grade: { header: 'Khối lớp', values: DEFAULT_GRADE_OPTIONS },
        },
        tabs: [
          {
            tabName: 'NghiLuanVanHoc',
            label: 'Nghị luận văn học',
            inferredDefaults: { genre: 'Nghị luận văn học' },
            omittedKeys: ['genre'],
            sampleRow: {
              title: 'Phân tích vẻ đẹp hình tượng người lính trong bài thơ Tây Tiến',
              grade: 'Lớp 12',
              outline: '1. Mở bài: Giới thiệu tác giả, tác phẩm.\n2. Thân bài: Vẻ đẹp lãng mạn và bi tráng.\n3. Kết bài: Khẳng định giá trị.',
              rubric: 'Đủ luận điểm, dẫn chứng thơ chính xác, diễn đạt mạch lạc.',
              className: presetClasses[0] || '',
            },
          },
          { tabName: 'NghiLuanXaHoi', label: 'Nghị luận xã hội', inferredDefaults: { genre: 'Nghị luận xã hội' }, omittedKeys: ['genre'] },
          { tabName: 'PhanTichTacPham', label: 'Phân tích tác phẩm', inferredDefaults: { genre: 'Phân tích tác phẩm' }, omittedKeys: ['genre'] },
        ],
        guideNotes: [
          { Cot: 'Sheet Tab', MoTa: 'Chia theo dạng bài viết; tự nhận Dạng bài viết và hỗ trợ Drop-down Khối lớp, Lớp áp dụng.', ViDu: 'NghiLuanVanHoc' },
        ],
      };
    }

    return {
      subjectId,
      moduleKey: 'questions',
      fileName: 'Mau_CauHoi_NguVan.xlsx',
      title: 'Câu hỏi Luyện tập Ngữ Văn',
      headerColorHex: 'FF9F1239',
      columns: [
        { key: 'type', header: 'Loại câu hỏi', width: 16, dropdownKey: 'qtype' },
        { key: 'grade', header: 'Khối lớp', width: 14, dropdownKey: 'grade' },
        { key: 'className', header: 'Lớp áp dụng', width: 16, dropdownKey: 'classes' },
        { key: 'topic', header: 'Chủ đề / Tác phẩm', width: 24 },
        { key: 'question', header: 'Câu hỏi / Đề bài *', width: 42, required: true },
        { key: 'optionA', header: 'Phương án A', width: 18 },
        { key: 'optionB', header: 'Phương án B', width: 18 },
        { key: 'optionC', header: 'Phương án C', width: 18 },
        { key: 'optionD', header: 'Phương án D', width: 18 },
        { key: 'answer', header: 'Đáp án / Gợi ý *', width: 22, required: true, dropdownKey: 'answer' },
      ],
      staticLists: {
        qtype: { header: 'Loại câu hỏi', values: ['mcq', 'tf', 'essay'] },
        grade: { header: 'Khối lớp', values: DEFAULT_GRADE_OPTIONS },
        answer: { header: 'Đáp án', values: DEFAULT_Q_ANSWERS },
      },
      tabs: [
        {
          tabName: 'Loai_TracNghiem',
          label: 'Trắc nghiệm MCQ',
          inferredDefaults: { type: 'mcq' },
          omittedKeys: ['type'],
          sampleRow: {
            grade: 'Lớp 10',
            className: presetClasses[0] || '',
            topic: 'Bình Ngô đại cáo',
            question: 'Tư tưởng cốt lõi mở đầu Bình Ngô đại cáo của Nguyễn Trãi là gì?',
            optionA: 'Chủ quyền lãnh thổ',
            optionB: 'Nhân nghĩa yên dân',
            optionC: 'Sức mạnh quân sự',
            optionD: 'Địa linh nhân kiệt',
            answer: 'B',
          },
        },
        { tabName: 'Loai_DungSai', label: 'Đúng / Sai', inferredDefaults: { type: 'tf' }, omittedKeys: ['type'] },
        { tabName: 'Loai_TuLuan', label: 'Tự luận / Đọc hiểu', inferredDefaults: { type: 'essay' }, omittedKeys: ['type'] },
      ],
      guideNotes: [
        { Cot: 'Sheet Tab', MoTa: 'Tách theo loại câu hỏi (Trắc nghiệm, Đúng/Sai, Tự luận) nên không cần cột Loại.', ViDu: 'Loai_TracNghiem' },
      ],
    };
  }

  if (subjectId === 'history') {
    const hMod = (['timeline', 'archive', 'practice'].includes(mod) ? mod : 'history') as HistoryExcelModule;
    if (hMod === 'timeline') {
      return {
        subjectId,
        moduleKey: 'timeline',
        fileName: 'Mau_SuKien_DongThoiGian_LichSu.xlsx',
        title: 'Dòng thời gian Sự kiện Lịch sử',
        headerColorHex: 'FF854D0E',
        columns: [
          { key: 'title', header: 'Tên sự kiện *', width: 32, required: true },
          { key: 'date', header: 'Mốc thời gian *', width: 16, required: true },
          { key: 'period', header: 'Thời kỳ', width: 18, dropdownKey: 'period' },
          { key: 'country', header: 'Quốc gia', width: 16 },
          { key: 'region', header: 'Khu vực', width: 18, dropdownKey: 'region' },
          { key: 'topic', header: 'Chủ đề', width: 22 },
          { key: 'context', header: 'Bối cảnh', width: 28 },
          { key: 'development', header: 'Diễn biến', width: 32 },
          { key: 'result', header: 'Kết quả', width: 26 },
          { key: 'significance', header: 'Ý nghĩa', width: 28 },
          { key: 'figures', header: 'Nhân vật', width: 20 },
          { key: 'source', header: 'Nguồn', width: 22 },
        ],
        staticLists: {
          period: { header: 'Thời kỳ', values: ['Cổ đại & Trung đại', 'Cận đại', 'Hiện đại'] },
          region: { header: 'Khu vực', values: ['Việt Nam', 'Đông Nam Á', 'Châu Á', 'Châu Âu', 'Thế giới'] },
        },
        tabs: [
          { tabName: 'CoDai_TrungDai', label: 'Cổ đại & Trung đại', inferredDefaults: { period: 'Cổ đại & Trung đại' }, omittedKeys: ['period'], sampleRow: { title: 'Chiến thắng Bạch Đằng', date: '938', country: 'Việt Nam', region: 'Việt Nam', topic: 'Chống ngoại xâm', context: 'Quân Nam Hán xâm lược lần 2', development: 'Đóng cọc gỗ trên sông Bạch Đằng', result: 'Đánh tan quân Nam Hán', significance: 'Mở ra kỷ nguyên độc lập tự chủ', figures: 'Ngô Quyền', source: 'Đại Việt sử ký toàn thư' } },
          { tabName: 'CanDai', label: 'Cận đại', inferredDefaults: { period: 'Cận đại' }, omittedKeys: ['period'] },
          { tabName: 'HienDai', label: 'Hiện đại', inferredDefaults: { period: 'Hiện đại' }, omittedKeys: ['period'] },
        ],
        guideNotes: [
          { Cot: 'Sheet Tab', MoTa: 'Chia theo 3 thời kỳ (Cổ đại & Trung đại, Cận đại, Hiện đại) nên bỏ cột Thời kỳ trên mỗi tab.', ViDu: 'CoDai_TrungDai' },
        ],
      };
    }
    if (hMod === 'archive') {
      return {
        subjectId,
        moduleKey: 'archive',
        fileName: 'Mau_ThuVien_TuLieu_LichSu.xlsx',
        title: 'Thư viện Tư liệu Lịch sử',
        headerColorHex: 'FF854D0E',
        columns: [
          { key: 'title', header: 'Tên tư liệu *', width: 30, required: true },
          { key: 'type', header: 'Loại', width: 16, dropdownKey: 'docType' },
          { key: 'period', header: 'Thời kỳ', width: 18, dropdownKey: 'period' },
          { key: 'topic', header: 'Chủ đề', width: 22 },
          { key: 'country', header: 'Quốc gia', width: 16 },
          { key: 'figures', header: 'Nhân vật', width: 20 },
          { key: 'date', header: 'Niên đại', width: 14 },
          { key: 'source', header: 'Nguồn', width: 22 },
          { key: 'origin', header: 'Xuất xứ', width: 22 },
          { key: 'summary', header: 'Tóm tắt', width: 30 },
          { key: 'content', header: 'Nội dung', width: 38 },
          { key: 'imageUrl', header: 'Đường dẫn ảnh', width: 24 },
        ],
        staticLists: {
          docType: { header: 'Loại tư liệu', values: ['Ảnh tư liệu', 'Văn kiện', 'Hiện vật'] },
          period: { header: 'Thời kỳ', values: ['Cổ đại & Trung đại', 'Cận đại', 'Hiện đại'] },
        },
        tabs: [
          { tabName: 'VanKien', label: 'Văn kiện', inferredDefaults: { type: 'Văn kiện' }, omittedKeys: ['type'] },
          { tabName: 'Anh_TuLieu', label: 'Ảnh tư liệu', inferredDefaults: { type: 'Ảnh tư liệu' }, omittedKeys: ['type'] },
          { tabName: 'HienVat', label: 'Hiện vật', inferredDefaults: { type: 'Hiện vật' }, omittedKeys: ['type'] },
        ],
        guideNotes: [
          { Cot: 'Sheet Tab', MoTa: 'Chia theo Văn kiện, Ảnh tư liệu, Hiện vật và tự nhận cột Loại.', ViDu: 'VanKien' },
        ],
      };
    }
    if (hMod === 'practice') {
      return {
        subjectId,
        moduleKey: 'practice',
        fileName: 'Mau_CauHoi_LuyenTap_LichSu.xlsx',
        title: 'Câu hỏi Luyện tập Lịch sử',
        headerColorHex: 'FF854D0E',
        columns: [
          { key: 'type', header: 'Loại', width: 14, dropdownKey: 'qtype' },
          { key: 'grade', header: 'Lớp', width: 12, dropdownKey: 'grade' },
          { key: 'className', header: 'Lớp áp dụng', width: 16, dropdownKey: 'classes' },
          { key: 'chapter', header: 'Chương', width: 20 },
          { key: 'topic', header: 'Chủ đề', width: 22 },
          { key: 'question', header: 'Câu hỏi *', width: 40, required: true },
          { key: 'sourceText', header: 'Tư liệu', width: 28 },
          { key: 'source', header: 'Nguồn', width: 20 },
          { key: 'optionA', header: 'Phương án A', width: 18 },
          { key: 'optionB', header: 'Phương án B', width: 18 },
          { key: 'optionC', header: 'Phương án C', width: 18 },
          { key: 'optionD', header: 'Phương án D', width: 18 },
          { key: 'answer', header: 'Đáp án đúng *', width: 16, required: true, dropdownKey: 'answer' },
          { key: 'explain', header: 'Giải thích', width: 28 },
        ],
        staticLists: {
          qtype: { header: 'Loại câu hỏi', values: ['mcq', 'tf', 'source'] },
          grade: { header: 'Khối lớp', values: DEFAULT_GRADE_OPTIONS },
          answer: { header: 'Đáp án', values: DEFAULT_Q_ANSWERS },
        },
        tabs: [
          { tabName: 'Loai_mcq', label: 'Trắc nghiệm (mcq)', inferredDefaults: { type: 'mcq' }, omittedKeys: ['type'] },
          { tabName: 'Loai_tf', label: 'Đúng/Sai (tf)', inferredDefaults: { type: 'tf' }, omittedKeys: ['type'] },
          { tabName: 'Loai_source', label: 'Đọc tư liệu (source)', inferredDefaults: { type: 'source' }, omittedKeys: ['type'] },
        ],
        guideNotes: [
          { Cot: 'Sheet Tab', MoTa: 'Chia theo Loai_mcq, Loai_tf, Loai_source; tự nhận Loại không cần nhập cột Loại.', ViDu: 'Loai_mcq' },
        ],
      };
    }
    return {
      subjectId,
      moduleKey: 'history',
      fileName: 'Mau_Kho_KienThuc_LichSu.xlsx',
      title: 'Kho Kiến thức Lịch sử',
      headerColorHex: 'FF854D0E',
      columns: [
        { key: 'title', header: 'Tiêu đề *', width: 30, required: true },
        { key: 'grade', header: 'Lớp *', width: 12, required: true, dropdownKey: 'grade' },
        { key: 'className', header: 'Lớp áp dụng', width: 16, dropdownKey: 'classes' },
        { key: 'period', header: 'Thời kỳ', width: 18, dropdownKey: 'period' },
        { key: 'chapter', header: 'Chương', width: 22 },
        { key: 'topic', header: 'Chủ đề', width: 22 },
        { key: 'summary', header: 'Tóm tắt *', width: 34, required: true },
        { key: 'points', header: 'Ý chính', width: 32 },
        { key: 'cause', header: 'Nguyên nhân', width: 26 },
        { key: 'result', header: 'Kết quả', width: 26 },
        { key: 'significance', header: 'Ý nghĩa', width: 28 },
        { key: 'country', header: 'Quốc gia', width: 16 },
        { key: 'figures', header: 'Nhân vật', width: 20 },
        { key: 'source', header: 'Nguồn', width: 22 },
      ],
      staticLists: {
        grade: { header: 'Khối lớp', values: DEFAULT_GRADE_OPTIONS },
        period: { header: 'Thời kỳ', values: ['Cổ đại & Trung đại', 'Cận đại', 'Hiện đại'] },
      },
      tabs: [
        { tabName: 'CoDai_TrungDai', label: 'Cổ đại & Trung đại', inferredDefaults: { period: 'Cổ đại & Trung đại' }, omittedKeys: ['period'] },
        { tabName: 'CanDai', label: 'Cận đại', inferredDefaults: { period: 'Cận đại' }, omittedKeys: ['period'] },
        { tabName: 'HienDai', label: 'Hiện đại', inferredDefaults: { period: 'Hiện đại' }, omittedKeys: ['period'] },
      ],
      guideNotes: [
        { Cot: 'Sheet Tab', MoTa: 'Chia theo thời kỳ (Cổ đại & Trung đại, Cận đại, Hiện đại) và tự nhận cột Thời kỳ.', ViDu: 'CanDai' },
      ],
    };
  }

  // GEOGRAPHY
  const gMod = (['atlas', 'data', 'practice', 'test'].includes(mod) ? mod : 'knowledge') as GeoExcelModule;
  if (gMod === 'atlas') {
    return {
      subjectId: 'geography',
      moduleKey: 'atlas',
      fileName: 'Mau_Atlat_DiaDanh_ToaDo.xlsx',
      title: 'Địa danh & Tọa độ Atlat',
      headerColorHex: 'FF0E7490',
      columns: [
        { key: 'name', header: 'Địa danh *', width: 26, required: true },
        { key: 'scope', header: 'Phạm vi', width: 14, dropdownKey: 'scope' },
        { key: 'layer', header: 'Lớp bản đồ *', width: 18, required: true, dropdownKey: 'layer' },
        { key: 'lat', header: 'Vĩ độ *', width: 14, required: true },
        { key: 'lng', header: 'Kinh độ *', width: 14, required: true },
        { key: 'region', header: 'Vùng', width: 20 },
        { key: 'country', header: 'Quốc gia', width: 16 },
        { key: 'info', header: 'Thông tin', width: 32 },
        { key: 'metric', header: 'Chỉ số', width: 16 },
        { key: 'year', header: 'Năm', width: 10 },
        { key: 'source', header: 'Nguồn', width: 22 },
      ],
      staticLists: {
        scope: { header: 'Phạm vi', values: ['vietnam', 'world'] },
        layer: { header: 'Lớp bản đồ', values: ['Địa hình', 'Hành chính', 'Khí hậu', 'Sông ngòi', 'Dân cư', 'Kinh tế', 'Giao thông', 'Tài nguyên'] },
      },
      tabs: [
        {
          tabName: 'Atlat_VietNam',
          label: 'Việt Nam',
          inferredDefaults: { scope: 'vietnam' },
          omittedKeys: ['scope'],
          sampleRow: { name: 'Hà Nội', layer: 'Hành chính', lat: '21.0285', lng: '105.8542', region: 'Đồng bằng sông Hồng', country: 'Việt Nam', info: 'Thủ đô nước CHXHCN Việt Nam', year: '2025', source: 'Atlat Địa lý VN' },
        },
        { tabName: 'Atlat_TheGioi', label: 'Thế giới', inferredDefaults: { scope: 'world' }, omittedKeys: ['scope'] },
      ],
      guideNotes: [
        { Cot: 'Sheet Tab', MoTa: 'Chia thành Atlat_VietNam và Atlat_TheGioi (tự nhận Phạm vi).', ViDu: 'Atlat_VietNam' },
      ],
    };
  }
  if (gMod === 'data') {
    return {
      subjectId: 'geography',
      moduleKey: 'data',
      fileName: 'Mau_BangSoLieu_DiaLy.xlsx',
      title: 'Bảng số liệu Địa lý',
      headerColorHex: 'FF0E7490',
      columns: [
        { key: 'label', header: 'Đối tượng *', width: 28, required: true },
        { key: 'unit', header: 'Đơn vị *', width: 16, required: true, dropdownKey: 'unit' },
        { key: 'y2021', header: '2021', width: 12 },
        { key: 'y2022', header: '2022', width: 12 },
        { key: 'y2023', header: '2023', width: 12 },
        { key: 'y2024', header: '2024', width: 12 },
        { key: 'source', header: 'Nguồn', width: 24 },
      ],
      staticLists: {
        unit: { header: 'Đơn vị', values: ['%', 'nghìn tỷ đồng', 'triệu người', 'triệu tấn', 'km²', 'người/km²'] },
      },
      tabs: [
        {
          tabName: 'CoCau_KinhTe',
          label: 'Cơ cấu kinh tế',
          inferredDefaults: {},
          omittedKeys: [],
          sampleRow: { label: 'Nông - lâm - thủy sản', unit: '%', y2021: '12.6', y2022: '11.9', y2023: '11.9', y2024: '11.8', source: 'Tổng cục Thống kê' },
        },
        { tabName: 'DanSo_LaoDong', label: 'Dân số & Lao động', inferredDefaults: {}, omittedKeys: [] },
      ],
      guideNotes: [
        { Cot: 'Đơn vị', MoTa: 'Có sẵn Drop-down chọn đơn vị đo (%, nghìn tỷ đồng, triệu người...).', ViDu: '%' },
      ],
    };
  }
  if (gMod === 'practice' || gMod === 'test') {
    return {
      subjectId: 'geography',
      moduleKey: gMod,
      fileName: gMod === 'test' ? 'Mau_DeKiemTra_DiaLy.xlsx' : 'Mau_CauHoi_LuyenTap_DiaLy.xlsx',
      title: gMod === 'test' ? 'Đề kiểm tra Địa lý' : 'Câu hỏi Luyện tập Địa lý',
      headerColorHex: 'FF0E7490',
      columns: [
        { key: 'type', header: 'Loại', width: 14, dropdownKey: 'qtype' },
        { key: 'grade', header: 'Lớp', width: 12, dropdownKey: 'grade' },
        { key: 'className', header: 'Lớp áp dụng', width: 16, dropdownKey: 'classes' },
        { key: 'chapter', header: 'Chương', width: 22 },
        { key: 'topic', header: 'Chủ đề', width: 22 },
        { key: 'question', header: 'Câu hỏi *', width: 40, required: true },
        { key: 'optionA', header: 'Phương án A', width: 18 },
        { key: 'optionB', header: 'Phương án B', width: 18 },
        { key: 'optionC', header: 'Phương án C', width: 18 },
        { key: 'optionD', header: 'Phương án D', width: 18 },
        { key: 'answer', header: 'Đáp án đúng *', width: 16, required: true, dropdownKey: 'answer' },
        { key: 'method', header: 'Phương pháp', width: 22 },
        { key: 'explain', header: 'Giải thích', width: 28 },
        { key: 'source', header: 'Nguồn', width: 20 },
      ],
      staticLists: {
        qtype: { header: 'Loại', values: ['mcq', 'tf', 'short', 'atlas', 'data'] },
        grade: { header: 'Khối lớp', values: DEFAULT_GRADE_OPTIONS },
        answer: { header: 'Đáp án', values: DEFAULT_Q_ANSWERS },
      },
      tabs: [
        { tabName: 'Loai_mcq', label: 'Trắc nghiệm MCQ', inferredDefaults: { type: 'mcq' }, omittedKeys: ['type'] },
        { tabName: 'Loai_tf', label: 'Đúng / Sai', inferredDefaults: { type: 'tf' }, omittedKeys: ['type'] },
        { tabName: 'Loai_atlas', label: 'Khai thác Atlat', inferredDefaults: { type: 'atlas' }, omittedKeys: ['type'] },
        { tabName: 'Loai_data', label: 'Số liệu & Biểu đồ', inferredDefaults: { type: 'data' }, omittedKeys: ['type'] },
      ],
      guideNotes: [
        { Cot: 'Sheet Tab', MoTa: 'Chia theo Loai_mcq, Loai_tf, Loai_atlas, Loai_data và tự nhận Loại.', ViDu: 'Loai_atlas' },
      ],
    };
  }
  return {
    subjectId: 'geography',
    moduleKey: 'knowledge',
    fileName: 'Mau_KienThuc_DiaLy.xlsx',
    title: 'Kho Kiến thức Địa lý',
    headerColorHex: 'FF0E7490',
    columns: [
      { key: 'title', header: 'Tiêu đề *', width: 30, required: true },
      { key: 'grade', header: 'Lớp *', width: 12, required: true, dropdownKey: 'grade' },
      { key: 'className', header: 'Lớp áp dụng', width: 16, dropdownKey: 'classes' },
      { key: 'chapter', header: 'Chương', width: 22 },
      { key: 'topic', header: 'Chủ đề', width: 22 },
      { key: 'domain', header: 'Mảng', width: 16, dropdownKey: 'domain' },
      { key: 'summary', header: 'Kiến thức trọng tâm *', width: 38, required: true },
      { key: 'points', header: 'Ý chính', width: 32 },
      { key: 'examples', header: 'Ví dụ', width: 26 },
      { key: 'stats', header: 'Số liệu', width: 20 },
      { key: 'year', header: 'Năm', width: 10 },
      { key: 'source', header: 'Nguồn', width: 22 },
    ],
    staticLists: {
      grade: { header: 'Khối lớp', values: DEFAULT_GRADE_OPTIONS },
      domain: { header: 'Mảng kiến thức', values: ['Tự nhiên', 'Dân cư', 'Kinh tế', 'Xã hội', 'Môi trường'] },
    },
    tabs: [
      { tabName: 'Mang_TuNhien', label: 'Địa lý Tự nhiên', inferredDefaults: { domain: 'Tự nhiên' }, omittedKeys: ['domain'], sampleRow: { title: 'Địa hình đồi núi Việt Nam', grade: 'Lớp 12', className: presetClasses[0] || '', chapter: 'Địa lý tự nhiên', topic: 'Địa hình', summary: 'Đồi núi chiếm 3/4 diện tích lãnh thổ, chủ yếu là đồi núi thấp.', points: 'Hướng Tây Bắc - Đông Nam; Hướng vòng cung', examples: 'Hoàng Liên Sơn', stats: '75% diện tích', year: '2024', source: 'SGK Địa lý 12' } },
      { tabName: 'Mang_DanCu', label: 'Địa lý Dân cư', inferredDefaults: { domain: 'Dân cư' }, omittedKeys: ['domain'] },
      { tabName: 'Mang_KinhTe', label: 'Địa lý Kinh tế', inferredDefaults: { domain: 'Kinh tế' }, omittedKeys: ['domain'] },
      { tabName: 'Mang_MoiTruong', label: 'Xã hội & Môi trường', inferredDefaults: { domain: 'Môi trường' }, omittedKeys: ['domain'] },
    ],
    guideNotes: [
      { Cot: 'Sheet Tab', MoTa: 'Chia theo từng mảng kiến thức (Tự nhiên, Dân cư, Kinh tế, Môi trường); tự nhận cột Mảng.', ViDu: 'Mang_TuNhien' },
    ],
  };
}

function colLetter(n: number): string {
  let num = n;
  let str = '';
  while (num > 0) {
    const rem = (num - 1) % 26;
    str = String.fromCharCode(65 + rem) + str;
    num = Math.floor((num - 1) / 26);
  }
  return str;
}

export async function generateSubjectTemplateBuffer(params: {
  subjectId: SubjectExcelSubjectId;
  moduleKey?: string;
  presetClasses?: string[];
}): Promise<{ fileName: string; buffer: Uint8Array; spec: SubjectExcelModuleSpec }> {
  const classesList = Array.from(
    new Set((params.presetClasses || []).map((s) => String(s || '').trim()).filter(Boolean))
  );
  const spec = getModuleCatalogSpec(params.subjectId, params.moduleKey || '', classesList);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'SchoolHub Subject Studio';

  // 1. DANH_MUC sheet (Drop-down sources)
  const lists: Record<string, { header: string; values: string[] }> = {
    ...spec.staticLists,
  };
  if (classesList.length > 0 || spec.columns.some((c) => c.dropdownKey === 'classes')) {
    lists.classes = {
      header: 'Lớp cài đặt trước',
      values: classesList.length > 0 ? classesList : ['10A1', '10A2', '11A1', '12A1'],
    };
  }

  const listKeys = Object.keys(lists);
  const danhMucWs = wb.addWorksheet('DANH_MUC');
  const danhMucRangeMap: Record<string, string> = {};
  danhMucWs.columns = listKeys.map((k) => ({
    header: lists[k].header,
    key: k,
    width: 24,
  }));
  const maxListLen = Math.max(...listKeys.map((k) => lists[k].values.length), 1);
  for (let i = 0; i < maxListLen; i++) {
    const rowObj: Record<string, string> = {};
    for (const k of listKeys) {
      rowObj[k] = lists[k].values[i] || '';
    }
    danhMucWs.addRow(rowObj);
  }
  listKeys.forEach((k, idx) => {
    const col = colLetter(idx + 1);
    const count = Math.max(lists[k].values.length, 1);
    danhMucRangeMap[k] = `=DANH_MUC!$${col}$2:$${col}$${count + 1}`;
  });
  danhMucWs.state = 'hidden';

  // 2. Data Sheet Tabs (each omitting its classified columns!)
  for (const tab of spec.tabs) {
    const omittedSet = new Set(tab.omittedKeys);
    const tabCols = spec.columns.filter((c) => !omittedSet.has(c.key));
    const ws = wb.addWorksheet(tab.tabName.slice(0, 31), {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    ws.columns = tabCols.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width || 20,
    }));

    const hdr = ws.getRow(1);
    hdr.height = 24;
    tabCols.forEach((c, cIdx) => {
      const cell = hdr.getCell(cIdx + 1);
      cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: c.required ? spec.headerColorHex : 'FF334155' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });

    if (tab.sampleRow) {
      const rowData: Record<string, string> = {};
      for (const c of tabCols) {
        rowData[c.key] = tab.sampleRow[c.key] || '';
      }
      ws.addRow(rowData);
    }

    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: Math.max(tabCols.length, 1) },
    };

    const validationRows = 200;
    tabCols.forEach((c, cIdx) => {
      if (!c.dropdownKey || !danhMucRangeMap[c.dropdownKey]) return;
      const formula = danhMucRangeMap[c.dropdownKey];
      for (let r = 2; r <= validationRows; r++) {
        ws.getCell(r, cIdx + 1).dataValidation = {
          type: 'list',
          allowBlank: !c.required,
          formulae: [formula],
          showErrorMessage: true,
          errorTitle: 'Giá trị không nằm trong danh sách',
          error: `Vui lòng chọn giá trị từ Drop-down (${lists[c.dropdownKey]?.header || c.header}).`,
        };
      }
    });
  }

  // 3. HUONG_DAN sheet
  const guideWs = wb.addWorksheet('HUONG_DAN');
  guideWs.columns = [
    { header: 'Cột / Quy tắc', key: 'Cot', width: 28 },
    { header: 'Hướng dẫn chi tiết', key: 'MoTa', width: 58 },
    { header: 'Ví dụ chuẩn', key: 'ViDu', width: 28 },
  ];
  guideWs.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  guideWs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  guideWs.addRows([
    {
      Cot: 'SUBJECT_MODULE',
      MoTa: `${spec.subjectId}:${spec.moduleKey} — Không đổi tên các Sheet tab đã cấu trúc để hệ thống tự động nhận nhóm phân loại.`,
      ViDu: spec.tabs.map((t) => t.tabName).join(', '),
    },
    ...spec.guideNotes,
  ]);

  const rawBuf = await wb.xlsx.writeBuffer();
  return {
    fileName: spec.fileName,
    buffer: new Uint8Array(rawBuf as ArrayBuffer),
    spec,
  };
}

function inferSubjectTabDefaults(
  subjectId: SubjectExcelSubjectId,
  spec: SubjectExcelModuleSpec,
  sheetName: string,
  presetClasses: string[] = []
): Record<string, string> {
  const cleanSheet = sheetName.trim();
  const matchedTab = spec.tabs.find(
    (t) => sanitizeSubjectSheetName(t.tabName).toLowerCase() === sanitizeSubjectSheetName(cleanSheet).toLowerCase()
  );
  if (matchedTab) {
    return { ...matchedTab.inferredDefaults };
  }

  const lower = cleanSheet.toLowerCase();
  const out: Record<string, string> = {};

  if (/khoi[_\s-]*10|^10[a-z]/i.test(cleanSheet)) out.grade = 'Lớp 10';
  else if (/khoi[_\s-]*11|^11[a-z]/i.test(cleanSheet)) out.grade = 'Lớp 11';
  else if (/khoi[_\s-]*12|^12[a-z]/i.test(cleanSheet)) out.grade = 'Lớp 12';

  const strippedClassCandidate = cleanSheet
    .replace(/^(Toan|VatLy|Hoa|Anh|Van|Su|Dia|Lop)[_\s-]*/i, '')
    .trim();
  const matchedPreset = presetClasses.find(
    (c) => sanitizeSubjectSheetName(c).toLowerCase() === sanitizeSubjectSheetName(strippedClassCandidate || cleanSheet).toLowerCase()
  );
  if (matchedPreset) {
    out.className = matchedPreset;
  } else {
    const classMatch = cleanSheet.match(/(?:^|_)(\d{1,2}[A-Za-z]\d{1,2})(?:$|_)/);
    if (classMatch) {
      out.className = classMatch[1].toUpperCase();
    }
  }

  if (subjectId === 'english') {
    if (lower.includes('a1') || lower.includes('a2')) out.level = 'A2';
    else if (lower.includes('b1')) out.level = 'B1';
    else if (lower.includes('b2') || lower.includes('c1')) out.level = 'B2';
    if (lower.includes('15phut')) out.testType = '15 phút';
    else if (lower.includes('1tiet')) out.testType = '1 tiết';
    else if (lower.includes('hocky')) out.testType = 'Học kỳ';
  }
  if (subjectId === 'chemistry') {
    if (lower.includes('kimloai')) out.groupType = 'Kim loại';
    else if (lower.includes('phikim')) out.groupType = 'Phi kim';
    else if (lower.includes('khihiem')) out.groupType = 'Khí hiếm';
  }
  if (subjectId === 'literature') {
    if (lower.includes('dangian')) out.period = 'Văn học dân gian';
    else if (lower.includes('trungdai')) out.period = 'Văn học trung đại';
    else if (lower.includes('hiendai')) out.period = 'Văn học hiện đại';
    if (lower.includes('tracnghiem') || lower.includes('mcq')) out.type = 'mcq';
    else if (lower.includes('dungsai') || lower.includes('tf')) out.type = 'tf';
    else if (lower.includes('tuluan') || lower.includes('essay')) out.type = 'essay';
    if (lower.includes('dochieu')) out.category = 'Đọc hiểu';
    else if (lower.includes('nghiluanxahoi')) {
      out.category = 'Nghị luận xã hội';
      out.genre = 'Nghị luận xã hội';
    } else if (lower.includes('nghiluanvanhoc')) {
      out.category = 'Nghị luận văn học';
      out.genre = 'Nghị luận văn học';
    } else if (lower.includes('tiengviet')) out.category = 'Tiếng Việt';
    else if (lower.includes('phantich')) out.genre = 'Phân tích tác phẩm';
  }
  if (subjectId === 'history') {
    if (lower.includes('codai') || lower.includes('trungdai')) out.period = 'Cổ đại & Trung đại';
    else if (lower.includes('candai')) out.period = 'Cận đại';
    else if (lower.includes('hiendai')) out.period = 'Hiện đại';
    if (lower.includes('vankien')) out.type = 'Văn kiện';
    else if (lower.includes('anh')) out.type = 'Ảnh tư liệu';
    else if (lower.includes('hienvat')) out.type = 'Hiện vật';
    if (lower.includes('mcq')) out.type = 'mcq';
    else if (lower.includes('tf')) out.type = 'tf';
    else if (lower.includes('source')) out.type = 'source';
  }
  if (subjectId === 'geography') {
    if (lower.includes('tunhien')) out.domain = 'Tự nhiên';
    else if (lower.includes('dancu')) out.domain = 'Dân cư';
    else if (lower.includes('kinhte')) out.domain = 'Kinh tế';
    else if (lower.includes('moitruong')) out.domain = 'Môi trường';
    if (lower.includes('vietnam')) out.scope = 'vietnam';
    else if (lower.includes('thegioi') || lower.includes('world')) out.scope = 'world';
    if (lower.includes('mcq')) out.type = 'mcq';
    else if (lower.includes('tf')) out.type = 'tf';
    else if (lower.includes('atlas')) out.type = 'atlas';
    else if (lower.includes('data')) out.type = 'data';
    else if (lower.includes('short')) out.type = 'short';
  }

  return out;
}

function buildDanhMucListsForSpec(spec: SubjectExcelModuleSpec, classesList: string[]) {
  const lists: Record<string, { header: string; values: string[] }> = {
    ...spec.staticLists,
  };
  if (classesList.length > 0 || spec.columns.some((c) => c.dropdownKey === 'classes')) {
    lists.classes = {
      header: 'Lớp cài đặt trước',
      values: classesList.length > 0 ? classesList : ['10A1', '10A2', '11A1', '12A1'],
    };
  }
  return lists;
}

function attachDanhMucAndGuideSheets(
  wb: ExcelJS.Workbook,
  spec: SubjectExcelModuleSpec,
  lists: Record<string, { header: string; values: string[] }>
): Record<string, string> {
  const listKeys = Object.keys(lists);
  const danhMucWs = wb.addWorksheet('DANH_MUC');
  const danhMucRangeMap: Record<string, string> = {};
  danhMucWs.columns = listKeys.map((k) => ({
    header: lists[k].header,
    key: k,
    width: 24,
  }));
  const maxListLen = Math.max(...listKeys.map((k) => lists[k].values.length), 1);
  for (let i = 0; i < maxListLen; i++) {
    const rowObj: Record<string, string> = {};
    for (const k of listKeys) {
      rowObj[k] = lists[k].values[i] || '';
    }
    danhMucWs.addRow(rowObj);
  }
  listKeys.forEach((k, idx) => {
    const col = colLetter(idx + 1);
    const count = Math.max(lists[k].values.length, 1);
    danhMucRangeMap[k] = `=DANH_MUC!$${col}$2:$${col}$${count + 1}`;
  });
  danhMucWs.state = 'hidden';
  return danhMucRangeMap;
}

function appendGuideWorksheet(wb: ExcelJS.Workbook, spec: SubjectExcelModuleSpec, tabNames: string[]) {
  const guideWs = wb.addWorksheet('HUONG_DAN');
  guideWs.columns = [
    { header: 'Cột / Quy tắc', key: 'Cot', width: 28 },
    { header: 'Hướng dẫn chi tiết', key: 'MoTa', width: 58 },
    { header: 'Ví dụ chuẩn', key: 'ViDu', width: 28 },
  ];
  guideWs.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  guideWs.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
  guideWs.addRows([
    {
      Cot: 'SUBJECT_MODULE',
      MoTa: `${spec.subjectId}:${spec.moduleKey} — Không đổi tên các Sheet tab đã cấu trúc để hệ thống tự động nhận nhóm phân loại.`,
      ViDu: tabNames.join(', '),
    },
    ...spec.guideNotes,
  ]);
}

function resolveExportTabForRow(
  row: Record<string, unknown>,
  tabs: SubjectExcelTabSpec[]
): SubjectExcelTabSpec {
  let bestTab = tabs[0];
  let bestScore = -1;
  for (const tab of tabs) {
    const entries = Object.entries(tab.inferredDefaults);
    if (entries.length === 0) continue;
    let matches = 0;
    let mismatch = false;
    for (const [k, expected] of entries) {
      const actual = String(row[k] ?? '').trim();
      if (!actual) continue;
      if (actual.toLowerCase() === String(expected).trim().toLowerCase()) {
        matches += 1;
      } else {
        mismatch = true;
        break;
      }
    }
    if (!mismatch && matches > bestScore) {
      bestScore = matches;
      bestTab = tab;
    }
  }
  return bestTab || tabs[0];
}

export async function generateSubjectExportBuffer(params: {
  subjectId: SubjectExcelSubjectId;
  moduleKey?: string;
  records: Array<Record<string, unknown>>;
  presetClasses?: string[];
  fileName?: string;
}): Promise<{ fileName: string; buffer: Uint8Array; spec: SubjectExcelModuleSpec }> {
  const extraRecordClasses = params.records
    .map((r) => String(r.className || '').trim())
    .filter(Boolean);
  const classesList = Array.from(
    new Set([
      ...(params.presetClasses || []).map((s) => String(s || '').trim()).filter(Boolean),
      ...extraRecordClasses,
    ])
  );
  const spec = getModuleCatalogSpec(params.subjectId, params.moduleKey || '', classesList);
  const lists = buildDanhMucListsForSpec(spec, classesList);

  const wb = new ExcelJS.Workbook();
  wb.creator = 'SchoolHub Subject Studio';
  const danhMucRangeMap = attachDanhMucAndGuideSheets(wb, spec, lists);

  // Special handling for Geography Data Matrix multi-sheet export
  if (params.subjectId === 'geography' && spec.moduleKey === 'data') {
    const tabNames: string[] = [];
    const usedTabs = new Set<string>();
    const dsList = params.records.length > 0 ? params.records : [];
    for (let idx = 0; idx < dsList.length; idx++) {
      const ds = dsList[idx];
      let baseName = sanitizeSubjectSheetName(String(ds.title || `BangSoLieu_${idx + 1}`));
      let tName = baseName;
      let suffix = 2;
      while (usedTabs.has(tName.toLowerCase())) {
        tName = sanitizeSubjectSheetName(`${baseName}_${suffix++}`);
      }
      usedTabs.add(tName.toLowerCase());
      tabNames.push(tName);
      const years = Array.isArray(ds.columns)
        ? ds.columns.map((y) => String(y))
        : Array.isArray(ds.years)
          ? ds.years.map((y) => String(y))
          : ['2021', '2022', '2023', '2024'];
      const series = Array.isArray(ds.rows)
        ? (ds.rows as Array<Record<string, unknown>>)
        : Array.isArray(ds.series)
          ? (ds.series as Array<Record<string, unknown>>)
          : [];
      const ws = wb.addWorksheet(tName, { views: [{ state: 'frozen', ySplit: 1 }] });
      const cols = [
        { header: 'Đối tượng *', key: 'label', width: 28 },
        { header: 'Đơn vị *', key: 'unit', width: 16 },
        ...years.map((y) => ({ header: y, key: `y_${y}`, width: 12 })),
        { header: 'Nguồn', key: 'source', width: 24 },
      ];
      ws.columns = cols;
      const hdr = ws.getRow(1);
      hdr.height = 24;
      cols.forEach((_, cIdx) => {
        const cell = hdr.getCell(cIdx + 1);
        cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: cIdx < 2 ? spec.headerColorHex : 'FF334155' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      });
      for (const s of series) {
        const rowObj: Record<string, unknown> = {
          label: String(s.label || s.name || ''),
          unit: String(ds.unit || s.unit || '%'),
          source: String(ds.source || ''),
        };
        const vals = Array.isArray(s.values) ? s.values : [];
        years.forEach((y, yIdx) => {
          rowObj[`y_${y}`] = vals[yIdx] ?? '';
        });
        ws.addRow(rowObj);
      }
      if (danhMucRangeMap.unit) {
        for (let r = 2; r <= Math.max(series.length + 30, 50); r++) {
          ws.getCell(r, 2).dataValidation = {
            type: 'list',
            allowBlank: false,
            formulae: [danhMucRangeMap.unit],
          };
        }
      }
    }
    if (tabNames.length === 0) {
      const ws = wb.addWorksheet('BangSoLieu_1');
      ws.columns = spec.columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 18 }));
      tabNames.push('BangSoLieu_1');
    }
    appendGuideWorksheet(wb, spec, tabNames);
    const outBuf = await wb.xlsx.writeBuffer();
    const exportName = params.fileName || spec.fileName.replace(/^Mau_/, 'Xuat_');
    return { fileName: exportName, buffer: new Uint8Array(outBuf as ArrayBuffer), spec };
  }

  const buckets = new Map<string, Array<Record<string, unknown>>>();
  for (const tab of spec.tabs) {
    buckets.set(tab.tabName, []);
  }
  for (const rec of params.records) {
    const tab = resolveExportTabForRow(rec, spec.tabs);
    const arr = buckets.get(tab.tabName) || [];
    arr.push(rec);
    buckets.set(tab.tabName, arr);
  }

  // Emit tabs that either have data or keep at least first tab if export is empty
  const tabsToWrite = spec.tabs.filter((t, i) => (buckets.get(t.tabName)?.length || 0) > 0 || (params.records.length === 0 && i === 0));
  for (const tab of tabsToWrite) {
    const omittedSet = new Set(tab.omittedKeys);
    const tabCols = spec.columns.filter((c) => !omittedSet.has(c.key));
    const ws = wb.addWorksheet(tab.tabName.slice(0, 31), {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    ws.columns = tabCols.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width || 20,
    }));

    const hdr = ws.getRow(1);
    hdr.height = 24;
    tabCols.forEach((c, cIdx) => {
      const cell = hdr.getCell(cIdx + 1);
      cell.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: c.required ? spec.headerColorHex : 'FF334155' },
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    });

    const rowsForTab = buckets.get(tab.tabName) || [];
    for (const r of rowsForTab) {
      const rowData: Record<string, string> = {};
      for (const c of tabCols) {
        const val = r[c.key];
        rowData[c.key] = Array.isArray(val) ? val.join('; ') : val !== undefined && val !== null ? String(val) : '';
      }
      ws.addRow(rowData);
    }

    ws.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: Math.max(tabCols.length, 1) },
    };

    const validationRows = Math.max(rowsForTab.length + 100, 200);
    tabCols.forEach((c, cIdx) => {
      if (!c.dropdownKey || !danhMucRangeMap[c.dropdownKey]) return;
      const formula = danhMucRangeMap[c.dropdownKey];
      for (let r = 2; r <= validationRows; r++) {
        ws.getCell(r, cIdx + 1).dataValidation = {
          type: 'list',
          allowBlank: !c.required,
          formulae: [formula],
          showErrorMessage: true,
          errorTitle: 'Giá trị không nằm trong danh sách',
          error: `Vui lòng chọn giá trị từ Drop-down (${lists[c.dropdownKey]?.header || c.header}).`,
        };
      }
    });
  }

  appendGuideWorksheet(wb, spec, tabsToWrite.map((t) => t.tabName));
  const rawBuf = await wb.xlsx.writeBuffer();
  const exportName = params.fileName || spec.fileName.replace(/^Mau_/, 'Xuat_');
  return {
    fileName: exportName,
    buffer: new Uint8Array(rawBuf as ArrayBuffer),
    spec,
  };
}

const SYSTEM_SHEET_NAMES = new Set(['HUONG_DAN', 'HUONGDAN', 'DANH_MUC', 'DANHMUC', 'README', 'GUIDE']);

export interface ParsedSubjectExcelResult {
  subjectId: SubjectExcelSubjectId;
  moduleKey: string;
  sheetNames: string[];
  totalRawRows: number;
  rows: Record<string, unknown>[];
  datasets?: Array<Record<string, unknown>>;
  dataset?: Record<string, unknown> | null;
  discoveredClasses: string[];
  discoveredTopics: string[];
  discoveredGrades: string[];
  discoveredCategories: string[];
}

export function parseSubjectExcelBuffer(params: {
  subjectId: SubjectExcelSubjectId;
  moduleKey?: string;
  buffer: Buffer | Uint8Array;
  title?: string;
  presetClasses?: string[];
}): ParsedSubjectExcelResult {
  const modKey = (params.moduleKey || '').trim().toLowerCase();
  const spec = getModuleCatalogSpec(params.subjectId, modKey, params.presetClasses || []);
  const wb = XLSX.read(params.buffer, { type: 'buffer' });

  const dataSheetNames = wb.SheetNames.filter(
    (name) => !SYSTEM_SHEET_NAMES.has(sanitizeSubjectSheetName(name).toUpperCase())
  );
  const effectiveSheets = dataSheetNames.length > 0 ? dataSheetNames : wb.SheetNames.slice(0, 1);

  if (params.subjectId === 'geography' && spec.moduleKey === 'data') {
    const datasets: Array<Record<string, unknown>> = [];
    let totalRawRows = 0;
    for (const sName of effectiveSheets) {
      const ws = wb.Sheets[sName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      totalRawRows += rawRows.length;
      if (rawRows.length === 0) continue;
      const ds = normalizeGeoDataMatrixRows(rawRows, {
        title: params.title?.trim() || sName,
      });
      if (ds) datasets.push(ds as unknown as Record<string, unknown>);
    }
    return {
      subjectId: params.subjectId,
      moduleKey: spec.moduleKey,
      sheetNames: effectiveSheets,
      totalRawRows,
      rows: datasets,
      datasets,
      dataset: datasets[0] || null,
      discoveredClasses: [],
      discoveredTopics: [],
      discoveredGrades: [],
      discoveredCategories: [],
    };
  }

  const allNormalizedRows: Record<string, unknown>[] = [];
  const discoveredClasses = new Set<string>();
  const discoveredTopics = new Set<string>();
  const discoveredGrades = new Set<string>();
  const discoveredCategories = new Set<string>();
  let totalRawRows = 0;

  for (const sName of effectiveSheets) {
    const ws = wb.Sheets[sName];
    const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
    totalRawRows += rawRows.length;
    const inferred = inferSubjectTabDefaults(params.subjectId, spec, sName, params.presetClasses || []);

    rawRows.forEach((rawRow, rowIdx) => {
      // Merge inferred classified columns ONLY when absent/blank on the row
      const enrichedRow: Record<string, unknown> = { ...rawRow };
      for (const col of spec.columns) {
        if (!(col.header in enrichedRow) && !(col.key in enrichedRow) && inferred[col.key]) {
          enrichedRow[col.header] = inferred[col.key];
          enrichedRow[col.key] = inferred[col.key];
        }
      }

      if (params.subjectId === 'history') {
        const normalized = normalizeHistoryExcelRow(
          spec.moduleKey as HistoryExcelModule,
          enrichedRow,
          allNormalizedRows.length + rowIdx
        );
        if (normalized) {
          allNormalizedRows.push(normalized);
          const periodOrEra = normalized.era || normalized.period;
          if (periodOrEra) discoveredCategories.add(String(periodOrEra));
          if (normalized.topic) discoveredTopics.add(String(normalized.topic));
          if (normalized.grade) discoveredGrades.add(String(normalized.grade));
          const clsVal = enrichedRow['Lớp áp dụng'] || enrichedRow.className;
          if (clsVal) discoveredClasses.add(String(clsVal).trim());
        }
        return;
      }

      if (params.subjectId === 'geography') {
        const normalized = normalizeGeoExcelRow(
          spec.moduleKey as GeoExcelModule,
          enrichedRow,
          allNormalizedRows.length + rowIdx
        );
        if (normalized) {
          allNormalizedRows.push(normalized);
          if (normalized.domain) discoveredCategories.add(String(normalized.domain));
          if (normalized.topic) discoveredTopics.add(String(normalized.topic));
          if (normalized.grade) discoveredGrades.add(String(normalized.grade));
          const clsVal = enrichedRow['Lớp áp dụng'] || enrichedRow.className;
          if (clsVal) discoveredClasses.add(String(clsVal).trim());
        }
        return;
      }

      // Generic normalization for English, Math, Physics, Chemistry, Literature
      const pick = (key: string): string => {
        const col = spec.columns.find((c) => c.key === key);
        const candidates = [
          col?.header,
          col?.header?.replace(/\s*\*+$/, ''),
          key,
        ].filter(Boolean) as string[];
        for (const cKey of candidates) {
          if (enrichedRow[cKey] !== undefined && String(enrichedRow[cKey]).trim() !== '') {
            return String(enrichedRow[cKey]).trim();
          }
          const fuzzy = Object.keys(enrichedRow).find(
            (rk) => rk.replace(/\s*\*+$/, '').trim().toLowerCase() === cKey.toLowerCase()
          );
          if (fuzzy && String(enrichedRow[fuzzy]).trim() !== '') {
            return String(enrichedRow[fuzzy]).trim();
          }
        }
        return inferred[key] || '';
      };

      const item: Record<string, unknown> = { __sheetName: sName };
      for (const col of spec.columns) {
        const val = pick(col.key);
        if (val) item[col.key] = val;
      }
      const primaryKey = spec.columns[0]?.key;
      if (!primaryKey || !item[primaryKey]) return;

      if (item.className) discoveredClasses.add(String(item.className));
      if (item.topic) discoveredTopics.add(String(item.topic));
      if (item.grade) discoveredGrades.add(String(item.grade));
      if (item.level) discoveredCategories.add(String(item.level));
      if (item.period) discoveredCategories.add(String(item.period));

      allNormalizedRows.push(item);
    });
  }

  return {
    subjectId: params.subjectId,
    moduleKey: spec.moduleKey,
    sheetNames: effectiveSheets,
    totalRawRows,
    rows: allNormalizedRows,
    discoveredClasses: Array.from(discoveredClasses),
    discoveredTopics: Array.from(discoveredTopics),
    discoveredGrades: Array.from(discoveredGrades),
    discoveredCategories: Array.from(discoveredCategories),
  };
}
