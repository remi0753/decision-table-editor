import type { Logic } from '@leverie/engine';
import { useT } from '@/i18n/useT';
import { useUiStore } from '@/store/uiStore';

interface Props {
  logic: Logic;
}

export function InputForm({ logic }: Props) {
  const evalInputs = useUiStore((s) => s.evalInputs);
  const setEvalInput = useUiStore((s) => s.setEvalInput);
  const t = useT();

  const fields = Object.values(logic.fieldDefs);

  if (fields.length === 0) {
    return <p className="text-xs text-gray-400">{t.noFields}</p>;
  }

  return (
    <div className="space-y-2">
      {fields.map((field) => {
        const value = evalInputs[field.id] ?? '';
        return (
          <div key={field.id}>
            <label
              htmlFor={field.id}
              className="text-xs text-gray-600 block mb-0.5"
            >
              {field.name}
            </label>
            {field.type === 'bool' ? (
              <div className="flex gap-3">
                {(['', 'true', 'false'] as const).map((v) => (
                  <label
                    key={v}
                    className="flex items-center gap-1 text-sm cursor-pointer"
                  >
                    <input
                      type="radio"
                      checked={value === v}
                      onChange={() => setEvalInput(field.id, v)}
                    />
                    {v === '' ? t.unset : v === 'true' ? t.yes : t.no}
                  </label>
                ))}
              </div>
            ) : field.type === 'enum' ? (
              <select
                id={field.id}
                value={value}
                onChange={(e) => setEvalInput(field.id, e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
              >
                <option value="">{t.noSelection}</option>
                {(field.enumValues ?? []).map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            ) : field.type === 'date' ? (
              <input
                id={field.id}
                type="date"
                value={value}
                onChange={(e) => setEvalInput(field.id, e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
              />
            ) : field.type === 'datetime' ? (
              <input
                id={field.id}
                type="datetime-local"
                value={value}
                onChange={(e) => setEvalInput(field.id, e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
              />
            ) : (
              <input
                id={field.id}
                type={field.type === 'number' ? 'number' : 'text'}
                value={value}
                onChange={(e) => setEvalInput(field.id, e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
                placeholder={t.inputPlaceholder(field.name)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}
