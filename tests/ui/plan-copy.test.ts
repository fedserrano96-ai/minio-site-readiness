import { describe, it, expect } from 'vitest';
import { planSteps } from '../../src/assessment/ui/plan-copy';
import { headline, noteText } from '../../src/assessment/ui/copy';
import { recommend } from '../../src/assessment/core/rules';
import { lookupLocation } from '../../src/assessment/core/location';
import type { Location, PlannerSnapshot, Recommendation } from '../../src/assessment/core/types';

const snapshot: PlannerSnapshot = {
  model: 'sixteen', rotation: 0, yardW: 40, yardD: 30, podX: 20, podY: 15, podUse: 'office', objects: [],
};
const rec = (o: Partial<Recommendation>): Recommendation => ({ ...recommend(snapshot, {}), ...o });

function location(zip: string, covered: boolean): Location {
  const l = lookupLocation(zip);
  if (l === null) throw new Error(`test ZIP ${zip} did not resolve`);
  if (l.inCoverage !== covered) throw new Error(`test ZIP ${zip}: expected inCoverage ${covered}`);
  return l;
}
const seattleCovered = location('98101', true);
const outside = location('75201', false);

describe('planSteps', () => {
  it('Review Focus 4: no ZIP -> no arranging claims', () => {
    const all = planSteps(rec({}), null).flatMap(s => s.lines).join(' ');
    expect(all).not.toContain('Mini·O arranges');
    expect(all).not.toContain('help arrange');
    expect(all).not.toContain('Mini·O ships it');
  });
  it('covered: arranges delivery, base and offers an electrician', () => {
    const steps = planSteps(rec({}), seattleCovered);
    expect(steps.map(s => s.id)).toEqual(['delivery', 'base', 'power']);
    expect(steps[0]!.lines).toContain('Mini·O arranges this.');
    expect(steps[1]!.lines).toEqual(['A local contractor lays a gravel pad. Mini·O arranges this.']);
    expect(steps[1]!.link).toBeNull();
    expect(steps[2]!.lines).toContain('Or we can help arrange one for you.');
    expect(steps[2]!.link!.href).toBe('contractor/power.html?model=sixteen&door=standard');
    expect(steps[2]!.link!.label).toBe('Get the power spec for your contractor');
  });
  it('outside coverage: own contractor, sheets linked, no arranging offer', () => {
    const steps = planSteps(rec({}), outside);
    expect(steps[0]!.lines).toContain('Mini·O ships it; your local crew takes it from there.');
    expect(steps[1]!.lines).toEqual(['Your contractor lays a gravel pad. Give them this sheet.']);
    expect(steps[1]!.link).toEqual({ href: 'contractor/base.html?model=sixteen', label: 'Get the base spec for your contractor' });
    expect(steps[2]!.lines).not.toContain('Or we can help arrange one for you.');
  });
  it('power lines, in order', () => {
    const lines = planSteps(rec({ hardSurface: true }), seattleCovered)[2]!.lines;
    expect(lines).toEqual([
      'An electrician adds an outdoor outlet near the pod and a breaker in your panel, and checks your panel has room.',
      'Your electrician or general contractor can handle this. Give them this sheet.',
      'Or we can help arrange one for you.',
      'Your electrician will plan the route around or under the paved part.',
    ]);
  });
  it('delivery text per method', () => {
    const first = (method: Recommendation['method']) => planSteps(rec({ method }), null)[0]!.lines[0];
    expect(first('tiltTrailer')).toBe('Your pod arrives on a tilt trailer and slides off right at the spot.');
    expect(first('shedMule')).toBe('A truck brings your pod, and a small mover (a shed mule) rolls it the last stretch.');
    expect(first('crane')).toBe('A crane lifts your pod from the street onto the spot.');
    expect(first('kit')).toBe('Your pod arrives as a kit, and a local crew builds it on the spot.');
    expect(first('talk')).toBe("We'll work out the best way in with you on a call.");
  });
  it('talk: Delivery step has no who-line, covered or not', () => {
    for (const loc of [seattleCovered, outside]) {
      expect(planSteps(rec({ method: 'talk' }), loc)[0]!.lines).toEqual(["We'll work out the best way in with you on a call."]);
    }
  });
  it('base text per kind', () => {
    const base = (b: Recommendation['base']) => planSteps(rec({ base: b }), null)[1]!;
    expect(base('existing').lines).toEqual(["Your pod goes on your existing base. We'll confirm it's big enough and level."]);
    expect(base('existing').link).toBeNull();
    expect(base('raised').lines).toEqual(['The ground is too steep for a gravel pad, so the pod needs a raised base. We\'ll price it with you in person.']);
    expect(base('raised').link).toBeNull();
  });
  it('bathroom adds the water step, verbatim', () => {
    const water = planSteps(rec({ bathroom: 'half' }), null).find(s => s.id === 'water')!;
    expect(water.lines).toEqual(['Your pod will need a licensed plumber to connect it to your water and sewer. We can help coordinate one, or if you have someone you trust, even better.']);
    expect(water.link).toBeNull();
    expect(planSteps(rec({ bathroom: 'none' }), null).some(s => s.id === 'water')).toBe(false);
  });
  it('take-down, ramps and hard surface lines', () => {
    const s = planSteps(rec({ method: 'shedMule', takeDown: 'fence', ramps: true, hardSurface: true }), null);
    expect(s[0]!.lines).toContain('The fence section or gate comes down on delivery day and goes back up after.');
    expect(s[0]!.lines).toContain('Ramps go over the steps.');
    expect(s[2]!.lines).toContain('Your electrician will plan the route around or under the paved part.');
    const other = planSteps(rec({ takeDown: 'other' }), null);
    expect(other[0]!.lines).toContain("What's in the way comes down on delivery day and goes back up after.");
  });
  it('notes go inside their steps', () => {
    const r = rec({ notes: ['softGround', 'kitUnloading', 'clearance', 'twelveHalfBathOnly'] });
    const s = planSteps(r, null);
    expect(s[0]!.lines).toContain(noteText('softGround'));
    expect(s[0]!.lines).toContain(noteText('kitUnloading'));
    expect(s[1]!.lines).toContain(noteText('clearance'));
    expect(s.flatMap(x => x.lines)).not.toContain(noteText('twelveHalfBathOnly'));
  });
  it('no forbidden topics in any plan text', () => {
    const variants = [rec({ bathroom: 'shower', method: 'kit' }), rec({ method: 'talk', base: 'raised' })];
    const blob = variants.flatMap(r => [headline(r), ...planSteps(r, outside).flatMap(s => s.lines)]).join(' ').toLowerCase();
    for (const w of ['permit', 'septic', 'amperage']) expect(blob).not.toContain(w);
    expect(blob).not.toMatch(/\bamps?\b|\b(30|50) ?a\b/);
  });
});
