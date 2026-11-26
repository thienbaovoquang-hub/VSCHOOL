import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Cpu,
  Lightbulb,
  Power,
  ShieldCheck,
  Sliders,
  Thermometer,
  WifiOff,
  Wind,
} from '../icons/UiIcons';
import type {
  AcademicYearConfig,
  FacilityActivityLog,
  FacilitySmartConfig,
  FacilitySmartDeviceState,
  SchoolClass,
  UserProfile,
} from '../../types';
import { LiquidCard } from '../common/LiquidCard';
import { Badge } from '../common/Badge';
import { ConfirmDialog } from '../shared/ConfirmDialog';
import { EmptyState } from '../shared/EmptyState';
import {
  SMART_STATE_LABELS,
  buildDefaultSmartConfigForClass,
  createFacilityActivityLog,
  evaluateSmartEnvironment,
  filterClassesForFacilities,
  getAvailableAcademicYearsForFacilities,
  summarizeSchoolSmartStatus,
} from '../../utils/facilitiesEngine';

interface SmartControlPanelProps {
  currentUser: UserProfile;
  academicYears: AcademicYearConfig[];
  classes: SchoolClass[];
  smartConfigs: FacilitySmartConfig[];
  canManageSmartControl: boolean;
  onSaveSmartConfig: (cfg: FacilitySmartConfig) => Promise<void>;
  onLogFacilityActivity?: (entry: FacilityActivityLog) => Promise<void>;
}

const stateBadgeVariant = (s: FacilitySmartDeviceState): 'mint' | 'gray' | 'pink' | 'amber' => {
  if (s === 'on') return 'mint';
  if (s === 'off') return 'gray';
  if (s === 'offline') return 'pink';
  return 'amber';
};

export const SmartControlPanel: React.FC<SmartControlPanelProps> = ({
  currentUser,
  academicYears,
  classes,
  smartConfigs,
  canManageSmartControl,
  onSaveSmartConfig,
  onLogFacilityActivity,
}) => {
  const availableYears = useMemo(
    () => getAvailableAcademicYearsForFacilities(academicYears, classes, []),
    [academicYears, classes]
  );

  const [selectedYear, setSelectedYear] = useState<string>(availableYears[0] || 'all');
  const [selectedClassId, setSelectedClassId] = useState<string>('');
  const [pendingConfirmAction, setPendingConfirmAction] = useState<{
    title: string;
    message: string;
    nextConfig: FacilitySmartConfig;
    logSummary: string;
  } | null>(null);

  const activeClasses = useMemo(
    () =>
      filterClassesForFacilities({
        classes,
        academicYear: selectedYear,
      }),
    [classes, selectedYear]
  );

  const mergedConfigs = useMemo(() => {
    const byClassId = new Map(smartConfigs.map((c) => [c.classId, c]));
    return activeClasses.map(
      (cls) => byClassId.get(cls.id) || buildDefaultSmartConfigForClass(cls, currentUser.displayName)
    );
  }, [activeClasses, smartConfigs, currentUser.displayName]);

  const schoolStatus = useMemo(
    () => summarizeSchoolSmartStatus(mergedConfigs),
    [mergedConfigs]
  );

  const selectedConfig = useMemo(
    () => mergedConfigs.find((c) => c.classId === selectedClassId) || mergedConfigs[0] || null,
    [mergedConfigs, selectedClassId]
  );

  const [draftConfig, setDraftConfig] = useState<FacilitySmartConfig | null>(selectedConfig);

  useEffect(() => {
    setDraftConfig(selectedConfig);
  }, [selectedConfig]);

  const effectiveConfig = draftConfig && selectedConfig && draftConfig.classId === selectedConfig.classId
    ? draftConfig
    : selectedConfig;

  const evaluation = useMemo(
    () => (effectiveConfig ? evaluateSmartEnvironment(effectiveConfig) : null),
    [effectiveConfig]
  );

  const executeConfirmedUpdate = async (
    nextConfig: FacilitySmartConfig,
    logSummary: string
  ) => {
    const saved: FacilitySmartConfig = {
      ...nextConfig,
      updatedBy: currentUser.displayName,
      updatedAt: new Date().toISOString(),
    };
    await onSaveSmartConfig(saved);
    if (onLogFacilityActivity) {
      await onLogFacilityActivity(
        createFacilityActivityLog({
          logType: 'smart_control',
          summary: logSummary,
          actorName: currentUser.displayName,
          actorRole: currentUser.role,
          classId: saved.classId,
          className: saved.className,
        })
      );
    }
  };

  const requestDeviceToggle = (
    group: 'lights' | 'fans' | 'ac',
    targetState: FacilitySmartDeviceState
  ) => {
    if (!effectiveConfig || !canManageSmartControl) return;
    const labelMap = { lights: 'Đèn chiếu sáng', fans: 'Quạt', ac: 'Điều hòa' };
    const nextConfig: FacilitySmartConfig = {
      ...effectiveConfig,
      deviceStates: {
        ...effectiveConfig.deviceStates,
        [group]: targetState,
      },
    };
    setPendingConfirmAction({
      title: `Xác nhận điều khiển — Lớp ${effectiveConfig.className}`,
      message: `Bạn có chắc muốn chuyển trạng thái "${labelMap[group]}" sang "${SMART_STATE_LABELS[targetState]}"? (${effectiveConfig.sensorMode === 'simulated' ? 'Chế độ mô phỏng / đề xuất' : 'Kết nối IoT'})`,
      nextConfig,
      logSummary: `Điều khiển ${labelMap[group]} lớp ${effectiveConfig.className} → ${SMART_STATE_LABELS[targetState]} (${effectiveConfig.sensorMode === 'simulated' ? 'Mô phỏng' : 'IoT'})`,
    });
  };

  const requestApplyAllSuggestions = () => {
    if (!effectiveConfig || !evaluation || !canManageSmartControl) return;
    const nextStates = { ...effectiveConfig.deviceStates };
    const changedLabels: string[] = [];
    for (const s of evaluation.suggestions) {
      if (s.actionNeeded) {
        nextStates[s.deviceGroup] = s.recommendedState;
        changedLabels.push(`${s.deviceLabel}: ${s.recommendedState === 'on' ? 'Bật' : 'Tắt'}`);
      }
    }
    if (changedLabels.length === 0) return;
    setPendingConfirmAction({
      title: `Áp dụng đề xuất tiết kiệm điện — Lớp ${effectiveConfig.className}`,
      message: `Xác nhận thực hiện: ${changedLabels.join(' · ')}. Giới hạn an toàn nhiệt độ tối đa ${effectiveConfig.safetyMaxTempC}°C.`,
      nextConfig: {
        ...effectiveConfig,
        deviceStates: nextStates,
      },
      logSummary: `Áp dụng đề xuất điều khiển thông minh lớp ${effectiveConfig.className}: ${changedLabels.join('; ')}`,
    });
  };

  const handleSaveThresholds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!effectiveConfig || !canManageSmartControl) return;
    await executeConfirmedUpdate(
      effectiveConfig,
      `Cập nhật ngưỡng cảm biến & lịch hoạt động lớp ${effectiveConfig.className} (${effectiveConfig.scheduleStart}-${effectiveConfig.scheduleEnd})`
    );
  };

  return (
    <div className="space-y-4">
      {/* Honest IoT / Simulation Banner */}
      <div className="px-4 py-3 rounded-2xl bg-amber-500/12 border border-amber-400/35 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-950 dark:text-amber-100">
        <div className="flex items-start gap-2.5">
          <Cpu className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">
              Chế độ mô phỏng & đề xuất vận hành (Chưa kết nối cảm biến/IoT phần cứng thực tế)
            </p>
            <p className="text-[11px] opacity-85 mt-0.5">
              Các thông số nhiệt độ, ánh sáng và lệnh bật/tắt được mô phỏng phục vụ lập lịch và đề xuất tiết kiệm điện; mọi thay đổi trạng thái đều yêu cầu xác nhận và kiểm soát phân quyền quản trị.
            </p>
          </div>
        </div>
        <Badge variant="amber" size="sm">Mô phỏng đề xuất</Badge>
      </div>

      {/* Whole-School Status Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <LiquidCard className="p-3.5">
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Lớp giám sát</span>
          <p className="font-mono-tabular text-2xl font-extrabold text-slate-900 dark:text-white mt-0.5">
            {mergedConfigs.length}
          </p>
        </LiquidCard>
        <LiquidCard className="p-3.5">
          <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">Đang bật</span>
          <p className="font-mono-tabular text-2xl font-extrabold text-emerald-600 dark:text-emerald-300 mt-0.5">
            {schoolStatus.onCount}
          </p>
        </LiquidCard>
        <LiquidCard className="p-3.5">
          <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">Đang tắt</span>
          <p className="font-mono-tabular text-2xl font-extrabold text-slate-700 dark:text-slate-200 mt-0.5">
            {schoolStatus.offCount}
          </p>
        </LiquidCard>
        <LiquidCard className="p-3.5">
          <span className="text-[11px] font-semibold text-rose-700 dark:text-rose-300">Mất kết nối</span>
          <p className="font-mono-tabular text-2xl font-extrabold text-rose-600 dark:text-rose-300 mt-0.5">
            {schoolStatus.offlineCount}
          </p>
        </LiquidCard>
        <LiquidCard className="p-3.5">
          <span className="text-[11px] font-semibold text-amber-700 dark:text-amber-300">Cần kiểm tra</span>
          <p className="font-mono-tabular text-2xl font-extrabold text-amber-600 dark:text-amber-300 mt-0.5">
            {schoolStatus.checkCount}
          </p>
        </LiquidCard>
      </div>

      {/* Year & Class Selector + Whole School Grid */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Năm học điều khiển thông minh"
            value={selectedYear}
            onChange={(e) => setSelectedYear(e.target.value)}
            className="glass-subsurface rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            <option value="all">Tất cả năm học</option>
            {availableYears.map((y) => (
              <option key={y} value={y}>
                Năm học {y}
              </option>
            ))}
          </select>
          <select
            aria-label="Chọn lớp điều khiển"
            value={selectedConfig?.classId || ''}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="glass-subsurface rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 dark:text-slate-100"
          >
            {mergedConfigs.map((cfg) => (
              <option key={cfg.classId} value={cfg.classId}>
                Lớp {cfg.className} ({cfg.roomLocation})
              </option>
            ))}
          </select>
        </div>
        {!canManageSmartControl && (
          <Badge variant="gray" size="sm">
            Chỉ xem (Cần quyền quản trị / nhân viên để điều khiển)
          </Badge>
        )}
      </div>

      {mergedConfigs.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="Chưa có lớp học nào"
          description="Tạo lớp học trong mục Học sinh & Lớp để giám sát trạng thái thiết bị theo lớp."
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4">
          {/* Left: Selected Class Detailed Environment & Control */}
          {effectiveConfig && evaluation && (
            <div className="xl:col-span-7 space-y-4">
              <LiquidCard className="p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
                      Lớp {effectiveConfig.className} — {effectiveConfig.roomLocation}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      Lịch hoạt động: {effectiveConfig.scheduleStart} – {effectiveConfig.scheduleEnd} · {evaluation.modeNotice}
                    </p>
                  </div>
                  <Badge variant={effectiveConfig.sensorMode === 'connected' ? 'mint' : 'amber'} size="sm">
                    {effectiveConfig.sensorMode === 'connected' ? 'IoT đã kết nối' : 'Mô phỏng'}
                  </Badge>
                </div>

                {evaluation.safetyAlerts.length > 0 && (
                  <div className="p-3 rounded-xl bg-rose-500/12 border border-rose-400/35 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>{evaluation.safetyAlerts.join(' ')}</div>
                  </div>
                )}

                {/* Simulated Sensor Values (Adjustable in Simulation Mode to test rules) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 rounded-2xl glass-subsurface space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5">
                        <Thermometer className="w-4 h-4 text-rose-500" /> Nhiệt độ (mô phỏng)
                      </span>
                      <span className="font-mono-tabular text-lg font-extrabold text-slate-900 dark:text-white">
                        {effectiveConfig.temperatureC}°C
                      </span>
                    </div>
                    {canManageSmartControl && (
                      <input
                        type="range"
                        min={18}
                        max={40}
                        step={1}
                        aria-label="Điều chỉnh nhiệt độ mô phỏng"
                        value={effectiveConfig.temperatureC}
                        onChange={(e) => {
                          const nextVal = Number(e.target.value);
                          setDraftConfig((prev) =>
                            prev ? { ...prev, temperatureC: nextVal } : prev
                          );
                        }}
                        onMouseUp={(e) => {
                          const nextVal = Number((e.target as HTMLInputElement).value);
                          void onSaveSmartConfig({
                            ...effectiveConfig,
                            temperatureC: nextVal,
                            updatedBy: currentUser.displayName,
                            updatedAt: new Date().toISOString(),
                          });
                        }}
                        onTouchEnd={(e) => {
                          const nextVal = Number((e.target as HTMLInputElement).value);
                          void onSaveSmartConfig({
                            ...effectiveConfig,
                            temperatureC: nextVal,
                            updatedBy: currentUser.displayName,
                            updatedAt: new Date().toISOString(),
                          });
                        }}
                        className="w-full cursor-pointer"
                      />
                    )}
                  </div>

                  <div className="p-3.5 rounded-2xl glass-subsurface space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 inline-flex items-center gap-1.5">
                        <Lightbulb className="w-4 h-4 text-amber-500" /> Độ sáng (mô phỏng)
                      </span>
                      <span className="font-mono-tabular text-lg font-extrabold text-slate-900 dark:text-white">
                        {effectiveConfig.luxLevel} lux
                      </span>
                    </div>
                    {canManageSmartControl && (
                      <input
                        type="range"
                        min={50}
                        max={800}
                        step={10}
                        aria-label="Điều chỉnh độ sáng mô phỏng"
                        value={effectiveConfig.luxLevel}
                        onChange={(e) => {
                          const nextVal = Number(e.target.value);
                          setDraftConfig((prev) =>
                            prev ? { ...prev, luxLevel: nextVal } : prev
                          );
                        }}
                        onMouseUp={(e) => {
                          const nextVal = Number((e.target as HTMLInputElement).value);
                          void onSaveSmartConfig({
                            ...effectiveConfig,
                            luxLevel: nextVal,
                            updatedBy: currentUser.displayName,
                            updatedAt: new Date().toISOString(),
                          });
                        }}
                        onTouchEnd={(e) => {
                          const nextVal = Number((e.target as HTMLInputElement).value);
                          void onSaveSmartConfig({
                            ...effectiveConfig,
                            luxLevel: nextVal,
                            updatedBy: currentUser.displayName,
                            updatedAt: new Date().toISOString(),
                          });
                        }}
                        className="w-full cursor-pointer"
                      />
                    )}
                  </div>
                </div>

                {/* Device Channels + Rule Suggestions */}
                <div className="space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
                      <Activity className="w-4 h-4 text-teal-600" /> Đề xuất & Điều khiển theo nhóm thiết bị
                    </h4>
                    {canManageSmartControl && evaluation.suggestions.some((s) => s.actionNeeded) && (
                      <button
                        type="button"
                        onClick={requestApplyAllSuggestions}
                        className="px-3 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" /> Áp dụng tất cả đề xuất
                      </button>
                    )}
                  </div>

                  {evaluation.suggestions.map((sug) => {
                    const current = sug.currentState;
                    const Icon =
                      sug.deviceGroup === 'lights'
                        ? Lightbulb
                        : sug.deviceGroup === 'fans'
                        ? Wind
                        : Thermometer;
                    return (
                      <div
                        key={sug.deviceGroup}
                        className="p-3 rounded-2xl glass-subsurface flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 text-xs"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <Icon className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
                            <span className="font-bold text-slate-900 dark:text-white">{sug.deviceLabel}</span>
                            <Badge variant={stateBadgeVariant(current)} size="sm">
                              {SMART_STATE_LABELS[current]}
                            </Badge>
                          </div>
                          <p className="text-[11px] text-slate-600 dark:text-slate-300">{sug.reason}</p>
                          {sug.safetyWarning && (
                            <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                              {sug.safetyWarning}
                            </p>
                          )}
                        </div>

                        {canManageSmartControl && (
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              type="button"
                              onClick={() => requestDeviceToggle(sug.deviceGroup, current === 'on' ? 'off' : 'on')}
                              className={`px-3 py-1.5 rounded-xl font-bold text-white inline-flex items-center gap-1 cursor-pointer whitespace-nowrap ${
                                current === 'on'
                                  ? 'bg-slate-600 hover:bg-slate-700'
                                  : 'bg-emerald-600 hover:bg-emerald-700'
                              }`}
                            >
                              <Power className="w-3.5 h-3.5" /> {current === 'on' ? 'Tắt' : 'Bật'}
                            </button>
                            <select
                              aria-label={`Đặt trạng thái ${sug.deviceLabel}`}
                              value={current}
                              onChange={(e) =>
                                requestDeviceToggle(sug.deviceGroup, e.target.value as FacilitySmartDeviceState)
                              }
                              className="glass-subsurface rounded-xl px-2 py-1.5 text-[11px] font-semibold"
                            >
                              <option value="on">Đang bật</option>
                              <option value="off">Đang tắt</option>
                              <option value="offline">Mất kết nối</option>
                              <option value="check">Cần kiểm tra</option>
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </LiquidCard>

              {/* Threshold & Schedule Form */}
              <LiquidCard className="p-4 sm:p-5">
                <form onSubmit={handleSaveThresholds} className="space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-sky-600" /> Ngưỡng tự động & Giới hạn an toàn
                    </h4>
                    <Badge variant="aqua" size="sm">
                      <ShieldCheck className="w-3 h-3" /> Có xác nhận an toàn
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Bật quạt (°C)
                      </label>
                      <input
                        type="number"
                        disabled={!canManageSmartControl}
                        value={effectiveConfig.tempThresholdFan}
                        onChange={(e) =>
                          setDraftConfig((prev) =>
                            prev ? { ...prev, tempThresholdFan: Number(e.target.value) || 0 } : prev
                          )
                        }
                        className="w-full glass-subsurface rounded-xl px-3 py-1.5 font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Bật điều hòa (°C)
                      </label>
                      <input
                        type="number"
                        disabled={!canManageSmartControl}
                        value={effectiveConfig.tempThresholdAC}
                        onChange={(e) =>
                          setDraftConfig((prev) =>
                            prev ? { ...prev, tempThresholdAC: Number(e.target.value) || 0 } : prev
                          )
                        }
                        className="w-full glass-subsurface rounded-xl px-3 py-1.5 font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Ngưỡng đèn (lux)
                      </label>
                      <input
                        type="number"
                        disabled={!canManageSmartControl}
                        value={effectiveConfig.luxThresholdLight}
                        onChange={(e) =>
                          setDraftConfig((prev) =>
                            prev ? { ...prev, luxThresholdLight: Number(e.target.value) || 0 } : prev
                          )
                        }
                        className="w-full glass-subsurface rounded-xl px-3 py-1.5 font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Giờ bắt đầu
                      </label>
                      <input
                        type="time"
                        disabled={!canManageSmartControl}
                        value={effectiveConfig.scheduleStart}
                        onChange={(e) =>
                          setDraftConfig((prev) =>
                            prev ? { ...prev, scheduleStart: e.target.value } : prev
                          )
                        }
                        className="w-full glass-subsurface rounded-xl px-3 py-1.5 font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Giờ kết thúc
                      </label>
                      <input
                        type="time"
                        disabled={!canManageSmartControl}
                        value={effectiveConfig.scheduleEnd}
                        onChange={(e) =>
                          setDraftConfig((prev) =>
                            prev ? { ...prev, scheduleEnd: e.target.value } : prev
                          )
                        }
                        className="w-full glass-subsurface rounded-xl px-3 py-1.5 font-mono-tabular"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 dark:text-slate-300 mb-1">
                        Cảnh báo quá nhiệt (°C)
                      </label>
                      <input
                        type="number"
                        disabled={!canManageSmartControl}
                        value={effectiveConfig.safetyMaxTempC}
                        onChange={(e) =>
                          setDraftConfig((prev) =>
                            prev ? { ...prev, safetyMaxTempC: Number(e.target.value) || 0 } : prev
                          )
                        }
                        className="w-full glass-subsurface rounded-xl px-3 py-1.5 font-mono-tabular"
                      />
                    </div>
                  </div>
                  {canManageSmartControl && (
                    <div className="flex justify-end pt-1">
                      <button
                        type="submit"
                        className="px-4 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold cursor-pointer"
                      >
                        Lưu cấu hình ngưỡng & lịch
                      </button>
                    </div>
                  )}
                </form>
              </LiquidCard>
            </div>
          )}

          {/* Right: Multi-class School Status Grid */}
          <div className="xl:col-span-5">
            <LiquidCard className="p-4 sm:p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  Trạng thái các lớp toàn trường
                </h3>
                <span className="text-[11px] text-slate-500">Chọn lớp để điều khiển</span>
              </div>
              <div className="space-y-2.5 max-h-[560px] overflow-y-auto pr-1">
                {mergedConfigs.map((cfg) => {
                  const isActive = cfg.classId === selectedConfig?.classId;
                  const hasOffline =
                    cfg.deviceStates.lights === 'offline' ||
                    cfg.deviceStates.fans === 'offline' ||
                    cfg.deviceStates.ac === 'offline';
                  return (
                    <button
                      key={cfg.classId}
                      type="button"
                      onClick={() => setSelectedClassId(cfg.classId)}
                      className={`w-full text-left p-3 rounded-2xl transition-all cursor-pointer border ${
                        isActive
                          ? 'bg-sky-500/12 border-sky-500/50 shadow-sm'
                          : 'glass-subsurface border-transparent hover:border-slate-300 dark:hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white text-xs">
                            Lớp {cfg.className}
                          </span>
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 ml-1.5">
                            ({cfg.roomLocation})
                          </span>
                        </div>
                        <span className="font-mono-tabular text-[11px] font-bold text-slate-700 dark:text-slate-200">
                          {cfg.temperatureC}°C · {cfg.luxLevel} lux
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-2">
                        <Badge variant={stateBadgeVariant(cfg.deviceStates.lights)} size="sm">
                          Đèn: {SMART_STATE_LABELS[cfg.deviceStates.lights]}
                        </Badge>
                        <Badge variant={stateBadgeVariant(cfg.deviceStates.fans)} size="sm">
                          Quạt: {SMART_STATE_LABELS[cfg.deviceStates.fans]}
                        </Badge>
                        <Badge variant={stateBadgeVariant(cfg.deviceStates.ac)} size="sm">
                          ĐH: {SMART_STATE_LABELS[cfg.deviceStates.ac]}
                        </Badge>
                        {hasOffline && <WifiOff className="w-3.5 h-3.5 text-rose-500 ml-auto" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </LiquidCard>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(pendingConfirmAction)}
        title={pendingConfirmAction?.title || 'Xác nhận thao tác'}
        message={pendingConfirmAction?.message || ''}
        confirmLabel="Xác nhận thực hiện"
        danger={false}
        onConfirm={() => {
          if (pendingConfirmAction) {
            void executeConfirmedUpdate(
              pendingConfirmAction.nextConfig,
              pendingConfirmAction.logSummary
            );
          }
          setPendingConfirmAction(null);
        }}
        onCancel={() => setPendingConfirmAction(null)}
      />
    </div>
  );
};
