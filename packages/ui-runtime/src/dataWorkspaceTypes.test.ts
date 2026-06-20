import { describe, expect, it } from 'vitest';
import {
  buildFieldAliasMap,
  factSourceToWorkspaceSource,
  factStateToWorkspaceStatus,
} from './dataWorkspaceTypes.js';

describe('factSourceToWorkspaceSource', () => {
  it('maps reference_table to api and clipboard to manual', () => {
    expect(factSourceToWorkspaceSource('reference_table')).toBe('api');
    expect(factSourceToWorkspaceSource('clipboard')).toBe('manual');
  });

  it('maps shared sources 1:1', () => {
    expect(factSourceToWorkspaceSource('manual')).toBe('manual');
    expect(factSourceToWorkspaceSource('url_query')).toBe('url_query');
    expect(factSourceToWorkspaceSource('derived')).toBe('derived');
    expect(factSourceToWorkspaceSource('internal')).toBe('internal');
  });
});

describe('factStateToWorkspaceStatus', () => {
  it('collapses resolved/manual/confirmed/hidden to known', () => {
    expect(factStateToWorkspaceStatus('resolved')).toBe('known');
    expect(factStateToWorkspaceStatus('manual')).toBe('known');
    expect(factStateToWorkspaceStatus('confirmed')).toBe('known');
    expect(factStateToWorkspaceStatus('hidden')).toBe('known');
  });

  it('maps unavailable to missing and the rest 1:1', () => {
    expect(factStateToWorkspaceStatus('unavailable')).toBe('missing');
    expect(factStateToWorkspaceStatus('missing')).toBe('missing');
    expect(factStateToWorkspaceStatus('needs_confirmation')).toBe(
      'needs_confirmation',
    );
    expect(factStateToWorkspaceStatus('invalid')).toBe('invalid');
  });
});

describe('buildFieldAliasMap', () => {
  it('projects fact aliases onto bound fields', () => {
    const map = buildFieldAliasMap(
      [
        { id: 'fact1', aliases: ['order_id', '注文番号'] },
        { id: 'fact2', aliases: [] },
        { id: 'fact3', aliases: ['tier'] },
      ],
      [
        { fieldId: 'f1', factId: 'fact1' },
        { fieldId: 'f2', factId: 'fact2' },
        { fieldId: 'f3', factId: 'factMissing' },
      ],
    );
    expect(map).toEqual({ f1: ['order_id', '注文番号'] });
  });
});
