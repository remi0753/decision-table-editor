import type { FieldType } from '@leverie/engine';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import { InlineEdit } from '@/components/ui/InlineEdit';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/utils';
import { useLogicStore } from '@/store/logicStore';
import { EnumValuesEditor } from './EnumValuesEditor';

export function FieldsSection() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<FieldType>('string');
  const [deleteConfirm, setDeleteConfirm] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [typeChangeConfirm, setTypeChangeConfirm] = useState<{
    id: string;
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

  const toggleExpanded = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) {
      toast.error(t.fieldNameRequired);
      return;
    }
    const result = addField(name, newType, newType === 'enum' ? [] : undefined);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setNewName('');
    setNewType('string');
  };

  const handleRename = (id: string, name: string) => {
    const result = renameField(id, name);
    if (result.error) toast.error(result.error);
  };

  const handleTypeChange = (id: string, type: FieldType) => {
    const field = logic.fieldDefs[id];
    if (!field) return;
    let count = 0;
    for (const table of Object.values(logic.tables)) {
      for (const col of table.cols) {
        if (col.fieldId !== id) continue;
        count += table.rows.filter((r) => r.cells[col.id]).length;
      }
    }
    if (count > 0) {
      setTypeChangeConfirm({ id, newType: type, count });
    } else {
      changeFieldType(id, type);
    }
  };

  const handleDelete = (id: string) => {
    const result = deleteField(id);
    if (result.error) {
      toast.error(result.error);
      return;
    }
    setDeleteConfirm(null);
  };

  return (
    <div className="py-1">
      {fieldDefs.length === 0 && (
        <div className="px-3 py-2 text-xs text-fg-faint">{t.noFields}</div>
      )}
      {fieldDefs.map((field) => {
        const isOpen = expanded.has(field.id);
        return (
          <div
            key={field.id}
            className="border-b border-line-subtle last:border-b-0"
          >
            <div className="flex items-center gap-1 pl-3 pr-3 py-1 group hover:bg-surface-muted">
              <button
                type="button"
                onClick={() => toggleExpanded(field.id)}
                className="flex items-center gap-1 flex-1 min-w-0 text-left"
              >
                {isOpen ? (
                  <ChevronDown size={11} className="shrink-0 text-fg-faint" />
                ) : (
                  <ChevronRight size={11} className="shrink-0 text-fg-faint" />
                )}
                <span className="flex-1 min-w-0 text-sm text-fg-secondary truncate">
                  {field.name}
                </span>
                <span
                  className={cn(
                    'shrink-0 w-16 text-center text-[10px] px-1 py-px rounded truncate',
                    field.type === 'enum'
                      ? 'bg-brand-subtle text-brand-fg border border-brand-border-subtle'
                      : 'bg-surface-subtle text-fg-subtle',
                  )}
                >
                  {typeLabel(field.type)}
                </span>
              </button>
              <IconButton
                tone="danger"
                onClick={() =>
                  setDeleteConfirm({ id: field.id, name: field.name })
                }
                className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                title={t.deleteField}
                aria-label={t.deleteField}
              >
                <Trash2 />
              </IconButton>
            </div>
            {isOpen && (
              <div className="px-3 pb-2 pt-1 bg-surface-muted/50 space-y-1.5">
                <InlineEdit
                  value={field.name}
                  onSave={(name) => handleRename(field.id, name)}
                  className="text-xs font-medium block w-full"
                  inputClassName="text-xs w-full"
                  placeholder={t.fieldNamePlaceholder}
                />
                <select
                  value={field.type}
                  onChange={(e) =>
                    handleTypeChange(field.id, e.target.value as FieldType)
                  }
                  className="text-xs border rounded px-1 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-brand-ring"
                >
                  {fieldTypes.map((ft) => (
                    <option key={ft.value} value={ft.value}>
                      {ft.label}
                    </option>
                  ))}
                </select>
                {field.type === 'enum' && (
                  <EnumValuesEditor
                    fieldId={field.id}
                    enumValues={field.enumValues ?? []}
                  />
                )}
              </div>
            )}
          </div>
        );
      })}

      <div
        data-tour-target="field-add"
        className="flex items-center gap-1 pl-3 pr-3 py-1.5 border-t bg-surface-muted/50"
      >
        <input
          data-tour-target="field-name-input"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Enter') handleAdd();
          }}
          placeholder={t.fieldNamePlaceholder}
          className="text-xs border rounded px-1.5 py-1 flex-1 min-w-0 focus:outline-none focus:ring-1 focus:ring-brand-ring"
        />
        <select
          data-tour-target="field-type-select"
          value={newType}
          onChange={(e) => setNewType(e.target.value as FieldType)}
          className="text-xs border rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-brand-ring"
        >
          {fieldTypes.map((ft) => (
            <option key={ft.value} value={ft.value}>
              {ft.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          data-tour-target="field-submit"
          onClick={handleAdd}
          className="flex items-center text-brand-fg hover:text-brand-fg-strong border border-brand-border-strong rounded px-1.5 py-1"
          title={t.add}
        >
          <Plus size={12} />
        </button>
      </div>

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
            changeFieldType(typeChangeConfirm.id, typeChangeConfirm.newType);
            setTypeChangeConfirm(null);
          }
        }}
      />
    </div>
  );
}
