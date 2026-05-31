import type { FieldDef, Logic } from '@leverie/engine';

// Code-snippet generation for the "Use via API" dialog.
//
// Everything here is pure string building from a Logic plus the resolved
// endpoint origin, so the dialog can render copy-paste-ready examples that use
// *this* logic's real field names, id, and version — not a generic template.
// The API key is never embedded: snippets reference a $LEVERIE_API_KEY
// placeholder, because the raw secret is only ever shown once at creation.

export type SnippetLang = 'curl' | 'typescript' | 'python' | 'mcp';

export const SNIPPET_LANGS: { id: SnippetLang; label: string }[] = [
  { id: 'curl', label: 'cURL' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'mcp', label: 'MCP' },
];

/** Version target reflected in the snippet's `?version=` query. */
export type VersionTarget = 'production' | 'latest';

export type ApiInputField = {
  name: string;
  /** Human-readable type label for the "what to send" summary. */
  typeLabel: string;
  enumValues?: string[];
};

const KEY_PLACEHOLDER = '$LEVERIE_API_KEY';

function typeLabel(field: FieldDef): string {
  if (field.type === 'enum') {
    const values = field.enumValues ?? [];
    return values.length > 0 ? `enum (${values.join(', ')})` : 'enum';
  }
  return field.type;
}

/** Ordered list of input fields for the "what to send" summary table. */
export function logicInputFields(logic: Logic): ApiInputField[] {
  return Object.values(logic.fieldDefs).map((field) => ({
    name: field.name,
    typeLabel: typeLabel(field),
    enumValues: field.enumValues,
  }));
}

function exampleValue(field: FieldDef): string | number | boolean {
  switch (field.type) {
    case 'number':
      return 0;
    case 'bool':
      return true;
    case 'enum':
      return field.enumValues?.[0] ?? 'value';
    case 'date':
      return '2026-01-01';
    case 'datetime':
      return '2026-01-01T09:00:00Z';
    default:
      return 'example';
  }
}

/** Build an example `inputs` payload keyed by field name. */
export function buildExampleInputs(logic: Logic): Record<string, unknown> {
  const inputs: Record<string, unknown> = {};
  for (const field of Object.values(logic.fieldDefs)) {
    inputs[field.name] = exampleValue(field);
  }
  return inputs;
}

/** Indent every line except the first by `spaces`, for embedding JSON blocks. */
function reindent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line, i) => (i === 0 ? line : pad + line))
    .join('\n');
}

function versionQuery(version: VersionTarget): string {
  // production is the route default, so keep the common case clean.
  return version === 'production' ? '' : '?version=latest';
}

/** Render a flat record as Python literal lines (booleans become True/False). */
function pythonInputs(inputs: Record<string, unknown>, indent: number): string {
  const entries = Object.entries(inputs);
  if (entries.length === 0) return '{}';
  const pad = ' '.repeat(indent + 4);
  const lines = entries.map(([key, value]) => {
    let literal: string;
    if (typeof value === 'boolean') literal = value ? 'True' : 'False';
    else if (typeof value === 'number') literal = String(value);
    else literal = JSON.stringify(value);
    return `${pad}${JSON.stringify(key)}: ${literal},`;
  });
  return `{\n${lines.join('\n')}\n${' '.repeat(indent)}}`;
}

export type SnippetContext = {
  logic: Logic;
  /** Resolved origin for the API, e.g. "https://app.example.com". */
  apiOrigin: string;
  logicId: string;
  /**
   * DB slug = the MCP tool name (workspace-unique, hyphenated, may carry a
   * disambiguation suffix). Must come from the cloud, not be recomputed from
   * the logic name, or the MCP `tools/call` will not resolve.
   */
  logicSlug: string;
  version: VersionTarget;
};

export function buildSnippet(lang: SnippetLang, ctx: SnippetContext): string {
  const { logic, apiOrigin, logicId, logicSlug, version } = ctx;
  const inputs = buildExampleInputs(logic);
  const evalUrl = `${apiOrigin}/v1/logics/${logicId}/evaluate${versionQuery(version)}`;
  const mcpUrl = `${apiOrigin}/v1/mcp`;

  switch (lang) {
    case 'curl': {
      const body = JSON.stringify({ inputs }, null, 2);
      return [
        `curl -X POST '${evalUrl}' \\`,
        `  -H 'Authorization: Bearer ${KEY_PLACEHOLDER}' \\`,
        `  -H 'Content-Type: application/json' \\`,
        `  -d '${body}'`,
      ].join('\n');
    }
    case 'typescript': {
      const inputsLiteral = reindent(JSON.stringify(inputs, null, 2), 4);
      return [
        `const res = await fetch("${evalUrl}", {`,
        '  method: "POST",',
        '  headers: {',
        // biome-ignore lint/suspicious/noTemplateCurlyInString: literal text emitted into the generated TypeScript snippet.
        '    Authorization: `Bearer ${process.env.LEVERIE_API_KEY}`,',
        '    "Content-Type": "application/json",',
        '  },',
        '  body: JSON.stringify({',
        `    inputs: ${inputsLiteral},`,
        '  }),',
        '});',
        '',
        'const data = await res.json();',
        'console.log(data.result);',
      ].join('\n');
    }
    case 'python': {
      return [
        'import os',
        'import requests',
        '',
        'res = requests.post(',
        `    "${evalUrl}",`,
        '    headers={"Authorization": f"Bearer {os.environ[\'LEVERIE_API_KEY\']}"},',
        `    json={"inputs": ${pythonInputs(inputs, 4)}},`,
        ')',
        'print(res.json()["result"])',
      ].join('\n');
    }
    case 'mcp': {
      // tools/call always evaluates the production snapshot, so version is
      // intentionally not part of the MCP request.
      const rpc = {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: {
          name: logicSlug,
          arguments: inputs,
        },
      };
      const body = JSON.stringify(rpc, null, 2);
      return [
        `curl -X POST '${mcpUrl}' \\`,
        `  -H 'Authorization: Bearer ${KEY_PLACEHOLDER}' \\`,
        `  -H 'Content-Type: application/json' \\`,
        `  -d '${body}'`,
      ].join('\n');
    }
  }
}
