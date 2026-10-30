// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';
import { renderPlan, talkFirst, type PlanView } from '../../src/assessment/ui/plan-view';
import { PRICE_DISCLAIMER, costLineText, headline, leadTimeText, noteText, toCheckText } from '../../src/assessment/ui/copy';
import { planSteps } from '../../src/assessment/ui/plan-copy';
import { recommend } from '../../src/assessment/core/rules';
import { leadTime, priceRecommendation } from '../../src/assessment/core/pricing';
import { lookupLocation } from '../../src/assessment/core/location';
import type { Answers, Location, ModelId, PlannerSnapshot } from '../../src/assessment/core/types';

const snapshot: PlannerSnapshot = {
  model: 'sixteen', rotation: 0, yardW: 40, yardD: 30, podX: 20, podY: 15, podUse: 'office', objects: [],
};

const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ');

function view(answers: Answers = {}, location: Location | null = null, offerPrint = false, model?: ModelId): PlanView {
  const rec = recommend(snapshot, answers, model);
  return { rec, cost: priceRecommendation(rec, location, answers), lead: leadTime(rec, location), location, offerPrint };
}

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

let el: HTMLElement;
beforeEach(() => {
  document.body.replaceChildren();
  el = document.createElement('div');
  document.body.append(el);
});

describe('renderPlan', () => {
  it('shows headline, steps, rep list and talk-first buttons', () => {
    const r = recommend(snapshot, { truckAccess: 'unsure' });
    renderPlan(el, { rec: r, cost: priceRecommendation(r, null, {}), lead: leadTime(r, null), location: null, offerPrint: false });
    expect(el.querySelector('h2')!.textContent).toBe(headline(r));
    expect(el.querySelectorAll('ol > li').length).toBe(3);
    expect(text(el)).toContain("We'll check these with you on the call");
    expect(text(el)).toContain("Book a call and we'll go over these with you.");
    expect(Array.from(el.querySelectorAll('ul li')).map((li) => li.textContent)).toContain(toCheckText('truckAccess'));
    const buttons = Array.from(el.querySelectorAll('button')).map((b) => b.textContent);
    expect(buttons.slice(0, 2)).toEqual(["Let's talk", 'Design my pod']);
    expect(button(el, "Let's talk").className).toContain('mo-btn--primary');
    expect(button(el, 'Design my pod').className).toContain('mo-btn--secondary');
  });

  it('empty rep list: no list, Design my pod first', () => {
    const r = recommend(snapshot, {});
    renderPlan(el, { rec: r, cost: priceRecommendation(r, null, {}), lead: leadTime(r, null), location: null, offerPrint: false });
    expect(text(el)).not.toContain("We'll check these with you on the call");
    expect(text(el)).not.toContain("Book a call and we'll go over these with you.");
    expect(el.querySelector('button')!.textContent).toBe('Design my pod');
    expect(button(el, 'Design my pod').className).toContain('mo-btn--primary');
  });

  it('each step shows its title, lines and link, opening in a new tab', () => {
    const outside = lookupLocation('75201')!;
    const v = view({}, outside);
    renderPlan(el, v);
    const steps = planSteps(v.rec, outside);
    const items = el.querySelectorAll('ol > li');
    expect(items).toHaveLength(steps.length);
    steps.forEach((step, i) => {
      const li = items[i]!;
      expect(li.querySelector('h3')!.textContent).toBe(step.title);
      for (const line of step.lines) expect(text(li)).toContain(line);
      const a = li.querySelector('a');
      if (step.link === null) {
        expect(a).toBeNull();
      } else {
        expect(a!.getAttribute('href')).toBe(step.link.href);
        expect(a!.textContent).toBe(step.link.label);
        expect(a!.target).toBe('_blank');
        expect(a!.rel).toBe('noopener');
      }
    });
    expect(el.querySelector('a[href="contractor/power.html?model=sixteen&door=standard"]')).not.toBeNull();
  });

  it('adds the Water step with a bathroom', () => {
    renderPlan(el, view({ bathroom: 'half' }));
    expect(el.querySelectorAll('ol > li')).toHaveLength(4);
    expect(text(el)).toContain('Your pod will need a licensed plumber to connect it to your water and sewer.');
  });

  it('shows the Twelve-with-shower note under the headline', () => {
    const v = view({ bathroom: 'shower' }, null, false, 'twelve');
    renderPlan(el, v);
    expect(text(el)).toContain(noteText('twelveHalfBathOnly'));
    renderPlan(el, view({ bathroom: 'half' }, null, false, 'twelve'));
    expect(text(el)).not.toContain(noteText('twelveHalfBathOnly'));
  });

  it('shows the price block', () => {
    const seattle = lookupLocation('98101')!;
    const v = view({}, seattle);
    renderPlan(el, v);
    const t = text(el);
    expect(t).toContain(costLineText(v.cost));
    expect(t).toContain(PRICE_DISCLAIMER);
    expect(t).toContain(leadTimeText(v.lead));
    expect(t).toContain('Mini·O arranges local contractors in your area.');
    const rows = Array.from(el.querySelectorAll('details li')).map((li) => text(li));
    expect(rows.find((r) => r.startsWith('Shipping'))).toContain('$1,100');
  });

  it('labels the ramps line', () => {
    renderPlan(el, view({ truckAccess: 'no', pathWidth: 'wide', turn: 'none', overhead: 'clear', pathGround: 'shortSteps' }));
    const rows = Array.from(el.querySelectorAll('details li')).map((li) => text(li));
    expect(rows.some((r) => r.startsWith('Ramps for the steps'))).toBe(true);
  });

  it('talk mode shows the talk cost line and no breakdown', () => {
    renderPlan(el, view({ truckAccess: 'no', overhead: 'other', powerLines: 'yes', kitAccess: 'no' }));
    expect(text(el)).toContain("We'll work this out with you");
    expect(el.querySelector('details')).toBeNull();
  });

  it('buttons emit minio:cta, minio:print and minio:back', () => {
    renderPlan(el, view({}, null, true));
    const cta = listen(el, 'minio:cta');
    const print = listen(el, 'minio:print');
    const back = listen(el, 'minio:back');
    button(el, 'Design my pod').click();
    button(el, "Let's talk").click();
    button(el, 'Save my plan').click();
    button(el, 'Print / save as PDF').click();
    button(el, 'Back').click();
    expect(cta).toEqual(['design', 'talk', 'save']);
    expect(print).toHaveLength(1);
    expect(back).toHaveLength(1);
    expect(Array.from(el.querySelectorAll('button')).map((b) => b.textContent))
      .toEqual(['Design my pod', "Let's talk", 'Save my plan', 'Print / save as PDF', 'Back']);
  });

  it('offers print only when asked', () => {
    renderPlan(el, view());
    expect(Array.from(el.querySelectorAll('button')).some((b) => b.textContent === 'Print / save as PDF')).toBe(false);
  });
});

describe('talkFirst', () => {
  it('is true only when the rep list has items', () => {
    expect(talkFirst(recommend(snapshot, {}))).toBe(false);
    expect(talkFirst(recommend(snapshot, { truckAccess: 'unsure' }))).toBe(true);
  });
});
