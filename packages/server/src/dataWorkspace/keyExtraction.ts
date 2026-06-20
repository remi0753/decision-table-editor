// Rule-based key-candidate extraction from pasted text (§5.6, §11.2). Pure and
// DB-free. The browser may pre-extract, but the server runs the authoritative
// rule-based pass. No LLM, no network. Extraction is intentionally conservative:
// it prefers labelled values ("Order ID: 12345") and falls back to a bare token
// only when the whole paste is a single token and there is exactly one key fact.

export interface KeyFactView {
  factId: string;
  label: string;
  aliases: string[];
}

export interface ExtractedKey {
  factId: string;
  label: string;
  value: string;
  confidence: number;
  // 'host' = pushed by a webhook/embed host system (trusted, not text-parsed).
  source: 'alias' | 'url' | 'regex' | 'host';
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// A value token: letters/digits and common id punctuation, not whitespace.
const VALUE = '([A-Za-z0-9][A-Za-z0-9_\\-/.]*)';

// Extract key candidates for the given key facts. Returns at most one candidate
// per (factId, value), best confidence first. Aliases and the fact label are
// matched case-insensitively as "label <sep> value".
export function extractKeyCandidates(
  text: string,
  keyFacts: KeyFactView[],
): ExtractedKey[] {
  const out: ExtractedKey[] = [];
  const seen = new Set<string>();
  const trimmed = text.trim();

  const push = (k: ExtractedKey) => {
    const dedupe = `${k.factId}::${k.value}`;
    if (seen.has(dedupe)) return;
    seen.add(dedupe);
    out.push(k);
  };

  for (const fact of keyFacts) {
    const terms = [fact.label, ...fact.aliases]
      .map((t) => t.trim())
      .filter((t) => t.length > 0)
      // Longer terms first so "order id" wins over "id".
      .sort((a, b) => b.length - a.length);

    for (const term of terms) {
      // "<term> : 12345", "<term> # 12345", "<term> = 12345", "<term> 12345"
      const labelled = new RegExp(
        `${escapeRegExp(term)}\\s*[:#=]?\\s*${VALUE}`,
        'i',
      );
      const m = labelled.exec(text);
      if (m?.[1]) {
        push({
          factId: fact.factId,
          label: fact.label,
          value: m[1],
          confidence: 0.92,
          source: 'alias',
        });
      }

      // URL path segment: ".../<stem>s/12345" or ".../<stem>/12345". Try the
      // term with spaces removed and the term's first word (so "Order ID"
      // matches ".../orders/12345" via the "order" stem).
      const stems = new Set<string>([
        term.replace(/\s+/g, ''),
        term.split(/\s+/)[0] ?? term,
        term.split(/[\s_]+/)[0] ?? term,
      ]);
      for (const stem of stems) {
        if (!stem) continue;
        const urlRe = new RegExp(`${escapeRegExp(stem)}s?/${VALUE}`, 'i');
        const um = urlRe.exec(text);
        if (um?.[1]) {
          push({
            factId: fact.factId,
            label: fact.label,
            value: um[1],
            confidence: 0.7,
            source: 'url',
          });
        }
      }
    }
  }

  // Bare-token fallback: a single key fact and the whole paste is one token.
  if (
    out.length === 0 &&
    keyFacts.length === 1 &&
    /^[A-Za-z0-9_\-/.]+$/.test(trimmed)
  ) {
    const fact = keyFacts[0];
    if (fact) {
      push({
        factId: fact.factId,
        label: fact.label,
        value: trimmed,
        confidence: 0.6,
        source: 'regex',
      });
    }
  }

  return out.sort((a, b) => b.confidence - a.confidence);
}
