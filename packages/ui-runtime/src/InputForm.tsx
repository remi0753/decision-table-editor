import type { FieldDef, FieldType, Logic } from '@leverie/engine';
import {
  defaultTranslations,
  type UiRuntimeTranslations,
} from './translations.js';

interface InputFormProps {
  logic: Logic;
  values: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  translations?: UiRuntimeTranslations;
  className?: string;
}

const inputBase =
  'w-full rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400';

export function InputForm({
  logic,
  values,
  onChange,
  translations,
  className,
}: InputFormProps) {
  const t = translations ?? defaultTranslations.en;
  const fields = Object.values(logic.fieldDefs);

  if (fields.length === 0) {
    return <p className="text-xs text-gray-400">{t.noFields}</p>;
  }

  return (
    <div
      className={
        className ??
        'grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-4 gap-y-3'
      }
    >
      {fields.map((field) => (
        <FieldRow
          key={field.id}
          field={field}
          value={values[field.id] ?? ''}
          onChange={(v) => onChange(field.id, v)}
          t={t}
        />
      ))}
    </div>
  );
}

function FieldRow({
  field,
  value,
  onChange,
  t,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
  t: UiRuntimeTranslations;
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={field.id}
        className="mb-1 flex items-center gap-1.5 text-xs font-medium text-gray-600"
      >
        <TypeIcon type={field.type} />
        <span className="truncate">{field.name}</span>
      </label>
      <FieldInput field={field} value={value} onChange={onChange} t={t} />
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  t,
}: {
  field: FieldDef;
  value: string;
  onChange: (v: string) => void;
  t: UiRuntimeTranslations;
}) {
  if (field.type === 'bool') {
    const options: { v: string; label: string }[] = [
      { v: '', label: t.unset },
      { v: 'true', label: t.yes },
      { v: 'false', label: t.no },
    ];
    return (
      <div
        role="radiogroup"
        aria-label={field.name}
        className="flex w-full rounded-md border border-gray-300 bg-white p-0.5"
      >
        {options.map((o) => {
          const active = value === o.v;
          return (
            <button
              key={o.v}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(o.v)}
              className={
                'flex-1 rounded px-2 py-1 text-xs font-medium transition-colors ' +
                (active
                  ? 'bg-violet-600 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-50')
              }
            >
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (field.type === 'enum') {
    return (
      <div className="relative">
        <select
          id={field.id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputBase} appearance-none pr-7`}
        >
          <option value="">{t.noSelection}</option>
          {(field.enumValues ?? []).map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
        <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-gray-400" />
      </div>
    );
  }

  if (field.type === 'date') {
    return (
      <input
        id={field.id}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputBase}
      />
    );
  }

  if (field.type === 'datetime') {
    return (
      <input
        id={field.id}
        type="datetime-local"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={inputBase}
      />
    );
  }

  if (field.type === 'number') {
    return (
      <input
        id={field.id}
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputBase} text-right tabular-nums`}
        placeholder={t.inputPlaceholder(field.name)}
      />
    );
  }

  return (
    <input
      id={field.id}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={inputBase}
      placeholder={t.inputPlaceholder(field.name)}
    />
  );
}

function TypeIcon({ type }: { type: FieldType }) {
  const common = {
    width: 12,
    height: 12,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: 'text-gray-400 shrink-0',
    'aria-hidden': true,
  };
  switch (type) {
    case 'number':
      return (
        <svg {...common}>
          <line x1="4" y1="9" x2="20" y2="9" />
          <line x1="4" y1="15" x2="20" y2="15" />
          <line x1="10" y1="3" x2="8" y2="21" />
          <line x1="16" y1="3" x2="14" y2="21" />
        </svg>
      );
    case 'string':
      return (
        <svg {...common}>
          <polyline points="4 7 4 4 20 4 20 7" />
          <line x1="9" y1="20" x2="15" y2="20" />
          <line x1="12" y1="4" x2="12" y2="20" />
        </svg>
      );
    case 'bool':
      return (
        <svg {...common}>
          <rect x="2" y="7" width="20" height="10" rx="5" />
          <circle cx="8" cy="12" r="2.5" fill="currentColor" />
        </svg>
      );
    case 'enum':
      return (
        <svg {...common}>
          <line x1="9" y1="6" x2="20" y2="6" />
          <line x1="9" y1="12" x2="20" y2="12" />
          <line x1="9" y1="18" x2="20" y2="18" />
          <circle cx="4" cy="6" r="1" fill="currentColor" stroke="none" />
          <circle cx="4" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="4" cy="18" r="1" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'date':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
      );
    case 'datetime':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="14" rx="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <polyline points="12 12 12 15 14 15" />
        </svg>
      );
  }
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      width={14}
      height={14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
