/*
 * Unit tests for the Mini·O Permitting Triage Engine.
 * Run: node permitting-engine/tests/engine.test.js
 * No test framework — plain assertions with a pass/fail counter.
 *
 * Sections:
 *   1. Engine unit tests (synthetic fixtures — stable against data changes)
 *   2. Data-file invariants (every jurisdiction, every rule)
 *   3. Per-jurisdiction behavior (Tier 1 drafts, incl. live-permit A/B cases)
 */

'use strict';

const path = require('path');
const fs = require('fs');

const engine = require(path.join(__dirname, '..', 'engine.js'));
const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'jurisdictions.json'), 'utf8')
);

const opts = { productDefault: data.product_default, today: '2026-06-09' };

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

function pod(overrides) {
  return Object.assign(
    {
      model: 'twelve',
      footprint_sqft: 96,
      plumbing: 'none',
      sleeping_intended: false,
      on_trailer: false,
      electrical: 'standard',
    },
    overrides || {}
  );
}

function jur(id) {
  return data.jurisdictions.find((j) => j.id === id);
}

/* ════ 1. ENGINE UNIT TESTS (synthetic fixtures) ═══════════════════ */

/* Footprint resolution */
assert(engine.resolveFootprint({ model: 'twelve' }) === 96, 'twelve resolves to 96 sqft');
assert(engine.resolveFootprint({ model: 'sixteen' }) === 160, 'sixteen resolves to 160 sqft');
assert(engine.resolveFootprint({ model: 'station' }) === 300, 'station resolves to 300 sqft');
assert(
  engine.resolveFootprint({ model: 'custom', footprint_sqft: 200 }) === 200,
  'custom uses numeric footprint'
);
assert(
  engine.resolveFootprint({ model: 'twelve', footprint_sqft: 110 }) === 110,
  'explicit footprint overrides model default'
);

/* Matching + specificity */
const FIX_RULES = [
  {
    id: 'fix-specific',
    when: { footprint: { max: 120 }, plumbing: ['none'], on_trailer: false, sleeping: false },
    result: { building_permit: 'likely_exempt', electrical_permit: 'depends', plumbing_permit: 'not_applicable', zoning_review: 'depends' },
    citation: { code_section: 'TEST 1.2.3', title: 'Test', url: 'https://example.gov/a', snippet: 'test' },
    confidence: 'low',
  },
  {
    id: 'fix-broad-low',
    when: { footprint: { min: 121 } },
    result: { building_permit: 'likely_required', electrical_permit: 'likely_required', plumbing_permit: 'depends', zoning_review: 'depends' },
    citation: { code_section: 'TEST 4.5.6', title: 'Test', url: 'https://example.gov/b', snippet: 'test' },
    confidence: 'low',
  },
  {
    id: 'fix-broad-high',
    when: { plumbing: ['half_bath', 'kitchenette', 'full_bath'] },
    result: { building_permit: 'likely_required', electrical_permit: 'likely_required', plumbing_permit: 'likely_required', zoning_review: 'depends' },
    citation: { code_section: 'TEST 7.8.9', title: 'Test', url: 'https://example.gov/c', snippet: 'test' },
    confidence: 'high',
  },
];
const FIX_JUR = {
  id: 'xx-fixture', name: 'Fixture City', county: 'Test', state: 'WA',
  status: 'verified', last_verified: '2026-06-01', rules: FIX_RULES,
};

assert(engine.ruleMatches(FIX_RULES[0], pod()), 'specific rule matches small bare pod');
assert(!engine.ruleMatches(FIX_RULES[0], pod({ footprint_sqft: 160 })), 'max footprint condition rejects larger pod');
assert(!engine.ruleMatches(FIX_RULES[0], pod({ plumbing: 'half_bath' })), 'plumbing list condition rejects plumbing');
assert(!engine.ruleMatches(FIX_RULES[0], pod({ sleeping_intended: true })), 'sleeping:false condition rejects sleeping');
assert(!engine.ruleMatches(FIX_RULES[0], pod({ on_trailer: true })), 'on_trailer:false condition rejects trailer');
assert(engine.ruleMatches(FIX_RULES[1], pod({ footprint_sqft: 160 })), 'min footprint condition matches larger pod');
assert(engine.ruleSpecificity(FIX_RULES[0]) === 4, 'four explicit conditions → specificity 4');
assert(engine.ruleSpecificity(FIX_RULES[1]) === 1, 'one explicit condition → specificity 1');

assert(engine.selectRule(FIX_RULES, pod()).id === 'fix-specific', 'most specific rule wins');
/* 160 sqft + half bath matches both broad rules (spec 1 each); high confidence wins the tie. */
assert(
  engine.selectRule(FIX_RULES, pod({ footprint_sqft: 160, plumbing: 'half_bath' })).id === 'fix-broad-high',
  'specificity tie broken by higher confidence'
);
assert(engine.selectRule([], pod()) === null, 'no rules → null selection');

/* Citation completeness */
assert(
  !engine.citationComplete({ code_section: '<<verify>>', title: 'x', url: 'https://x', snippet: 'x' }),
  '<<verify>> citation is incomplete'
);
assert(!engine.citationComplete(null), 'missing citation is incomplete');
assert(engine.citationComplete(FIX_RULES[0].citation), 'fully filled citation is complete');

/* Citation downgrade behavior (synthetic draft with <<verify>> citation) */
const DOWNGRADE_JUR = JSON.parse(JSON.stringify(FIX_JUR));
DOWNGRADE_JUR.status = 'draft';
DOWNGRADE_JUR.last_verified = '';
DOWNGRADE_JUR.rules[0].citation.code_section = '<<verify>>';
const dOut = engine.evaluate(pod(), DOWNGRADE_JUR, opts);
assert(dOut.permits.building_permit === 'depends', 'uncited likely_exempt downgrades to depends');
assert(dOut.permits.plumbing_permit === 'not_applicable', 'not_applicable survives downgrade');
assert(
  dOut.downgraded.some((d) => d.permit === 'building_permit' && d.from === 'likely_exempt'),
  'downgrade records original posture'
);
assert(
  dOut.notes.some((n) => n.indexOf('confirm with the office') !== -1),
  'downgrade adds confirm-with-the-office note'
);
assert(dOut.citations.length === 0, 'incomplete citations are not rendered');

/* Cited rule renders as-is */
const vOut = engine.evaluate(pod(), FIX_JUR, opts);
assert(vOut.permits.building_permit === 'likely_exempt', 'cited likely_exempt renders as-is');
assert(vOut.downgraded.length === 0, 'no downgrades when citation is complete');
assert(vOut.citations.length === 1, 'complete citation is rendered');
assert(vOut.coverage === 'verified', 'verified status → verified coverage');
assert(vOut.verified_as_of === '2026-06-01', 'verified_as_of comes from last_verified');
assert(vOut.disclaimer.indexOf('2026-06-01') !== -1, 'disclaimer dated with last_verified');
assert(dOut.coverage === 'draft', 'draft status → draft coverage');
assert(dOut.disclaimer.indexOf('2026-06-09') !== -1, 'draft disclaimer falls back to today');

/* Product default path */
const pdOut = engine.evaluate(pod(), null, opts);
assert(pdOut.coverage === 'product_default', 'unknown jurisdiction → product_default coverage');
assert(pdOut.package_cta === true, 'product default still shows the package CTA');
assert(pdOut.permits.building_permit === 'depends', 'product default never says likely_exempt');
assert(pdOut.jurisdiction.indexOf('not yet researched') !== -1, 'product default labels jurisdiction');
assert(
  engine.evaluate(pod(), { id: 'xx', name: 'X', state: 'TX', status: 'not_researched', rules: [] }, opts).coverage === 'product_default',
  'not_researched status → product_default coverage'
);
assert(
  engine.evaluate(pod({ footprint_sqft: 160 }), null, opts).permits.building_permit === 'likely_required',
  'product default: over 120 sqft → building likely_required'
);
assert(
  engine.evaluate(pod({ plumbing: 'full_bath' }), null, opts).permits.plumbing_permit === 'likely_required',
  'product default: plumbing → plumbing permit likely_required'
);

/* Energy compliance (v0.2) */
assert(engine.evaluate(pod(), FIX_JUR, opts).energy_compliance.code === 'WSEC', 'WA → WSEC energy line');
const caFix = Object.assign({}, FIX_JUR, { state: 'CA' });
assert(engine.evaluate(pod(), caFix, opts).energy_compliance.code === 'Title 24', 'CA → Title 24 energy line');
assert(engine.evaluate(pod(), null, opts).energy_compliance.posture === 'depends', 'unknown state → energy depends');
assert(
  engine.evaluate(pod(), FIX_JUR, opts).energy_compliance.posture === 'likely_required',
  'energy report likely_required for conditioned pods in mapped states'
);

/* Foundation requirement (v0.2) */
assert(
  engine.evaluate(pod({ footprint_sqft: 160 }), caFix, opts).foundation_requirement.posture === 'footings_likely_required',
  'permitted build → footings likely required'
);
assert(
  engine.evaluate(pod({ footprint_sqft: 160 }), caFix, opts).foundation_requirement.note.indexOf('slab is not enough') !== -1,
  'CA permitted build warns a plain slab is not enough'
);
assert(
  engine.evaluate(pod({ on_trailer: true }), FIX_JUR, opts).foundation_requirement.posture === 'not_applicable',
  'trailer-mounted → foundation not applicable'
);
assert(
  engine.evaluate(pod(), FIX_JUR, opts).foundation_requirement.posture === 'standard_ok',
  'cited exempt path → standard slab ok'
);
assert(
  engine.evaluate(pod(), DOWNGRADE_JUR, opts).foundation_requirement.posture === 'depends',
  'building permit depends → foundation depends'
);

/* CTA, config lock, trailer note */
assert(dOut.package_cta === true, 'any depends/required outcome → package CTA');
assert(dOut.config_lock_note !== null, 'config lock reminder shown when permits in play');
assert(
  engine.evaluate(pod({ on_trailer: true }), FIX_JUR, opts).notes.some((n) => n.indexOf('vehicle/RV') !== -1),
  'trailer config adds the vehicle/RV note'
);
assert(dOut.disclaimer.indexOf('not a permitting determination') !== -1, 'disclaimer text present');
assert(pdOut.next_step.questions.length >= 2, 'next_step includes questions for the office');

/* Purity */
const p = pod();
const pBefore = JSON.stringify(p);
const sBefore = JSON.stringify(jur('wa-king-seattle'));
engine.evaluate(p, jur('wa-king-seattle'), opts);
assert(JSON.stringify(p) === pBefore, 'evaluate does not mutate the pod config');
assert(JSON.stringify(jur('wa-king-seattle')) === sBefore, 'evaluate does not mutate the jurisdiction');

/* Construction requirements */
const REQ_JUR = {
  id: 'test-req',
  name: 'Testville',
  county: 'Test',
  state: 'CA',
  status: 'draft',
  last_verified: '2026-01-01',
  rules: [
    {
      id: 'req-broad',
      when: { footprint: 'any', plumbing: 'any', on_trailer: 'any', sleeping: 'any' },
      result: { building_permit: 'depends', electrical_permit: 'depends', plumbing_permit: 'depends', zoning_review: 'depends' },
      citation: { code_section: 'T 1.1', title: 'Test', url: 'https://example.gov/t', snippet: 't' },
      confidence: 'low',
    },
  ],
  construction_requirements: [
    {
      id: 'req-cited',
      category: 'insulation',
      requirement: 'R-49 ceiling insulation.',
      citation: { code_section: 'EC R402', title: 'Energy Code', url: 'https://example.gov/ec', snippet: 'R-49 ceilings' },
      confidence: 'high',
    },
    {
      id: 'req-uncited',
      category: 'foundation',
      requirement: 'Footings below frost line.',
      citation: { code_section: '<<verify>>', title: '', url: '', snippet: '' },
      confidence: 'medium',
    },
  ],
};

const reqOut = engine.evaluate(pod(), REQ_JUR, opts);
assert(reqOut.construction_requirements.status === 'listed', 'requirements: non-empty list → status listed');
assert(reqOut.construction_requirements.verified.length === 1, 'requirements: one verified (complete citation)');
assert(reqOut.construction_requirements.verified[0].id === 'req-cited', 'requirements: cited item is the verified one');
assert(reqOut.construction_requirements.verified[0].citation.code_section === 'EC R402', 'requirements: verified keeps citation');
assert(reqOut.construction_requirements.unverified.length === 1, 'requirements: one unverified (incomplete citation)');
assert(reqOut.construction_requirements.unverified[0].citation === undefined, 'requirements: unverified never carries a citation');
assert(reqOut.construction_requirements.note === null, 'requirements: listed → no fallback note');

const noReqJur = Object.assign({}, REQ_JUR, { construction_requirements: [] });
const noReqOut = engine.evaluate(pod(), noReqJur, opts);
assert(noReqOut.construction_requirements.status === 'not_researched', 'requirements: empty list → not_researched');
assert(/not yet researched/i.test(noReqOut.construction_requirements.note), 'requirements: not-researched note');

const absentReqJur = Object.assign({}, REQ_JUR);
delete absentReqJur.construction_requirements;
assert(
  engine.evaluate(pod(), absentReqJur, opts).construction_requirements.status === 'not_researched',
  'requirements: absent field → not_researched'
);

const malformedCrJur = Object.assign({}, REQ_JUR, { construction_requirements: 'TBD' });
assert(
  engine.evaluate(pod(), malformedCrJur, opts).construction_requirements.status === 'not_researched',
  'requirements: non-array value → not_researched'
);

const pdReqOut = engine.evaluate(pod(), null, opts);
assert(pdReqOut.construction_requirements.status === 'product_default', 'requirements: product default status');
assert(/vary by climate/i.test(pdReqOut.construction_requirements.note), 'requirements: product-default generic note');
assert(pdReqOut.construction_requirements.verified.length === 0, 'requirements: product default lists nothing');

/* ════ 2. DATA-FILE INVARIANTS ═════════════════════════════════════ */

const TIER1_IDS = [
  'wa-king-seattle',
  'ca-santa-clara-san-jose',
  'ca-san-diego-del-mar',
  'wa-king-unincorporated',
  'ca-los-angeles-unincorporated',
];
TIER1_IDS.forEach((id) => {
  assert(Boolean(jur(id)), 'Tier 1 jurisdiction present: ' + id);
});
assert(
  data.jurisdictions.every((j) => j.status === 'draft'),
  'every jurisdiction ships as draft — only Fred flips to verified'
);
assert(data.template && data.template.status === 'draft', 'blank template present with draft status');
assert(data.product_default.rules.length >= 3, 'product default rule set populated');

const ALLOWED = engine.POSTURES;
data.jurisdictions.forEach((j) => {
  assert(j.rules.length >= 4, j.id + ': at least 4 rules (size under/over, plumbing, trailer)');
  j.rules.forEach((r) => {
    assert(
      engine.PERMIT_TYPES.every((p2) => ALLOWED.indexOf(r.result[p2]) !== -1),
      j.id + '/' + r.id + ': outcomes use allowed vocabulary only'
    );
    assert(Boolean(r.citation && r.citation.url), j.id + '/' + r.id + ': citation object with url present');
    assert(['high', 'medium', 'low'].indexOf(r.confidence) !== -1, j.id + '/' + r.id + ': confidence set');
    assert(Boolean(r.rationale), j.id + '/' + r.id + ': rationale present');
  });
  assert(Boolean(j.authority && j.authority.dept), j.id + ': authority dept present');
  assert(Boolean(j.hoa_note), j.id + ': HOA note present');
  assert(Boolean(j.research && j.research.date && j.research.sources.length), j.id + ': research provenance recorded');
});

/* The full config matrix evaluates without throwing, in vocabulary, with CTA. */
const MATRIX = [
  pod(),
  pod({ model: 'sixteen', footprint_sqft: 160 }),
  pod({ model: 'station', footprint_sqft: 300 }),
  pod({ plumbing: 'half_bath' }),
  pod({ model: 'sixteen', footprint_sqft: 160, plumbing: 'full_bath' }),
  pod({ model: 'station', footprint_sqft: 300, plumbing: 'kitchenette', sleeping_intended: true }),
  pod({ sleeping_intended: true }),
  pod({ on_trailer: true }),
  pod({ model: 'sixteen', footprint_sqft: 160, on_trailer: true, plumbing: 'half_bath' }),
];
let matrixOk = true;
let ctaOk = true;
let noExemptInDrafts = true;
data.jurisdictions.concat([null]).forEach((j) => {
  MATRIX.forEach((c) => {
    const out = engine.evaluate(c, j, opts);
    Object.values(out.permits).forEach((v) => {
      if (ALLOWED.indexOf(v) === -1) matrixOk = false;
      if (v === 'likely_exempt') noExemptInDrafts = false;
    });
    if (!out.package_cta) ctaOk = false;
  });
});
assert(matrixOk, 'full matrix × all jurisdictions: vocabulary holds');
assert(ctaOk, 'full matrix × all jurisdictions: package CTA always shown');
assert(
  noExemptInDrafts,
  'no Tier 1 draft currently renders likely_exempt for any config (safe-error posture until verified)'
);

/* geo blocks: every jurisdiction entry must be resolvable from a Census result */
data.jurisdictions.forEach((j) => {
  const geo = j.geo || {};
  const isPlace = typeof geo.place_geoid === 'string' && /^\d{7}$/.test(geo.place_geoid);
  const isCounty =
    typeof geo.county_geoid === 'string' &&
    /^\d{5}$/.test(geo.county_geoid) &&
    geo.unincorporated === true;
  assert(isPlace || isCounty, j.id + ': geo block has a 7-digit place_geoid or a 5-digit unincorporated county_geoid');
  assert(!(isPlace && geo.unincorporated), j.id + ': place entries must not claim unincorporated');
  if (j.level === 'city') {
    assert(isPlace && !geo.county_geoid, j.id + ': city entries carry place_geoid only');
  }
  if (j.level === 'unincorporated_county') {
    assert(isCounty && !geo.place_geoid, j.id + ': county entries carry county_geoid + unincorporated only');
  }
});
const geoKeys = data.jurisdictions.map((j) => ((j.geo || {}).place_geoid || (j.geo || {}).county_geoid || ('__missing__' + j.id)));
assert(new Set(geoKeys).size === geoKeys.length, 'geo GEOIDs are unique across jurisdictions');

/* ════ 3. PER-JURISDICTION BEHAVIOR (Tier 1 drafts) ════════════════ */

/* Seattle — WSEC path; conditioned-office ambiguity; DADU escalation. */
const sea = jur('wa-king-seattle');
const seaTwelve = engine.evaluate(pod(), sea, opts);
assert(seaTwelve.permits.building_permit === 'depends', 'Seattle: Twelve (96) building → depends (occupied-use ambiguity)');
assert(seaTwelve.permits.electrical_permit === 'likely_required', 'Seattle: 50A inlet → electrical likely_required');
assert(seaTwelve.energy_compliance.code === 'WSEC', 'Seattle: WSEC energy line');
assert(
  engine.evaluate(pod({ model: 'sixteen', footprint_sqft: 160 }), sea, opts).permits.building_permit === 'likely_required',
  'Seattle: Sixteen (160) building → likely_required'
);
const seaSleep = engine.evaluate(pod({ sleeping_intended: true }), sea, opts);
assert(seaSleep.permits.building_permit === 'likely_required', 'Seattle: sleeping → DADU building likely_required');
assert(seaSleep.permits.zoning_review === 'likely_required', 'Seattle: sleeping → zoning likely_required');
const seaTrailer = engine.evaluate(pod({ on_trailer: true }), sea, opts);
assert(seaTrailer.permits.building_permit === 'depends', 'Seattle: trailer → building depends');

/* San Jose — Title 24; wired-voids-exemption; Gary Deng plumbing A/B (record 2026-121660-RS). */
const sj = jur('ca-santa-clara-san-jose');
const sjTwelve = engine.evaluate(pod(), sj, opts);
assert(
  sjTwelve.permits.building_permit === 'likely_required',
  'San Jose: even the Twelve needs a permit (exemption requires no electrical wiring)'
);
assert(sjTwelve.energy_compliance.code === 'Title 24', 'San Jose: Title 24 energy line');
const sjA = engine.evaluate(pod({ model: 'sixteen', footprint_sqft: 160 }), sj, opts);
const sjB = engine.evaluate(pod({ model: 'sixteen', footprint_sqft: 160, plumbing: 'full_bath' }), sj, opts);
assert(sjA.permits.plumbing_permit === 'not_applicable', 'San Jose A/B: no-plumbing pod → plumbing not_applicable');
assert(sjB.permits.plumbing_permit === 'likely_required', 'San Jose A/B: 3/4-bath pod → plumbing likely_required');
assert(
  JSON.stringify(sjA.permits) !== JSON.stringify(sjB.permits),
  'San Jose A/B: plumbing changes the output (Gary Deng validation case)'
);
assert(
  engine.evaluate(pod({ model: 'sixteen', footprint_sqft: 160 }), sj, opts).foundation_requirement.note.indexOf('slab is not enough') !== -1,
  'San Jose: permitted CA build warns slab is not enough'
);

/* Del Mar — coastal overlay; Title 24; design review means zoning always in play. */
const dm = jur('ca-san-diego-del-mar');
const dmTwelve = engine.evaluate(pod(), dm, opts);
assert(dmTwelve.permits.building_permit === 'depends', 'Del Mar: Twelve building → depends (safe-error posture)');
assert(dmTwelve.permits.zoning_review === 'likely_required', 'Del Mar: zoning review likely_required even under 120 (design review + coastal)');
assert(
  engine.evaluate(pod({ model: 'station', footprint_sqft: 300 }), dm, opts).permits.building_permit === 'likely_required',
  'Del Mar: Station building → likely_required'
);
assert(dm.zoning_note.toLowerCase().indexOf('coastal') !== -1, 'Del Mar: coastal overlay documented in zoning note');
assert(dmTwelve.energy_compliance.code === 'Title 24', 'Del Mar: Title 24 energy line');

/* Unincorporated King County — conditioned pods are never exempt (the headline). */
const kc = jur('wa-king-unincorporated');
const kcTwelve = engine.evaluate(pod(), kc, opts);
assert(
  kcTwelve.permits.building_permit === 'likely_required',
  'King County: conditioned Twelve → building likely_required (exemption requires unconditioned)'
);
assert(kcTwelve.energy_compliance.code === 'WSEC', 'King County: WSEC energy line');
assert(
  engine.evaluate(pod({ model: 'station', footprint_sqft: 300 }), kc, opts).permits.zoning_review === 'likely_required',
  'King County: Station (over 200) → zoning review likely_required'
);
const kcTrailer = engine.evaluate(pod({ on_trailer: true }), kc, opts);
assert(kcTrailer.permits.electrical_permit === 'likely_required', 'King County: trailer still needs L&I electrical permit');

/* Unincorporated LA County — under-120 shipped as depends; over-120 required. */
const la = jur('ca-los-angeles-unincorporated');
const laTwelve = engine.evaluate(pod(), la, opts);
assert(laTwelve.permits.building_permit === 'depends', 'LA County: Twelve building → depends (safe-error posture)');
assert(laTwelve.permits.electrical_permit === 'likely_required', 'LA County: 50A inlet → electrical likely_required');
assert(laTwelve.permits.zoning_review === 'likely_required', 'LA County: Title 22 zoning applies regardless of exemption');
assert(
  engine.evaluate(pod({ model: 'sixteen', footprint_sqft: 160 }), la, opts).permits.building_permit === 'likely_required',
  'LA County: Sixteen building → likely_required'
);
assert(laTwelve.energy_compliance.code === 'Title 24', 'LA County: Title 24 energy line');

/* ════ Summary ═════════════════════════════════════════════════════ */
console.log('\n' + passed + ' passed, ' + failed + ' failed (' + (passed + failed) + ' assertions)');
if (failed > 0) process.exit(1);
