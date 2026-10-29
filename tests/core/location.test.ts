import { describe, it, expect } from 'vitest';
import { lookupLocation } from '../../src/assessment/core/location';
import { SHIPPING } from '../../src/assessment/core/shipping';

const ONE_ZIP_PER_STATE: Array<[string, string, string]> = [
  ['AL', '35203', 'Alabama'], ['AK', '99501', 'Alaska'], ['AZ', '85001', 'Arizona'],
  ['AR', '72201', 'Arkansas'], ['CO', '80202', 'Colorado'], ['CT', '06103', 'Connecticut'],
  ['DE', '19901', 'Delaware'], ['DC', '20001', 'DC'], ['FL', '33101', 'Florida'],
  ['GA', '30303', 'Georgia'], ['HI', '96813', 'Hawaii'], ['ID', '83702', 'Idaho'],
  ['IL', '60601', 'Illinois'], ['IN', '46204', 'Indiana'], ['IA', '50309', 'Iowa'],
  ['KS', '66603', 'Kansas'], ['KY', '40202', 'Kentucky'], ['LA', '70112', 'Louisiana'],
  ['ME', '04101', 'Maine'], ['MD', '21201', 'Maryland'], ['MA', '02108', 'Massachusetts'],
  ['MI', '48226', 'Michigan'], ['MN', '55401', 'Minnesota'], ['MS', '39201', 'Mississippi'],
  ['MO', '63101', 'Missouri'], ['MT', '59601', 'Montana'], ['NE', '68102', 'Nebraska'],
  ['NV', '89101', 'Nevada'], ['NH', '03301', 'New Hampshire'], ['NJ', '07102', 'New Jersey'],
  ['NM', '87501', 'New Mexico'], ['NY', '10001', 'New York'], ['NC', '27601', 'North Carolina'],
  ['ND', '58501', 'North Dakota'], ['OH', '43215', 'Ohio'], ['OK', '73102', 'Oklahoma'],
  ['OR', '97201', 'Oregon'], ['PA', '19103', 'Pennsylvania'], ['RI', '02903', 'Rhode Island'],
  ['SC', '29201', 'South Carolina'], ['SD', '57501', 'South Dakota'], ['TN', '37203', 'Tennessee'],
  ['TX', '78701', 'Texas'], ['UT', '84101', 'Utah'], ['VT', '05601', 'Vermont'],
  ['VA', '23219', 'Virginia'], ['WA', '98101', 'Washington'], ['WV', '25301', 'West Virginia'],
  ['WI', '53202', 'Wisconsin'], ['WY', '82001', 'Wyoming'],
];

describe('lookupLocation', () => {
  it.each(ONE_ZIP_PER_STATE)('maps %s %s to %s', (_abbr, zip, key) => {
    const loc = lookupLocation(zip);
    expect(loc?.country).toBe('US');
    expect(loc?.shippingKey).toBe(key);
    expect(loc?.factory).toBe(SHIPPING[key]?.factory);
  });

  it('every ZIP3 it can resolve gives a shippingKey that exists in SHIPPING', () => {
    let resolved = 0;
    for (let n = 0; n < 1000; n++) {
      const loc = lookupLocation(`${String(n).padStart(3, '0')}01`);
      if (!loc) continue;
      resolved++;
      expect(SHIPPING[loc.shippingKey], `ZIP3 ${n} -> ${loc.shippingKey}`).toBeDefined();
    }
    expect(resolved).toBeGreaterThan(800);
  });

  it('every Canadian first letter gives a shippingKey that exists in SHIPPING', () => {
    for (const letter of 'ABCEGHJKLMNPRSTVXY') {
      const loc = lookupLocation(`${letter}1A1A1`);
      expect(loc, letter).not.toBeNull();
      expect(SHIPPING[loc!.shippingKey], letter).toBeDefined();
    }
  });

  it('splits California', () => {
    expect(lookupLocation('90012')).toMatchObject({ shippingKey: 'California (Southern)', region: 'CA_SOUTH', inCoverage: true });
    expect(lookupLocation('94103')).toMatchObject({ shippingKey: 'California (Northern)', region: 'CA_NORTH', inCoverage: true });
    expect(lookupLocation('95501')).toMatchObject({ shippingKey: 'California (Northern)', region: 'CA_NORTH', inCoverage: false });
  });

  it('covers San Diego and the Bay Area edges', () => {
    expect(lookupLocation('92101')).toMatchObject({ region: 'CA_SOUTH', inCoverage: true });
    expect(lookupLocation('93901')).toMatchObject({ region: 'CA_NORTH', inCoverage: true });
    expect(lookupLocation('95501')?.inCoverage).toBe(false);
  });

  it('Seattle is covered WA', () => {
    expect(lookupLocation('98101')).toMatchObject({ region: 'WA', inCoverage: true, factory: 'WA' });
    expect(lookupLocation('99201')).toMatchObject({ region: 'WA_OTHER', inCoverage: false });
  });

  it('NYC is NJ_NY but not covered', () => {
    expect(lookupLocation('10001')).toMatchObject({ region: 'NJ_NY', inCoverage: false, factory: 'TN' });
  });

  it('assigns VA_PA_MD by ZIP3', () => {
    expect(lookupLocation('21201')?.region).toBe('VA_PA_MD');
    expect(lookupLocation('22201')?.region).toBe('VA_PA_MD');
    expect(lookupLocation('19103')?.region).toBe('VA_PA_MD');
  });

  it('states outside any price region have region null and no coverage', () => {
    expect(lookupLocation('78701')).toMatchObject({ region: null, inCoverage: false });
  });

  it('accepts ZIP+4, spaces and lowercase postal codes', () => {
    expect(lookupLocation(' 98101-1234 ')).toMatchObject({ shippingKey: 'Washington', country: 'US', input: '98101-1234' });
    expect(lookupLocation('v6b 1a1')).toMatchObject({ shippingKey: 'British Columbia', country: 'CA', input: 'V6B1A1', region: null, inCoverage: false });
  });

  it('maps Canadian provinces', () => {
    expect(lookupLocation('T2P 1J9')?.shippingKey).toBe('Alberta');
    expect(lookupLocation('R3C 0V8')?.shippingKey).toBe('Manitoba');
    expect(lookupLocation('M5V 2T6')?.shippingKey).toBe('Ontario (Eastern)');
    expect(lookupLocation('K1A 0B1')?.shippingKey).toBe('Ontario (Eastern)');
    expect(lookupLocation('N6A 3K7')?.shippingKey).toBe('Ontario (Western)');
    expect(lookupLocation('H2Y 1C6')?.shippingKey).toBe('Quebec');
  });

  it('Canadian provinces without a row are quoted separately', () => {
    expect(lookupLocation('B3H 1A1')).toMatchObject({ country: 'CA', shippingKey: 'OTHER', factory: null });
  });

  it('pins known assigned and unassigned ZIP3s', () => {
    expect(lookupLocation('20301')?.shippingKey).toBe('DC');
    expect(lookupLocation('45999')?.shippingKey).toBe('Ohio');
    expect(lookupLocation('87654')?.shippingKey).toBe('New Mexico');
    expect(lookupLocation('05501')?.shippingKey).toBe('Massachusetts');
    expect(lookupLocation('56901')?.shippingKey).toBe('DC');
    for (const zip of ['21301', '26901', '98701']) expect(lookupLocation(zip), zip).toBeNull();
  });

  it('rejects junk', () => {
    for (const junk of ['', '1234', 'ABCDE', '00000', '123456', '98101-12']) {
      expect(lookupLocation(junk), junk).toBeNull();
    }
  });
});
