import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { specValues } from '../../src/specs/values';
import { LEVEL_CUTOFF_TEXT } from '../../src/assessment/core/data';

describe('specValues', () => {
  it('Sixteen, flipped door', () => {
    expect(specValues('sixteen', 'flipped')).toEqual({
      name: 'Sixteen',
      size: '16 × 10 ft',
      weight: '7,200 lbs (8,000 lbs with a bathroom)',
      inletCorner: 'back left corner',
      levelCutoff: '¼ in. per foot',
    });
  });

  it('Twelve has a single weight and a standard inlet corner', () => {
    expect(specValues('twelve', 'standard')).toEqual({
      name: 'Twelve',
      size: '12 × 8 ft',
      weight: '4,600 lbs',
      inletCorner: 'back right corner',
      levelCutoff: '¼ in. per foot',
    });
  });

  it('Station weight is left to the advisor; no door means standard', () => {
    const v = specValues('station', null);
    expect(v?.weight).toBe('ask your Mini·O advisor');
    expect(v?.inletCorner).toBe('back right corner');
  });

  it('an unknown door value counts as standard', () => {
    expect(specValues('sixteen', 'sideways')?.inletCorner).toBe('back right corner');
  });

  it('level cutoff comes from LEVEL_CUTOFF_TEXT', () => {
    expect(specValues('twelve', null)?.levelCutoff).toBe(LEVEL_CUTOFF_TEXT);
  });

  it('the base sheet fills the level cutoff from data, not hard-coded text', () => {
    const html = readFileSync(resolve(__dirname, '../../contractor/base.html'), 'utf-8');
    expect(html).toContain('data-field="levelCutoff"');
    expect(html).not.toMatch(/&frac14; in\. per foot|¼ in\. per foot/);
  });

  it('returns null for an unknown or missing model', () => {
    expect(specValues('nine', null)).toBeNull();
    expect(specValues(null, null)).toBeNull();
  });
});
