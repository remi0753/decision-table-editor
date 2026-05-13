import { useState } from 'react';
import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { type FieldType } from '@/types/logic';
import { useLogicStore } from '@/store/logicStore';
import { InlineEdit } from '@/components/ui/InlineEdit';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EnumValuesEditor } from './EnumValuesEditor';

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'string', label: 'テキスト' },
  { value: 'number', label: '数値' },
  { value: 'bool', label: '真偽値' },
  { value: 'enum', label: '選択肢' },
  { value: 'date', label: '日付' },
  { value: 'datetime', label: '日時' },
];

export function FieldDefPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<FieldType>('string');
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
  const [typeChangeConfirm, setTypeChangeConfirm] = useState<{ id: string; newType: FieldType; count: number } | null>(null);

  const logic = useLogicStore(s => s.logic);
  const addField = useLogicStore(s => s.addField);
  const renameField = useLogicStore(s => s.renameField);
  const changeFieldType = useLogicStore(s => s.changeFieldType);
  const deleteField = useLogicStore(s => s.deleteField);

  const fieldDefs = Object.values(logic.fieldDefs);

  const handleAdd = () => {
    const name = newName.trim();
    if (!name) { toast.error('フィールド名を入力してください。'); return; }
    const result = addField(name, newType, newType === 'enum' ? [] : undefined);
    if (result.error) { toast.error(result.error); return; }
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
        count += table.rows.filter(r => r.cells[col.id]).length;
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
    if (result.error) { toast.error(result.error); return; }
    setDeleteConfirm(null);
  };

  return (
    <div className="border rounded-lg bg-white mb-4">
      <div className="flex items-center justify-between px-4 py-2 border-b">
        <span className="font-medium text-sm">フィールド定義</span>
        <button onClick={() => setCollapsed(!collapsed)} className="text-gray-400 hover:text-gray-600">
          {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </button>
      </div>

      {!collapsed && (
        <div className="p-3 space-y-2">
          {fieldDefs.map(field => (
            <div key={field.id} className="flex items-center gap-2 group">
              <InlineEdit
                value={field.name}
                onSave={name => handleRename(field.id, name)}
                className="text-sm font-medium min-w-16"
              />
              <select
                value={field.type}
                onChange={e => handleTypeChange(field.id, e.target.value as FieldType)}
                className="text-xs border rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-violet-400"
              >
                {FIELD_TYPES.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
              {field.type === 'enum' && (
                <EnumValuesEditor fieldId={field.id} enumValues={field.enumValues ?? []} />
              )}
              <button
                onClick={() => setDeleteConfirm({ id: field.id, name: field.name })}
                className="ml-auto opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}

          <div className="flex items-center gap-2 pt-1 border-t">
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => { if (e.nativeEvent.isComposing) return; if (e.key === 'Enter') handleAdd(); }}
              placeholder="フィールド名"
              className="text-sm border rounded px-2 py-1 flex-1 focus:outline-none focus:ring-1 focus:ring-violet-400"
            />
            <select
              value={newType}
              onChange={e => setNewType(e.target.value as FieldType)}
              className="text-xs border rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-violet-400"
            >
              {FIELD_TYPES.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <button
              onClick={handleAdd}
              className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 border border-violet-300 rounded px-2 py-1"
            >
              <Plus size={12} /> 追加
            </button>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleteConfirm}
        onOpenChange={open => !open && setDeleteConfirm(null)}
        title="フィールドを削除"
        description={`「${deleteConfirm?.name}」を削除しますか？`}
        confirmLabel="削除"
        destructive
        onConfirm={() => deleteConfirm && handleDelete(deleteConfirm.id)}
      />

      <ConfirmDialog
        open={!!typeChangeConfirm}
        onOpenChange={open => !open && setTypeChangeConfirm(null)}
        title="フィールド型を変更"
        description={`型を変更すると、このフィールドを使用している${typeChangeConfirm?.count}件の条件がリセットされます。続けますか？`}
        confirmLabel="変更する"
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
