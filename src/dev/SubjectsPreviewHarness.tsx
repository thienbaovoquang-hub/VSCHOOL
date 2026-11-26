import React, { useState } from 'react';
import { SubjectsApp } from '../components/apps/SubjectsApp';
import { DEFAULT_SYSTEM_SETTINGS } from '../firebase/services';
import type { UserProfile } from '../types';
import { DEFAULT_PERMISSIONS } from '../utils/rbac';

const DEV_PREVIEW_USER: UserProfile = {
  id: 'dev-preview-user',
  email: 'preview@schoolhub.local',
  displayName: 'Giáo viên Demo',
  role: 'admin',
  schoolId: 'schoolhub_main',
  status: 'active',
};

export function SubjectsPreviewHarness() {
  const params = new URLSearchParams(window.location.search);
  const initialTab = params.get('tab') || 'overview';
  const initialDark = params.get('theme') === 'dark';

  const [activeTab, setActiveTab] = useState(initialTab);
  const [darkMode, setDarkMode] = useState(initialDark);

  return (
    <div
      className={`min-h-screen w-full transition-colors ${
        darkMode ? 'dark bg-slate-950 text-slate-100' : 'bg-slate-100 text-slate-900'
      }`}
    >
      <div className="mx-auto flex h-screen max-w-[1440px] flex-col p-2 sm:p-4">
        <div className="mb-2 flex items-center justify-between gap-2 px-1 text-xs">
          <span className="font-semibold text-slate-500 dark:text-slate-400">
            DEV SUBJECTS PREVIEW
          </span>
          <button
            type="button"
            onClick={() => setDarkMode((prev) => !prev)}
            className="rounded-lg border border-slate-300 px-2.5 py-1 font-medium hover:bg-slate-200 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
        <div
          className={`flex-1 overflow-auto p-3 sm:p-5 rounded-2xl border shadow-xl glass-window-body ${
            darkMode ? 'border-slate-800 bg-slate-950' : 'border-slate-200 bg-slate-50'
          }`}
        >
          <SubjectsApp
            activeTab={activeTab}
            currentUser={DEV_PREVIEW_USER}
            customPermissions={DEFAULT_PERMISSIONS}
            darkMode={darkMode}
            classes={[]}
            presetClasses={[]}
            systemSettings={DEFAULT_SYSTEM_SETTINGS}
            academicRecords={[]}
            timetable={[]}
            assignments={[]}
            assignmentSubmissions={[]}
            learningMaterials={[]}
            teachers={[]}
            onSaveSettings={async () => {}}
            onCreateClassesOnWeb={async () => {}}
            onSyncSubjectClasses={async () => {}}
            onSaveAssignment={async () => {}}
            onSaveSubmission={async () => {}}
            onSaveMaterial={async () => {}}
            onSaveAcademicRecord={async () => {}}
            onLogExport={() => {}}
            onSelectTab={setActiveTab}
          />
        </div>
      </div>
    </div>
  );
}

export default SubjectsPreviewHarness;
