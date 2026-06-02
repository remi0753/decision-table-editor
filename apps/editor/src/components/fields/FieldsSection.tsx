import type { FieldDef, FieldType } from '@leverie/engine';
import * as Dialog from '@radix-ui/react-dialog';
import { FileText, Pencil, Plus, Trash2, X } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/utils';
import { useLogicStore } from '@/store/logicStore';
import { EnumValuesEditor } from './EnumValuesEditor';

type EditorTarget =
  | {
      mode: 'new';
    }
  | {
      mode: 'edit';
      fieldId: string;
    };

export function FieldsSection() {
  const [editorTarget, setEditorTarget] = useState<EditorTarget | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftType, setDraftType] = useState<FieldType>('string');
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [typeChangeConfirm, setTypeChangeConfirm] = useState<{
    id: string;
    name: string;
    newType: FieldType;
    count: number;
  } | null>(null);

  const logic = useLogicStore((s) => s.logic);
  const addField = useLogicStore((s) => s.addField);
  const renameField = useLogicStore((s) => s.renameField);
  const changeFieldType = useLogicStore((s) => s.changeFieldType);
  const deleteField = useLogicStore((s) => s.deleteField);
  const t = useT();

  const fieldDefs = Object.values(logic.fieldDefs);
  const editingField =
    editorTarget?.mode === 'edit'
      ? logic.fieldDefs[editorTarget.fieldId]
      : undefined;

  const fieldTypes: { value: FieldType; label: string }[] = [
    { value: 'string', label: t.fieldTypes.string },
    { value: 'number', label: t.fieldTypes.number },
    { value: 'bool', label: t.fieldTypes.bool },
    { value: 'enum', label: t.fieldTypes.enum },
    { value: 'date', label: t.fieldTypes.date },
    { value: 'datetime', label: t.fieldTypes.datetime },
  ];

  const typeLabel = (type: FieldType): string => {
    const ft = fieldTypes.find((f) => f.value === type);
    return ft?.label ?? type;
  };

  useEffect(() => {
    if (!editorTarget) return;
    if (editorTarget.mode === 'new') {
      setDraftName('');
      setDraftType('string');
      return;
    }
    const field = logic.fieldDefs[editorTarget.fieldId];
    if (!field) {
      setEditorTarget(null);
      return;
    }
    setDraftName(field.name);
    setDraftType(field.type);
  }, [editorTarget, logic.fieldDefs]);

  const openNewEditor = () => {
    setEditorTarget({ mode: 'new' });
  };

  const openEditEditor = (field: FieldDef) => {
    setEditorTarget({ mode: 'edit', fieldId: field.id });
  };

  const countAffectedCells = (id: string) => {
    let count = 0;
    for (const table of Object.values(logic.tables)) {
      for (const col of table.cols) {
        if (col.fieldId !== id) continue;
        count += table.rows.filter((r) => r.cells[col.id]).length;
      }
    }
    return count;
  };

  const saveExistingField = (field: FieldDef, name: string) => {
    if (name !== field.name) {
      const result = renameField(field.id, name);
      if (result.error) {
        toast.error(result.error);
        return false;
      }
    }

    if (draftType !== field.type) {
      const count = countAffectedCells(field.id);
      if (count > 0) {
        setTypeChangeConfirm({
          id: field.id,
          name,
          newType: draftType,
          count,
        });
        setEditorTarget(null);
        return true;
      }
      changeFieldType(field.id, draftType);
    }

    setEditorTarget(null);
    return true;
  };

  const handleSave = (event: FormEvent) => {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) {
      toast.error(t.fieldNameRequired);
      return;
    }

    if (!editorTarget || editorTarget.mode === 'new') {
      const result = addField(
        name,
        draftType,
        draftType === 'enum' ? [] : undefined,
      );
      if (result.error) {
        toast.error(result.error);
        return;
      }
      setEditorTarget(null);
      return;
    }

    const field = logic.fieldDefs[editorTarget.fieldId];
    if (!field) return;
    saveExistingField(field, name);
  };

  const handleDelete = (id: string) => {
    const result = deleteField(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setDeleteConfirm(null);
    setEditorTarget(null);
  };

  return (
    <div className="border-b last:border-b-0 bg-surface">
      <div className="flex min-h-11 items-center gap-2 border-b border-brand-border-subtle bg-brand-subtle/50 py-2 px-3">
        <div className="min-w-0 flex-1 truncate text-xs font-medium tracking-wide text-brand-fg uppercase">
          {t.fieldDefinitions}
        </div>
        <span className="w-16 shrink-0" aria-hidden />
        <button
          type="button"
          data-tour-target="field-add"
          onClick={openNewEditor}
          className="inline-flex h-7 w-3.5 shrink-0 items-center justify-center rounded text-fg-faint hover:text-brand-fg focus:outline-none focus:ring-1 focus:ring-brand-ring"
          aria-label={t.addField}
          title={t.addField}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {fieldDefs.length === 0 && (
        <div className="px-3 py-3 text-xs text-fg-faint">{t.noFields}</div>
      )}

      <div className="divide-y divide-line-subtle">
        {fieldDefs.map((field) => (
          <button
            key={field.id}
            type="button"
            onClick={() => openEditEditor(field)}
            className="group flex w-full min-w-0 items-center gap-2 px-3 py-2 text-left hover:bg-surface-muted focus:outline-none focus:ring-1 focus:ring-inset focus:ring-brand-ring"
          >
            <FileText className="h-3.5 w-3.5 shrink-0 text-fg-faint" />
            <span className="min-w-0 flex-1 truncate text-sm text-fg-secondary">
              {field.name}
            </span>
            <span
              className={cn(
                'shrink-0 w-16 truncate rounded px-1 py-px text-center text-[10px]',
                field.type === 'enum'
                  ? 'border border-brand-border-subtle bg-brand-subtle text-brand-fg'
                  : 'bg-surface-subtle text-fg-subtle',
              )}
            >
              {typeLabel(field.type)}
            </span>
            <Pencil className="h-3.5 w-3.5 shrink-0 text-fg-faint opacity-0 transition-opacity group-hover:opacity-100" />
          </button>
        ))}
      </div>

      <Dialog.Root
        open={!!editorTarget}
        onOpenChange={(open) => !open && setEditorTarget(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[61] w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-md border border-line bg-surface shadow-xl">
            <form onSubmit={handleSave}>
              <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
                <Dialog.Title className="text-base font-semibold text-fg">
                  {editorTarget?.mode === 'new'
                    ? t.createFieldTitle
                    : t.editFieldTitle}
                </Dialog.Title>
                <Dialog.Close asChild>
                  <button
                    type="button"
                    className="inline-flex h-8 w-8 items-center justify-center rounded text-fg-faint hover:bg-surface-muted hover:text-fg-secondary"
                    aria-label={t.close}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </Dialog.Close>
              </div>

              <div className="space-y-4 p-4">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-fg-muted">
                    {t.fieldNameLabel}
                  </span>
                  <input
                    data-tour-target="field-name-input"
                    value={draftName}
                    onChange={(event) => setDraftName(event.target.value)}
                    required
                    maxLength={120}
                    className="h-10 w-full rounded border border-line bg-surface px-3 text-sm text-fg-secondary focus:outline-none focus:ring-1 focus:ring-brand-ring"
                    placeholder={t.fieldNamePlaceholder}
                  />
                </label>

                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-fg-muted">
                    {t.fieldTypeLabel}
                  </span>
                  <select
                    data-tour-target="field-type-select"
                    value={draftType}
                    onChange={(event) =>
                      setDraftType(event.target.value as FieldType)
                    }
                    className="h-10 w-full rounded border border-line bg-surface px-3 text-sm text-fg-secondary focus:outline-none focus:ring-1 focus:ring-brand-ring"
                  >
                    {fieldTypes.map((ft) => (
                      <option key={ft.value} value={ft.value}>
                        {ft.label}
                      </option>
                    ))}
                  </select>
                </label>

                {editorTarget?.mode === 'edit' &&
                editingField &&
                draftType === 'enum' ? (
                  <div>
                    <div className="mb-1 text-xs font-medium text-fg-muted">
                      {t.enumValuesLabel}
                    </div>
                    <div className="rounded border border-line bg-surface-muted p-2">
                      <EnumValuesEditor
                        fieldId={editingField.id}
                        enumValues={editingField.enumValues ?? []}
                      />
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-2 border-t border-line p-3">
                {editorTarget?.mode === 'edit' && editingField ? (
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteConfirm({
                        id: editingField.id,
                        name: editingField.name,
                      });
                      setEditorTarget(null);
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded border border-danger-border bg-surface px-3 text-sm font-medium text-danger-fg hover:bg-danger-bg"
                  >
                    <Trash2 className="h-4 w-4" />
                    {t.deleteField}
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex justify-end gap-2">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="h-9 rounded border border-line bg-surface px-3 text-sm font-medium text-fg-muted hover:bg-surface-muted"
                    >
                      {t.cancel}
                    </button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    data-tour-target="field-submit"
                    className="h-9 rounded bg-brand px-3 text-sm font-medium text-white hover:bg-brand-strong"
                  >
                    {editorTarget?.mode === 'new' ? t.add : t.save}
                  </button>
                </div>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => !open && setDeleteConfirm(null)}
        title={t.deleteField}
        description={
          deleteConfirm ? t.deleteFieldConfirm(deleteConfirm.name) : ''
        }
        confirmLabel={t.confirmDefault}
        destructive
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm.id)}
      />

      <ConfirmDialog
        open={!!typeChangeConfirm}
        onOpenChange={(open) => !open && setTypeChangeConfirm(null)}
        title={t.changeFieldType}
        description={
          typeChangeConfirm
            ? t.changeFieldTypeConfirm(typeChangeConfirm.count)
            : ''
        }
        confirmLabel={t.changeConfirm}
        onConfirm={() => {
          if (typeChangeConfirm) {
            const field = logic.fieldDefs[typeChangeConfirm.id];
            if (field && typeChangeConfirm.name !== field.name) {
              const result = renameField(field.id, typeChangeConfirm.name);
              if (result.error) {
                toast.error(result.error);
                return;
              }
            }
            changeFieldType(typeChangeConfirm.id, typeChangeConfirm.newType);
            setTypeChangeConfirm(null);
            setEditorTarget(null);
          }
        }}
      />
    </div>
  );
}
