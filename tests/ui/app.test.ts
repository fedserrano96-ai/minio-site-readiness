// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createApp } from '../../src/assessment/ui/app';
import { questionCopy } from '../../src/assessment/ui/questions-copy';
import type { PlannerSnapshot, QuestionId } from '../../src/assessment/core/types';

const snapshot: PlannerSnapshot = {
  model: 'sixteen', rotation: 0, yardW: 40, yardD: 30, podX: 20, podY: 15, podUse: 'office', objects: [],
};
const REC_ID = 'recAAAAAAAAAAAAAA';
const STORAGE_KEY = 'minio-assessment-v2';

function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => { map.delete(k); },
    setItem: (k: string, v: string) => { map.set(k, v); },
  };
}

function reply(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

const flush = () => new Promise<void>((r) => setTimeout(r, 0));
const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ');

function setup(over: { fetchFn?: typeof fetch; storage?: Storage } = {}) {
  document.body.replaceChildren();
  const root = document.createElement('div');
  document.body.append(root);
  const storage = over.storage ?? fakeStorage();
  const fetchFn = over.fetchFn ?? (vi.fn(async () => reply(200, { id: REC_ID })) as unknown as typeof fetch);
  const navigate = vi.fn();
  const print = vi.fn();
  const app = createApp(root, { fetchFn, storage, navigate, print });
  return { root, storage, fetchFn: fetchFn as unknown as ReturnType<typeof vi.fn>, navigate, print, app };
}

function button(root: HTMLElement, label: string): HTMLButtonElement {
  const b = Array.from(root.querySelectorAll('button')).find((x) => x.textContent?.trim() === label);
  if (!b) throw new Error(`no button "${label}"`);
  return b;
}

/** The card's buttons exist twice (full card and phone bar); the first is enough. */
const cardButton = (root: HTMLElement, label: string) => button(root.querySelector<HTMLElement>('.mo-card')!, label);

function choose(root: HTMLElement, id: QuestionId, value: string): void {
  const label = questionCopy(id, 'sixteen').options.find((o) => o.value === value)?.label;
  if (!label) throw new Error(`no option ${value} for ${id}`);
  button(root, label).click();
}

function fillLeadForm(root: HTMLElement, email: string): void {
  const input = root.querySelector<HTMLInputElement>('input[type="email"]');
  if (!input) throw new Error('lead form is not showing');
  input.value = email;
  button(root, 'Continue').click();
}

const body = (fetchFn: ReturnType<typeof vi.fn>, call = 0) =>
  JSON.parse((fetchFn.mock.calls[call]![1] as RequestInit).body as string);

beforeEach(() => { document.body.replaceChildren(); });

describe('createApp', () => {
  it('start shows the starting card and the ZIP question', () => {
    const { root, app } = setup();
    app.start(snapshot);
    expect(text(root.querySelector('.mo-card')!)).toContain('The Sixteen, delivered ready-built');
    expect(text(root.querySelector('.mo-q')!)).toContain("What's the ZIP code where the pod is going?");
    expect(text(root)).toContain('Question 1 of');
  });

  it('moves focus to the new question title', () => {
    const { root, app } = setup();
    app.start(snapshot);
    expect(document.activeElement).toBe(root.querySelector('.mo-q__title'));
  });

  it('answering advances to the next visible question and updates the card', () => {
    const { root, app } = setup();
    app.start(snapshot);
    button(root, 'Skip for now').click();
    expect(text(root.querySelector('.mo-q')!)).toContain('Can a truck drive right up to the spot?');
    choose(root, 'truckAccess', 'no');
    const card = text(root.querySelector('.mo-card')!);
    expect(card).toContain('truck + shed mule');
    expect(card).toContain('Changed: truck + shed mule delivery');
    expect(text(root.querySelector('.mo-q')!)).toContain('How wide is the narrowest point');
    expect(document.activeElement).toBe(root.querySelector('.mo-q__title'));
  });

  it('Back on the first question asks the page to return to the yard planner', () => {
    const { root, app } = setup();
    app.start(snapshot);
    const heard = vi.fn();
    document.addEventListener('minio:edit-yard', heard);
    button(root, 'Back').click();
    document.removeEventListener('minio:edit-yard', heard);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it('Back on a later question returns to the previous one', () => {
    const { root, app } = setup();
    app.start(snapshot);
    button(root, 'Skip for now').click();
    button(root, 'Back').click();
    expect(text(root.querySelector('.mo-q')!)).toContain("What's the ZIP code");
  });

  it('first CTA opens the lead form, then submits and navigates', async () => {
    const { root, app, fetchFn, navigate, storage } = setup();
    app.start(snapshot);
    cardButton(root, 'Design my pod').click();
    expect(text(root)).toContain("We'll save your plan so a Mini·O advisor can pick up where you left off.");
    expect(root.querySelector('input[type="email"]')).not.toBeNull();
    fillLeadForm(root, 'sam@example.com');
    await flush();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(fetchFn.mock.calls[0]![0]).toBe('/.netlify/functions/submit');
    const sent = body(fetchFn);
    expect(sent.recordId).toBeUndefined();
    expect(sent.contact.email).toBe('sam@example.com');
    expect(sent.ctaHistory).toEqual(['design']);
    expect(navigate).toHaveBeenCalledWith('https://minioffice.co/quote');
    expect(JSON.parse(storage.getItem(STORAGE_KEY)!).recordId).toBe(REC_ID);
  });

  it('keeps the record id when start() runs while a submit is in flight', async () => {
    let resolve!: (r: Response) => void;
    const pending = new Promise<Response>((r) => { resolve = r; });
    const fetchFn = vi.fn()
      .mockImplementationOnce(() => pending)
      .mockImplementationOnce(async () => reply(200, { id: REC_ID })) as unknown as typeof fetch;
    const { root, app, fetchFn: spy } = setup({ fetchFn });
    app.start(snapshot);
    cardButton(root, 'Design my pod').click();
    fillLeadForm(root, 'sam@example.com');
    app.start({ ...snapshot, model: 'twelve' }); // client went to the planner and back
    resolve(reply(200, { id: REC_ID }));
    await flush();
    cardButton(root, "Let's talk").click();
    await flush();
    expect(spy).toHaveBeenCalledTimes(2);
    expect(body(spy, 1).recordId).toBe(REC_ID);
    expect(body(spy, 1).ctaHistory).toEqual(['design', 'talk']);
  });

  it('lead form title does not promise an email', () => {
    const { root, app } = setup();
    app.start(snapshot);
    cardButton(root, 'Design my pod').click();
    expect(text(root)).not.toContain('send your plan');
    expect(text(root.querySelector('.mo-lead__title')!)).toBe('Save your plan');
  });

  it('rejects an invalid email without sending anything', async () => {
    const { root, app, fetchFn } = setup();
    app.start(snapshot);
    cardButton(root, 'Design my pod').click();
    fillLeadForm(root, 'not-an-email');
    await flush();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(text(root)).toContain('valid email');
  });

  it('later CTA updates the same record without the form', async () => {
    const { root, app, fetchFn, navigate } = setup();
    app.start(snapshot);
    cardButton(root, 'Design my pod').click();
    fillLeadForm(root, 'sam@example.com');
    await flush();
    cardButton(root, "Let's talk").click();
    expect(root.querySelector('input[type="email"]')).toBeNull();
    await flush();
    expect(fetchFn).toHaveBeenCalledTimes(2);
    const sent = body(fetchFn, 1);
    expect(sent.recordId).toBe(REC_ID);
    expect(sent.ctaHistory).toEqual(['design', 'talk']);
    expect(navigate).toHaveBeenLastCalledWith('https://minioffice.co/lets-talk');
  });

  it('ignores a second click while a submit is in flight', async () => {
    let resolve!: (r: Response) => void;
    const pending = new Promise<Response>((r) => { resolve = r; });
    const { root, app, fetchFn, navigate } = setup({ fetchFn: vi.fn(() => pending) as unknown as typeof fetch });
    app.start(snapshot);
    cardButton(root, 'Design my pod').click();
    fillLeadForm(root, 'sam@example.com');
    cardButton(root, "Let's talk").click();
    cardButton(root, 'Design my pod').click();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    resolve(reply(200, { id: REC_ID }));
    await flush();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith('https://minioffice.co/quote');
  });

  it('failure shows the server message, Try again and Continue without saving', async () => {
    const fetchFn = vi.fn()
      .mockResolvedValueOnce(reply(422, { error: 'Field "Cost Low" cannot accept that value' }))
      .mockResolvedValueOnce(reply(200, { id: REC_ID })) as unknown as typeof fetch;
    const { root, app, navigate } = setup({ fetchFn });
    app.start(snapshot);
    cardButton(root, 'Design my pod').click();
    fillLeadForm(root, 'sam@example.com');
    await flush();
    expect(text(root)).toContain('Field "Cost Low" cannot accept that value');
    expect(navigate).not.toHaveBeenCalled();
    button(root, 'Try again').click();
    await flush();
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenCalledWith('https://minioffice.co/quote');
  });

  it('Continue without saving navigates', async () => {
    const fetchFn = vi.fn(async () => reply(422, { error: 'Nope' })) as unknown as typeof fetch;
    const { root, app, navigate } = setup({ fetchFn });
    app.start(snapshot);
    cardButton(root, "Let's talk").click();
    fillLeadForm(root, 'sam@example.com');
    await flush();
    expect(text(root)).toContain('Nope');
    button(root, 'Continue without saving').click();
    expect(navigate).toHaveBeenCalledWith('https://minioffice.co/lets-talk');
  });

  it('failure with no message in the body falls back to the status', async () => {
    const fetchFn = vi.fn(async () => reply(500, null)) as unknown as typeof fetch;
    const { root, app } = setup({ fetchFn });
    app.start(snapshot);
    cardButton(root, 'Design my pod').click();
    fillLeadForm(root, 'sam@example.com');
    await flush();
    expect(text(root)).toContain('Server error 500');
  });

  it('shows the network error when fetch itself fails', async () => {
    const fetchFn = vi.fn(async () => { throw new Error('Failed to fetch'); }) as unknown as typeof fetch;
    const { root, app } = setup({ fetchFn });
    app.start(snapshot);
    cardButton(root, 'Design my pod').click();
    fillLeadForm(root, 'sam@example.com');
    await flush();
    expect(text(root)).toContain('Failed to fetch');
    expect(Array.from(root.querySelectorAll('button')).some((b) => b.textContent === 'Try again')).toBe(true);
  });

  it('restores screen 2 and record id from storage', async () => {
    const first = setup();
    first.app.start(snapshot);
    button(first.root, 'Skip for now').click();
    choose(first.root, 'truckAccess', 'no');
    cardButton(first.root, 'Design my pod').click();
    fillLeadForm(first.root, 'sam@example.com');
    await flush();

    const second = setup({ storage: first.storage });
    expect(second.app.restore()).toEqual(snapshot);
    expect(text(second.root.querySelector('.mo-q')!)).toContain('How wide is the narrowest point');
    expect(text(second.root.querySelector('.mo-card')!)).toContain('truck + shed mule');
    cardButton(second.root, "Let's talk").click();
    await flush();
    expect(second.fetchFn).toHaveBeenCalledTimes(1);
    expect(body(second.fetchFn).recordId).toBe(REC_ID);
    expect(body(second.fetchFn).contact.email).toBe('sam@example.com');
  });

  it('restore returns null when nothing is stored', () => {
    const { app } = setup();
    expect(app.restore()).toBeNull();
  });

  it('start with a new snapshot keeps answers and clears the model override', () => {
    const first = setup();
    first.app.start(snapshot);
    button(first.root, 'Skip for now').click();
    choose(first.root, 'truckAccess', 'no');
    first.root.dispatchEvent(new CustomEvent('minio:switch-model', { detail: 'station' }));
    expect(text(first.root.querySelector('.mo-card')!)).toContain('The Station');

    const second = setup({ storage: first.storage });
    second.app.start({ ...snapshot, model: 'twelve' });
    const card = text(second.root.querySelector('.mo-card')!);
    expect(card).toContain('The Twelve');
    expect(card).toContain('truck + shed mule');
    expect(text(second.root.querySelector('.mo-q')!)).toContain("What's the ZIP code");
    const stored = JSON.parse(second.storage.getItem(STORAGE_KEY)!);
    expect(stored.answers.truckAccess).toBe('no');
    expect(stored.modelOverride).toBeUndefined();
  });

  it('storage errors are not swallowed', () => {
    const storage = fakeStorage();
    const { root, app } = setup({ storage });
    app.start(snapshot);
    storage.setItem = () => { throw new Error('quota exceeded'); };
    const errors: string[] = [];
    const onError = (e: ErrorEvent) => { e.preventDefault(); errors.push(e.message); };
    window.addEventListener('error', onError);
    button(root, 'Skip for now').click();
    window.removeEventListener('error', onError);
    expect(errors.some((m) => m.includes('quota exceeded'))).toBe(true);
  });

  it('shows the end panel after the last question and Save my plan saves', async () => {
    const { root, app, fetchFn, print, navigate } = setup();
    app.start(snapshot);
    button(root, 'Skip for now').click();
    choose(root, 'truckAccess', 'yes');
    choose(root, 'existingBase', 'slab');
    choose(root, 'bathroom', 'none');
    choose(root, 'panelDistance', 'lt25');
    choose(root, 'door', 'standard');
    expect(text(root)).toContain("That's everything.");

    button(root, 'Save my plan').click();
    fillLeadForm(root, 'sam@example.com');
    await flush();
    expect(body(fetchFn).ctaHistory).toEqual(['save']);
    expect(navigate).not.toHaveBeenCalled();
    expect(text(root)).toContain('Saved. A Mini·O advisor will reach out.');
    button(root, 'Print / save as PDF').click();
    expect(print).toHaveBeenCalledTimes(1);
  });

  it('changing an earlier answer after the end panel recomputes and stays consistent', () => {
    const { root, app } = setup();
    app.start(snapshot);
    button(root, 'Skip for now').click();
    choose(root, 'truckAccess', 'yes');
    choose(root, 'existingBase', 'slab');
    choose(root, 'bathroom', 'none');
    choose(root, 'panelDistance', 'lt25');
    choose(root, 'door', 'standard');
    for (let i = 0; i < 5; i++) button(root, 'Back').click(); // door, panel, bathroom, base, truck
    expect(text(root.querySelector('.mo-q')!)).toContain('Can a truck drive right up to the spot?');
    choose(root, 'truckAccess', 'no');
    expect(text(root.querySelector('.mo-q')!)).toContain('How wide is the narrowest point');
    expect(text(root.querySelector('.mo-card')!)).toContain('truck + shed mule');
    expect(text(root)).not.toContain("That's everything.");
  });

  it('sends readable text for the answers, to-check list and lead time', async () => {
    const { root, app, fetchFn } = setup();
    app.start(snapshot);
    button(root, 'Skip for now').click();
    choose(root, 'truckAccess', 'unsure');
    cardButton(root, "Let's talk").click();
    fillLeadForm(root, 'sam@example.com');
    await flush();
    const sent = body(fetchFn);
    expect(sent.readable.answers).toBe(
      `${questionCopy('truckAccess', 'sixteen').title}: I'm not sure`,
    );
    expect(sent.readable.toCheck).toContain('Check whether a truck can drive right up to the spot');
    expect(sent.readable.method).toBe('tilt trailer');
    expect(sent.readable.base).toBe('gravel pad');
    expect(sent.readable.leadTime).toContain('after we receive payment');
    expect(sent.snapshot).toEqual(snapshot);
  });

  it('switching the model changes the card and is sent as the pod model', async () => {
    const { root, app, fetchFn } = setup();
    app.start({ ...snapshot, model: 'twelve' });
    root.dispatchEvent(new CustomEvent('minio:switch-model', { detail: 'sixteen', bubbles: true }));
    expect(text(root.querySelector('.mo-card')!)).toContain('The Sixteen');
    cardButton(root, 'Design my pod').click();
    fillLeadForm(root, 'sam@example.com');
    await flush();
    expect(body(fetchFn).snapshot.model).toBe('sixteen');
    expect(body(fetchFn).recommendation.model).toBe('sixteen');
  });

  it('keeps a print summary for the browser to print', () => {
    const { root, app } = setup();
    app.start(snapshot);
    button(root, 'Skip for now').click();
    choose(root, 'truckAccess', 'unsure');
    const summary = root.querySelector('.print-summary');
    expect(summary).not.toBeNull();
    const t = text(summary!);
    expect(t).toContain('The Sixteen, delivered ready-built');
    expect(t).toContain('Delivery and site prep:');
    expect(t).toContain('Ready to ship about');
    expect(t).toContain('Check whether a truck can drive right up to the spot');
    expect(t).toContain("I'm not sure");
  });
});
