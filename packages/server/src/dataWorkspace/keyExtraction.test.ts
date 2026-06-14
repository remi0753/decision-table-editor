import { describe, expect, it } from 'vitest';
import { extractKeyCandidates, type KeyFactView } from './keyExtraction.js';

const orderKey: KeyFactView = {
  factId: 'fOrder',
  label: 'Order ID',
  aliases: ['order_id', '注文番号'],
};
const ticketKey: KeyFactView = {
  factId: 'fTicket',
  label: 'Ticket',
  aliases: [],
};

describe('extractKeyCandidates', () => {
  it('extracts a labelled value', () => {
    const r = extractKeyCandidates('Order ID: 12345\nCustomer tier: Gold', [
      orderKey,
    ]);
    expect(r[0]).toMatchObject({
      factId: 'fOrder',
      value: '12345',
      source: 'alias',
    });
  });

  it('matches aliases (including non-ASCII)', () => {
    const r = extractKeyCandidates('注文番号 = ABC-99', [orderKey]);
    expect(r.some((k) => k.value === 'ABC-99')).toBe(true);
  });

  it('extracts from a URL path segment', () => {
    const r = extractKeyCandidates('https://shop.example.com/orders/55512', [
      orderKey,
    ]);
    expect(r.some((k) => k.value === '55512' && k.source === 'url')).toBe(true);
  });

  it('falls back to a bare token only with a single key fact', () => {
    const single = extractKeyCandidates('  98765 ', [orderKey]);
    expect(single[0]).toMatchObject({
      factId: 'fOrder',
      value: '98765',
      source: 'regex',
    });

    const multi = extractKeyCandidates('98765', [orderKey, ticketKey]);
    expect(multi).toHaveLength(0);
  });

  it('returns candidates sorted by confidence', () => {
    const r = extractKeyCandidates('Order ID: 12345', [orderKey]);
    for (let i = 1; i < r.length; i += 1) {
      const prev = r[i - 1];
      const cur = r[i];
      if (prev && cur)
        expect(prev.confidence).toBeGreaterThanOrEqual(cur.confidence);
    }
  });
});
