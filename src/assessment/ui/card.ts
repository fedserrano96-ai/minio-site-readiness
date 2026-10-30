// The recommendation card at the top of screen 2 (spec 5.2, 5.3). Built with createElement and
// textContent only, so no string is ever parsed as HTML.
import './card.css';
import { MODELS } from '../core/data';
import type { CostLine, CostSummary, ModelId, Recommendation, Location, LeadTime } from '../core/types';
import {
  PRICE_DISCLAIMER, REP_LIST_TITLE, coverageText, costLineText, headline, leadTimeText, modelName,
  noteText, pillText, rangeText, sideItemText, toCheckText,
} from './copy';
import { ctaButtons } from './plan-view';

export interface CardView {
  rec: Recommendation;
  cost: CostSummary;
  lead: LeadTime;
  location: Location | null;
  change: { what: string; why: string } | null;
  /** Phone only: whether the details sheet is open. The app owns this; the toggle reports changes. */
  open: boolean;
}

const BODY_ID = 'mo-card-body';

const LINE_LABEL: Record<CostLine['id'], string> = {
  shipping: 'Shipping',
  install: 'Installation',
  base: 'Base',
  power: 'Power',
  plumbing: 'Water and sewer',
  ramps: 'Ramps for the steps',
};

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

function actions(el: HTMLElement, className: string, rec: Recommendation): HTMLElement {
  const wrap = h('div', className);
  wrap.append(...ctaButtons(el, rec));
  return wrap;
}

function linkButton(label: string, onClick: () => void): HTMLButtonElement {
  const b = h('button', 'mo-linkbtn', label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

function breakdown(cost: Extract<CostSummary, { mode: 'range' }>): HTMLElement {
  const details = h('details', 'mo-card__breakdown');
  details.append(h('summary', undefined, 'See the breakdown'));
  const list = h('ul');
  for (const line of cost.lines) {
    const li = h('li');
    const amount = rangeText(line.low, line.high, line.andUp) + (line.reference ? ' (reference)' : '');
    li.append(h('span', undefined, LINE_LABEL[line.id]), h('span', undefined, amount));
    list.append(li);
  }
  details.append(list);
  return details;
}

function noteItem(el: HTMLElement, code: Recommendation['notes'][number]): HTMLElement {
  const li = h('li');
  li.append(h('span', undefined, noteText(code)));
  if (code === 'clearance') {
    li.append(' ', linkButton('Adjust in the yard planner', () => emit(el, 'minio:edit-yard')));
  }
  if (code === 'twelveHalfBathOnly') {
    const to: ModelId = 'sixteen';
    li.append(' ', linkButton(`Switch to the ${MODELS[to].name}`, () => emit(el, 'minio:switch-model', to)));
  }
  return li;
}

export function renderCard(el: HTMLElement, view: CardView): void {
  const { rec, cost, lead, location, change, open } = view;
  el.className = 'mo-card';
  el.dataset.open = open ? 'true' : 'false';

  const pills = pillText(rec);
  const costLine = costLineText(cost);

  // Full card
  const body = h('div', 'mo-card__body');
  body.id = BODY_ID;

  const img = h('img', 'mo-card__photo');
  img.src = `assets/models/${rec.model}.jpg`;
  img.alt = modelName(rec.model);
  body.append(img);

  const changeText = change ? `Changed: ${change.what}. Why: ${change.why}` : null;
  if (changeText) body.append(h('p', 'mo-card__change', changeText));

  body.append(h('h2', 'mo-card__title', headline(rec)));

  const pillRow = h('div', 'mo-card__pills');
  pillRow.append(h('span', 'mo-pill', `Delivery: ${pills.delivery}`), h('span', 'mo-pill', `Base: ${pills.base}`));
  body.append(pillRow);

  body.append(h('p', 'mo-card__cost', costLine));
  if (cost.mode === 'range') {
    if (cost.side.length > 0) {
      const side = h('ul', 'mo-card__side');
      for (const item of cost.side) side.append(h('li', undefined, sideItemText(item)));
      body.append(side);
    }
    body.append(h('p', 'mo-card__disclaimer', PRICE_DISCLAIMER));
    body.append(breakdown(cost));
    body.append(h('p', 'mo-card__lead', leadTimeText(lead)));
  }

  body.append(h('p', 'mo-card__coverage', coverageText(location)));

  if (rec.notes.length > 0) {
    const notes = h('ul', 'mo-card__notes');
    for (const code of rec.notes) notes.append(noteItem(el, code));
    body.append(notes);
  }

  if (rec.toCheck.length > 0) {
    const section = h('div', 'mo-card__tocheck');
    section.append(h('h3', undefined, REP_LIST_TITLE));
    const list = h('ul');
    for (const code of rec.toCheck) list.append(h('li', undefined, toCheckText(code)));
    section.append(list);
    body.append(section);
  }

  body.append(actions(el, 'mo-card__actions', rec));

  // Compact bar, shown instead of the card below 768 px (see card.css)
  const bar = h('div', 'mo-card__bar');
  const toggle = h('button', 'mo-card__toggle');
  toggle.type = 'button';
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-controls', BODY_ID);
  toggle.append(
    h('span', 'mo-card__bar-model', `${modelName(rec.model)} · ${pills.delivery}`),
    h('span', 'mo-card__bar-cost', costLine),
    h('span', 'mo-card__bar-more', open ? 'Hide details' : 'Show details'),
  );
  toggle.addEventListener('click', () => {
    const next = el.dataset.open !== 'true';
    el.dataset.open = String(next);
    toggle.setAttribute('aria-expanded', String(next));
    const more = toggle.querySelector('.mo-card__bar-more');
    if (more) more.textContent = next ? 'Hide details' : 'Show details';
    emit(el, 'minio:card-toggle', next);
  });
  if (changeText) bar.append(h('p', 'mo-card__bar-change', changeText));
  bar.append(toggle, actions(el, 'mo-card__bar-actions', rec));

  el.replaceChildren(body, bar);
}
