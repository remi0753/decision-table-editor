# @leverie/ui-runtime

Reusable React UI parts for **running** a LEVERIE Logic — an input form generated from `fieldDefs`, an execution-trace view, and a combined `LogicRunner` component that wires them together.

This is the same UI the LEVERIE editor uses for its in-app evaluation panel, extracted into an independent package so it can be reused by future surfaces (the Phase 3 Runner UI, embedded widgets, custom dashboards, etc.).

## Install

```bash
pnpm add @leverie/ui-runtime @leverie/engine react
```

React 18 or 19 is a peer dependency. Tailwind CSS is used for styling — make sure the consuming app scans this package in its `content` glob (or vendors the classes).

## Usage

```tsx
import { LogicRunner, defaultTranslations } from '@leverie/ui-runtime';
import type { Logic } from '@leverie/engine';

export function MyRunner({ logic }: { logic: Logic }) {
  return (
    <LogicRunner
      logic={logic}
      translations={defaultTranslations.ja}
      runLabel="評価する"
      resetLabel="リセット"
    />
  );
}
```

Or compose the parts yourself:

```tsx
import { InputForm, TraceView, defaultTranslations } from '@leverie/ui-runtime';
import { evaluateTable, type EvalResult, type Logic } from '@leverie/engine';
import { useState } from 'react';

export function CustomRunner({ logic }: { logic: Logic }) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<EvalResult | null>(null);
  const t = defaultTranslations.en;

  return (
    <>
      <InputForm
        logic={logic}
        values={values}
        onChange={(id, v) => setValues((p) => ({ ...p, [id]: v }))}
        translations={t}
      />
      <button onClick={() => setResult(evaluateTable(logic.entryTableId, values, logic))}>
        Run
      </button>
      {result && <TraceView result={result} logic={logic} translations={t} />}
    </>
  );
}
```

## Exports

| Export                | What it is                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------- |
| `LogicRunner`         | Combined component: input form + run/reset buttons + trace. Manages its own state.        |
| `InputForm`           | Controlled form generated from `logic.fieldDefs`. You own `values` and `onChange`.        |
| `TraceView`           | Renders an `EvalResult` (matched conclusion + per-step trace, or "no match" diagnostic).  |
| `defaultTranslations` | `{ en, ja }` translation sets you can pass through `translations` props.                  |

## Translations

`UiRuntimeTranslations` covers all user-visible labels. Pass your own object to localize, or build on `defaultTranslations.en` / `defaultTranslations.ja`.

## License

Apache 2.0
