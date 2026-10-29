// Shared by netlify/functions/submit.ts: turns one plan submission into the
// Airtable "Submissions" field values. Pure code, no network.
import { MODELS } from '../assessment/core/data';
import type {
  Answers, CostSummary, LeadTime, Location, PlannerSnapshot, PodUse, Recommendation,
} from '../assessment/core/types';

export type Cta = 'design' | 'talk' | 'save';

export interface SubmissionPayload {
  recordId?: string;
  contact: { email: string; firstName: string; phone: string };
  ctaHistory: Cta[];
  snapshot: PlannerSnapshot; answers: Answers; recommendation: Recommendation;
  cost: CostSummary; lead: LeadTime; location: Location | null;
  readable: { answers: string; toCheck: string; costNotes: string; method: string; base: string; leadTime: string };
}

export const RECORD_ID_RE = /^rec[A-Za-z0-9]{14}$/;

// Same labels the old submit.js used. The planner saves 'guest', not 'guest_suite'.
const POD_USE_LABEL: Record<PodUse, string> = {
  office: 'Office', studio: 'Studio', guest: 'Guest Suite', other: 'Other',
};
const BATHROOM_LABEL: Record<Recommendation['bathroom'], string> = {
  none: 'None', half: 'Half bath', shower: 'Shower',
};
const DOOR_LABEL: Record<Recommendation['door'], string> = {
  standard: 'Standard', flipped: 'Flipped',
};

function label<K extends string>(table: Record<K, string>, key: K, what: string): string {
  const value = table[key];
  if (value === undefined) throw new Error(`Unknown ${what}: ${String(key)}`);
  return value;
}

/** null clears a field on an update; on a create the field is left out instead. */
export type FieldValue = string | number | boolean | null;

export function buildFields(
  p: SubmissionPayload,
  isCreate: boolean,
): Record<string, FieldValue> {
  const model = MODELS[p.snapshot.model];
  if (!model) throw new Error(`Unknown pod model: ${String(p.snapshot.model)}`);

  const now = new Date().toISOString();
  const fields: Record<string, FieldValue> = {
    'Email': p.contact.email,
    'First Name': p.contact.firstName ?? '',
    'Phone': p.contact.phone ?? '',
    'Last Updated': now,
    'Buttons Clicked': p.ctaHistory.join(', '),

    'ZIP': p.answers.zip ?? '',
    'State': p.location?.shippingKey ?? '',
    'Price Region': p.location?.region ?? '',
    'In Coverage': p.location?.inCoverage ?? false,

    'Pod Model': `The ${model.name}`,
    'Pod Use': label(POD_USE_LABEL, p.snapshot.podUse, 'pod use'),
    'Yard Dimensions': `${p.snapshot.yardW} x ${p.snapshot.yardD} ft`,
    'Pod Orientation': p.snapshot.rotation === 90 ? '90°' : '0°',

    'Recommended Method': p.readable.method,
    'Base': p.readable.base,
    'Bathroom': label(BATHROOM_LABEL, p.recommendation.bathroom, 'bathroom'),
    'Door': label(DOOR_LABEL, p.recommendation.door, 'door'),

    'Lead Time': p.readable.leadTime,
    'To Check': p.readable.toCheck,
    'Answers': p.readable.answers,
    'Planner Snapshot': JSON.stringify(p.snapshot),
    'Assessment Version': 'v2',
  };

  if (isCreate) fields['Submission Date'] = now;

  // A field that no longer applies is cleared on an update, so an earlier save's figure doesn't
  // linger in the record. A new record simply leaves it out.
  const clear = (name: string): void => { if (!isCreate) fields[name] = null; };

  if (p.cost.mode === 'talk') {
    fields['Cost Notes'] = "Let's talk";
    clear('Cost Low');
    clear('Cost High');
    clear('Shipping Estimate');
  } else {
    fields['Cost Low'] = p.cost.low;
    fields['Cost High'] = p.cost.high;
    fields['Cost Notes'] = p.readable.costNotes;
    const shipping = p.cost.lines.find(l => l.id === 'shipping');
    if (shipping) fields['Shipping Estimate'] = shipping.low;
    else clear('Shipping Estimate');
  }

  return fields;
}
