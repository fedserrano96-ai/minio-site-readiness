# Mini·O Permitting Triage Engine — Phase 1 scaffold

Internal sales-enablement tool: pick a pod configuration and a jurisdiction, get the
*likely* permitting posture per permit type with citations, confidence, a dated
disclaimer, and the permitting-package CTA. **Triage, not a legal verdict.**

Standing context lives in [CLAUDE.md](CLAUDE.md) (guardrails, build sequence) and
[permitting_engine_data_model.md](permitting_engine_data_model.md) (v0.1 schema).
This README documents what the scaffold adds on top of the v0.1 spec.

## Files

| File | What it is |
|---|---|
| `engine.js` | Pure `evaluate(podConfig, jurisdiction, opts)` — no DOM, runs in Node and the browser. Most-specific-rule-wins matching; ties broken by higher confidence, then file order. |
| `data/jurisdictions.json` | The knowledge base: Seattle draft entry (`<<verify>>` citations), the product-default rule set, and the blank template from the spec. |
| `index.html` / `styles.css` / `app.js` | Minimal internal UI: config selector + jurisdiction picker → rendered result. |
| `tests/engine.test.js` | Plain-Node assertion suite (no framework). Run: `node tests/engine.test.js`. |
| `resolver.js` | Pure `parseCensusResponse(raw)` + `resolve(parsed, jurisdictions)` — maps a Census geocoder result to a KB entry by GEOID. No DOM, no network. |
| `netlify/functions/geocode.js` | Proxy for the free Census geocoder (it sends no CORS headers). No API key. |
| `tests/resolver.test.js` | Resolver suite against fixture Census responses in `tests/fixtures/`. Run: `node tests/resolver.test.js`. |
| `summary.js` | Pure `summarize(evaluateOutput)` — translates an engine result into the plain-English client view (headline, one-paragraph `brief`, status rows). Enforces the safe-error tone: the green "likely no permits" headline only renders for a `verified` entry with nothing likely/depends. |
| `report.js` | Pure `render(out, quick, address)` — the full technical report as inline-styled HTML, shared by the email function and the client's in-page "view & save" view so both stay identical. |
| `client.html` / `client.css` / `client.js` | Client-facing "quick answer" page: address search → friendly pod picker → a 2-sentence brief + package CTA. The full report (permits table, requirements, citations) is one tap away: emailed, or shown in-page print-ready (browser print → save as PDF). |
| `netlify/functions/send-details.js` | POST endpoint behind the email CTA. Re-runs the engine server-side (never trusts client-rendered results) and emails the full report via the Resend API. Requires `RESEND_API_KEY` (and optional `SEND_DETAILS_FROM`); returns a clear 503 until it's set. |
| `tests/summary.test.js` | Summary-tone guardrail tests, brief/report rendering tests, and send-details validation paths. Run: `node tests/summary.test.js`. |
| `research/fetch-sources.js` | Fetches and archives official source pages per jurisdiction (no rule interpretation). `node fetch-sources.js <id> --from-data` re-fetches every URL cited in the data file — used for quarterly re-verification diffs. |
| `research/sources/<id>/` | Raw snapshots of every cited official page, with a manifest (URL, fetch date, HTTP status). Every citation in the data file traces to a snapshot here. |
| `research/REVIEW.md` | The Tier 1 review sheet for Fred + Urbatec: per-jurisdiction findings, editorial downgrades, open `<<verify>>` items, and live-permit validation anchors. |

## Running it

- **Tests:** `node permitting-engine/tests/engine.test.js && node permitting-engine/tests/resolver.test.js`
- **UI (full, with address search):** from the repo root run `npx netlify-cli@latest dev` — the parent
  site's config serves this folder at `http://localhost:8888/permitting-engine/` and the geocode function
  via the root shim (`netlify/functions/geocode.js` re-exports this module's function). To serve this
  folder standalone instead: `npx netlify-cli@latest dev -d permitting-engine -f permitting-engine/netlify/functions`.
- **UI (static only):** any static server still works (`npx serve permitting-engine`), but address
  lookups will show the fallback error and the manual jurisdiction picker.

## v0.2 data model changes (added per CLAUDE.md)

Two output lines beyond the v0.1 spec, both assembled by the engine (not stored per rule):

1. **`energy_compliance`** — its own line, separate from the building permit. Derived from
   the jurisdiction's state: `CA` → Title 24 energy report (`likely_required`), `WA` → WSEC
   report (`likely_required`), anything else → `depends` ("we'll confirm"). All pods are
   treated as conditioned.
2. **`foundation_requirement`** — permitted vs unpermitted paths differ:
   - building permit `likely_required` → `footings_likely_required` (in CA the note says
     explicitly that a plain slab is not enough);
   - building permit `depends` → `depends` (never promises a bare slab is fine);
   - building permit `likely_exempt` (cited) → `standard_ok`;
   - trailer-mounted → `not_applicable`.

The output also carries a `config_lock_note` (config changes after a permit set is underway
force a restart) whenever any permit is in play, and a trailer classification note when
`on_trailer` is set.

## v0.3 data model changes (Phase A)

1. **`geo` block per jurisdiction** — Census GEOIDs used for address resolution:
   `{ "place_geoid": "5363000" }` for cities, `{ "county_geoid": "53033", "unincorporated": true }`
   for unincorporated county entries. Matching is by GEOID, never by name. An address inside an
   incorporated city with no KB entry resolves to product-default — never to the county entry.
2. **`construction_requirements` per jurisdiction** — cited plain-English guidance notes
   (insulation, foundation/frost depth, snow load, …). Same citation guardrail as permits:
   incomplete citations render in an "unverified — confirm with the office" bucket. All five
   Tier 1 entries currently ship empty lists ("not yet researched") pending a research pass.

## Citation-downgrade behavior

Per the "everything is dated and cited" guardrail: when the winning rule's citation is
incomplete — empty fields or `<<verify>>` placeholders — every determination in it other
than `not_applicable` and `depends` is **downgraded to `depends`** at render time, with a
"confirm with the office" note and a `downgraded: [{permit, from, to}]` record in the
output. Incomplete citations are never rendered in the citations list.

Practical effect: draft entries with `<<verify>>` citations (like the seeded Seattle one)
render conservatively until Phase 2 research fills in real citations, and an uncited
`likely_exempt` can never reach a rep's screen.

## Product-default path (graceful degradation)

Unknown jurisdictions and `status: not_researched` entries evaluate against the
`product_default` rule set in `data/jurisdictions.json`: generic product logic keyed on the
120 sqft line, plumbing, and sleeping use. It never outputs `likely_exempt` (bias to the
safe error), always shows the package CTA, and labels the result "we'll confirm your
specific city."

## Status workflow (non-negotiable)

Every entry produced by research stays `status: "draft"`. Only Fred flips an entry to
`verified`, after review with Urbatec. The test suite asserts that no jurisdiction in the
data file ships as `verified` (update that assertion when Fred verifies the first entry —
it exists to stop research from shipping verified status, not Fred).

## Jurisdiction entries also carry a `research` block

Phase 2 added a non-schema `research` object to each jurisdiction (date, method, source
URLs, caveats). The engine ignores it; it exists for provenance and quarterly
re-verification. Entries researched 2026-06-09 cover the five Tier 1 jurisdictions:
Seattle, San Jose, Del Mar, unincorporated King County, unincorporated LA County.
