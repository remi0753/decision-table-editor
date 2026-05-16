import * as Popover from '@radix-ui/react-popover';
import { useState } from 'react';
import { BetweenInput } from '@/components/cell-inputs/BetweenInput';
import { BoolSelect } from '@/components/cell-inputs/BoolSelect';
import { EnumCheckboxInput, TagInput } from '@/components/cell-inputs/InInput';
import { ScalarInput } from '@/components/cell-inputs/ScalarInput';
import { useT } from '@/i18n/useT';
import { OPERATORS_BY_TYPE } from '@/lib/operatorLabels';
import { cn } from '@/lib/utils';
import type { Cell, FieldDef, Operator } from '@/types/logic';
import { formatCellSummary } from './cellUtils';

interface Props {
  cell: Cell | undefined;
  field: FieldDef | null;
  onSave: (cell: Cell) => void;
  onClear: () => void;
}

function ValueInput({
  op,
  field,
  val,
  onChange,
}: {
  op: Operator;
  field: FieldDef;
  val: string | string[] | undefined;
  onChange: (val: string | string[] | undefined) => void;
}) {
  const t = useT();
  const noValOps = [
    'null',
    'before_today',
    'today_or_before',
    'after_today',
    'today_or_after',
  ];
  if (noValOps.includes(op)) return null;

  if (op === 'between') {
    const arr = Array.isArray(val) ? val : ['', ''];
    const lo = arr[0] ?? '';
    const hi = arr[1] ?? '';
    const type =
      field.type === 'date'
        ? 'date'
        : field.type === 'datetime'
          ? 'datetime'
          : 'number';
    return (
      <BetweenInput
        lo={lo}
        hi={hi}
        onChangeLo={(v) => onChange([v, hi])}
        onChangeHi={(v) => onChange([lo, v])}
        type={type}
      />
    );
  }

  if (op === 'in') {
    const arr = Array.isArray(val) ? val : [];
    if (field.type === 'enum') {
      return (
        <EnumCheckboxInput
          enumValues={field.enumValues ?? []}
          values={arr}
          onChange={onChange}
        />
      );
    }
    return <TagInput values={arr} onChange={onChange} />;
  }

  const strVal = typeof val === 'string' ? val : '';

  if (field.type === 'bool' && op === '=')
    return <BoolSelect value={strVal} onChange={onChange} />;

  if (field.type === 'enum') {
    return (
      <select
        value={strVal}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
      >
        <option value="">{t.pleaseSelect}</option>
        {(field.enumValues ?? []).map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    );
  }

  if (field.type === 'date') {
    return (
      <input
        type="date"
        value={strVal}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
      />
    );
  }

  if (field.type === 'datetime') {
    return (
      <input
        type="datetime-local"
        value={strVal}
        onChange={(e) => onChange(e.target.value)}
        className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
      />
    );
  }

  return (
    <ScalarInput
      value={strVal}
      onChange={onChange}
      type={field.type === 'number' ? 'number' : 'text'}
    />
  );
}

export function CellEditor({ cell, field, onSave, onClear }: Props) {
  const [open, setOpen] = useState(false);
  const [op, setOp] = useState<Operator>(cell?.op ?? '=');
  const [val, setVal] = useState<string | string[] | undefined>(cell?.val);
  const t = useT();

  const handleOpen = (o: boolean) => {
    if (o) {
      setOp(
        cell?.op ?? (field ? (OPERATORS_BY_TYPE[field.type][0] ?? '=') : '='),
      );
      setVal(cell?.val);
    }
    setOpen(o);
  };

  const handleOpChange = (newOp: Operator) => {
    setOp(newOp);
    setVal(undefined);
  };

  const handleSave = () => {
    onSave({ op, val });
    setOpen(false);
  };

  const summary = formatCellSummary(cell, field, t);

  return (
    <Popover.Root open={open} onOpenChange={handleOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          data-cell-trigger=""
          className={cn(
            'w-full h-full px-2 py-1 text-left text-xs hover:bg-gray-50 transition-colors',
            !cell ? 'text-gray-400 italic' : 'text-gray-700',
          )}
        >
          {field ? summary : <span className="text-gray-300">—</span>}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="bg-white border rounded-lg shadow-lg p-3 w-72 z-50"
          sideOffset={4}
        >
          {!field ? (
            <p className="text-sm text-gray-500">{t.assignField}</p>
          ) : (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="cell-operator"
                  className="text-xs text-gray-500 mb-1 block"
                >
                  {t.operatorLabel}
                </label>
                <select
                  id="cell-operator"
                  value={op}
                  onChange={(e) => handleOpChange(e.target.value as Operator)}
                  className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
                >
                  {OPERATORS_BY_TYPE[field.type].map((o) => (
                    <option key={o} value={o}>
                      {t.operatorLabels[o]}
                    </option>
                  ))}
                </select>
              </div>

              <ValueInput op={op} field={field} val={val} onChange={setVal} />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex-1 bg-violet-600 text-white text-xs rounded px-3 py-1.5 hover:bg-violet-700"
                >
                  {t.setCell}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClear();
                    setOpen(false);
                  }}
                  className="flex-1 border text-xs rounded px-3 py-1.5 hover:bg-gray-50 text-gray-600"
                >
                  {t.wildcard}
                </button>
              </div>
            </div>
          )}
          <Popover.Arrow className="fill-white stroke-gray-200" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
