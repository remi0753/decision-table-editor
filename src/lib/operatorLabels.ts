import { type FieldType, type Operator } from '@/types/logic';

export const OPERATOR_LABELS: Record<string, string> = {
  '=':               '等しい',
  '!=':              '等しくない',
  '<':               'より小さい（未満）',
  '<=':              '以下',
  '>':               'より大きい（超過）',
  '>=':              '以上',
  'between':         '範囲内',
  'contains':        '含む',
  'starts_with':     'から始まる',
  'ends_with':       'で終わる',
  'in':              'いずれかに一致',
  'null':            '値がない',
  'before_today':    '今日より前',
  'today_or_before': '今日以前',
  'after_today':     '今日より後',
  'today_or_after':  '今日以降',
};

export const OPERATORS_BY_TYPE: Record<FieldType, Operator[]> = {
  number:   ['=', '!=', '<', '<=', '>', '>=', 'between', 'null'],
  string:   ['=', '!=', 'in', 'contains', 'starts_with', 'ends_with', 'null'],
  bool:     ['=', 'null'],
  enum:     ['=', '!=', 'in', 'null'],
  date:     ['=', '!=', '<', '<=', '>', '>=', 'between', 'before_today', 'today_or_before', 'after_today', 'today_or_after', 'null'],
  datetime: ['=', '!=', '<', '<=', '>', '>=', 'between', 'null'],
};
