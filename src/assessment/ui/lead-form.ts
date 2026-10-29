// The panels behind the CTAs (spec 7): the lead form, the "saving" and failure states, and the
// saved confirmation. Built with createElement and textContent only. Buttons dispatch bubbling
// events; the app decides what they do.
import type { SubmissionPayload } from '../../server/airtable-fields';

export type Contact = SubmissionPayload['contact'];

// The same pattern the old assessment used.
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const LEAD_LINE = "We'll save your plan so a Mini·O advisor can pick up where you left off.";
const EMAIL_ERROR = 'Please enter a valid email address.';
const EMAIL_ERROR_ID = 'mo-lead-email-error';

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

function field(label: string, optional: boolean, input: HTMLInputElement): HTMLElement {
  const wrap = h('div', 'mo-lead__field');
  const text = h('label', 'mo-lead__label', label);
  input.id = `mo-lead-${label.toLowerCase().replace(/\s+/g, '-')}`;
  text.htmlFor = input.id;
  if (optional) text.append(h('span', 'mo-lead__optional', ' (optional)'));
  wrap.append(text, input);
  return wrap;
}

function input(type: string, value: string, autocomplete: string): HTMLInputElement {
  const i = h('input', 'mo-lead__input');
  i.type = type;
  i.value = value;
  i.setAttribute('autocomplete', autocomplete);
  return i;
}

/** Dispatches `minio:lead-submit` ({ email, firstName, phone }) or `minio:lead-cancel`. */
export function renderLeadForm(el: HTMLElement, contact: Contact): void {
  el.className = 'mo-lead';
  const form = h('form', 'mo-lead__form');
  form.noValidate = true;

  const email = input('email', contact.email, 'email');
  email.required = true;
  email.setAttribute('aria-describedby', EMAIL_ERROR_ID);
  const firstName = input('text', contact.firstName, 'given-name');
  const phone = input('tel', contact.phone, 'tel');

  const error = h('p', 'mo-lead__error');
  error.id = EMAIL_ERROR_ID;
  error.setAttribute('role', 'alert');

  const submit = h('button', 'mo-lead__btn mo-lead__btn--primary', 'Continue');
  submit.type = 'submit';

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const value = email.value.trim();
    if (!EMAIL_RE.test(value)) {
      error.textContent = EMAIL_ERROR;
      email.setAttribute('aria-invalid', 'true');
      email.focus();
      return;
    }
    error.textContent = '';
    email.removeAttribute('aria-invalid');
    emit(el, 'minio:lead-submit', { email: value, firstName: firstName.value.trim(), phone: phone.value.trim() });
  });

  const row = h('div', 'mo-lead__row');
  row.append(submit, button('Not now', 'mo-lead__btn', () => emit(el, 'minio:lead-cancel')));

  form.append(
    field('Email', false, email), error, field('First name', true, firstName), field('Phone', true, phone), row,
  );
  el.replaceChildren(h('h2', 'mo-lead__title', 'Save your plan'), h('p', 'mo-lead__line', LEAD_LINE), form);
}

export function renderSaving(el: HTMLElement): void {
  el.className = 'mo-lead';
  const status = h('p', 'mo-lead__line', 'One moment.');
  status.setAttribute('role', 'status');
  el.replaceChildren(h('h2', 'mo-lead__title', 'Saving your plan'), status);
}

/** Dispatches `minio:retry` or `minio:continue`. */
export function renderFailure(el: HTMLElement, message: string): void {
  el.className = 'mo-lead';
  const text = h('p', 'mo-lead__error mo-lead__error--block', message);
  text.setAttribute('role', 'alert');
  const row = h('div', 'mo-lead__row');
  row.append(button('Try again', 'mo-lead__btn mo-lead__btn--primary', () => emit(el, 'minio:retry')));
  el.replaceChildren(
    h('h2', 'mo-lead__title', "We couldn't save your plan"),
    text,
    row,
    button('Continue without saving', 'mo-lead__link', () => emit(el, 'minio:continue')),
  );
}

/** Dispatches `minio:print` or `minio:dismiss`. */
export function renderSaved(el: HTMLElement): void {
  el.className = 'mo-lead';
  const row = h('div', 'mo-lead__row');
  row.append(
    button('Print / save as PDF', 'mo-lead__btn mo-lead__btn--primary', () => emit(el, 'minio:print')),
    button('Back to my questions', 'mo-lead__btn', () => emit(el, 'minio:dismiss')),
  );
  el.replaceChildren(h('h2', 'mo-lead__title', 'Saved. A Mini·O advisor will reach out.'), row);
}
