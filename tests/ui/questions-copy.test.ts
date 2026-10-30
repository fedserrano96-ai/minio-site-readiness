import { describe, it, expect } from 'vitest';
import { questionCopy, PANEL_EXPLAINER } from '../../src/assessment/ui/questions-copy';
import { QUESTION_ORDER } from '../../src/assessment/core/questions';
import type { QuestionId } from '../../src/assessment/core/types';

const ALL: QuestionId[] = QUESTION_ORDER;

describe('question copy', () => {
  it('every visible question has copy, steps and an "I\'m not sure" option (except zip)', () => {
    for (const id of ALL) {
      const c = questionCopy(id, 'sixteen');
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.steps.length).toBeGreaterThan(0);
      if (id !== 'zip') expect(c.options.at(-1)).toEqual({ value: 'unsure', label: "I'm not sure" });
    }
  });

  it('keeps each steps list to 2-4 steps (zip has one), each starting with a verb-like word and ending in a full stop', () => {
    for (const id of ALL) {
      const { steps } = questionCopy(id, 'sixteen');
      if (id === 'zip') expect(steps.length).toBe(1);
      else {
        expect(steps.length).toBeGreaterThanOrEqual(2);
        expect(steps.length).toBeLessThanOrEqual(4);
      }
      for (const s of steps) expect(s).toMatch(/^[A-Z][a-z]+ .*[.?]$/);
    }
  });

  it('option values match the Answers types', () => {
    const values = (id: QuestionId) => questionCopy(id, 'sixteen').options.map((o) => o.value);
    expect(values('pathGround')).toEqual(['solid', 'soft', 'shortSteps', 'steep', 'unsure']);
    expect(values('turn')).toEqual(['none', 'roomy', 'tight', 'unsure']);
    expect(values('removable')).toEqual(['fence', 'other', 'no', 'unsure']);
    expect(values('panelRoute')).toEqual(['soft', 'hard', 'both', 'unsure']);
  });

  it('exact titles and labels the spec fixes', () => {
    expect(questionCopy('removable', 'sixteen').title).toBe('Could everything that makes it narrow or tight come down and go back up?');
    expect(questionCopy('panelRoute', 'sixteen').title).toBe("What's between the panel and the spot?");
    expect(questionCopy('turn', 'sixteen').title).toBe('Does the pod have to go around a tight corner on the way in?');
    expect(questionCopy('pathGround', 'sixteen').title).toBe("What's the way in like underfoot?");
    expect(questionCopy('pathGround', 'sixteen').options[0]!.label).toBe('Solid, flat or a gentle slope (under about 10°)');
    expect(questionCopy('pathGround', 'sixteen').options[2]!.label).toBe('A few short steps (under 1.5 ft)');
    expect(questionCopy('turn', 'twelve').options[1]!.label).toContain('20 ft');
    expect(questionCopy('turn', 'sixteen').options[1]!.label).toContain('24 ft');
    expect(questionCopy('turn', 'station').options[1]!.label).toContain('24 ft');
  });

  it('the bathroom help only says a plumber connects it', () => {
    const help = questionCopy('bathroom', 'sixteen').help;
    expect(help).toMatch(/licensed plumber/);
    expect(help).not.toMatch(/\bft\b|feet|house/i);
  });

  it('no longer has water-distance or door copy', () => {
    for (const id of ['waterDistance', 'door']) {
      expect(() => questionCopy(id as QuestionId, 'sixteen')).toThrow(/unknown question/);
    }
  });

  it('help never points at the old "To check" list', () => {
    for (const id of ALL) expect(questionCopy(id, 'sixteen').help).not.toContain('"To check"');
  });

  it('panel explainer covers what, looks and where', () => {
    expect(PANEL_EXPLAINER.title).toBe("What's an electrical panel?");
    const t = PANEL_EXPLAINER.paragraphs.join(' ');
    for (const w of ['garage', 'basement', 'meter', 'electrician']) expect(t).toContain(w);
  });

  it('no forbidden topics in any client copy', () => {
    const blob = JSON.stringify([...ALL.map((id) => questionCopy(id, 'station')), PANEL_EXPLAINER]).toLowerCase();
    for (const w of ['permit', 'septic', 'amperage', 'internet']) expect(blob).not.toContain(w);
    expect(blob).not.toMatch(/\bamps?\b|\b(30|50) ?a\b/);
  });
});
