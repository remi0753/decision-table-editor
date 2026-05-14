import { useT } from '@/i18n/useT';

interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function BoolSelect({ value, onChange }: Props) {
  const t = useT();
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
    >
      <option value="">{t.pleaseSelect}</option>
      <option value="true">{t.boolSelectTrue}</option>
      <option value="false">{t.boolSelectFalse}</option>
    </select>
  );
}
