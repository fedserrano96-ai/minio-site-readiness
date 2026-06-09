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

## Running it

- **Tests:** `node permitting-engine/tests/engine.test.js`
- **UI:** serve the folder over HTTP (the data file is fetched, so `file://` won't work),
  e.g. `npx serve permitting-engine` or any static server, then open `index.html`.

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
data file ships as `verified`.
