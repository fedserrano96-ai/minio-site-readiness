import { MODELS } from '../assessment/core/data';

export interface SpecValues {
  name: string;
  size: string;
  weight: string;
  inletCorner: string;
}

const ADVISOR_WEIGHT = 'ask your Mini·O advisor';

function lbs(n: number): string {
  return `${n.toLocaleString('en-US')} lbs`;
}

// Values for the contractor sheets. Returns null for an unknown model.
// Any door value other than "flipped" counts as the standard layout.
export function specValues(model: string | null, door: string | null): SpecValues | null {
  if (model === null || !Object.prototype.hasOwnProperty.call(MODELS, model)) return null;
  const m = MODELS[model as keyof typeof MODELS];

  let weight = ADVISOR_WEIGHT;
  if (m.weightLbs !== null) {
    weight = m.weightWithBathLbs !== null
      ? `${lbs(m.weightLbs)} (${lbs(m.weightWithBathLbs)} with a bathroom)`
      : lbs(m.weightLbs);
  }

  return {
    name: m.name,
    size: `${m.w} × ${m.d} ft`,
    weight,
    inletCorner: door === 'flipped' ? 'back left corner' : 'back right corner',
  };
}
