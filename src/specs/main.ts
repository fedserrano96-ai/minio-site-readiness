import { specValues } from './values';

const params = new URLSearchParams(window.location.search);
const values = specValues(params.get('model'), params.get('door'));

const content = document.getElementById('spec-content');
const missing = document.getElementById('spec-missing');
if (!content || !missing) {
  throw new Error('Spec page is missing #spec-content or #spec-missing.');
}

if (values === null) {
  content.hidden = true;
  missing.hidden = false;
} else {
  document.querySelectorAll<HTMLElement>('[data-field]').forEach((el) => {
    const key = el.dataset.field as keyof typeof values;
    if (!Object.prototype.hasOwnProperty.call(values, key)) {
      throw new Error(`Unknown spec field: ${el.dataset.field}`);
    }
    el.textContent = values[key];
  });
}
