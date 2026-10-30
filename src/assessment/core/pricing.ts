// Cost ranges and lead times (spec section 8). Pure functions over the recommendation,
// the looked-up location and the answers. Figures live in data.ts and shipping.ts;
// the power and plumbing formulas live here.
import type {
  Answers, Band, CostLine, CostSummary, LeadTime, Location, ModelId, PriceRegion, Recommendation, SideItem,
} from './types';
import {
  BATHROOM_LEAD_WEEKS, GRAVEL, KIT_ASSEMBLY, KIT_ASSEMBLY_REFERENCE,
  LEAD_WEEKS, MULE_RAMPS, RAISED_FROM, SHED_MULE,
} from './data';
import type { LeadKind } from './data';
import { SHIPPING } from './shipping';

type Money = { low: number; high: number };

const DEFAULT_FEET = 50; // "unsure" or unanswered distance

// Power run from the panel (spec 8.4). The WA price has a 1500 floor up to 50 ft.
const WA_POWER_FLOOR = 1500;
const WA_POWER_FLOOR_MAX_FEET = 50;
const waPower = (feet: number): Money => {
  const perFoot = 80 * feet + 81;
  return { low: feet <= WA_POWER_FLOOR_MAX_FEET ? WA_POWER_FLOOR : perFoot, high: perFoot };
};
const CA_SOUTH_POWER = 5600;
const njNyPower = (feet: number): number => 30 * feet + 81;

// Plumbing run from the water source (spec 8.5).
const waPlumbing = (feet: number): number => 72 * feet + 1500;
const CA_SOUTH_PLUMBING = 8000;

export function bandFeet(band: Band | undefined): { feet: number; andUp: boolean } {
  switch (band) {
    case 'lt25': return { feet: 25, andUp: false };
    case '25to50': return { feet: 50, andUp: false };
    case '50to100': return { feet: 100, andUp: false };
    case 'gt100': return { feet: 100, andUp: true };
    case 'unsure':
    case undefined: return { feet: DEFAULT_FEET, andUp: false };
  }
}

function spanOf(figures: number[]): Money {
  return { low: Math.min(...figures), high: Math.max(...figures) };
}

function powerFor(region: PriceRegion | null, feet: number): Money | null {
  if (region === 'WA') return waPower(feet);
  if (region === 'CA_SOUTH') return { low: CA_SOUTH_POWER, high: CA_SOUTH_POWER };
  if (region === 'NJ_NY') { const p = njNyPower(feet); return { low: p, high: p }; }
  return null;
}

function plumbingFor(region: PriceRegion | null, feet: number): Money | null {
  if (region === 'WA') { const p = waPlumbing(feet); return { low: p, high: p }; }
  if (region === 'CA_SOUTH') return { low: CA_SOUTH_PLUMBING, high: CA_SOUTH_PLUMBING };
  return null;
}

// Reference range across every priced region, used when the region has no figure.
function powerReference(feet: number): Money {
  const all = (['WA', 'CA_SOUTH', 'NJ_NY'] as const).map(r => {
    const p = powerFor(r, feet);
    if (!p) throw new Error(`No power figure for ${r}`);
    return p;
  });
  return { low: Math.min(...all.map(p => p.low)), high: Math.max(...all.map(p => p.high)) };
}

function plumbingReference(feet: number): Money {
  const all = (['WA', 'CA_SOUTH'] as const).map(r => {
    const p = plumbingFor(r, feet);
    if (!p) throw new Error(`No plumbing figure for ${r}`);
    return p;
  });
  return { low: Math.min(...all.map(p => p.low)), high: Math.max(...all.map(p => p.high)) };
}

function gravelReference(model: ModelId): Money {
  const figures: number[] = [];
  for (const region of Object.values(GRAVEL)) {
    const f = region?.[model];
    if (f !== undefined) figures.push(f);
  }
  if (figures.length === 0) throw new Error(`No gravel figures for model ${model}`);
  return spanOf(figures);
}

function raisedFrom(model: ModelId, region: PriceRegion | null): number {
  const regional = region ? RAISED_FROM[region]?.[model] : undefined;
  if (regional !== undefined) return regional;
  const figures: number[] = [];
  for (const r of Object.values(RAISED_FROM)) {
    const f = r?.[model];
    if (f !== undefined) figures.push(f);
  }
  if (figures.length === 0) throw new Error(`No raised-base figures for model ${model}`);
  return Math.min(...figures);
}

const fixed = (id: CostLine['id'], amount: number): CostLine =>
  ({ id, low: amount, high: amount, andUp: false, reference: false });

export function priceRecommendation(rec: Recommendation, location: Location | null, answers: Answers): CostSummary {
  if (rec.method === 'talk') return { mode: 'talk' };

  const region = location?.region ?? null;
  // Regional figures are only firm for a known location inside an install area.
  const referenceOnly = location === null || !location.inCoverage;
  const lines: CostLine[] = [];
  const side: SideItem[] = [];

  // Shipping
  if (location) {
    const row = SHIPPING[location.shippingKey];
    if (!row) throw new Error(`No SHIPPING row for key "${location.shippingKey}"`);
    if (row.amount !== null) lines.push(fixed('shipping', row.amount));
    else side.push({ id: 'shippingQuoted', from: null });
  }

  // Install
  switch (rec.method) {
    case 'tiltTrailer':
      lines.push(fixed('install', 0));
      break;
    case 'shedMule':
      lines.push(fixed('install', SHED_MULE));
      break;
    case 'crane':
      side.push({ id: 'crane', from: rec.craneFrom });
      break;
    case 'kit': {
      const regional = region ? KIT_ASSEMBLY[region]?.[rec.model] : undefined;
      const amount = regional ?? KIT_ASSEMBLY_REFERENCE[rec.model];
      lines.push({
        id: 'install', low: amount, high: amount, andUp: false,
        reference: regional === undefined || referenceOnly,
      });
      break;
    }
  }

  // Ramps for short steps on the shed mule route (spec section 6.4)
  if (rec.ramps) lines.push(fixed('ramps', MULE_RAMPS));

  // Base
  switch (rec.base) {
    case 'existing':
      lines.push(fixed('base', 0));
      break;
    case 'gravel': {
      const regional = region ? GRAVEL[region]?.[rec.model] : undefined;
      if (regional !== undefined) {
        lines.push({ id: 'base', low: regional, high: regional, andUp: false, reference: referenceOnly });
      } else {
        lines.push({ id: 'base', ...gravelReference(rec.model), andUp: false, reference: true });
      }
      break;
    }
    case 'raised':
      side.push({ id: 'raisedBase', from: raisedFrom(rec.model, region) });
      break;
  }

  // Power
  {
    const { feet, andUp } = bandFeet(answers.panelDistance);
    const regional = powerFor(region, feet);
    const money = regional ?? powerReference(feet);
    lines.push({ id: 'power', ...money, andUp, reference: regional === null || referenceOnly });
  }

  // Plumbing. There is no distance question, so it is always priced at the 25-50 ft band.
  if (rec.bathroom !== 'none') {
    const { feet, andUp } = bandFeet(undefined);
    const regional = plumbingFor(region, feet);
    const money = regional ?? plumbingReference(feet);
    lines.push({ id: 'plumbing', ...money, andUp, reference: regional === null || referenceOnly });
  }

  return {
    mode: 'range',
    low: lines.reduce((sum, l) => sum + l.low, 0),
    high: lines.reduce((sum, l) => sum + l.high, 0),
    andUp: lines.some(l => l.andUp),
    lines, side,
    locationKnown: location !== null,
  };
}

export function leadTime(rec: Recommendation, location: Location | null): LeadTime {
  const kind: LeadKind = rec.method === 'kit' ? 'kit'
    : rec.model === 'station' ? 'stationPrebuilt' : 'twelveSixteenPrebuilt';
  const weeks = LEAD_WEEKS[kind];
  const factory = location?.factory ?? null;
  const base = factory ? [weeks[factory]] : [weeks.WA, weeks.TN];
  const extra = rec.bathroom !== 'none' ? BATHROOM_LEAD_WEEKS : 0;
  return { minWeeks: Math.min(...base) + extra, maxWeeks: Math.max(...base) + extra };
}
