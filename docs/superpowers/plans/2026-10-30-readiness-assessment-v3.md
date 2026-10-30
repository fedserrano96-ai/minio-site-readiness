# Readiness Assessment v3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rework screen 2 so the client ends on a clear yes, with a plain walk-through of what it takes, who does each step, and a list the rep checks on the call.

**Architecture:** Same shape as v2: pure rules and pricing in `src/assessment/core/`, copy and DOM in `src/assessment/ui/`, and Airtable mapping in `src/server/`. The question set and the rules change in core. A new pure `planSteps` builds the walk-through text, and a new `renderPlan` replaces the end panel. Drawings are redrawn as model-aware SVG with numbered callouts.

**Tech Stack:** TypeScript 5, esbuild, Vitest 2 + jsdom, npm. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-10-30-readiness-assessment-v3-design.md`. It builds on `docs/superpowers/specs/2026-10-28-readiness-assessment-overhaul-design.md` (v2). Read both.

## Global Constraints

- Work on branch `readiness-v3`, cut from `main`. Never push to `main` (pushing `main` deploys to production).
- No new npm dependencies. TypeScript only.
- Raise errors explicitly. No silent fallbacks.
- Every client-facing string stays in `src/assessment/ui/copy.ts`, `questions-copy.ts` or `plan-copy.ts`. Fred reviews them all.
- Never mention, in any client-facing string: permits, sewer vs. septic, on-site assembly because of a bathroom, panel size or amperage of the house, internet, or delivery-day prep. Technical detail lives only in `contractor/*.html`.
- Copy says Mini·O "arranges" contractors, never "builds".
- Lead times are phrased as "about N weeks after we receive payment".
- Water step text, verbatim: `Your pod will need a licensed plumber to connect it to your water and sewer. We can help coordinate one, or if you have someone you trust, even better.`
- Rep list heading, verbatim: `We'll check these with you on the call`
- Shed mule limits are constants in `data.ts`: `MULE_MAX_SLOPE_DEG = 10`, `MULE_MAX_STEP_FT = 1.5`, `MULE_RAMPS = 250`.
- Storage key: `minio-assessment-v3`. Airtable `Assessment Version`: `v3`. No new Airtable fields.
- Don't touch `permitting-engine/` or the yard planner code in `index.html`.
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Tasks 1 to 6 change shared types, so files outside a task's scope may not type-check until Task 7. Each of those tasks runs only its own test files. From Task 7 on, `npm test` and `npm run build` must both pass.

## Review Focus

These are inputs the spec doesn't spell out. The listed task's tests pin each one.

1. **The client goes back and changes the truck answer to "yes"** after answering removable / short steps. The hidden answers must not leave ramps, take-down lines or a mule reason on the plan (Task 2).
2. **A v2 session is still in sessionStorage** under `minio-assessment-v2`. `restore()` must return null and start fresh, not crash on the old answer shape (Task 7).
3. **The model switches while the client is on the removable question.** Clearing `pathWidth` hides that question, so the app must land on a visible question (Task 7).
4. **There's no ZIP yet** (location null). The plan must not claim "Mini·O arranges this" or offer to arrange an electrician (Task 6).
5. **Removable is "not sure" or "no"** with a narrow path. The recommendation stays where the narrow path put it (crane, etc.), and "not sure" adds a rep-list line (Task 2).

---

### Task 1: Question set, groups and the shed-mule rule

**Files:**
- Modify: `src/assessment/core/types.ts`, `src/assessment/core/questions.ts`, `src/assessment/core/data.ts`
- Test: `tests/core/questions.test.ts`, `tests/core/data.test.ts`

**Interfaces:**
- Produces, in `types.ts`, an `Answers` with these changes:
  - removed: `waterDistance`, `door`
  - changed: `pathGround?: 'solid' | 'soft' | 'shortSteps' | 'steep' | 'unsure'`
  - added: `turn?: 'none' | 'roomy' | 'tight' | 'unsure'`
  - added: `removable?: 'fence' | 'other' | 'no' | 'unsure'`
  - added: `panelRoute?: 'soft' | 'hard' | 'both' | 'unsure'`
  - unchanged: `QuestionId = keyof Answers`
- Produces, in `questions.ts`:
  - `QUESTION_ORDER: QuestionId[] = ['zip','bathroom','truckAccess','pathWidth','turn','removable','overhead','pathGround','powerLines','streetDistance','kitAccess','existingBase','groundFlat','panelDistance','panelRoute']`
  - `export type QuestionGroup = 'Your pod' | 'Getting it there' | 'The spot' | 'Power'` and `export const QUESTION_GROUP: Record<QuestionId, QuestionGroup>`. The groups are:
    - zip and bathroom → Your pod
    - truckAccess through kitAccess → Getting it there
    - existingBase and groundFlat → The spot
    - panelDistance and panelRoute → Power
  - `isRemoved(answers): boolean`: `removable` is `'fence'` or `'other'`
  - `isMuleRuledOut`, `isCraneRuledOut` and `visibleQuestions`, unchanged in name and signature
- Produces, in `data.ts`:
  - added: `MULE_MAX_SLOPE_DEG = 10`, `MULE_MAX_STEP_FT = 1.5`, `MULE_RAMPS = 250`
  - removed: `FLIP_DOOR`, `PANEL_UPGRADE`
  - `MODELS[*].flipAvailable` stays (the power sheet still uses it)

- [ ] **Step 1: Create the branch and commit the spec and plan**

```bash
git checkout -b readiness-v3
git add docs/superpowers/specs/2026-10-30-readiness-assessment-v3-design.md docs/superpowers/plans/2026-10-30-readiness-assessment-v3.md
git commit -m "docs: readiness assessment v3 design and plan"
```

- [ ] **Step 2: Write the failing tests in `tests/core/questions.test.ts`**

Replace the order and visibility tests for removed questions. Add:

```ts
it('order', () => expect(QUESTION_ORDER).toEqual(['zip','bathroom','truckAccess','pathWidth','turn','removable','overhead','pathGround','powerLines','streetDistance','kitAccess','existingBase','groundFlat','panelDistance','panelRoute']));
it('groups', () => {
  expect(QUESTION_GROUP.bathroom).toBe('Your pod');
  expect(QUESTION_GROUP.turn).toBe('Getting it there');
  expect(QUESTION_GROUP.groundFlat).toBe('The spot');
  expect(QUESTION_GROUP.panelRoute).toBe('Power');
});
it('turn shows only when the truck cannot reach', () => {
  expect(visibleQuestions({ truckAccess: 'yes' })).not.toContain('turn');
  expect(visibleQuestions({ truckAccess: 'no' })).toContain('turn');
});
it('removable shows only for a narrow path or a tight turn', () => {
  expect(visibleQuestions({ truckAccess: 'no' })).not.toContain('removable');
  expect(visibleQuestions({ truckAccess: 'no', pathWidth: 'narrow' })).toContain('removable');
  expect(visibleQuestions({ truckAccess: 'no', turn: 'tight' })).toContain('removable');
  expect(visibleQuestions({ truckAccess: 'yes', pathWidth: 'narrow' })).not.toContain('removable');
});
it('a removable narrow point or tight turn keeps the mule', () => {
  expect(isMuleRuledOut({ truckAccess: 'no', pathWidth: 'narrow' })).toBe(true);
  expect(isMuleRuledOut({ truckAccess: 'no', turn: 'tight' })).toBe(true);
  expect(isMuleRuledOut({ truckAccess: 'no', pathWidth: 'narrow', turn: 'tight', removable: 'fence' })).toBe(false);
  expect(isMuleRuledOut({ truckAccess: 'no', pathWidth: 'narrow', removable: 'other' })).toBe(false);
  expect(isMuleRuledOut({ truckAccess: 'no', pathWidth: 'narrow', removable: 'no' })).toBe(true);
  expect(isMuleRuledOut({ truckAccess: 'no', pathWidth: 'narrow', removable: 'unsure' })).toBe(true);
});
it('removable does not rescue overhead or steep ground', () => {
  expect(isMuleRuledOut({ truckAccess: 'no', overhead: 'other', removable: 'fence' })).toBe(true);
  expect(isMuleRuledOut({ truckAccess: 'no', pathGround: 'steep' })).toBe(true);
  expect(isMuleRuledOut({ truckAccess: 'no', pathGround: 'shortSteps' })).toBe(false);
});
it('panelRoute always shows; water distance and door are gone', () => {
  const v = visibleQuestions({});
  expect(v).toContain('panelRoute');
  expect(v).not.toContain('waterDistance' as never);
  expect(v).not.toContain('door' as never);
});
```

In `tests/core/data.test.ts`, add: `expect([MULE_MAX_SLOPE_DEG, MULE_MAX_STEP_FT, MULE_RAMPS]).toEqual([10, 1.5, 250])`.

- [ ] **Step 3: Run the tests to see them fail**

Run: `npx vitest run tests/core/questions.test.ts tests/core/data.test.ts`
Expected: FAIL (no `QUESTION_GROUP`, wrong order).

- [ ] **Step 4: Implement types, data and questions**

`isMuleRuledOut` = truck ≠ yes **and** (((pathWidth narrow **or** turn tight) **and not** `isRemoved`) **or** overhead other **or** pathGround steep). Visibility:
- `turn`: same as `pathWidth`.
- `removable`: truck ≠ yes **and** (pathWidth narrow **or** turn tight).

Other files will fail to compile after this step. That's expected until Tasks 2 to 7. Run only the two test files here.

- [ ] **Step 5: Run the tests to see them pass**

Run: `npx vitest run tests/core/questions.test.ts tests/core/data.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/assessment/core/types.ts src/assessment/core/questions.ts src/assessment/core/data.ts tests/core/questions.test.ts tests/core/data.test.ts
git commit -m "feat(v3): new question set, groups and removable-obstacle mule rule"
```

---

### Task 2: Recommendation rules

**Files:**
- Modify: `src/assessment/core/types.ts`, `src/assessment/core/rules.ts`
- Test: `tests/core/rules.test.ts`

**Interfaces:**
- Consumes: Task 1's `Answers`, `isRemoved` and `isMuleRuledOut`.
- Produces, in `types.ts`:
  - `ReasonCode`: `'pathSteps'` is renamed to `'pathSteep'`, and `'pathTurn'` is added.
  - `NoteCode = 'softGround' | 'twelveHalfBathOnly' | 'kitUnloading' | 'clearance'`. The `panelUpgrade` and `flipNotAvailable` codes are removed.
  - `Recommendation` gains three fields:
    - `ramps: boolean`
    - `takeDown: 'fence' | 'other' | null`
    - `hardSurface: boolean`
  - `Recommendation.door` keeps its type but is always `'standard'`.
- Produces: `recommend(snapshot, answers, modelOverride?)`, same signature.

- [ ] **Step 1: Write the failing tests in `tests/core/rules.test.ts`**

Update the starting-card test to:

```ts
expect(recommend(snapshot, {})).toEqual({
  model: 'sixteen', method: 'tiltTrailer', craneFrom: null, base: 'gravel',
  methodReason: null, baseReason: null, bathroom: 'none', door: 'standard',
  ramps: false, takeDown: null, hardSurface: false, toCheck: [], notes: [],
});
```

Replace `'steps'` with `'steep'` and `'pathSteps'` with `'pathSteep'` in existing tests. Delete the flipped-door tests. Add:

```ts
it('removable fence keeps the shed mule and names it', () => {
  const r = recommend(snapshot, { truckAccess: 'no', pathWidth: 'narrow', removable: 'fence' });
  expect(r.method).toBe('shedMule');
  expect(r.takeDown).toBe('fence');
});
it('tight turn that cannot come down -> crane, reason pathTurn', () => {
  const r = recommend(snapshot, { truckAccess: 'no', turn: 'tight', removable: 'no' });
  expect(r.method).toBe('crane');
  expect(r.methodReason).toBe('pathTurn');
  expect(r.takeDown).toBeNull();
});
it('narrow beats turn as the reason', () => {
  expect(recommend(snapshot, { truckAccess: 'no', pathWidth: 'narrow', turn: 'tight' }).methodReason).toBe('pathNarrow');
});
it('removable unsure keeps the crane and goes on the rep list', () => {
  const r = recommend(snapshot, { truckAccess: 'no', pathWidth: 'narrow', removable: 'unsure' });
  expect(r.method).toBe('crane');
  expect(r.toCheck).toContain('removable');
});
it('short steps keep the mule and add ramps', () => {
  const r = recommend(snapshot, { truckAccess: 'no', pathGround: 'shortSteps' });
  expect(r.method).toBe('shedMule');
  expect(r.ramps).toBe(true);
});
it('ramps and take-down only apply to the shed mule', () => {
  const crane = recommend(snapshot, { truckAccess: 'no', overhead: 'other', pathGround: 'shortSteps', pathWidth: 'narrow', removable: 'fence' });
  expect(crane.method).toBe('crane');
  expect(crane.ramps).toBe(false);
  expect(crane.takeDown).toBeNull();
});
it('Review Focus 1: switching the truck answer to yes clears hidden effects', () => {
  const r = recommend(snapshot, { truckAccess: 'yes', pathWidth: 'narrow', removable: 'fence', pathGround: 'shortSteps' });
  expect(r).toMatchObject({ method: 'tiltTrailer', ramps: false, takeDown: null, methodReason: null });
});
it('hard surface between panel and spot', () => {
  expect(recommend(snapshot, { panelRoute: 'hard' }).hardSurface).toBe(true);
  expect(recommend(snapshot, { panelRoute: 'both' }).hardSurface).toBe(true);
  expect(recommend(snapshot, { panelRoute: 'soft' }).hardSurface).toBe(false);
  expect(recommend(snapshot, { panelRoute: 'unsure' }).toCheck).toContain('panelRoute');
});
it('no panel-upgrade note any more', () => {
  expect(recommend(snapshot, {}).notes).not.toContain('panelUpgrade' as never);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/core/rules.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement in `rules.ts`**

- Path cause, first match wins:
  1. narrow and not removed → `pathNarrow`
  2. tight and not removed → `pathTurn`
  3. overhead other → `overheadLow`
  4. otherwise → `pathSteep`
- `takeDown` = the `removable` value when `method === 'shedMule'` and `isRemoved(answers)`; otherwise `null`.
- `ramps` = `method === 'shedMule' && answers.pathGround === 'shortSteps'`.
- `hardSurface` = `panelRoute` is `'hard'` or `'both'`.
- `softGround` is noted only when `pathGround` is visible and `'soft'` (as today).
- `door` is always `'standard'`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run tests/core/rules.test.ts tests/core/questions.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/assessment/core/types.ts src/assessment/core/rules.ts tests/core/rules.test.ts
git commit -m "feat(v3): ramps, take-down and hard-surface in the recommendation"
```

---

### Task 3: Pricing

**Files:**
- Modify: `src/assessment/core/types.ts` (`CostLine.id`), `src/assessment/core/pricing.ts`
- Test: `tests/core/pricing.test.ts`

**Interfaces:**
- Consumes: `Recommendation.ramps` (Task 2), `MULE_RAMPS` (Task 1).
- Produces: `CostLine['id'] = 'shipping' | 'install' | 'base' | 'power' | 'plumbing' | 'ramps'`. The `door` id is removed. `priceRecommendation` keeps its signature.

- [ ] **Step 1: Write the failing tests**

Delete the flipped-door test. Change the plumbing tests so they no longer pass `waterDistance`. Add:

```ts
it('ramps add 250 with the shed mule and short steps', () => {
  const rec = recommend(snapshot, { truckAccess: 'no', pathGround: 'shortSteps' });
  const s = priceRecommendation(rec, seattle, {});
  if (s.mode !== 'range') throw new Error('expected range');
  expect(s.lines.find(l => l.id === 'ramps')).toEqual({ id: 'ramps', low: 250, high: 250, andUp: false, reference: false });
});
it('plumbing is priced at the 25-50 ft band with no distance question', () => {
  const rec = recommend(snapshot, { bathroom: 'half' });
  const s = priceRecommendation(rec, seattle, {});
  if (s.mode !== 'range') throw new Error('expected range');
  const p = s.lines.find(l => l.id === 'plumbing')!;
  expect(p.andUp).toBe(false);
  expect(p.low).toBe(72 * 50 + 1500);
});
```

The v2 worked example must still pass: Sixteen, Seattle, shed mule, gravel, panel 25–50, no bathroom → `$7,600 – $10,181`. Use whatever `seattle` location fixture the file already has.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/core/pricing.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement**

Plumbing calls `bandFeet(undefined)`. Push `fixed('ramps', MULE_RAMPS)` when `rec.ramps`. Remove the door block and the `FLIP_DOOR` import.

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run tests/core`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/assessment/core/types.ts src/assessment/core/pricing.ts tests/core/pricing.test.ts
git commit -m "feat(v3): ramps line, plumbing without a distance, no door line"
```

---

### Task 4: Question copy and the panel explainer

**Files:**
- Modify: `src/assessment/ui/questions-copy.ts`
- Test: `tests/ui/questions-copy.test.ts` (new)

**Interfaces:**
- Consumes: Task 1's `Answers` values and the `MULE_*` constants.
- Produces:
  - `QuestionCopy` gains `steps: string[]`: the numbered how-to-measure steps. Step *n* matches callout *n* in the drawing (Task 5). `help` stays as the one-paragraph intro.
  - `export const PANEL_EXPLAINER: { title: "What's an electrical panel?"; paragraphs: string[] }`

- [ ] **Step 1: Write the failing tests**

```ts
const ALL: QuestionId[] = QUESTION_ORDER;
it('every visible question has copy, steps and an "I\'m not sure" option (except zip)', () => {
  for (const id of ALL) {
    const c = questionCopy(id, 'sixteen');
    expect(c.title.length).toBeGreaterThan(0);
    expect(c.steps.length).toBeGreaterThan(0);
    if (id !== 'zip') expect(c.options.at(-1)).toEqual({ value: 'unsure', label: "I'm not sure" });
  }
});
it('option values match the Answers types', () => {
  const values = (id: QuestionId) => questionCopy(id, 'sixteen').options.map(o => o.value);
  expect(values('pathGround')).toEqual(['solid', 'soft', 'shortSteps', 'steep', 'unsure']);
  expect(values('turn')).toEqual(['none', 'roomy', 'tight', 'unsure']);
  expect(values('removable')).toEqual(['fence', 'other', 'no', 'unsure']);
  expect(values('panelRoute')).toEqual(['soft', 'hard', 'both', 'unsure']);
});
it('exact titles and labels the spec fixes', () => {
  expect(questionCopy('removable', 'sixteen').title).toBe('Could everything that makes it narrow or tight come down and go back up?');
  expect(questionCopy('panelRoute', 'sixteen').title).toBe("What's between the panel and the spot?");
  expect(questionCopy('pathGround', 'sixteen').options[0]!.label).toBe('Solid, flat or a gentle slope (under about 10°)');
  expect(questionCopy('pathGround', 'sixteen').options[2]!.label).toBe('A few short steps (under 1.5 ft)');
  expect(questionCopy('turn', 'twelve').options[1]!.label).toContain('20 ft');
  expect(questionCopy('turn', 'sixteen').options[1]!.label).toContain('24 ft');
});
it('panel explainer covers what, looks and where', () => {
  const t = PANEL_EXPLAINER.paragraphs.join(' ');
  for (const w of ['garage', 'basement', 'meter', 'electrician']) expect(t).toContain(w);
});
it('no forbidden topics in any client copy', () => {
  const blob = JSON.stringify([...ALL.map(id => questionCopy(id, 'station')), PANEL_EXPLAINER]).toLowerCase();
  for (const w of ['permit', 'septic', 'amperage', 'internet']) expect(blob).not.toContain(w);
  expect(blob).not.toMatch(/\bamps?\b|\b(30|50) ?a\b/);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/ui/questions-copy.test.ts`
Expected: FAIL

- [ ] **Step 3: Write the copy**

The fixed strings:

| id | title | options (value: label) |
|---|---|---|
| turn | `Does the pod have to go around a tight corner on the way in?` | none: `No, it's a straight way in` · roomy: `A turn with plenty of room (about {24 or 20} ft across)` · tight: `A tight turn` · unsure |
| removable | `Could everything that makes it narrow or tight come down and go back up?` | fence: `Yes, a fence section or gate` · other: `Yes, something else, like a planter or a small shed` · no: `No` · unsure |
| pathGround | `What's the way in like underfoot?` | solid: `Solid, flat or a gentle slope (under about 10°)` · soft: `Soft ground, like a lawn` · shortSteps: `A few short steps (under 1.5 ft)` · steep: `A steep slope or a staircase` · unsure |
| panelRoute | `What's between the panel and the spot?` | soft: `Lawn or dirt` · hard: `A driveway, patio or path` · both: `Both` · unsure |

Build 10°, 1.5 and the turn figure from the constants (20 ft for the Twelve, 24 ft otherwise, as today). The bathroom help drops "water and sewer line run from the house". It says only that a plumber connects it, with no distance. Remove the `waterDistance` and `door` cases. Write every other `steps` list, and the `PANEL_EXPLAINER` paragraphs, from spec §5.1 (what the panel is, what it looks like, where it usually is, and that the client doesn't need to know anything about it because the electrician checks it). Plain English.

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run tests/ui/questions-copy.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/assessment/ui/questions-copy.ts tests/ui/questions-copy.test.ts
git commit -m "feat(v3): copy for the new questions, numbered steps and the panel explainer"
```

---

### Task 5: Drawings

**Files:**
- Modify: `src/assessment/ui/drawings.ts` (rewrite)
- Test: `tests/ui/drawings.test.ts` (new)

**Interfaces:**
- Consumes: `questionCopy(id, model).steps` (Task 4), `MODELS`.
- Produces:
  - `drawing(id: QuestionId, model: ModelId): string`. The signature gains `model`.
  - `panelDrawing(): string`: the panel itself, door open, rows of breakers, main breaker at the top.

Style (spec §7):
- a side or top view, following FAQ v4's Q092 diagram (`scratchpad/faq-dl/faq-v4.html` in the session scratchpad; if it isn't there, use the Q092 description in spec §7)
- each callout is a numbered circle carrying `data-callout="n"`
- dimension lines are labelled with the model's figure
- red `#ED3648` marks what the question is about, dark blue `#535266` the lines, sand `#E3CDBF` the fills
- readable at 320 px wide
- constant strings, built from small helpers as today; no external images

- [ ] **Step 1: Write the failing tests**

```ts
it('every question has a drawing whose callouts match its steps', () => {
  for (const model of ['twelve', 'sixteen', 'station'] as const) {
    for (const id of QUESTION_ORDER) {
      const svg = drawing(id, model);
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg).toContain('role="img"');
      const callouts = svg.match(/data-callout="\d+"/g) ?? [];
      expect(callouts.length).toBe(questionCopy(id, model).steps.length);
    }
  }
});
it('dimension labels use the model figures', () => {
  expect(drawing('pathWidth', 'twelve')).toContain('10 ft');
  expect(drawing('pathWidth', 'sixteen')).toContain('12 ft');
  expect(drawing('overhead', 'station')).toContain('13 ft');
  expect(drawing('turn', 'sixteen')).toContain('24 ft');
});
it('panel drawing exists', () => expect(panelDrawing()).toContain('role="img"'));
it('no external references', () => {
  for (const id of QUESTION_ORDER) expect(drawing(id, 'sixteen')).not.toMatch(/href=|src=|url\(/);
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/ui/drawings.test.ts`
Expected: FAIL

- [ ] **Step 3: Draw all 15 questions plus the panel**

The new scenes, from spec §7:
- `turn`: a top view of the corner, with the turning room marked
- `removable`: a fence section lifted out and set aside
- `panelRoute`: a side view of the line over lawn vs. under a driveway

Redraw the rest so each shows exactly what to look at.

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run tests/ui/drawings.test.ts`
Expected: PASS

- [ ] **Step 5: Render all drawings for a visual check**

Write a throwaway HTML file in the session scratchpad that inlines `drawing(id, 'sixteen')` for every id, plus `panelDrawing()`. Look at it in the browser pane at 360 px and 1024 px widths. Fix anything unreadable. Don't commit the file.

- [ ] **Step 6: Commit**

```bash
git add src/assessment/ui/drawings.ts tests/ui/drawings.test.ts
git commit -m "feat(v3): redraw the question drawings with numbered callouts"
```

---

### Task 6: Headline, walk-through and rep-list copy

**Files:**
- Modify: `src/assessment/ui/copy.ts`
- Create: `src/assessment/ui/plan-copy.ts`
- Test: `tests/ui/copy.test.ts` (new), `tests/ui/plan-copy.test.ts` (new)

**Interfaces:**
- Consumes: `Recommendation` (Task 2), `Location`.
- Produces, in `copy.ts`:
  - `headline(rec: Recommendation): string` replaces `methodTitle`
  - `REP_LIST_TITLE = "We'll check these with you on the call"`
  - `toCheckText(code)` is rewritten as topic phrases for the rep list, e.g. `'truckAccess'` → `Whether a truck can drive up to the spot`
  - `noteText` loses the removed codes
  - `reasonText` gains `pathTurn` and renames `pathSteps` to `pathSteep`
- Produces, in `plan-copy.ts`:
  - `export interface PlanStep { id: 'delivery' | 'base' | 'power' | 'water'; title: string; lines: string[]; link: { href: string; label: string } | null }`
  - `planSteps(rec: Recommendation, location: Location | null): PlanStep[]`

Headline rule, `You can have a {Name} {method phrase}. You'll need {list}.`:
- Method phrases:
  - tiltTrailer: `delivered on a tilt trailer`
  - shedMule: `delivered by truck and shed mule`
  - crane: `lifted in by crane`
  - kit: `brought in as a kit and built on the spot`
- When `base === 'existing'`, append ` onto your existing base`.
- The list, in order:
  - `a gravel pad` (gravel) or `a raised base` (raised)
  - `an outdoor outlet` (always)
  - `a plumber for the bathroom` (bathroom ≠ none)
- Join the list as "a, b and c".
- Talk: `Your yard needs a closer look. Let's work out the best way in together.`

Walk-through lines. "Covered" means `location?.inCoverage === true`.
- **Delivery**, by method:
  - tiltTrailer: `Your pod arrives on a tilt trailer and slides off right at the spot.`
  - shedMule: `A truck brings your pod, and a small mover (a shed mule) rolls it the last stretch.`
  - crane: `A crane lifts your pod from the street onto the spot.`
  - kit: `Your pod arrives as a kit, and a local crew builds it on the spot.`
  - talk: `We'll work out the best way in with you on a call.`

  Then:
  - covered: `Mini·O arranges this.`
  - location known but not covered: `Mini·O ships it; your local crew takes it from there.`
  - location null: no line
  - takeDown fence: `The fence section or gate comes down on delivery day and goes back up after.`
  - takeDown other: `What's in the way comes down on delivery day and goes back up after.`
  - ramps: `Ramps go over the steps.`
  - then the `softGround` and `kitUnloading` note texts, when present
- **Base**:
  - gravel, covered: `A local contractor lays a gravel pad. Mini·O arranges this.`
  - gravel, otherwise: `Your contractor lays a gravel pad. Give them this sheet.` (link to the base sheet)
  - existing: `Your pod goes on your existing base. We'll confirm it's big enough and level.`
  - raised: `The ground is too steep for a gravel pad, so the pod needs a raised base. We'll price it with you in person.`
  - then the `clearance` note text, when present
- **Power**:
  - always: `An electrician adds an outdoor outlet near the pod and a breaker in your panel, and checks your panel has room.` followed by `Your electrician or general contractor can handle this. Give them this sheet.`
  - covered only: `Or we can help arrange one for you.`
  - hardSurface: `Your electrician will plan the route around or under the paved part.`
  - link to the power sheet: `contractor/power.html?model={model}&door=standard`
- **Water**: only when bathroom ≠ none. The verbatim Global Constraints text, with no link.

Link labels: `Get the base spec for your contractor` and `Get the power spec for your contractor`. Base href: `contractor/base.html?model={model}`.

- [ ] **Step 1: Write the failing tests**

```ts
// copy.test.ts
const rec = (o: Partial<Recommendation>): Recommendation => ({ ...recommend(snapshot, {}), ...o });
it('headline examples from the spec', () => {
  expect(headline(rec({ method: 'shedMule' }))).toBe("You can have a Sixteen delivered by truck and shed mule. You'll need a gravel pad and an outdoor outlet.");
  expect(headline(rec({ model: 'twelve', base: 'existing' }))).toBe("You can have a Twelve delivered on a tilt trailer onto your existing base. You'll need an outdoor outlet.");
  expect(headline(rec({ method: 'crane', bathroom: 'shower' }))).toBe("You can have a Sixteen lifted in by crane. You'll need a gravel pad, an outdoor outlet and a plumber for the bathroom.");
  expect(headline(rec({ method: 'talk' }))).toBe("Your yard needs a closer look. Let's work out the best way in together.");
});
it('every rep-list code has text', () => {
  for (const id of QUESTION_ORDER) expect(toCheckText(id).length).toBeGreaterThan(0);
});

// plan-copy.test.ts
it('Review Focus 4: no ZIP -> no arranging claims', () => {
  const all = planSteps(rec({}), null).flatMap(s => s.lines).join(' ');
  expect(all).not.toContain('Mini·O arranges');
  expect(all).not.toContain('help arrange');
});
it('covered: arranges delivery, base and offers an electrician', () => {
  const steps = planSteps(rec({}), seattleCovered);
  expect(steps.map(s => s.id)).toEqual(['delivery', 'base', 'power']);
  expect(steps[0]!.lines).toContain('Mini·O arranges this.');
  expect(steps[2]!.lines).toContain('Or we can help arrange one for you.');
  expect(steps[2]!.link!.href).toBe('contractor/power.html?model=sixteen&door=standard');
});
it('outside coverage: own contractor, sheets linked, no arranging offer', () => {
  const steps = planSteps(rec({}), outside);
  expect(steps[1]!.link!.href).toBe('contractor/base.html?model=sixteen');
  expect(steps[2]!.lines).not.toContain('Or we can help arrange one for you.');
});
it('bathroom adds the water step, verbatim', () => {
  const water = planSteps(rec({ bathroom: 'half' }), null).find(s => s.id === 'water')!;
  expect(water.lines).toEqual(['Your pod will need a licensed plumber to connect it to your water and sewer. We can help coordinate one, or if you have someone you trust, even better.']);
});
it('take-down, ramps and hard surface lines', () => {
  const s = planSteps(rec({ method: 'shedMule', takeDown: 'fence', ramps: true, hardSurface: true }), null);
  expect(s[0]!.lines).toContain('The fence section or gate comes down on delivery day and goes back up after.');
  expect(s[0]!.lines).toContain('Ramps go over the steps.');
  expect(s[2]!.lines).toContain('Your electrician will plan the route around or under the paved part.');
});
it('no forbidden topics in any plan text', () => {
  const variants = [rec({ bathroom: 'shower', method: 'kit' }), rec({ method: 'talk', base: 'raised' })];
  const blob = variants.flatMap(r => [headline(r), ...planSteps(r, outside).flatMap(s => s.lines)]).join(' ').toLowerCase();
  for (const w of ['permit', 'septic', 'amperage']) expect(blob).not.toContain(w);
  expect(blob).not.toMatch(/\bamps?\b|\b(30|50) ?a\b/);
});
```

Location fixtures: build `seattleCovered` and `outside` with `lookupLocation`. Use one Seattle ZIP, and one ZIP in a region outside the install areas (e.g. a Texas ZIP).

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/ui/copy.test.ts tests/ui/plan-copy.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `headline`, `planSteps`, `REP_LIST_TITLE` and the rewritten `toCheckText`**

A kit is built on site, so it's fine to say so. What must never appear is any link between a bathroom and on-site work: the Water step says nothing beyond the verbatim text.

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run tests/ui/copy.test.ts tests/ui/plan-copy.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/assessment/ui/copy.ts src/assessment/ui/plan-copy.ts tests/ui/copy.test.ts tests/ui/plan-copy.test.ts
git commit -m "feat(v3): headline, walk-through and rep-list copy"
```

---

### Task 7: Screen 2 UI, the Your plan panel and print

**Files:**
- Create: `src/assessment/ui/plan-view.ts`, `src/assessment/ui/plan-view.css`
- Modify: `src/assessment/ui/card.ts`, `src/assessment/ui/question-view.ts`, `src/assessment/ui/app.ts`, `src/assessment/ui/print.ts`, `src/assessment/styles.css` (remove the `.mo-end` rules)
- Test: `tests/ui/card.test.ts`, `tests/ui/question-view.test.ts`, `tests/ui/app.test.ts`, `tests/ui/plan-view.test.ts` (new)

**Interfaces:**
- Consumes:
  - from Task 6: `headline`, `planSteps`, `REP_LIST_TITLE`, `toCheckText`
  - from Task 5: `drawing(id, model)`, `panelDrawing()`
  - from Task 4: `PANEL_EXPLAINER`, `QuestionCopy.steps`
  - from Task 1: `QUESTION_GROUP`
- Produces:
  - `renderPlan(el: HTMLElement, view: PlanView): void`, where `PlanView = { rec; cost; lead; location; offerPrint: boolean }`
  - in plan-view, `talkFirst(rec): boolean`, true when `rec.toCheck.length > 0`

What changes:
- **Card:**
  - The title becomes `headline(rec)`.
  - The "To check" heading becomes `REP_LIST_TITLE`.
  - When `talkFirst`, the buttons are ordered Let's talk (primary), then Design my pod (secondary), in both the full card and the phone bar.
  - The card's `contractorLinks` goes away, since the links now live in the plan steps.
- **Question view:**
  - The progress line reads `{QUESTION_GROUP[id]} · Question {n} of {total}`.
  - The help shows `help`, then an `<ol>` of `steps`.
  - For `panelDistance`, a `PANEL_EXPLAINER` block with `panelDrawing()` follows.
  - `drawing(q.id, q.model)`.
  - The power spec link uses `door=standard`.
- **Plan view (replaces `renderEnd`):**
  - an `h2` with the headline
  - the Twelve-with-shower note when present
  - an `<ol>` of steps: each shows title, lines, and the link (opens in a new tab, `rel="noopener"`)
  - the rep list (heading plus `<ul>`), only when not empty
  - when `talkFirst`, the line `Book a call and we'll go over these with you.`
  - the price block: cost line, side items, disclaimer, breakdown, lead time, coverage, reusing the copy functions
  - the buttons, ordered as on the card, then `Save my plan`, then `Print / save as PDF` when `offerPrint`, then `Back`
  - the events it emits are the same `minio:cta` / `minio:print` / `minio:back` as today
- **App:**
  - `STORAGE_KEY = 'minio-assessment-v3'`
  - `renderEnd` is replaced by `renderPlan`
  - in the switch-model handler, when the current question isn't visible, go to `pathWidth` if visible, otherwise to the first visible question
- **Print:**
  - `headline` replaces `methodTitle`
  - add the plan steps as a numbered list
  - the rep-list heading becomes `REP_LIST_TITLE`

- [ ] **Step 1: Write the failing tests**

```ts
// plan-view.test.ts (jsdom)
it('shows headline, steps, rep list and talk-first buttons', () => {
  const r = recommend(snapshot, { truckAccess: 'unsure' });
  renderPlan(el, { rec: r, cost: priceRecommendation(r, null, {}), lead: leadTime(r, null), location: null, offerPrint: false });
  expect(el.querySelector('h2')!.textContent).toBe(headline(r));
  expect(el.querySelectorAll('ol > li').length).toBe(3);
  expect(text(el)).toContain("We'll check these with you on the call");
  expect(text(el)).toContain("Book a call and we'll go over these with you.");
  const buttons = [...el.querySelectorAll('button')].map(b => b.textContent);
  expect(buttons.slice(0, 2)).toEqual(["Let's talk", 'Design my pod']);
});
it('empty rep list: no list, Design my pod first', () => {
  const r = recommend(snapshot, {});
  renderPlan(el, { rec: r, cost: priceRecommendation(r, null, {}), lead: leadTime(r, null), location: null, offerPrint: false });
  expect(text(el)).not.toContain("We'll check these with you on the call");
  expect(el.querySelector('button')!.textContent).toBe('Design my pod');
});

// question-view.test.ts
it('progress line shows the group', () => { /* render 'turn' at index 2 of 10 */ expect(text(el.querySelector('.mo-q__progress')!)).toBe('Getting it there · Question 3 of 10'); });
it('panel question shows the explainer and its drawing', () => { /* render panelDistance */ expect(text(el)).toContain("What's an electrical panel?"); });
it('help lists the numbered steps', () => { /* render pathWidth */ expect(el.querySelectorAll('.mo-q__help ol li').length).toBe(questionCopy('pathWidth', 'sixteen').steps.length); });

// app.test.ts
// change STORAGE_KEY to 'minio-assessment-v3' and drop flows that answer waterDistance or door.
it('Review Focus 2: a v2 session is ignored', () => {
  const storage = fakeStorage();
  storage.setItem('minio-assessment-v2', JSON.stringify({ snapshot, answers: { door: 'flipped' }, currentId: 'door' }));
  const app = createApp(root, { ...deps, storage });
  expect(app.restore()).toBeNull();
});
it('Review Focus 3: switching model while on removable lands on a visible question', () => {
  // start with a Twelve, answer truckAccess no, pathWidth narrow; now on 'turn'; answer turn none -> on 'removable';
  // dispatch minio:switch-model 'sixteen' (different minPathWidth clears pathWidth)
  // expect the rendered question title to be questionCopy('pathWidth', 'sixteen').title
});
it('the end shows the Your plan panel', () => { /* answer every visible question; expect h2 === headline(rec) */ });

// card.test.ts
it('card title is the headline and the rep-list heading is renamed', () => { /* ... */ });
```

Fill the elided bodies using the helpers each test file already has.

- [ ] **Step 2: Run the tests to see them fail**

Run: `npx vitest run tests/ui`
Expected: FAIL

- [ ] **Step 3: Implement the UI changes above**

Keep building DOM with `createElement` and `textContent`. The drawings stay the only `innerHTML`. `plan-view.css` follows the look of `card.css`: same fonts, colours and button classes (`mo-btn`, `mo-btn--primary`, `mo-btn--secondary`).

- [ ] **Step 4: Run the full suite and the build**

Run: `npm test && npm run build`
Expected: all tests PASS, and `tsc` has no errors.

- [ ] **Step 5: Commit**

```bash
git add src/assessment tests/ui
git commit -m "feat(v3): Your plan panel, grouped questions, headline card and print"
```

---

### Task 8: Airtable version, final check in the browser

**Files:**
- Modify: `src/server/airtable-fields.ts`
- Test: `tests/server/submit.test.ts`

**Interfaces:**
- Consumes: everything above. `SubmissionPayload` is unchanged.

- [ ] **Step 1: Write the failing test**

In `tests/server/submit.test.ts`:
- `expect(fields['Assessment Version']).toBe('v3')`
- `expect(fields['Door']).toBe('Standard')`
- a payload whose answers include `turn: 'tight'` has `fields['Answers']` containing `questionCopy('turn','sixteen').title`. Build the payload with `buildReadable` as `app.ts` does.

Remove fixtures that use `waterDistance` or `door`.

- [ ] **Step 2: Run the test to see it fail**

Run: `npx vitest run tests/server`
Expected: FAIL on the version.

- [ ] **Step 3: Set `'Assessment Version': 'v3'`**

- [ ] **Step 4: Run everything**

Run: `npm test && npm run build`
Expected: PASS

- [ ] **Step 5: Check it in the browser**

Start the site with the existing `.claude/launch.json` entry for this project. If there isn't one, add one serving the repo root as static files. Then walk through three clients at phone width (375 px) and desktop:
1. **Truck can reach, Seattle ZIP, no bathroom.** Expect a tilt-trailer headline, three steps, and no rep list.
2. **Truck can't reach, narrow path, fence can come down, short steps, bathroom.** Expect a shed-mule headline, take-down and ramps lines, a water step, and a $250 ramps line in the breakdown.
3. **"I'm not sure" on several questions, no ZIP.** Expect the rep list, Let's talk first, and no "Mini·O arranges".

Also check that the console has no errors, and that the drawings and panel explainer render. Don't submit the lead form against production Airtable.

- [ ] **Step 6: Commit**

```bash
git add src/server/airtable-fields.ts tests/server/submit.test.ts
git commit -m "feat(v3): mark submissions as v3"
```
