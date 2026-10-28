// ZIP / postal code -> shipping row, price region, install coverage, factory.
// Tables are a first proposal from USPS ZIP3 assignments; Fred reviews them (spec 8.1).
import type { Factory, Location, PriceRegion } from './types';
import { SHIPPING } from './shipping';

type Range = [from: number, to: number];

// Inclusive ZIP3 ranges per state. Names are SHIPPING keys. California is split separately.
// ZIP3s not listed here are unassigned (000-004, military, territories, ...) and return null.
const STATE_RANGES: Array<[string, Range[]]> = [
  ['Massachusetts', [[10, 27], [55, 55]]],
  ['Rhode Island', [[28, 29]]],
  ['New Hampshire', [[30, 38]]],
  ['Maine', [[39, 49]]],
  ['Vermont', [[50, 54], [56, 59]]],
  ['Connecticut', [[60, 69]]],
  ['New Jersey', [[70, 89]]],
  ['New York', [[5, 5], [100, 149]]],
  ['Pennsylvania', [[150, 196]]],
  ['Delaware', [[197, 199]]],
  ['DC', [[200, 200], [202, 205], [569, 569]]],
  ['Virginia', [[201, 201], [220, 246]]],
  ['Maryland', [[206, 212], [214, 219]]],
  ['West Virginia', [[247, 268]]],
  ['North Carolina', [[270, 289]]],
  ['South Carolina', [[290, 299]]],
  ['Georgia', [[300, 319], [398, 399]]],
  ['Florida', [[320, 339], [341, 342], [344, 344], [346, 347], [349, 349]]],
  ['Alabama', [[350, 352], [354, 369]]],
  ['Tennessee', [[370, 385]]],
  ['Mississippi', [[386, 397]]],
  ['Kentucky', [[400, 418], [420, 427]]],
  ['Ohio', [[430, 459]]],
  ['Indiana', [[460, 479]]],
  ['Michigan', [[480, 499]]],
  ['Iowa', [[500, 516], [520, 528]]],
  ['Wisconsin', [[530, 532], [534, 535], [537, 549]]],
  ['Minnesota', [[550, 551], [553, 567]]],
  ['South Dakota', [[570, 577]]],
  ['North Dakota', [[580, 588]]],
  ['Montana', [[590, 599]]],
  ['Illinois', [[600, 620], [622, 629]]],
  ['Missouri', [[630, 631], [633, 641], [644, 658]]],
  ['Kansas', [[660, 662], [664, 679]]],
  ['Nebraska', [[680, 681], [683, 693]]],
  ['Louisiana', [[700, 701], [703, 708], [710, 714]]],
  ['Arkansas', [[716, 729]]],
  ['Oklahoma', [[730, 731], [734, 741], [743, 749]]],
  ['Texas', [[733, 733], [750, 799], [885, 885]]],
  ['Colorado', [[800, 816]]],
  ['Wyoming', [[820, 831]]],
  ['Idaho', [[832, 838]]],
  ['Utah', [[840, 847]]],
  ['Arizona', [[850, 853], [855, 857], [859, 860], [863, 865]]],
  ['New Mexico', [[870, 884]]],
  ['Nevada', [[889, 891], [893, 895], [897, 898]]],
  ['California', [[900, 908], [910, 928], [930, 961]]],
  ['Hawaii', [[967, 968]]],
  ['Oregon', [[970, 979]]],
  ['Washington', [[980, 986], [988, 994]]],
  ['Alaska', [[995, 999]]],
];

const inRanges = (n: number, ranges: Range[]): boolean => ranges.some(([a, b]) => n >= a && n <= b);

const STATE_BY_ZIP3: Array<string | null> = (() => {
  const table: Array<string | null> = new Array(1000).fill(null);
  for (const [state, ranges] of STATE_RANGES) {
    for (const [a, b] of ranges) for (let n = a; n <= b; n++) table[n] = state;
  }
  return table;
})();

// Southern California is ZIP3 900-935, Northern 936-961.
const CA_SOUTH_MAX = 935;

const REGION_RANGES: Array<[PriceRegion, Range[]]> = [
  ['WA', [[980, 985]]],
  ['WA_OTHER', [[986, 986], [988, 994]]],
  ['CA_SOUTH', [[900, 935]]],
  ['CA_NORTH', [[936, 961]]],
  ['NJ_NY', [[70, 89], [100, 119]]],
  ['VA_PA_MD', [[206, 223], [170, 196]]],
];

// Install areas: Western WA, Bay Area, LA, San Diego.
const COVERAGE_RANGES: Range[] = [[980, 985], [939, 954], [956, 958], [900, 918], [922, 928], [930, 935], [919, 921]];

const US_ZIP = /^\d{5}(-\d{4})?$/;
const CA_POSTAL = /^[A-Z]\d[A-Z]\d[A-Z]\d$/;

const CA_SHIPPING_KEY: Record<string, string> = {
  T: 'Alberta', V: 'British Columbia', R: 'Manitoba',
  K: 'Ontario (Eastern)', L: 'Ontario (Eastern)', M: 'Ontario (Eastern)',
  N: 'Ontario (Western)', P: 'Ontario (Western)',
  G: 'Quebec', H: 'Quebec', J: 'Quebec',
};

function factoryFor(shippingKey: string): Factory | null {
  const row = SHIPPING[shippingKey];
  if (!row) throw new Error(`No SHIPPING row for key "${shippingKey}"`);
  return row.factory;
}

/**
 * Looks up a US ZIP or Canadian postal code. Returns null when the input is not a
 * recognizable code (that is the contract, not a fallback).
 * `input` is the normalized code: trimmed, uppercased, spaces removed. A US ZIP+4 keeps its +4.
 */
export function lookupLocation(raw: string): Location | null {
  const input = raw.trim().toUpperCase().replace(/\s+/g, '');

  if (US_ZIP.test(input)) {
    const zip3 = Number(input.slice(0, 3));
    const state = STATE_BY_ZIP3[zip3];
    if (!state) return null;
    const shippingKey = state === 'California'
      ? (zip3 <= CA_SOUTH_MAX ? 'California (Southern)' : 'California (Northern)')
      : state;
    const region = REGION_RANGES.find(([, ranges]) => inRanges(zip3, ranges))?.[0] ?? null;
    return {
      input, country: 'US', shippingKey, region,
      inCoverage: inRanges(zip3, COVERAGE_RANGES),
      factory: factoryFor(shippingKey),
    };
  }

  if (CA_POSTAL.test(input)) {
    const shippingKey = CA_SHIPPING_KEY[input[0]!] ?? 'OTHER';
    return { input, country: 'CA', shippingKey, region: null, inCoverage: false, factory: factoryFor(shippingKey) };
  }

  return null;
}
