// Client-facing walk-through steps for "Your plan" (spec 6.2). Pure: recommendation and location
// in, plain-English steps out. Fred reviews every string here.
import type { Location, Method, Recommendation } from '../core/types';
import { noteText } from './copy';

export interface PlanStep {
  id: 'delivery' | 'base' | 'power' | 'water';
  title: string;
  lines: string[];
  link: { href: string; label: string } | null;
}

const DELIVERY_LINE: Record<Method, string> = {
  tiltTrailer: 'Your pod arrives on a tilt trailer and slides off right at the spot.',
  shedMule: 'A truck brings your pod, and a small mover (a shed mule) rolls it the last stretch.',
  crane: 'A crane lifts your pod from the street onto the spot.',
  kit: 'Your pod arrives as a kit, and a local crew builds it on the spot.',
  talk: "We'll work out the best way in with you on a call.",
};

const WATER_LINE = 'Your pod will need a licensed plumber to connect it to your water and sewer. We can help coordinate one, or if you have someone you trust, even better.';

function deliveryStep(rec: Recommendation, location: Location | null): PlanStep {
  const lines = [DELIVERY_LINE[rec.method]];
  if (location !== null) {
    lines.push(location.inCoverage ? 'Mini·O arranges this.' : 'Mini·O ships it; your local crew takes it from there.');
  }
  if (rec.takeDown === 'fence') lines.push('The fence section or gate comes down on delivery day and goes back up after.');
  if (rec.takeDown === 'other') lines.push("What's in the way comes down on delivery day and goes back up after.");
  if (rec.ramps) lines.push('Ramps go over the steps.');
  for (const code of rec.notes) {
    if (code === 'softGround' || code === 'kitUnloading') lines.push(noteText(code, rec));
  }
  return { id: 'delivery', title: 'Delivery', lines, link: null };
}

function baseStep(rec: Recommendation, location: Location | null): PlanStep {
  const lines: string[] = [];
  let link: PlanStep['link'] = null;
  switch (rec.base) {
    case 'gravel':
      if (location?.inCoverage === true) {
        lines.push('A local contractor lays a gravel pad. Mini·O arranges this.');
      } else {
        lines.push('Your contractor lays a gravel pad. Give them this sheet.');
        link = { href: `contractor/base.html?model=${rec.model}`, label: 'Get the base spec for your contractor' };
      }
      break;
    case 'existing':
      lines.push("Your pod goes on your existing base. We'll confirm it's big enough and level.");
      break;
    case 'raised':
      lines.push("The ground is too steep for a gravel pad, so the pod needs a raised base. We'll price it with you in person.");
      break;
  }
  if (rec.notes.includes('clearance')) lines.push(noteText('clearance', rec));
  return { id: 'base', title: 'Base', lines, link };
}

function powerStep(rec: Recommendation, location: Location | null): PlanStep {
  const lines = [
    'An electrician adds an outdoor outlet near the pod and a breaker in your panel, and checks your panel has room.',
    'Your electrician or general contractor can handle this. Give them this sheet.',
  ];
  if (location?.inCoverage === true) lines.push('Or we can help arrange one for you.');
  if (rec.hardSurface) lines.push('Your electrician will plan the route around or under the paved part.');
  return {
    id: 'power', title: 'Power', lines,
    link: { href: `contractor/power.html?model=${rec.model}&door=standard`, label: 'Get the power spec for your contractor' },
  };
}

/** The walk-through for this recommendation. "Covered" means `location?.inCoverage === true`. */
export function planSteps(rec: Recommendation, location: Location | null): PlanStep[] {
  const steps = [deliveryStep(rec, location), baseStep(rec, location), powerStep(rec, location)];
  if (rec.bathroom !== 'none') steps.push({ id: 'water', title: 'Water', lines: [WATER_LINE], link: null });
  return steps;
}
