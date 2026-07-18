/*
 * Unit tests for the plain-English summary module (client-facing view) and the
 * send-details function's validation paths.
 * Run: node permitting-engine/tests/summary.test.js
 * No test framework — plain assertions with a pass/fail counter.
 */

'use strict';

const path = require('path');
const fs = require('fs');

const engine = require(path.join(__dirname, '..', 'engine.js'));
const summary = require(path.join(__dirname, '..', 'summary.js'));
const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'data', 'jurisdictions.json'), 'utf8')
);

const opts = { productDefault: data.product_default, today: '2026-07-08' };

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

/* ════ 1. TONE GUARDRAILS ═════════════════════════════════════════ */

/* A draft jurisdiction with likely_required permits must read amber, never green. */
const seattleOut = engine.evaluate(pod({ model: 'sixteen', footprint_sqft: 160 }), jur('wa-king-seattle'), opts);
const seattleSum = summary.summarize(seattleOut);
assert(seattleSum.tone === 'amber', 'draft + likely_required → amber tone');
assert(/permits are likely/i.test(seattleSum.headline), 'likely_required headline says permits are likely');

/* All-depends result (trailer) → amber "quick check" headline, still not green. */
const trailerOut = engine.evaluate(pod({ on_trailer: true }), jur('wa-king-seattle'), opts);
const trailerSum = summary.summarize(trailerOut);
assert(trailerSum.tone === 'amber', 'all-depends → amber tone');
assert(/quick check/i.test(trailerSum.headline), 'all-depends headline asks for a quick check');

/* Green is reserved for VERIFIED + nothing likely/depends. Synthetic verified fixture. */
const verifiedExemptJur = {
  id: 'test-verified',
  name: 'Testville',
  state: 'WA',
  status: 'verified',
  last_verified: '2026-07-01',
  rules: [
    {
      id: 'all-exempt',
      when: { footprint: 'any', plumbing: 'any', on_trailer: 'any', sleeping: 'any' },
      result: {
        building_permit: 'likely_exempt',
        electrical_permit: 'likely_exempt',
        plumbing_permit: 'not_applicable',
        zoning_review: 'likely_exempt',
      },
      citation: { code_section: 'TMC 1.1', title: 'Test', url: 'https://example.gov', snippet: 'x' },
      confidence: 'high',
    },
  ],
};
const greenSum = summary.summarize(engine.evaluate(pod(), verifiedExemptJur, opts));
assert(greenSum.tone === 'green', 'verified + all exempt → green tone');
assert(/confirmation/i.test(greenSum.subline), 'green subline still recommends confirming');

/* Same rules but status draft → citation stays, but draft coverage must never be green
   unless nothing is likely/depends; exempt-only draft IS still green-eligible? No —
   draft downgrade only applies to incomplete citations. Assert the actual guardrail:
   tone is green only when coverage === verified. */
const draftExemptJur = Object.assign({}, verifiedExemptJur, { status: 'draft' });
const draftSum = summary.summarize(engine.evaluate(pod(), draftExemptJur, opts));
assert(draftSum.tone === 'amber', 'draft coverage never renders the green headline');

/* Product default (unknown jurisdiction) → amber. */
const pdSum = summary.summarize(engine.evaluate(pod(), null, opts));
assert(pdSum.tone === 'amber', 'product default → amber tone');

/* ════ 2. ROW TRANSLATION ═════════════════════════════════════════ */

/* not_applicable permits are dropped from the rows. */
assert(
  seattleSum.rows.every((r) => r.key !== 'plumbing_permit'),
  'not_applicable plumbing produces no row'
);
assert(
  seattleSum.rows.some((r) => r.key === 'electrical_permit' && r.status === 'likely'),
  'likely_required electrical → "likely" row'
);
/* Every row has a plain-English sentence, no raw posture values. */
assert(
  seattleSum.rows.every((r) => r.text && !/likely_required|depends|not_applicable/.test(r.text)),
  'row text never leaks raw posture identifiers'
);

/* Plumbed config → plumbing row appears. */
const plumbedSum = summary.summarize(
  engine.evaluate(pod({ plumbing: 'full_bath' }), jur('wa-king-seattle'), opts)
);
assert(
  plumbedSum.rows.some((r) => r.key === 'plumbing_permit'),
  'plumbed config produces a plumbing row'
);

/* ════ 3. EXTRA LINES + PASSTHROUGH ═══════════════════════════════ */

assert(
  seattleSum.extra_lines.some((l) => /WSEC/.test(l)),
  'WA energy line mentions WSEC'
);
assert(
  seattleSum.extra_lines.some((l) => /footings/i.test(l)),
  'footings line present when building permit likely'
);
assert(seattleSum.disclaimer === seattleOut.disclaimer, 'disclaimer passes through untouched');
assert(seattleSum.package_cta === true, 'package CTA flag passes through');
assert(/final say/i.test(seattleSum.final_say_line), 'final-say line present');

/* Trailer-mounted → foundation not_applicable → no foundation extra line. */
assert(
  !trailerSum.extra_lines.some((l) => /footings|slab/i.test(l)),
  'trailer config produces no foundation line'
);

/* ════ 4. BRIEF (one-paragraph client answer) ═════════════════════ */

assert(typeof seattleSum.brief === 'string' && seattleSum.brief.length > 0, 'brief: present');
assert(/expect/i.test(seattleSum.brief), 'brief: likely items phrased as "expect"');
assert(/building permit/.test(seattleSum.brief), 'brief: names the building permit');
assert(/electrical sign-off/.test(seattleSum.brief), 'brief: names the electrical sign-off');
assert(/energy report \(WSEC\)/.test(seattleSum.brief), 'brief: folds in the WA energy report');
assert(
  !/likely_required|depends|not_applicable/.test(seattleSum.brief),
  'brief: never leaks raw posture identifiers'
);
/* All-depends (trailer) brief reads as a quick look, not a demand. */
assert(/quick look/i.test(trailerSum.brief), 'brief: all-depends phrased as a quick look');
/* Verified all-exempt brief stays cautious. */
assert(/recommend a quick confirmation/i.test(greenSum.brief), 'brief: green still recommends confirming');

/* ════ 5. REPORT RENDERER (shared email/download HTML) ════════════ */

const reportMod = require(path.join(__dirname, '..', 'report.js'));
const seattleReport = reportMod.render(seattleOut, seattleSum, '600 4th Ave, Seattle, WA');
assert(/Permits at a glance/.test(seattleReport), 'report: permits table present');
assert(/Building requirements/.test(seattleReport), 'report: requirements section present');
assert(/R-60/.test(seattleReport), 'report: renders researched requirement values');
assert(/Citations/.test(seattleReport), 'report: citations section present');
assert(/600 4th Ave, Seattle, WA/.test(seattleReport), 'report: echoes the address');
assert(/general guidance/.test(seattleReport), 'report: disclaimer present');
assert(/<script/i.test(reportMod.render(
  Object.assign({}, seattleOut, { jurisdiction: '<script>alert(1)</script>' }),
  seattleSum, null
)) === false, 'report: escapes HTML in data fields');

/* ════ 6. SEND-DETAILS FUNCTION (validation paths, no network) ════ */

const sendDetails = require(path.join(__dirname, '..', 'netlify', 'functions', 'send-details.js'));

function post(body) {
  return sendDetails.handler({ httpMethod: 'POST', body: JSON.stringify(body) });
}

(async function () {
  const savedKey = process.env.RESEND_API_KEY;
  delete process.env.RESEND_API_KEY;

  let res = await sendDetails.handler({ httpMethod: 'GET', body: null });
  assert(res.statusCode === 405, 'send-details: GET → 405');

  res = await post({ email: 'not-an-email', jurisdiction_id: 'wa-king-seattle', pod_config: pod() });
  assert(res.statusCode === 400, 'send-details: bad email → 400');

  res = await post({ email: 'a@b.co', jurisdiction_id: 'wa-king-seattle', pod_config: { model: 'nope' } });
  assert(res.statusCode === 400, 'send-details: bad pod config → 400');

  res = await post({ email: 'a@b.co', jurisdiction_id: 'wa-king-seattle', pod_config: pod() });
  assert(res.statusCode === 503, 'send-details: no RESEND_API_KEY → 503 with clear error');
  assert(/RESEND_API_KEY/.test(JSON.parse(res.body).error), 'send-details: 503 names the missing key');

  if (savedKey) process.env.RESEND_API_KEY = savedKey;

  console.log('\nsummary tests: ' + passed + ' passed, ' + failed + ' failed');
  if (failed > 0) process.exit(1);
})();
