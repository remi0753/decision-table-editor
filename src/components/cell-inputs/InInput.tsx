import { useState } from 'react';
import { X } from 'lucide-react';

interface TagInputProps {
  values: string[];
  onChange: (values: string[]) => void;
}

export function TagInput({ values, onChange }: TagInputProps) {
  const [input, setInput] = useState('');

  const add = () => {
    const v = input.trim();
    if (!v || values.includes(v)) return;
    onChange([...values, v]);
    setInput('');
  };

  return (
    <div className="flex flex-wrap gap-1 border rounded p-1 min-h-8">
      {values.map(v => (
        <span key={v} className="inline-flex items-center gap-0.5 bg-blue-50 border border-blue-200 rounded px-1.5 py-0.5 text-xs">
          {v}
          <button onClick={() => onChange(values.filter(x => x !== v))} className="text-gray-400 hover:text-red-500">
            <X size={10} />
          </button>
        </span>
      ))}
      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(); } }}
        placeholder="入力してEnter"
        className="flex-1 min-w-16 text-sm outline-none"
      />
    </div>
  );
}

interface EnumCheckboxInputProps {
  enumValues: string[];
  values: string[];
  onChange: (values: string[]) => void;
}

export function EnumCheckboxInput({ enumValues, values, onChange }: EnumCheckboxInputProps) {
  const toggle = (v: string) => {
    if (values.includes(v)) onChange(values.filter(x => x !== v));
    else onChange([...values, v]);
  };

  return (
    <div className="flex flex-wrap gap-1">
      {enumValues.map(v => (
        <label key={v} className="flex items-center gap-1 cursor-pointer">
          <input
            type="checkbox"
            checked={values.includes(v)}
            onChange={() => toggle(v)}
            className="rounded"
          />
          <span className="text-sm">{v}</span>
        </label>
      ))}
    </div>
  );
}
