import { type Cell, type FieldDef } from '@/types/logic';
import { OPERATOR_LABELS } from '@/lib/operatorLabels';

export function formatCellSummary(cell: Cell | undefined, field: FieldDef | null): string {
  if (!cell) return '（条件なし）';
  const opLabel = OPERATOR_LABELS[cell.op] ?? cell.op;
  if (!cell.val) return opLabel;
  if (Array.isArray(cell.val)) {
    if (cell.op === 'between') return `${cell.val[0] ?? ''} 〜 ${cell.val[1] ?? ''}`;
    return cell.val.join(', ');
  }
  if (field?.type === 'bool') return cell.val === 'true' ? 'はい' : 'いいえ';
  return `${opLabel} ${cell.val}`;
}
