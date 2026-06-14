// Sensitive-value masking for decision_fact_value storage (§10.2, §3.10). Pure
// and DB-free. The fact's logging_policy decides what is persisted:
//   full   -> store the raw value
//   masked -> store only a masked rendering
//   hash   -> store only a hash in masked_value
//   omit   -> store neither value nor masked_value (state/provenance still kept)

export type FactLoggingPolicy = 'full' | 'masked' | 'hash' | 'omit';

export interface StoredValue {
  value: string | null;
  maskedValue: string | null;
}

// Mask a string for display: keep the last 4 characters when longer than 8,
// otherwise a fixed dot run (§10.2). Non-string domains have no special rule
// yet, so they pass through this same string masking.
export function maskString(raw: string): string {
  if (raw.length > 8) return `••••${raw.slice(-4)}`;
  return '••••';
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

// Apply a logging policy to a raw value, producing the (value, masked_value)
// pair to persist. `hashKey` (when provided) keys the hash so stored hashes are
// not trivially reversible across workspaces.
export async function applyLoggingPolicy(
  rawValue: string,
  policy: FactLoggingPolicy,
  hashKey?: string,
): Promise<StoredValue> {
  switch (policy) {
    case 'full':
      return { value: rawValue, maskedValue: null };
    case 'masked':
      return { value: null, maskedValue: maskString(rawValue) };
    case 'hash': {
      const hex = await sha256Hex(`${hashKey ?? ''}:${rawValue}`);
      return { value: null, maskedValue: `sha256:${hex}` };
    }
    case 'omit':
      return { value: null, maskedValue: null };
    default: {
      const _exhaustive: never = policy;
      return _exhaustive;
    }
  }
}
