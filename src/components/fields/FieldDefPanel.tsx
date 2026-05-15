import {
  ChevronDown,
  ChevronUp,
  Download,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { InlineEdit } from '@/components/ui/InlineEdit';
import { exportFieldDefs, useImportFieldDefs } from '@/hooks/useImportExport';
import { useT } from '@/i18n/useT';
import { useLogicStore } from '@/store/logicStore';
import type { FieldType } from '@/types/logic';
import { EnumValuesEditor } from './EnumValuesEditor';

export function FieldDefPanel() {
  const [collapsed, setCollapsed] = useState(false);
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
  const importFieldDefsFn = useImportFieldDefs();
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
    <div className="border rounded-lg bg-white mb-4">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <span className="font-medium text-sm">{t.fieldDefinitions}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={importFieldDefsFn}
            title={t.importFieldDefsTitle}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-violet-600 border border-gray-200 hover:border-violet-200 rounded px-2 py-0.5"
          >
            <Upload size={12} /> {t.importFieldDefs}
          </button>
          <button
            type="button"
            onClick={() => exportFieldDefs(logic)}
            disabled={fieldDefs.length === 0}
            title={t.exportFieldDefsTitle}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-violet-600 border border-gray-200 hover:border-violet-200 rounded px-2 py-0.5 disabled:opacity-40 disabled:hover:text-gray-500 disabled:hover:border-gray-200"
          >
            <Download size={12} /> {t.exportFieldDefs}
          </button>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="text-gray-400 hover:text-gray-600 ml-1"
          >
            {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {!collapsed && (
        <div className="p-3 space-y-2">
          {fieldDefs.map((field) => (
            <div key={field.id} className="flex items-center gap-2 group">
              <InlineEdit
                value={field.name}
                onSave={(name) => handleRename(field.id, name)}
                className="text-sm font-medium min-w-16"
              />
              <select
                value={field.type}
                onChange={(e) =>
                  handleTypeChange(field.id, e.target.value as FieldType)
                }
                className="text-xs border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-violet-400"
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
              <button
                type="button"
                onClick={() =>
                  setDeleteConfirm({ id: field.id, name: field.name })
                }
                className="ml-auto opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          <div className="flex items-center gap-2 pt-1 border-t">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.nativeEvent.isComposing) return;
                if (e.key === 'Enter') handleAdd();
              }}
              placeholder={t.fieldNamePlaceholder}
              className="text-sm border rounded px-2 py-1 flex-1 focus:outline-none focus:ring-1 focus:ring-violet-400"
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
              className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 border border-violet-300 rounded px-2 py-1"
            >
              <Plus size={12} /> {t.add}
            </button>
          </div>
        </div>
      )}

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
