import React, { useState } from 'react';
import type {
  ExportHistoryRecord,
  ImportHistoryRecord,
  ImportModuleKey,
  UserProfile,
} from '../../types';
import {
  extractExistingRecordsForModule,
  type ValidationDbContext,
} from '../../utils/importExport/validator';
import { CompactDataToolbar } from './CompactDataToolbar';
import { UnifiedManualFormModal } from './UnifiedManualFormModal';
import { ExcelImportDialog } from './ExcelImportDialog';
import { ExcelExportDialog } from './ExcelExportDialog';

interface ModuleDataActionsProps {
  moduleKey: ImportModuleKey;
  context: ValidationDbContext;
  currentUser: UserProfile;
  allRecords?: Record<string, unknown>[];
  filteredRecords?: Record<string, unknown>[];
  selectedRecords?: Record<string, unknown>[];
  canCreate?: boolean;
  canImport?: boolean;
  canExport?: boolean;
  createLabel?: string;
  extraActions?: React.ReactNode;
  onManualSave?: (entity: Record<string, unknown>, isEdit: boolean) => Promise<void> | void;
  onCommitImport: (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord,
    extraSheets?: Record<string, Record<string, unknown>[]>
  ) => Promise<void> | void;
  onLogExport?: (record: ExportHistoryRecord) => Promise<void> | void;
}

export const ModuleDataActions: React.FC<ModuleDataActionsProps> = ({
  moduleKey,
  context,
  currentUser,
  allRecords,
  filteredRecords,
  selectedRecords,
  canCreate = false,
  canImport = false,
  canExport = false,
  createLabel = 'Thêm mới',
  extraActions,
  onManualSave,
  onCommitImport,
  onLogExport,
}) => {
  const [manualOpen, setManualOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const defaultExisting = extractExistingRecordsForModule(moduleKey, context);
  const effectiveAll = allRecords ?? defaultExisting;
  const effectiveFiltered = filteredRecords ?? effectiveAll;

  return (
    <>
      <CompactDataToolbar
        canCreate={canCreate && Boolean(onManualSave)}
        canImport={canImport}
        canExport={canExport}
        createLabel={createLabel}
        selectedCount={selectedRecords?.length || 0}
        onManualAdd={onManualSave ? () => setManualOpen(true) : undefined}
        onOpenImport={canImport ? () => setImportOpen(true) : undefined}
        onOpenExport={canExport ? () => setExportOpen(true) : undefined}
        extraActions={extraActions}
      />

      {manualOpen && onManualSave && (
        <UnifiedManualFormModal
          isOpen={manualOpen}
          moduleKey={moduleKey}
          context={context}
          existingRecords={effectiveAll}
          currentUser={currentUser}
          onClose={() => setManualOpen(false)}
          onSave={onManualSave}
        />
      )}

      {importOpen && (
        <ExcelImportDialog
          isOpen={importOpen}
          moduleKey={moduleKey}
          context={context}
          existingRecords={effectiveAll}
          currentUser={currentUser}
          onClose={() => setImportOpen(false)}
          onCommitImport={onCommitImport}
        />
      )}

      {exportOpen && (
        <ExcelExportDialog
          isOpen={exportOpen}
          moduleKey={moduleKey}
          context={context}
          allRecords={effectiveAll}
          filteredRecords={effectiveFiltered}
          selectedRecords={selectedRecords}
          currentUser={currentUser}
          onClose={() => setExportOpen(false)}
          onLogExport={onLogExport}
        />
      )}
    </>
  );
};
