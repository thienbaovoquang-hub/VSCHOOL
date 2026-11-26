import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Save, X } from '../icons/UiIcons';
import type {
  DataCatalogOption,
  ImportModuleKey,
  SchemaFieldDef,
  UserProfile,
} from '../../types';
import {
  buildCatalogLists,
  getSchemaByKey,
} from '../../utils/importExport/schemas';
import {
  validateManualRecord,
  validateSingleField,
  type ValidationDbContext,
} from '../../utils/importExport/validator';
import { buildDomainEntityFromNormalized } from '../../utils/importExport/processor';
import { resolveCatalogOptions } from '../../utils/catalogs/catalogRegistry';

interface UnifiedManualFormModalProps {
  isOpen: boolean;
  moduleKey: ImportModuleKey;
  context: ValidationDbContext;
  existingRecords: Record<string, unknown>[];
  initialValues?: Record<string, unknown>;
  editingRecordId?: string;
  currentUser: UserProfile;
  titleOverride?: string;
  onClose: () => void;
  onSave: (entity: Record<string, unknown>, isEdit: boolean) => void | Promise<void>;
}

export const UnifiedManualFormModal: React.FC<UnifiedManualFormModalProps> = ({
  isOpen,
  moduleKey,
  context,
  existingRecords,
  initialValues,
  editingRecordId,
  currentUser,
  titleOverride,
  onClose,
  onSave,
}) => {
  const schema = useMemo(() => getSchemaByKey(moduleKey), [moduleKey]);
  const catalogs = useMemo(() => buildCatalogLists(context), [context]);
  const isEdit = Boolean(editingRecordId);

  const [formData, setFormData] = useState<Record<string, unknown>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resolveFieldOptionItems = (
    field: SchemaFieldDef,
    dataSnapshot: Record<string, unknown>,
    includeInactiveForEdit = isEdit
  ): DataCatalogOption[] => {
    const parentVal = field.parentFieldKey ? String(dataSnapshot[field.parentFieldKey] ?? '') : undefined;
    if (field.catalogId || field.lookupCatalog) {
      const resolved = resolveCatalogOptions({
        catalogId: field.catalogId,
        lookupCatalog: field.lookupCatalog,
        staticOptions: field.options,
        parentValue: parentVal,
        includeInactive: includeInactiveForEdit,
        runtime: context,
      });
      if (resolved.length > 0 || (parentVal && field.parentFieldKey)) {
        return resolved;
      }
      if (field.lookupCatalog && catalogs[field.lookupCatalog]?.length) {
        return catalogs[field.lookupCatalog].map((v, idx) => ({
          id: `${field.key}_${idx}`,
          value: v,
          label: v,
          order: idx + 1,
          active: true,
        }));
      }
    }
    if (field.options && field.options.length > 0) {
      return field.options.map((v, idx) => ({
        id: `${field.key}_s_${idx}`,
        value: v,
        label: v,
        order: idx + 1,
        active: true,
      }));
    }
    return [];
  };

  useEffect(() => {
    if (!isOpen) return;
    const init: Record<string, unknown> = {};
    for (const f of schema.fields) {
      if (initialValues && initialValues[f.key] !== undefined && initialValues[f.key] !== null) {
        if (Array.isArray(initialValues[f.key])) {
          init[f.key] = (initialValues[f.key] as unknown[]).join(', ');
        } else {
          init[f.key] = initialValues[f.key];
        }
      } else if (f.key === 'scoreRegularText' && Array.isArray(initialValues?.scoreRegular)) {
        init[f.key] = (initialValues.scoreRegular as number[]).join('; ');
      } else {
        const parentVal = f.parentFieldKey ? String(init[f.parentFieldKey] ?? '') : undefined;
        const catalogOpts =
          f.catalogId || f.lookupCatalog
            ? resolveCatalogOptions({
                catalogId: f.catalogId,
                lookupCatalog: f.lookupCatalog,
                staticOptions: f.options,
                parentValue: parentVal,
                includeInactive: false,
                runtime: context,
              })
            : [];
        const defaultOpt = catalogOpts.find((o) => o.isDefault);
        if (defaultOpt) {
          init[f.key] = f.type === 'integer' ? Number(defaultOpt.value) || defaultOpt.value : defaultOpt.value;
        } else if (f.defaultValue !== undefined) {
          init[f.key] = f.defaultValue;
        } else {
          init[f.key] = '';
        }
      }
    }
    setFormData(init);
    setFieldErrors({});
    setWarnings([]);
    setSubmitAttempted(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, schema, initialValues]);

  if (!isOpen) return null;

  const handleFieldChange = (field: SchemaFieldDef, value: unknown) => {
    const nextData: Record<string, unknown> = { ...formData, [field.key]: value };

    // Auto-clear dependent child fields if current child value is incompatible with newly chosen parent
    const childFields = schema.fields.filter((f) => f.parentFieldKey === field.key);
    for (const child of childFields) {
      const currentChildVal = String(nextData[child.key] ?? '').trim();
      if (!currentChildVal) continue;
      const allowedChildren = resolveFieldOptionItems(child, nextData, isEdit);
      if (!allowedChildren.some((o) => o.value.toLowerCase() === currentChildVal.toLowerCase())) {
        nextData[child.key] = '';
      }
    }

    setFormData(nextData);

    // Live per-field format validation with current catalog options
    const catalogOptions = field.catalogId
      ? resolveFieldOptionItems(field, nextData, isEdit)
      : undefined;
    const res = validateSingleField(field, value, { catalogOptions });
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (!res.valid && res.error) {
        next[field.key] = res.error;
      } else {
        delete next[field.key];
      }
      for (const child of childFields) {
        if (nextData[child.key] === '') {
          delete next[child.key];
        }
      }
      return next;
    });

    if (submitAttempted) {
      const fullCheck = validateManualRecord(schema, nextData, context, existingRecords, editingRecordId);
      setFieldErrors(fullCheck.fieldErrors);
      setWarnings(fullCheck.issues.filter((i) => i.severity === 'warning').map((i) => i.message));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitAttempted(true);

    const validation = validateManualRecord(schema, formData, context, existingRecords, editingRecordId);
    setFieldErrors(validation.fieldErrors);
    const warnMessages = validation.issues
      .filter((i) => i.severity === 'warning')
      .map((i) => i.message);
    setWarnings(warnMessages);

    if (!validation.valid) {
      return;
    }

    setIsSubmitting(true);
    try {
      const existingEntity = editingRecordId
        ? existingRecords.find((r) => String(r.id) === String(editingRecordId))
        : undefined;

      const builtEntity = buildDomainEntityFromNormalized(
        moduleKey,
        validation.normalized,
        context,
        existingEntity,
        undefined,
        {
          actorName: currentUser.displayName,
          actorRole: currentUser.role,
          gradeWeights: context.systemSettings?.gradeWeights,
        }
      );

      await onSave(builtEntity, isEdit);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center p-4 bg-slate-950/55 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[88vh] flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl rounded-[26px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        data-testid={`manual-form-modal-${moduleKey}`}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-800">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              {titleOverride || (isEdit ? `Cập nhật ${schema.title}` : `Thêm mới ${schema.title}`)}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Đồng bộ cấu trúc, danh mục chuẩn & kiểm tra 100% với mẫu Excel ({schema.templateFileName})
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200/50 dark:hover:bg-slate-700/60 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-5">
          {schema.migrationWarning && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/25 border border-amber-200 dark:border-amber-700/50 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <span>{schema.migrationWarning}</span>
            </div>
          )}

          {Object.keys(fieldErrors).length > 0 && submitAttempted && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/25 border border-red-200 dark:border-red-700/50 flex items-start gap-2.5 text-xs text-red-700 dark:text-red-300">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <div>
                <div className="font-bold">Vui lòng kiểm tra lại các trường chưa hợp lệ:</div>
                <ul className="list-disc pl-4 mt-1 space-y-0.5">
                  {Object.values(fieldErrors).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {warnings.length > 0 && (
            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/25 border border-amber-200 dark:border-amber-700/50 flex items-start gap-2.5 text-xs text-amber-800 dark:text-amber-300">
              <AlertTriangle size={16} className="shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                {warnings.map((w, i) => (
                  <div key={i}>{w}</div>
                ))}
              </div>
            </div>
          )}

          {schema.groups.map((groupName) => {
            const groupFields = schema.fields.filter((f) => f.group === groupName);
            if (groupFields.length === 0) return null;

            return (
              <div
                key={groupName}
                className="p-4 rounded-xl glass-subsurface space-y-3"
              >
                <h4 className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  {groupName}
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {groupFields.map((field) => {
                    const value = formData[field.key] ?? '';
                    const strValue = String(value);
                    const error = fieldErrors[field.key];
                    const activeItems = resolveFieldOptionItems(field, formData, false);
                    const editableItems = isEdit ? resolveFieldOptionItems(field, formData, true) : activeItems;
                    const optionValues = editableItems.map((o) => o.value);
                    const isSelectField =
                      field.type === 'enum' || Boolean(field.catalogId) || Boolean(field.lookupCatalog);
                    const hasDropdown =
                      isSelectField && (editableItems.length > 0 || Boolean(field.parentFieldKey));
                    const isLegacyValue =
                      Boolean(strValue) &&
                      hasDropdown &&
                      !activeItems.some((o) => o.value.toLowerCase() === strValue.toLowerCase());
                    const disabled = Boolean(isEdit && field.readOnlyOnEdit);
                    const spanFull = field.type === 'textarea';
                    const parentField = field.parentFieldKey
                      ? schema.fields.find((sf) => sf.key === field.parentFieldKey)
                      : undefined;

                    return (
                      <div key={field.key} className={spanFull ? 'sm:col-span-2' : ''}>
                        <label className="block text-xs font-semibold text-slate-700 dark:text-slate-200 mb-1">
                          {field.label}
                          {field.required && <span className="text-red-500 ml-1">*</span>}
                          {parentField && (
                            <span className="ml-1.5 text-[10px] font-normal text-sky-600 dark:text-sky-400">
                              (theo {parentField.label})
                            </span>
                          )}
                        </label>

                        {field.type === 'textarea' ? (
                          <textarea
                            rows={2}
                            value={strValue}
                            disabled={disabled}
                            onChange={(e) => handleFieldChange(field, e.target.value)}
                            placeholder={field.formatHint}
                            className={`w-full px-3 py-2 text-sm rounded-xl glass-subsurface ${
                              error
                                ? 'border-red-500 focus:ring-red-500/30'
                                : 'focus:ring-blue-500/30'
                            } text-slate-800 dark:text-white focus:outline-none focus:ring-2 disabled:opacity-60`}
                          />
                        ) : hasDropdown && editableItems.length <= 200 ? (
                          <select
                            data-field-key={field.key}
                            value={strValue}
                            disabled={disabled}
                            onChange={(e) =>
                              handleFieldChange(
                                field,
                                field.type === 'integer' && e.target.value !== ''
                                  ? Number(e.target.value)
                                  : e.target.value
                              )
                            }
                            className={`w-full px-3 py-2 text-sm rounded-xl glass-subsurface ${
                              error
                                ? 'border-red-500 focus:ring-red-500/30'
                                : 'focus:ring-blue-500/30'
                            } text-slate-800 dark:text-white focus:outline-none focus:ring-2 disabled:opacity-60`}
                          >
                            {!field.required && <option value="">-- Không chọn --</option>}
                            {field.required && !strValue && (
                              <option value="">
                                {editableItems.length === 0 && parentField
                                  ? `-- Chưa có mục thuộc ${parentField.label} đã chọn --`
                                  : `-- Chọn ${field.label} --`}
                              </option>
                            )}
                            {editableItems.map((opt, optIdx) => (
                              <option key={`${opt.id || opt.value}-${optIdx}`} value={opt.value}>
                                {opt.label !== opt.value ? opt.label : opt.value}
                                {opt.active === false ? ' (đã ngừng)' : ''}
                              </option>
                            ))}
                            {strValue && !optionValues.includes(strValue) && (
                              <option value={strValue}>{strValue} (giá trị cũ)</option>
                            )}
                          </select>
                        ) : (
                          <input
                            data-field-key={field.key}
                            type={
                              field.type === 'date'
                                ? 'date'
                                : field.type === 'number' || field.type === 'integer'
                                ? 'number'
                                : field.type === 'email'
                                ? 'email'
                                : field.type === 'phone'
                                ? 'tel'
                                : 'text'
                            }
                            step={field.type === 'number' ? '0.1' : field.type === 'integer' ? '1' : undefined}
                            min={field.min}
                            max={field.max}
                            value={strValue}
                            disabled={disabled}
                            onChange={(e) => handleFieldChange(field, e.target.value)}
                            placeholder={field.formatHint}
                            className={`w-full px-3 py-2 text-sm rounded-xl glass-subsurface ${
                              error
                                ? 'border-red-500 focus:ring-red-500/30'
                                : 'focus:ring-blue-500/30'
                            } text-slate-800 dark:text-white focus:outline-none focus:ring-2 disabled:opacity-60`}
                          />
                        )}

                        {error ? (
                          <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
                            <AlertCircle size={12} /> {error}
                          </p>
                        ) : isLegacyValue ? (
                          <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
                            <AlertTriangle size={12} /> Giá trị hiện tại không còn trong danh mục đang hoạt động — nên chuyển sang lựa chọn chuẩn.
                          </p>
                        ) : (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
                            {field.formatHint}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {/* Footer actions */}
          <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-white/35 dark:border-white/10">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl glass-subsurface text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              data-testid="manual-form-submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-md shadow-sky-500/20 disabled:opacity-60 transition-all cursor-pointer"
            >
              {isEdit ? <CheckCircle2 size={15} /> : <Save size={15} />}
              <span>{isSubmitting ? 'Đang lưu...' : isEdit ? 'Cập nhật dữ liệu' : 'Lưu vào hệ thống'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
