// Minimal RFC 4180 CSV parser (§5.3). No external dependency. Handles quoted
// fields, escaped quotes (""), commas/newlines inside quotes, CRLF/LF, and a
// leading BOM. Unquoted cells are trimmed; quoted cells are preserved verbatim.

export interface ParsedCsv {
  headers: string[];
  rows: Record<string, string>[];
}

export interface CsvParseError {
  code: string;
  message: string;
}

interface Cell {
  value: string;
  quoted: boolean;
}

function tokenize(text: string): Cell[][] {
  // Strip a leading UTF-8 BOM.
  const input = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const records: Cell[][] = [];
  let row: Cell[] = [];
  let field = '';
  let quoted = false;
  let inQuotes = false;
  let i = 0;
  let sawAny = false;

  const pushField = () => {
    row.push({ value: quoted ? field : field.trim(), quoted });
    field = '';
    quoted = false;
  };
  const pushRow = () => {
    pushField();
    records.push(row);
    row = [];
  };

  while (i < input.length) {
    const ch = input[i];
    sawAny = true;
    if (inQuotes) {
      if (ch === '"') {
        if (input[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      quoted = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      pushField();
      i += 1;
      continue;
    }
    if (ch === '\r') {
      // Swallow CR; the following LF (if any) ends the row.
      if (input[i + 1] === '\n') i += 1;
      pushRow();
      i += 1;
      continue;
    }
    if (ch === '\n') {
      pushRow();
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }

  // Flush the trailing field/row unless the input ended exactly on a newline.
  if (field !== '' || quoted || row.length > 0) {
    pushRow();
  } else if (!sawAny) {
    // empty input -> no records
  }
  return records;
}

function normalizeHeader(name: string): string {
  return name.trim().toLowerCase();
}

// Parse CSV text into headers + row records keyed by original header. headerRow
// selects which record is the header (default 0); records before it are
// ignored. Rejects empty input and duplicate headers after normalization.
export function parseCsv(
  text: string,
  headerRowIndex = 0,
): { ok: true; data: ParsedCsv } | { ok: false; error: CsvParseError } {
  const records = tokenize(text).filter(
    // Drop fully-empty trailing/blank lines (a single empty unquoted cell).
    (r) => !(r.length === 1 && r[0]?.value === '' && !r[0]?.quoted),
  );
  if (records.length <= headerRowIndex) {
    return {
      ok: false,
      error: { code: 'empty_csv', message: 'CSV has no header row.' },
    };
  }

  const headerCells = records[headerRowIndex];
  if (!headerCells) {
    return {
      ok: false,
      error: { code: 'empty_csv', message: 'CSV has no header row.' },
    };
  }
  const headers = headerCells.map((c) => c.value);
  if (headers.some((h) => h === '')) {
    return {
      ok: false,
      error: {
        code: 'blank_header',
        message: 'Header row has a blank column.',
      },
    };
  }
  const seen = new Set<string>();
  for (const h of headers) {
    const key = normalizeHeader(h);
    if (seen.has(key)) {
      return {
        ok: false,
        error: {
          code: 'duplicate_header',
          message: `Duplicate column header: "${h}".`,
        },
      };
    }
    seen.add(key);
  }

  const rows: Record<string, string>[] = [];
  for (let r = headerRowIndex + 1; r < records.length; r += 1) {
    const cells = records[r] ?? [];
    const record: Record<string, string> = {};
    headers.forEach((h, idx) => {
      record[h] = cells[idx]?.value ?? '';
    });
    rows.push(record);
  }

  return { ok: true, data: { headers, rows } };
}
