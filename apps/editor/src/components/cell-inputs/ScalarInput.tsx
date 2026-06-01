interface Props {
  value: string;
  onChange: (v: string) => void;
  type?: 'text' | 'number';
  placeholder?: string;
}

export function ScalarInput({
  value,
  onChange,
  type = 'text',
  placeholder,
}: Props) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-ring"
    />
  );
}
