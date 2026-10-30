import { describe, it, expect } from 'vitest';
import { REP_LIST_TITLE, headline, noteText, reasonText, toCheckText } from '../../src/assessment/ui/copy';
import { recommend } from '../../src/assessment/core/rules';
import { QUESTION_ORDER } from '../../src/assessment/core/questions';
import type { PlannerSnapshot, Recommendation } from '../../src/assessment/core/types';

const snapshot: PlannerSnapshot = {
  model: 'sixteen', rotation: 0, yardW: 40, yardD: 30, podX: 20, podY: 15, podUse: 'office', objects: [],
};
const rec = (o: Partial<Recommendation>): Recommendation => ({ ...recommend(snapshot, {}), ...o });

describe('headline', () => {
  it('examples from the spec', () => {
    expect(headline(rec({ method: 'shedMule' }))).toBe("You can have a Sixteen delivered by truck and shed mule. You'll need a gravel pad and an outdoor outlet.");
    expect(headline(rec({ model: 'twelve', base: 'existing' }))).toBe("You can have a Twelve delivered on a tilt trailer onto your existing base. You'll need an outdoor outlet.");
    expect(headline(rec({ method: 'crane', bathroom: 'shower' }))).toBe("You can have a Sixteen lifted in by crane. You'll need a gravel pad, an outdoor outlet and a plumber for the bathroom.");
    expect(headline(rec({ method: 'talk' }))).toBe("Your yard needs a closer look. Let's work out the best way in together.");
  });
  it('kit and raised base', () => {
    expect(headline(rec({ method: 'kit', base: 'raised' }))).toBe("You can have a Sixteen brought in as a kit and built on the spot. You'll need a raised base and an outdoor outlet.");
  });
});

describe('rep list copy', () => {
  it('has the verbatim title', () => {
    expect(REP_LIST_TITLE).toBe("We'll check these with you on the call");
  });
  it('every rep-list code has text', () => {
    for (const id of QUESTION_ORDER) expect(toCheckText(id).length).toBeGreaterThan(0);
    for (const code of ['baseSlab', 'baseGravel', 'baseDeck'] as const) expect(toCheckText(code).length).toBeGreaterThan(0);
  });
  it('is a topic phrase, not an instruction', () => {
    expect(toCheckText('truckAccess')).toBe('Whether a truck can drive up to the spot');
    expect(toCheckText('baseSlab')).toBe('Whether your slab or patio is big enough and level');
  });
});

describe('reasons and notes', () => {
  it('has plain words for the new turn reason', () => {
    expect(reasonText('pathTurn')).toMatch(/corner/);
    expect(reasonText('pathSteep').length).toBeGreaterThan(0);
  });
  it('has text for every remaining note', () => {
    for (const code of ['softGround', 'twelveHalfBathOnly', 'kitUnloading', 'clearance'] as const) {
      expect(noteText(code).length).toBeGreaterThan(0);
    }
  });
});
