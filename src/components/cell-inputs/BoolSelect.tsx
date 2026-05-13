interface Props {
  value: string;
  onChange: (v: string) => void;
}

export function BoolSelect({ value, onChange }: Props) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
    >
      <option value="">選択してください</option>
      <option value="true">はい（true）</option>
      <option value="false">いいえ（false）</option>
    </select>
  );
}
