import { describe, it, expect } from 'vitest';
import { priceRecommendation, leadTime, bandFeet } from '../../src/assessment/core/pricing';
import { lookupLocation } from '../../src/assessment/core/location';
import type { Answers, CostLine, CostSummary, Location, Recommendation } from '../../src/assessment/core/types';

function rec(overrides: Partial<Recommendation> = {}): Recommendation {
  return {
    model: 'sixteen', method: 'tiltTrailer', craneFrom: null, base: 'gravel',
    methodReason: null, baseReason: null, bathroom: 'none', door: 'standard',
    toCheck: [], notes: [], ...overrides,
  };
}

function loc(zip: string): Location {
  const l = lookupLocation(zip);
  if (!l) throw new Error(`test setup: no location for ${zip}`);
  return l;
}

function range(s: CostSummary) {
  if (s.mode !== 'range') throw new Error('expected range mode');
  return s;
}

function line(s: CostSummary, id: CostLine['id']): CostLine | undefined {
  return range(s).lines.find(l => l.id === id);
}

describe('bandFeet', () => {
  it('maps bands to feet', () => {
    expect(bandFeet('lt25')).toEqual({ feet: 25, andUp: false });
    expect(bandFeet('25to50')).toEqual({ feet: 50, andUp: false });
    expect(bandFeet('50to100')).toEqual({ feet: 100, andUp: false });
    expect(bandFeet('gt100')).toEqual({ feet: 100, andUp: true });
    expect(bandFeet('unsure')).toEqual({ feet: 50, andUp: false });
    expect(bandFeet(undefined)).toEqual({ feet: 50, andUp: false });
  });
});

describe('priceRecommendation', () => {
  it('worked example from the spec', () => {
    const s = priceRecommendation(
      rec({ method: 'shedMule' }), loc('98101'), { panelDistance: '25to50' });
    const r = range(s);
    expect(r.mode).toBe('range');
    expect(r.low).toBe(7600);
    expect(r.high).toBe(10181);
    expect(r.andUp).toBe(false);
    expect(r.locationKnown).toBe(true);
    expect(line(s, 'shipping')).toMatchObject({ low: 1100, high: 1100, reference: false });
    expect(line(s, 'install')).toMatchObject({ low: 2000, high: 2000, reference: false });
    expect(line(s, 'base')).toMatchObject({ low: 3000, high: 3000, reference: false });
    expect(line(s, 'power')).toMatchObject({ low: 1500, high: 4081, reference: false });
  });

  it('starting card without ZIP', () => {
    const s = priceRecommendation(rec(), null, {});
    const r = range(s);
    expect(r.locationKnown).toBe(false);
    expect(line(s, 'shipping')).toBeUndefined();
    expect(line(s, 'install')).toMatchObject({ low: 0, high: 0 });
    expect(line(s, 'base')).toMatchObject({ low: 3000, high: 4945, reference: true });
    expect(line(s, 'power')).toMatchObject({ low: 1500, high: 5600, reference: true });
    expect(r.low).toBe(4500);
    expect(r.high).toBe(10545);
  });

  it('crane is a side item', () => {
    const s = priceRecommendation(
      rec({ method: 'crane', craneFrom: 4000 }), loc('98101'), { panelDistance: '25to50' });
    expect(line(s, 'install')).toBeUndefined();
    expect(range(s).side).toContainEqual({ id: 'crane', from: 4000 });
  });

  it('raised base side item', () => {
    const s = priceRecommendation(rec({ base: 'raised' }), loc('90012'), {});
    expect(line(s, 'base')).toBeUndefined();
    expect(range(s).side).toContainEqual({ id: 'raisedBase', from: 16129 });
  });

  it('raised base outside the priced regions uses the smallest from-figure for the model', () => {
    // Texas has no RAISED_FROM row; Sixteen minimum across regions is 14025 (WA).
    const s = priceRecommendation(rec({ base: 'raised' }), loc('78701'), {});
    expect(range(s).side).toContainEqual({ id: 'raisedBase', from: 14025 });
  });

  it('raised base with no known location uses the smallest from-figure', () => {
    const s = priceRecommendation(rec({ base: 'raised', model: 'twelve' }), null, {});
    expect(range(s).side).toContainEqual({ id: 'raisedBase', from: 8500 });
  });

  it('existing base is a zero line', () => {
    const s = priceRecommendation(rec({ base: 'existing' }), loc('98101'), {});
    expect(line(s, 'base')).toMatchObject({ low: 0, high: 0, reference: false });
  });

  it('quoted shipping', () => {
    const s = priceRecommendation(rec(), loc('96813'), {});
    expect(line(s, 'shipping')).toBeUndefined();
    expect(range(s).side).toContainEqual({ id: 'shippingQuoted', from: null });
    expect(range(s).locationKnown).toBe(true);
  });

  it('shipping is a priced line for a known amount', () => {
    // Texas: 5500, factory TN
    const s = priceRecommendation(rec(), loc('78701'), {});
    expect(line(s, 'shipping')).toMatchObject({ low: 5500, high: 5500, reference: false });
  });

  it('throws when the shipping key is not in the table', () => {
    const bad: Location = { ...loc('98101'), shippingKey: 'Atlantis' };
    expect(() => priceRecommendation(rec(), bad, {})).toThrow(/Atlantis/);
  });

  it('kit outside coverage uses reference assembly', () => {
    const s = priceRecommendation(rec({ model: 'station', method: 'kit' }), loc('10001'), {});
    expect(line(s, 'install')).toMatchObject({ low: 16500, high: 16500, reference: true });
  });

  it('kit inside coverage uses the regional assembly figure', () => {
    // WA Sixteen: 8300
    const s = priceRecommendation(rec({ method: 'kit' }), loc('98101'), {});
    expect(line(s, 'install')).toMatchObject({ low: 8300, high: 8300, reference: false });
  });

  it('kit with no location uses reference assembly', () => {
    const s = priceRecommendation(rec({ method: 'kit' }), null, {});
    expect(line(s, 'install')).toMatchObject({ low: 12000, high: 12000, reference: true });
  });

  it('a location with no price region uses the gravel reference range', () => {
    // Texas has no region: reference range 3000-4945 for the Sixteen.
    const s = priceRecommendation(rec(), loc('78701'), {});
    expect(line(s, 'base')).toMatchObject({ low: 3000, high: 4945, reference: true });
  });

  it('a regional figure outside the install area is used but flagged reference', () => {
    // Spokane is WA_OTHER, outside the install area: its own figures, marked reference.
    const spokane = loc('99201');
    expect(spokane).toMatchObject({ region: 'WA_OTHER', inCoverage: false });
    expect(line(priceRecommendation(rec(), spokane, {}), 'base'))
      .toMatchObject({ low: 3500, high: 3500, reference: true });
    expect(line(priceRecommendation(rec({ method: 'kit' }), spokane, {}), 'install'))
      .toMatchObject({ low: 11000, high: 11000, reference: true });
  });

  it('gravel reference range for the Station is 6000 to 6900', () => {
    const s = priceRecommendation(rec({ model: 'station' }), null, {});
    expect(line(s, 'base')).toMatchObject({ low: 6000, high: 6900, reference: true });
  });

  it('bathroom adds plumbing', () => {
    const s = priceRecommendation(
      rec({ bathroom: 'half' }), loc('98101'), { waterDistance: '25to50' });
    expect(line(s, 'plumbing')).toMatchObject({ low: 5100, high: 5100, reference: false });
  });

  it('no bathroom has no plumbing line', () => {
    const s = priceRecommendation(rec(), loc('98101'), { waterDistance: '25to50' });
    expect(line(s, 'plumbing')).toBeUndefined();
  });

  it('plumbing in Southern California is 8000', () => {
    const s = priceRecommendation(rec({ bathroom: 'shower' }), loc('90012'), { waterDistance: 'lt25' });
    expect(line(s, 'plumbing')).toMatchObject({ low: 8000, high: 8000, reference: false });
  });

  it('plumbing without a ZIP is the reference range', () => {
    // 50 ft: WA 72*50+1500 = 5100, CA_SOUTH 8000
    const s = priceRecommendation(rec({ bathroom: 'half' }), null, {});
    expect(line(s, 'plumbing')).toMatchObject({ low: 5100, high: 8000, reference: true });
  });

  it('power formulas by region', () => {
    // CA_SOUTH flat 5600
    expect(line(priceRecommendation(rec(), loc('90012'), { panelDistance: 'lt25' }), 'power'))
      .toMatchObject({ low: 5600, high: 5600, reference: false });
    // WA short run: low is the 1500 floor, high is 80*25+81 = 2081
    expect(line(priceRecommendation(rec(), loc('98101'), { panelDistance: 'lt25' }), 'power'))
      .toMatchObject({ low: 1500, high: 2081 });
    // WA 100 ft: 80*100+81 = 8081 both (above the 50 ft floor)
    expect(line(priceRecommendation(rec(), loc('98101'), { panelDistance: '50to100' }), 'power'))
      .toMatchObject({ low: 8081, high: 8081 });
    // NJ_NY 50 ft: 30*50+81 = 1581, flagged reference (outside the install area)
    expect(line(priceRecommendation(rec(), loc('10001'), { panelDistance: '25to50' }), 'power'))
      .toMatchObject({ low: 1581, high: 1581, reference: true });
  });

  it('power without a priced region is the reference range', () => {
    // Texas, 100 ft: WA 8081, CA_SOUTH 5600, NJ_NY 30*100+81 = 3081
    const s = priceRecommendation(rec(), loc('78701'), { panelDistance: '50to100' });
    expect(line(s, 'power')).toMatchObject({ low: 3081, high: 8081, reference: true });
  });

  it('over 100 ft is and-up', () => {
    const s = priceRecommendation(rec(), loc('98101'), { panelDistance: 'gt100' });
    expect(range(s).andUp).toBe(true);
    expect(line(s, 'power')).toMatchObject({ low: 8081, high: 8081, andUp: true });
    expect(range(priceRecommendation(rec(), loc('98101'), { panelDistance: '50to100' })).andUp).toBe(false);
  });

  it('flipped door adds 500 only where available', () => {
    const sixteen = priceRecommendation(rec({ door: 'flipped' }), loc('98101'), {});
    expect(line(sixteen, 'door')).toMatchObject({ low: 500, high: 500 });
    const station = priceRecommendation(rec({ model: 'station', door: 'flipped' }), loc('98101'), {});
    expect(line(station, 'door')).toBeUndefined();
    const standard = priceRecommendation(rec(), loc('98101'), {});
    expect(line(standard, 'door')).toBeUndefined();
  });

  it('talk mode', () => {
    expect(priceRecommendation(rec({ method: 'talk' }), loc('98101'), {})).toEqual({ mode: 'talk' });
  });

  it('totals are the sum of the lines', () => {
    const answers: Answers = { panelDistance: 'gt100', waterDistance: '50to100' };
    const s = priceRecommendation(
      rec({ bathroom: 'half', door: 'flipped', method: 'shedMule' }), loc('98101'), answers);
    const r = range(s);
    // shipping 1100 + shed mule 2000 + gravel 3000 + power 8081 + plumbing 72*100+1500 = 8700 + door 500
    expect(r.low).toBe(1100 + 2000 + 3000 + 8081 + 8700 + 500);
    expect(r.high).toBe(r.low);
    expect(r.andUp).toBe(true);
  });
});

describe('leadTime', () => {
  it('Sixteen pre-built, Seattle', () => {
    expect(leadTime(rec(), loc('98101'))).toEqual({ minWeeks: 5, maxWeeks: 5 });
  });
  it('Station pre-built, Texas', () => {
    expect(leadTime(rec({ model: 'station' }), loc('78701'))).toEqual({ minWeeks: 7, maxWeeks: 7 });
  });
  it('kit with no location spans both factories', () => {
    expect(leadTime(rec({ method: 'kit' }), null)).toEqual({ minWeeks: 4, maxWeeks: 5 });
  });
  it('bathroom adds two weeks', () => {
    expect(leadTime(rec({ bathroom: 'half' }), loc('98101'))).toEqual({ minWeeks: 7, maxWeeks: 7 });
  });
  it('a location with no factory spans both factories', () => {
    // Hawaii has no factory: pre-built Sixteen is 5 (WA) to 6 (TN).
    expect(leadTime(rec(), loc('96813'))).toEqual({ minWeeks: 5, maxWeeks: 6 });
  });
  it('talk uses the pre-built lead time', () => {
    expect(leadTime(rec({ method: 'talk' }), loc('98101'))).toEqual({ minWeeks: 5, maxWeeks: 5 });
  });
});
