import React, { useState, useMemo } from 'react';
import { Search, Users, BookOpen, Bell, ArrowRight } from 'lucide-react';
import { Modal } from '../common/Modal';
import {
  Announcement,
  Book,
  PermissionMatrix,
  Student,
  SuperAppId,
  Teacher,
  UserProfile,
} from '../../types';
import { APP_REGISTRY, SUPER_APP_ORDER } from '../../data/appRegistry';
import {
  canAccessSuperApp,
  DEFAULT_PERMISSIONS,
  filterStudentsByScope,
  getAllowedTabsForApp,
  hasPermission,
} from '../../utils/rbac';

interface GlobalSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile;
  customPermissions?: PermissionMatrix;
  students: Student[];
  teachers: Teacher[];
  books: Book[];
  announcements: Announcement[];
  onNavigate: (appId: SuperAppId, tabId?: string) => void;
}

export const GlobalSearchModal: React.FC<GlobalSearchModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  customPermissions = DEFAULT_PERMISSIONS,
  students,
  teachers,
  books,
  announcements,
  onNavigate,
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const canViewStudents = hasPermission(currentUser, 'students', 'view', customPermissions);
  const canCreateAnnouncements = hasPermission(
    currentUser,
    'announcements',
    'create',
    customPermissions
  );

  const filteredResults = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return { apps: [], students: [], books: [], announcements: [] };

    const apps = SUPER_APP_ORDER.flatMap((appId) => {
      if (!canAccessSuperApp(currentUser, appId, customPermissions)) return [];
      const app = APP_REGISTRY[appId];
      const allowedTabs = getAllowedTabsForApp(currentUser, appId, customPermissions);
      return allowedTabs
        .filter(
          (tab) =>
            app.title.toLowerCase().includes(q) ||
            tab.label.toLowerCase().includes(q)
        )
        .map((tab) => ({ app, tab }));
    }).slice(0, 5);

    const scopedStudents = canViewStudents
      ? filterStudentsByScope(students, currentUser, teachers).filter(
          (s) =>
            (s.fullName || '').toLowerCase().includes(q) ||
            (s.studentCode || '').toLowerCase().includes(q) ||
            (s.className || '').toLowerCase().includes(q) ||
            (s.rfidCardId || '').toLowerCase().includes(q)
        )
      : [];

    const scopedAnnouncements = announcements.filter((a) => {
      const st = a.status || 'published';
      if (!canCreateAnnouncements && st !== 'published') return false;
      return (
        (a.title || '').toLowerCase().includes(q) ||
        (a.content || '').toLowerCase().includes(q)
      );
    });

    return {
      apps,
      students: scopedStudents.slice(0, 4),
      books: books
        .filter(
          (b) =>
            (b.title || '').toLowerCase().includes(q) ||
            (b.author || '').toLowerCase().includes(q) ||
            (b.isbn || '').toLowerCase().includes(q)
        )
        .slice(0, 4),
      announcements: scopedAnnouncements.slice(0, 3),
    };
  }, [
    searchTerm,
    currentUser,
    customPermissions,
    canViewStudents,
    canCreateAnnouncements,
    students,
    teachers,
    books,
    announcements,
  ]);

  const hasResults =
    filteredResults.apps.length > 0 ||
    filteredResults.students.length > 0 ||
    filteredResults.books.length > 0 ||
    filteredResults.announcements.length > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Tìm kiếm nhanh"
      description="Ứng dụng, tính năng, học sinh, sách và thông báo trong phạm vi quyền"
      maxWidth="2xl"
    >
      <div className="space-y-4">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-sky-500" />
          <input
            type="text"
            autoFocus
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm ứng dụng, tab, tên sách, thông báo..."
            className="w-full bg-white/90 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 rounded-2xl pl-10 pr-4 py-2.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
          />
        </div>

        {searchTerm.trim() ? (
          <div className="space-y-4 max-h-[380px] overflow-y-auto pr-1">
            {filteredResults.apps.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                  Ứng dụng & Tính năng
                </p>
                <div className="space-y-1">
                  {filteredResults.apps.map(({ app, tab }) => {
                    const AppIcon = app.icon;
                    return (
                      <button
                        key={`${app.id}-${tab.id}`}
                        type="button"
                        onClick={() => {
                          onNavigate(app.id, tab.id);
                          onClose();
                        }}
                        className="w-full p-2 rounded-xl bg-white/70 dark:bg-slate-800/70 hover:bg-sky-50 dark:hover:bg-slate-700 flex items-center justify-between text-left cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <AppIcon className="w-6 h-6 shrink-0" />
                          <div>
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                              {tab.label}
                            </p>
                            <p className="text-[10px] text-slate-400">{app.title}</p>
                          </div>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {filteredResults.students.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-sky-600" /> Học sinh
                </p>
                <div className="space-y-1">
                  {filteredResults.students.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => {
                        onNavigate('school', 'students-classes');
                        onClose();
                      }}
                      className="w-full p-2 rounded-xl bg-white/70 dark:bg-slate-800/70 hover:bg-sky-50 dark:hover:bg-slate-700 flex items-center justify-between text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 flex items-center justify-center font-bold text-[11px]">
                          {s.className}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{s.fullName}</p>
                          <p className="text-[10px] text-slate-400 font-mono-tabular">
                            {s.studentCode} · RFID {s.rfidCardId}
                          </p>
                        </div>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filteredResults.books.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <BookOpen className="w-3.5 h-3.5 text-emerald-600" /> Sách thư viện
                </p>
                <div className="space-y-1">
                  {filteredResults.books.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => {
                        onNavigate('library', 'catalog');
                        onClose();
                      }}
                      className="w-full p-2 rounded-xl bg-white/70 dark:bg-slate-800/70 hover:bg-emerald-50 dark:hover:bg-slate-700 flex items-center justify-between text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-8 rounded bg-emerald-500/15 text-emerald-600 flex items-center justify-center">
                          <BookOpen className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-800 dark:text-slate-100">{b.title}</p>
                          <p className="text-[10px] text-slate-400">{b.author} · {b.shelfLocation}</p>
                        </div>
                      </div>
                      <span className="text-[11px] font-semibold text-emerald-600">
                        Sẵn: {b.availableCopies}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filteredResults.announcements.length > 0 && (
              <div>
                <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-orange-500" /> Thông báo
                </p>
                <div className="space-y-1">
                  {filteredResults.announcements.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => {
                        onNavigate('communication', 'announcements');
                        onClose();
                      }}
                      className="w-full p-2 rounded-xl bg-white/70 dark:bg-slate-800/70 hover:bg-orange-50 dark:hover:bg-slate-700 flex items-center justify-between text-left cursor-pointer"
                    >
                      <div className="min-w-0 pr-2">
                        <p className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{a.title}</p>
                        <p className="text-[10px] text-slate-400 truncate">{a.content}</p>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {!hasResults && (
              <div className="py-8 text-center text-xs text-slate-400">
                Không tìm thấy kết quả cho &ldquo;{searchTerm}&rdquo;.
              </div>
            )}
          </div>
        ) : (
          <div className="py-5 px-4 rounded-2xl bg-slate-100/70 dark:bg-slate-800/60 text-center text-xs text-slate-500">
            Nhập từ khóa để mở nhanh ứng dụng, tab chức năng hoặc đầu sách trong phạm vi quyền.
          </div>
        )}
      </div>
    </Modal>
  );
};
