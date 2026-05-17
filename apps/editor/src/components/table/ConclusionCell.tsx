import { canReference } from '@leverie/checks';
import type { Conclusion, Table } from '@leverie/engine';
import * as Popover from '@radix-ui/react-popover';
import { useState } from 'react';
import { useT } from '@/i18n/useT';
import { cn } from '@/lib/utils';
import { useLogicStore } from '@/store/logicStore';

interface Props {
  tableId: string;
  rowId: string;
  conclusion: Conclusion;
  outputCols: Table['outputCols'];
  isLastRow?: boolean;
  onAdvance?: () => void;
}

export function ConclusionCell({
  tableId,
  rowId,
  conclusion,
  outputCols,
  isLastRow,
  onAdvance,
}: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<'terminal' | 'continue'>(conclusion.type);
  const [outputs, setOutputs] = useState<Record<string, string>>(
    conclusion.type === 'terminal' ? conclusion.outputs : {},
  );
  const [targetTableId, setTargetTableId] = useState<string>(
    conclusion.type === 'continue' ? conclusion.tableId : '',
  );

  const logic = useLogicStore((s) => s.logic);
  const setConclusion = useLogicStore((s) => s.setConclusion);
  const t = useT();

  const tables = Object.values(logic.tables).filter((tb) => tb.id !== tableId);

  const handleOpen = (o: boolean) => {
    if (o) {
      setType(conclusion.type);
      setOutputs(
        conclusion.type === 'terminal' ? { ...conclusion.outputs } : {},
      );
      setTargetTableId(
        conclusion.type === 'continue' ? conclusion.tableId : '',
      );
    }
    setOpen(o);
  };

  const handleSave = () => {
    if (type === 'terminal') {
      setConclusion(tableId, rowId, { type: 'terminal', outputs });
    } else {
      if (!targetTableId) return;
      setConclusion(tableId, rowId, {
        type: 'continue',
        tableId: targetTableId,
      });
    }
    setOpen(false);
  };

  const summaryText = () => {
    if (conclusion.type === 'terminal') {
      const entries = Object.entries(conclusion.outputs);
      if (entries.length === 0) return t.noOutput;
      return entries
        .map(([id, v]) => {
          const col = outputCols.find((oc) => oc.id === id);
          return `${col?.name ?? id}: ${v}`;
        })
        .join(' / ');
    }
    const tb = logic.tables[conclusion.tableId];
    return `→ ${tb?.name ?? conclusion.tableId}`;
  };

  return (
    <Popover.Root open={open} onOpenChange={handleOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          data-cell-trigger=""
          onKeyDown={(e) => {
            if (open) return;
            if (!isLastRow || !onAdvance) return;
            if (e.key === 'Tab' && !e.shiftKey) {
              e.preventDefault();
              onAdvance();
            } else if (e.key === 'Enter') {
              e.preventDefault();
              onAdvance();
            }
          }}
          className={cn(
            'w-full h-full px-2 py-1 text-left text-xs hover:bg-gray-50 transition-colors',
            conclusion.type === 'continue'
              ? 'text-purple-700'
              : 'text-gray-700',
          )}
        >
          {summaryText()}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="bg-white border rounded-lg shadow-lg p-4 w-80 z-50"
          sideOffset={4}
        >
          <div className="space-y-3">
            <div className="flex gap-4">
              <label className="flex items-center gap-1 cursor-pointer text-sm">
                <input
                  type="radio"
                  checked={type === 'terminal'}
                  onChange={() => setType('terminal')}
                />
                {t.terminalConclusion}
              </label>
              <label className="flex items-center gap-1 cursor-pointer text-sm">
                <input
                  type="radio"
                  checked={type === 'continue'}
                  onChange={() => setType('continue')}
                />
                {t.continueRef}
              </label>
            </div>

            {type === 'terminal' && (
              <div className="space-y-2">
                {outputCols.map((oc) => (
                  <div key={oc.id}>
                    <label
                      htmlFor={oc.id}
                      className="text-xs text-gray-500 block mb-0.5"
                    >
                      {oc.name}
                    </label>
                    <input
                      id={oc.id}
                      value={outputs[oc.id] ?? ''}
                      onChange={(e) =>
                        setOutputs((p) => ({ ...p, [oc.id]: e.target.value }))
                      }
                      className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
                      placeholder={t.outputPlaceholder}
                    />
                  </div>
                ))}
              </div>
            )}

            {type === 'continue' && (
              <div>
                <label
                  htmlFor="conclusion-ref-table"
                  className="text-xs text-gray-500 block mb-0.5"
                >
                  {t.refTable}
                </label>
                <select
                  id="conclusion-ref-table"
                  value={targetTableId}
                  onChange={(e) => setTargetTableId(e.target.value)}
                  className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
                >
                  <option value="">{t.pleaseSelect}</option>
                  {tables.map((tb) => {
                    const allowed = canReference(tableId, tb.id, logic.tables);
                    return (
                      <option key={tb.id} value={tb.id} disabled={!allowed}>
                        {allowed ? tb.name : t.circularRef(tb.name)}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={handleSave}
              disabled={type === 'continue' && !targetTableId}
              className="w-full bg-violet-600 text-white text-xs rounded px-3 py-1.5 hover:bg-violet-700 disabled:opacity-50"
            >
              {t.setCell}
            </button>
          </div>
          <Popover.Arrow className="fill-white stroke-gray-200" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
