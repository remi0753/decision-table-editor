interface Props {
  lo: string;
  hi: string;
  onChangeLo: (v: string) => void;
  onChangeHi: (v: string) => void;
  type: 'number' | 'date' | 'datetime';
}

export function BetweenInput({ lo, hi, onChangeLo, onChangeHi, type }: Props) {
  const inputType = type === 'number' ? 'number' : type === 'date' ? 'date' : 'datetime-local';
  return (
    <div className="flex items-center gap-1">
      <input
        type={inputType}
        value={lo}
        onChange={e => onChangeLo(e.target.value)}
        className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
        placeholder="以上"
      />
      <span className="text-gray-400 text-xs whitespace-nowrap">〜</span>
      <input
        type={inputType}
        value={hi}
        onChange={e => onChangeHi(e.target.value)}
        className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
        placeholder="以下"
      />
    </div>
  );
}
