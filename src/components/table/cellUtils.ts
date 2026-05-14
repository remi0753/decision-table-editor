import type { TranslationSet } from '@/i18n/translations';
import type { Cell, FieldDef } from '@/types/logic';

export function formatCellSummary(
  cell: Cell | undefined,
  field: FieldDef | null,
  t: TranslationSet,
): string {
  if (!cell) return t.noCondition;
  const opLabel = t.operatorLabels[cell.op] ?? cell.op;
  if (!cell.val) return opLabel;
  if (Array.isArray(cell.val)) {
    if (cell.op === 'between')
      return `${cell.val[0] ?? ''} 〜 ${cell.val[1] ?? ''}`;
    return cell.val.join(', ');
  }
  if (field?.type === 'bool') return cell.val === 'true' ? t.yes : t.no;
  return `${opLabel} ${cell.val}`;
}
