import type { FieldType, Operator } from '@leverie/engine';

export const OPERATORS_BY_TYPE: Record<FieldType, Operator[]> = {
  number: ['=', '!=', '<', '<=', '>', '>=', 'between', 'null'],
  string: ['=', '!=', 'in', 'contains', 'starts_with', 'ends_with', 'null'],
  bool: ['=', 'null'],
  enum: ['=', '!=', 'in', 'null'],
  date: [
    '=',
    '!=',
    '<',
    '<=',
    '>',
    '>=',
    'between',
    'before_today',
    'today_or_before',
    'after_today',
    'today_or_after',
    'null',
  ],
  datetime: ['=', '!=', '<', '<=', '>', '>=', 'between', 'null'],
};
