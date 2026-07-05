# Phase A — Address Search + Construction Requirements (Design)

**Date:** 2026-07-05 · **Status:** Approved by Fred · **Scope:** permitting-engine module

## Goal

Turn the internal permitting triage tool from "pick a jurisdiction from a dropdown" into
"type the customer's address" (the first step toward a canibuild-style product), and add a
**construction requirements** section so results cover not just *whether* a permit is needed
but *what the location demands of the build* (insulation, footing depth, snow load, etc.).

## Decisions locked during brainstorming

| Decision | Choice |
|---|---|
| Audience | Internal reps now; structured to become client-facing later (Phase D) |
| Geocoder | US Census Bureau geocoder — free, no API key, returns county + incorporated place in one call |
| CORS reality | Census sends no `Access-Control-Allow-Origin` (verified 2026-07-05), so the browser cannot call it directly → thin Netlify function proxy |
| Lookup failure | Existing jurisdiction dropdown stays as a manual fallback; rep is never blocked |
| Map | None in Phase A — text-only match confirmation. Parcel/imagery view is Phase B |
| Requirements depth | Cited plain-English guidance notes (not structured spec values) |
| Requirements bundling | Schema + engine + UI ship in Phase A with empty lists; a follow-on research pass fills the five Tier 1 jurisdictions |
| External services | None paid. No canibuild involvement — this is a self-built rebuild |

## Architecture

Vanilla HTML/CSS/JS on Netlify, unchanged. New/modified pieces:

| File | Change |
|---|---|
| `netlify/functions/geocode.js` | **New.** Proxy: address string → Census `geocoder/geographies/onelineaddress` (benchmark `Public_AR_Current`, vintage `Current_Current`, layers `Counties,Incorporated Places`) → trimmed JSON: `{ matched_address, coords: {lat, lon}, state, county_geoid, county_name, place_geoid, place_name }`. `place_*` is null when the point is outside any incorporated place. 8s upstream timeout. |
| `netlify.toml` | **New.** Functions dir + publish dir. Local dev: `netlify dev` (replaces `npx serve`). |
| `resolver.js` | **New.** Pure module (UMD like `engine.js`, no DOM/network): `resolve(geocodeResult, jurisdictions)` → `{ jurisdictionId, matchedAddress, coords }` or `{ jurisdictionId: null, ... }`. |
| `data/jurisdictions.json` | Each entry gains a `geo` block (below) and a `construction_requirements` array (empty for now). Product-default untouched. |
| `engine.js` | Output gains `construction_requirements` (verified + unverified buckets, or the not-researched / product-default fallback lines). |
| `index.html` / `app.js` / `styles.css` | Address input + Search above the config form; "Matched: …" confirmation line; dropdown collapses to "or pick manually"; new "Building requirements" section in the result. |
| `tests/engine.test.js` (+ `tests/resolver.test.js`) | Resolver fixture tests + engine requirements tests. Existing 213 assertions stay green. |

## Resolution rules (correctness core)

Matching is **by Census GEOID, never by name string**.

```json
"geo": { "place_geoid": "5363000" }                          // city entry (Seattle)
"geo": { "county_geoid": "53033", "unincorporated": true }   // county entry
```

| Census result | Resolves to |
|---|---|
| `place_geoid` matches a KB city entry | That city entry |
| No incorporated place, `county_geoid` matches an unincorporated KB entry | That county entry |
| Incorporated place with no KB entry (e.g., Bellevue) | **null → product-default.** Never falls through to the county's unincorporated entry |
| No county match either | null → product-default |
| No address match / API error | UI error + manual dropdown |

Census may return multiple candidate matches; take the first, but always render the
`matched_address` so a wrong match is visible, not silent. A successful lookup auto-selects
the jurisdiction dropdown; the rep can override manually at any time.

## Construction requirements (data model v0.3)

Per jurisdiction:

```json
"construction_requirements": [
  {
    "id": "seattle-ceiling-insulation",
    "category": "insulation | foundation | snow_load | wind | seismic | energy | other",
    "requirement": "Plain-English requirement, e.g. R-49 ceiling insulation per 2021 Seattle Energy Code (zone 4C).",
    "citation": { "code_section": "", "title": "", "url": "", "snippet": "" },
    "confidence": "high | medium | low"
  }
]
```

Rendering rules (same guardrails as permits):

- Complete citation → renders in **Building requirements** with citation + confidence.
- Incomplete/`<<verify>>` citation → renders in a separate **"Unverified — confirm with the office"** bucket; never as a clean claim.
- Empty/absent array on a researched entry → "Construction requirements not yet researched for this jurisdiction."
- Product-default coverage → generic line: requirements like insulation depth, footing depth, and snow load vary by climate — "we'll confirm your city."
- The existing `energy_compliance` derived line stays as-is, rendered alongside.

Requirements are jurisdiction-wide notes in v1 (no `when` conditions). If config-dependent
requirements emerge during research, that's a v2 schema decision.

## Error handling

- Census timeout/5xx → function returns 502 with `{ error }` → UI: "Couldn't look up that
  address — pick the jurisdiction manually," dropdown expanded.
- Census 200 with zero `addressMatches` → "No match for that address — check it or pick manually."
- Function unreachable (local `npx serve` without `netlify dev`) → same UI path as timeout.

## Testing

- `resolver.js`: fixture Census responses checked in under `tests/fixtures/` — Seattle hit,
  unincorporated King County hit, unknown incorporated place (Bellevue) → null,
  zero-match response, malformed response. No network in unit tests.
- `engine.js`: requirements rendering — cited, uncited (bucket split), empty list,
  product-default fallback.
- The existing draft-status assertion and all 213 current assertions unchanged.
- Manual smoke: `netlify dev`, real lookups for one address per Tier 1 jurisdiction +
  one Bellevue address + one rural WA address.

## Out of scope (later phases)

- Parcel boundaries, aerial imagery, map UI (Phase B)
- Setback data / buildable envelope / pod placement (Phase C)
- Site plan export, client-facing mode, Readiness Assessment Step 5 integration (Phase D)
- Autocomplete-as-you-type (client-facing phase; Census has no autocomplete)
- Researching the Tier 1 construction requirements (follow-on research pass, same
  archive-and-cite workflow as `research/`)

## Non-negotiables carried forward

Guidance-not-verdict postures; everything dated and cited; safe-error bias; no invented
rules; drafts stay `draft` until Fred + Urbatec verify. The address layer changes *how a
jurisdiction is selected*, never *what the engine claims*.
