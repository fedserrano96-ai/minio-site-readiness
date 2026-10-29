import { describe, it, expect } from 'vitest';
import { QUESTION_ORDER, visibleQuestions, isMuleRuledOut, isCraneRuledOut } from '../../src/assessment/core/questions';

describe('visibleQuestions', () => {
  it('starting list', () => {
    expect(visibleQuestions({})).toEqual(['zip', 'truckAccess', 'pathWidth', 'overhead', 'pathGround', 'existingBase', 'bathroom', 'panelDistance', 'door']);
  });
  it('truck access yes drops the three path questions', () => {
    expect(visibleQuestions({ truckAccess: 'yes' })).toEqual(['zip', 'truckAccess', 'existingBase', 'bathroom', 'panelDistance', 'door']);
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
  it('existing base none adds groundFlat, bathroom half adds waterDistance, in order', () => {
    expect(visibleQuestions({ existingBase: 'none', bathroom: 'half' })).toEqual(
      ['zip', 'truckAccess', 'pathWidth', 'overhead', 'pathGround', 'existingBase', 'groundFlat', 'bathroom', 'waterDistance', 'panelDistance', 'door']);
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
  it('steps rule out the mule', () => {
    expect(isMuleRuledOut({ truckAccess: 'no', pathGround: 'steps' })).toBe(true);
  });
  it('crane is ruled out by power lines only when the mule is', () => {
    expect(isCraneRuledOut({ truckAccess: 'no', powerLines: 'yes' })).toBe(false);
    expect(isCraneRuledOut({ truckAccess: 'no', pathWidth: 'narrow', powerLines: 'yes' })).toBe(true);
    expect(isCraneRuledOut({ truckAccess: 'no', pathWidth: 'narrow', streetDistance: 'over150' })).toBe(true);
    expect(isCraneRuledOut({ truckAccess: 'no', pathWidth: 'narrow', streetDistance: '100to150' })).toBe(false);
  });
});
