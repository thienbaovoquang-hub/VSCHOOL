import React, { useMemo, useState } from 'react';
import { FileText, AlertTriangle, Trophy, Sparkles } from '../icons/UiIcons';
import {
  Competition,
  CompetitionAward,
  CompetitionCriterion,
  CompetitionParticipant,
  CompetitionScore,
  EmulationAppeal,
  EmulationPeriod,
  EmulationRecord,
  EmulationSnapshot,
  EmulationTitleConfig,
  ExportHistoryRecord,
  ImportHistoryRecord,
  ImportModuleKey,
  PermissionMatrix,
  RuleCategory,
  RuleCriterion,
  RuleDocument,
  RuleVersion,
  SchoolClass,
  ScoreTransferRecord,
  Student,
  SystemSettings,
  UserProfile,
} from '../../types';
import { hasPermission } from '../../utils/rbac';
import type { ValidationDbContext } from '../../utils/importExport/validator';
import { RulesManagementSection } from './RulesManagementSection';
import { EmulationRecordingSection } from './EmulationRecordingSection';
import { EmulationScoresRankingsSection } from './EmulationScoresRankingsSection';
import { CompetitionsSection } from './CompetitionsSection';

export type EmulationSubTabId = 'rules' | 'violations' | 'rankings' | 'competitions';

interface EmulationHubViewProps {
  initialSection?: EmulationSubTabId;
  currentUser: UserProfile;
  customPermissions: PermissionMatrix;
  systemSettings: SystemSettings;
  validationContext?: ValidationDbContext;
  students: Student[];
  classes: SchoolClass[];
  ruleDocuments: RuleDocument[];
  ruleVersions: RuleVersion[];
  ruleCategories: RuleCategory[];
  ruleCriteria: RuleCriterion[];
  emulationRecords: EmulationRecord[];
  emulationAppeals: EmulationAppeal[];
  emulationPeriods: EmulationPeriod[];
  emulationSnapshots: EmulationSnapshot[];
  emulationTitleConfigs: EmulationTitleConfig[];
  competitions: Competition[];
  competitionCriteria: CompetitionCriterion[];
  competitionParticipants: CompetitionParticipant[];
  competitionScores: CompetitionScore[];
  competitionAwards: CompetitionAward[];
  scoreTransfers: ScoreTransferRecord[];
  onSaveSettings: (s: SystemSettings) => Promise<void> | void;
  onSaveRuleDocument: (doc: RuleDocument) => Promise<void> | void;
  onSaveRuleVersion: (ver: RuleVersion) => Promise<void> | void;
  onSaveRuleCategory: (cat: RuleCategory) => Promise<void> | void;
  onSaveRuleCriterion: (crit: RuleCriterion) => Promise<void> | void;
  onDeleteRuleCriterion: (id: string) => Promise<void> | void;
  onDeleteRuleCriteria?: (ids: string[]) => Promise<void> | void;
  onSaveEmulationRecord: (rec: EmulationRecord) => Promise<void> | void;
  onSaveEmulationAppeal: (appeal: EmulationAppeal) => Promise<void> | void;
  onSaveEmulationPeriod: (period: EmulationPeriod) => Promise<void> | void;
  onSaveEmulationSnapshot: (snap: EmulationSnapshot) => Promise<void> | void;
  onSaveTitleConfig: (cfg: EmulationTitleConfig) => Promise<void> | void;
  onDeleteTitleConfig: (id: string) => Promise<void> | void;
  onSaveCompetition: (comp: Competition) => Promise<void> | void;
  onSaveCompetitionCriterion: (crit: CompetitionCriterion) => Promise<void> | void;
  onDeleteCompetitionCriterion: (id: string) => Promise<void> | void;
  onSaveCompetitionParticipant: (part: CompetitionParticipant) => Promise<void> | void;
  onSaveCompetitionScore: (score: CompetitionScore) => Promise<void> | void;
  onSaveCompetitionAward: (award: CompetitionAward) => Promise<void> | void;
  onSaveScoreTransfer: (transfer: ScoreTransferRecord) => Promise<void> | void;
  onUnifiedImportCommit?: (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => Promise<void> | void;
  onLogExport?: (record: ExportHistoryRecord) => Promise<void> | void;
}

export const EmulationHubView: React.FC<EmulationHubViewProps> = ({
  initialSection = 'rankings',
  currentUser,
  customPermissions,
  systemSettings,
  validationContext,
  students,
  classes,
  ruleDocuments,
  ruleVersions,
  ruleCategories,
  ruleCriteria,
  emulationRecords,
  emulationAppeals,
  emulationPeriods,
  emulationSnapshots,
  emulationTitleConfigs,
  competitions,
  competitionCriteria,
  competitionParticipants,
  competitionScores,
  competitionAwards,
  scoreTransfers,
  onSaveSettings,
  onSaveRuleDocument,
  onSaveRuleVersion,
  onSaveRuleCategory,
  onSaveRuleCriterion,
  onDeleteRuleCriterion,
  onDeleteRuleCriteria,
  onSaveEmulationRecord,
  onSaveEmulationAppeal,
  onSaveEmulationPeriod,
  onSaveEmulationSnapshot,
  onSaveTitleConfig,
  onDeleteTitleConfig,
  onSaveCompetition,
  onSaveCompetitionCriterion,
  onDeleteCompetitionCriterion,
  onSaveCompetitionParticipant,
  onSaveCompetitionScore,
  onSaveCompetitionAward,
  onSaveScoreTransfer,
  onUnifiedImportCommit,
  onLogExport,
}) => {
  const canViewRules = hasPermission(currentUser, 'rules', 'view', customPermissions);
  const canViewEmulation = hasPermission(currentUser, 'emulation', 'view', customPermissions);
  const canCreateRecord = hasPermission(currentUser, 'emulation', 'create', customPermissions);
  const canApproveEmulation = hasPermission(currentUser, 'emulation', 'approve', customPermissions);
  const canExportEmulation = hasPermission(currentUser, 'emulation', 'export', customPermissions);
  const canEditRules = hasPermission(currentUser, 'rules', 'edit', customPermissions);
  const canApproveRules = hasPermission(currentUser, 'rules', 'approve', customPermissions);
  const canExportRules = hasPermission(currentUser, 'rules', 'export', customPermissions);

  const subTabs = useMemo(
    () =>
      (
        [
          { id: 'rules', label: 'Nội quy', icon: FileText, allowed: canViewRules },
          { id: 'violations', label: 'Vi phạm', icon: AlertTriangle, allowed: canViewEmulation },
          { id: 'rankings', label: 'Xếp hạng', icon: Trophy, allowed: canViewEmulation },
          { id: 'competitions', label: 'Phong trào', icon: Sparkles, allowed: canViewEmulation },
        ] as const
      ).filter((t) => t.allowed),
    [canViewRules, canViewEmulation]
  );

  const [activeSubTab, setActiveSubTab] = useState<EmulationSubTabId>(initialSection);

  const effectiveSubTab: EmulationSubTabId = useMemo(() => {
    if (subTabs.some((t) => t.id === activeSubTab)) return activeSubTab;
    return subTabs[0]?.id ?? 'rankings';
  }, [subTabs, activeSubTab]);

  return (
    <div className="space-y-4">
      {subTabs.length > 1 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="glass-pill-tray inline-flex flex-wrap items-center gap-1 p-1 rounded-2xl text-xs font-semibold"
            role="tablist"
            aria-label="Phân mục Xếp hạng & Thi đua"
          >
            {subTabs.map((item) => {
              const Icon = item.icon;
              const isActive = effectiveSubTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  data-testid={`emulation-subtab-${item.id}`}
                  onClick={() => setActiveSubTab(item.id)}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    isActive ? 'glass-pill-tab-active' : 'glass-pill-tab'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {effectiveSubTab === 'rules' && (
        <RulesManagementSection
          currentUser={currentUser}
          schoolName={systemSettings.schoolName}
          academicYear={systemSettings.academicYear}
          validationContext={validationContext}
          ruleDocuments={ruleDocuments}
          ruleVersions={ruleVersions}
          ruleCategories={ruleCategories}
          ruleCriteria={ruleCriteria}
          emulationRecords={emulationRecords}
          canEdit={canEditRules}
          canApprove={canApproveRules}
          canExport={canExportRules}
          onSaveDocument={onSaveRuleDocument}
          onSaveVersion={onSaveRuleVersion}
          onSaveCategory={onSaveRuleCategory}
          onSaveCriterion={onSaveRuleCriterion}
          onDeleteCriterion={onDeleteRuleCriterion}
          onDeleteCriteria={onDeleteRuleCriteria}
          onUnifiedImportCommit={onUnifiedImportCommit}
          onLogExport={onLogExport}
        />
      )}

      {effectiveSubTab === 'violations' && (
        <EmulationRecordingSection
          currentUser={currentUser}
          validationContext={validationContext}
          students={students}
          classes={classes}
          ruleCriteria={ruleCriteria}
          emulationRecords={emulationRecords}
          canCreate={canCreateRecord}
          canApprove={canApproveEmulation}
          canExport={canExportEmulation}
          onSaveRecord={onSaveEmulationRecord}
          onUnifiedImportCommit={onUnifiedImportCommit}
          onLogExport={onLogExport}
        />
      )}

      {effectiveSubTab === 'rankings' && (
        <EmulationScoresRankingsSection
          mode="unified"
          currentUser={currentUser}
          systemSettings={systemSettings}
          students={students}
          classes={classes}
          emulationRecords={emulationRecords}
          emulationAppeals={emulationAppeals}
          emulationPeriods={emulationPeriods}
          emulationSnapshots={emulationSnapshots}
          titleConfigs={emulationTitleConfigs}
          scoreTransfers={scoreTransfers}
          canApprove={canApproveEmulation}
          canExport={canExportEmulation}
          onSaveSettings={onSaveSettings}
          onSaveRecord={onSaveEmulationRecord}
          onSaveAppeal={onSaveEmulationAppeal}
          onSavePeriod={onSaveEmulationPeriod}
          onSaveSnapshot={onSaveEmulationSnapshot}
          onSaveTitleConfig={onSaveTitleConfig}
          onDeleteTitleConfig={onDeleteTitleConfig}
        />
      )}

      {effectiveSubTab === 'competitions' && (
        <CompetitionsSection
          currentUser={currentUser}
          schoolName={systemSettings.schoolName}
          academicYear={systemSettings.academicYear}
          students={students}
          classes={classes}
          competitions={competitions}
          competitionCriteria={competitionCriteria}
          competitionParticipants={competitionParticipants}
          competitionScores={competitionScores}
          competitionAwards={competitionAwards}
          scoreTransfers={scoreTransfers}
          canCreate={canCreateRecord}
          canApprove={canApproveEmulation}
          canExport={canExportEmulation}
          onSaveCompetition={onSaveCompetition}
          onSaveCriterion={onSaveCompetitionCriterion}
          onDeleteCriterion={onDeleteCompetitionCriterion}
          onSaveParticipant={onSaveCompetitionParticipant}
          onSaveScore={onSaveCompetitionScore}
          onSaveAward={onSaveCompetitionAward}
          onSaveTransfer={onSaveScoreTransfer}
          onSaveEmulationRecord={onSaveEmulationRecord}
          emulationRecords={emulationRecords}
        />
      )}
    </div>
  );
};
