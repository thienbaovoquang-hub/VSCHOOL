import React, { useEffect, useMemo, useState } from 'react';
import {
  Shield, Settings, Trash2, CheckCircle2,
  Moon, Sun, Minimize2, ArrowRight, Database, Save,
  Pencil, Download, Upload, Lock, Unlock, Search, AlertTriangle, Plus, X, BookOpen,
  Image as ImageIcon, Play, Pause, RotateCcw, ArrowUp, ArrowDown, Globe, Eye, EyeOff
} from 'lucide-react';
import {
  AuditLogEntry,
  ExportHistoryRecord,
  ImportHistoryRecord,
  ImportModuleKey,
  PermissionMatrix,
  SchoolSlideshowImage,
  SuperAppId,
  SystemFooterConfig,
  SystemSettings,
  SystemWallpaperConfig,
  UserInvite,
  UserProfile,
  UserRole,
} from '../../types';
import { AppWindowShell } from '../shared/AppWindowShell';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { BulkSelectionBar } from '../shared/BulkSelectionBar';
import { LiquidCard } from '../common/LiquidCard';
import { Badge } from '../common/Badge';
import { PermissionsMatrixView } from '../../views/PermissionsMatrixView';
import { ModuleDataActions } from '../importExport/ModuleDataActions';
import { UnifiedManualFormModal } from '../importExport/UnifiedManualFormModal';
import { extractExistingRecordsForModule, type ValidationDbContext } from '../../utils/importExport/validator';
import { resolveCatalogOptions } from '../../utils/catalogs/catalogRegistry';
import { Modal } from '../common/Modal';
import {
  DEFAULT_PERMISSIONS,
  formatUserRolesLabel,
  hasPermission,
  ROLE_DEFINITIONS,
  userHasRole,
} from '../../utils/rbac';
import { validateBackupPayload } from '../../utils/crossAppSync';
import { exportFullBackupJson } from '../../firebase/services';
import {
  areAllVisibleSelected,
  partitionPrefixedKeys,
  pruneStaleSelectedIds,
  toggleSelectAllVisible,
  toggleSelectedId,
} from '../../utils/bulkSelection';
import {
  clampSlideshowInterval,
  compressSlideshowImageFile,
  DEFAULT_SLIDESHOW_IMAGES,
  estimateSlideshowPayloadBytes,
  MAX_SLIDESHOW_TOTAL_BYTES,
  resolveSlideshowConfig,
} from '../../utils/slideshowDefaults';
import {
  compressBrandLogoFile,
  DEFAULT_BRAND_NAME,
  DEFAULT_SYSTEM_BRANDING,
  normalizeBrandName,
  resolveSystemBranding,
} from '../../utils/branding';
import { SystemBrandMark } from '../common/SystemBrandMark';
import {
  DEFAULT_SYSTEM_FOOTER,
  resolveSystemFooter,
  sanitizeSocialUrl,
} from '../../utils/footerConfig';
import {
  clampWallpaperBlur,
  clampWallpaperOverlay,
  compressWallpaperFile,
  DEFAULT_SYSTEM_WALLPAPER,
  findWallpaperPreset,
  isSafeWallpaperUrl,
  resolveSystemWallpaper,
  WALLPAPER_PRESETS,
} from '../../utils/wallpaper';

interface AdministrationAppProps {
  activeTab: string;
  currentUser: UserProfile;
  userAccounts: UserProfile[];
  userInvites?: UserInvite[];
  auditLogs?: AuditLogEntry[];
  importHistory?: ImportHistoryRecord[];
  exportHistory?: ExportHistoryRecord[];
  validationContext?: ValidationDbContext;
  backupDataSnapshot?: Record<string, unknown>;
  legacyMigrationCount?: number;
  systemSettings: SystemSettings;
  darkMode: boolean;
  stats: {
    studentsCount: number;
    teachersCount: number;
    booksCount: number;
    openMaintenanceCount: number;
  };
  onSelectTab: (tabId: string) => void;
  onSaveUserAccount: (user: UserProfile) => Promise<void> | void;
  onDeleteUserAccount: (userId: string) => Promise<void> | void;
  onDeleteUserAccounts?: (userIds: string[]) => Promise<void> | void;
  onDeleteUserInvite?: (inviteId: string) => Promise<void> | void;
  onDeleteUserInvites?: (inviteIds: string[]) => Promise<void> | void;
  onSaveSettings: (settings: SystemSettings) => Promise<void> | void;
  onToggleDarkMode: () => void;
  onClearAllData: () => Promise<void> | void;
  onRestoreBackup: (payload: Record<string, unknown>) => Promise<void> | void;
  onOpenLegacyMigration?: () => void;
  onOpenTargetApp: (appId: SuperAppId, tabId?: string) => void;
  onUnifiedImportCommit?: (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => Promise<void> | void;
  onLogExport?: (record: ExportHistoryRecord) => Promise<void> | void;
  onAppendAuditLog?: (action: string, target: string) => Promise<void> | void;
}

export const AdministrationApp: React.FC<AdministrationAppProps> = ({
  activeTab,
  currentUser,
  userAccounts,
  userInvites = [],
  validationContext,
  backupDataSnapshot,
  legacyMigrationCount = 0,
  systemSettings,
  darkMode,
  stats,
  onSelectTab,
  onSaveUserAccount,
  onDeleteUserAccount,
  onDeleteUserAccounts,
  onDeleteUserInvite,
  onDeleteUserInvites,
  onSaveSettings,
  onToggleDarkMode,
  onClearAllData,
  onRestoreBackup,
  onOpenLegacyMigration,
  onOpenTargetApp,
  onUnifiedImportCommit,
  onLogExport,
}) => {
  const customPermissions = systemSettings.customPermissions || DEFAULT_PERMISSIONS;
  const canEditUsers = hasPermission(currentUser, 'permissions', 'edit', customPermissions);
  const canExportUsers = hasPermission(currentUser, 'permissions', 'export', customPermissions) || canEditUsers;

  const [draftSettings, setDraftSettings] = useState<SystemSettings>(systemSettings);
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [subjectsSaved, setSubjectsSaved] = useState(false);
  const [slideshowSaved, setSlideshowSaved] = useState(false);
  const [slideshowError, setSlideshowError] = useState<string | null>(null);
  const [isProcessingSlides, setIsProcessingSlides] = useState(false);
  const [brandingSaved, setBrandingSaved] = useState(false);
  const [brandingStatusMsg, setBrandingStatusMsg] = useState<string | null>(null);
  const [brandingError, setBrandingError] = useState<string | null>(null);
  const [isProcessingLogo, setIsProcessingLogo] = useState(false);
  const [footerSaved, setFooterSaved] = useState(false);
  const [footerStatusMsg, setFooterStatusMsg] = useState<string | null>(null);
  const [footerError, setFooterError] = useState<string | null>(null);
  const [isProcessingFooterLogo, setIsProcessingFooterLogo] = useState(false);
  const [wallpaperSaved, setWallpaperSaved] = useState(false);
  const [wallpaperStatusMsg, setWallpaperStatusMsg] = useState<string | null>(null);
  const [wallpaperError, setWallpaperError] = useState<string | null>(null);
  const [isProcessingWallpaper, setIsProcessingWallpaper] = useState(false);
  const [customWallpaperUrlInput, setCustomWallpaperUrlInput] = useState('');
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);
  const [backupMessage, setBackupMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // User CRUD state (synced via UnifiedManualFormModal)
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [userSearch, setUserSearch] = useState('');
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [multiRoleUser, setMultiRoleUser] = useState<UserProfile | null>(null);
  const [draftSecondaryRoles, setDraftSecondaryRoles] = useState<UserRole[]>([]);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<UserProfile | null>(null);
  const [selectedUserKeys, setSelectedUserKeys] = useState<string[]>([]);
  const [pendingBulkUserKeys, setPendingBulkUserKeys] = useState<string[] | null>(null);
  const [isBulkDeletingUsers, setIsBulkDeletingUsers] = useState(false);

  const effectiveContext: ValidationDbContext = useMemo(
    () =>
      validationContext ?? {
        userAccounts,
        systemSettings,
      },
    [validationContext, userAccounts, systemSettings]
  );

  const safeCommitImport = async (
    moduleKey: ImportModuleKey,
    entitiesToSave: Record<string, unknown>[],
    historyRecord: ImportHistoryRecord
  ) => {
    if (onUnifiedImportCommit) {
      await onUnifiedImportCommit(moduleKey, entitiesToSave, historyRecord);
    } else {
      for (const item of entitiesToSave) {
        await onSaveUserAccount(item as unknown as UserProfile);
      }
    }
  };

  useEffect(() => {
    setDraftSettings(systemSettings);
  }, [systemSettings]);

  const handleSaveSettingsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSaveSettings(draftSettings);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2500);
  };

  const handleSavePermissionMatrix = async (nextMatrix: PermissionMatrix) => {
    await onSaveSettings({
      ...systemSettings,
      customPermissions: nextMatrix,
    });
  };

  const activeSubjectsCatalog = useMemo(() => {
    if (Array.isArray(draftSettings.subjectsCatalog) && draftSettings.subjectsCatalog.length > 0) {
      return draftSettings.subjectsCatalog;
    }
    return resolveCatalogOptions({
      catalogId: 'teacher_subject',
      runtime: effectiveContext,
    }).map((o) => o.value);
  }, [draftSettings.subjectsCatalog, effectiveContext]);

  const handleAddSubjectCatalog = () => {
    const clean = newSubjectName.trim();
    if (!clean) return;
    if (activeSubjectsCatalog.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setNewSubjectName('');
      return;
    }
    setDraftSettings((prev) => ({
      ...prev,
      subjectsCatalog: [...activeSubjectsCatalog, clean],
    }));
    setNewSubjectName('');
  };

  const handleRemoveSubjectCatalog = (subject: string) => {
    setDraftSettings((prev) => ({
      ...prev,
      subjectsCatalog: activeSubjectsCatalog.filter((s) => s !== subject),
    }));
  };

  const handleSaveSubjectsCatalog = async () => {
    await onSaveSettings({
      ...draftSettings,
      subjectsCatalog: activeSubjectsCatalog,
    });
    setSubjectsSaved(true);
    setTimeout(() => setSubjectsSaved(false), 2500);
  };

  const activeSlideshow = useMemo(
    () => resolveSlideshowConfig(draftSettings),
    [draftSettings]
  );

  const updateDraftSlideshow = (
    updater: (current: ReturnType<typeof resolveSlideshowConfig>) => ReturnType<typeof resolveSlideshowConfig>
  ) => {
    setSlideshowError(null);
    setDraftSettings((prev) => {
      const current = resolveSlideshowConfig(prev);
      return {
        ...prev,
        schoolSlideshow: updater(current),
      };
    });
  };

  const handleUploadSlideshowImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setSlideshowError(null);
    setIsProcessingSlides(true);
    try {
      const files = Array.from(fileList);
      const added: SchoolSlideshowImage[] = [];
      for (let idx = 0; idx < files.length; idx++) {
        const file = files[idx];
        const compressedUrl = await compressSlideshowImageFile(file);
        const baseName = file.name.replace(/\.[^.]+$/, '').trim();
        added.push({
          id: `slide-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
          url: compressedUrl,
          caption: baseName || `Ảnh giới thiệu trường học`,
        });
      }
      const nextImages = [...activeSlideshow.images, ...added];
      if (estimateSlideshowPayloadBytes(nextImages) > MAX_SLIDESHOW_TOTAL_BYTES) {
        setSlideshowError('Tổng dung lượng ảnh slideshow vượt giới hạn đồng bộ (~750KB). Vui lòng xóa bớt hoặc chọn ít ảnh hơn.');
        return;
      }
      updateDraftSlideshow((current) => ({
        ...current,
        images: [...current.images, ...added],
      }));
    } catch (err) {
      setSlideshowError(err instanceof Error ? err.message : 'Không thể xử lý ảnh tải lên.');
    } finally {
      setIsProcessingSlides(false);
      e.target.value = '';
    }
  };

  const handleMoveSlide = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= activeSlideshow.images.length) return;
    updateDraftSlideshow((current) => {
      const next = [...current.images];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return { ...current, images: next };
    });
  };

  const handleSaveSlideshowSettings = async () => {
    setSlideshowError(null);
    if (estimateSlideshowPayloadBytes(activeSlideshow.images) > MAX_SLIDESHOW_TOTAL_BYTES) {
      setSlideshowError('Dung lượng ảnh vượt giới hạn lưu trữ đám mây (~750KB). Vui lòng giảm số lượng ảnh.');
      return;
    }
    await onSaveSettings({
      ...draftSettings,
      schoolSlideshow: {
        ...activeSlideshow,
        intervalSeconds: clampSlideshowInterval(activeSlideshow.intervalSeconds),
      },
    });
    setSlideshowSaved(true);
    setTimeout(() => setSlideshowSaved(false), 2500);
  };

  const activeBranding = useMemo(
    () => ({
      appName:
        typeof draftSettings.systemBranding?.appName === 'string'
          ? draftSettings.systemBranding.appName
          : DEFAULT_BRAND_NAME,
      logoUrl:
        typeof draftSettings.systemBranding?.logoUrl === 'string' &&
        draftSettings.systemBranding.logoUrl.trim().length > 0
          ? draftSettings.systemBranding.logoUrl
          : null,
    }),
    [draftSettings.systemBranding]
  );

  const savedBranding = useMemo(
    () => resolveSystemBranding(systemSettings),
    [systemSettings]
  );

  const hasUnsavedBrandingChanges =
    normalizeBrandName(activeBranding.appName) !== savedBranding.appName ||
    (activeBranding.logoUrl || null) !== (savedBranding.logoUrl || null);

  const handleUploadBrandLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBrandingError(null);
    setBrandingStatusMsg(null);
    setIsProcessingLogo(true);
    try {
      const compressedLogoUrl = await compressBrandLogoFile(file);
      setDraftSettings((prev) => ({
        ...prev,
        systemBranding: {
          appName:
            typeof prev.systemBranding?.appName === 'string'
              ? prev.systemBranding.appName
              : DEFAULT_BRAND_NAME,
          logoUrl: compressedLogoUrl,
        },
      }));
    } catch (err) {
      setBrandingError(err instanceof Error ? err.message : 'Không thể tải logo lên.');
    } finally {
      setIsProcessingLogo(false);
      e.target.value = '';
    }
  };

  const handleRemoveBrandLogo = () => {
    setBrandingError(null);
    setBrandingStatusMsg(null);
    setDraftSettings((prev) => ({
      ...prev,
      systemBranding: {
        appName:
          typeof prev.systemBranding?.appName === 'string'
            ? prev.systemBranding.appName
            : DEFAULT_BRAND_NAME,
        logoUrl: null,
      },
    }));
  };

  const handleSaveBranding = async () => {
    setBrandingError(null);
    setBrandingStatusMsg(null);
    const normalizedBranding = {
      appName: normalizeBrandName(activeBranding.appName),
      logoUrl: activeBranding.logoUrl || null,
    };
    const nextSettings = {
      ...draftSettings,
      systemBranding: normalizedBranding,
    };
    setDraftSettings(nextSettings);
    await onSaveSettings(nextSettings);
    setBrandingStatusMsg('Đã lưu thương hiệu hệ thống thành công!');
    setBrandingSaved(true);
    setTimeout(() => {
      setBrandingSaved(false);
      setBrandingStatusMsg(null);
    }, 2800);
  };

  const handleRestoreDefaultBranding = async () => {
    setBrandingError(null);
    setBrandingStatusMsg(null);
    const nextSettings = {
      ...draftSettings,
      systemBranding: { ...DEFAULT_SYSTEM_BRANDING },
    };
    setDraftSettings(nextSettings);
    await onSaveSettings(nextSettings);
    setBrandingStatusMsg('Đã khôi phục thương hiệu mặc định (VSCHOOL)!');
    setBrandingSaved(true);
    setTimeout(() => {
      setBrandingSaved(false);
      setBrandingStatusMsg(null);
    }, 2800);
  };

  const savedFooter = useMemo(
    () => resolveSystemFooter(systemSettings),
    [systemSettings]
  );

  const footerDraft: SystemFooterConfig = useMemo(() => {
    const raw = draftSettings.systemFooter;
    const fallback = resolveSystemFooter({
      ...draftSettings,
      systemFooter: undefined,
    });
    if (!raw) return fallback;
    return {
      visible: typeof raw.visible === 'boolean' ? raw.visible : fallback.visible,
      title: typeof raw.title === 'string' ? raw.title : fallback.title,
      description: typeof raw.description === 'string' ? raw.description : fallback.description,
      logoUrl: typeof raw.logoUrl === 'string' && raw.logoUrl.trim().length > 0 ? raw.logoUrl : null,
      contactEmail: typeof raw.contactEmail === 'string' ? raw.contactEmail : fallback.contactEmail,
      contactPhone: typeof raw.contactPhone === 'string' ? raw.contactPhone : fallback.contactPhone,
      contactAddress:
        typeof raw.contactAddress === 'string' ? raw.contactAddress : fallback.contactAddress,
      copyright: typeof raw.copyright === 'string' ? raw.copyright : fallback.copyright,
      ownershipStatement:
        typeof raw.ownershipStatement === 'string'
          ? raw.ownershipStatement
          : fallback.ownershipStatement,
      facebookUrl: typeof raw.facebookUrl === 'string' ? raw.facebookUrl : fallback.facebookUrl,
      instagramUrl: typeof raw.instagramUrl === 'string' ? raw.instagramUrl : fallback.instagramUrl,
    };
  }, [draftSettings]);

  const normalizedDraftFooter = useMemo(
    () =>
      resolveSystemFooter({
        ...draftSettings,
        systemFooter: footerDraft,
      }),
    [draftSettings, footerDraft]
  );

  const hasUnsavedFooterChanges =
    normalizedDraftFooter.visible !== savedFooter.visible ||
    normalizedDraftFooter.title !== savedFooter.title ||
    normalizedDraftFooter.description !== savedFooter.description ||
    (normalizedDraftFooter.logoUrl || null) !== (savedFooter.logoUrl || null) ||
    (normalizedDraftFooter.contactEmail || '') !== (savedFooter.contactEmail || '') ||
    (normalizedDraftFooter.contactPhone || '') !== (savedFooter.contactPhone || '') ||
    (normalizedDraftFooter.contactAddress || '') !== (savedFooter.contactAddress || '') ||
    normalizedDraftFooter.copyright !== savedFooter.copyright ||
    (normalizedDraftFooter.ownershipStatement || '') !== (savedFooter.ownershipStatement || '') ||
    (normalizedDraftFooter.facebookUrl || '') !== (savedFooter.facebookUrl || '') ||
    (normalizedDraftFooter.instagramUrl || '') !== (savedFooter.instagramUrl || '');

  const updateFooterDraft = (patch: Partial<SystemFooterConfig>) => {
    setFooterStatusMsg(null);
    setFooterError(null);
    setDraftSettings((prev) => {
      const fallback = resolveSystemFooter({
        ...prev,
        systemFooter: undefined,
      });
      const raw = prev.systemFooter;
      const current: SystemFooterConfig = raw
        ? {
            visible: typeof raw.visible === 'boolean' ? raw.visible : fallback.visible,
            title: typeof raw.title === 'string' ? raw.title : fallback.title,
            description: typeof raw.description === 'string' ? raw.description : fallback.description,
            logoUrl:
              typeof raw.logoUrl === 'string' && raw.logoUrl.trim().length > 0
                ? raw.logoUrl
                : null,
            contactEmail:
              typeof raw.contactEmail === 'string' ? raw.contactEmail : fallback.contactEmail,
            contactPhone:
              typeof raw.contactPhone === 'string' ? raw.contactPhone : fallback.contactPhone,
            contactAddress:
              typeof raw.contactAddress === 'string' ? raw.contactAddress : fallback.contactAddress,
            copyright: typeof raw.copyright === 'string' ? raw.copyright : fallback.copyright,
            ownershipStatement:
              typeof raw.ownershipStatement === 'string'
                ? raw.ownershipStatement
                : fallback.ownershipStatement,
            facebookUrl:
              typeof raw.facebookUrl === 'string' ? raw.facebookUrl : fallback.facebookUrl,
            instagramUrl:
              typeof raw.instagramUrl === 'string' ? raw.instagramUrl : fallback.instagramUrl,
          }
        : fallback;
      return {
        ...prev,
        systemFooter: {
          ...current,
          ...patch,
        },
      };
    });
  };

  const handleUploadFooterLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFooterError(null);
    setFooterStatusMsg(null);
    setIsProcessingFooterLogo(true);
    try {
      const compressedLogoUrl = await compressBrandLogoFile(file);
      updateFooterDraft({ logoUrl: compressedLogoUrl });
    } catch (err) {
      setFooterError(err instanceof Error ? err.message : 'Không thể tải logo chân trang lên.');
    } finally {
      setIsProcessingFooterLogo(false);
      e.target.value = '';
    }
  };

  const handleSaveFooter = async () => {
    setFooterStatusMsg(null);
    setFooterError(null);
    const normalized = resolveSystemFooter({
      ...draftSettings,
      systemFooter: footerDraft,
    });
    const nextSettings: SystemSettings = {
      ...draftSettings,
      systemFooter: {
        ...normalized,
        facebookUrl: sanitizeSocialUrl(normalized.facebookUrl),
        instagramUrl: sanitizeSocialUrl(normalized.instagramUrl),
      },
    };
    setDraftSettings(nextSettings);
    await onSaveSettings(nextSettings);
    setFooterStatusMsg('Đã lưu cấu hình chân trang thành công!');
    setFooterSaved(true);
    setTimeout(() => {
      setFooterSaved(false);
      setFooterStatusMsg(null);
    }, 2800);
  };

  const handleRestoreDefaultFooter = async () => {
    setFooterStatusMsg(null);
    setFooterError(null);
    const brandTitle = normalizeBrandName(savedBranding.appName);
    const defaultForBrand: SystemFooterConfig = {
      ...DEFAULT_SYSTEM_FOOTER,
      title: brandTitle,
      logoUrl: null,
      copyright: `© 2026 ${brandTitle}. Bảo lưu mọi quyền.`,
      ownershipStatement: `Phát triển bởi Đội ngũ Công nghệ Giáo dục ${brandTitle}`,
    };
    const nextSettings: SystemSettings = {
      ...draftSettings,
      systemFooter: defaultForBrand,
    };
    setDraftSettings(nextSettings);
    await onSaveSettings(nextSettings);
    setFooterStatusMsg('Đã khôi phục cấu hình chân trang mặc định!');
    setFooterSaved(true);
    setTimeout(() => {
      setFooterSaved(false);
      setFooterStatusMsg(null);
    }, 2800);
  };

  const activeWallpaper = useMemo(
    () => resolveSystemWallpaper(draftSettings),
    [draftSettings]
  );

  const savedWallpaper = useMemo(
    () => resolveSystemWallpaper(systemSettings),
    [systemSettings]
  );

  const hasUnsavedWallpaperChanges =
    activeWallpaper.mode !== savedWallpaper.mode ||
    (activeWallpaper.presetId || null) !== (savedWallpaper.presetId || null) ||
    (activeWallpaper.imageUrl || null) !== (savedWallpaper.imageUrl || null) ||
    activeWallpaper.blurPx !== savedWallpaper.blurPx ||
    activeWallpaper.overlayOpacity !== savedWallpaper.overlayOpacity;

  const updateDraftWallpaper = (patch: Partial<SystemWallpaperConfig>) => {
    setWallpaperError(null);
    setWallpaperStatusMsg(null);
    setDraftSettings((prev) => {
      const current = resolveSystemWallpaper(prev);
      return {
        ...prev,
        systemWallpaper: resolveSystemWallpaper({
          ...prev,
          systemWallpaper: {
            ...current,
            ...patch,
          },
        }),
      };
    });
  };

  const handleSelectWallpaperPreset = (presetId: string) => {
    const preset = findWallpaperPreset(presetId);
    if (!preset) return;
    setWallpaperError(null);
    setWallpaperStatusMsg(null);
    setDraftSettings((prev) => {
      const current = resolveSystemWallpaper(prev);
      return {
        ...prev,
        systemWallpaper: {
          mode: preset.mode,
          presetId: preset.id,
          imageUrl: preset.imageUrl || null,
          blurPx: current.blurPx,
          overlayOpacity: current.overlayOpacity,
        },
      };
    });
  };

  const handleUploadWallpaperFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setWallpaperError(null);
    setWallpaperStatusMsg(null);
    setIsProcessingWallpaper(true);
    try {
      const compressedUrl = await compressWallpaperFile(file);
      updateDraftWallpaper({
        mode: 'image',
        presetId: null,
        imageUrl: compressedUrl,
      });
    } catch (err) {
      setWallpaperError(err instanceof Error ? err.message : 'Không thể tải hình nền lên.');
    } finally {
      setIsProcessingWallpaper(false);
      e.target.value = '';
    }
  };

  const handleApplyCustomWallpaperUrl = () => {
    const trimmed = customWallpaperUrlInput.trim();
    if (!trimmed) {
      setWallpaperError('Vui lòng nhập đường dẫn hình ảnh (https://... hoặc /images/...).');
      return;
    }
    if (!isSafeWallpaperUrl(trimmed)) {
      setWallpaperError('Đường dẫn hình ảnh không hợp lệ hoặc không được hỗ trợ.');
      return;
    }
    updateDraftWallpaper({
      mode: 'image',
      presetId: null,
      imageUrl: trimmed,
    });
    setCustomWallpaperUrlInput('');
  };

  const handleSaveWallpaper = async () => {
    setWallpaperError(null);
    setWallpaperStatusMsg(null);
    const normalized = resolveSystemWallpaper({
      ...draftSettings,
      systemWallpaper: activeWallpaper,
    });
    const nextSettings: SystemSettings = {
      ...draftSettings,
      systemWallpaper: normalized,
    };
    setDraftSettings(nextSettings);
    await onSaveSettings(nextSettings);
    setWallpaperStatusMsg('Đã lưu hình nền trang web thành công!');
    setWallpaperSaved(true);
    setTimeout(() => {
      setWallpaperSaved(false);
      setWallpaperStatusMsg(null);
    }, 2800);
  };

  const handleRestoreDefaultWallpaper = async () => {
    setWallpaperError(null);
    setWallpaperStatusMsg(null);
    setCustomWallpaperUrlInput('');
    const nextSettings: SystemSettings = {
      ...draftSettings,
      systemWallpaper: { ...DEFAULT_SYSTEM_WALLPAPER },
    };
    setDraftSettings(nextSettings);
    await onSaveSettings(nextSettings);
    setWallpaperStatusMsg('Đã khôi phục hình nền Aurora mặc định!');
    setWallpaperSaved(true);
    setTimeout(() => {
      setWallpaperSaved(false);
      setWallpaperStatusMsg(null);
    }, 2800);
  };

  const openEditUser = (user: UserProfile) => {
    setEditingUser(user);
  };

  const handleExportJsonBackup = () => {
    const json = exportFullBackupJson({
      settings: systemSettings,
      data: backupDataSnapshot || {},
    });
    const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SchoolHub_Cloud_Backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setBackupMessage({ type: 'ok', text: 'Đã xuất tệp sao lưu dữ liệu Cloud trực tuyến (.json).' });
  };

  const handleImportJsonBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as unknown;
      const validation = validateBackupPayload(parsed);
      if (!validation.valid) {
        setBackupMessage({ type: 'err', text: validation.error || 'Tệp sao lưu không hợp lệ.' });
        return;
      }
      await onRestoreBackup(parsed as Record<string, unknown>);
      setBackupMessage({
        type: 'ok',
        text: `Đã khôi phục và đồng bộ lên Firestore ${validation.collectionsCount} phân hệ dữ liệu.`,
      });
    } catch {
      setBackupMessage({ type: 'err', text: 'Không thể đọc tệp JSON hoặc không đủ quyền ghi lên Firestore.' });
    } finally {
      e.target.value = '';
    }
  };

  // Merge active Firestore userAccounts with pre-provisioned unclaimed userInvites
  const combinedUsers = useMemo(() => {
    const map = new Map<string, { user: UserProfile; isInvitePending: boolean; inviteId?: string }>();
    const seenIds = new Set<string>();
    userAccounts.forEach((u) => {
      const key = u.email.toLowerCase() || u.id;
      if (u.id && seenIds.has(u.id)) return;
      if (u.id) seenIds.add(u.id);
      map.set(key, { user: u, isInvitePending: false });
    });
    userInvites.forEach((inv) => {
      if (inv.claimedByUid) return;
      const key = inv.emailLower || inv.email.toLowerCase();
      if (!map.has(key) && (!inv.id || !seenIds.has(inv.id))) {
        if (inv.id) seenIds.add(inv.id);
        map.set(key, {
          user: {
            id: inv.id,
            email: inv.email,
            displayName: inv.displayName,
            role: inv.role,
            secondaryRoles: inv.secondaryRoles,
            status: inv.status,
            schoolId: inv.schoolId,
            assignedClasses: inv.assignedClasses,
            assignedSubjects: inv.assignedSubjects,
            className: inv.className,
            grade: inv.grade,
            phone: inv.phone,
            studentCode: inv.studentCode,
            teacherCode: inv.teacherCode,
            linkedProfileId: inv.linkedProfileId,
            createdAt: inv.createdAt,
            updatedAt: inv.updatedAt,
          },
          isInvitePending: true,
          inviteId: inv.id,
        });
      }
    });
    return Array.from(map.values()).filter(({ user }) => {
      const matchRole = roleFilter === 'all' || userHasRole(user, roleFilter);
      const q = userSearch.trim().toLowerCase();
      const matchSearch =
        !q ||
        user.displayName.toLowerCase().includes(q) ||
        user.email.toLowerCase().includes(q) ||
        (user.className || '').toLowerCase().includes(q);
      return matchRole && matchSearch;
    });
  }, [userAccounts, userInvites, roleFilter, userSearch]);

  const selectableUserKeys = useMemo(() => {
    const keys: string[] = [];
    userAccounts.forEach((u) => {
      if (u.id && u.id !== currentUser.id) keys.push(`user:${u.id}`);
    });
    userInvites.forEach((inv) => {
      if (!inv.claimedByUid && inv.id) keys.push(`invite:${inv.id}`);
    });
    return keys;
  }, [userAccounts, userInvites, currentUser.id]);

  const effectiveSelectedUserKeys = useMemo(
    () => pruneStaleSelectedIds(selectedUserKeys, selectableUserKeys),
    [selectedUserKeys, selectableUserKeys]
  );

  const visibleSelectableUserKeys = useMemo(
    () =>
      combinedUsers
        .filter(({ user: persona }) => persona.id !== currentUser.id)
        .map(({ user: persona, isInvitePending, inviteId }) =>
          isInvitePending && inviteId ? `invite:${inviteId}` : `user:${persona.id}`
        ),
    [combinedUsers, currentUser.id]
  );

  const handleConfirmBulkDeleteUsers = async () => {
    if (!pendingBulkUserKeys || pendingBulkUserKeys.length === 0) return;
    setIsBulkDeletingUsers(true);
    try {
      const { primaryIds: userIds, secondaryIds: inviteIds } = partitionPrefixedKeys(
        pendingBulkUserKeys,
        'user:',
        'invite:'
      );
      const safeUserIds = userIds.filter((id) => id !== currentUser.id);
      if (safeUserIds.length > 0) {
        if (onDeleteUserAccounts) {
          await onDeleteUserAccounts(safeUserIds);
        } else {
          for (const id of safeUserIds) await onDeleteUserAccount(id);
        }
      }
      if (inviteIds.length > 0) {
        if (onDeleteUserInvites) {
          await onDeleteUserInvites(inviteIds);
        } else if (onDeleteUserInvite) {
          for (const id of inviteIds) await onDeleteUserInvite(id);
        }
      }
      const deletedSet = new Set(pendingBulkUserKeys);
      setSelectedUserKeys((prev) => prev.filter((k) => !deletedSet.has(k)));
    } finally {
      setIsBulkDeletingUsers(false);
      setPendingBulkUserKeys(null);
    }
  };

  return (
    <AppWindowShell
      appId="admin"
      activeTab={activeTab}
      userRole={currentUser.role}
      userProfile={currentUser}
      customPermissions={customPermissions}
      onSelectTab={onSelectTab}
    >
      {(tabId) => (
        <>
          {tabId === 'overview' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                {[
                  { label: 'Hồ sơ Học sinh', value: stats.studentsCount, app: 'school' as SuperAppId, tab: 'students-classes', tint: 'from-sky-500/15 to-cyan-500/5 text-sky-600 dark:text-sky-400' },
                  { label: 'Nhân sự & GV', value: stats.teachersCount, app: 'school' as SuperAppId, tab: 'staff-hr', tint: 'from-indigo-500/15 to-violet-500/5 text-indigo-600 dark:text-indigo-400' },
                  { label: 'Đầu sách Thư viện', value: stats.booksCount, app: 'library' as SuperAppId, tab: 'catalog', tint: 'from-emerald-500/15 to-teal-500/5 text-emerald-600 dark:text-emerald-400' },
                  { label: 'Phiếu bảo trì mở', value: stats.openMaintenanceCount, app: 'facilities' as SuperAppId, tab: 'maintenance', tint: 'from-amber-500/15 to-orange-500/5 text-amber-600 dark:text-amber-400' },
                ].map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    onClick={() => onOpenTargetApp(item.app, item.tab)}
                    className="liquid-glass-panel rounded-2xl p-4 text-left hover:-translate-y-0.5 transition-transform cursor-pointer group"
                  >
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {item.label}
                    </p>
                    <p className="font-mono-tabular text-2xl font-extrabold text-slate-900 dark:text-slate-100 mt-1">
                      {item.value}
                    </p>
                    <span className={`mt-2 inline-flex items-center gap-1 text-[11px] font-semibold ${item.tint.split(' ').slice(2).join(' ')}`}>
                      Mở phân hệ <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                    </span>
                  </button>
                ))}
              </div>

              <LiquidCard className="p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                    <Shield className="w-4 h-4 text-sky-500" />
                    Phiên làm việc hiện tại
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                    {systemSettings.academicYear}
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                  <div className="glass-subsurface rounded-xl p-3 text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400 dark:text-slate-400 block text-[11px]">Người dùng</span>
                    <strong className="text-slate-900 dark:text-slate-100 mt-0.5 block">{currentUser.displayName}</strong>
                  </div>
                  <div className="glass-subsurface rounded-xl p-3 text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400 dark:text-slate-400 block text-[11px]">Email</span>
                    <span className="font-mono-tabular font-semibold text-slate-900 dark:text-slate-100 mt-0.5 block truncate">{currentUser.email}</span>
                  </div>
                  <div className="glass-subsurface rounded-xl p-3 text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400 dark:text-slate-400 block text-[11px]">Trường học</span>
                    <span className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 block">{systemSettings.schoolName}</span>
                  </div>
                  <div className="glass-subsurface rounded-xl p-3 text-slate-600 dark:text-slate-300">
                    <span className="text-slate-400 dark:text-slate-400 block text-[11px]">Tài khoản trong hệ thống</span>
                    <span className="font-mono-tabular font-bold text-slate-900 dark:text-slate-100 mt-0.5 block">{combinedUsers.length} tài khoản</span>
                  </div>
                </div>
                <div className="pt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectTab('users')}
                    className="px-3.5 py-2 rounded-xl glass-subsurface text-sky-700 dark:text-sky-300 text-xs font-semibold hover:bg-sky-500/15 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                  >
                    Quản lý Người dùng ({combinedUsers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectTab('permissions')}
                    className="px-3.5 py-2 rounded-xl glass-subsurface text-indigo-700 dark:text-indigo-300 text-xs font-semibold hover:bg-indigo-500/15 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                  >
                    Ma trận Phân quyền
                  </button>
                  <button
                    type="button"
                    onClick={() => onOpenTargetApp('analytics', 'data')}
                    className="px-3.5 py-2 rounded-xl glass-subsurface text-emerald-700 dark:text-emerald-300 text-xs font-semibold hover:bg-emerald-500/15 inline-flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                  >
                    <Database className="w-3.5 h-3.5" />
                    Trung tâm Dữ liệu
                  </button>
                </div>
              </LiquidCard>
            </div>
          )}

          {tabId === 'users' && (
            <div className="space-y-4">
              <div className="liquid-glass-panel rounded-2xl p-2.5 flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                <div className="flex flex-wrap items-center gap-2 flex-1 min-w-0">
                  <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Tìm tên, email hoặc lớp phụ trách..."
                      className="w-full glass-subsurface rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
                    />
                  </div>
                  <select
                    value={roleFilter}
                    onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
                    className="glass-subsurface rounded-xl px-3 py-1.5 text-xs font-semibold text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
                  >
                    <option value="all">Tất cả 8 vai trò</option>
                    {(Object.keys(ROLE_DEFINITIONS) as UserRole[]).map((r) => (
                      <option key={r} value={r}>
                        {ROLE_DEFINITIONS[r].label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <ModuleDataActions
                    moduleKey="users"
                    context={effectiveContext}
                    currentUser={currentUser}
                    allRecords={combinedUsers.map((c) => c.user as unknown as Record<string, unknown>)}
                    filteredRecords={combinedUsers.map((c) => c.user as unknown as Record<string, unknown>)}
                    canCreate={canEditUsers}
                    canImport={canEditUsers}
                    canExport={canExportUsers}
                    createLabel="Thêm Tài khoản"
                    onManualSave={async (entity) => {
                      await onSaveUserAccount(entity as unknown as UserProfile);
                    }}
                    onCommitImport={safeCommitImport}
                    onLogExport={onLogExport}
                  />
                </div>
              </div>

              <BulkSelectionBar
                totalVisibleCount={visibleSelectableUserKeys.length}
                selectedCount={effectiveSelectedUserKeys.length}
                allVisibleSelected={areAllVisibleSelected(effectiveSelectedUserKeys, visibleSelectableUserKeys)}
                canDelete={canEditUsers}
                entityLabel="tài khoản"
                showSelectAll={false}
                isDeleting={isBulkDeletingUsers}
                testIdPrefix="users-bulk"
                onToggleSelectAll={() =>
                  setSelectedUserKeys((prev) => toggleSelectAllVisible(prev, visibleSelectableUserKeys))
                }
                onClearSelection={() => setSelectedUserKeys([])}
                onRequestBulkDelete={() => setPendingBulkUserKeys(effectiveSelectedUserKeys)}
              />

              <div className="glass-table-shell">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="glass-table-head">
                      <tr>
                        {canEditUsers && (
                          <th className="pl-4 pr-2 py-3 w-8">
                            <input
                              type="checkbox"
                              disabled={visibleSelectableUserKeys.length === 0}
                              checked={areAllVisibleSelected(effectiveSelectedUserKeys, visibleSelectableUserKeys)}
                              onChange={() =>
                                setSelectedUserKeys((prev) => toggleSelectAllVisible(prev, visibleSelectableUserKeys))
                              }
                              aria-label="Chọn tất cả tài khoản đang hiển thị"
                              className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500 cursor-pointer disabled:opacity-40"
                            />
                          </th>
                        )}
                        <th className="px-4 py-3">Tài khoản</th>
                        <th className="px-4 py-3">Email</th>
                        <th className="px-4 py-3">Vai trò</th>
                        <th className="px-4 py-3">Trạng thái</th>
                        <th className="px-4 py-3 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {combinedUsers.map(({ user: persona, isInvitePending, inviteId }) => {
                        const isCurrent = currentUser.id === persona.id;
                        const rowKey = isInvitePending && inviteId ? `invite:${inviteId}` : `user:${persona.id}`;
                        const isSelected = !isCurrent && effectiveSelectedUserKeys.includes(rowKey);
                        const def = ROLE_DEFINITIONS[persona.role];
                        const status = persona.status || 'active';
                        return (
                          <tr
                            key={persona.id}
                            className={`glass-table-row ${
                              isSelected ? 'bg-sky-500/12 dark:bg-sky-400/12' : ''
                            }`}
                          >
                            {canEditUsers && (
                              <td className="pl-4 pr-2 py-3">
                                {!isCurrent ? (
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() =>
                                      setSelectedUserKeys((prev) => toggleSelectedId(prev, rowKey))
                                    }
                                    aria-label={`Chọn tài khoản ${persona.displayName}`}
                                    className="w-3.5 h-3.5 rounded border-slate-300 dark:border-slate-600 text-sky-600 focus:ring-sky-500 cursor-pointer"
                                  />
                                ) : null}
                              </td>
                            )}
                            <td className="px-4 py-3 font-bold text-slate-800 dark:text-slate-100">
                              <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-sky-500 to-indigo-500 text-white font-bold flex items-center justify-center shrink-0">
                                  {(persona.displayName || persona.email || 'U').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p>{persona.displayName}</p>
                                  {(persona.assignedClasses?.length || persona.className) && (
                                    <p className="text-[10px] font-normal text-slate-400">
                                      Lớp: {persona.assignedClasses?.join(', ') || persona.className}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-500 dark:text-slate-400 font-mono-tabular">
                              {persona.email}
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap items-center gap-1">
                                <Badge variant={persona.role === 'admin' ? 'pink' : persona.role === 'student' ? 'blue' : 'aqua'}>
                                  {def?.label || persona.role || 'Thành viên'}
                                </Badge>
                                {(persona.secondaryRoles || []).map((sr) => (
                                  <Badge key={sr} variant="purple" size="sm">
                                    +{ROLE_DEFINITIONS[sr]?.label || sr}
                                  </Badge>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3">
                              <div className="flex flex-wrap items-center gap-1">
                                <Badge
                                  variant={status === 'active' ? 'mint' : status === 'locked' ? 'amber' : 'gray'}
                                  size="sm"
                                >
                                  {status === 'active' ? 'Hoạt động' : status === 'locked' ? 'Tạm khóa' : 'Vô hiệu hóa'}
                                </Badge>
                                {isInvitePending && (
                                  <Badge variant="blue" size="sm">
                                    Chờ kích hoạt Google
                                  </Badge>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                {isCurrent ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Đang đăng nhập
                                  </span>
                                ) : isInvitePending ? (
                                  <span className="text-[11px] text-slate-400 px-2">
                                    Tự kích hoạt khi đăng nhập email
                                  </span>
                                ) : null}

                                {canEditUsers && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setMultiRoleUser(persona);
                                        setDraftSecondaryRoles(persona.secondaryRoles || []);
                                      }}
                                      title="Gán vai trò kiêm nhiệm (Multi-role)"
                                      aria-label={`Vai trò phụ ${persona.displayName}`}
                                      className="p-1.5 rounded-lg text-indigo-600 dark:text-indigo-400 hover:bg-indigo-500/15 cursor-pointer"
                                    >
                                      <Shield className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => openEditUser(persona)}
                                      title="Chỉnh sửa tài khoản"
                                      aria-label={`Chỉnh sửa ${persona.displayName}`}
                                      className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/70 dark:hover:bg-slate-700 cursor-pointer"
                                    >
                                      <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isCurrent}
                                      onClick={() =>
                                        onSaveUserAccount({
                                          ...persona,
                                          status: status === 'active' ? 'locked' : 'active',
                                        })
                                      }
                                      title={status === 'active' ? 'Khóa tài khoản' : 'Mở khóa tài khoản'}
                                      aria-label={status === 'active' ? `Khóa ${persona.displayName}` : `Mở khóa ${persona.displayName}`}
                                      className="p-1.5 rounded-lg text-amber-600 hover:bg-amber-500/15 disabled:opacity-40 cursor-pointer"
                                    >
                                      {status === 'active' ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                                    </button>
                                    {!isCurrent && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          if (isInvitePending && inviteId && onDeleteUserInvite) {
                                            void onDeleteUserInvite(inviteId);
                                          } else {
                                            setPendingDeleteUser(persona);
                                          }
                                        }}
                                        title="Xóa tài khoản"
                                        aria-label={`Xóa ${persona.displayName}`}
                                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-500/15 cursor-pointer"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {editingUser && (
                <UnifiedManualFormModal
                  isOpen={Boolean(editingUser)}
                  moduleKey="users"
                  context={effectiveContext}
                  existingRecords={extractExistingRecordsForModule('users', effectiveContext)}
                  initialValues={editingUser as unknown as Record<string, unknown>}
                  editingRecordId={editingUser.id}
                  currentUser={currentUser}
                  onClose={() => setEditingUser(null)}
                  onSave={async (entity) => {
                    await onSaveUserAccount(entity as unknown as UserProfile);
                    setEditingUser(null);
                  }}
                />
              )}

              <ConfirmDialog
                isOpen={Boolean(pendingDeleteUser)}
                title="Xác nhận xóa tài khoản"
                message={`Bạn có chắc muốn xóa tài khoản "${pendingDeleteUser?.displayName}" (${pendingDeleteUser?.email}) khỏi hệ thống?`}
                confirmLabel="Xóa tài khoản"
                onConfirm={() => {
                  if (pendingDeleteUser) onDeleteUserAccount(pendingDeleteUser.id);
                  setPendingDeleteUser(null);
                }}
                onCancel={() => setPendingDeleteUser(null)}
              />

              <ConfirmDialog
                isOpen={Boolean(pendingBulkUserKeys && pendingBulkUserKeys.length > 0)}
                title="Xác nhận xóa hàng loạt tài khoản"
                message={`Bạn có chắc muốn xóa ${pendingBulkUserKeys?.length || 0} tài khoản / lời mời đã chọn khỏi hệ thống?`}
                confirmLabel={`Xóa ${pendingBulkUserKeys?.length || 0} tài khoản`}
                onConfirm={() => {
                  void handleConfirmBulkDeleteUsers();
                }}
                onCancel={() => setPendingBulkUserKeys(null)}
              />

              <Modal
                isOpen={Boolean(multiRoleUser)}
                onClose={() => setMultiRoleUser(null)}
                title="Cấu hình Vai trò Kiêm nhiệm (Multi-role)"
                description={
                  multiRoleUser
                    ? `Vai trò chính: ${ROLE_DEFINITIONS[multiRoleUser.role].label}. Chọn các vai trò kiêm nhiệm bổ sung.`
                    : ''
                }
                maxWidth="md"
              >
                {multiRoleUser && (
                  <div className="space-y-3 text-xs">
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-300/40 text-amber-800 dark:text-amber-200">
                      <strong>Nguyên tắc bảo mật:</strong> Hồ sơ Tư vấn Tâm lý chỉ mở khi tài khoản có vai trò{' '}
                      <strong>Chuyên viên Tư vấn</strong>. Ban Giám hiệu hay Quản trị viên kỹ thuật không mặc định truy cập dữ liệu tâm lý.
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {(Object.keys(ROLE_DEFINITIONS) as UserRole[])
                        .filter((r) => r !== multiRoleUser.role)
                        .map((r) => {
                          const checked = draftSecondaryRoles.includes(r);
                          return (
                            <label
                              key={r}
                              className={`p-2.5 rounded-xl flex items-start gap-2 cursor-pointer transition-colors ${
                                checked
                                  ? 'glass-subsurface bg-sky-500/15 border-sky-400/60 text-sky-800 dark:text-sky-200'
                                  : 'glass-subsurface text-slate-700 dark:text-slate-200'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setDraftSecondaryRoles((prev) => [...prev, r]);
                                  } else {
                                    setDraftSecondaryRoles((prev) => prev.filter((x) => x !== r));
                                  }
                                }}
                                className="mt-0.5 rounded"
                              />
                              <div>
                                <p className="font-bold">{ROLE_DEFINITIONS[r].label}</p>
                                <p className="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">
                                  {ROLE_DEFINITIONS[r].description}
                                </p>
                              </div>
                            </label>
                          );
                        })}
                    </div>
                    <div className="flex justify-end gap-2 pt-3 border-t border-white/40 dark:border-white/10">
                      <button
                        type="button"
                        onClick={() => setMultiRoleUser(null)}
                        className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer text-slate-700 dark:text-slate-200"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await onSaveUserAccount({
                            ...multiRoleUser,
                            secondaryRoles: draftSecondaryRoles,
                          });
                          setMultiRoleUser(null);
                        }}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-bold shadow-sm cursor-pointer"
                      >
                        Lưu vai trò kiêm nhiệm
                      </button>
                    </div>
                  </div>
                )}
              </Modal>
            </div>
          )}

          {tabId === 'permissions' && (
            <div className="space-y-4">
              <PermissionsMatrixView
                currentUser={currentUser}
                customPermissions={customPermissions}
                onSaveMatrix={handleSavePermissionMatrix}
                extraTopActions={
                  <ModuleDataActions
                    moduleKey="role_assignments"
                    context={effectiveContext}
                    currentUser={currentUser}
                    allRecords={extractExistingRecordsForModule('role_assignments', effectiveContext)}
                    canCreate={canEditUsers}
                    canImport={canEditUsers}
                    canExport={canExportUsers}
                    createLabel="Phân quyền mới"
                    onManualSave={async (entity) => {
                      await onSaveUserAccount(entity as unknown as UserProfile);
                    }}
                    onCommitImport={safeCommitImport}
                    onLogExport={onLogExport}
                  />
                }
              />
            </div>
          )}

          {tabId === 'settings' && (
            <div className="space-y-5 max-w-4xl">
              {/* Hình nền Trang Web (Web Wallpaper) */}
              <LiquidCard className="p-5 space-y-4" data-testid="settings-system-wallpaper">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-sky-500" />
                      Hình nền Trang Web (Web Wallpaper)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Chọn mẫu có sẵn, tải ảnh từ máy hoặc gắn link ảnh làm hình nền toàn trang web cho hiệu ứng kính trong suốt.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <button
                      type="button"
                      data-testid="btn-restore-wallpaper-default"
                      onClick={() => void handleRestoreDefaultWallpaper()}
                      className="px-3 py-1.5 rounded-xl glass-subsurface text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/75 dark:hover:bg-white/10 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Khôi phục mặc định
                    </button>
                    <button
                      type="button"
                      data-testid="btn-save-wallpaper"
                      onClick={() => void handleSaveWallpaper()}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Save className="w-3.5 h-3.5" /> Lưu hình nền
                    </button>
                  </div>
                </div>

                {/* Live Wallpaper Preview */}
                {(() => {
                  const previewPreset = findWallpaperPreset(activeWallpaper.presetId);
                  const previewImage =
                    activeWallpaper.mode === 'image' && isSafeWallpaperUrl(activeWallpaper.imageUrl)
                      ? activeWallpaper.imageUrl!
                      : null;
                  const previewGradient =
                    activeWallpaper.mode === 'preset' && previewPreset?.gradient
                      ? previewPreset.gradient
                      : 'linear-gradient(135deg, #d3e6fc 0%, #dfe8ff 36%, #e7e2fe 68%, #f8dfee 100%)';

                  return (
                    <div
                      data-testid="wallpaper-live-preview"
                      className="relative h-36 rounded-2xl overflow-hidden border border-white/60 dark:border-white/15 flex items-center justify-between px-4 sm:px-6 gap-3"
                      style={{ backgroundImage: previewGradient }}
                    >
                      {previewImage && (
                        <img
                          src={previewImage}
                          alt="Xem trước hình nền"
                          className="absolute inset-0 w-full h-full object-cover transition-all duration-300"
                          style={{
                            filter: activeWallpaper.blurPx > 0 ? `blur(${activeWallpaper.blurPx}px)` : undefined,
                            transform: activeWallpaper.blurPx > 0 ? 'scale(1.06)' : undefined,
                          }}
                        />
                      )}
                      {(previewImage || activeWallpaper.mode === 'preset') && activeWallpaper.overlayOpacity > 0 && (
                        <div
                          className="absolute inset-0"
                          style={{
                            backgroundColor: darkMode
                              ? `rgba(6, 11, 22, ${Math.min(0.8, activeWallpaper.overlayOpacity / 100 + 0.16)})`
                              : `rgba(241, 247, 255, ${activeWallpaper.overlayOpacity / 100})`,
                          }}
                        />
                      )}
                      <div className="relative z-10 liquid-glass-panel rounded-2xl px-4 py-2.5 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white flex items-center justify-center shrink-0">
                          <ImageIcon className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {previewPreset?.label || 'Hình nền tùy chỉnh'}
                          </p>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300">
                            Mờ {activeWallpaper.blurPx}px · Phủ dịu {activeWallpaper.overlayOpacity}%
                          </p>
                        </div>
                      </div>
                      {hasUnsavedWallpaperChanges && (
                        <div className="relative z-10 shrink-0">
                          <Badge variant="amber">Chưa lưu thay đổi</Badge>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Preset Gallery */}
                <div>
                  <span className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">
                    Bộ sưu tập hình nền có sẵn
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
                    {WALLPAPER_PRESETS.map((preset) => {
                      const isSelected =
                        (activeWallpaper.mode === 'aurora' && preset.id === 'aurora') ||
                        activeWallpaper.presetId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          data-testid={`wallpaper-preset-${preset.id}`}
                          onClick={() => handleSelectWallpaperPreset(preset.id)}
                          className={`group rounded-2xl overflow-hidden text-left transition-all cursor-pointer border ${
                            isSelected
                              ? 'border-sky-500 ring-2 ring-sky-400/40 shadow-sm'
                              : 'border-white/55 dark:border-white/15 hover:border-sky-400/70'
                          } glass-subsurface`}
                        >
                          <div
                            className="h-14 w-full relative overflow-hidden"
                            style={preset.gradient ? { backgroundImage: preset.gradient } : undefined}
                          >
                            {preset.imageUrl && (
                              <img
                                src={preset.imageUrl}
                                alt={preset.label}
                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                              />
                            )}
                          </div>
                          <p className="px-2 py-1.5 text-[11px] font-semibold text-slate-800 dark:text-slate-100 truncate">
                            {preset.label}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Upload & Custom URL + Blur / Overlay Sliders */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-2.5">
                    <span className="block font-semibold text-slate-700 dark:text-slate-200">
                      Tải ảnh riêng hoặc nhập URL ảnh
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-3.5 py-2 rounded-xl glass-subsurface text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 hover:bg-white/75 dark:hover:bg-white/10 cursor-pointer">
                        <Upload className="w-3.5 h-3.5 text-sky-600" />
                        <span>
                          {isProcessingWallpaper ? 'Đang tối ưu ảnh...' : 'Tải ảnh từ máy'}
                        </span>
                        <input
                          data-testid="input-wallpaper-file"
                          type="file"
                          accept="image/*"
                          disabled={isProcessingWallpaper}
                          className="hidden"
                          onChange={(e) => void handleUploadWallpaperFile(e)}
                        />
                      </label>

                      {activeWallpaper.mode === 'image' && !activeWallpaper.presetId && (
                        <button
                          type="button"
                          onClick={() => handleSelectWallpaperPreset('aurora')}
                          className="px-3 py-2 rounded-xl glass-subsurface text-rose-600 dark:text-rose-300 font-semibold inline-flex items-center gap-1.5 hover:bg-rose-500/15 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Xóa ảnh tùy chỉnh
                        </button>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        data-testid="input-wallpaper-url"
                        type="url"
                        value={customWallpaperUrlInput}
                        onChange={(e) => setCustomWallpaperUrlInput(e.target.value)}
                        placeholder="Hoặc dán URL ảnh (https://...)..."
                        className="flex-1 min-w-0 glass-subsurface rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
                      />
                      <button
                        type="button"
                        data-testid="btn-apply-wallpaper-url"
                        onClick={handleApplyCustomWallpaperUrl}
                        className="px-3 py-2 rounded-xl glass-subsurface font-semibold text-sky-700 dark:text-sky-300 hover:bg-white/75 dark:hover:bg-white/10 cursor-pointer shrink-0"
                      >
                        Áp dụng
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3 p-3.5 rounded-2xl glass-subsurface">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="wallpaper-blur-range"
                          className="font-semibold text-slate-700 dark:text-slate-200"
                        >
                          Độ mờ hậu cảnh (Blur)
                        </label>
                        <span className="font-mono-tabular font-bold text-sky-700 dark:text-sky-300">
                          {activeWallpaper.blurPx} px
                        </span>
                      </div>
                      <input
                        id="wallpaper-blur-range"
                        data-testid="range-wallpaper-blur"
                        type="range"
                        min={0}
                        max={24}
                        step={1}
                        value={activeWallpaper.blurPx}
                        onChange={(e) =>
                          updateDraftWallpaper({
                            blurPx: clampWallpaperBlur(Number(e.target.value)),
                          })
                        }
                        className="w-full accent-sky-600 cursor-pointer"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label
                          htmlFor="wallpaper-overlay-range"
                          className="font-semibold text-slate-700 dark:text-slate-200"
                        >
                          Lớp phủ dịu bảo vệ chữ
                        </label>
                        <span className="font-mono-tabular font-bold text-sky-700 dark:text-sky-300">
                          {activeWallpaper.overlayOpacity}%
                        </span>
                      </div>
                      <input
                        id="wallpaper-overlay-range"
                        data-testid="range-wallpaper-overlay"
                        type="range"
                        min={0}
                        max={70}
                        step={2}
                        value={activeWallpaper.overlayOpacity}
                        onChange={(e) =>
                          updateDraftWallpaper({
                            overlayOpacity: clampWallpaperOverlay(Number(e.target.value)),
                          })
                        }
                        className="w-full accent-sky-600 cursor-pointer"
                      />
                    </div>
                  </div>
                </div>

                {wallpaperError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {wallpaperError}
                  </p>
                )}

                {wallpaperSaved && wallpaperStatusMsg && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {wallpaperStatusMsg}
                  </p>
                )}
              </LiquidCard>

              {/* Thương hiệu Hệ thống (System Branding) */}
              <LiquidCard className="p-5 space-y-4" data-testid="settings-system-branding">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-rose-500" />
                      Thương hiệu Hệ thống (Tên &amp; Logo ứng dụng)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Tùy chỉnh tên hệ thống và logo hiển thị trên thanh điều hướng, trang chủ và tiêu đề trình duyệt.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <button
                      type="button"
                      data-testid="btn-restore-brand-default"
                      onClick={() => void handleRestoreDefaultBranding()}
                      className="px-3 py-1.5 rounded-xl glass-subsurface text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/75 dark:hover:bg-white/10 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Khôi phục mặc định
                    </button>
                    <button
                      type="button"
                      data-testid="btn-save-branding"
                      onClick={() => void handleSaveBranding()}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Save className="w-3.5 h-3.5" /> Lưu thương hiệu
                    </button>
                  </div>
                </div>

                {/* Live Preview Area */}
                <div className="p-4 rounded-2xl glass-subsurface flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Xem trước trực tiếp
                    </span>
                    <div data-testid="branding-live-preview">
                      <SystemBrandMark
                        branding={{
                          appName: normalizeBrandName(activeBranding.appName),
                          logoUrl: activeBranding.logoUrl,
                        }}
                        size="preview"
                        subtitle="Smart School Ecosystem"
                        showSubtitle
                      />
                    </div>
                  </div>
                  {hasUnsavedBrandingChanges && (
                    <Badge variant="amber">Chưa lưu thay đổi</Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label
                      htmlFor="system-brand-name-input"
                      className="block font-semibold text-slate-700 dark:text-slate-200 mb-1"
                    >
                      Tên hệ thống / Ứng dụng
                    </label>
                    <input
                      id="system-brand-name-input"
                      data-testid="input-brand-name"
                      type="text"
                      maxLength={48}
                      value={activeBranding.appName}
                      placeholder={DEFAULT_BRAND_NAME}
                      onChange={(e) => {
                        const value = e.target.value;
                        setBrandingError(null);
                        setDraftSettings((prev) => ({
                          ...prev,
                          systemBranding: {
                            appName: value,
                            logoUrl: prev.systemBranding?.logoUrl ?? null,
                          },
                        }));
                      }}
                      className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-semibold focus:outline-none focus:ring-2 focus:ring-sky-400/50"
                    />
                  </div>

                  <div>
                    <span className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Logo tùy chỉnh
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-3.5 py-2 rounded-xl glass-subsurface text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 hover:bg-white/75 dark:hover:bg-white/10 cursor-pointer">
                        <Upload className="w-3.5 h-3.5 text-sky-600" />
                        <span>
                          {isProcessingLogo
                            ? 'Đang tối ưu logo...'
                            : activeBranding.logoUrl
                              ? 'Thay đổi logo'
                              : 'Tải lên logo'}
                        </span>
                        <input
                          data-testid="input-brand-logo"
                          type="file"
                          accept="image/*"
                          disabled={isProcessingLogo}
                          className="hidden"
                          onChange={(e) => void handleUploadBrandLogo(e)}
                        />
                      </label>

                      {activeBranding.logoUrl && (
                        <button
                          type="button"
                          data-testid="btn-remove-brand-logo"
                          onClick={handleRemoveBrandLogo}
                          className="px-3 py-2 rounded-xl glass-subsurface text-rose-600 dark:text-rose-300 font-semibold inline-flex items-center gap-1.5 hover:bg-rose-500/15 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Xóa logo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {brandingError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {brandingError}
                  </p>
                )}

                {brandingSaved && brandingStatusMsg && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {brandingStatusMsg}
                  </p>
                )}
              </LiquidCard>

              {/* Chân trang Trang chủ (Website Footer) */}
              <LiquidCard className="p-5 space-y-4" data-testid="settings-system-footer">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-sky-500" />
                      Chân trang Trang chủ (Website Footer)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Hiển thị ở cuối trang chủ theo luồng cuộn tự nhiên. Tùy chỉnh thông tin hệ thống, logo, liên hệ, mạng xã hội và bản quyền.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                    <button
                      type="button"
                      data-testid="btn-restore-footer-default"
                      onClick={() => void handleRestoreDefaultFooter()}
                      className="px-3 py-1.5 rounded-xl glass-subsurface text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-white/75 dark:hover:bg-white/10 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <RotateCcw className="w-3.5 h-3.5" /> Khôi phục mặc định
                    </button>
                    <button
                      type="button"
                      data-testid="btn-save-footer"
                      onClick={() => void handleSaveFooter()}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-sm cursor-pointer whitespace-nowrap shrink-0"
                    >
                      <Save className="w-3.5 h-3.5" /> Lưu chân trang
                    </button>
                  </div>
                </div>

                {/* Visibility Toggle & Unsaved Indicator */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <button
                    type="button"
                    data-testid="btn-toggle-footer-visible"
                    onClick={() => updateFooterDraft({ visible: !footerDraft.visible })}
                    className="px-3.5 py-2.5 rounded-2xl glass-subsurface flex items-center justify-between gap-3 text-xs cursor-pointer sm:min-w-[270px]"
                  >
                    <span className="flex items-center gap-2 font-semibold text-slate-700 dark:text-slate-200">
                      {footerDraft.visible ? (
                        <Eye className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-slate-400" />
                      )}
                      Hiển thị chân trang trên Trang chủ
                    </span>
                    <Badge variant={footerDraft.visible ? 'emerald' : 'gray'}>
                      {footerDraft.visible ? 'Đang bật' : 'Đang ẩn'}
                    </Badge>
                  </button>

                  {hasUnsavedFooterChanges && (
                    <Badge variant="amber">Chưa lưu thay đổi</Badge>
                  )}
                </div>

                {/* Live Multi-Column Footer Preview */}
                <div
                  data-testid="footer-live-preview"
                  className={`rounded-2xl glass-subsurface p-4 space-y-3 text-xs transition-opacity ${
                    footerDraft.visible ? 'opacity-100' : 'opacity-50'
                  }`}
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-1.5 min-w-0">
                      <SystemBrandMark
                        branding={{
                          appName: normalizedDraftFooter.title,
                          logoUrl: normalizedDraftFooter.logoUrl || activeBranding.logoUrl,
                        }}
                        size="sm"
                      />
                      {normalizedDraftFooter.description && (
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
                          {normalizedDraftFooter.description}
                        </p>
                      )}
                    </div>
                    <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400">
                      <p className="font-bold text-slate-700 dark:text-slate-200">Liên kết nhanh</p>
                      <p>Trang chủ · Ứng dụng · Nhà trường · Thông báo</p>
                    </div>
                    <div className="space-y-1 text-[11px] text-slate-500 dark:text-slate-400 min-w-0">
                      <p className="font-bold text-slate-700 dark:text-slate-200">Liên hệ &amp; Mạng xã hội</p>
                      {normalizedDraftFooter.contactEmail && (
                        <p className="truncate">{normalizedDraftFooter.contactEmail}</p>
                      )}
                      {normalizedDraftFooter.contactPhone && (
                        <p className="tabular-nums">{normalizedDraftFooter.contactPhone}</p>
                      )}
                      <div className="flex items-center gap-2 pt-0.5 font-semibold text-slate-600 dark:text-slate-300">
                        {normalizedDraftFooter.facebookUrl && <span>Facebook</span>}
                        {normalizedDraftFooter.instagramUrl && <span>Instagram</span>}
                      </div>
                    </div>
                  </div>
                  <div className="pt-2 border-t border-white/40 dark:border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                    <span>{normalizedDraftFooter.copyright}</span>
                    {normalizedDraftFooter.ownershipStatement && (
                      <span>{normalizedDraftFooter.ownershipStatement}</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label
                      htmlFor="footer-title-input"
                      className="block font-semibold text-slate-700 dark:text-slate-200 mb-1"
                    >
                      Tiêu đề chân trang
                    </label>
                    <input
                      id="footer-title-input"
                      data-testid="input-footer-title"
                      type="text"
                      maxLength={64}
                      value={footerDraft.title}
                      placeholder={normalizeBrandName(activeBranding.appName)}
                      onChange={(e) => updateFooterDraft({ title: e.target.value })}
                      className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-semibold"
                    />
                  </div>

                  <div>
                    <span className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                      Logo chân trang (tuỳ chọn)
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-3.5 py-2 rounded-xl glass-subsurface text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 hover:bg-white/75 dark:hover:bg-white/10 cursor-pointer">
                        <Upload className="w-3.5 h-3.5 text-sky-600" />
                        <span>
                          {isProcessingFooterLogo
                            ? 'Đang xử lý...'
                            : footerDraft.logoUrl
                              ? 'Thay đổi logo riêng'
                              : 'Tải logo riêng'}
                        </span>
                        <input
                          data-testid="input-footer-logo"
                          type="file"
                          accept="image/*"
                          disabled={isProcessingFooterLogo}
                          className="hidden"
                          onChange={(e) => void handleUploadFooterLogo(e)}
                        />
                      </label>

                      {footerDraft.logoUrl && (
                        <button
                          type="button"
                          data-testid="btn-reset-footer-logo"
                          onClick={() => updateFooterDraft({ logoUrl: null })}
                          className="px-3 py-2 rounded-xl glass-subsurface text-slate-700 dark:text-slate-200 font-semibold inline-flex items-center gap-1.5 hover:bg-white/75 dark:hover:bg-white/10 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Dùng logo hệ thống
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="footer-description-input"
                      className="block font-semibold text-slate-700 dark:text-slate-200 mb-1"
                    >
                      Giới thiệu / Mô tả ngắn
                    </label>
                    <input
                      id="footer-description-input"
                      data-testid="input-footer-description"
                      type="text"
                      maxLength={240}
                      value={footerDraft.description}
                      placeholder={DEFAULT_SYSTEM_FOOTER.description}
                      onChange={(e) => updateFooterDraft({ description: e.target.value })}
                      className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="footer-email-input"
                      className="block font-semibold text-slate-700 dark:text-slate-200 mb-1"
                    >
                      Email liên hệ
                    </label>
                    <input
                      id="footer-email-input"
                      data-testid="input-footer-email"
                      type="email"
                      maxLength={100}
                      value={footerDraft.contactEmail || ''}
                      placeholder="lienhe@vschool.edu.vn"
                      onChange={(e) => updateFooterDraft({ contactEmail: e.target.value })}
                      className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="footer-phone-input"
                      className="block font-semibold text-slate-700 dark:text-slate-200 mb-1"
                    >
                      Số điện thoại / Hotline
                    </label>
                    <input
                      id="footer-phone-input"
                      data-testid="input-footer-phone"
                      type="text"
                      maxLength={40}
                      value={footerDraft.contactPhone || ''}
                      placeholder="(028) 3822 1234"
                      onChange={(e) => updateFooterDraft({ contactPhone: e.target.value })}
                      className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-mono-tabular"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="footer-address-input"
                      className="block font-semibold text-slate-700 dark:text-slate-200 mb-1"
                    >
                      Địa chỉ / Thông tin liên hệ bổ sung
                    </label>
                    <input
                      id="footer-address-input"
                      data-testid="input-footer-address"
                      type="text"
                      maxLength={140}
                      value={footerDraft.contactAddress || ''}
                      placeholder={DEFAULT_SYSTEM_FOOTER.contactAddress}
                      onChange={(e) => updateFooterDraft({ contactAddress: e.target.value })}
                      className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="footer-facebook-input"
                      className="block font-semibold text-slate-700 dark:text-slate-200 mb-1"
                    >
                      Đường dẫn Facebook
                    </label>
                    <input
                      id="footer-facebook-input"
                      data-testid="input-footer-facebook"
                      type="url"
                      maxLength={200}
                      value={footerDraft.facebookUrl || ''}
                      placeholder="https://facebook.com/..."
                      onChange={(e) => updateFooterDraft({ facebookUrl: e.target.value })}
                      className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="footer-instagram-input"
                      className="block font-semibold text-slate-700 dark:text-slate-200 mb-1"
                    >
                      Đường dẫn Instagram
                    </label>
                    <input
                      id="footer-instagram-input"
                      data-testid="input-footer-instagram"
                      type="url"
                      maxLength={200}
                      value={footerDraft.instagramUrl || ''}
                      placeholder="https://instagram.com/..."
                      onChange={(e) => updateFooterDraft({ instagramUrl: e.target.value })}
                      className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="footer-copyright-input"
                      className="block font-semibold text-slate-700 dark:text-slate-200 mb-1"
                    >
                      Thông tin bản quyền (Copyright)
                    </label>
                    <input
                      id="footer-copyright-input"
                      data-testid="input-footer-copyright"
                      type="text"
                      maxLength={100}
                      value={footerDraft.copyright}
                      placeholder="© 2026 VSCHOOL. Bảo lưu mọi quyền."
                      onChange={(e) => updateFooterDraft({ copyright: e.target.value })}
                      className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="footer-ownership-input"
                      className="block font-semibold text-slate-700 dark:text-slate-200 mb-1"
                    >
                      Đơn vị phát triển / Sở hữu
                    </label>
                    <input
                      id="footer-ownership-input"
                      data-testid="input-footer-ownership"
                      type="text"
                      maxLength={140}
                      value={footerDraft.ownershipStatement || ''}
                      placeholder="Phát triển bởi Đội ngũ Công nghệ Giáo dục VSCHOOL"
                      onChange={(e) => updateFooterDraft({ ownershipStatement: e.target.value })}
                      className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100"
                    />
                  </div>
                </div>

                {footerError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {footerError}
                  </p>
                )}

                {footerSaved && footerStatusMsg && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> {footerStatusMsg}
                  </p>
                )}
              </LiquidCard>

              <LiquidCard className="p-5">
                <form onSubmit={handleSaveSettingsSubmit} className="space-y-4 text-xs">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Tên Trường học
                      </label>
                      <input
                        type="text"
                        value={draftSettings.schoolName}
                        onChange={(e) => setDraftSettings({ ...draftSettings, schoolName: e.target.value })}
                        className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Năm học mặc định
                      </label>
                      <input
                        type="text"
                        value={draftSettings.academicYear}
                        onChange={(e) => setDraftSettings({ ...draftSettings, academicYear: e.target.value })}
                        className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Số ngày mượn sách mặc định (HS)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={draftSettings.defaultLoanDays}
                        onChange={(e) =>
                          setDraftSettings({ ...draftSettings, defaultLoanDays: Number(e.target.value) || 14 })
                        }
                        className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                        Giới hạn sách mượn tối đa / HS
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={draftSettings.maxBorrowLimit}
                        onChange={(e) =>
                          setDraftSettings({ ...draftSettings, maxBorrowLimit: Number(e.target.value) || 3 })
                        }
                        className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100 font-mono-tabular"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onToggleDarkMode}
                      className="p-3 rounded-2xl glass-subsurface flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                        {darkMode ? <Moon className="w-4 h-4 text-sky-400" /> : <Sun className="w-4 h-4 text-amber-500" />}
                        Chế độ Giao diện
                      </span>
                      <Badge variant={darkMode ? 'purple' : 'amber'}>
                        {darkMode ? 'Tối (Dark)' : 'Sáng (Light)'}
                      </Badge>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setDraftSettings({ ...draftSettings, compactMode: !draftSettings.compactMode })
                      }
                      className="p-3 rounded-2xl glass-subsurface flex items-center justify-between cursor-pointer"
                    >
                      <span className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                        <Minimize2 className="w-4 h-4 text-sky-500" />
                        Mật độ Desktop
                      </span>
                      <Badge variant={draftSettings.compactMode ? 'blue' : 'gray'}>
                        {draftSettings.compactMode ? 'Gọn (Compact)' : 'Tiêu chuẩn'}
                      </Badge>
                    </button>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-white/40 dark:border-white/10">
                    <div>
                      {settingsSaved && (
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle2 className="w-4 h-4" /> Đã lưu cấu hình hệ thống!
                        </span>
                      )}
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-bold shadow-sm flex items-center gap-1.5 cursor-pointer"
                    >
                      <Save className="w-4 h-4" /> Lưu cấu hình
                    </button>
                  </div>
                </form>
              </LiquidCard>

              {/* Danh mục Môn học giảng dạy */}
              <LiquidCard className="p-5 space-y-3" data-testid="settings-subjects-catalog">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <BookOpen className="w-4 h-4 text-teal-600" />
                      Danh mục Môn học giảng dạy ({activeSubjectsCatalog.length})
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Tự động đồng bộ vào dropdown Môn học của các file Excel mẫu (tab DANH_MUC).
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="btn-save-subjects-catalog"
                    onClick={() => void handleSaveSubjectsCatalog()}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" /> Lưu danh mục môn học
                  </button>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <input
                    type="text"
                    value={newSubjectName}
                    onChange={(e) => setNewSubjectName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddSubjectCatalog();
                      }
                    }}
                    placeholder="Nhập tên môn học mới (VD: Giáo dục địa phương)..."
                    className="flex-1 glass-subsurface rounded-xl px-3 py-2 text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    data-testid="btn-add-subject-catalog"
                    onClick={handleAddSubjectCatalog}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white font-semibold inline-flex items-center gap-1 cursor-pointer shadow-sm"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm môn
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 text-xs">
                  {activeSubjectsCatalog.map((subj) => (
                    <div
                      key={subj}
                      className="flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl glass-subsurface"
                    >
                      <span className="truncate font-medium text-slate-800 dark:text-slate-100">{subj}</span>
                      <button
                        type="button"
                        onClick={() => handleRemoveSubjectCatalog(subj)}
                        aria-label={`Xóa môn ${subj}`}
                        className="text-slate-400 hover:text-rose-500 cursor-pointer shrink-0"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                {subjectsSaved && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Đã cập nhật Danh mục Môn học vào hệ thống &amp; các mẫu Excel!
                  </p>
                )}
              </LiquidCard>

              {/* Quản lý Slideshow Giới thiệu Trường học (Trang chủ) */}
              <LiquidCard className="p-5 space-y-4" data-testid="settings-homepage-slideshow">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <ImageIcon className="w-4 h-4 text-sky-500" />
                      Slideshow Giới thiệu Trường học (Trang chủ)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Tải lên nhiều ảnh khuôn viên, bật/tắt tự động phát và thiết lập thời gian chuyển ảnh.
                    </p>
                  </div>
                  <button
                    type="button"
                    data-testid="btn-save-slideshow"
                    onClick={() => void handleSaveSlideshowSettings()}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" /> Lưu Slideshow
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <button
                    type="button"
                    data-testid="btn-toggle-slideshow-autoplay"
                    onClick={() =>
                      updateDraftSlideshow((current) => ({
                        ...current,
                        autoPlay: !current.autoPlay,
                      }))
                    }
                    className="p-3 rounded-2xl glass-subsurface flex items-center justify-between cursor-pointer"
                  >
                    <span className="flex items-center gap-2 font-semibold text-slate-800 dark:text-slate-100">
                      {activeSlideshow.autoPlay ? (
                        <Play className="w-4 h-4 text-emerald-500" />
                      ) : (
                        <Pause className="w-4 h-4 text-slate-400" />
                      )}
                      Tự động chuyển ảnh
                    </span>
                    <Badge variant={activeSlideshow.autoPlay ? 'emerald' : 'gray'}>
                      {activeSlideshow.autoPlay ? 'Đang bật' : 'Đã tắt'}
                    </Badge>
                  </button>

                  <div className="p-3 rounded-2xl glass-subsurface flex items-center justify-between gap-3">
                    <label
                      htmlFor="slideshow-interval-input"
                      className="font-semibold text-slate-800 dark:text-slate-100 shrink-0"
                    >
                      Thời gian chuyển (giây)
                    </label>
                    <input
                      id="slideshow-interval-input"
                      data-testid="input-slideshow-interval"
                      type="number"
                      min={2}
                      max={60}
                      value={activeSlideshow.intervalSeconds}
                      onChange={(e) =>
                        updateDraftSlideshow((current) => ({
                          ...current,
                          intervalSeconds: clampSlideshowInterval(Number(e.target.value)),
                        }))
                      }
                      className="w-20 glass-subsurface rounded-xl px-2.5 py-1 text-right text-slate-900 dark:text-slate-100 font-mono-tabular"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="px-3.5 py-2 rounded-xl glass-subsurface text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 hover:bg-white/75 dark:hover:bg-white/10 cursor-pointer">
                    <Upload className="w-3.5 h-3.5 text-sky-600" />
                    <span>{isProcessingSlides ? 'Đang tối ưu ảnh...' : 'Tải lên nhiều ảnh'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={isProcessingSlides}
                      className="hidden"
                      onChange={(e) => void handleUploadSlideshowImages(e)}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      updateDraftSlideshow((current) => ({
                        ...current,
                        images: DEFAULT_SLIDESHOW_IMAGES,
                      }))
                    }
                    className="px-3 py-1.5 rounded-xl glass-subsurface text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-white/75 dark:hover:bg-white/10 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Khôi phục ảnh mặc định</span>
                  </button>
                </div>

                <div className="space-y-2">
                  {activeSlideshow.images.map((slide, idx) => (
                    <div
                      key={slide.id}
                      className="flex items-center gap-3 p-2 rounded-2xl glass-subsurface"
                    >
                      <img
                        src={slide.url}
                        alt={slide.caption || `Ảnh ${idx + 1}`}
                        className="w-20 h-12 rounded-xl object-cover shrink-0 border border-white/50 dark:border-white/10"
                      />
                      <input
                        type="text"
                        value={slide.caption || ''}
                        placeholder={`Chú thích ảnh ${idx + 1}...`}
                        onChange={(e) => {
                          const value = e.target.value;
                          updateDraftSlideshow((current) => ({
                            ...current,
                            images: current.images.map((item) =>
                              item.id === slide.id ? { ...item, caption: value } : item
                            ),
                          }));
                        }}
                        className="flex-1 min-w-0 glass-subsurface rounded-xl px-2.5 py-1.5 text-xs text-slate-900 dark:text-slate-100"
                      />
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleMoveSlide(idx, -1)}
                          disabled={idx === 0}
                          aria-label="Di chuyển lên"
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-white/60 dark:hover:bg-white/10 disabled:opacity-35 cursor-pointer"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveSlide(idx, 1)}
                          disabled={idx === activeSlideshow.images.length - 1}
                          aria-label="Di chuyển xuống"
                          className="p-1.5 rounded-lg text-slate-500 hover:bg-white/60 dark:hover:bg-white/10 disabled:opacity-35 cursor-pointer"
                        >
                          <ArrowDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateDraftSlideshow((current) => ({
                              ...current,
                              images:
                                current.images.length > 1
                                  ? current.images.filter((item) => item.id !== slide.id)
                                  : current.images,
                            }))
                          }
                          disabled={activeSlideshow.images.length <= 1}
                          aria-label="Xóa ảnh"
                          title={activeSlideshow.images.length <= 1 ? 'Cần giữ ít nhất 1 ảnh' : 'Xóa ảnh'}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 disabled:opacity-35 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {slideshowError && (
                  <p className="text-xs text-rose-600 dark:text-rose-400 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {slideshowError}
                  </p>
                )}

                {slideshowSaved && (
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Đã lưu cấu hình Slideshow Trang chủ!
                  </p>
                )}
              </LiquidCard>

              {/* Full Backup & Restore JSON */}
              <LiquidCard className="p-5 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                      Sao lưu & Khôi phục Dữ liệu Hệ thống (.json)
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Xuất toàn bộ dữ liệu các phân hệ thành tệp JSON chuẩn hóa hoặc khôi phục lại từ bản sao lưu.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={handleExportJsonBackup}
                      className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-sky-500 to-indigo-600 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Download className="w-3.5 h-3.5" /> Xuất Backup JSON
                    </button>
                    <label className="px-3.5 py-2 rounded-xl glass-subsurface text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5 cursor-pointer">
                      <Upload className="w-3.5 h-3.5 text-emerald-600" /> Khôi phục JSON
                      <input type="file" accept=".json,application/json" className="hidden" onChange={handleImportJsonBackup} />
                    </label>
                  </div>
                </div>
                {backupMessage && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                      backupMessage.type === 'ok'
                        ? 'bg-emerald-500/12 text-emerald-700 dark:text-emerald-300'
                        : 'bg-rose-500/12 text-rose-700 dark:text-rose-300'
                    }`}
                  >
                    {backupMessage.type === 'ok' ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{backupMessage.text}</span>
                  </div>
                )}
              </LiquidCard>

              {legacyMigrationCount > 0 && onOpenLegacyMigration && (
                <LiquidCard className="p-5 border-sky-400/40 bg-sky-500/10 dark:bg-sky-500/15">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-sky-800 dark:text-sky-300">
                        Phát hiện dữ liệu cục bộ cũ trên trình duyệt ({legacyMigrationCount} bản ghi)
                      </h3>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">
                        Đồng bộ các bản ghi được tạo trước đây trong trình duyệt này lên Cloud Firestore để các tài khoản và thiết bị khác cùng sử dụng.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onOpenLegacyMigration}
                      className="px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                    >
                      <Database className="w-3.5 h-3.5" /> Chuyển lên Cloud Firestore
                    </button>
                  </div>
                </LiquidCard>
              )}

              <LiquidCard className="p-5 border-rose-200/70 dark:border-rose-900/50">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-rose-700 dark:text-rose-400">
                      Đặt lại Dữ liệu Hệ thống trên Cloud Firestore
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Xóa toàn bộ dữ liệu nghiệp vụ của trường hiện tại trên Cloud Firestore (và dọn bộ nhớ cục bộ cũ) để đưa hệ thống về trạng thái trống sạch.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsClearConfirmOpen(true)}
                    className="px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-1.5 shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Đặt lại hệ thống
                  </button>
                </div>
              </LiquidCard>

              <ConfirmDialog
                isOpen={isClearConfirmOpen}
                title="Đặt lại toàn bộ dữ liệu trường trên Cloud Firestore"
                message="Thao tác này sẽ xóa toàn bộ danh sách học sinh, giáo viên, sách, lịch sử mượn trả và dữ liệu nghiệp vụ trên Cloud Firestore cho tất cả thiết bị thuộc trường này. Bạn có chắc chắn muốn tiếp tục?"
                confirmLabel="Xóa dữ liệu trên Cloud"
                onConfirm={async () => {
                  await onClearAllData();
                  setIsClearConfirmOpen(false);
                }}
                onCancel={() => setIsClearConfirmOpen(false)}
              />
            </div>
          )}
        </>
      )}
    </AppWindowShell>
  );
};
