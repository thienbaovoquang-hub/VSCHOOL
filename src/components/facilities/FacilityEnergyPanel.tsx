import React, { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  AlertCircle,
  Gauge,
  Plus,
  Trash2,
  Zap,
} from '../icons/UiIcons';
import type {
  AcademicYearConfig,
  FacilityActivityLog,
  FacilityAsset,
  FacilityMeterReading,
  SchoolClass,
  UserProfile,
} from '../../types';
import { LiquidCard } from '../common/LiquidCard';
import { Badge } from '../common/Badge';
import { Modal } from '../common/Modal';
import { EmptyState } from '../shared/EmptyState';
import {
  DEFAULT_ELECTRICITY_COST_PER_KWH,
  calculateFacilityEnergySummary,
  createFacilityActivityLog,
  filterClassesForFacilities,
  filterFacilitiesByScope,
  getAvailableAcademicYearsForFacilities,
} from '../../utils/facilitiesEngine';

interface FacilityEnergyPanelProps {
  currentUser: UserProfile;
  academicYears: AcademicYearConfig[];
  classes: SchoolClass[];
  facilities: FacilityAsset[];
  meterReadings: FacilityMeterReading[];
  canEdit: boolean;
  onSaveMeterReading: (reading: FacilityMeterReading) => Promise<void>;
  onDeleteMeterReading: (readingId: string) => Promise<void>;
  onLogFacilityActivity?: (entry: FacilityActivityLog) => Promise<void>;
}

type EnergyViewScope = 'class' | 'room' | 'grade' | 'device' | 'school';

export const FacilityEnergyPanel: React.FC<FacilityEnergyPanelProps> = ({
  currentUser,
  academicYears,
  classes,
  facilities,
  meterReadings,
  canEdit,
  onSaveMeterReading,
  onDeleteMeterReading,
  onLogFacilityActivity,
}) => {
  const availableYears = useMemo(
    () => getAvailableAcademicYearsForFacilities(academicYears, classes, facilities),
    [academicYears, classes, facilities]
  );

  const [selectedYear, setSelectedYear] = useState<string>(availableYears[0] || 'all');
  const [viewScope, setViewScope] = useState<EnergyViewScope>('class');
  const [costPerKwh, setCostPerKwh] = useState<number>(DEFAULT_ELECTRICITY_COST_PER_KWH);
  const [isMeterModalOpen, setIsMeterModalOpen] = useState(false);

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const [meterForm, setMeterForm] = useState<{
    scopeType: 'class' | 'room' | 'grade' | 'school';
    scopeId: string;
    scopeName: string;
    periodType: 'day' | 'month';
    periodKey: string;
    measuredKwh: number;
    meterPreviousIndex: string;
    meterCurrentIndex: string;
    notes: string;
  }>({
    scopeType: 'class',
    scopeId: '',
    scopeName: 'Toàn trường',
    periodType: 'month',
    periodKey: currentMonthKey,
    measuredKwh: 0,
    meterPreviousIndex: '',
    meterCurrentIndex: '',
    notes: '',
  });

  const scopedFacilities = useMemo(
    () =>
      filterFacilitiesByScope({
        facilities,
        classes,
        academicYear: selectedYear,
      }),
    [facilities, classes, selectedYear]
  );

  const summary = useMemo(
    () =>
      calculateFacilityEnergySummary({
        facilities: scopedFacilities,
        classes,
        meterReadings,
        costPerKwh,
      }),
    [scopedFacilities, classes, meterReadings, costPerKwh]
  );

  const activeClasses = useMemo(
    () => filterClassesForFacilities({ classes, academicYear: selectedYear }),
    [classes, selectedYear]
  );

  const chartData = useMemo(() => {
    const source =
      viewScope === 'room'
        ? summary.byRoom
        : viewScope === 'grade'
        ? summary.byGrade
        : summary.byClass;
    return source.slice(0, 12).map((b) => ({
      name: b.label,
      uocTinh: b.estimatedMonthlyKwh,
      congTo: b.measuredMonthlyKwh,
      hieuLuc: b.effectiveMonthlyKwh,
      hasMeter: b.hasMeterReading,
    }));
  }, [summary, viewScope]);

  const handleSaveMeter = async (e: React.FormEvent) => {
    e.preventDefault();
    const prevIdx = meterForm.meterPreviousIndex ? Number(meterForm.meterPreviousIndex) : undefined;
    const currIdx = meterForm.meterCurrentIndex ? Number(meterForm.meterCurrentIndex) : undefined;
    const computedFromIdx =
      prevIdx !== undefined && currIdx !== undefined && currIdx >= prevIdx
        ? Number((currIdx - prevIdx).toFixed(2))
        : null;
    const measuredKwh =
      computedFromIdx !== null && computedFromIdx > 0
        ? computedFromIdx
        : Math.max(0, Number(meterForm.measuredKwh) || 0);

    const matchedCls =
      meterForm.scopeType === 'class'
        ? classes.find((c) => c.id === meterForm.scopeId)
        : undefined;

    const reading: FacilityMeterReading = {
      id: `MR-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      scopeType: meterForm.scopeType,
      scopeId:
        meterForm.scopeType === 'school'
          ? 'SCHOOL'
          : meterForm.scopeId || meterForm.scopeName,
      scopeName:
        meterForm.scopeType === 'school'
          ? 'Toàn trường'
          : matchedCls
          ? matchedCls.name
          : meterForm.scopeName,
      classId: matchedCls?.id,
      className: matchedCls?.name,
      grade: matchedCls?.grade,
      roomLocation: matchedCls?.room,
      academicYear: selectedYear === 'all' ? '2026 - 2027' : selectedYear,
      periodType: meterForm.periodType,
      periodKey: meterForm.periodKey,
      measuredKwh,
      meterPrevious: prevIdx,
      meterCurrent: currIdx,
      costPerKwh,
      sourceMode: 'meter_reading',
      recordedBy: currentUser.displayName,
      recordedAt: new Date().toISOString(),
      notes: meterForm.notes.trim() || undefined,
    };

    await onSaveMeterReading(reading);
    if (onLogFacilityActivity) {
      await onLogFacilityActivity(
        createFacilityActivityLog({
          logType: 'energy_meter',
          summary: `Nhập công tơ điện ${reading.scopeName}: ${reading.measuredKwh} kWh (${reading.periodKey})`,
          actorName: currentUser.displayName,
          actorRole: currentUser.role,
          classId: reading.classId,
          className: reading.className,
        })
      );
    }
    setIsMeterModalOpen(false);
  };

  const activeBuckets =
    viewScope === 'room'
      ? summary.byRoom
      : viewScope === 'grade'
      ? summary.byGrade
      : summary.byClass;

  return (
    <div className="space-y-4">
      {/* Top Bar & Transparency Banner */}
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Năm học điện năng"
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

          <div className="flex flex-wrap sm:inline-flex rounded-xl p-1 glass-subsurface gap-1 w-full sm:w-auto">
            {(
              [
                { id: 'class', label: 'Theo lớp' },
                { id: 'room', label: 'Theo phòng' },
                { id: 'grade', label: 'Theo khối' },
                { id: 'device', label: 'Từng thiết bị' },
                { id: 'school', label: 'Toàn trường & Công tơ' },
              ] as Array<{ id: EnergyViewScope; label: string }>
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setViewScope(t.id)}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer whitespace-nowrap ${
                  viewScope === t.id
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-700 dark:text-slate-200 hover:bg-white/60 dark:hover:bg-slate-800/60'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 inline-flex items-center gap-1.5">
            Đơn giá (đ/kWh):
            <input
              type="number"
              min={500}
              step={100}
              value={costPerKwh}
              onChange={(e) => setCostPerKwh(Math.max(500, Number(e.target.value) || DEFAULT_ELECTRICITY_COST_PER_KWH))}
              className="w-24 glass-subsurface rounded-xl px-2.5 py-1.5 font-mono-tabular font-bold text-slate-900 dark:text-white"
            />
          </label>
          {canEdit && (
            <button
              type="button"
              onClick={() => {
                setMeterForm((prev) => ({
                  ...prev,
                  scopeId: activeClasses[0]?.id || '',
                  scopeName: activeClasses[0]?.name || 'Toàn trường',
                }));
                setIsMeterModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" /> Nhập số công tơ
            </button>
          )}
        </div>
      </div>

      {/* Explicit Estimation Transparency Banner */}
      <div className="px-3.5 py-2.5 rounded-xl bg-sky-500/10 border border-sky-400/30 flex flex-wrap items-center justify-between gap-2 text-xs text-sky-900 dark:text-sky-200">
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0" />
          <span>{summary.schoolSourceLabel}</span>
        </div>
        <Badge variant={summary.hasAnyMeterReading ? 'mint' : 'amber'} size="sm">
          {summary.hasAnyMeterReading ? 'Kết hợp số liệu công tơ & ước tính' : 'Số liệu ước tính'}
        </Badge>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <LiquidCard className="p-3.5 sm:p-4">
          <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            Tổng công suất lắp đặt
          </p>
          <p className="font-mono-tabular text-lg sm:text-2xl font-extrabold text-slate-900 dark:text-white mt-1 whitespace-nowrap">
            {(summary.totalWatts / 1000).toFixed(2)} kW
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            {summary.totalActiveDevices} hạng mục đang sử dụng
          </p>
        </LiquidCard>

        <LiquidCard className="p-3.5 sm:p-4">
          <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            Tiêu thụ theo ngày (ước tính)
          </p>
          <p className="font-mono-tabular text-lg sm:text-2xl font-extrabold text-sky-700 dark:text-sky-300 mt-1 whitespace-nowrap">
            {summary.totalDailyKwh.toLocaleString('vi-VN')} kWh
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Từ công suất × giờ dùng/ngày
          </p>
        </LiquidCard>

        <LiquidCard className="p-3.5 sm:p-4">
          <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            Tiêu thụ tháng (
            {summary.measuredMonthlyKwh !== null
              ? 'Công tơ'
              : summary.hasAnyMeterReading
              ? 'Công tơ + Ước tính'
              : 'Ước tính'}
            )
          </p>
          <p className="font-mono-tabular text-lg sm:text-2xl font-extrabold text-teal-700 dark:text-teal-300 mt-1 whitespace-nowrap">
            {summary.effectiveMonthlyKwh.toLocaleString('vi-VN')} kWh
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Ước tính: {summary.estimatedMonthlyKwh.toLocaleString('vi-VN')} kWh
          </p>
        </LiquidCard>

        <LiquidCard className="p-3.5 sm:p-4">
          <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">
            Chi phí điện ước tính / tháng
          </p>
          <p className="font-mono-tabular text-base sm:text-2xl font-extrabold text-amber-700 dark:text-amber-300 mt-1 whitespace-nowrap">
            {summary.effectiveMonthlyCostVnd.toLocaleString('vi-VN')} đ
          </p>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
            Đơn giá {costPerKwh.toLocaleString('vi-VN')} đ/kWh
          </p>
        </LiquidCard>
      </div>

      {/* Comparison Bar Chart */}
      {viewScope !== 'device' && chartData.length > 0 && (
        <LiquidCard className="p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" />
              So sánh điện năng tiêu thụ theo {viewScope === 'room' ? 'Phòng' : viewScope === 'grade' ? 'Khối' : 'Lớp'} (kWh/tháng)
            </h3>
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Cột xanh: Ước tính từ thiết bị · Cột ngọc: Số liệu công tơ thực tế
            </span>
          </div>
          <div className="w-full h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(value: unknown, _name: unknown, item: { payload?: { hasMeter?: boolean; uocTinh?: number } }) => {
                    const v = Number(value || 0).toLocaleString('vi-VN');
                    const payload = item?.payload;
                    if (payload?.hasMeter) {
                      return [`${v} kWh (Số công tơ · ước tính: ${payload.uocTinh?.toLocaleString('vi-VN')} kWh)`, 'Điện năng'];
                    }
                    return [`${v} kWh (Ước tính)`, 'Điện năng'];
                  }}
                />
                <Bar
                  dataKey="hieuLuc"
                  name="Điện năng hiệu lực (kWh)"
                  isAnimationActive={false}
                  maxBarSize={56}
                  radius={[8, 8, 0, 0]}
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.name}
                      fill={entry.hasMeter ? '#0d9488' : '#0284c7'}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </LiquidCard>
      )}

      {/* Breakdown Table */}
      {viewScope === 'device' ? (
        summary.byDevice.length === 0 ? (
          <EmptyState icon={Zap} title="Chưa có dữ liệu thiết bị" description="Thêm thiết bị để hệ thống tính điện năng tiêu thụ." />
        ) : (
          <div className="glass-table-shell">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="glass-table-head">
                  <tr>
                    <th className="px-4 py-3">Thiết bị</th>
                    <th className="px-4 py-3">Lớp / Phòng</th>
                    <th className="px-4 py-3">SL × Công suất</th>
                    <th className="px-4 py-3">Thời gian dùng</th>
                    <th className="px-4 py-3">Ngày (kWh)</th>
                    <th className="px-4 py-3">Tháng (kWh)</th>
                    <th className="px-4 py-3">Chi phí ước tính</th>
                    <th className="px-4 py-3">Nguồn dữ liệu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/25 dark:divide-white/10">
                  {summary.byDevice.map((d) => (
                    <tr key={d.assetId} className="glass-table-row">
                      <td className="px-4 py-3">
                        <span className="font-bold text-slate-900 dark:text-white">{d.name}</span>
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400">{d.deviceKind}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-semibold text-teal-700 dark:text-teal-300">{d.className}</span>
                        <span className="block text-[11px] text-slate-500">{d.roomLocation}</span>
                      </td>
                      <td className="px-4 py-3 font-mono-tabular whitespace-nowrap">
                        {d.quantity} × {d.powerWattsPerUnit}W = <strong>{d.totalWatts}W</strong>
                      </td>
                      <td className="px-4 py-3 font-mono-tabular whitespace-nowrap">
                        {d.dailyUsageHours}h/ngày ({d.operatingDaysPerMonth} ngày)
                      </td>
                      <td className="px-4 py-3 font-mono-tabular font-semibold">{d.dailyKwh}</td>
                      <td className="px-4 py-3 font-mono-tabular font-bold text-sky-700 dark:text-sky-300">
                        {d.monthlyKwh}
                      </td>
                      <td className="px-4 py-3 font-mono-tabular">
                        {d.estimatedMonthlyCostVnd.toLocaleString('vi-VN')} đ
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="amber" size="sm">Ước tính</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )
      ) : viewScope === 'school' ? (
        <LiquidCard className="p-4 sm:p-5 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
              <Gauge className="w-4 h-4 text-teal-600" /> Lịch sử chỉ số công tơ đã nhập ({meterReadings.length})
            </h3>
          </div>
          {meterReadings.length === 0 ? (
            <EmptyState
              icon={Gauge}
              title="Chưa có chỉ số công tơ nào"
              description="Khi chưa nhập công tơ hoặc gắn cảm biến đo điện, hệ thống tự động tính số liệu ước tính từ công suất thiết bị."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="glass-table-head">
                  <tr>
                    <th className="px-3.5 py-2.5">Phạm vi</th>
                    <th className="px-3.5 py-2.5">Kỳ đo</th>
                    <th className="px-3.5 py-2.5">Điện năng đo được</th>
                    <th className="px-3.5 py-2.5">Người ghi</th>
                    <th className="px-3.5 py-2.5">Ghi chú</th>
                    {canEdit && <th className="px-3.5 py-2.5 text-right">Xóa</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/25 dark:divide-white/10">
                  {meterReadings.map((r) => (
                    <tr key={r.id} className="glass-table-row">
                      <td className="px-3.5 py-2.5 font-bold text-slate-900 dark:text-white">
                        {r.scopeName} ({r.scopeType})
                      </td>
                      <td className="px-3.5 py-2.5 font-mono-tabular">
                        {r.periodKey} ({r.periodType === 'day' ? 'Ngày' : 'Tháng'})
                      </td>
                      <td className="px-3.5 py-2.5 font-mono-tabular font-bold text-teal-700 dark:text-teal-300">
                        {r.measuredKwh} kWh
                      </td>
                      <td className="px-3.5 py-2.5">{r.recordedBy}</td>
                      <td className="px-3.5 py-2.5 text-slate-500">{r.notes || '—'}</td>
                      {canEdit && (
                        <td className="px-3.5 py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => void onDeleteMeterReading(r.id)}
                            aria-label={`Xóa chỉ số ${r.scopeName}`}
                            className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-500/15 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </LiquidCard>
      ) : activeBuckets.length === 0 ? (
        <EmptyState icon={Zap} title="Chưa có dữ liệu tiêu thụ" description="Thêm thiết bị theo lớp/phòng để xem thống kê." />
      ) : (
        <div className="glass-table-shell">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="glass-table-head">
                <tr>
                  <th className="px-4 py-3">
                    {viewScope === 'room' ? 'Phòng' : viewScope === 'grade' ? 'Khối' : 'Lớp'}
                  </th>
                  <th className="px-4 py-3">Thiết bị</th>
                  <th className="px-4 py-3">Công suất</th>
                  <th className="px-4 py-3">Ngày (ước tính)</th>
                  <th className="px-4 py-3">Tháng hiệu lực (kWh)</th>
                  <th className="px-4 py-3">Chi phí dự kiến</th>
                  <th className="px-4 py-3">Trạng thái nguồn</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/25 dark:divide-white/10">
                {activeBuckets.map((b) => (
                  <tr key={b.key} className="glass-table-row">
                    <td className="px-4 py-3">
                      <span className="font-bold text-slate-900 dark:text-white">{b.label}</span>
                      {b.subLabel && (
                        <span className="block text-[11px] text-slate-500 dark:text-slate-400">{b.subLabel}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono-tabular">
                      {b.deviceCount} loại ({b.totalQuantity} chiếc)
                    </td>
                    <td className="px-4 py-3 font-mono-tabular">{b.totalWatts.toLocaleString('vi-VN')} W</td>
                    <td className="px-4 py-3 font-mono-tabular">{b.estimatedDailyKwh} kWh</td>
                    <td className="px-4 py-3 font-mono-tabular font-bold text-teal-700 dark:text-teal-300">
                      {b.effectiveMonthlyKwh.toLocaleString('vi-VN')} kWh
                    </td>
                    <td className="px-4 py-3 font-mono-tabular font-semibold">
                      {b.estimatedMonthlyCostVnd.toLocaleString('vi-VN')} đ
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={b.hasMeterReading ? 'mint' : 'amber'} size="sm">
                        {b.hasMeterReading ? 'Số công tơ' : 'Ước tính'}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Electric Meter Input Modal */}
      <Modal
        isOpen={isMeterModalOpen}
        onClose={() => setIsMeterModalOpen(false)}
        title="Nhập số liệu công tơ điện"
        maxWidth="md"
      >
        <form onSubmit={handleSaveMeter} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Phạm vi đo
              </label>
              <select
                value={meterForm.scopeType}
                onChange={(e) => {
                  const st = e.target.value as 'class' | 'room' | 'grade' | 'school';
                  setMeterForm((prev) => ({
                    ...prev,
                    scopeType: st,
                    scopeId: st === 'class' ? activeClasses[0]?.id || '' : '',
                    scopeName: st === 'school' ? 'Toàn trường' : st === 'class' ? activeClasses[0]?.name || '' : '',
                  }));
                }}
                className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
              >
                <option value="class">Theo Lớp</option>
                <option value="room">Theo Phòng</option>
                <option value="grade">Theo Khối</option>
                <option value="school">Toàn trường</option>
              </select>
            </div>
            {meterForm.scopeType === 'class' ? (
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Chọn Lớp
                </label>
                <select
                  value={meterForm.scopeId}
                  onChange={(e) => {
                    const cls = classes.find((c) => c.id === e.target.value);
                    setMeterForm((prev) => ({
                      ...prev,
                      scopeId: e.target.value,
                      scopeName: cls?.name || '',
                    }));
                  }}
                  className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                >
                  {activeClasses.map((c) => (
                    <option key={c.id} value={c.id}>
                      Lớp {c.name} ({c.room})
                    </option>
                  ))}
                </select>
              </div>
            ) : meterForm.scopeType !== 'school' ? (
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Tên phòng / khối *
                </label>
                <input
                  type="text"
                  required
                  value={meterForm.scopeName}
                  onChange={(e) => setMeterForm((prev) => ({ ...prev, scopeName: e.target.value, scopeId: e.target.value }))}
                  placeholder={meterForm.scopeType === 'grade' ? 'VD: Khối 10' : 'VD: P.101'}
                  className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
                />
              </div>
            ) : (
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Đối tượng
                </label>
                <input
                  type="text"
                  readOnly
                  value="Công tơ tổng toàn trường"
                  className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-600 dark:text-slate-300"
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Kỳ chốt
              </label>
              <select
                value={meterForm.periodType}
                onChange={(e) => setMeterForm((prev) => ({ ...prev, periodType: e.target.value as 'day' | 'month' }))}
                className="w-full glass-subsurface rounded-xl px-3 py-2 text-slate-800 dark:text-slate-100"
              >
                <option value="month">Theo tháng</option>
                <option value="day">Theo ngày</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Thời gian (YYYY-MM)
              </label>
              <input
                type="text"
                required
                value={meterForm.periodKey}
                onChange={(e) => setMeterForm((prev) => ({ ...prev, periodKey: e.target.value }))}
                className="w-full glass-subsurface rounded-xl px-3 py-2 font-mono-tabular text-slate-800 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2.5">
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Chỉ số cũ
              </label>
              <input
                type="number"
                min={0}
                value={meterForm.meterPreviousIndex}
                onChange={(e) => setMeterForm((prev) => ({ ...prev, meterPreviousIndex: e.target.value }))}
                className="w-full glass-subsurface rounded-xl px-3 py-2 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Chỉ số mới
              </label>
              <input
                type="number"
                min={0}
                value={meterForm.meterCurrentIndex}
                onChange={(e) => setMeterForm((prev) => ({ ...prev, meterCurrentIndex: e.target.value }))}
                className="w-full glass-subsurface rounded-xl px-3 py-2 font-mono-tabular"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                Hoặc nhập kWh *
              </label>
              <input
                type="number"
                min={0}
                step="0.1"
                value={meterForm.measuredKwh}
                onChange={(e) => setMeterForm((prev) => ({ ...prev, measuredKwh: Number(e.target.value) || 0 }))}
                className="w-full glass-subsurface rounded-xl px-3 py-2 font-mono-tabular font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
              Ghi chú
            </label>
            <input
              type="text"
              value={meterForm.notes}
              onChange={(e) => setMeterForm((prev) => ({ ...prev, notes: e.target.value }))}
              className="w-full glass-subsurface rounded-xl px-3 py-2"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-slate-700/70">
            <button
              type="button"
              onClick={() => setIsMeterModalOpen(false)}
              className="px-4 py-2 rounded-xl glass-subsurface font-semibold cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold cursor-pointer"
            >
              Lưu chỉ số
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
