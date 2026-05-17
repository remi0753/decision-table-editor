import type { FieldType } from '@leverie/engine';
import {
  ChevronDown,
  ChevronRight,
  Download,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { IconButton } from '@/components/ui/IconButton';
import { InlineEdit } from '@/components/ui/InlineEdit';
import { exportFieldDefs, useImportFieldDefs } from '@/hooks/useImportExport';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/utils';
import { useLogicStore } from '@/store/logicStore';
import { EnumValuesEditor } from './EnumValuesEditor';

export function FieldsSectionActions() {
  const logic = useLogicStore((s) => s.logic);
  const importFieldDefsFn = useImportFieldDefs();
  const t = useT();
  const fieldDefs = Object.values(logic.fieldDefs);
  return (
    <>
      <IconButton
        tone="primary"
        onClick={(e) => {
          e.stopPropagation();
          importFieldDefsFn();
        }}
        title={t.importFieldDefsTitle}
        aria-label={t.importFieldDefsTitle}
      >
        <Upload />
      </IconButton>
      <IconButton
        tone="primary"
        onClick={(e) => {
          e.stopPropagation();
          exportFieldDefs(logic);
        }}
        disabled={fieldDefs.length === 0}
        title={t.exportFieldDefsTitle}
        aria-label={t.exportFieldDefsTitle}
      >
        <Download />
      </IconButton>
    </>
  );
}

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
        <div className="px-3 py-2 text-xs text-gray-400">{t.noFields}</div>
      )}
      {fieldDefs.map((field) => {
        const isOpen = expanded.has(field.id);
        return (
          <div
            key={field.id}
            className="border-b border-gray-100 last:border-b-0"
          >
            <div className="flex items-center gap-1 pl-3 pr-3 py-1 group hover:bg-gray-50">
              <button
                type="button"
                onClick={() => toggleExpanded(field.id)}
                className="flex items-center gap-1 flex-1 min-w-0 text-left"
              >
                {isOpen ? (
                  <ChevronDown size={11} className="shrink-0 text-gray-400" />
                ) : (
                  <ChevronRight size={11} className="shrink-0 text-gray-400" />
                )}
                <span className="flex-1 min-w-0 text-sm text-gray-800 truncate">
                  {field.name}
                </span>
                <span
                  className={cn(
                    'shrink-0 w-16 text-center text-[10px] px-1 py-px rounded truncate',
                    field.type === 'enum'
                      ? 'bg-violet-50 text-violet-600 border border-violet-100'
                      : 'bg-gray-100 text-gray-500',
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
              <div className="px-3 pb-2 pt-1 bg-gray-50/50 space-y-1.5">
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
                  className="text-xs border rounded px-1 py-0.5 w-full focus:outline-none focus:ring-1 focus:ring-violet-400"
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

      <div className="flex items-center gap-1 pl-3 pr-3 py-1.5 border-t bg-gray-50/50">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.nativeEvent.isComposing) return;
            if (e.key === 'Enter') handleAdd();
          }}
          placeholder={t.fieldNamePlaceholder}
          className="text-xs border rounded px-1.5 py-1 flex-1 min-w-0 focus:outline-none focus:ring-1 focus:ring-violet-400"
        />
        <select
          value={newType}
          onChange={(e) => setNewType(e.target.value as FieldType)}
          className="text-xs border rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400"
        >
          {fieldTypes.map((ft) => (
            <option key={ft.value} value={ft.value}>
              {ft.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          className="flex items-center text-violet-600 hover:text-violet-800 border border-violet-300 rounded px-1.5 py-1"
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
