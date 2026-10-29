// Client-facing copy for the recommendation card (spec 5.2, 5.3, 6). Plain English: clients
// have no construction knowledge. Fred reviews every string here.
import { KIT_ACCESS_FT, LEVEL_CUTOFF_TEXT, MODELS, PANEL_UPGRADE } from '../core/data';
import type {
  BaseKind, CostSummary, LeadTime, Location, Method, ModelId, NoteCode, ReasonCode, Recommendation,
  SideItem, ToCheckCode,
} from '../core/types';

export const NO_ZIP_TEXT = 'Add your ZIP code to see delivery and local prices.';
export const TALK_COST_TEXT = "We'll work this out with you";
export const PRICE_DISCLAIMER = "Your pod's price comes from the configurator. This is what goes on top of it.";

/** "The Sixteen". MODELS[model].name is the bare name ("Sixteen"). */
export function modelName(model: ModelId): string {
  return `The ${MODELS[model].name}`;
}

export function methodTitle(model: ModelId, method: Method): string {
  const name = modelName(model);
  switch (method) {
    case 'tiltTrailer':
    case 'shedMule': return `${name}, delivered ready-built`;
    case 'crane': return `${name}, lifted in by crane`;
    case 'kit': return `${name} as a kit, assembled on site`;
    case 'talk': return `${name}: let's work out the best way in`;
  }
}

const DELIVERY_PILL: Record<Method, string> = {
  tiltTrailer: 'tilt trailer',
  shedMule: 'truck + shed mule',
  crane: 'crane',
  kit: 'kit',
  talk: "let's talk",
};

const BASE_PILL: Record<BaseKind, string> = {
  gravel: 'gravel pad',
  existing: 'your existing base',
  raised: 'raised base, priced in person',
};

export function pillText(rec: Recommendation): { delivery: string; base: string } {
  return { delivery: DELIVERY_PILL[rec.method], base: BASE_PILL[rec.base] };
}

export function reasonText(code: ReasonCode): string {
  switch (code) {
    case 'truckNo':
      return "a truck can't drive right up to your spot, so a small mover (a shed mule) brings the pod in the last stretch";
    case 'pathNarrow':
      return 'the way to your spot is too narrow to roll the pod through, so it has to be lifted in';
    case 'overheadLow':
      return 'something over the way in (like a wire or a roof edge) is too low for the pod to pass under';
    case 'pathSteps':
      return "there are steps or steep parts on the way to your spot, and the pod can't be rolled over those";
    case 'powerLines':
      return "there are power lines over your house or yard, so a crane can't lift the pod in, and it can't be rolled in either";
    case 'tooFar':
      return "your spot is too far from the street for a crane to reach, and the pod can't be rolled in";
    case 'noKitAccess':
      return `there's no way in at least ${KIT_ACCESS_FT} ft wide, so the pod can't be brought in whole or as a kit`;
    case 'existingBase':
      return 'you already have a base where the pod will go';
    case 'steepGround':
      return 'the ground at your spot is too steep for a gravel pad';
  }
}

export function toCheckText(code: ToCheckCode): string {
  switch (code) {
    case 'zip': return 'Add your ZIP code';
    case 'truckAccess': return 'Check whether a truck can drive right up to the spot';
    case 'pathWidth': return 'Measure the narrowest point on the way in';
    case 'overhead': return 'Check the height of anything over the way in (branches, wires, roof edges)';
    case 'pathGround': return 'Check the way in for steps, steep parts or soft ground';
    case 'powerLines': return 'Check for power lines over the house or yard, between the street and the spot';
    case 'streetDistance': return 'Measure how far the spot is from the street';
    case 'kitAccess': return `Measure the narrowest way in (we need at least ${KIT_ACCESS_FT} ft)`;
    case 'existingBase': return "Check whether there's already a base where the pod will go";
    case 'groundFlat': return `Check whether the ground at the spot is flat (within ${LEVEL_CUTOFF_TEXT})`;
    case 'bathroom': return 'Decide whether the pod will have a bathroom';
    case 'waterDistance': return 'Measure how far the water and sewer lines are from the spot';
    case 'panelDistance': return 'Measure how far the electrical panel is from the spot';
    case 'door': return 'Decide which way the door should face';
    case 'baseSlab': return 'Check that your slab or patio is big enough and level';
    case 'baseGravel': return 'Check that your gravel pad is big enough and level';
    case 'baseDeck': return "We'll confirm your deck can hold the pod";
  }
}

export function noteText(code: NoteCode, rec: Recommendation): string {
  switch (code) {
    case 'softGround':
      return 'Soft ground can get marked by the delivery. Stop watering the area a week before.';
    case 'panelUpgrade':
      return `Some homes need a panel upgrade (about ${formatMoney(PANEL_UPGRADE)}).`;
    case 'twelveHalfBathOnly':
      return 'The Twelve fits a half bath only.';
    case 'flipNotAvailable':
      return `A flipped door isn't available on ${modelName(rec.model)}, so it comes with the standard door.`;
    case 'kitUnloading':
      return "Unloading isn't included in shipping, so you or your contractor unload the kit. It also needs dry storage while it waits for assembly.";
    case 'clearance':
      return 'Leave about 3 ft clear around the pod for installation and service.';
  }
}

export function formatMoney(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`formatMoney: not a finite number: ${n}`);
  return `$${Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')}`;
}

/** "$X – $Y", one figure when low = high, "+" suffix for "and up". */
export function rangeText(low: number, high: number, andUp: boolean): string {
  const figures = low === high ? formatMoney(low) : `${formatMoney(low)} – ${formatMoney(high)}`;
  return andUp ? `${figures}+` : figures;
}

export function costLineText(s: CostSummary): string {
  if (s.mode === 'talk') return TALK_COST_TEXT;
  return `Delivery and site prep: ${rangeText(s.low, s.high, s.andUp)}`;
}

export function sideItemText(item: SideItem): string {
  switch (item.id) {
    case 'crane':
      if (item.from === null) throw new Error('Crane side item has no "from" figure');
      return `+ crane, from ${formatMoney(item.from)}`;
    case 'raisedBase':
      if (item.from === null) throw new Error('Raised base side item has no "from" figure');
      return `+ raised base, from ${formatMoney(item.from)}, priced in person`;
    case 'shippingQuoted':
      return '+ shipping, quoted separately';
  }
}

export function leadTimeText(t: LeadTime): string {
  const weeks = t.minWeeks === t.maxWeeks ? `${t.minWeeks} weeks` : `${t.minWeeks}–${t.maxWeeks} weeks`;
  return `Ready to ship about ${weeks} after we receive payment`;
}

export function coverageText(location: Location | null): string {
  if (location === null) return NO_ZIP_TEXT;
  return location.inCoverage
    ? 'Mini·O arranges local contractors in your area.'
    : "We don't arrange contractors in your area yet. These prices are a reference for your own contractor.";
}

const METHOD_CHANGE: Record<Method, string> = {
  tiltTrailer: 'tilt trailer delivery',
  shedMule: 'truck + shed mule delivery',
  crane: 'crane delivery',
  kit: 'a kit, assembled on site',
  talk: "a talk about the best way in",
};

const BASE_CHANGE: Record<BaseKind, string> = {
  gravel: 'a gravel pad',
  existing: 'your existing base',
  raised: 'a raised base',
};

// Used when a change goes back to the starting option and so has no reason code.
const METHOD_DEFAULT_WHY = "your answers don't rule out the simplest way in";
const BASE_DEFAULT_WHY = 'a gravel pad suits your ground';

export function describeChange(prev: Recommendation | null, next: Recommendation): { what: string; why: string } | null {
  if (prev === null) return null;
  const methodChanged = prev.method !== next.method;
  const baseChanged = prev.base !== next.base;
  if (!methodChanged && !baseChanged) return null;

  const what: string[] = [];
  const why: string[] = [];
  if (methodChanged) {
    what.push(METHOD_CHANGE[next.method]);
    why.push(next.methodReason ? reasonText(next.methodReason) : METHOD_DEFAULT_WHY);
  }
  if (baseChanged) {
    what.push(BASE_CHANGE[next.base]);
    why.push(next.baseReason ? reasonText(next.baseReason) : BASE_DEFAULT_WHY);
  }
  return { what: what.join(' and '), why: why.join(', and ') };
}
