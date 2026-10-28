# Readiness Assessment overhaul — design

Date: 2026-10-28
Owner: Fred Serrano (Mini·O)
Status: draft for review

## 1. Intent

The Readiness Assessment (`index.html`, deployed on Netlify) is where a Mini·O
prospect checks whether a pod can go in their yard. Today it is a yard planner
followed by five pages of questions and a "readiness report" with statuses.
Prospects don't know what they're getting into: what it takes, who handles it,
or what it costs beyond the pod.

The overhaul keeps the yard planner and replaces everything after it with one
screen: a **live recommendation card on top** and **one question at a time
below**. The card always shows the simplest way to get the client's pod
installed, with price ranges for delivery and site work. It changes only when
an answer gives a reason to. The client can leave at any point to design their
pod or talk to sales.

Who uses it: homeowners with no technical or construction knowledge. Every
question needs a simple drawing and a plain-English "what does this mean, and
how do I measure it?" section. Sales reps (not Peter) follow up on every lead.

Source material: Peter's ClickUp task 86b4dmz6y "Getting Ready / readiness
quiz - web" and his meeting notes; the sales feasibility checklist (Sales
Resources doc 2y90f-3725, page 2y90f-9734); the 🚦 pricing Google Sheet
(tabs listed in §8); the Ops "Delivery & Installations - FAQ" (doc 2y90f-6654,
page 2y90f-7754); the flat-pack kit FAQ (task 86b7t4dzt); the Red Glove
MasterDoc (2y90f-12474); backyardpod.com/design.html as a reference pattern.

## 2. Goals

1. Answer what the client actually wants to know: what they're getting, how
   complex it is, who handles each part, and roughly what it costs on top of
   the pod.
2. Default to the simplest, cheapest path and escalate only on evidence:
   **pre-built delivered by truck (tilt trailer or shed mule) → pre-built
   lifted by crane → kit assembled on site**. Steer toward gravel over concrete.
3. Show **ranges, never final prices**. Outside Mini·O's install areas, show
   the same numbers as a labelled reference.
4. Teach as it asks: every question has a drawing and a how-to-measure section.
5. Capture the lead (email) before the client leaves for the configurator or
   the Let's Talk page, and save everything sales needs to follow up.
6. Give clients who use their own contractor printable spec sheets for the base
   and the power hookup.

## 3. Non-goals

- **Permits, HOA, setbacks.** Removed entirely, per Peter. The permitting
  engine (`permitting-engine/`) stays separate and is not touched.
- Deep-linking the Tiny Easy configurator to a pre-selected model.
- Any automated email to the client. Sales reps follow up personally.
- Sending leads to Zoho. Leads stay in Airtable.
- The Nine and pods on trailers (the planner doesn't offer them).
- Snow-load, flood or seismic foundations, septic systems, solar, financing.
- Redesigning the yard planner. It changes only where it hands off to screen 2
  and by losing the setback outline (§5.1).

## 4. Constraints

- **Stack:** the site is a single static `index.html` (vanilla JS/CSS, 3,257
  lines) with Netlify functions in `netlify/functions/`. New code is
  **TypeScript**, compiled into one script that `index.html` loads. The yard
  planner code stays as it is. Package manager: npm. Netlify currently has no
  build step (its build command only deletes internal files), so it gains
  `npm ci && npm run build` ahead of the existing `rm -rf …`. Node 18 is
  pinned in `netlify.toml`.
- **Tests:** the pricing and recommendation rules live in their own module with
  unit tests. A wrong price must fail a test before it reaches a client.
- **Internal numbers stay internal.** The 🚦 sheet's per-mile rates and ops
  formulas ("OPS ONLY - KEEP HIDDEN") must not appear in the shipped code. Only
  the client-facing figures listed in §8 go in.
- **Wording:** Mini·O doesn't do site work itself. It arranges and coordinates
  local contractors (Red Glove MasterDoc). Copy says "Mini·O arranges a local
  contractor", never "Mini·O builds your gravel pad".
- **Lead times** are always phrased as "about N weeks after we receive
  payment", never as a date (🚦 Lead Times tab rule).
- `netlify.toml` sends `X-Frame-Options: DENY`. The page isn't embedded
  anywhere, so this doesn't matter today, but it would if someone later tries
  to embed it.

## 5. The flow

### 5.1 Screen 1: yard planner (one change)

The client sets the yard size, picks the model (Twelve 12×8, Sixteen 16×10,
Station 30×10), places and rotates the pod, adds trees and other objects, and
picks a use (Office / Studio / Guest Suite / Other). "Next" goes to screen 2.

**The one planner change:** remove the dashed "5 ft setback" outline and the
"Outside setback zone. Move the pod inward." warning (the `SETBACK` constant
and everything that uses it). Setbacks are out of scope (§3), and the only
space rule the client sees is the card's 3 ft clearance note (§6.2). Fred
approved this on 2026-10-28.

Existing bug, fixed for free: the Guest Suite button saves `guest` while the
old plumbing questions check for `guest_suite`, so they never show. Screen 2
replaces those questions with its own bathroom question.

### 5.2 Screen 2: card on top, one question below

The card is visible the whole time. Below it, one question at a time, with
Back / Next and a progress line ("Question 3 of 9"; the total updates as
questions are skipped). Answering a question updates the card right away. When
the card changes, it shows **what changed and why** in one line, e.g. "Changed:
crane delivery. Why: your gate is too narrow to roll the pod through, so a
crane lifts it over the house."

On narrow screens (phones), the card collapses into a slim bar fixed to the
bottom of the screen (model, delivery method, cost range, two buttons) that
expands on tap. This follows the backyardpod.com/design.html pattern.
*(My call: Fred to check this when reviewing.)*

### 5.3 The recommendation card

The card contains:

- **One photo of the recommended model** (simple exterior shot). It swaps when
  the model changes. Fred provides one photo each for the Twelve, Sixteen and
  Station.
- **Title**: "{Model}, delivered ready-built" / "{Model}, lifted in by crane" /
  "{Model} as a kit, assembled on site".
- **Pills**: Delivery: {tilt trailer | truck + shed mule | crane | kit} · Base:
  {gravel pad | your existing slab | raised base, priced in person}.
- **Cost line**: "Delivery and site prep: $X – $Y", with an expandable
  breakdown (shipping, installation method, base, power, water and sewer).
  Below it: "Your pod's price comes from the configurator. This is what goes
  on top of it." The card never shows a pod price or a grand total.
- **Lead time**: "Ready to ship about N weeks after we receive payment" (§8.6).
- **Coverage label**: inside an install area: "Mini·O arranges local
  contractors in your area." Outside: "We don't arrange contractors in your
  area yet. These prices are a reference for your own contractor." Before a
  ZIP is entered, the card shows only the lines that don't depend on location
  and says "Add your ZIP code to see delivery and local prices."
- **"To check" list**: one line for each "Not sure" answer (§6.2).
- **Buttons**: **Design my pod** → `https://minioffice.co/quote` · **Let's
  talk** → `https://minioffice.co/lets-talk`. Both go through the email step
  (§7). Always visible.

Mockups: `.superpowers/brainstorm/1672-1793211515/content/rec-card-layout-v3.html`
(layout approved; the starting card shows the tilt trailer, not the shed mule
as drawn; button labels change to the ones above and "Estimated total"
becomes the cost line above).

## 6. Questions and rules

### 6.1 The questions

Each question has: a simple line drawing (inline SVG, illustrative and not a
photo), 2 to 5 answer buttons including "I'm not sure", and a collapsed
"What does this mean, and how do I measure it?" section in plain English.

| # | Question | Asked when | Effect on the card |
|---|---|---|---|
| 1 | What's the ZIP code where the pod is going? | always | Sets the state (for shipping), the price region and coverage (§8.1). |
| 2 | Can a truck drive right up to the spot (driveway, open front yard)? | always | Yes or Not sure → stays **tilt trailer**, the starting default (§6.2). No → **truck + shed mule** (+$2,000). |
| 3 | How wide is the narrowest point on the way to the spot? | #2 ≠ Yes | Under the model's minimum (Twelve 10 ft; Sixteen and Station 12 ft) → shed mule ruled out. |
| 4 | Is anything lower than 12 ft (13 ft for the Station) over that path: branches, wires, a roof edge? | #2 ≠ Yes | "Only branches that can be trimmed" → no change. "Yes, something else" → shed mule ruled out. |
| 5 | Is the path solid and fairly flat, or are there steps, steep parts or soft ground? | #2 ≠ Yes | Steps or steep → shed mule ruled out. Soft ground → no change, plus a note that grass can get marked (stop watering a week before). |
| 6a | Are there power lines over the house or yard, between the street and the spot? | shed mule ruled out | Yes → crane ruled out. |
| 6b | About how far is the spot from the street? | shed mule ruled out and crane not ruled out | Up to 100 ft → **crane**, from $3,000. 100 to 150 ft → **crane**, from $4,000. Over 150 ft → crane ruled out. |
| 7 | Is there a way in at least {KIT_ACCESS} wide, like a side gate or a door? | crane ruled out | Yes → **kit** + assembly. No → card switches to "Let's talk": no automatic recommendation, and the cost line reads "We'll work this out with you". |
| 8 | Is there already a base where the pod goes? (concrete slab or patio / gravel pad / wood deck / no, it's grass or dirt) | always | Slab or gravel pad → base $0, with a "to check: big enough and level" note. Deck → "to check: we'll confirm it can hold the pod". No → #9. |
| 9 | Is the ground at the spot flat? (phone level app, shown how) | #8 = No | Flat or gentle (within {LEVEL_CUTOFF}) → **gravel pad**. Steep → **raised base, priced in person**, with a reference "from" figure. |
| 10 | Will the pod have a bathroom? (no / half bath / bath with shower) | always | Adds the water and sewer line (#11) and +2 weeks lead time. Twelve with shower → note "The Twelve fits a half bath only" plus a "Switch to the Sixteen" button. *(My call.)* |
| 11 | How far are the house's water and sewer lines from the spot? (under 25 / 25–50 / 50–100 / over 100 ft / not sure) | #10 ≠ No | Sets the water and sewer price (§8.4). |
| 12 | How far is the house's electrical panel from the spot? (same distance bands) | always | Sets the power price (§8.4). Adds the note "Some homes need a panel upgrade (about $2,500)". |
| 13 | Which way should the door face? (drawing: standard vs. flipped) | always, last | Flipped → +$500, "available on select models" (§10). |

`{KIT_ACCESS}` and `{LEVEL_CUTOFF}` are open items (§10). Build them as single
constants.

Model minimums for #3 and #4 come from the Ops FAQ and Peter's task: shed mule
path = 10 ft wide for the Twelve, 12 ft for the Sixteen and Station; overhead
12 ft, 13 ft for the Station. If the pod has to turn along the way, the shed
mule needs a 24 ft turning radius (20 ft for the Twelve). That goes in #3's
how-to-measure text and doesn't need its own question.

### 6.2 Rules

- **Starting card (nothing answered yet)**: the planner's model, pre-built,
  **tilt trailer** (Fred's rule: the easiest and cheapest option is always the
  default), **gravel pad**, no bathroom, power at the 25–50 ft band, no ZIP (so
  no shipping or regional prices yet; gravel and power show the reference
  ranges). Every unanswered question uses these defaults. The only difference
  between "unanswered" and "I'm not sure" is that "not sure" adds a "To check"
  line.
- **Escalation order is fixed**: tilt trailer → shed mule → crane → kit →
  "Let's talk". A step is only skipped when an answer rules it out. Most
  backyard clients will answer "No" to #2, so expect the cost range to rise by
  $2,000 at that point. That's intended: the card starts at the cheapest
  option and moves only on the client's answers.
- **"I'm not sure" never changes the recommendation.** It keeps the current recommendation, adds
  a line to the card's "To check" list ("Measure the narrowest point on the
  way in"), and opens the how-to-measure section. *(My call: this follows
  "default to standard unless the client gives a reason".)*
- **Going back** and changing an answer recomputes everything from scratch, so
  the order answers were given in never matters.
- **Space around the pod** comes from the planner, not a question. If the pod
  is less than 3 ft from any placed object or the yard edge, the card shows
  "Leave about 3 ft clear around the pod for installation and service" with a
  link back to the planner. It doesn't change the price. *(My call.)*
- **The kit** card also says that unloading isn't included in shipping (the
  client or their contractor unloads it) and that it needs dry storage while
  waiting for assembly (§10, item 5).
- **Changing models** isn't something screen 2 does on its own. Only the
  explicit "Switch to the Sixteen" button (#10) or going back to the planner
  changes it.

## 7. Lead capture

**Design my pod**, **Let's talk** and the end-of-questions **Save my plan**
button all open the same small form:

- Email (required), first name (optional), phone (optional).
- Line: "We'll save your plan so a Mini·O advisor can pick up where you left
  off."
- On submit, POST to `/.netlify/functions/submit`. Then: Design my pod → open
  `minioffice.co/quote` in the same tab; Let's talk → `minioffice.co/lets-talk`;
  Save my plan → show "Saved. A Mini·O advisor will reach out" plus **Print /
  save as PDF** (browser print with print CSS).
- If the submission fails, show the error and a **Try again** button. Also
  show a small "Continue without saving" link so the client is never stuck.
  *(My call, and the one place I'm adding a fallback: Fred to confirm.)*
- The email is entered once per session. After that, the buttons submit the
  updated plan with no form. **One Airtable record per session**: the first
  submit creates it and `submit.js` returns the record ID, which the browser
  keeps with the rest of the state. Later submits update that record, and
  "button clicked" holds every button used, in order. This avoids duplicate
  leads for sales. *(My call.)*
- No automated email is sent to the client.

**Saved per submission** (Airtable base `appj87SHEgZafCMC2`, table
`Submissions`): email, first name, phone, date, which button was clicked, ZIP,
state, price region, in coverage (yes/no), pod model, pod use, recommended
method, base, bathroom, door orientation, cost range low and high, shipping
estimate, lead time, the "To check" list, all answers (readable text), and the
planner snapshot (yard size, pod position and rotation, objects). The builder
writes the exact Airtable field list. **Fred adds those fields to the table
before deploy** (the Airtable connector isn't authorized in this
environment). `submit.js` is rewritten for the new fields. The old fields stay
in the table for past records.

The browser keeps state in sessionStorage under a new key
(`minio-assessment-v2`), so a client who comes back from the configurator in
the same tab finds their answers.

## 8. Pricing data

All figures come from the 🚦 Google Sheet ("🚦Shipping, Installation, Lead
time, Customizations, Extras, Site work, - Mini-O"), exported 2026-10-28. They
live in one TypeScript data file. Each value notes the source tab, and the file
has a "synced on" date. When the sheet changes, someone edits this file. There
is no live connection to the sheet.

### 8.1 Regions and coverage

- **Install areas (Red Glove)**: Western WA (King County, 150-mile radius, plus
  Orcas/San Juan islands), Bay Area (±2 h drive), Los Angeles (±2 h), San Diego
  (±1 h). The builder maps them by ZIP prefix. Fred reviews the list.
- **Price regions** (sheet columns): `WA` (Seattle area), `WA_OTHER`,
  `CA_NORTH`, `CA_SOUTH`, `NJ_NY`, `VA_PA_MD`. Regional figures apply wherever
  the ZIP falls in that region, but only the four install areas are labelled
  as covered. Everywhere else, including regions with sheet prices, uses the
  "reference" wording.
- ZIPs with no price region use the **reference figures** (§8.3).
- Canadian postal codes map to a province (first letter) for shipping only.
  Everything else uses reference figures.

### 8.2 Delivery

| Item | Figure | Source |
|---|---|---|
| Shipping | one figure per state/province, full list in **Appendix A**. Alaska, Hawaii and outside US/Canada → "quoted separately". California splits into North/South by ZIP, and Ontario into East/West by postal code. | Avg Shipping tab |
| Tilt trailer | included | Installation tab |
| Shed mule | +$2,000 | Installation tab |
| Crane | from $3,000 (≤100 ft) / from $4,000 (100–150 ft). Paid directly to the crane company. | ClickUp handbook (the sheet says "quote locally") |
| Kit unloading | not included. Client or contractor unloads. | Shipping Calculator tab |

The same state shipping figure is used for pre-built and kit. The sheet
averages them 70/30. *(My call.)*

### 8.3 Base and assembly (per model)

| | Twelve | Sixteen | Station |
|---|---|---|---|
| Gravel pad: WA | $2,500 | $3,000 | $6,000 |
| Gravel pad: WA_OTHER | $3,000 | $3,500 | — |
| Gravel pad: CA_NORTH / CA_SOUTH | $3,450 | $4,945 | $6,900 |
| Gravel pad: NJ_NY / VA_PA_MD | $3,000 | $3,500 | — |
| Raised base (reference "from"): WA | $8,500 | $14,025 | $19,500 |
| Raised base: CA | $9,775 | $16,129 | $22,425 |
| Kit assembly: WA | $7,000 | $8,300 | $12,500 |
| Kit assembly: WA_OTHER | $9,500 | $11,000 | — |
| Kit assembly: CA_NORTH | $7,000 | $9,000 | $13,095 |
| Kit assembly: CA_SOUTH | $7,000 | $11,000 | $15,800 |
| Kit assembly: **reference** (sheet's public column) | $10,000 | $12,000 | $16,500 |
| Gravel pad: **reference** | $2,500–$3,450 | $3,000–$4,945 | $6,000–$6,900 |

A "—" falls back to the reference figure. Use the non-permitted assembly rows
only.

### 8.4 Power, water and sewer

| Item | WA | CA_SOUTH | NJ_NY | Elsewhere |
|---|---|---|---|---|
| Power | low: $1,500 (post with 50A plug + cord, no trench, cord up to 50 ft); high: $80/ft + $81 (licensed, trenched) | $5,600 | $30/ft + $81 | reference: range across the known regions for that distance |
| Water | $25/ft + $750 | $2,500 (about 50 ft) | — | reference |
| Sewer | $47/ft + $750 | $5,500 (about 60 ft) | — | reference |
| Panel upgrade (note only, not added) | $2,500 | — | — | — |

Distance bands map to feet for the per-foot rows (under 25 → 25 ft, 25–50 →
50, 50–100 → 100, over 100 → 100 and labelled "and up"). "Not sure" uses the
25–50 band and adds a "To check". The builder settles the exact arithmetic and
documents it in tests.

### 8.5 Pod-side extras that touch site prep

Flipped door: +$500 (Customization & extras tab). Bathroom fixtures are priced
in the configurator and are **not** added on the card.

### 8.6 Lead times (weeks after payment is received)

The factory is the closer one, as listed in Appendix A. Where the sheet gives
the same distance from both, use Winlock WA, which has the shorter lead time.

| | WA factory | TN factory |
|---|---|---|
| Twelve / Sixteen pre-built | 5 | 6 |
| Station pre-built | 6 | 7 |
| Any kit | 4 | 5 |
| + bathroom | +2 | +2 |

### 8.7 How the cost line adds up

Low end = sum of each line's low figure. High end = sum of each line's high
figure. A line with a single figure counts the same at both ends. No padding is
invented. *(My call.)*

Three kinds of lines are shown **beside** the range rather than inside it,
because they have no upper figure or none at all *(my call)*:

- **Crane**: "+ crane, from $3,000" (or $4,000). This matches the approved
  mockup, and the client pays the crane company directly.
- **Raised base**: "+ raised base, from ${figure}, priced in person". The
  gravel pad line is removed when this applies.
- **Shipping "quoted separately"** (Alaska, Hawaii, outside US/Canada): the
  range excludes shipping and reads "+ shipping, quoted separately".

So the pricing module returns the range plus a list of these side items, and
the tests check both.

Worked example (in tests): Sixteen, Seattle-area ZIP, shed mule, gravel pad,
panel 25–50 ft, no bathroom: shipping $1,100 + mule $2,000 + gravel $3,000 +
power $1,500 – $4,081 = **$7,600 – $10,181**.

## 9. Contractor spec sheets

These are two printable pages on the same site, linked from the
how-to-measure sections of #8/#9 and #12, and placed on the card itself
outside install areas. Each one fills in the client's model.

**Base sheet**: pod size and weight (Twelve 4,600 lbs; Sixteen 7,200 lbs,
8,000 with bath; Station "ask your advisor"). Ground level within ¼ in. per
foot in any direction, so the sliding doors aren't damaged. **Gravel pad
(recommended)**: 6 in. of compacted ¾" crushed stone over a leveled subgrade,
optional geotextile fabric, extending 1 ft past the pod on every side for
drainage. **Concrete slab (alternative)**: spec pending (§10, item 1).

**Power sheet**: the pod needs a 50A, 240V connection. The inlet is a 50A
twist-lock (SS2-50R) on the back wall, about 3 ft off the ground: back right
corner on the standard layout, back left on the flipped one (the sheet uses
the client's #13 answer). Two ways to connect: an RV-style outlet plus a NEMA
14-50P → SS2-50R cord, or a buried hardwired line. If the pod has the mini-split
AC, don't use a GFCI breaker for the pod (the inverter trips it). Some homes
need a panel upgrade.

## 10. Open items for sales

The tool is built with the value marked "use for now". Items 1 to 2 must be
answered before launch, because they change what a question does.

1. **How level the ground must be** (sets `{LEVEL_CUTOFF}` in #9 and the base
   sheet). Ops FAQ: under 2° / ¼ in. per foot. Handbook slab spec: ¼ in. per
   10 ft. Use for now: ¼ in. per foot. **Blocks launch.**
2. **Kit access width** (`{KIT_ACCESS}` in #7). Kit FAQ: "any regular-sized
   door" (~3 ft). Peter's task: 4 ft. Use for now: 3 ft. **Blocks launch.**
3. **Concrete slab spec.** Kit FAQ: 5 in., #4 rebar 12 in. on center. Older
   notes: 4 in., 3,000 PSI, mesh. The base sheet shows "ask your advisor" until
   answered.
4. **Power for pods without a bathroom.** Ops FAQ (2024) allows 30A. Newer
   notes say always 50A. Use for now: 50A only.
5. **Kit unloading crew and storage.** Kit FAQ: 3 people, about 2 hours, 40 sq
   ft of dry storage, 3 ft walkway around the pod. Older notes: 2 people,
   about 1 hour, 4 ft. Use for now: the kit FAQ.
6. **Does the gravel pad spec apply to pre-built pods?** It's written in the
   kit FAQ, and a pre-built Sixteen weighs about 7,200 lbs.
7. **Shed mule charged twice?** The Installation tab adds $2,000. The Shipping
   Calculator also uses a higher per-mile rate when delivery is by mule, but
   that rate is internal and the per-state averages have no mule version. Use
   for now: the per-state shipping figure + $2,000 only.
8. **Flipped door**: which models offer it (the Station's front is different).
   Use for now: Twelve and Sixteen only.
9. **Missing regional figures**: CA North power, all NC figures, NJ/NY and
   VA/PA/MD beyond gravel pad, the Station in several regions. These use the
   reference figures until filled in.
10. **Station** weight and confirmed path clearance.

## 11. Left to the builder

- File layout, the build tool (esbuild or similar) and the test runner, within
  TypeScript + npm.
- How the TypeScript bundle hooks into `index.html`: replacing steps 1 to 5
  and the old report, contact form and `computeReport`, while leaving the
  planner (step 0) working.
- The drawings for each question (simple, consistent line drawings).
- First drafts of every question's how-to-measure text, from the facts in this
  document. Fred reviews the copy.
- The ZIP-prefix tables for states, price regions and install areas. Fred
  reviews the install-area list.
- The exact Airtable field names and the `submit.js` rewrite.
- Visual polish. The content and structure matter most. The look should stay
  clean, friendly and uncluttered.

## 12. Before launch

- Fred adds the new Airtable fields.
- Fred provides the three model photos.
- Sales answers §10 items 1 and 2.
- Fred reviews the question copy and the install-area ZIP list.
- `.superpowers/` is added to `.gitignore`.

## Appendix A: shipping by state and province

From the "Avg Shipping just for _quote" tab, exported 2026-10-28 (its current-price column). These are client-facing quick estimates: the closer factory's mileage x $5/mile. The per-mile rate itself is not shown to clients.

| State / province | Closer factory | Shipping estimate |
|---|---|---|
| Alabama | Crossville TN | $2,000 |
| Alaska | — | Quoted separately |
| Alberta | Winlock WA | $4,750 |
| Arizona | Winlock WA | $7,250 |
| Arkansas | Crossville TN | $2,800 |
| British Columbia | Winlock WA | $2,750 |
| California (Northern) | Winlock WA | $3,600 |
| California (Southern) | Winlock WA | $5,500 |
| Colorado | Winlock WA (same distance from TN) | $6,500 |
| Connecticut | Crossville TN | $4,900 |
| DC | Crossville TN | $2,850 |
| Delaware | Crossville TN | $3,500 |
| Florida | Crossville TN | $4,000 |
| Georgia | Crossville TN | $2,400 |
| Hawaii | — | Quoted separately |
| Idaho | Winlock WA | $3,250 |
| Illinois | Crossville TN | $2,900 |
| Indiana | Crossville TN | $2,300 |
| Iowa | Crossville TN | $4,600 |
| Kansas | Crossville TN | $3,500 |
| Kentucky | Crossville TN | $1,150 |
| Louisiana | Crossville TN | $3,500 |
| Maine | Crossville TN | $6,000 |
| Manitoba | Crossville TN | $8,750 |
| Maryland | Crossville TN | $3,250 |
| Massachusetts | Crossville TN | $5,250 |
| Michigan | Crossville TN | $3,400 |
| Minnesota | Crossville TN | $5,250 |
| Mississippi | Crossville TN | $2,350 |
| Missouri | Crossville TN | $3,250 |
| Montana | Winlock WA | $5,000 |
| Nebraska | Crossville TN | $6,000 |
| Nevada | Winlock WA | $5,250 |
| New Hampshire | Crossville TN | $5,750 |
| New Jersey | Crossville TN | $4,000 |
| New Mexico | Crossville TN | $7,000 |
| New York | Crossville TN | $4,500 |
| North Carolina | Crossville TN | $2,600 |
| North Dakota | Winlock WA (same distance from TN) | $6,750 |
| Ohio | Crossville TN | $2,550 |
| Oklahoma | Crossville TN | $4,500 |
| Ontario (Eastern) | Crossville TN | $4,500 |
| Ontario (Western) | Crossville TN | $5,250 |
| Oregon | Winlock WA | $1,300 |
| Pennsylvania | Crossville TN | $4,000 |
| Quebec | Crossville TN | $6,500 |
| Rhode Island | Crossville TN | $4,900 |
| South Carolina | Crossville TN | $2,300 |
| South Dakota | Winlock WA (same distance from TN) | $6,750 |
| Tennessee | Crossville TN | $1,300 |
| Texas | Crossville TN | $5,500 |
| Utah | Winlock WA | $5,000 |
| Vermont | Crossville TN | $5,500 |
| Virginia | Crossville TN | $3,000 |
| Washington | Winlock WA | $1,100 |
| West Virginia | Crossville TN | $2,500 |
| Wisconsin | Crossville TN | $4,100 |
| Wyoming | Winlock WA | $6,000 |
| Outside the US and Canada | — | Quoted separately |
