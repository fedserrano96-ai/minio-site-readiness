// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderQuestion } from '../../src/assessment/ui/question-view';
import { PANEL_EXPLAINER, questionCopy } from '../../src/assessment/ui/questions-copy';
import { drawing, panelDrawing } from '../../src/assessment/ui/drawings';
import { QUESTION_ORDER } from '../../src/assessment/core/questions';
import type { ModelId, QuestionId } from '../../src/assessment/core/types';

type View = Parameters<typeof renderQuestion>[1];

function render(over: Partial<View> = {}): HTMLElement {
  const el = document.createElement('div');
  document.body.append(el);
  renderQuestion(el, {
    id: 'pathWidth', index: 0, total: 5, model: 'twelve', value: undefined, canGoBack: false, ...over,
  });
  return el;
}

const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ');
/** An SVG string as the DOM serializes it, to compare with an element's innerHTML. */
const serialized = (svg: string) => { const d = document.createElement('div'); d.innerHTML = svg; return d.innerHTML; };

function listen(el: HTMLElement, type: string): unknown[] {
  const events: unknown[] = [];
  el.addEventListener(type, (e) => events.push((e as CustomEvent).detail));
  return events;
}

function button(el: HTMLElement, label: string): HTMLButtonElement {
  const b = Array.from(el.querySelectorAll('button')).find((x) => x.textContent === label);
  if (!b) throw new Error(`no button "${label}"`);
  return b;
}

describe('renderQuestion', () => {
  it('renders title, drawing, options and help collapsed', () => {
    const el = render();
    const labels = Array.from(el.querySelectorAll('button')).map((b) => b.textContent);
    expect(labels).toContain('10 ft or wider');
    expect(labels).toContain("I'm not sure");
    const details = el.querySelector('details');
    expect(details).not.toBeNull();
    expect(details!.open).toBe(false);
    expect(details!.querySelector('summary')!.textContent).toBe('What does this mean, and how do I measure it?');
    expect(el.querySelector('svg')).not.toBeNull();
    expect(el.querySelector('h2')!.textContent).toBe(questionCopy('pathWidth', 'twelve').title);
  });

  it('clicking an option dispatches minio:answer', () => {
    const el = render();
    const events = listen(el, 'minio:answer');
    button(el, 'Narrower than 10 ft').click();
    expect(events).toEqual([{ id: 'pathWidth', value: 'narrow' }]);
  });

  it('marks the selected option', () => {
    const el = render({ value: 'wide' });
    expect(button(el, '10 ft or wider').getAttribute('aria-pressed')).toBe('true');
    expect(button(el, 'Narrower than 10 ft').getAttribute('aria-pressed')).toBe('false');
  });

  it('progress line shows the group', () => {
    const el = render({ id: 'turn', index: 2, total: 10 });
    expect(text(el.querySelector('.mo-q__progress')!)).toBe('Getting it there · Question 3 of 10');
    expect(text(render({ id: 'panelRoute', index: 9, total: 10 }).querySelector('.mo-q__progress')!))
      .toBe('Power · Question 10 of 10');
  });

  it('draws the question for the model shown', () => {
    const el = render({ id: 'pathWidth', model: 'sixteen' });
    expect(el.querySelector('.mo-q__art')!.innerHTML).toBe(serialized(drawing('pathWidth', 'sixteen')));
    expect(el.querySelector('.mo-q__art')!.innerHTML).not.toBe(serialized(drawing('pathWidth', 'twelve')));
  });

  it('help lists the numbered steps', () => {
    const el = render({ id: 'pathWidth', model: 'sixteen' });
    const steps = questionCopy('pathWidth', 'sixteen').steps;
    const items = Array.from(el.querySelectorAll('.mo-q__help ol li')).map((li) => li.textContent);
    expect(items.length).toBe(steps.length);
    expect(items).toEqual(steps);
    expect(el.querySelector('.mo-q__help p')!.textContent).toBe(questionCopy('pathWidth', 'sixteen').help);
  });

  it('panel question shows the explainer and its drawing', () => {
    const el = render({ id: 'panelDistance' });
    expect(text(el)).toContain("What's an electrical panel?");
    for (const p of PANEL_EXPLAINER.paragraphs) expect(text(el)).toContain(p);
    const explainer = el.querySelector('.mo-q__explainer')!;
    expect(explainer.closest('details')).not.toBeNull();
    expect(explainer.querySelector('.mo-q__art')!.innerHTML).toBe(serialized(panelDrawing()));
  });

  it('only the panel question has the explainer', () => {
    for (const id of QUESTION_ORDER.filter((q) => q !== 'panelDistance')) {
      expect(text(render({ id })), id).not.toContain("What's an electrical panel?");
    }
  });

  it('shows Back only when it can go back, and dispatches minio:back', () => {
    expect(Array.from(render().querySelectorAll('button')).some((b) => b.textContent === 'Back')).toBe(false);
    const el = render({ canGoBack: true });
    const events = listen(el, 'minio:back');
    button(el, 'Back').click();
    expect(events).toHaveLength(1);
  });

  it('zip accepts a valid code', () => {
    const el = render({ id: 'zip' });
    const answers = listen(el, 'minio:answer');
    const input = el.querySelector('input')!;
    input.value = '98101';
    button(el, 'Next').click();
    expect(answers).toEqual([{ id: 'zip', value: '98101' }]);
  });

  it('zip rejects an unrecognized code with an error and no event', () => {
    const el = render({ id: 'zip' });
    const answers = listen(el, 'minio:answer');
    const input = el.querySelector('input')!;
    input.value = '1234';
    button(el, 'Next').click();
    expect(answers).toEqual([]);
    expect(el.textContent).toContain("We couldn't find that ZIP or postal code.");
  });

  it('zip shows the saved value and skip dispatches minio:next without an answer', () => {
    const el = render({ id: 'zip', value: '98101' });
    expect(el.querySelector('input')!.value).toBe('98101');
    const answers = listen(el, 'minio:answer');
    const next = listen(el, 'minio:next');
    button(el, 'Skip for now').click();
    expect(next).toHaveLength(1);
    expect(answers).toEqual([]);
  });

  it('treats a saved or typed ZIP as text, never as markup', () => {
    const el = render({ id: 'zip', value: '<b>x</b>' });
    const input = el.querySelector('input')!;
    expect(input.value).toBe('<b>x</b>');
    expect(el.querySelector('b')).toBeNull();
    input.value = '<b>y</b>';
    button(el, 'Next').click();
    expect(el.querySelector('b')).toBeNull();
    expect(el.querySelector('.mo-q__error')!.textContent).toBe("We couldn't find that ZIP or postal code.");
  });

  it('path width labels cover exactly the minimum width', () => {
    const labels = questionCopy('pathWidth', 'sixteen').options.map((o) => o.label);
    expect(labels).toContain('12 ft or wider');
    expect(labels).toContain('Narrower than 12 ft');
  });

  it('shows Next once the question has an answer, and Next dispatches minio:next', () => {
    expect(Array.from(render().querySelectorAll('button')).some((b) => b.textContent === 'Next')).toBe(false);
    const el = render({ value: 'unsure' });
    const next = listen(el, 'minio:next');
    const answers = listen(el, 'minio:answer');
    button(el, 'Next').click();
    expect(next).toHaveLength(1);
    expect(answers).toEqual([]);
    expect(el.querySelector('details')!.open).toBe(true);
    expect(button(render({ value: 'wide' }), 'Next')).toBeTruthy();
  });

  it('links the base spec from the base questions, for the model shown', () => {
    for (const id of ['existingBase', 'groundFlat'] as const) {
      const el = render({ id, model: 'sixteen' });
      const links = el.querySelectorAll('details a');
      expect(links, id).toHaveLength(1);
      const a = links[0] as HTMLAnchorElement;
      expect(a.getAttribute('href'), id).toBe('contractor/base.html?model=sixteen');
      expect(a.target).toBe('_blank');
      expect(a.rel).toContain('noopener');
      expect(a.textContent).toBe('Get the base spec for your contractor');
    }
  });

  it('links the power spec from the panel question, with the standard door', () => {
    const el = render({ id: 'panelDistance', model: 'twelve' });
    const a = el.querySelector('details a') as HTMLAnchorElement;
    expect(a.getAttribute('href')).toBe('contractor/power.html?model=twelve&door=standard');
    expect(a.target).toBe('_blank');
    expect(a.textContent).toBe('Get the power spec for your contractor');
  });

  it('has no spec link on the other questions', () => {
    for (const id of QUESTION_ORDER.filter((q) => !['existingBase', 'groundFlat', 'panelDistance'].includes(q))) {
      expect(render({ id }).querySelector('details a'), id).toBeNull();
    }
  });

  it('uses the model for model-dependent labels', () => {
    const el = render({ id: 'overhead', model: 'station' });
    expect(button(el, 'Nothing lower than 13 ft')).toBeTruthy();
  });
});

describe('copy and drawings', () => {
  const models: ModelId[] = ['twelve', 'sixteen', 'station'];

  it('every question has copy and a drawing', () => {
    for (const id of QUESTION_ORDER) {
      for (const model of models) {
        const c = questionCopy(id, model);
        expect(c.title.length, id).toBeGreaterThan(0);
        expect(c.help.length, id).toBeGreaterThan(0);
        if (id !== 'zip') {
          expect(c.options.map((o) => o.label), id).toContain("I'm not sure");
          expect(c.options.length, id).toBeGreaterThanOrEqual(2);
          expect(c.options.length, id).toBeLessThanOrEqual(5);
        }
      }
      const svg = drawing(id, 'sixteen');
      expect(svg.startsWith('<svg'), id).toBe(true);
      expect(svg, id).toContain('role="img"');
      expect(svg, id).toContain('aria-label=');
    }
  });

  it('only the base and panel questions carry a spec link', () => {
    expect(questionCopy('existingBase', 'twelve').specLink).toBe('base');
    expect(questionCopy('groundFlat', 'twelve').specLink).toBe('base');
    expect(questionCopy('panelDistance', 'twelve').specLink).toBe('power');
    expect(questionCopy('panelRoute', 'twelve').specLink).toBeUndefined();
  });

  it('uses the model name and the shared constants in copy', () => {
    expect(questionCopy('overhead', 'sixteen').title).toContain('12 ft');
    expect(questionCopy('overhead', 'station').title).toContain('13 ft');
    expect(questionCopy('kitAccess', 'twelve').title).toContain('3 ft');
    expect(questionCopy('groundFlat', 'twelve').options.map((o) => o.label).join(' ')).toContain('¼ in. per foot');
  });

  it('keeps permits, HOA and setbacks out of every question', () => {
    const ids: QuestionId[] = QUESTION_ORDER;
    for (const id of ids) {
      const c = questionCopy(id, 'sixteen');
      const text = [c.title, c.help, ...c.options.map((o) => o.label)].join(' ').toLowerCase();
      expect(text, id).not.toMatch(/permit|hoa|setback/);
    }
  });
});
