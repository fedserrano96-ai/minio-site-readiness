// One question at a time on screen 2 (spec 6.1). Built with createElement and textContent, so
// nothing the client types is ever parsed as HTML. The drawings are the one exception: they are
// constant SVG strings from drawings.ts.
import './question-view.css';
import type { ModelId, QuestionId, Recommendation } from '../core/types';
import { lookupLocation } from '../core/location';
import { drawing } from './drawings';
import { questionCopy } from './questions-copy';

export interface QuestionView {
  id: QuestionId;
  index: number; // zero-based position among the visible questions
  total: number;
  model: ModelId; // the effective model (after any "Switch to")
  door: Recommendation['door']; // the door the pod will have, for the power spec link
  value: string | undefined;
  canGoBack: boolean;
}

const TITLE_ID = 'mo-q-title';
const ERROR_ID = 'mo-q-error';
const ZIP_ERROR = "We couldn't find that ZIP or postal code.";

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

function zipControls(el: HTMLElement, q: QuestionView): HTMLElement {
  const wrap = h('div', 'mo-q__zip');

  const input = h('input', 'mo-q__input');
  input.type = 'text';
  input.value = q.value ?? '';
  input.maxLength = 10;
  input.autocomplete = 'postal-code';
  input.setAttribute('aria-labelledby', TITLE_ID);
  input.setAttribute('aria-describedby', ERROR_ID);
  input.placeholder = 'ZIP or postal code';

  const error = h('p', 'mo-q__error');
  error.id = ERROR_ID;
  error.setAttribute('role', 'alert');

  const submit = (): void => {
    if (lookupLocation(input.value) === null) {
      error.textContent = ZIP_ERROR;
      input.setAttribute('aria-invalid', 'true');
      return;
    }
    error.textContent = '';
    input.removeAttribute('aria-invalid');
    emit(el, 'minio:answer', { id: q.id, value: input.value.trim() });
  };
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); }
  });

  const row = h('div', 'mo-q__row');
  row.append(
    button('Next', 'mo-q__btn mo-q__btn--primary', submit),
    button('Skip for now', 'mo-q__btn', () => emit(el, 'minio:next')),
  );
  wrap.append(input, error, row);
  return wrap;
}

function specLink(kind: 'base' | 'power', q: QuestionView): HTMLElement {
  const p = h('p', 'mo-q__speclink');
  const a = h('a', undefined, `Get the ${kind} spec for your contractor`);
  a.href = kind === 'base'
    ? `contractor/base.html?model=${q.model}`
    : `contractor/power.html?model=${q.model}&door=${q.door}`;
  a.target = '_blank';
  a.rel = 'noopener';
  p.append(a);
  return p;
}

export function renderQuestion(el: HTMLElement, q: QuestionView): void {
  const copy = questionCopy(q.id, q.model);
  el.className = 'mo-q';

  const progress = h('p', 'mo-q__progress', `Question ${q.index + 1} of ${q.total}`);

  const art = h('div', 'mo-q__art');
  art.innerHTML = drawing(q.id); // constant SVG from drawings.ts, never user input

  const title = h('h2', 'mo-q__title', copy.title);
  title.id = TITLE_ID;

  const details = h('details', 'mo-q__help');
  details.append(h('summary', undefined, 'What does this mean, and how do I measure it?'), h('p', undefined, copy.help));
  if (copy.specLink) details.append(specLink(copy.specLink, q));

  let controls: HTMLElement;
  if (q.id === 'zip') {
    controls = zipControls(el, q);
  } else {
    controls = h('div', 'mo-q__options');
    controls.setAttribute('role', 'group');
    controls.setAttribute('aria-labelledby', TITLE_ID);
    for (const opt of copy.options) {
      const b = h('button', 'mo-q__option', opt.label);
      b.type = 'button';
      b.setAttribute('aria-pressed', String(q.value === opt.value));
      b.addEventListener('click', () => {
        // "I'm not sure" opens the how-to-measure section (spec 6.2).
        if (opt.value === 'unsure') details.open = true;
        emit(el, 'minio:answer', { id: q.id, value: opt.value });
      });
      controls.append(b);
    }
    if (q.value === 'unsure') details.open = true;
  }

  el.replaceChildren(progress, art, title, controls);
  // Once a question has an answer (including "I'm not sure", which stays here with the help open),
  // Next moves on. The ZIP question has its own Next.
  if (q.id !== 'zip' && q.value !== undefined) {
    const row = h('div', 'mo-q__row mo-q__next');
    row.append(button('Next', 'mo-q__btn mo-q__btn--primary', () => emit(el, 'minio:next')));
    el.append(row);
  }
  el.append(details);

  if (q.canGoBack) {
    el.append(button('Back', 'mo-q__back', () => emit(el, 'minio:back')));
  }
}
