# Readiness Assessment Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace everything after the yard planner with one screen: a live recommendation card (delivery method, base and cost ranges) on top and one question at a time below, plus lead capture to Airtable and two printable contractor spec sheets.

**Architecture:** New code is TypeScript in `src/`, bundled by esbuild into `build/` and loaded by `index.html`. The pure core (`src/assessment/core/`) holds the questions, rules, pricing data and location lookup, and is covered by unit tests. The UI layer (`src/assessment/ui/`) renders the card and the questions into a new panel. The existing inline script keeps the planner and hands it off through `window.MiniOAssessment`. The Netlify `submit` function becomes TypeScript and creates or updates one Airtable record per session.

**Tech Stack:** TypeScript 5, esbuild, Vitest 2 with jsdom, Netlify Functions (TypeScript), Airtable REST API. npm.

**Spec:** `docs/superpowers/specs/2026-10-28-readiness-assessment-overhaul-design.md`. Read it first. Section numbers (§) below refer to it.

## Global Constraints

- Package manager: npm. New code: TypeScript only. Don't touch `permitting-engine/`.
- Raise errors explicitly. Don't add fallbacks the spec doesn't list. The only fallback is the lead form's "Continue without saving" link (§7).
- The sheet's internal per-mile rates and ops formulas must never appear in shipped code (§4). Only the figures in spec §8 and Appendix A go in.
- Copy says "Mini·O arranges a local contractor", never that Mini·O does site work (§4).
- Lead times are phrased "about N weeks after we receive payment", never as a date (§4).
- The card never shows a pod price or grand total. The cost line is "Delivery and site prep: $X – $Y" (§5.3).
- Leads go only to Airtable base `appj87SHEgZafCMC2`, table `Submissions`. No email is sent to the client (§7).
- CTA URLs: `https://minioffice.co/quote` (Design my pod), `https://minioffice.co/lets-talk` (Let's talk), same tab.
- sessionStorage key: `minio-assessment-v2`.
- Netlify keeps Node 18 (`netlify.toml`). Pick dependency majors that support Node 18: `typescript@^5.6`, `esbuild@^0.24`, `vitest@^2.1`, `jsdom@^25`. If one of these ranges doesn't install, stop and report. Don't pick another major without asking.
- The yard planner changes only as Task 10 says: handoff, restore, setback removal, toast text.

## Review Focus

1. **Coming back from the configurator.** Browser Back or a reload on screen 2 must land on screen 2 at the same question, with the same answers and the same Airtable record ID, so the next button press updates the record instead of creating a duplicate. Tested in Task 9 (`restores screen 2 and record id from storage`).
2. **Double-clicking a CTA.** Two quick clicks must send one request, not two (no duplicate leads). Tested in Task 9 (`ignores a second click while a submit is in flight`).
3. **ZIP typed loosely**, e.g. `" 98101-1234 "` or a lowercase Canadian code `"v6b 1a1"`, must be accepted. Tested in Task 3 (`accepts ZIP+4, spaces and lowercase postal codes`).
4. **Going back to the planner and changing the model or placement** must re-run screen 2 with the new snapshot while keeping the answers, and must clear any "Switch to the Sixteen" override. Tested in Task 9 (`start with a new snapshot keeps answers and clears the model override`).
5. **Airtable rejects a submission** (for example a field Fred hasn't created yet, Airtable 422). The client must see the error with Try again, and the function must return Airtable's message, not a generic 500. Tested in Task 7 (`returns Airtable's error message and status`).

---

## File map

| File | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `vitest.config.ts` | Tooling (Task 1) |
| `src/assessment/core/types.ts` | Shared types: the contract between every module (Task 2) |
| `src/assessment/core/data.ts` | Model facts, regional prices, lead times (Task 2) |
| `src/assessment/core/shipping.ts` | Appendix A shipping table (Task 2) |
| `src/assessment/core/location.ts` | ZIP/postal code → Location (Task 3) |
| `src/assessment/core/questions.ts` | Question order and when each is asked (Task 4) |
| `src/assessment/core/rules.ts` | `recommend()`, `minClearance()` (Task 4) |
| `src/assessment/core/pricing.ts` | `priceRecommendation()`, `leadTime()` (Task 5) |
| `src/assessment/ui/copy.ts` | All client-facing text keyed by codes (Task 6) |
| `src/assessment/ui/card.ts` | Recommendation card + mobile bar (Task 6) |
| `netlify/functions/submit.ts`, `src/server/airtable-fields.ts` | Lead submission (Task 7) |
| `src/assessment/ui/question-view.ts`, `src/assessment/ui/drawings.ts` | One-question view, SVG drawings (Task 8) |
| `src/assessment/ui/app.ts`, `src/assessment/ui/lead-form.ts`, `src/assessment/ui/print.ts` | App state, persistence, CTAs, lead form, print summary (Task 9) |
| `src/assessment/main.ts`, `src/assessment/styles.css` | Bundle entry, `window.MiniOAssessment` (Task 9) |
| `index.html` | Strip old steps, add panel and handoff, remove setback (Task 10) |
| `contractor/base.html`, `contractor/power.html`, `src/specs/main.ts`, `src/specs/values.ts` | Contractor spec sheets (Task 11) |
| `tests/**` | One test file per module, named in each task |

---

### Task 0: Branch

- [ ] **Step 1:** `git checkout -b readiness-overhaul` from `main`. Expected: `Switched to a new branch 'readiness-overhaul'`.

### Task 1: Tooling

**Files:**
- Modify: `package.json` (currently only name/version/engines), `.gitignore`, `netlify.toml`
- Create: `tsconfig.json`, `vitest.config.ts`, `tests/smoke.test.ts`, `src/assessment/main.ts` (placeholder export), `src/specs/main.ts` (placeholder)

**Interfaces:**
- Produces: `npm test` (vitest run), `npm run check` (`tsc --noEmit`), `npm run build` (check + esbuild → `build/assessment/main.js`, `build/assessment/main.css`, `build/specs/main.js`).

- [ ] **Step 1:** `npm install -D typescript@^5.6 esbuild@^0.24 vitest@^2.1 jsdom@^25`. Expected: `package-lock.json` created, no errors.
- [ ] **Step 2:** Add scripts to `package.json`:
  - `"test": "vitest run"`
  - `"check": "tsc --noEmit"`
  - `"build": "npm run check && esbuild src/assessment/main.ts src/specs/main.ts --bundle --format=iife --target=es2019 --outbase=src --outdir=build --minify --loader:.svg=text"`
- [ ] **Step 3:** Create `tsconfig.json`: `strict: true`, `noEmit: true`, `target: ES2019`, `module: ESNext`, `moduleResolution: Bundler`, `lib: ["ES2020","DOM"]`, `include: ["src","tests","netlify/functions"]`. Create `vitest.config.ts` with `test.include: ['tests/**/*.test.ts']` (default environment node; UI test files opt into jsdom with `// @vitest-environment jsdom`).
- [ ] **Step 4:** Write `tests/smoke.test.ts` asserting `1 + 1 === 2`. Run `npm test`. Expected: 1 passed.
- [ ] **Step 5:** Run `npm run build`. Expected: `build/assessment/main.js` and `build/specs/main.js` exist.
- [ ] **Step 6:** `.gitignore`: add `build/`. `netlify.toml` `[build] command`: prepend `npm run build && ` and append ` docs tests node_modules` to the existing `rm -rf …` list. Add a comment: Netlify installs dependencies itself before the command, and `node_modules` is removed so it isn't published (functions have no npm runtime dependencies). Keep everything else in `netlify.toml` unchanged.
- [ ] **Step 7:** Delete `tests/smoke.test.ts`. Commit: `chore: add TypeScript, esbuild and Vitest tooling`.

### Task 2: Types and price data

**Files:**
- Create: `src/assessment/core/types.ts`, `src/assessment/core/data.ts`, `src/assessment/core/shipping.ts`
- Test: `tests/core/data.test.ts`

**Interfaces — Produces** (`types.ts`, exactly):

```ts
export type ModelId = 'twelve' | 'sixteen' | 'station';
export type PodUse = 'office' | 'studio' | 'guest' | 'other';
export interface YardObject { type: string; x: number; y: number; w: number; h: number } // x,y = centre, feet
export interface PlannerSnapshot {
  model: ModelId; rotation: 0 | 90; yardW: number; yardD: number;
  podX: number; podY: number; // pod centre, feet
  podUse: PodUse; objects: YardObject[];
}
export type Band = 'lt25' | '25to50' | '50to100' | 'gt100' | 'unsure';
export interface Answers {
  zip?: string;
  truckAccess?: 'yes' | 'no' | 'unsure';
  pathWidth?: 'wide' | 'narrow' | 'unsure';
  overhead?: 'clear' | 'branches' | 'other' | 'unsure';
  pathGround?: 'solid' | 'soft' | 'steps' | 'unsure';
  powerLines?: 'no' | 'yes' | 'unsure';
  streetDistance?: 'upTo100' | '100to150' | 'over150' | 'unsure';
  kitAccess?: 'yes' | 'no' | 'unsure';
  existingBase?: 'slab' | 'gravel' | 'deck' | 'none' | 'unsure';
  groundFlat?: 'flat' | 'steep' | 'unsure';
  bathroom?: 'none' | 'half' | 'shower' | 'unsure';
  waterDistance?: Band;
  panelDistance?: Band;
  door?: 'standard' | 'flipped' | 'unsure';
}
export type QuestionId = keyof Answers;
export type Method = 'tiltTrailer' | 'shedMule' | 'crane' | 'kit' | 'talk';
export type BaseKind = 'gravel' | 'existing' | 'raised';
export type ReasonCode = 'truckNo' | 'pathNarrow' | 'overheadLow' | 'pathSteps'
  | 'powerLines' | 'tooFar' | 'noKitAccess' | 'existingBase' | 'steepGround';
export type ToCheckCode = QuestionId | 'baseSlab' | 'baseGravel' | 'baseDeck';
export type NoteCode = 'softGround' | 'panelUpgrade' | 'twelveHalfBathOnly'
  | 'flipNotAvailable' | 'kitUnloading' | 'clearance';
export interface Recommendation {
  model: ModelId; method: Method; craneFrom: 3000 | 4000 | null; base: BaseKind;
  methodReason: ReasonCode | null; baseReason: ReasonCode | null;
  bathroom: 'none' | 'half' | 'shower'; door: 'standard' | 'flipped';
  toCheck: ToCheckCode[]; notes: NoteCode[];
}
export type PriceRegion = 'WA' | 'WA_OTHER' | 'CA_NORTH' | 'CA_SOUTH' | 'NJ_NY' | 'VA_PA_MD';
export type Factory = 'WA' | 'TN';
export interface Location {
  input: string; country: 'US' | 'CA'; shippingKey: string; // Appendix A row name
  region: PriceRegion | null; inCoverage: boolean; factory: Factory | null;
}
export interface CostLine {
  id: 'shipping' | 'install' | 'base' | 'power' | 'plumbing' | 'door';
  low: number; high: number; andUp: boolean; reference: boolean;
}
export interface SideItem { id: 'crane' | 'raisedBase' | 'shippingQuoted'; from: number | null }
export type CostSummary =
  | { mode: 'talk' }
  | { mode: 'range'; low: number; high: number; andUp: boolean;
      lines: CostLine[]; side: SideItem[]; locationKnown: boolean };
export interface LeadTime { minWeeks: number; maxWeeks: number }
```

`data.ts` exports `MODELS: Record<ModelId, { name: string; w: number; d: number; minPathWidth: number; minOverhead: number; weightLbs: number | null; weightWithBathLbs: number | null; flipAvailable: boolean }>` (Twelve 10/12, 4,600; Sixteen 12/12, 7,200 / 8,000 with bath; Station 12/13, weight null; flip true/true/false), plus `GRAVEL`, `RAISED_FROM`, `KIT_ASSEMBLY` as `Partial<Record<PriceRegion, Partial<Record<ModelId, number>>>>` with every figure from spec §8.3 (a "—" is simply absent; the spec's "CA" and "CA_NORTH / CA_SOUTH" rows fill both CA regions, and "NJ_NY / VA_PA_MD" fills both of those), `KIT_ASSEMBLY_REFERENCE`, `SHED_MULE = 2000`, `CRANE_FROM = { near: 3000, far: 4000 }`, `FLIP_DOOR = 500`, `PANEL_UPGRADE = 2500`, `LEAD_WEEKS` from §8.6, and the constants `LEVEL_CUTOFF_TEXT = '¼ in. per foot'` and `KIT_ACCESS_FT = 3` (spec §10 items 1 and 2: one place to change each). `shipping.ts` exports `SHIPPING: Record<string, { factory: Factory | null; amount: number | null }>` with every Appendix A row (`amount: null` = quoted separately; the "same distance" rows use `'WA'`) plus a `SHIPPING_SYNCED = '2026-10-28'` constant. Each file starts with a comment naming its sheet tab and sync date.

- [ ] **Step 1: Write the failing tests** in `tests/core/data.test.ts`:
  - `GRAVEL.WA.sixteen === 3000`, `GRAVEL.CA_SOUTH.sixteen === 4945`, `GRAVEL.WA_OTHER.station === undefined`
  - `KIT_ASSEMBLY.CA_NORTH.sixteen === 9000`, `KIT_ASSEMBLY_REFERENCE.station === 16500`
  - `RAISED_FROM.WA.sixteen === 14025`
  - `SHIPPING['Washington']` deep-equals `{ factory: 'WA', amount: 1100 }`, `SHIPPING['Kentucky'].amount === 1150`, `SHIPPING['Hawaii'].amount === null`, `SHIPPING['Colorado'].factory === 'WA'`, `Object.keys(SHIPPING).length === 59` (Appendix A rows without the header)
  - `MODELS.station.flipAvailable === false`, `MODELS.twelve.minPathWidth === 10`
- [ ] **Step 2:** `npm test -- tests/core/data.test.ts`. Expected: FAIL (modules missing).
- [ ] **Step 3:** Write `types.ts`, `data.ts`, `shipping.ts` as above.
- [ ] **Step 4:** Re-run the tests. Expected: PASS. Run `npm run check`. Expected: no errors.
- [ ] **Step 5:** Commit: `feat: assessment types and price data from the 🚦 sheet`.

### Task 3: Location lookup

**Files:** Create `src/assessment/core/location.ts`. Test `tests/core/location.test.ts`.

**Interfaces:**
- Consumes: `Location`, `PriceRegion`, `Factory` (Task 2), `SHIPPING` (Task 2).
- Produces: `lookupLocation(input: string): Location | null` (null = not a recognizable US ZIP or Canadian postal code).

Rules (from spec §8.1; the tables are the builder's first proposal, which Fred reviews):
- Normalize: trim, uppercase, drop spaces. US: `^\d{5}(-\d{4})?$`. Canada: `^[A-Z]\d[A-Z]\d[A-Z]\d$`.
- US ZIP3 → state name matching `SHIPPING` keys (USPS ZIP3 ranges). California: ZIP3 900–935 → `'California (Southern)'`, 936–961 → `'California (Northern)'`.
- Price regions by ZIP3: `WA` 980–985; `WA_OTHER` 986, 988–994; `CA_SOUTH` 900–935; `CA_NORTH` 936–961; `NJ_NY` 070–089 and 100–119; `VA_PA_MD` 206–219, 220–223, 170–196. Everything else `null`.
- Install areas (`inCoverage`): ZIP3 980–985 (Western WA); 939–954 and 956–958 (Bay Area); 900–918, 922–928, 930–935 (LA); 919–921 (San Diego).
- Canada first letter → `SHIPPING` key: `T` Alberta, `V` British Columbia, `R` Manitoba, `K L M` Ontario (Eastern), `N P` Ontario (Western), `G H J` Quebec. Any other letter → `shippingKey: 'OTHER'`, `factory: null` (spec: quoted separately). Canada: `region: null`, `inCoverage: false`.
- `factory` comes from `SHIPPING[shippingKey].factory`.

- [ ] **Step 1: Write the failing tests:**
  - `maps one ZIP per state`: a table test over AL 35203, AK 99501, AZ 85001, AR 72201, CO 80202, CT 06103, DE 19901, DC 20001, FL 33101, GA 30303, HI 96813, ID 83702, IL 60601, IN 46204, IA 50309, KS 66603, KY 40202, LA 70112, ME 04101, MD 21201, MA 02108, MI 48226, MN 55401, MS 39201, MO 63101, MT 59601, NE 68102, NV 89101, NH 03301, NJ 07102, NM 87501, NY 10001, NC 27601, ND 58501, OH 43215, OK 73102, OR 97201, PA 19103, RI 02903, SC 29201, SD 57501, TN 37203, TX 78701, UT 84101, VT 05601, VA 23219, WA 98101, WV 25301, WI 53202, WY 82001 → the expected `shippingKey`.
  - `splits California`: 90012 → Southern, region `CA_SOUTH`, `inCoverage` true; 94103 → Northern, `CA_NORTH`, true; 95501 (Eureka) → Northern, `CA_NORTH`, `inCoverage` false.
  - `Seattle is covered WA`: 98101 → region `WA`, `inCoverage` true, factory `WA`. Spokane 99201 → `WA_OTHER`, false.
  - `NYC is NJ_NY but not covered`: 10001 → `NJ_NY`, false, factory `TN`.
  - `accepts ZIP+4, spaces and lowercase postal codes`: `' 98101-1234 '` → Washington; `'v6b 1a1'` → British Columbia, country `CA`.
  - `Canadian provinces without a row are quoted separately`: `'B3H 1A1'` → `shippingKey` `'OTHER'`.
  - `rejects junk`: `''`, `'1234'`, `'ABCDE'`, `'00000'` (no state) → `null`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement `lookupLocation`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: ZIP and postal code lookup for shipping, price region and coverage`.

### Task 4: Questions and recommendation rules

**Files:** Create `src/assessment/core/questions.ts`, `src/assessment/core/rules.ts`. Tests `tests/core/questions.test.ts`, `tests/core/rules.test.ts`.

**Interfaces:**
- Consumes: `Answers`, `QuestionId`, `PlannerSnapshot`, `ModelId`, `Recommendation` (Task 2), `MODELS` (Task 2).
- Produces:
  - `QUESTION_ORDER: QuestionId[]` = `['zip','truckAccess','pathWidth','overhead','pathGround','powerLines','streetDistance','kitAccess','existingBase','groundFlat','bathroom','waterDistance','panelDistance','door']`
  - `visibleQuestions(answers: Answers): QuestionId[]`
  - `isMuleRuledOut(answers: Answers): boolean`, `isCraneRuledOut(answers: Answers): boolean`
  - `recommend(snapshot: PlannerSnapshot, answers: Answers, modelOverride?: ModelId): Recommendation`
  - `minClearance(snapshot: PlannerSnapshot): number` (feet, smallest gap between the pod's rotated rectangle and any object's bounding box or the yard edge; 0 if overlapping)

The rules are spec §6.1–§6.2, made exact:
- Asked when: `pathWidth`, `overhead`, `pathGround` if `truckAccess !== 'yes'`. `powerLines` if `isMuleRuledOut`. `streetDistance` if mule ruled out and `powerLines !== 'yes'`. `kitAccess` if `isCraneRuledOut`. `groundFlat` if `existingBase === 'none'`. `waterDistance` if `bathroom` is `half` or `shower`. All others always. Unanswered counts as "not that value".
- `isMuleRuledOut` = `truckAccess !== 'yes'` and (`pathWidth === 'narrow'` or `overhead === 'other'` or `pathGround === 'steps'`).
- `isCraneRuledOut` = mule ruled out and (`powerLines === 'yes'` or `streetDistance === 'over150'`).
- Method: mule not ruled out → `truckAccess === 'no'` ? `shedMule` (reason `truckNo`) : `tiltTrailer`. Mule ruled out, crane not → `crane`, `craneFrom` 4000 if `streetDistance === '100to150'` else 3000. Crane ruled out → `kitAccess === 'no'` ? `talk` (reason `noKitAccess`) : `kit`. The methodReason for crane/kit is the first path cause in order `pathNarrow`, `overheadLow`, `pathSteps`. For kit, use `powerLines` or `tooFar`.
- Base: `existingBase` `slab`/`gravel`/`deck` → `existing` (reason `existingBase`, toCheck `baseSlab`/`baseGravel`/`baseDeck`). Otherwise `groundFlat === 'steep'` (only when asked) → `raised` (reason `steepGround`). Else `gravel`.
- `toCheck`: every *visible* question answered `'unsure'`, in `QUESTION_ORDER`, then the base code. Answers to hidden questions are ignored everywhere.
- Normalize: `bathroom` unsure/unanswered → `'none'`. `door` unsure/unanswered → `'standard'`.
- Notes: `softGround` if path questions are visible and `pathGround === 'soft'`. `panelUpgrade` always. `twelveHalfBathOnly` if model is twelve and bathroom is shower. `flipNotAvailable` if door is flipped and `!MODELS[model].flipAvailable`. `kitUnloading` if method is kit. `clearance` if `minClearance(snapshot) < 3`.
- Model = `modelOverride ?? snapshot.model`.

- [ ] **Step 1: Write the failing tests** (`rules.test.ts` builds a `snapshot` fixture: Sixteen, rotation 0, yard 40×30, pod centred, no objects):
  - `starting card is tilt trailer and gravel`: `recommend(snapshot, {})` → method `tiltTrailer`, base `gravel`, bathroom `none`, door `standard`, toCheck `[]`, notes `['panelUpgrade']`.
  - `truck no → shed mule`: `{truckAccess:'no'}` → `shedMule`, reason `truckNo`.
  - `truck unsure stays tilt trailer and adds a check`: `{truckAccess:'unsure'}` → `tiltTrailer`, toCheck `['truckAccess']`.
  - `narrow path → crane from 3000`: `{truckAccess:'no', pathWidth:'narrow'}` → `crane`, `craneFrom` 3000, reason `pathNarrow`.
  - `crane far tier`: plus `streetDistance:'100to150'` → `craneFrom` 4000.
  - `power lines → kit`: `{truckAccess:'no', overhead:'other', powerLines:'yes'}` → `kit`, notes include `kitUnloading`.
  - `no kit access → talk`: plus `kitAccess:'no'` → `talk`, reason `noKitAccess`.
  - `stale answers are ignored`: `{truckAccess:'yes', pathWidth:'narrow', powerLines:'yes'}` → `tiltTrailer`, toCheck `[]`.
  - `branches that can be trimmed don't escalate`: `{truckAccess:'no', overhead:'branches'}` → `shedMule`.
  - `existing slab`: `{existingBase:'slab', groundFlat:'steep'}` → base `existing`, toCheck `['baseSlab']` (groundFlat hidden, so ignored).
  - `steep ground → raised base`: `{existingBase:'none', groundFlat:'steep'}` → `raised`, reason `steepGround`.
  - `twelve with shower note`: Twelve snapshot, `{bathroom:'shower'}` → notes include `twelveHalfBathOnly`. `modelOverride:'sixteen'` → note absent, model `sixteen`.
  - `flip not on station`: Station snapshot, `{door:'flipped'}` → notes include `flipNotAvailable`.
  - `clearance note`: an object 2 ft from the pod's edge → notes include `clearance`. `minClearance` of the centred fixture → **10** (the yard-edge gaps are 12 ft and 10 ft).
  - `questions.test.ts`: `visibleQuestions({})` → `['zip','truckAccess','pathWidth','overhead','pathGround','existingBase','bathroom','panelDistance','door']`. `{truckAccess:'yes'}` drops the three path questions. `{truckAccess:'no', pathWidth:'narrow', powerLines:'yes'}` shows `powerLines`, hides `streetDistance`, shows `kitAccess`. `{existingBase:'none', bathroom:'half'}` adds `groundFlat` and `waterDistance` in order.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement both files.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: question visibility and recommendation rules`.

### Task 5: Pricing and lead time

**Files:** Create `src/assessment/core/pricing.ts`. Test `tests/core/pricing.test.ts`.

**Interfaces:**
- Consumes: `Recommendation`, `Location`, `Answers`, `CostSummary`, `LeadTime` and the data from Task 2.
- Produces: `priceRecommendation(rec: Recommendation, location: Location | null, answers: Answers): CostSummary`, `leadTime(rec: Recommendation, location: Location | null): LeadTime`, `bandFeet(band: Band | undefined): { feet: number; andUp: boolean }`.

Rules (spec §8, exact):
- `method === 'talk'` → `{ mode: 'talk' }`.
- `bandFeet`: lt25 → 25, 25to50 → 50, 50to100 → 100, gt100 → 100 with `andUp`, unsure/undefined → 50.
- **shipping** line only when location is known and `SHIPPING[key].amount !== null`. If the amount is null, add side item `shippingQuoted`. Not `reference`.
- **install**: tiltTrailer → line 0/0. shedMule → 2000. crane → no line, side item `{id:'crane', from: rec.craneFrom}`. kit → `KIT_ASSEMBLY[region][model]` or `KIT_ASSEMBLY_REFERENCE[model]` with `reference: true` (also reference whenever `!location?.inCoverage`).
- **base**: existing → 0/0. gravel → regional figure, or the reference range (min–max of that model across all regions in `GRAVEL`) with `reference: true`. raised → no line, side item `{id:'raisedBase', from: RAISED_FROM[region]?.[model] ?? min of RAISED_FROM for that model}`.
- **power** (feet from `answers.panelDistance`): WA → low `feet <= 50 ? 1500 : 80*feet+81`, high `80*feet+81`. CA_SOUTH → 5600/5600. NJ_NY → `30*feet+81` both. Otherwise reference: low = min of the three regions' lows, high = max of their highs, at that distance.
- **plumbing** only if bathroom ≠ none (feet from `answers.waterDistance`): WA → `72*feet+1500` both. CA_SOUTH → 8000. Otherwise reference = min/max of those two.
- **door**: flipped and `flipAvailable` → 500.
- `reference` is true on every regional line when the location is unknown, outside an install area, or the region has no figure.
- `low`/`high` = sums. `andUp` = any line's `andUp`. `locationKnown` = `location !== null`.
- `leadTime`: weeks from `LEAD_WEEKS` for (kit ? kit : pre-built model) at the location's factory. Unknown location or factory → min/max across both factories. +2 to both if bathroom ≠ none. `talk` uses pre-built.

- [ ] **Step 1: Write the failing tests:**
  - `worked example from the spec`: Sixteen, Seattle 98101, shedMule, gravel, `panelDistance:'25to50'`, no bathroom → `{mode:'range', low:7600, high:10181}`.
  - `starting card without ZIP`: Sixteen, `{}` → no shipping line, `locationKnown:false`, base reference 3000–4945, power reference at 50 ft 1500–5600, low 4500, high 10545.
  - `crane is a side item`: crane rec, `craneFrom:4000` → no install line, side contains `{id:'crane', from:4000}`.
  - `raised base side item`: raised, CA 90012, Sixteen → side `{id:'raisedBase', from:16129}`, no base line.
  - `quoted shipping`: Hawaii 96813 → no shipping line, side contains `shippingQuoted`.
  - `kit outside coverage uses reference assembly`: kit, Station, NYC 10001 → install 16500/16500 `reference:true`.
  - `bathroom adds plumbing`: Seattle, `bathroom` half, `waterDistance:'25to50'` → plumbing 5100/5100.
  - `over 100 ft is and-up`: `panelDistance:'gt100'` → summary `andUp:true`.
  - `flipped door adds 500 only where available`: Sixteen flipped → door line 500. Station flipped → no door line.
  - `talk mode`: method talk → `{mode:'talk'}`.
  - `lead time`: Sixteen pre-built, Seattle → 5/5. Station, Texas → 7/7. Kit, no location → 4/5. Sixteen + bathroom, Seattle → 7/7.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: cost ranges and lead times`.

### Task 6: Copy and the recommendation card

**Files:** Create `src/assessment/ui/copy.ts`, `src/assessment/ui/card.ts`. Test `tests/ui/card.test.ts` (`// @vitest-environment jsdom`).

**Interfaces:**
- Consumes: Tasks 2–5.
- Produces:
  - `copy.ts`: `methodTitle(model: ModelId, method: Method): string`, `pillText(rec: Recommendation): { delivery: string; base: string }`, `reasonText(code: ReasonCode): string`, `toCheckText(code: ToCheckCode): string`, `noteText(code: NoteCode, rec: Recommendation): string`, `formatMoney(n: number): string` (`$7,600`), `costLineText(s: CostSummary): string`, `leadTimeText(t: LeadTime): string`, `coverageText(location: Location | null): string`, `describeChange(prev: Recommendation | null, next: Recommendation): { what: string; why: string } | null`.
  - `card.ts`: `renderCard(el: HTMLElement, view: CardView): void`, where `interface CardView { rec: Recommendation; cost: CostSummary; lead: LeadTime; location: Location | null; change: { what: string; why: string } | null }`. The card dispatches `CustomEvent('minio:cta', { detail: 'design' | 'talk' })` and `CustomEvent('minio:switch-model', { detail: ModelId })` and `CustomEvent('minio:edit-yard')`, bubbling from `el`.

Fixed copy (spec §5.3): titles `"{Name}, delivered ready-built"` (tilt trailer, shed mule), `"{Name}, lifted in by crane"`, `"{Name} as a kit, assembled on site"`, and for talk `"{Name}: let's work out the best way in"`. Cost line `"Delivery and site prep: $X – $Y"` (one figure when low = high, `+` suffix when `andUp`), then side items (`"+ crane, from $3,000"`, `"+ raised base, from $14,025, priced in person"`, `"+ shipping, quoted separately"`), then `"Your pod's price comes from the configurator. This is what goes on top of it."`. Talk: `"We'll work this out with you"`. No ZIP: `"Add your ZIP code to see delivery and local prices."`. Lead time: `"Ready to ship about 5 weeks after we receive payment"` (or `"about 5–6 weeks"`). Coverage: spec §5.3 wording, verbatim. Change line: `"Changed: {what}. Why: {why}"`. Below the cost line, the card lists `rec.notes` (via `noteText`; `clearance` includes an "Adjust in the yard planner" link that dispatches `minio:edit-yard`; `twelveHalfBathOnly` includes a "Switch to the Sixteen" button) and, under the heading "To check", `rec.toCheck` (via `toCheckText`), hidden when empty. Buttons: `Design my pod`, `Let's talk`. Photo `assets/models/{model}.jpg`, alt = model name. The breakdown is a `<details>` listing each line (shipping, installation, base, power, water and sewer, flipped door) and marks reference lines "(reference)". When the base is gravel or existing, or when the location is outside an install area, the card links "Get the base spec for your contractor" → `contractor/base.html?model={model}`, and the same for power → `contractor/power.html?model={model}&door={door}`.

The rest of the copy (reasons, to-checks, notes) the builder writes from spec §6 in plain English. Fred reviews it in Task 12.

Mobile (spec §5.2): under 768 px the card renders a collapsed bar fixed to the bottom of the viewport (model, method, cost line, both buttons) that expands on tap. Plain CSS media query plus one `aria-expanded` toggle.

- [ ] **Step 1: Write the failing tests:**
  - `renders the starting card`: shows "The Sixteen, delivered ready-built", the pill "Delivery: tilt trailer", the cost line with `$4,500 – $10,545`, and the no-ZIP line.
  - `shows the change line`: with a change → text contains "Changed:" and "Why:".
  - `talk mode hides the range`: shows "We'll work this out with you" and both buttons.
  - `buttons dispatch minio:cta`: clicking Design my pod fires `minio:cta` with detail `design`.
  - `switch model button appears with the twelve shower note` and dispatches `minio:switch-model` with `sixteen`.
  - `describeChange` returns null when method and base are unchanged.
  - `lists to-checks and notes`: a rec with toCheck `['truckAccess']` shows a "To check" heading and one item. A rec with an empty toCheck shows no heading.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: recommendation card and client copy`.

### Task 7: Lead submission function

**Files:**
- Create: `src/server/airtable-fields.ts`, `netlify/functions/submit.ts`
- Delete: `netlify/functions/submit.js`
- Test: `tests/server/submit.test.ts`

**Interfaces:**
- Consumes: `PlannerSnapshot`, `Answers`, `Recommendation`, `CostSummary`, `LeadTime`, `Location` (Task 2), `MODELS` (Task 2, for the "The Sixteen" model name).
- Produces (in `airtable-fields.ts`):

```ts
export type Cta = 'design' | 'talk' | 'save';
export interface SubmissionPayload {
  recordId?: string;
  contact: { email: string; firstName: string; phone: string };
  ctaHistory: Cta[];
  snapshot: PlannerSnapshot; answers: Answers; recommendation: Recommendation;
  cost: CostSummary; lead: LeadTime; location: Location | null;
  readable: { answers: string; toCheck: string; costNotes: string; method: string; base: string; leadTime: string };
}
export function buildFields(p: SubmissionPayload, isCreate: boolean): Record<string, string | number | boolean>;
export const RECORD_ID_RE = /^rec[A-Za-z0-9]{14}$/;
```

- `submit.ts` exports `handler(event: { httpMethod: string; body: string | null }): Promise<{ statusCode: number; headers: Record<string, string>; body: string }>`. Keep the current CORS headers, the OPTIONS/405 handling and `AIRTABLE_PAT`. Reject invalid JSON (400), a missing or invalid email (400), and a `recordId` not matching `RECORD_ID_RE` (400). Without `recordId`: POST `{fields, typecast: true}` to the table URL. With it: PATCH to `{tableUrl}/{recordId}`. Return `{ id }`. On an Airtable error, return Airtable's status and `error.message` (Review Focus 5).
- Airtable field names (the list Fred creates; spec §7): `Email`, `First Name`, `Phone`, `Submission Date` (create only), `Last Updated`, `Buttons Clicked` (comma list), `ZIP`, `State`, `Price Region`, `In Coverage` (checkbox), `Pod Model` (e.g. "The Sixteen", same as today), `Pod Use` (Office/Studio/Guest Suite/Other, same labels as today), `Yard Dimensions` (same format as today), `Pod Orientation` (same as today), `Recommended Method`, `Base`, `Bathroom`, `Door`, `Cost Low` (number), `Cost High` (number), `Cost Notes`, `Shipping Estimate` (number), `Lead Time`, `To Check`, `Answers`, `Planner Snapshot` (JSON), `Assessment Version` (`'v2'`). For talk mode, Cost Low/High are omitted and Cost Notes = "Let's talk".

- [ ] **Step 1: Write the failing tests** (mock `globalThis.fetch` with `vi.fn`, set `process.env.AIRTABLE_PAT`):
  - `creates a record`: no recordId → one POST to `https://api.airtable.com/v0/appj87SHEgZafCMC2/Submissions`, body has `typecast: true` and `fields['Submission Date']`, response `{ id: 'recABCDEFGHIJKLMN' }`, status 200.
  - `updates an existing record`: recordId `recABCDEFGHIJKLMN` → one PATCH to `…/Submissions/recABCDEFGHIJKLMN`, no `Submission Date` in fields.
  - `rejects a bad record id`: `recordId: 'rec123'` → 400, fetch not called.
  - `rejects a missing email` → 400.
  - `returns Airtable's error message and status`: fetch resolves 422 `{error:{message:'Unknown field name: "ZIP"'}}` → status 422, body error contains `Unknown field name`.
  - `maps fields`: `buildFields` for the worked-example payload → `Cost Low` 7600, `Cost High` 10181, `In Coverage` true, `Pod Model` "The Sixteen", `Assessment Version` "v2".
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement both files and delete `submit.js`.
- [ ] **Step 4:** Run `npm test` and `npm run check`. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: submit creates or updates one Airtable record per session`.

### Task 8: Question view and drawings

**Files:** Create `src/assessment/ui/question-view.ts`, `src/assessment/ui/questions-copy.ts`, `src/assessment/ui/drawings.ts`. Test `tests/ui/question-view.test.ts` (jsdom).

**Interfaces:**
- Consumes: `QuestionId`, `Answers`, `ModelId` (Task 2), `visibleQuestions` (Task 4), `MODELS`, `KIT_ACCESS_FT`, `LEVEL_CUTOFF_TEXT` (Task 2), `lookupLocation` (Task 3).
- Produces:
  - `questions-copy.ts`: `questionCopy(id: QuestionId, model: ModelId): { title: string; options: { value: string; label: string }[]; help: string }`.
  - `drawings.ts`: `drawing(id: QuestionId): string` (an inline SVG string, simple line drawing, `role="img"` plus `aria-label`).
  - `question-view.ts`: `renderQuestion(el: HTMLElement, q: { id: QuestionId; index: number; total: number; model: ModelId; value: string | undefined; canGoBack: boolean }): void`. It dispatches bubbling `CustomEvent('minio:answer', { detail: { id, value } })`, `minio:back` and `minio:next`. The ZIP question renders a text input plus "Next" and "Skip for now". An unrecognized ZIP shows "We couldn't find that ZIP or postal code." and dispatches nothing.

Copy rules: options per spec §6.1 and the `Answers` values in Task 2, every question ends with "I'm not sure" (except the ZIP, which has "Skip for now"). Model-dependent labels use `MODELS` (path width: `"Wider than {minPathWidth} ft"` / `"Narrower than {minPathWidth} ft"`; overhead: `"Nothing lower than {minOverhead} ft"`, `"Only branches we can trim"`, `"Yes, something else (wires, a roof edge)"`). Kit access uses `KIT_ACCESS_FT`, flatness uses `LEVEL_CUTOFF_TEXT`. Help text is plain English (no jargon like "amps" or "subgrade"), 2–4 short sentences, and draws only on these facts: tilt trailer = truck backs up and slides the pod off; shed mule needs a 24 ft turning space if the pod turns (20 ft for the Twelve) and grass can get marked (stop watering a week before); crane needs the street clear for the crane truck and can't work near power lines; kit pieces fit through a regular door and unloading takes about 3 people 2 hours; how to measure width with a tape at the narrowest point; checking slope with a phone level app; where to find the electrical panel (garage, basement, outside near the meter); water and sewer usually leave the house near the front or the basement; the flipped door moves the sliding door toward the middle of the pod and is +$500 on select models.

- [ ] **Step 1: Write the failing tests:**
  - `renders title, drawing, options and help collapsed` for `pathWidth` with Twelve: options include "Wider than 10 ft" and "I'm not sure", a `<details>` element closed, an `svg` present.
  - `clicking an option dispatches minio:answer` with `{id:'pathWidth', value:'narrow'}`.
  - `progress text`: index 2, total 9 → "Question 3 of 9".
  - `zip accepts a valid code`: typing "98101" + Next → `minio:answer` `{id:'zip', value:'98101'}`. "1234" → error text and no event.
  - `every question has copy and a drawing`: loop over `QUESTION_ORDER` → `questionCopy` title non-empty, `drawing` starts with `<svg`.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5:** Commit: `feat: one-question view with drawings and how-to-measure help`.

### Task 9: App controller, lead form, print, bundle entry

**Files:** Create `src/assessment/ui/app.ts`, `src/assessment/ui/lead-form.ts`, `src/assessment/ui/print.ts`, `src/assessment/styles.css`. Replace the placeholder `src/assessment/main.ts`. Test `tests/ui/app.test.ts` (jsdom).

**Interfaces:**
- Consumes: everything above. `SubmissionPayload`, `Cta` (Task 7).
- Produces:
  - `createApp(root: HTMLElement, deps: { fetchFn: typeof fetch; storage: Storage; navigate: (url: string) => void; print: () => void }): { start(snapshot: PlannerSnapshot): void; restore(): PlannerSnapshot | null }`
  - `main.ts` sets `window.MiniOAssessment = createApp(document.getElementById('assessment-root')!, { fetchFn: fetch.bind(window), storage: sessionStorage, navigate: (u) => window.location.assign(u), print: () => window.print() })` and imports `./styles.css`. Declare the global type in `main.ts`.
  - The app dispatches `CustomEvent('minio:edit-yard')` on `document` (Back on the first question, or the clearance link). Index.html listens (Task 10).

Behaviour:
- Stored state (`minio-assessment-v2`): `{ snapshot, answers, currentId, modelOverride, contact, recordId, ctaHistory }`. It's written after every change and read by `restore()`. `restore()` returns the snapshot when stored state exists and renders screen 2 at `currentId`, else null. If `storage.setItem` throws, rethrow. Don't catch it.
- `start(snapshot)`: keeps stored answers, replaces the snapshot, clears `modelOverride`, goes to the first visible question (Review Focus 4).
- On each answer: save, recompute `recommend` → `priceRecommendation` → `leadTime`, render the card with `describeChange(previousRec, nextRec)`, and move to the next visible question after the current one. After the last question, show the end panel: "That's everything." plus a **Save my plan** button.
- CTA flow (`minio:cta` or Save): no stored email → open the lead form (email required with the same regex as today `^[^\s@]+@[^\s@]+\.[^\s@]{2,}$`, first name and phone optional, the line from spec §7 verbatim). Otherwise submit directly. Submit = POST `/.netlify/functions/submit` with the `SubmissionPayload`. Store the returned `id` as `recordId`. Then design → `navigate('https://minioffice.co/quote')`, talk → `navigate('https://minioffice.co/lets-talk')`, save → show "Saved. A Mini·O advisor will reach out." plus a **Print / save as PDF** button that calls `deps.print()`. While a submit is in flight, other CTA clicks are ignored (Review Focus 2). On failure: show the server's error message, **Try again**, and a small **Continue without saving** link that performs the navigation (or closes, for save).
- `print.ts`: `renderPrintSummary(el, view)` fills a `.print-summary` block (recommendation, cost lines, lead time, to-check list, answers). The print CSS hides everything else.
- `minio:switch-model` sets `modelOverride`.

- [ ] **Step 1: Write the failing tests** (fake `storage` from `new Map`, `fetchFn` = `vi.fn`):
  - `start shows the starting card and the ZIP question`.
  - `answering advances to the next visible question and updates the card`: answer `truckAccess` no → card shows shed mule and the change line, next question is `pathWidth`.
  - `first CTA opens the lead form, then submits and navigates`: click Design my pod → form visible. Fill the email → fetch called once with no `recordId`, then `navigate('https://minioffice.co/quote')`. The stored `recordId` equals the response id.
  - `later CTA updates the same record without the form`: second click Let's talk → no form, fetch body `recordId` set, `navigate('https://minioffice.co/lets-talk')`.
  - `ignores a second click while a submit is in flight`: two clicks before the fetch resolves → fetch called once.
  - `failure shows Try again and Continue without saving`: fetch → 422 with a message → the message is shown. Clicking Continue without saving → navigate called.
  - `restores screen 2 and record id from storage`: build state with a first app instance, create a second `createApp` with the same storage → `restore()` returns the snapshot, the same question is shown, the next CTA sends the stored `recordId`.
  - `start with a new snapshot keeps answers and clears the model override`.
  - `storage errors are not swallowed`: storage whose `setItem` throws → answering throws.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Styles: clean and uncluttered, Inter (already loaded by `index.html`), Mini·O red `#ED3648` for primary buttons, reusing the CSS variables in `index.html`'s `:root` where they exist.
- [ ] **Step 4:** Run `npm test`, `npm run build`. Expected: PASS, bundle built.
- [ ] **Step 5:** Commit: `feat: screen 2 app controller, lead form and print summary`.

### Task 10: Wire into index.html and trim the planner

**Files:** Modify `index.html` (current line numbers): head (add the stylesheet), `1336-1350` header, `1545-1647` panels, `1654-2200` script (state, validation, report, submission), `2220`/`2343-2349`/`2436-2444`/`2538-2560` setback and toast, `2763-2786` init, `2787-3252` question system. Add `assets/models/twelve.jpg`, `sixteen.jpg`, `station.jpg`.

**Interfaces:**
- Consumes: `window.MiniOAssessment.start(snapshot)` and `.restore()`, and the `minio:edit-yard` event (Task 9).

Steps:
- [ ] **Step 1:** In `<head>` add `<link rel="stylesheet" href="build/assessment/main.css">`. Before the inline `<script>`, add `<script src="build/assessment/main.js"></script>`.
- [ ] **Step 2:** Replace panels 1–5 with one `<section class="step-panel" id="panel-1" aria-label="Your plan"><div id="assessment-root"></div></section>`. Delete the contact form and the report wrapper.
- [ ] **Step 3:** In the inline script, delete the contact form refs, validation, `computeReport` through `handleSubmit`, `submitToAirtable`, and the whole question system (`STEP_DEFS` … `initQuestionSteps`). `STEPS` becomes `[{label:'Your Space', stepNum:1}, {label:'Your Plan', stepNum:2}]`. Keep `STORAGE_KEY = 'minio-assessment-v1'`, but it now stores only `currentStep`. `isCurrentStepValid` returns true. On step 1, hide `#app-nav` (screen 2 has its own Back/Next). The keyboard handler acts only when `state.currentStep === 0`.
- [ ] **Step 4:** Add `function buildSnapshot()` returning `{ model: planner.pod.id, rotation: planner.rotation, yardW, yardD, podX, podY, podUse: planner.podUse, objects: planner.objects.map(({type,x,y,w,h}) => ({type,x,y,w,h})) }`. `goNext()` from step 0 calls `window.MiniOAssessment.start(buildSnapshot())`, then shows step 1. If `window.MiniOAssessment` is missing, let the TypeError surface (no fallback). Add `function restorePlanner(s)` that sets the pod, rotation, yard size inputs, position, use buttons and objects (re-attaching `def` from `YARD_OBJECT_DEFS`), then redraws. In `init()`: `const snap = window.MiniOAssessment.restore(); if (snap) { restorePlanner(snap); state.currentStep = 1; }`. Listen for `minio:edit-yard` on `document` → step 0 and `render()`.
- [ ] **Step 5:** Setback removal (spec §5.1): delete `SETBACK`, the dashed setback rectangle in `draw()` and `isInsideSetback()`. `updateToast()` shows `"{minC} ft clearance. Good placement."` when `minC >= 3`, else `"{minC} ft clearance. Leave about 3 ft around the pod."` with the `warning` class.
- [ ] **Step 6:** Copy `.superpowers/brainstorm/1672-1793211515/content/pod-photo.jpg` to `assets/models/sixteen.jpg`, `twelve.jpg` and `station.jpg` as **placeholders**. Task 12 lists replacing them as a launch blocker.
- [ ] **Step 7: Verify in the browser.** `npm run build`. Add a `.claude/launch.json` entry `{ "name": "assessment", "runtimeExecutable": "npx", "runtimeArgs": ["http-server", "-p", "8091", "-c-1", "."], "port": 8091 }` (or reuse an existing static entry if one serves the repo root) and start it with the preview tool. Check: no console errors. The planner works with no setback line. Next → screen 2 with the starting card (tilt trailer). Answer ZIP 98101 and truck "No" → shed mule plus the change line. Back on the first question → planner. Reload on screen 2 → same question. At 375 px wide the card is a bottom bar. Take a screenshot. (Lead submission can't be checked locally without `AIRTABLE_PAT`. Note that in the report.)
- [ ] **Step 8:** `npm test`. Expected: all pass. Commit: `feat: screen 2 replaces the old question steps; planner loses the setback outline`.

### Task 11: Contractor spec sheets

**Files:** Create `contractor/base.html`, `contractor/power.html`, `src/specs/values.ts`, replace the placeholder `src/specs/main.ts`. Test `tests/specs/values.test.ts`.

**Interfaces:**
- Consumes: `MODELS` (Task 2).
- Produces: `specValues(model: string | null, door: string | null): { name: string; size: string; weight: string; inletCorner: string } | null` (null for an unknown model). `main.ts` reads `?model=&door=`, fills every `[data-field="…"]` in the page, and shows "Open this page from your Mini·O plan." when `specValues` returns null.

Content is spec §9 verbatim, with these values: weight `"4,600 lbs"`, `"7,200 lbs (8,000 lbs with a bathroom)"`, Station `"ask your Mini·O advisor"`. Inlet `"back right corner"` (standard) or `"back left corner"` (flipped). Concrete slab: `"Ask your Mini·O advisor for the concrete slab spec."` (spec §10 item 3). Both pages are printable (one page each, print CSS) and link the build script from `../build/specs/main.js`.

- [ ] **Step 1: Write the failing tests:** `specValues('sixteen','flipped')` → weight "7,200 lbs (8,000 lbs with a bathroom)", inletCorner "back left corner", size "16 × 10 ft". `specValues('station', null)` → weight "ask your Mini·O advisor", inletCorner "back right corner". `specValues('nine', null)` → null.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement the values, entry and both pages.
- [ ] **Step 4:** Run `npm test`, `npm run build`. Open `contractor/base.html?model=sixteen` in the preview. Expected: the values filled in, no console errors.
- [ ] **Step 5:** Commit: `feat: printable base and power spec sheets for clients' contractors`.

### Task 12: Final verification and launch checklist

- [ ] **Step 1:** `npm test`. Expected: all suites pass. `npm run build`. Expected: no type errors.
- [ ] **Step 2:** Browser walkthrough in the preview, at desktop width and at 375 px: the five paths (tilt trailer, shed mule, crane, kit, Let's talk), an outside-coverage ZIP (10001, reference labels), Hawaii (shipping quoted separately), a bathroom, a flipped door on the Station (note, no charge), print preview after Save. Screenshot each card.
- [ ] **Step 3:** `git status`: nothing under `build/` or `node_modules/` tracked, and `permitting-engine/` untouched (`git diff main --stat -- permitting-engine` is empty).
- [ ] **Step 4:** Write `docs/superpowers/launch-checklist-readiness-v2.md` listing: the Airtable fields from Task 7 for Fred to create; replace the three placeholder photos in `assets/models/`; sales answers for spec §10 items 1–2 (`LEVEL_CUTOFF_TEXT`, `KIT_ACCESS_FT` in `data.ts`); Fred reviews all copy in `copy.ts` and `questions-copy.ts` and the ZIP tables in `location.ts`; check the first Netlify deploy preview log (dependencies installed, build ran, functions bundled, `node_modules` not published) and submit one real lead on the preview. Commit: `docs: launch checklist for the new readiness assessment`.
