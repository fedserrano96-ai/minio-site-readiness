import { describe, it, expect } from 'vitest';
import { drawing, panelDrawing } from '../../src/assessment/ui/drawings';
import { questionCopy } from '../../src/assessment/ui/questions-copy';
import { QUESTION_ORDER } from '../../src/assessment/core/questions';

describe('drawings', () => {
  it('every question has a drawing whose callouts match its steps', () => {
    for (const model of ['twelve', 'sixteen', 'station'] as const) {
      for (const id of QUESTION_ORDER) {
        const svg = drawing(id, model);
        expect(svg.startsWith('<svg')).toBe(true);
        expect(svg).toContain('role="img"');
        const callouts = svg.match(/data-callout="\d+"/g) ?? [];
        expect(callouts.length).toBe(questionCopy(id, model).steps.length);
      }
    }
  });

  it('numbers the callouts 1 to n, in order', () => {
    for (const id of QUESTION_ORDER) {
      const found = [...drawing(id, 'sixteen').matchAll(/data-callout="(\d+)"/g)].map((m) => Number(m[1]));
      expect(found).toEqual(found.map((_, i) => i + 1));
    }
  });

  it('dimension labels use the model figures', () => {
    expect(drawing('pathWidth', 'twelve')).toContain('10 ft');
    expect(drawing('pathWidth', 'sixteen')).toContain('12 ft');
    expect(drawing('overhead', 'station')).toContain('13 ft');
    expect(drawing('turn', 'sixteen')).toContain('24 ft');
    expect(drawing('turn', 'twelve')).toContain('20 ft');
  });

  it('panel drawing exists', () => expect(panelDrawing()).toContain('role="img"'));

  it('no external references', () => {
    for (const id of QUESTION_ORDER) expect(drawing(id, 'sixteen')).not.toMatch(/href=|src=|url\(/);
    expect(panelDrawing()).not.toMatch(/href=|src=|url\(/);
  });
});
