export type ModelId = 'twelve' | 'sixteen' | 'station';
export type PodUse = 'office' | 'studio' | 'guest' | 'other';
export interface YardObject { type: string; x: number; y: number; w: number; h: number } // x,y = centre, feet
export interface PlannerSnapshot {
  model: ModelId; rotation: 0 | 90; yardW: number; yardD: number;
  podX: number; podY: number; // pod centre, feet
  podUse: PodUse; objects: YardObject[];
}
export type Band = 'lt25' | '25to50' | '50to100' | 'gt100' | 'unsure';
export interface Answers {
  zip?: string;
  truckAccess?: 'yes' | 'no' | 'unsure';
  pathWidth?: 'wide' | 'narrow' | 'unsure';
  turn?: 'none' | 'roomy' | 'tight' | 'unsure';
  removable?: 'fence' | 'other' | 'no' | 'unsure';
  overhead?: 'clear' | 'branches' | 'other' | 'unsure';
  pathGround?: 'solid' | 'soft' | 'shortSteps' | 'steep' | 'unsure';
  powerLines?: 'no' | 'yes' | 'unsure';
  streetDistance?: 'upTo100' | '100to150' | 'over150' | 'unsure';
  kitAccess?: 'yes' | 'no' | 'unsure';
  existingBase?: 'slab' | 'gravel' | 'deck' | 'none' | 'unsure';
  groundFlat?: 'flat' | 'steep' | 'unsure';
  bathroom?: 'none' | 'half' | 'shower' | 'unsure';
  panelDistance?: Band;
  panelRoute?: 'soft' | 'hard' | 'both' | 'unsure';
}
export type QuestionId = keyof Answers;
export type Method = 'tiltTrailer' | 'shedMule' | 'crane' | 'kit' | 'talk';
export type BaseKind = 'gravel' | 'existing' | 'raised';
export type ReasonCode = 'truckNo' | 'pathNarrow' | 'pathTurn' | 'overheadLow' | 'pathSteep'
  | 'powerLines' | 'tooFar' | 'noKitAccess' | 'existingBase' | 'steepGround';
export type ToCheckCode = QuestionId | 'baseSlab' | 'baseGravel' | 'baseDeck';
export type NoteCode = 'softGround' | 'twelveHalfBathOnly' | 'kitUnloading' | 'clearance';
export interface Recommendation {
  model: ModelId; method: Method; craneFrom: 3000 | 4000 | null; base: BaseKind;
  methodReason: ReasonCode | null; baseReason: ReasonCode | null;
  bathroom: 'none' | 'half' | 'shower'; door: 'standard' | 'flipped';
  ramps: boolean; takeDown: 'fence' | 'other' | null; hardSurface: boolean;
  toCheck: ToCheckCode[]; notes: NoteCode[];
}
export type PriceRegion = 'WA' | 'WA_OTHER' | 'CA_NORTH' | 'CA_SOUTH' | 'NJ_NY' | 'VA_PA_MD';
export type Factory = 'WA' | 'TN';
export interface Location {
  input: string; country: 'US' | 'CA'; shippingKey: string; // Appendix A row name
  region: PriceRegion | null; inCoverage: boolean; factory: Factory | null;
}
export interface CostLine {
  id: 'shipping' | 'install' | 'base' | 'power' | 'plumbing' | 'ramps';
  low: number; high: number; andUp: boolean; reference: boolean;
}
export interface SideItem { id: 'crane' | 'raisedBase' | 'shippingQuoted'; from: number | null }
export type CostSummary =
  | { mode: 'talk' }
  | { mode: 'range'; low: number; high: number; andUp: boolean;
      lines: CostLine[]; side: SideItem[]; locationKnown: boolean };
export interface LeadTime { minWeeks: number; maxWeeks: number }
