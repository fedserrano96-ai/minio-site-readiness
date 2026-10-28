// Source: the "Shipping, Installation, Lead time, Customizations, Extras, Site work"
// Google Sheet. Tabs: Installation (shed mule, base, assembly), Customization & extras
// (flipped door), Shipping Calculator (kit assembly reference), ClickUp handbook (crane).
// Synced on 2026-10-28 (spec section 8). Edit this file when the sheet changes.
import type { ModelId, PriceRegion } from './types';

// w x d = pod footprint in feet (spec 5.1). minPathWidth / minOverhead = clearance in feet (spec 6.1, 6.2).
export const MODELS: Record<ModelId, {
  name: string; w: number; d: number; minPathWidth: number; minOverhead: number;
  weightLbs: number | null; weightWithBathLbs: number | null; flipAvailable: boolean;
}> = {
  twelve:  { name: 'Twelve',  w: 12, d: 8,  minPathWidth: 10, minOverhead: 12, weightLbs: 4600, weightWithBathLbs: null, flipAvailable: true },
  sixteen: { name: 'Sixteen', w: 16, d: 10, minPathWidth: 12, minOverhead: 12, weightLbs: 7200, weightWithBathLbs: 8000, flipAvailable: true },
  station: { name: 'Station', w: 30, d: 10, minPathWidth: 12, minOverhead: 13, weightLbs: null, weightWithBathLbs: null, flipAvailable: false },
};

type RegionPrices = Partial<Record<PriceRegion, Partial<Record<ModelId, number>>>>;

// Gravel pad by region. A missing figure falls back to the reference figure.
export const GRAVEL: RegionPrices = {
  WA:       { twelve: 2500, sixteen: 3000, station: 6000 },
  WA_OTHER: { twelve: 3000, sixteen: 3500 },
  CA_NORTH: { twelve: 3450, sixteen: 4945, station: 6900 },
  CA_SOUTH: { twelve: 3450, sixteen: 4945, station: 6900 },
  NJ_NY:    { twelve: 3000, sixteen: 3500 },
  VA_PA_MD: { twelve: 3000, sixteen: 3500 },
};

// Raised base, reference "from" figure.
export const RAISED_FROM: RegionPrices = {
  WA:       { twelve: 8500, sixteen: 14025, station: 19500 },
  CA_NORTH: { twelve: 9775, sixteen: 16129, station: 22425 },
  CA_SOUTH: { twelve: 9775, sixteen: 16129, station: 22425 },
};

// Kit assembly by region (non-permitted rows only).
export const KIT_ASSEMBLY: RegionPrices = {
  WA:       { twelve: 7000, sixteen: 8300, station: 12500 },
  WA_OTHER: { twelve: 9500, sixteen: 11000 },
  CA_NORTH: { twelve: 7000, sixteen: 9000, station: 13095 },
  CA_SOUTH: { twelve: 7000, sixteen: 11000, station: 15800 },
};

// Kit assembly, the sheet's public (reference) column.
export const KIT_ASSEMBLY_REFERENCE: Record<ModelId, number> = {
  twelve: 10000, sixteen: 12000, station: 16500,
};

export const SHED_MULE = 2000;
export const CRANE_FROM = { near: 3000, far: 4000 } as const; // near: up to 100 ft, far: 100-150 ft
export const FLIP_DOOR = 500;
export const PANEL_UPGRADE = 2500;

// Open items for sales (spec section 10, items 1 and 2): one place to change each.
export const LEVEL_CUTOFF_TEXT = '¼ in. per foot';
export const KIT_ACCESS_FT = 3;

// Lead times in weeks after payment is received (spec section 8.6).
// Look up as LEAD_WEEKS[kind][factory]; add BATHROOM_LEAD_WEEKS when the pod has a bathroom.
export type LeadKind = 'twelveSixteenPrebuilt' | 'stationPrebuilt' | 'kit';
export const LEAD_WEEKS: Record<LeadKind, Record<'WA' | 'TN', number>> = {
  twelveSixteenPrebuilt: { WA: 5, TN: 6 },
  stationPrebuilt:       { WA: 6, TN: 7 },
  kit:                   { WA: 4, TN: 5 },
};
export const BATHROOM_LEAD_WEEKS = 2;
