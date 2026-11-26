import React, { Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

const DevSubjectsPreview =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('dev_subjects') === '1'
    ? React.lazy(() => import('./dev/SubjectsPreviewHarness'))
    : null;

const DevDesktopPreview =
  import.meta.env.DEV &&
  typeof window !== 'undefined' &&
  new URLSearchParams(window.location.search).get('dev_desktop') === '1'
    ? React.lazy(() => import('./dev/DesktopPreviewHarness'))
    : null;

const ActivePreview = DevDesktopPreview || DevSubjectsPreview;

createRoot(document.getElementById('root')!).render(
  ActivePreview ? (
    <Suspense fallback={<div className="p-6 text-sm">Loading preview...</div>}>
      <ActivePreview />
    </Suspense>
  ) : (
    <App />
  )
);
