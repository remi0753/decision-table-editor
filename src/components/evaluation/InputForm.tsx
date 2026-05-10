import { type Logic } from '@/types/logic';
import { useUiStore } from '@/store/uiStore';

interface Props {
  logic: Logic;
}

export function InputForm({ logic }: Props) {
  const evalInputs = useUiStore(s => s.evalInputs);
  const setEvalInput = useUiStore(s => s.setEvalInput);

  const fields = Object.values(logic.fieldDefs);

  if (fields.length === 0) {
    return <p className="text-xs text-gray-400">フィールドが定義されていません。</p>;
  }

  return (
    <div className="space-y-2">
      {fields.map(field => {
        const value = evalInputs[field.id] ?? '';
        return (
          <div key={field.id}>
            <label className="text-xs text-gray-600 block mb-0.5">{field.name}</label>
            {field.type === 'bool' ? (
              <div className="flex gap-3">
                {['', 'true', 'false'].map(v => (
                  <label key={v} className="flex items-center gap-1 text-sm cursor-pointer">
                    <input
                      type="radio"
                      checked={value === v}
                      onChange={() => setEvalInput(field.id, v)}
                    />
                    {v === '' ? '（未入力）' : v === 'true' ? 'はい' : 'いいえ'}
                  </label>
                ))}
              </div>
            ) : field.type === 'enum' ? (
              <select
                value={value}
                onChange={e => setEvalInput(field.id, e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="">（未選択）</option>
                {(field.enumValues ?? []).map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            ) : field.type === 'date' ? (
              <input
                type="date"
                value={value}
                onChange={e => setEvalInput(field.id, e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            ) : field.type === 'datetime' ? (
              <input
                type="datetime-local"
                value={value}
                onChange={e => setEvalInput(field.id, e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            ) : (
              <input
                type={field.type === 'number' ? 'number' : 'text'}
                value={value}
                onChange={e => setEvalInput(field.id, e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400"
                placeholder={`${field.name}を入力`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
