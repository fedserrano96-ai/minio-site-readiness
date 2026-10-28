import { describe, it, expect } from 'vitest';
import { recommend, minClearance } from '../../src/assessment/core/rules';
import type { PlannerSnapshot } from '../../src/assessment/core/types';

const snapshot: PlannerSnapshot = {
  model: 'sixteen', rotation: 0, yardW: 40, yardD: 30, podX: 20, podY: 15, podUse: 'office', objects: [],
};

describe('recommend', () => {
  it('starting card is tilt trailer and gravel', () => {
    expect(recommend(snapshot, {})).toEqual({
      model: 'sixteen', method: 'tiltTrailer', craneFrom: null, base: 'gravel',
      methodReason: null, baseReason: null, bathroom: 'none', door: 'standard',
      toCheck: [], notes: ['panelUpgrade'],
    });
  });
  it('truck no -> shed mule', () => {
    const r = recommend(snapshot, { truckAccess: 'no' });
    expect(r.method).toBe('shedMule');
    expect(r.methodReason).toBe('truckNo');
  });
  it('truck unsure stays tilt trailer and adds a check', () => {
    const r = recommend(snapshot, { truckAccess: 'unsure' });
    expect(r.method).toBe('tiltTrailer');
    expect(r.toCheck).toEqual(['truckAccess']);
  });
  it('narrow path -> crane from 3000', () => {
    const r = recommend(snapshot, { truckAccess: 'no', pathWidth: 'narrow' });
    expect(r.method).toBe('crane');
    expect(r.craneFrom).toBe(3000);
    expect(r.methodReason).toBe('pathNarrow');
  });
  it('crane far tier', () => {
    expect(recommend(snapshot, { truckAccess: 'no', pathWidth: 'narrow', streetDistance: '100to150' }).craneFrom).toBe(4000);
  });
  it('crane reason is the first path cause in order', () => {
    expect(recommend(snapshot, { truckAccess: 'no', overhead: 'other', pathGround: 'steps' }).methodReason).toBe('overheadLow');
    expect(recommend(snapshot, { truckAccess: 'no', pathGround: 'steps' }).methodReason).toBe('pathSteps');
  });
  it('power lines -> kit', () => {
    const r = recommend(snapshot, { truckAccess: 'no', overhead: 'other', powerLines: 'yes' });
    expect(r.method).toBe('kit');
    expect(r.craneFrom).toBeNull();
    expect(r.methodReason).toBe('powerLines');
    expect(r.notes).toContain('kitUnloading');
  });
  it('too far -> kit with tooFar reason', () => {
    const r = recommend(snapshot, { truckAccess: 'no', pathWidth: 'narrow', powerLines: 'no', streetDistance: 'over150' });
    expect(r.method).toBe('kit');
    expect(r.methodReason).toBe('tooFar');
  });
  it('no kit access -> talk', () => {
    const r = recommend(snapshot, { truckAccess: 'no', overhead: 'other', powerLines: 'yes', kitAccess: 'no' });
    expect(r.method).toBe('talk');
    expect(r.methodReason).toBe('noKitAccess');
  });
  it('stale answers are ignored', () => {
    const r = recommend(snapshot, { truckAccess: 'yes', pathWidth: 'narrow', powerLines: 'yes' });
    expect(r.method).toBe('tiltTrailer');
    expect(r.toCheck).toEqual([]);
  });
  it('branches that can be trimmed do not escalate', () => {
    expect(recommend(snapshot, { truckAccess: 'no', overhead: 'branches' }).method).toBe('shedMule');
  });
  it('unsure on hidden questions is ignored', () => {
    expect(recommend(snapshot, { truckAccess: 'yes', pathWidth: 'unsure' }).toCheck).toEqual([]);
  });
  it('toCheck lists unsure visible answers in question order, then the base code', () => {
    const r = recommend(snapshot, { door: 'unsure', bathroom: 'unsure', existingBase: 'slab', truckAccess: 'unsure' });
    expect(r.toCheck).toEqual(['truckAccess', 'bathroom', 'door', 'baseSlab']);
    expect(r.bathroom).toBe('none');
    expect(r.door).toBe('standard');
    const r2 = recommend(snapshot, { door: 'unsure', existingBase: 'slab' });
    expect(r2.toCheck).toEqual(['door', 'baseSlab']);
  });
  it('existing slab', () => {
    const r = recommend(snapshot, { existingBase: 'slab', groundFlat: 'steep' });
    expect(r.base).toBe('existing');
    expect(r.baseReason).toBe('existingBase');
    expect(r.toCheck).toEqual(['baseSlab']);
  });
  it('existing gravel and deck codes', () => {
    expect(recommend(snapshot, { existingBase: 'gravel' }).toCheck).toEqual(['baseGravel']);
    expect(recommend(snapshot, { existingBase: 'deck' }).toCheck).toEqual(['baseDeck']);
  });
  it('steep ground -> raised base', () => {
    const r = recommend(snapshot, { existingBase: 'none', groundFlat: 'steep' });
    expect(r.base).toBe('raised');
    expect(r.baseReason).toBe('steepGround');
  });
  it('steep ground is ignored when the base question says unsure', () => {
    expect(recommend(snapshot, { existingBase: 'unsure', groundFlat: 'steep' }).base).toBe('gravel');
  });
  it('twelve with shower note', () => {
    const twelve = { ...snapshot, model: 'twelve' as const };
    expect(recommend(twelve, { bathroom: 'shower' }).notes).toContain('twelveHalfBathOnly');
    const r = recommend(twelve, { bathroom: 'shower' }, 'sixteen');
    expect(r.notes).not.toContain('twelveHalfBathOnly');
    expect(r.model).toBe('sixteen');
  });
  it('flip not on station', () => {
    const station = { ...snapshot, model: 'station' as const };
    expect(recommend(station, { door: 'flipped' }).notes).toContain('flipNotAvailable');
    expect(recommend(snapshot, { door: 'flipped' }).notes).not.toContain('flipNotAvailable');
  });
  it('soft ground note only when path questions are visible', () => {
    expect(recommend(snapshot, { truckAccess: 'no', pathGround: 'soft' }).notes).toEqual(['softGround', 'panelUpgrade']);
    expect(recommend(snapshot, { truckAccess: 'yes', pathGround: 'soft' }).notes).toEqual(['panelUpgrade']);
  });
  it('notes come in the documented order', () => {
    const twelve = { ...snapshot, model: 'twelve' as const, objects: [{ type: 'shed', x: 29, y: 15, w: 2, h: 2 }] };
    const r = recommend(twelve, { truckAccess: 'no', overhead: 'other', powerLines: 'yes', pathGround: 'soft', bathroom: 'shower' });
    expect(r.notes).toEqual(['softGround', 'panelUpgrade', 'twelveHalfBathOnly', 'kitUnloading', 'clearance']);
  });
  it('clearance note', () => {
    const near = { ...snapshot, objects: [{ type: 'shed', x: 31, y: 15, w: 2, h: 2 }] };
    expect(minClearance(near)).toBe(2);
    expect(recommend(near, {}).notes).toContain('clearance');
    expect(recommend(snapshot, {}).notes).not.toContain('clearance');
  });
});

describe('minClearance', () => {
  it('centred fixture is limited by the yard edges', () => {
    expect(minClearance(snapshot)).toBe(10);
  });
  it('rotation swaps the pod footprint', () => {
    expect(minClearance({ ...snapshot, rotation: 90 })).toBe(7); // x: 20 - 5 = 15, y: 15 - 8 = 7
  });
  it('overlap is zero', () => {
    expect(minClearance({ ...snapshot, objects: [{ type: 'tree', x: 20, y: 15, w: 4, h: 4 }] })).toBe(0);
  });
  it('is zero when the pod sits past the yard edge', () => {
    expect(minClearance({ ...snapshot, podX: 2 })).toBe(0);
  });
  it('measures diagonally between corners', () => {
    // pod spans x 12..28, y 10..20; box spans x 30..33, y 22..25, so the gap is 2 across and 2 down
    const s = { ...snapshot, objects: [{ type: 'tree', x: 31.5, y: 23.5, w: 3, h: 3 }] };
    expect(minClearance(s)).toBeCloseTo(Math.SQRT2 * 2, 10);
  });
});
