// "Your plan": the panel after the last question on screen 2 (spec 6). The headline, the numbered
// walk-through, the rep list, the price as a supporting detail, and the buttons. Built with
// createElement and textContent only. Buttons dispatch bubbling events; the app decides what they do.
import './plan-view.css';
import type { CostSummary, LeadTime, Location, Recommendation } from '../core/types';
import {
  PRICE_DISCLAIMER, REP_LIST_TITLE, TALK_FIRST_LINE, costLineText, coverageText, headline, leadTimeText,
  noteText, rangeText, sideItemText, toCheckText,
} from './copy';
import { planSteps, type PlanStep } from './plan-copy';
import { LINE_LABEL } from './print';

export interface PlanView {
  rec: Recommendation;
  cost: CostSummary;
  lead: LeadTime;
  location: Location | null;
  /** The client chose "Continue without saving" after a failed save: offer printing instead. */
  offerPrint: boolean;
}

/** Let's talk leads when there is something to check with the client, or the plan itself is a call (spec 6.5). */
export function talkFirst(rec: Recommendation): boolean {
  return rec.toCheck.length > 0 || rec.method === 'talk';
}

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, className?: string, content?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function emit(el: HTMLElement, type: string, detail?: unknown): void {
  el.dispatchEvent(new CustomEvent(type, { bubbles: true, detail }));
}

function button(label: string, className: string, onClick: () => void): HTMLButtonElement {
  const b = h('button', className, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

/** Design my pod and Let's talk, primary first. The card uses the same pair (spec 6.5). */
export function ctaButtons(el: HTMLElement, rec: Recommendation): HTMLButtonElement[] {
  const design = (className: string) => button('Design my pod', className, () => emit(el, 'minio:cta', 'design'));
  const talk = (className: string) => button("Let's talk", className, () => emit(el, 'minio:cta', 'talk'));
  return talkFirst(rec)
    ? [talk('mo-btn mo-btn--primary'), design('mo-btn mo-btn--secondary')]
    : [design('mo-btn mo-btn--primary'), talk('mo-btn mo-btn--secondary')];
}

function stepItem(step: PlanStep): HTMLLIElement {
  const li = h('li', 'mo-plan__step');
  li.append(h('h3', undefined, step.title));
  for (const line of step.lines) li.append(h('p', undefined, line));
  if (step.link) {
    const a = h('a', undefined, step.link.label);
    a.href = step.link.href;
    a.target = '_blank';
    a.rel = 'noopener';
    const p = h('p', 'mo-plan__link');
    p.append(a);
    li.append(p);
  }
  return li;
}

function priceBlock(cost: CostSummary, lead: LeadTime, location: Location | null): HTMLElement {
  const wrap = h('div', 'mo-plan__price');
  wrap.append(h('p', 'mo-plan__cost', costLineText(cost)));
  if (cost.mode === 'range') {
    if (cost.side.length > 0) {
      const side = h('ul', 'mo-plan__side');
      for (const item of cost.side) side.append(h('li', undefined, sideItemText(item)));
      wrap.append(side);
    }
    wrap.append(h('p', 'mo-plan__disclaimer', PRICE_DISCLAIMER));
    const details = h('details', 'mo-plan__breakdown');
    details.append(h('summary', undefined, 'See the breakdown'));
    const list = h('ul');
    for (const line of cost.lines) {
      const li = h('li');
      const amount = rangeText(line.low, line.high, line.andUp) + (line.reference ? ' (reference)' : '');
      li.append(h('span', undefined, LINE_LABEL[line.id]), h('span', undefined, amount));
      list.append(li);
    }
    details.append(list);
    wrap.append(details, h('p', 'mo-plan__lead', leadTimeText(lead)));
  }
  wrap.append(h('p', 'mo-plan__coverage', coverageText(location)));
  return wrap;
}

/** Dispatches `minio:cta` ('design' | 'talk' | 'save'), `minio:print` and `minio:back`. */
export function renderPlan(el: HTMLElement, view: PlanView): void {
  const { rec, cost, lead, location, offerPrint } = view;
  el.className = 'mo-plan';

  const nodes: HTMLElement[] = [h('h2', 'mo-plan__title', headline(rec))];
  if (rec.notes.includes('twelveHalfBathOnly')) nodes.push(h('p', 'mo-plan__note', noteText('twelveHalfBathOnly')));

  const steps = h('ol', 'mo-plan__steps');
  // list-style: none drops the list role in Safari.
  steps.setAttribute('role', 'list');
  for (const step of planSteps(rec, location)) steps.append(stepItem(step));
  nodes.push(steps);

  if (rec.toCheck.length > 0) {
    const section = h('div', 'mo-plan__replist');
    section.append(h('h3', undefined, REP_LIST_TITLE));
    const list = h('ul');
    for (const code of rec.toCheck) list.append(h('li', undefined, toCheckText(code)));
    section.append(list);
    if (talkFirst(rec)) section.append(h('p', 'mo-plan__talk', TALK_FIRST_LINE));
    nodes.push(section);
  }

  nodes.push(priceBlock(cost, lead, location));

  const actions = h('div', 'mo-plan__actions');
  actions.append(...ctaButtons(el, rec));
  const more = h('div', 'mo-plan__actions');
  more.append(button('Save my plan', 'mo-btn mo-btn--secondary', () => emit(el, 'minio:cta', 'save')));
  if (offerPrint) more.append(button('Print / save as PDF', 'mo-btn mo-btn--secondary', () => emit(el, 'minio:print')));
  nodes.push(actions, more, button('Back', 'mo-plan__back', () => emit(el, 'minio:back')));

  el.replaceChildren(...nodes);
}
