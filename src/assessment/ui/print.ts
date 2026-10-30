// The plan as plain text and as a print-only block (spec 7). The same strings feed the Airtable
// "readable" fields, so what the client prints matches what sales sees. Built with createElement
// and textContent only.
import type { SubmissionPayload } from '../../server/airtable-fields';
import { visibleQuestions } from '../core/questions';
import type { Answers, CostLine, CostSummary, LeadTime, Location, Recommendation } from '../core/types';
import {
  PRICE_DISCLAIMER, REP_LIST_TITLE, coverageText, costLineText, headline, leadTimeText, noteText, pillText,
  rangeText, sideItemText, toCheckText,
} from './copy';
import { planSteps } from './plan-copy';
import { questionCopy } from './questions-copy';

export interface PrintView {
  rec: Recommendation;
  cost: CostSummary;
  lead: LeadTime;
  location: Location | null;
  answers: Answers;
}

export const LINE_LABEL: Record<CostLine['id'], string> = {
  shipping: 'Shipping',
  install: 'Installation',
  base: 'Base',
  power: 'Power',
  plumbing: 'Water and sewer',
  ramps: 'Ramps for the steps',
};

function lineText(line: CostLine): string {
  return `${LINE_LABEL[line.id]}: ${rangeText(line.low, line.high, line.andUp)}${line.reference ? ' (reference)' : ''}`;
}

/** One "Question title: answer label" line for each answered question that is on screen. */
function answerLines(answers: Answers, rec: Recommendation): string[] {
  const lines: string[] = [];
  for (const id of visibleQuestions(answers)) {
    const value = answers[id];
    if (value === undefined) continue;
    const copy = questionCopy(id, rec.model);
    const answer = id === 'zip' ? value : copy.options.find((o) => o.value === value)?.label;
    if (answer === undefined) throw new Error(`No answer label for ${id} = ${value}`);
    lines.push(`${copy.title}: ${answer}`);
  }
  return lines;
}

export function buildReadable(view: PrintView): SubmissionPayload['readable'] {
  const { rec, cost, lead, answers } = view;
  const pills = pillText(rec);
  const notes: string[] = [];
  if (cost.mode === 'range') {
    notes.push(...cost.side.map(sideItemText));
    notes.push(...cost.lines.filter((l) => l.reference).map(lineText));
  }
  return {
    answers: answerLines(answers, rec).join('\n'),
    toCheck: rec.toCheck.map(toCheckText).join('\n'),
    costNotes: notes.join('\n'),
    method: pills.delivery,
    base: pills.base,
    leadTime: leadTimeText(lead),
  };
}

function h<K extends keyof HTMLElementTagNameMap>(
  tag: K, content?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (content !== undefined) node.textContent = content;
  return node;
}

function list(items: string[]): HTMLUListElement {
  const ul = h('ul');
  for (const item of items) ul.append(h('li', item));
  return ul;
}

export function renderPrintSummary(el: HTMLElement, view: PrintView): void {
  const { rec, cost, lead, location, answers } = view;
  const pills = pillText(rec);
  const nodes: HTMLElement[] = [
    h('h1', 'Your Mini·O plan'),
    h('h2', headline(rec)),
    h('p', `Delivery: ${pills.delivery}. Base: ${pills.base}.`),
  ];
  // The walk-through: each step's title, then its lines.
  const steps = h('ol');
  for (const step of planSteps(rec, location)) {
    const li = h('li', step.title);
    li.append(list(step.lines));
    steps.append(li);
  }
  nodes.push(steps, h('p', costLineText(cost)));
  if (cost.mode === 'range') {
    if (cost.side.length > 0) nodes.push(list(cost.side.map(sideItemText)));
    nodes.push(h('p', PRICE_DISCLAIMER), list(cost.lines.map(lineText)), h('p', leadTimeText(lead)));
  }
  nodes.push(h('p', coverageText(location)));
  if (rec.notes.length > 0) nodes.push(list(rec.notes.map(noteText)));
  if (rec.toCheck.length > 0) nodes.push(h('h3', REP_LIST_TITLE), list(rec.toCheck.map(toCheckText)));
  const lines = answerLines(answers, rec);
  if (lines.length > 0) nodes.push(h('h3', 'Your answers'), list(lines));
  el.replaceChildren(...nodes);
}
