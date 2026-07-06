/*
 * Unit tests for resolver.js (Census response parsing + jurisdiction resolution).
 * Run: node permitting-engine/tests/resolver.test.js
 * Same plain-assert pattern as engine.test.js. Fixtures are trimmed real-shaped
 * Census geocoder responses — no network in tests.
 */

'use strict';

const path = require('path');
const fs = require('fs');

const resolver = require(path.join(__dirname, '..', 'resolver.js'));
const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'jurisdictions.json'), 'utf8')
);

let passed = 0;
let failed = 0;

function assert(cond, label) {
  if (cond) {
    passed++;
  } else {
    failed++;
    console.error('  FAIL: ' + label);
  }
}

function fixture(name) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', name), 'utf8'));
}

/* ════ parseCensusResponse ═════════════════════════════════════════ */

const seattle = resolver.parseCensusResponse(fixture('census-seattle.json'));
assert(seattle !== null, 'seattle: parses to a result');
assert(seattle.place_geoid === '5363000', 'seattle: place GEOID');
assert(seattle.place_name === 'Seattle', 'seattle: place name');
assert(seattle.county_geoid === '53033', 'seattle: county GEOID');
assert(seattle.county_name === 'King', 'seattle: county name');
assert(seattle.matched_address === '600 4TH AVE, SEATTLE, WA, 98104', 'seattle: matched address');
assert(seattle.coords && Math.abs(seattle.coords.lat - 47.6033) < 0.001, 'seattle: lat comes from y');
assert(seattle.coords && Math.abs(seattle.coords.lon - -122.3303) < 0.001, 'seattle: lon comes from x');

const vashon = resolver.parseCensusResponse(fixture('census-unincorporated-king.json'));
assert(vashon !== null, 'vashon: parses to a result');
assert(vashon.place_geoid === null, 'vashon: no incorporated place (layer omitted)');
assert(vashon.county_geoid === '53033', 'vashon: county GEOID present');

assert(resolver.parseCensusResponse(fixture('census-no-match.json')) === null, 'zero matches → null');
assert(resolver.parseCensusResponse(fixture('census-malformed.json')) === null, 'malformed response → null');
assert(resolver.parseCensusResponse(null) === null, 'null input → null');
assert(resolver.parseCensusResponse({}) === null, 'empty object → null');
const noGeos = resolver.parseCensusResponse({
  result: { addressMatches: [{ matchedAddress: 'A ST', coordinates: { x: 1, y: 2 } }] },
});
assert(noGeos !== null, 'no geographies block → returns struct, not null');
assert(noGeos.county_geoid === null && noGeos.place_geoid === null, 'no geographies → both GEOIDs null');
assert(resolver.resolve(noGeos, data.jurisdictions).jurisdictionId === null, 'no geographies → resolves to product-default');

/* ════ resolve ═════════════════════════════════════════════════════ */

const rSeattle = resolver.resolve(seattle, data.jurisdictions);
assert(rSeattle.jurisdictionId === 'wa-king-seattle', 'seattle → wa-king-seattle');
assert(rSeattle.matchedAddress === seattle.matched_address, 'resolve carries matched address');
assert(rSeattle.coords === seattle.coords, 'resolve carries coords');

const rVashon = resolver.resolve(vashon, data.jurisdictions);
assert(rVashon.jurisdictionId === 'wa-king-unincorporated', 'unincorporated King address → county entry');

/* THE correctness core: an incorporated city we have NOT researched must go to
   product-default (null), never fall through to the county's unincorporated entry. */
const bellevue = resolver.parseCensusResponse(fixture('census-bellevue.json'));
const rBellevue = resolver.resolve(bellevue, data.jurisdictions);
assert(rBellevue.jurisdictionId === null, 'Bellevue (unresearched city) → null, NOT wa-king-unincorporated');
assert(rBellevue.matchedAddress.indexOf('BELLEVUE') !== -1, 'Bellevue: matched address still shown');

assert(resolver.resolve(null, data.jurisdictions).jurisdictionId === null, 'null parsed → null id');
assert(resolver.resolve(seattle, null).jurisdictionId === null, 'null jurisdictions list → null id');

/* Synthetic: county entry must require unincorporated:true to match a no-place result */
const synthetic = [{ id: 'x-county-not-flagged', geo: { county_geoid: '53033' } }];
assert(
  resolver.resolve(vashon, synthetic).jurisdictionId === null,
  'county entry without unincorporated:true never matches'
);

/* ════ Summary ═════════════════════════════════════════════════════ */
console.log('\n' + passed + ' passed, ' + failed + ' failed (' + (passed + failed) + ' assertions)');
if (failed > 0) process.exit(1);
