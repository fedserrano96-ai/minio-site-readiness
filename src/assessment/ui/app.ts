// Screen 2: the card on top, one question at a time below, then Your plan, and the lead form behind
// the CTAs (spec 5.2, 5.3, 6, 7). Owns the state, keeps it in sessionStorage, and re-renders the pieces.
// Storage errors are not caught: if sessionStorage fails the client should see it fail.
import type { Cta, SubmissionPayload } from '../../server/airtable-fields';
import { MODELS, MULE_TURN_FT } from '../core/data';
import { lookupLocation } from '../core/location';
import { leadTime, priceRecommendation } from '../core/pricing';
import { QUESTION_ORDER, visibleQuestions } from '../core/questions';
import { recommend } from '../core/rules';
import type { Answers, ModelId, PlannerSnapshot, QuestionId } from '../core/types';
import { renderCard } from './card';
import { describeChange } from './copy';
import { renderFailure, renderLeadForm, renderSaved, renderSaving, type Contact } from './lead-form';
import { renderPlan } from './plan-view';
import { buildReadable, renderPrintSummary } from './print';
import { renderQuestion } from './question-view';

export interface AppDeps {
  fetchFn: typeof fetch;
  storage: Storage;
  navigate: (url: string) => void;
  print: () => void;
}

// Bump the key whenever Answers or the visibility rules change: restore() throws on a hidden current question.
const STORAGE_KEY = 'minio-assessment-v3';
const SUBMIT_URL = '/.netlify/functions/submit';
const CTA_URL = { design: 'https://minioffice.co/quote', talk: 'https://minioffice.co/lets-talk' } as const;

type Step = QuestionId | 'end';

interface State {
  snapshot: PlannerSnapshot;
  answers: Answers;
  currentId: Step;
  modelOverride?: ModelId;
  contact: Contact;
  recordId: string | null;
  ctaHistory: Cta[];
}

type Flow =
  | { kind: 'form'; cta: Cta }
  | { kind: 'submitting' }
  | { kind: 'failed'; cta: Cta; message: string }
  | { kind: 'saved' };

function div(className: string): HTMLDivElement {
  const el = document.createElement('div');
  el.className = className;
  return el;
}

/**
 * The path width, overhead and turn answers are relative to the model ("12 ft or wider", "nothing
 * lower than 13 ft", "a turn about 20 ft across"). When the model changes to one with other
 * clearances or another turning space, those answers no longer mean what the client picked, so they
 * are cleared and asked again. Returns the ids that actually held an answer.
 */
function clearModelRelativeAnswers(answers: Answers, from: ModelId, to: ModelId): QuestionId[] {
  const a = MODELS[from];
  const b = MODELS[to];
  const affected: QuestionId[] = [];
  if (a.minPathWidth !== b.minPathWidth || a.minOverhead !== b.minOverhead) affected.push('pathWidth', 'overhead');
  if (MULE_TURN_FT[from] !== MULE_TURN_FT[to]) affected.push('turn');
  const cleared = affected.filter((id) => answers[id] !== undefined);
  for (const id of cleared) delete answers[id];
  return cleared;
}

function messageOf(body: unknown): string | null {
  const error = (body as { error?: unknown } | null)?.error;
  return typeof error === 'string' && error !== '' ? error : null;
}

export function createApp(root: HTMLElement, deps: AppDeps) {
  root.classList.add('mo-app');
  const cardHost = div('mo-app__card');
  const panelHost = div('mo-app__panel');
  const printHost = div('print-summary');
  root.replaceChildren(cardHost, panelHost, printHost);

  let state: State | null = null;
  let flow: Flow | null = null;
  let change: ReturnType<typeof describeChange> = null;
  let inFlight = false;
  // Phone details sheet. Closed on every CTA and on start(), so nothing opens behind it.
  let cardOpen = false;
  // The client chose "Continue without saving" after a failed save: Your plan offers printing.
  let offerPrint = false;

  const current = (): State => {
    if (!state) throw new Error('The assessment has not been started');
    return state;
  };
  const save = (): void => deps.storage.setItem(STORAGE_KEY, JSON.stringify(current()));

  function load(): State | null {
    const raw = deps.storage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const stored = JSON.parse(raw) as State;
    if (typeof stored !== 'object' || stored === null || !stored.snapshot || !stored.answers) {
      throw new Error(`Stored state under "${STORAGE_KEY}" is not valid`);
    }
    return stored;
  }

  function compute(s: State) {
    const location = s.answers.zip ? lookupLocation(s.answers.zip) : null;
    const rec = recommend(s.snapshot, s.answers, s.modelOverride);
    return { rec, location, cost: priceRecommendation(rec, location, s.answers), lead: leadTime(rec, location) };
  }

  function renderPanel(s: State, view: ReturnType<typeof compute>): void {
    const slot = div('');
    panelHost.replaceChildren(slot);
    if (flow?.kind === 'form') renderLeadForm(slot, s.contact);
    else if (flow?.kind === 'submitting') renderSaving(slot);
    else if (flow?.kind === 'failed') renderFailure(slot, flow.message);
    else if (flow?.kind === 'saved') renderSaved(slot);
    else if (s.currentId === 'end') renderPlan(slot, { ...view, offerPrint });
    else {
      const visible = visibleQuestions(s.answers);
      const index = visible.indexOf(s.currentId);
      if (index < 0) throw new Error(`Question "${s.currentId}" is not visible for these answers`);
      renderQuestion(slot, {
        id: s.currentId, index, total: visible.length, model: view.rec.model,
        value: s.answers[s.currentId], canGoBack: true,
      });
    }
  }

  /** Redraws everything. `focus` moves keyboard focus to the new panel's heading. */
  function render(focus: boolean): void {
    const s = current();
    const view = compute(s);
    renderCard(cardHost, { ...view, change, open: cardOpen });
    renderPrintSummary(printHost, { ...view, answers: s.answers });
    renderPanel(s, view);
    if (focus) {
      const heading = panelHost.querySelector<HTMLElement>('h2');
      if (heading) { heading.tabIndex = -1; heading.focus(); }
    }
  }

  const goTo = (step: Step): void => { current().currentId = step; save(); render(true); };

  function nextAfter(id: QuestionId): Step {
    const visible = visibleQuestions(current().answers);
    const index = visible.indexOf(id);
    if (index < 0) throw new Error(`Question "${id}" is not visible for these answers`);
    return visible[index + 1] ?? 'end';
  }

  function onAnswer(id: QuestionId, value: string): void {
    if (!QUESTION_ORDER.includes(id)) throw new Error(`Unknown question: ${String(id)}`);
    const s = current();
    const before = compute(s).rec;
    (s.answers as Record<string, string>)[id] = value;
    change = describeChange(before, compute(s).rec);
    // "I'm not sure" stays on the question with the how-to-measure help open; Next moves on.
    goTo(value === 'unsure' ? id : nextAfter(id));
  }

  function onBack(): void {
    const s = current();
    const visible = visibleQuestions(s.answers);
    const index = s.currentId === 'end' ? visible.length : visible.indexOf(s.currentId);
    if (index <= 0) {
      document.dispatchEvent(new CustomEvent('minio:edit-yard'));
      return;
    }
    goTo(visible[index - 1]!);
  }

  async function post(payload: SubmissionPayload): Promise<string> {
    const res = await deps.fetchFn(SUBMIT_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    // A body that is not JSON has no message in it; the status stands in for one (spec 7).
    const body: unknown = await res.json().catch(() => null);
    if (!res.ok) throw new Error(messageOf(body) ?? `Server error ${res.status}`);
    const id = (body as { id?: unknown } | null)?.id;
    if (typeof id !== 'string') throw new Error('The server did not return a record id');
    return id;
  }

  function finish(cta: Cta): void {
    if (cta === 'save') { flow = { kind: 'saved' }; render(true); return; }
    flow = null;
    render(false);
    deps.navigate(CTA_URL[cta]);
  }

  async function submit(cta: Cta): Promise<void> {
    const s = current();
    const view = compute(s);
    const ctaHistory = [...s.ctaHistory, cta];
    const payload: SubmissionPayload = {
      ...(s.recordId ? { recordId: s.recordId } : {}),
      contact: s.contact, ctaHistory,
      // The model the client ended up with, which can differ from the planner's after "Switch to".
      snapshot: { ...s.snapshot, model: view.rec.model }, answers: s.answers,
      recommendation: view.rec, cost: view.cost, lead: view.lead, location: view.location,
      readable: buildReadable({ ...view, answers: s.answers }),
    };
    inFlight = true;
    flow = { kind: 'submitting' };
    render(true);
    let id: string;
    try {
      id = await post(payload);
    } catch (err) {
      inFlight = false;
      flow = { kind: 'failed', cta, message: err instanceof Error ? err.message : String(err) };
      render(true);
      return;
    }
    inFlight = false;
    // start() may have replaced the state while the request was out; record the id on the live one.
    const live = current();
    live.recordId = id;
    live.ctaHistory = [...live.ctaHistory, cta];
    save();
    finish(cta);
  }

  function onCta(cta: Cta): void {
    if (inFlight) return;
    cardOpen = false;
    if (current().contact.email === '') {
      flow = { kind: 'form', cta };
      render(true);
      return;
    }
    void submit(cta);
  }

  const on = <T>(type: string, handler: (detail: T) => void): void => {
    root.addEventListener(type, (e) => handler((e as CustomEvent<T>).detail));
  };
  on<{ id: QuestionId; value: string }>('minio:answer', (d) => onAnswer(d.id, d.value));
  on<void>('minio:next', () => { const id = current().currentId; if (id !== 'end') goTo(nextAfter(id)); });
  on<void>('minio:back', onBack);
  on<Cta>('minio:cta', onCta);
  on<ModelId>('minio:switch-model', (model) => {
    const s = current();
    const cleared = clearModelRelativeAnswers(s.answers, s.modelOverride ?? s.snapshot.model, model);
    s.modelOverride = model;
    const visible = visibleQuestions(s.answers);
    // Go to the earliest cleared question that is asked, so the client answers it again, even from
    // the end panel. If none is asked, stay; but clearing pathWidth can hide the question the client
    // is on (it may have shown removable or ruled out the mule). Then ask pathWidth again if it is
    // asked at all, else start from the top.
    const reask = visible.find((id) => cleared.includes(id));
    if (reask) {
      s.currentId = reask;
    } else if (s.currentId !== 'end' && !visible.includes(s.currentId)) {
      s.currentId = visible.includes('pathWidth') ? 'pathWidth' : visible[0]!;
    }
    change = null;
    save();
    render(false);
  });
  on<boolean>('minio:card-toggle', (open) => { cardOpen = open; });
  on<Contact>('minio:lead-submit', (contact) => {
    const f = flow;
    if (f?.kind !== 'form') return;
    current().contact = contact;
    save();
    void submit(f.cta);
  });
  on<void>('minio:lead-cancel', () => { flow = null; render(true); });
  on<void>('minio:retry', () => { if (flow?.kind === 'failed') void submit(flow.cta); });
  on<void>('minio:continue', () => {
    const f = flow;
    if (f?.kind !== 'failed') return;
    if (f.cta === 'save') { flow = null; offerPrint = true; render(true); } else finish(f.cta);
  });
  on<void>('minio:print', () => deps.print());
  on<void>('minio:dismiss', () => { flow = null; render(true); });

  return {
    /** Called when the client leaves the yard planner. Keeps the answers, takes the new snapshot. */
    start(snapshot: PlannerSnapshot): void {
      const stored = load();
      const answers = stored?.answers ?? {};
      if (stored) clearModelRelativeAnswers(answers, stored.modelOverride ?? stored.snapshot.model, snapshot.model);
      state = {
        snapshot,
        answers,
        currentId: 'zip',
        contact: stored?.contact ?? { email: '', firstName: '', phone: '' },
        recordId: stored?.recordId ?? null,
        ctaHistory: stored?.ctaHistory ?? [],
      };
      flow = null;
      change = null;
      cardOpen = false;
      offerPrint = false;
      state.currentId = visibleQuestions(state.answers)[0]!;
      save();
      render(true);
    },
    /** Returns the stored planner snapshot and shows screen 2 where the client left off, or null. */
    restore(): PlannerSnapshot | null {
      const stored = load();
      if (!stored) return null;
      state = stored;
      flow = null;
      change = null;
      render(true);
      return stored.snapshot;
    },
  };
}
