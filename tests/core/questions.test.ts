import { describe, it, expect } from 'vitest';
import { QUESTION_ORDER, QUESTION_GROUP, visibleQuestions, isMuleRuledOut, isCraneRuledOut } from '../../src/assessment/core/questions';

describe('visibleQuestions', () => {
  it('order', () => expect(QUESTION_ORDER).toEqual(['zip','bathroom','truckAccess','pathWidth','turn','removable','overhead','pathGround','powerLines','streetDistance','kitAccess','existingBase','groundFlat','panelDistance','panelRoute']));
  it('groups', () => {
    expect(QUESTION_GROUP.bathroom).toBe('Your pod');
    expect(QUESTION_GROUP.turn).toBe('Getting it there');
    expect(QUESTION_GROUP.groundFlat).toBe('The spot');
    expect(QUESTION_GROUP.panelRoute).toBe('Power');
  });
  it('starting list', () => {
    expect(visibleQuestions({})).toEqual(['zip', 'bathroom', 'truckAccess', 'pathWidth', 'turn', 'overhead', 'pathGround', 'existingBase', 'panelDistance', 'panelRoute']);
  });
  it('truck access yes drops the path questions', () => {
    expect(visibleQuestions({ truckAccess: 'yes' })).toEqual(['zip', 'bathroom', 'truckAccess', 'existingBase', 'panelDistance', 'panelRoute']);
  });
  it('turn shows only when the truck cannot reach', () => {
    expect(visibleQuestions({ truckAccess: 'yes' })).not.toContain('turn');
    expect(visibleQuestions({ truckAccess: 'no' })).toContain('turn');
  });
  it('removable shows only for a narrow path or a tight turn', () => {
    expect(visibleQuestions({ truckAccess: 'no' })).not.toContain('removable');
    expect(visibleQuestions({ truckAccess: 'no', pathWidth: 'narrow' })).toContain('removable');
    expect(visibleQuestions({ truckAccess: 'no', turn: 'tight' })).toContain('removable');
    expect(visibleQuestions({ truckAccess: 'yes', pathWidth: 'narrow' })).not.toContain('removable');
  });
  it('power lines shows kit access and hides street distance', () => {
    const q = visibleQuestions({ truckAccess: 'no', pathWidth: 'narrow', powerLines: 'yes' });
    expect(q).toContain('powerLines');
    expect(q).not.toContain('streetDistance');
    expect(q).toContain('kitAccess');
  });
  it('mule ruled out and no power lines asks street distance', () => {
    const q = visibleQuestions({ truckAccess: 'no', pathWidth: 'narrow', powerLines: 'no' });
    expect(q).toContain('streetDistance');
    expect(q).not.toContain('kitAccess');
  });
  it('street distance over 150 shows kit access', () => {
    expect(visibleQuestions({ truckAccess: 'no', pathWidth: 'narrow', streetDistance: 'over150' })).toContain('kitAccess');
  });
  it('a removable narrow point hides the power lines and street questions', () => {
    const q = visibleQuestions({ truckAccess: 'no', pathWidth: 'narrow', removable: 'fence' });
    expect(q).not.toContain('powerLines');
    expect(q).not.toContain('streetDistance');
  });
  it('existing base none adds groundFlat, in order', () => {
    expect(visibleQuestions({ existingBase: 'none' })).toEqual(
      ['zip', 'bathroom', 'truckAccess', 'pathWidth', 'turn', 'overhead', 'pathGround', 'existingBase', 'groundFlat', 'panelDistance', 'panelRoute']);
  });
  it('panelRoute always shows; water distance and door are gone', () => {
    const v = visibleQuestions({});
    expect(v).toContain('panelRoute');
    expect(v).not.toContain('waterDistance' as never);
    expect(v).not.toContain('door' as never);
  });
  it('every visible list follows QUESTION_ORDER', () => {
    const q = visibleQuestions({ truckAccess: 'no', overhead: 'other', powerLines: 'yes', existingBase: 'none', bathroom: 'shower' });
    expect(q).toEqual(QUESTION_ORDER.filter((id) => q.includes(id)));
  });
});

describe('ruled out', () => {
  it('mule is never ruled out when the truck can reach', () => {
    expect(isMuleRuledOut({ truckAccess: 'yes', pathWidth: 'narrow' })).toBe(false);
  });
  it('branches do not rule out the mule', () => {
    expect(isMuleRuledOut({ truckAccess: 'no', overhead: 'branches' })).toBe(false);
  });
  it('a removable narrow point or tight turn keeps the mule', () => {
    expect(isMuleRuledOut({ truckAccess: 'no', pathWidth: 'narrow' })).toBe(true);
    expect(isMuleRuledOut({ truckAccess: 'no', turn: 'tight' })).toBe(true);
    expect(isMuleRuledOut({ truckAccess: 'no', pathWidth: 'narrow', turn: 'tight', removable: 'fence' })).toBe(false);
    expect(isMuleRuledOut({ truckAccess: 'no', pathWidth: 'narrow', removable: 'other' })).toBe(false);
    expect(isMuleRuledOut({ truckAccess: 'no', pathWidth: 'narrow', removable: 'no' })).toBe(true);
    expect(isMuleRuledOut({ truckAccess: 'no', pathWidth: 'narrow', removable: 'unsure' })).toBe(true);
  });
  it('removable does not rescue overhead or steep ground', () => {
    expect(isMuleRuledOut({ truckAccess: 'no', overhead: 'other', removable: 'fence' })).toBe(true);
    expect(isMuleRuledOut({ truckAccess: 'no', pathGround: 'steep' })).toBe(true);
    expect(isMuleRuledOut({ truckAccess: 'no', pathGround: 'shortSteps' })).toBe(false);
  });
  it('crane is ruled out by power lines only when the mule is', () => {
    expect(isCraneRuledOut({ truckAccess: 'no', powerLines: 'yes' })).toBe(false);
    expect(isCraneRuledOut({ truckAccess: 'no', pathWidth: 'narrow', powerLines: 'yes' })).toBe(true);
    expect(isCraneRuledOut({ truckAccess: 'no', pathWidth: 'narrow', streetDistance: 'over150' })).toBe(true);
    expect(isCraneRuledOut({ truckAccess: 'no', pathWidth: 'narrow', streetDistance: '100to150' })).toBe(false);
  });
});
