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
      ramps: false, takeDown: null, hardSurface: false, toCheck: [], notes: [],
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
    expect(recommend(snapshot, { truckAccess: 'no', overhead: 'other', pathGround: 'steep' }).methodReason).toBe('overheadLow');
    expect(recommend(snapshot, { truckAccess: 'no', pathGround: 'steep' }).methodReason).toBe('pathSteep');
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
    const r = recommend(snapshot, { bathroom: 'unsure', existingBase: 'slab', truckAccess: 'unsure' });
    expect(r.toCheck).toEqual(['bathroom', 'truckAccess', 'baseSlab']);
    expect(r.bathroom).toBe('none');
    expect(r.door).toBe('standard');
    const r2 = recommend(snapshot, { panelRoute: 'unsure', existingBase: 'slab' });
    expect(r2.toCheck).toEqual(['panelRoute', 'baseSlab']);
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
  it('soft ground note only when path questions are visible', () => {
    expect(recommend(snapshot, { truckAccess: 'no', pathGround: 'soft' }).notes).toEqual(['softGround']);
    expect(recommend(snapshot, { truckAccess: 'yes', pathGround: 'soft' }).notes).toEqual([]);
  });
  it('notes come in the documented order', () => {
    const twelve = { ...snapshot, model: 'twelve' as const, objects: [{ type: 'shed', x: 29, y: 15, w: 2, h: 2 }] };
    const r = recommend(twelve, { truckAccess: 'no', overhead: 'other', powerLines: 'yes', pathGround: 'soft', bathroom: 'shower' });
    expect(r.notes).toEqual(['softGround', 'twelveHalfBathOnly', 'kitUnloading', 'clearance']);
  });
  it('removable fence keeps the shed mule and names it', () => {
    const r = recommend(snapshot, { truckAccess: 'no', pathWidth: 'narrow', removable: 'fence' });
    expect(r.method).toBe('shedMule');
    expect(r.takeDown).toBe('fence');
  });
  it('removable other keeps the shed mule and names it', () => {
    const r = recommend(snapshot, { truckAccess: 'no', pathWidth: 'narrow', removable: 'other' });
    expect(r.method).toBe('shedMule');
    expect(r.takeDown).toBe('other');
  });
  it('a stale removable answer is ignored once nothing is narrow or tight', () => {
    const r = recommend(snapshot, { truckAccess: 'no', pathWidth: 'wide', removable: 'fence' });
    expect(r.method).toBe('shedMule');
    expect(r.takeDown).toBeNull();
  });
  it('tight turn that cannot come down -> crane, reason pathTurn', () => {
    const r = recommend(snapshot, { truckAccess: 'no', turn: 'tight', removable: 'no' });
    expect(r.method).toBe('crane');
    expect(r.methodReason).toBe('pathTurn');
    expect(r.takeDown).toBeNull();
  });
  it('narrow beats turn as the reason', () => {
    expect(recommend(snapshot, { truckAccess: 'no', pathWidth: 'narrow', turn: 'tight' }).methodReason).toBe('pathNarrow');
  });
  it('removable unsure keeps the crane and goes on the rep list', () => {
    const r = recommend(snapshot, { truckAccess: 'no', pathWidth: 'narrow', removable: 'unsure' });
    expect(r.method).toBe('crane');
    expect(r.toCheck).toContain('removable');
  });
  it('short steps keep the mule and add ramps', () => {
    const r = recommend(snapshot, { truckAccess: 'no', pathGround: 'shortSteps' });
    expect(r.method).toBe('shedMule');
    expect(r.ramps).toBe(true);
  });
  it('ramps and take-down only apply to the shed mule', () => {
    const crane = recommend(snapshot, { truckAccess: 'no', overhead: 'other', pathGround: 'shortSteps', pathWidth: 'narrow', removable: 'fence' });
    expect(crane.method).toBe('crane');
    expect(crane.ramps).toBe(false);
    expect(crane.takeDown).toBeNull();
  });
  it('Review Focus 1: switching the truck answer to yes clears hidden effects', () => {
    const r = recommend(snapshot, { truckAccess: 'yes', pathWidth: 'narrow', removable: 'fence', pathGround: 'shortSteps' });
    expect(r).toMatchObject({ method: 'tiltTrailer', ramps: false, takeDown: null, methodReason: null });
  });
  it('hard surface between panel and spot', () => {
    expect(recommend(snapshot, { panelRoute: 'hard' }).hardSurface).toBe(true);
    expect(recommend(snapshot, { panelRoute: 'both' }).hardSurface).toBe(true);
    expect(recommend(snapshot, { panelRoute: 'soft' }).hardSurface).toBe(false);
    expect(recommend(snapshot, { panelRoute: 'unsure' }).toCheck).toContain('panelRoute');
  });
  it('no panel-upgrade note any more', () => {
    expect(recommend(snapshot, {}).notes).not.toContain('panelUpgrade' as never);
  });
  it('clearance note', () => {
    const near = { ...snapshot, objects: [{ type: 'shed', x: 31, y: 15, w: 2, h: 2 }] };
    expect(minClearance(near)).toBe(2);
    expect(recommend(near, {}).notes).toContain('clearance');
    expect(recommend(snapshot, {}).notes).not.toContain('clearance');
  });
});

describe('recommend clearance with a model override', () => {
  it('measures clearance with the overridden model footprint', () => {
    // object spans x 30..31: 4 ft from the Twelve (x 14..26), 2 ft from the Sixteen (x 12..28)
    const twelve: PlannerSnapshot = { ...snapshot, model: 'twelve', objects: [{ type: 'shed', x: 30.5, y: 15, w: 1, h: 2 }] };
    expect(recommend(twelve, {}).notes).not.toContain('clearance');
    const r = recommend(twelve, {}, 'sixteen');
    expect(r.model).toBe('sixteen');
    expect(r.notes).toContain('clearance');
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
