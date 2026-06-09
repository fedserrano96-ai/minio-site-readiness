/*
 * Unit tests for the Mini·O Permitting Triage Engine.
 * Run: node permitting-engine/tests/engine.test.js
 * No test framework — plain assertions with a pass/fail counter.
 */

'use strict';

const path = require('path');
const fs = require('fs');

const engine = require(path.join(__dirname, '..', 'engine.js'));
const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'jurisdictions.json'), 'utf8')
);

const seattle = data.jurisdictions.find((j) => j.id === 'wa-king-seattle');
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

/* ── Footprint resolution ─────────────────────────────────────────── */
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

/* ── Rule matching ────────────────────────────────────────────────── */
const underRule = seattle.rules.find((r) => r.id === 'seattle-accessory-under-120-no-plumbing');
const overRule = seattle.rules.find((r) => r.id === 'seattle-accessory-over-120');
const plumbingRule = seattle.rules.find((r) => r.id === 'seattle-any-plumbing');
const trailerRule = seattle.rules.find((r) => r.id === 'seattle-on-trailer');

assert(engine.ruleMatches(underRule, pod()), 'under-120 rule matches a Twelve, no plumbing');
assert(
  !engine.ruleMatches(underRule, pod({ model: 'sixteen', footprint_sqft: 160 })),
  'under-120 rule rejects a Sixteen'
);
assert(
  !engine.ruleMatches(underRule, pod({ plumbing: 'half_bath' })),
  'under-120 rule rejects plumbing'
);
assert(
  !engine.ruleMatches(underRule, pod({ sleeping_intended: true })),
  'under-120 rule rejects sleeping (sleeping: false is a condition)'
);
assert(
  engine.ruleMatches(overRule, pod({ model: 'sixteen', footprint_sqft: 160 })),
  'over-120 rule matches a Sixteen'
);
assert(
  engine.ruleMatches(plumbingRule, pod({ plumbing: 'full_bath' })),
  'plumbing rule matches full bath'
);
assert(engine.ruleMatches(trailerRule, pod({ on_trailer: true })), 'trailer rule matches on_trailer');
assert(!engine.ruleMatches(trailerRule, pod()), 'trailer rule rejects ground-mounted');

/* ── Specificity and selection ────────────────────────────────────── */
assert(engine.ruleSpecificity(underRule) === 3, 'under-120 rule specificity is 3');
assert(engine.ruleSpecificity(overRule) === 1, 'over-120 rule specificity is 1');
assert(engine.ruleSpecificity(plumbingRule) === 1, 'plumbing rule specificity is 1');

const sel1 = engine.selectRule(seattle.rules, pod());
assert(sel1 && sel1.id === 'seattle-accessory-under-120-no-plumbing', 'Twelve selects under-120 rule');

/* Sixteen + half bath matches both over-120 (spec 1, low) and plumbing (spec 1, medium):
   tie on specificity → higher confidence wins. */
const sel2 = engine.selectRule(seattle.rules, pod({ model: 'sixteen', footprint_sqft: 160, plumbing: 'half_bath' }));
assert(sel2 && sel2.id === 'seattle-any-plumbing', 'specificity tie broken by higher confidence');

const sel3 = engine.selectRule(seattle.rules, pod({ on_trailer: true }));
assert(
  sel3 && sel3.id === 'seattle-accessory-under-120-no-plumbing',
  'most specific rule wins over trailer rule for small no-plumbing pod'
);

assert(engine.selectRule([], pod()) === null, 'no rules → null selection');

/* ── Citation completeness ────────────────────────────────────────── */
assert(!engine.citationComplete(underRule.citation), '<<verify>> citation is incomplete');
assert(!engine.citationComplete(null), 'missing citation is incomplete');
assert(
  engine.citationComplete({
    code_section: 'SMC 22.x',
    title: 'Tip sheet',
    url: 'https://example.gov',
    snippet: 'short paraphrase',
  }),
  'fully filled citation is complete'
);

/* ── Citation downgrade behavior ──────────────────────────────────── */
const out1 = engine.evaluate(pod(), seattle, opts);
assert(
  out1.permits.building_permit === 'depends',
  'uncited likely_exempt downgrades to depends (never render uncited exemption)'
);
assert(out1.permits.plumbing_permit === 'not_applicable', 'not_applicable survives downgrade');
assert(out1.downgraded.length > 0, 'downgrade is reported in output');
assert(
  out1.downgraded.some((d) => d.permit === 'building_permit' && d.from === 'likely_exempt'),
  'downgrade records original posture'
);
assert(
  out1.notes.some((n) => n.indexOf('confirm with the office') !== -1),
  'downgrade adds confirm-with-the-office note'
);
assert(out1.citations.length === 0, 'incomplete citations are not rendered as citations');

/* Verified citation renders without downgrade. */
const verifiedSeattle = JSON.parse(JSON.stringify(seattle));
verifiedSeattle.status = 'verified';
verifiedSeattle.last_verified = '2026-06-01';
verifiedSeattle.rules.forEach((r) => {
  r.citation = {
    code_section: 'SMC test',
    title: 'Test title',
    url: 'https://example.gov/test',
    snippet: 'test snippet',
  };
});
const out2 = engine.evaluate(pod(), verifiedSeattle, opts);
assert(out2.permits.building_permit === 'likely_exempt', 'cited likely_exempt renders as-is');
assert(out2.downgraded.length === 0, 'no downgrades when citation is complete');
assert(out2.citations.length === 1, 'complete citation is rendered');
assert(out2.coverage === 'verified', 'verified status → verified coverage');
assert(out2.verified_as_of === '2026-06-01', 'verified_as_of comes from last_verified');
assert(
  out2.disclaimer.indexOf('2026-06-01') !== -1,
  'disclaimer is dated with last_verified when available'
);

/* ── Draft coverage ───────────────────────────────────────────────── */
assert(out1.coverage === 'draft', 'draft status → draft coverage');
assert(out1.verified_as_of === null, 'draft with empty last_verified has no verified_as_of');
assert(out1.disclaimer.indexOf('2026-06-09') !== -1, 'disclaimer falls back to today');

/* ── Posture vocabulary invariant (guidance, never a verdict) ─────── */
const configs = [
  pod(),
  pod({ model: 'sixteen', footprint_sqft: 160 }),
  pod({ model: 'station', footprint_sqft: 300, plumbing: 'full_bath', sleeping_intended: true }),
  pod({ on_trailer: true }),
  pod({ plumbing: 'kitchenette' }),
];
let vocabOk = true;
configs.forEach((c) => {
  [engine.evaluate(c, seattle, opts), engine.evaluate(c, null, opts)].forEach((out) => {
    Object.values(out.permits).forEach((v) => {
      if (engine.POSTURES.indexOf(v) === -1) vocabOk = false;
    });
  });
});
assert(vocabOk, 'all outcomes use the allowed posture vocabulary — never yes/no');

/* ── not_researched / product default path ────────────────────────── */
const out3 = engine.evaluate(pod(), null, opts);
assert(out3.coverage === 'product_default', 'unknown jurisdiction → product_default coverage');
assert(out3.package_cta === true, 'product default still shows the package CTA');
assert(
  out3.permits.building_permit === 'depends',
  'product default never says likely_exempt for building permit'
);
assert(
  out3.jurisdiction.indexOf('not yet researched') !== -1,
  'product default labels jurisdiction as not researched'
);

const notResearched = { id: 'xx-test', name: 'Testville', state: 'TX', status: 'not_researched', rules: [] };
const out4 = engine.evaluate(pod(), notResearched, opts);
assert(out4.coverage === 'product_default', 'not_researched status → product_default coverage');

/* Product default never outputs likely_exempt for any config. */
let noExempt = true;
configs.forEach((c) => {
  const out = engine.evaluate(c, null, opts);
  Object.values(out.permits).forEach((v) => {
    if (v === 'likely_exempt') noExempt = false;
  });
});
assert(noExempt, 'product default outputs contain no likely_exempt (bias to the safe error)');

const out5 = engine.evaluate(pod({ model: 'sixteen', footprint_sqft: 160 }), null, opts);
assert(
  out5.permits.building_permit === 'likely_required',
  'product default: over 120 sqft → building permit likely_required'
);
const out6 = engine.evaluate(pod({ plumbing: 'full_bath' }), null, opts);
assert(
  out6.permits.plumbing_permit === 'likely_required',
  'product default: plumbing → plumbing permit likely_required'
);

/* ── Energy compliance (v0.2) ─────────────────────────────────────── */
const outWA = engine.evaluate(pod(), seattle, opts);
assert(outWA.energy_compliance.code === 'WSEC', 'WA jurisdiction → WSEC energy line');
assert(
  outWA.energy_compliance.posture === 'likely_required',
  'WSEC report is likely_required for conditioned pods'
);
const caJur = { id: 'ca-test', name: 'TestCity', county: 'Santa Clara', state: 'CA', status: 'draft', rules: seattle.rules };
const outCA = engine.evaluate(pod(), caJur, opts);
assert(outCA.energy_compliance.code === 'Title 24', 'CA jurisdiction → Title 24 energy line');
const outUnknown = engine.evaluate(pod(), null, opts);
assert(outUnknown.energy_compliance.posture === 'depends', 'unknown state → energy compliance depends');

/* ── Foundation requirement (v0.2) ────────────────────────────────── */
const outFoundCA = engine.evaluate(pod({ model: 'sixteen', footprint_sqft: 160 }), Object.assign({}, caJur, { status: 'verified', rules: verifiedSeattle.rules }), opts);
assert(
  outFoundCA.foundation_requirement.posture === 'footings_likely_required',
  'permitted build → footings likely required'
);
assert(
  outFoundCA.foundation_requirement.note.indexOf('slab is not enough') !== -1,
  'CA permitted build warns a plain slab is not enough'
);
const outFoundTrailer = engine.evaluate(pod({ on_trailer: true }), seattle, opts);
assert(
  outFoundTrailer.foundation_requirement.posture === 'not_applicable',
  'trailer-mounted → foundation not applicable'
);
const outFoundExempt = engine.evaluate(pod(), verifiedSeattle, opts);
assert(
  outFoundExempt.foundation_requirement.posture === 'standard_ok',
  'cited exempt path → standard slab ok'
);
const outFoundDepends = engine.evaluate(pod(), seattle, opts);
assert(
  outFoundDepends.foundation_requirement.posture === 'depends',
  'building permit depends → foundation depends (no bare-slab promise)'
);

/* ── CTA, config lock, trailer note, disclaimer ───────────────────── */
assert(out1.package_cta === true, 'any depends/required outcome → package CTA shown');
assert(out1.config_lock_note !== null, 'config lock reminder shown when permits in play');
const outTrailer = engine.evaluate(pod({ on_trailer: true }), seattle, opts);
assert(
  outTrailer.notes.some((n) => n.indexOf('vehicle/RV') !== -1),
  'trailer config adds the vehicle/RV classification note'
);
assert(out1.disclaimer.indexOf('not a permitting determination') !== -1, 'disclaimer text present');
assert(out1.hoa_note.indexOf('HOA') !== -1, 'HOA note present');
assert(out3.next_step.questions.length >= 2, 'next_step includes questions to ask the office');

/* ── Purity: evaluate must not mutate its inputs ──────────────────── */
const podBefore = JSON.stringify(pod());
const jurBefore = JSON.stringify(seattle);
const p = pod();
engine.evaluate(p, seattle, opts);
assert(JSON.stringify(p) === podBefore, 'evaluate does not mutate the pod config');
assert(JSON.stringify(seattle) === jurBefore, 'evaluate does not mutate the jurisdiction');

/* ── Data file sanity ─────────────────────────────────────────────── */
assert(
  data.jurisdictions.every((j) => j.status !== 'verified'),
  'no jurisdiction ships as verified without Fred'
);
assert(data.template && data.template.status === 'draft', 'blank template present with draft status');
assert(data.product_default.rules.length >= 3, 'product default rule set is populated');

/* ── Summary ──────────────────────────────────────────────────────── */
console.log('\n' + passed + ' passed, ' + failed + ' failed (' + (passed + failed) + ' assertions)');
if (failed > 0) process.exit(1);
