# CLAUDE.md — Mini·O Permitting Triage Engine

## How to use this file
1. Put this file and `permitting_engine_data_model.md` in the repo root (or in the permitting module folder of the Readiness Assessment repo).
2. Open Claude Code in that repo.
3. Paste the "First prompt" below to start. Everything else here is standing context Claude Code should follow throughout.

### First prompt to paste into Claude Code
> Read CLAUDE.md and permitting_engine_data_model.md in full. Then inspect this repo and tell me how the existing Readiness Assessment tool is structured, especially the Step 5 permitting/HOA step. Do not write any feature code yet. Propose a plan for Phase 1 (the standalone engine scaffold described in CLAUDE.md), confirm the file layout you intend to create, and wait for my go-ahead before building.

---

## What we are building
An internal sales-enablement permitting triage engine. A rep selects a pod configuration and a location; the tool returns the *likely* permitting posture (likely exempt / likely required / depends) per permit type, with a citation, a confidence level, a dated disclaimer, and a prompt to sell Mini·O's paid permitting package. It is **triage, not a legal verdict.** V1 is internal-facing. Later it plugs into the existing Readiness Assessment tool's permitting step for a client-facing, guidance-only version.

## Stack and where it lives
- Vanilla HTML/CSS/JS. No framework. Matches the existing Readiness Assessment tool.
- Deploys on Netlify. Any API keys stay server-side via Netlify functions, never in client code.
- The jurisdiction knowledge base is a **JSON file in the repo** (version-controlled, diffable, re-verified quarterly). Do not put it in a database for V1.
- Build the engine **standalone first** in its own folder. Do NOT modify the Readiness Assessment flow yet. Integration into Step 5 is a later phase, only after the standalone engine is validated.

## Non-negotiable guardrails (do not violate without asking Fred)
- **Guidance, never a verdict.** Every outcome is `likely_exempt`, `likely_required`, or `depends`. Never output a flat yes/no.
- **Everything is dated and cited.** No determination renders without a citation and a `last_verified` date. If a rule has no citation, it must surface as `depends` with a "confirm with the office" note.
- **Graceful degradation.** A jurisdiction with `status: not_researched` returns the generic product-default logic plus "we'll confirm your specific city," and still shows the permitting-package CTA. The tool must be useful with only a few jurisdictions loaded.
- **Bias to the safe error.** When uncertain, lean toward "a permit is likely, and we handle it," never toward "you're exempt." Telling someone they're exempt when they weren't is the costly mistake.
- **No invented rules.** The engine only renders what's in the JSON. It never guesses a jurisdiction's rule. Drafts are produced by research and verified by Fred and Urbatec before they're marked `verified`.

## Domain facts to bake in
- Three pod size tiers straddling the common 120 sqft accessory-structure line: **Twelve = 12×8 = 96 sqft** (under), **Sixteen = 16×10 = 160 sqft** (over), **Station = 30×10 = 300 sqft** (well over). Custom sizes set their own footprint, so footprint must be a numeric input, not just a model name.
- **Plumbing** (half bath, kitchenette, full bath) is a major escalator; it tends to reclassify the pod toward a dwelling unit (DADU), which triggers full residential code.
- **Energy code is a required deliverable for conditioned pods:** California → Title 24 energy report; Washington → WSEC (Washington State Energy Code) report. Treat this as its own output line, not part of the building permit.
- **Foundation differs for permitted vs unpermitted builds.** For permitted CA projects, a plain slab is not enough; footings are required for code compliance and city approval. The tool must not tell a permitting customer a bare slab is fine.
- **Trailer-mounted** units may fall outside "structure" rules in some jurisdictions. First-class option, not an edge case.
- **Config changes after a permit set is underway force a restart** (size change, window removal, etc.). The output should encourage locking the config before permitting.
- All pods use a standardized SS2-50R 50A twist-lock inlet regardless of actual draw.

## Data model
Defined in full in `permitting_engine_data_model.md`. Three objects: a **pod config** (input), a **jurisdiction record** (KB entry), and **rules** (condition → per-permit outcome). The engine matches a config to the most specific rule in the matched jurisdiction and assembles the output. Add two fields to the model as you scaffold: an `energy_compliance` output line (Title 24 / WSEC) and a `foundation_requirement` flag (permitted vs unpermitted).

## Build sequence
- **Phase 1 (start here): standalone engine scaffold.**
  - `data/jurisdictions.json` seeded with the Seattle draft entry (outcomes still marked `<<verify>>`) plus the blank template from the spec.
  - `engine.js`: a pure function `evaluate(podConfig, jurisdiction)` that returns the output object. Most-specific-rule-wins matching. Fully unit-testable, no DOM.
  - A minimal internal UI: config selector (model/footprint, plumbing, trailer, sleeping) + jurisdiction picker, rendering the output with posture, citations, the dated disclaimer, and the package CTA. Plain and functional, not polished.
  - Handle the `not_researched` path (product-default output).
- **Phase 2:** populate the priority jurisdictions (research + Fred/Urbatec verification) and expand tests.
- **Phase 3:** wire the validated engine into the Readiness Assessment Step 5 as the guidance-only client-facing version.

## Seed and priority jurisdictions
Tier 1 (build/verify first), anchored on live permits we can validate against:
- **Seattle, King County WA** — live permit (Anna Chen). Tests the WA / WSEC path.
- **San Jose, Santa Clara County CA** — live permit (Gary Deng), record 2026-121660-RS. Tests CA / Title 24 and the plumbing A/B (one pod no plumbing, one with 3/4 bath).
- **Del Mar, San Diego County CA** — live permit (Htut Zaw), coastal-zone overlay possible.
- Unincorporated King County and unincorporated LA County.

Tier 2: City of LA, Bellevue, Tacoma, San Diego, Oakland, Portland, Orange County cities. Everything else: `not_researched` until added.

## A second workstream (separate from the app build)
Populating the JSON is research, not coding. It can run as its own Claude Code task: a script that, given a jurisdiction and its official source URLs, fetches the pages and drafts a schema-shaped entry with citations and confidence, for Fred to verify. Keep this strictly producing **drafts** (`status: draft`), never `verified`. Ask Fred before building this; the app scaffold comes first.
