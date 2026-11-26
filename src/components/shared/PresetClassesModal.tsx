import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Sparkles, Layers, CheckCircle2 } from '../icons/UiIcons';
import type { PresetClassConfig, SchoolClass, SystemSettings } from '../../types';
import { Modal } from '../common/Modal';
import { sanitizeFirestoreDocId } from '../../utils/catalogs/catalogRegistry';

interface PresetClassesModalProps {
  isOpen: boolean;
  onClose: () => void;
  systemSettings: SystemSettings;
  existingClasses?: SchoolClass[];
  onSaveSettings: (nextSettings: SystemSettings) => Promise<void> | void;
  onCreateClassesOnWeb?: (newClasses: SchoolClass[]) => Promise<void> | void;
}

export const PresetClassesModal: React.FC<PresetClassesModalProps> = ({
  isOpen,
  onClose,
  systemSettings,
  existingClasses = [],
  onSaveSettings,
  onCreateClassesOnWeb,
}) => {
  const [items, setItems] = useState<PresetClassConfig[]>([]);
  const [newName, setNewName] = useState('');
  const [newGrade, setNewGrade] = useState<number>(10);
  const [newRoom, setNewRoom] = useState('');
  const [newHomeroom, setNewHomeroom] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setItems(systemSettings.presetClasses || []);
    setNewName('');
    setNewRoom('');
    setNewHomeroom('');
  }, [isOpen, systemSettings.presetClasses]);

  const existingLower = new Set(existingClasses.map((c) => c.name.trim().toLowerCase()));

  const handleAddSingle = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = newName.trim();
    if (!cleaned) return;
    const exists = items.some((p) => p.name.trim().toLowerCase() === cleaned.toLowerCase());
    if (exists) return;
    const inferredGrade = Number(cleaned.match(/^(\d{1,2})/)?.[1] || newGrade) || newGrade;
    const grade = inferredGrade >= 1 && inferredGrade <= 12 ? inferredGrade : newGrade;
    setItems((prev) => [
      ...prev,
      {
        name: cleaned,
        grade,
        room: newRoom.trim() || undefined,
        homeroomTeacherName: newHomeroom.trim() || undefined,
        academicYear: systemSettings.academicYear || '2026 - 2027',
      },
    ]);
    setNewName('');
    setNewRoom('');
    setNewHomeroom('');
  };

  const handleQuickAddGrade = (grade: 10 | 11 | 12, count = 5) => {
    setItems((prev) => {
      const next = [...prev];
      const known = new Set(next.map((p) => p.name.trim().toLowerCase()));
      for (let i = 1; i <= count; i++) {
        const name = `${grade}A${i}`;
        if (!known.has(name.toLowerCase())) {
          known.add(name.toLowerCase());
          next.push({
            name,
            grade,
            room: `P.${grade}0${i}`,
            academicYear: systemSettings.academicYear || '2026 - 2027',
          });
        }
      }
      return next;
    });
  };

  const handleRemove = (name: string) => {
    setItems((prev) => prev.filter((p) => p.name.trim().toLowerCase() !== name.trim().toLowerCase()));
  };

  const handleSave = async (createMissingOnWeb: boolean) => {
    setIsSaving(true);
    try {
      await onSaveSettings({
        ...systemSettings,
        presetClasses: items,
      });

      if (createMissingOnWeb && onCreateClassesOnWeb) {
        const defaultYear = systemSettings.academicYear || '2026 - 2027';
        const missing: SchoolClass[] = items
          .filter((p) => p.name.trim() && !existingLower.has(p.name.trim().toLowerCase()))
          .map((p) => ({
            id: sanitizeFirestoreDocId(`CLS-${p.name.trim()}`, 'CLS'),
            code: p.name.trim(),
            name: p.name.trim(),
            grade: p.grade || 10,
            academicYear: p.academicYear || defaultYear,
            homeroomTeacherId: '',
            homeroomTeacherName: p.homeroomTeacherName || 'Chưa phân công',
            room: p.room || 'Chưa xếp phòng',
            studentCount: 0,
            status: 'active',
          }));
        if (missing.length > 0) {
          await onCreateClassesOnWeb(missing);
        }
      }
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const missingCount = items.filter((p) => !existingLower.has(p.name.trim().toLowerCase())).length;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Lớp học cài đặt trước (Excel Sheet Tabs & Drop-down)"
      description="Các lớp này luôn tự động xuất hiện dưới dạng Sheet tab riêng và danh sách Drop-down trong mọi file Excel mẫu của trường và các môn học."
      maxWidth="2xl"
    >
      <div className="space-y-4 text-xs">
        <div className="p-3 rounded-2xl glass-subsurface flex flex-wrap items-center justify-between gap-2">
          <span className="font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-sky-500" /> Tạo nhanh theo khối:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {([10, 11, 12] as const).map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => handleQuickAddGrade(g, 5)}
                className="px-2.5 py-1 rounded-lg bg-sky-500/12 text-sky-700 dark:text-sky-300 border border-sky-400/30 font-semibold hover:bg-sky-500/20 cursor-pointer"
              >
                + {g}A1–{g}A5
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleAddSingle} className="grid grid-cols-2 sm:grid-cols-12 gap-2 items-end">
          <div className="col-span-1 sm:col-span-3">
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-200">Tên lớp *</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="VD: 10A6"
              className="w-full px-3 py-2 rounded-xl glass-subsurface"
            />
          </div>
          <div className="col-span-1 sm:col-span-2">
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-200">Khối</label>
            <select
              value={newGrade}
              onChange={(e) => setNewGrade(Number(e.target.value))}
              className="w-full px-2.5 py-2 rounded-xl glass-subsurface"
            >
              {[10, 11, 12, 6, 7, 8, 9].map((g) => (
                <option key={g} value={g}>Khối {g}</option>
              ))}
            </select>
          </div>
          <div className="col-span-1 sm:col-span-3">
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-200">Phòng</label>
            <input
              type="text"
              value={newRoom}
              onChange={(e) => setNewRoom(e.target.value)}
              placeholder="VD: P.206"
              className="w-full px-3 py-2 rounded-xl glass-subsurface"
            />
          </div>
          <div className="col-span-1 sm:col-span-2">
            <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-200">GVCN</label>
            <input
              type="text"
              value={newHomeroom}
              onChange={(e) => setNewHomeroom(e.target.value)}
              placeholder="Tùy chọn"
              className="w-full px-3 py-2 rounded-xl glass-subsurface"
            />
          </div>
          <div className="col-span-2 sm:col-span-2">
            <button
              type="submit"
              className="w-full px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-semibold inline-flex items-center justify-center gap-1 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" /> Thêm
            </button>
          </div>
        </form>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
            <span className="font-semibold flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-500" />
              Danh sách lớp cài đặt trước ({items.length})
            </span>
            {items.length > 0 && (
              <button
                type="button"
                onClick={() => setItems([])}
                className="text-rose-600 dark:text-rose-400 hover:underline font-medium cursor-pointer"
              >
                Xóa tất cả danh sách
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="p-6 text-center rounded-2xl glass-subsurface text-slate-500 dark:text-slate-400">
              Chưa có lớp cài đặt trước. Bạn có thể bấm "+ 10A1–10A5" hoặc nhập tên lớp để tạo sẵn Sheet tab & Drop-down Excel.
            </div>
          ) : (
            <div className="max-h-56 overflow-y-auto grid grid-cols-1 sm:grid-cols-2 gap-2 pr-1">
              {items.map((p) => {
                const alreadyOnWeb = existingLower.has(p.name.trim().toLowerCase());
                return (
                  <div
                    key={p.name}
                    className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl glass-subsurface"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-slate-900 dark:text-white font-mono">
                          {p.name}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          · Khối {p.grade}
                        </span>
                        {alreadyOnWeb && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="w-3 h-3" /> Đã có trên web
                          </span>
                        )}
                      </div>
                      {(p.room || p.homeroomTeacherName) && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {[p.room, p.homeroomTeacherName].filter(Boolean).join(' · ')}
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemove(p.name)}
                      aria-label={`Xóa lớp cài đặt trước ${p.name}`}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="pt-3 border-t border-slate-200/70 dark:border-white/10 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-2 rounded-xl glass-subsurface text-slate-700 dark:text-slate-200 font-semibold cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void handleSave(false)}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold cursor-pointer disabled:opacity-60"
          >
            {isSaving ? 'Đang lưu...' : 'Lưu cài đặt Excel'}
          </button>
          {onCreateClassesOnWeb && missingCount > 0 && (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void handleSave(true)}
              data-testid="preset-classes-save-and-create"
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold cursor-pointer disabled:opacity-60"
            >
              Lưu & Tạo {missingCount} lớp trên web
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
};
