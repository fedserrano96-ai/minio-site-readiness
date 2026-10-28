import { describe, it, expect } from 'vitest';
import { specValues } from '../../src/specs/values';

describe('specValues', () => {
  it('Sixteen, flipped door', () => {
    expect(specValues('sixteen', 'flipped')).toEqual({
      name: 'Sixteen',
      size: '16 × 10 ft',
      weight: '7,200 lbs (8,000 lbs with a bathroom)',
      inletCorner: 'back left corner',
    });
  });

  it('Twelve has a single weight and a standard inlet corner', () => {
    expect(specValues('twelve', 'standard')).toEqual({
      name: 'Twelve',
      size: '12 × 8 ft',
      weight: '4,600 lbs',
      inletCorner: 'back right corner',
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

  it('returns null for an unknown or missing model', () => {
    expect(specValues('nine', null)).toBeNull();
    expect(specValues(null, null)).toBeNull();
  });
});
