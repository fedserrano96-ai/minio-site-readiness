import { describe, it, expect } from 'vitest';
import { GRAVEL, KIT_ASSEMBLY, KIT_ASSEMBLY_REFERENCE, RAISED_FROM, MODELS, MULE_MAX_SLOPE_DEG, MULE_MAX_STEP_FT, MULE_RAMPS } from '../../src/assessment/core/data';
import { SHIPPING } from '../../src/assessment/core/shipping';

describe('price data', () => {
  it('gravel pad figures', () => {
    expect(GRAVEL.WA?.sixteen).toBe(3000);
    expect(GRAVEL.CA_SOUTH?.sixteen).toBe(4945);
    expect(GRAVEL.WA_OTHER?.station).toBeUndefined();
  });
  it('kit assembly figures', () => {
    expect(KIT_ASSEMBLY.CA_NORTH?.sixteen).toBe(9000);
    expect(KIT_ASSEMBLY_REFERENCE.station).toBe(16500);
  });
  it('raised base figures', () => {
    expect(RAISED_FROM.WA?.sixteen).toBe(14025);
  });
  it('shed mule limits', () => {
    expect([MULE_MAX_SLOPE_DEG, MULE_MAX_STEP_FT, MULE_RAMPS]).toEqual([10, 1.5, 250]);
  });
  it('models', () => {
    expect(MODELS.station.flipAvailable).toBe(false);
    expect(MODELS.twelve.minPathWidth).toBe(10);
    expect(MODELS.station.minOverhead).toBe(13);
    expect(MODELS.sixteen.weightWithBathLbs).toBe(8000);
  });
});

describe('shipping table', () => {
  it('matches Appendix A', () => {
    expect(SHIPPING['Washington']).toEqual({ factory: 'WA', amount: 1100 });
    expect(SHIPPING['Kentucky'].amount).toBe(1150);
    expect(SHIPPING['Hawaii'].amount).toBeNull();
    expect(SHIPPING['Colorado'].factory).toBe('WA');
    expect(SHIPPING['OTHER']).toEqual({ factory: null, amount: null });
    expect(Object.keys(SHIPPING).length).toBe(59);
  });
});
