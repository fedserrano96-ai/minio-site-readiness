# Phase A — Address Search + Construction Requirements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace dropdown-only jurisdiction selection with address search (Census geocoder → GEOID-based resolution), and add a cited `construction_requirements` section to the data model, engine output, and result UI.

**Architecture:** A thin Netlify function proxies the free US Census geocoder (which sends no CORS headers). A new pure module `resolver.js` (UMD, like `engine.js`) parses the Census response and maps place/county GEOIDs to `jurisdictions.json` entries. The engine gains a `construction_requirements` output assembled with the same citation-downgrade guardrails as permits. The UI adds an address bar; the dropdown remains as a manual fallback.

**Tech Stack:** Vanilla JS (ES5 style, UMD modules), Netlify Functions (Node 18+, global `fetch`), plain-Node assertion tests (no framework), Census Bureau geocoder API (free, keyless).

**Spec:** `docs/superpowers/specs/2026-07-05-phase-a-address-search-design.md`

**Working directory for all commands:** `permitting-engine/` inside the `Readiness Assessment` git repo (repo root is the parent). All `git` commands run fine from the subfolder.

**Verified GEOIDs (from live Census API, 2026-07-05):**

| Jurisdiction | geo block |
|---|---|
| `wa-king-seattle` | `{ "place_geoid": "5363000" }` |
| `ca-santa-clara-san-jose` | `{ "place_geoid": "0668000" }` |
| `ca-san-diego-del-mar` | `{ "place_geoid": "0618506" }` |
| `wa-king-unincorporated` | `{ "county_geoid": "53033", "unincorporated": true }` |
| `ca-los-angeles-unincorporated` | `{ "county_geoid": "06037", "unincorporated": true }` |

---

### Task 1: `geo` blocks in jurisdictions.json + data invariants

**Files:**
- Modify: `data/jurisdictions.json` (each of the 5 jurisdiction entries + the `template` object)
- Test: `tests/engine.test.js` (data-file invariants section)

- [ ] **Step 1: Write the failing invariant tests**

In `tests/engine.test.js`, find the section-2 header comment (`/* ════ 2. DATA-FILE INVARIANTS`) and add at the END of that section (before section 3's header):

```js
/* geo blocks: every researched entry must be resolvable from a Census result */
data.jurisdictions.forEach((j) => {
  const geo = j.geo || {};
  const isPlace = typeof geo.place_geoid === 'string' && /^\d{7}$/.test(geo.place_geoid);
  const isCounty =
    typeof geo.county_geoid === 'string' &&
    /^\d{5}$/.test(geo.county_geoid) &&
    geo.unincorporated === true;
  assert(isPlace || isCounty, j.id + ': geo block has a 7-digit place_geoid or a 5-digit unincorporated county_geoid');
  assert(!(isPlace && geo.unincorporated), j.id + ': place entries must not claim unincorporated');
});
const geoKeys = data.jurisdictions.map((j) => ((j.geo || {}).place_geoid || (j.geo || {}).county_geoid || j.id));
assert(new Set(geoKeys).size === geoKeys.length, 'geo GEOIDs are unique across jurisdictions');
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tests/engine.test.js`
Expected: FAIL lines for each of the 5 jurisdictions ("geo block has a 7-digit place_geoid..."), summary shows 5+ failures, exit code 1.

- [ ] **Step 3: Add geo blocks to the data file**

In `data/jurisdictions.json`, add a `geo` property to each jurisdiction entry, directly after its `"state"` line (values from the table above). Example for Seattle:

```json
      "state": "WA",
      "geo": { "place_geoid": "5363000" },
```

For the two county entries:

```json
      "state": "WA",
      "geo": { "county_geoid": "53033", "unincorporated": true },
```

```json
      "state": "CA",
      "geo": { "county_geoid": "06037", "unincorporated": true },
```

Also add to the `template` object (so future research includes it), after its `"state"` line:

```json
    "geo": { "place_geoid": "", "county_geoid": "", "unincorporated": false },
```

Note: the invariant test iterates `data.jurisdictions` only, so the template's empty geo doesn't trip it. Bump the top-level `"version"` from `"0.2"` to `"0.3"`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/engine.test.js`
Expected: `0 failed` in the summary line (213 existing assertions + the new geo assertions; the exact total isn't load-bearing, zero failures is).

- [ ] **Step 5: Commit**

```bash
git add data/jurisdictions.json tests/engine.test.js
git commit -m "feat: geo blocks (Census GEOIDs) on jurisdiction entries + invariants"
```

---

### Task 2: `resolver.js` — pure Census-response parser + jurisdiction resolver

**Files:**
- Create: `resolver.js`
- Create: `tests/fixtures/census-seattle.json`, `tests/fixtures/census-unincorporated-king.json`, `tests/fixtures/census-bellevue.json`, `tests/fixtures/census-no-match.json`, `tests/fixtures/census-malformed.json`
- Create: `tests/resolver.test.js`

- [ ] **Step 1: Create the fixtures**

Fixtures are trimmed real-shaped Census `geocoder/geographies/onelineaddress` responses — only the fields the parser reads.

`tests/fixtures/census-seattle.json`:

```json
{
  "result": {
    "addressMatches": [
      {
        "matchedAddress": "600 4TH AVE, SEATTLE, WA, 98104",
        "coordinates": { "x": -122.330270920928, "y": 47.603314311191 },
        "geographies": {
          "Incorporated Places": [
            { "GEOID": "5363000", "BASENAME": "Seattle", "NAME": "Seattle city", "STATE": "53" }
          ],
          "Counties": [
            { "GEOID": "53033", "BASENAME": "King", "NAME": "King County", "STATE": "53" }
          ]
        }
      }
    ]
  }
}
```

`tests/fixtures/census-unincorporated-king.json` (note: NO `Incorporated Places` key at all — Census omits the layer when the point is outside any incorporated place; the parser must treat missing and empty the same):

```json
{
  "result": {
    "addressMatches": [
      {
        "matchedAddress": "17705 VASHON HWY SW, VASHON, WA, 98070",
        "coordinates": { "x": -122.459815, "y": 47.447212 },
        "geographies": {
          "Counties": [
            { "GEOID": "53033", "BASENAME": "King", "NAME": "King County", "STATE": "53" }
          ]
        }
      }
    ]
  }
}
```

`tests/fixtures/census-bellevue.json` (an incorporated city with no KB entry — GEOID just needs to not match any KB geo block):

```json
{
  "result": {
    "addressMatches": [
      {
        "matchedAddress": "450 110TH AVE NE, BELLEVUE, WA, 98004",
        "coordinates": { "x": -122.191667, "y": 47.615278 },
        "geographies": {
          "Incorporated Places": [
            { "GEOID": "5305210", "BASENAME": "Bellevue", "NAME": "Bellevue city", "STATE": "53" }
          ],
          "Counties": [
            { "GEOID": "53033", "BASENAME": "King", "NAME": "King County", "STATE": "53" }
          ]
        }
      }
    ]
  }
}
```

`tests/fixtures/census-no-match.json`:

```json
{ "result": { "addressMatches": [] } }
```

`tests/fixtures/census-malformed.json`:

```json
{ "unexpected": "shape" }
```

- [ ] **Step 2: Write the failing tests**

Create `tests/resolver.test.js`:

```js
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
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `node tests/resolver.test.js`
Expected: FAIL — `Cannot find module '.../resolver.js'` (crash before any assertion).

- [ ] **Step 4: Implement `resolver.js`**

Create `resolver.js` (UMD wrapper identical in style to `engine.js`):

```js
/*
 * Mini·O Permitting Triage — address → jurisdiction resolution.
 * Pure functions, no DOM, no network. Runs in Node (tests, Netlify function)
 * and the browser (UI).
 *
 * parseCensusResponse(raw): trims a raw Census geocoder "geographies" response
 * down to the fields we use. Returns null when there is no usable match.
 *
 * resolve(parsed, jurisdictions): maps a parsed result to a KB entry by GEOID.
 * Correctness rule: an address inside an incorporated place with no KB entry
 * resolves to null (product-default) — it NEVER falls through to the county's
 * unincorporated entry.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.PermittingResolver = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function parseCensusResponse(raw) {
    var matches = raw && raw.result && raw.result.addressMatches;
    if (!Array.isArray(matches) || matches.length === 0) return null;
    var m = matches[0] || {};
    var geos = m.geographies || {};
    var county = (geos['Counties'] || [])[0] || null;
    var place = (geos['Incorporated Places'] || [])[0] || null;
    return {
      matched_address: m.matchedAddress || '',
      coords: m.coordinates ? { lat: m.coordinates.y, lon: m.coordinates.x } : null,
      state_fips: county ? county.STATE || null : null,
      county_geoid: county ? county.GEOID || null : null,
      county_name: county ? county.BASENAME || null : null,
      place_geoid: place ? place.GEOID || null : null,
      place_name: place ? place.BASENAME || null : null,
    };
  }

  function resolve(parsed, jurisdictions) {
    var out = {
      jurisdictionId: null,
      matchedAddress: parsed ? parsed.matched_address : null,
      coords: parsed ? parsed.coords : null,
    };
    if (!parsed || !Array.isArray(jurisdictions)) return out;
    var match = null;
    if (parsed.place_geoid) {
      match = jurisdictions.find(function (j) {
        return j.geo && j.geo.place_geoid === parsed.place_geoid;
      }) || null;
      /* Unresearched incorporated place: fall to product-default, not the county. */
    } else if (parsed.county_geoid) {
      match = jurisdictions.find(function (j) {
        return j.geo && j.geo.unincorporated === true && j.geo.county_geoid === parsed.county_geoid;
      }) || null;
    }
    if (match) out.jurisdictionId = match.id;
    return out;
  }

  return {
    parseCensusResponse: parseCensusResponse,
    resolve: resolve,
  };
});
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `node tests/resolver.test.js`
Expected: `25 passed, 0 failed (25 assertions)` — exact count as printed; zero failures is the requirement.
Also run: `node tests/engine.test.js` — still zero failures.

- [ ] **Step 6: Commit**

```bash
git add resolver.js tests/resolver.test.js tests/fixtures/
git commit -m "feat: resolver.js — Census response parsing + GEOID jurisdiction resolution"
```

---

### Task 3: Engine `construction_requirements` output

**Files:**
- Modify: `engine.js`
- Test: `tests/engine.test.js` (section 1, synthetic fixtures)

- [ ] **Step 1: Write the failing tests**

In `tests/engine.test.js`, add at the END of section 1 (just before the section-2 header comment):

```js
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

const pdReqOut = engine.evaluate(pod(), null, opts);
assert(pdReqOut.construction_requirements.status === 'product_default', 'requirements: product default status');
assert(/vary by climate/i.test(pdReqOut.construction_requirements.note), 'requirements: product-default generic note');
assert(pdReqOut.construction_requirements.verified.length === 0, 'requirements: product default lists nothing');
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node tests/engine.test.js`
Expected: FAIL — crashes with `TypeError: Cannot read properties of undefined (reading 'status')` (the output has no `construction_requirements` yet), or FAIL lines if it survives. Either counts as the expected failure.

- [ ] **Step 3: Implement in `engine.js`**

Add these constants after `TRAILER_NOTE` (around line 56):

```js
  var REQUIREMENTS_NOT_RESEARCHED_NOTE =
    'Construction requirements not yet researched for this jurisdiction.';

  var REQUIREMENTS_PRODUCT_DEFAULT_NOTE =
    'Requirements like insulation depth, footing depth, and snow load vary by climate and ' +
    'city — we’ll confirm what applies to your specific location.';
```

Add this function after `foundationRequirement` (around line 195):

```js
  /*
   * Construction requirements (data model v0.3): cited plain-English guidance
   * notes per jurisdiction. Same guardrail as permits: an incomplete citation
   * moves the item to the "unverified" bucket (and its citation is never
   * rendered); it can never appear as a clean claim.
   */
  function buildConstructionRequirements(jurisdiction, coverage) {
    if (coverage === 'product_default') {
      return { status: 'product_default', verified: [], unverified: [], note: REQUIREMENTS_PRODUCT_DEFAULT_NOTE };
    }
    var list = (jurisdiction && jurisdiction.construction_requirements) || [];
    if (!list.length) {
      return { status: 'not_researched', verified: [], unverified: [], note: REQUIREMENTS_NOT_RESEARCHED_NOTE };
    }
    var verified = [];
    var unverified = [];
    list.forEach(function (req) {
      if (citationComplete(req.citation)) {
        verified.push({
          id: req.id,
          category: req.category,
          requirement: req.requirement,
          citation: req.citation,
          confidence: req.confidence || 'low',
        });
      } else {
        unverified.push({ id: req.id, category: req.category, requirement: req.requirement });
      }
    });
    return { status: 'listed', verified: verified, unverified: unverified, note: null };
  }
```

In the `evaluate` return object, add directly after the `foundation_requirement` entry:

```js
      construction_requirements: buildConstructionRequirements(
        coverage === 'product_default' ? null : jurisdiction,
        coverage
      ),
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node tests/engine.test.js && node tests/resolver.test.js`
Expected: both suites print `... 0 failed ...`.

- [ ] **Step 5: Commit**

```bash
git add engine.js tests/engine.test.js
git commit -m "feat: construction_requirements engine output with citation buckets"
```

---

### Task 4: Netlify function + netlify.toml

**Files:**
- Create: `netlify/functions/geocode.js`
- Create: `netlify.toml`

No unit test — the function is a thin pipe over `resolver.parseCensusResponse` (already tested). Verified by the manual smoke test in Task 6.

- [ ] **Step 1: Create `netlify/functions/geocode.js`**

```js
/*
 * GET /.netlify/functions/geocode?address=<oneline address>
 *
 * Proxies the free US Census geocoder (which sends no CORS headers, so the
 * browser can't call it directly). No API key. Returns:
 *   200 { result: <parsed> }   — parsed is null when Census found no match
 *   400 { error }              — missing address param
 *   502 { error }              — Census unreachable, non-200, or >8s
 */

'use strict';

const resolver = require('../../resolver.js');

const CENSUS_URL = 'https://geocoding.geo.census.gov/geocoder/geographies/onelineaddress';
const TIMEOUT_MS = 8000;

exports.handler = async function (event) {
  const params = event.queryStringParameters || {};
  const address = (params.address || '').trim();
  if (!address) {
    return json(400, { error: 'Missing address parameter.' });
  }

  const url =
    CENSUS_URL +
    '?address=' + encodeURIComponent(address) +
    '&benchmark=Public_AR_Current&vintage=Current_Current' +
    '&layers=' + encodeURIComponent('Counties,Incorporated Places') +
    '&format=json';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      return json(502, { error: 'Census geocoder returned ' + res.status + '.' });
    }
    const raw = await res.json();
    return json(200, { result: resolver.parseCensusResponse(raw) });
  } catch (err) {
    return json(502, { error: 'Census geocoder unreachable or timed out.' });
  } finally {
    clearTimeout(timer);
  }
};

function json(statusCode, body) {
  return {
    statusCode,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  };
}
```

- [ ] **Step 2: Create `netlify.toml`**

```toml
# Netlify config for the permitting-engine module.
# Local dev: npx netlify-cli@latest dev   (serves static files + functions)
# NOTE: if this module deploys as part of a Netlify site rooted at the parent
# Readiness Assessment repo, set that site's base to permitting-engine/ (or
# replicate these paths in the root config) — deploy wiring is decided at
# integration time, not in Phase A.

[build]
  publish = "."

[functions]
  directory = "netlify/functions"
```

- [ ] **Step 3: Sanity-check the function loads and rejects a missing address (no network)**

Run:

```bash
node -e "require('./netlify/functions/geocode.js').handler({ queryStringParameters: {} }).then(r => console.log(r.statusCode, r.body))"
```

Expected: `400 {"error":"Missing address parameter."}`

- [ ] **Step 4: Live one-shot check (network — Census must be reachable)**

Run:

```bash
node -e "require('./netlify/functions/geocode.js').handler({ queryStringParameters: { address: '600 4th Ave, Seattle, WA' } }).then(r => console.log(r.statusCode, r.body))"
```

Expected: `200` and a body whose `result.place_geoid` is `"5363000"`.

- [ ] **Step 5: Commit**

```bash
git add netlify/functions/geocode.js netlify.toml
git commit -m "feat: Netlify geocode function proxying the Census geocoder"
```

---

### Task 5: UI — address bar, matched line, requirements section

**Files:**
- Modify: `index.html`
- Modify: `app.js`
- Modify: `styles.css`

No unit tests (UI glue only — all logic lives in tested modules). Verified by Task 6's smoke test.

- [ ] **Step 1: index.html — address field, collapsible manual picker, resolver script**

Replace the existing Jurisdiction field block:

```html
      <label class="field">
        <span class="field-label">Jurisdiction</span>
        <select id="jurisdiction"></select>
      </label>
```

with:

```html
      <div class="field">
        <span class="field-label">Property address</span>
        <div class="address-row">
          <input type="text" id="address" placeholder="600 4th Ave, Seattle, WA" autocomplete="street-address">
          <button id="address-search" class="btn-search" type="button">Find</button>
        </div>
        <div id="address-status" class="address-status" hidden></div>
      </div>

      <details id="manual-pick" class="manual-pick">
        <summary>or pick the jurisdiction manually</summary>
        <label class="field">
          <span class="field-label">Jurisdiction</span>
          <select id="jurisdiction"></select>
        </label>
      </details>
```

And add the resolver script before `app.js`:

```html
  <script src="engine.js"></script>
  <script src="resolver.js"></script>
  <script src="app.js"></script>
```

- [ ] **Step 2: app.js — lookup handler + requirements rendering**

Add to the `el` map:

```js
    address: document.getElementById('address'),
    addressSearch: document.getElementById('address-search'),
    addressStatus: document.getElementById('address-status'),
    manualPick: document.getElementById('manual-pick'),
```

Add after `PERMIT_LABELS`:

```js
  var CATEGORY_LABELS = {
    insulation: 'Insulation',
    foundation: 'Foundation',
    snow_load: 'Snow load',
    wind: 'Wind',
    seismic: 'Seismic',
    energy: 'Energy',
    other: 'Other',
  };
```

Add these functions after `currentJurisdiction()`:

```js
  function setAddressStatus(message, kind) {
    el.addressStatus.hidden = false;
    el.addressStatus.className = 'address-status address-status-' + kind;
    el.addressStatus.textContent = message;
  }

  function jurisdictionLabel(j) {
    return j.name + ', ' + (j.county ? j.county + ' County, ' : '') + j.state + ' [' + j.status + ']';
  }

  function onAddressSearch() {
    if (!data) return;
    var address = el.address.value.trim();
    if (!address) {
      setAddressStatus('Type an address first.', 'error');
      return;
    }
    setAddressStatus('Looking up address…', 'pending');
    fetch('/.netlify/functions/geocode?address=' + encodeURIComponent(address))
      .then(function (res) {
        if (!res.ok) throw new Error('geocode ' + res.status);
        return res.json();
      })
      .then(function (json) {
        if (!json.result) {
          setAddressStatus('No match for that address — check it or pick the jurisdiction manually below.', 'error');
          el.manualPick.open = true;
          return;
        }
        var resolved = window.PermittingResolver.resolve(json.result, data.jurisdictions);
        if (resolved.jurisdictionId) {
          el.jurisdiction.value = resolved.jurisdictionId;
          var j = data.jurisdictions.find(function (x) { return x.id === resolved.jurisdictionId; });
          setAddressStatus('Matched: ' + resolved.matchedAddress + ' → ' + jurisdictionLabel(j), 'ok');
        } else {
          el.jurisdiction.value = '__other';
          setAddressStatus(
            'Matched: ' + resolved.matchedAddress + ' → not yet researched. Using generic product guidance — we’ll confirm this city.',
            'warn'
          );
        }
        onEvaluate();
      })
      .catch(function () {
        setAddressStatus('Couldn’t look up that address — pick the jurisdiction manually below.', 'error');
        el.manualPick.open = true;
      });
  }
```

Wire the events next to the existing listeners at the bottom:

```js
  el.addressSearch.addEventListener('click', onAddressSearch);
  el.address.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') onAddressSearch();
  });
```

In `render(out)`, add a Building requirements section directly after the Notes `section-block` and before the Citations block:

```js
    var reqs = out.construction_requirements;
    html += '<div class="section-block"><h3>Building requirements</h3>';
    if (reqs.status === 'listed') {
      if (reqs.verified.length) {
        html += '<ul>';
        reqs.verified.forEach(function (r) {
          html += '<li><strong>' + esc(CATEGORY_LABELS[r.category] || r.category) + ':</strong> ' +
            esc(r.requirement) +
            ' <span class="req-cite">(' + esc(r.citation.code_section) +
            ', confidence: ' + esc(r.confidence) + ')</span></li>';
        });
        html += '</ul>';
      }
      if (reqs.unverified.length) {
        html += '<p class="req-unverified-head">Unverified — confirm with the office:</p><ul class="req-unverified">';
        reqs.unverified.forEach(function (r) {
          html += '<li><strong>' + esc(CATEGORY_LABELS[r.category] || r.category) + ':</strong> ' +
            esc(r.requirement) + '</li>';
        });
        html += '</ul>';
      }
    } else {
      html += '<p>' + esc(reqs.note) + '</p>';
    }
    html += '</div>';
```

- [ ] **Step 3: styles.css — additions**

Append (adjust colors to match the existing palette in the file — read it before editing; the class names are the contract, the exact colors are not):

```css
/* Address search (Phase A) */
.address-row { display: flex; gap: 8px; }
.address-row input { flex: 1; }
.btn-search { white-space: nowrap; }

.address-status { margin-top: 6px; font-size: 0.85rem; padding: 6px 8px; border-radius: 4px; }
.address-status-pending { background: #f0f0f0; color: #555; }
.address-status-ok { background: #e6f4ea; color: #1e6b34; }
.address-status-warn { background: #fdf3dc; color: #8a6100; }
.address-status-error { background: #fdecea; color: #a4272c; }

.manual-pick summary { cursor: pointer; font-size: 0.85rem; color: #666; margin: 8px 0; }

.req-cite { color: #666; font-size: 0.85em; }
.req-unverified-head { font-weight: 600; margin-bottom: 4px; }
.req-unverified { opacity: 0.85; }
```

- [ ] **Step 4: Quick render check without functions (static server)**

Run: `npx serve . -l 3999` and open `http://localhost:3999`.
Expected: page renders; picking "Seattle … [draft]" from the manual picker and clicking Evaluate shows the result INCLUDING a "Building requirements" section reading "Construction requirements not yet researched for this jurisdiction." Address search will show the error path here (functions aren't served) — that error path rendering IS part of the check: it must show the red status and pop the manual picker open, not break the page. Stop the server after.

- [ ] **Step 5: Commit**

```bash
git add index.html app.js styles.css
git commit -m "feat: address search UI with manual fallback + building requirements section"
```

---

### Task 6: Smoke test via netlify dev, README update, final commit

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Full test suites green**

Run: `node tests/engine.test.js && node tests/resolver.test.js`
Expected: both `0 failed`.

- [ ] **Step 2: Manual smoke test with real lookups**

Run: `npx netlify-cli@latest dev` from `permitting-engine/` (first run downloads the CLI; no login needed for local dev; it reads `netlify.toml` and serves static files + the function). Open the printed URL (default `http://localhost:8888`). Then verify each row:

| Address typed | Expected match line | Expected jurisdiction |
|---|---|---|
| `600 4th Ave, Seattle, WA` | Matched → Seattle, King County, WA [draft] | `wa-king-seattle` |
| `200 E Santa Clara St, San Jose, CA` | Matched → San Jose … [draft] | `ca-santa-clara-san-jose` |
| `1050 Camino del Mar, Del Mar, CA` | Matched → Del Mar … [draft] | `ca-san-diego-del-mar` |
| `17705 Vashon Hwy SW, Vashon, WA` | Matched → unincorporated King County entry | `wa-king-unincorporated` |
| `450 110th Ave NE, Bellevue, WA` | Matched → **not yet researched** (product default) | dropdown shows "Other / not listed" |
| `asdfasdf` | No match error, manual picker opens | unchanged |

Each successful lookup should auto-evaluate and render the result, including the "Building requirements … not yet researched" line for the five drafts and the generic climate line for Bellevue. For the LA County row there's no reliable well-known unincorporated street address to hardcode — verify it via the manual dropdown instead, and note that a future research pass can add a known-good test address.

- [ ] **Step 3: Update README.md**

Apply these changes:

1. In the Files table, add rows:

```markdown
| `resolver.js` | Pure `parseCensusResponse(raw)` + `resolve(parsed, jurisdictions)` — maps a Census geocoder result to a KB entry by GEOID. No DOM, no network. |
| `netlify/functions/geocode.js` | Proxy for the free Census geocoder (it sends no CORS headers). No API key. |
| `tests/resolver.test.js` | Resolver suite against fixture Census responses in `tests/fixtures/`. Run: `node tests/resolver.test.js`. |
```

2. Replace the "Running it" section body with:

```markdown
- **Tests:** `node permitting-engine/tests/engine.test.js && node permitting-engine/tests/resolver.test.js`
- **UI (full, with address search):** `npx netlify-cli@latest dev` from `permitting-engine/` — serves the
  static app plus the geocode function at `http://localhost:8888`.
- **UI (static only):** any static server still works (`npx serve permitting-engine`), but address
  lookups will show the fallback error and the manual jurisdiction picker.
```

3. Add a new section after the "v0.2 data model changes" section:

```markdown
## v0.3 data model changes (Phase A)

1. **`geo` block per jurisdiction** — Census GEOIDs used for address resolution:
   `{ "place_geoid": "5363000" }` for cities, `{ "county_geoid": "53033", "unincorporated": true }`
   for unincorporated county entries. Matching is by GEOID, never by name. An address inside an
   incorporated city with no KB entry resolves to product-default — never to the county entry.
2. **`construction_requirements` per jurisdiction** — cited plain-English guidance notes
   (insulation, foundation/frost depth, snow load, …). Same citation guardrail as permits:
   incomplete citations render in an "unverified — confirm with the office" bucket. All five
   Tier 1 entries currently ship empty lists ("not yet researched") pending a research pass.
```

- [ ] **Step 4: Final commit**

```bash
git add README.md
git commit -m "docs: Phase A — address search + construction requirements in README"
```

---

## Out of scope reminders (do not build)

- No map, no parcel data, no autocomplete (Phases B–D).
- No researching actual construction requirements — that's a follow-on research pass using the existing `research/` workflow.
- Do not touch the Readiness Assessment app outside `permitting-engine/`.
- Do not flip any jurisdiction to `verified` (a test enforces this).
