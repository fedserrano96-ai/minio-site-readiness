# Readiness Assessment v3: design

Date: 2026-10-30
Owner: Fred Serrano (Mini·O)
Status: draft for review
Builds on: `2026-10-28-readiness-assessment-overhaul-design.md` (v2, live since
2026-10-29). Anything this document doesn't change stays as v2 describes it.

## 1. Intent

v2 cut the old 25-question quiz down to about 9 questions. The format worked:
yard planner, then a live recommendation card with one question at a time. But
the client no longer comes away understanding everything it takes to receive
their pod.

v3 keeps the format and changes what it's for. **Price becomes a
nice-to-have.** The main job is to tell the client, in plain words:

1. **Yes, you can have a pod here.** Lean toward yes and find a way to make it
   work.
2. **Here's what it takes.** Each step comes with who does it.

Fred's test for success is that the client walks away able to say something
like: *"I can have a Sixteen installed with a shed mule, and I only need to
install an outlet for it."* They also leave with the spec sheet to hand their
electrician.

**The anti-goal** is a client who leaves with more questions or uncertainty
than they came in with. Fred's example: a client who doesn't know what their
panel can handle, or how to measure clearance, may decide the whole thing is
too complicated and stop thinking about a pod. So the tool diagnoses how ready
they are and walks them through it, kept as simple and engaging as possible.
Anything the client can't answer becomes something a sales rep checks with
them on a call. It never becomes a dead end.

Every client is then prompted to keep going: design their pod, or book a call
with a rep.

Sources:
- the client prep PDF "2.4 Installation_Checklist"
- the pre-v2 quiz (git commit `7b9bf19`, `index.html` STEP_DEFS)
- the ClickUp sales feasibility checklist (Sales Resources doc 2y90f-3725,
  page 2y90f-9734)
- Fred's brief for the tool (ClickUp task 86b9fftrg)
- Fred's draft FAQ v4 (attachment on ClickUp task 86bcp4yj7; the questions
  cited below are Q051, Q059, Q067, Q082, Q092 and Q093)

## 2. Goals

1. Cover what a client actually needs in order to receive a pod: getting it
   there, the spot, power, and water if there's a bathroom. Ask no more than
   that.
2. Every outcome is a path forward. "I'm not sure" never blocks the client: it
   keeps a sensible default and adds a line to the list the rep goes over on
   the call.
3. End on a clear answer: a one-sentence headline, a short plain-language
   walk-through of the steps with who does each one, the items the rep will
   check, and two buttons to continue.
4. Make the drawings professional and useful, so the client can see exactly
   what to look at and measure.
5. Keep the price ballpark as a supporting detail.

## 3. Non-goals and anti-goals

- **Not asked, and not mentioned:** internet, delivery-day prep, permits, HOA,
  setbacks, how far the water and sewer lines are, sewer vs. septic, and the
  size of the house's electrical panel.
- **Door direction** is not asked for now (Fred, 2026-10-30). Every pod is
  treated as having the standard door.
- **Never tell the client** that a sewer connection needs a permit, or that a
  permit means on-site work or assembly (Fred: "dont give out that info"). A
  bathroom does not change the delivery method. If a client needs to go the
  permit route, that comes up in the conversation with the sales rep.
- **No technical language** in the result. The rep list and the walk-through
  are plain English. The technical detail lives only in the contractor spec
  sheets.
- Everything that is a non-goal in v2 §3 is still a non-goal.

## 4. Constraints

All of v2 §4 still applies: TypeScript, npm, esbuild, Vitest, internal numbers
stay internal, Mini·O "arranges" contractors and never "builds", and lead
times are phrased as "about N weeks after we receive payment". In addition:

- **Stored state:** the answers change shape, so the storage key moves to
  `minio-assessment-v3`. A v2 session in progress simply starts fresh.
- **Airtable:** v3 adds no new Airtable fields, so the launch needs no table
  changes. New answers go into the existing readable `Answers` text, the rep
  list goes into `To Check`, and `Assessment Version` becomes `v3`.
- `permitting-engine/` is not touched.

## 5. The questions

The model still comes from the planner, and the format stays as it is: one
question at a time, a drawing, answer buttons, "I'm not sure", and a collapsed
"What does this mean, and how do I measure it?" section.

Questions are grouped, and the group name shows above each question with the
progress line (e.g. "Getting it there · Question 3 of 10"). *(My call: this
makes the flow feel like a few short steps rather than a long form.)*

| # | Group | Question | Asked when | Effect |
|---|---|---|---|---|
| 1 | Your pod | ZIP code | always | As in v2. |
| 2 | Your pod | Will the pod have a bathroom? (no / half bath / bath with shower) | always | Adds the Water step to the walk-through (§6.2) and +2 weeks of lead time. The Twelve-with-shower note stays as in v2. **No longer leads to a water or sewer distance question.** |
| 3 | Getting it there | Can a truck drive right up to the spot? | always | As in v2. |
| 4 | Getting it there | How wide is the narrowest point on the way in? | #3 ≠ yes | As in v2. |
| 5 | Getting it there | **New:** Does the pod have to go around a tight corner on the way in? (no turns / a turn with plenty of room / a tight turn / not sure) | #3 ≠ yes | "A tight turn" counts against the shed mule the same way a narrow path does (see #6). The how-to text gives the room the mule needs to turn: about 24 ft across, 20 ft for the Twelve (v2 §6.1, client PDF). |
| 6 | Getting it there | **New:** Could everything that makes it narrow or tight come down and go back up? (yes, a fence section or gate / yes, something else, like a planter or a small shed / no / not sure) | #4 = narrow or #5 = tight | Either "yes" → the narrow path or tight turn no longer rules out the shed mule. The Delivery step then says "the fence section or gate" or "what's in the way" comes down for delivery and goes back up after (§6.2). The word "everything" covers a client with both a narrow point and a tight turn, so one question is enough. *(My call.)* This is how the tool "finds a way". |
| 7 | Getting it there | Overhead clearance | #3 ≠ yes | As in v2. |
| 8 | Getting it there | What's the way in like underfoot? (**changed:** solid, flat or a gentle slope under about 10° / soft ground, like a lawn / a few short steps, under 1.5 ft / a steep slope or a staircase / not sure) | #3 ≠ yes | Follows FAQ Q059 and Q067 (Fred, 2026-10-30). The shed mule handles slopes up to about 10° and short steps up to 1.5 ft with ramps. **Gentle slope:** no change. **Soft ground:** as in v2. **Short steps:** keeps the shed mule and adds ramps (+$250, §6.4), and the Delivery step says "ramps go over the steps". **Steep or a staircase:** rules out the shed mule, as "steps or steep" did in v2. The help text shows how to check 10° with a phone level app, and the 10°, 1.5 ft and $250 figures are constants. |
| 9 | Getting it there | Power lines | shed mule ruled out | As in v2. |
| 10 | Getting it there | Distance from the street | as in v2 | As in v2. |
| 11 | Getting it there | Kit access (a regular door, about 3 ft) | crane ruled out | As in v2. The 3 ft width is now settled by FAQ Q082. |
| 12 | The spot | Is there already a base? | always | As in v2. |
| 13 | The spot | Is the ground flat? | #12 = none | As in v2. The ¼ in. per foot cutoff is now settled by FAQ Q051. |
| 14 | Power | How far is the house's electrical panel from the spot? | always | As in v2 for the price. The help section adds a short **"What's an electrical panel?"** part (§5.1). |
| 15 | Power | **New:** What's between the panel and the spot? (lawn or dirt / a driveway, patio or path / both / not sure) | always | Changes no price *(my call: there's no confirmed figure for it)*. The answer is saved for the rep. With a hard surface, the Power step adds one plain line: "Your electrician will plan the route around or under the paved part." |

That's 15 questions. Branching hides most of the delivery questions for a
client whose truck can get to the spot. *(My estimate: a typical client sees
9 to 11 questions.)*

The rule changes in code: `isMuleRuledOut` becomes

> truck can't reach **and** (((path narrow **or** turn tight) **and** not
> removable) **or** overhead is something else **or** a steep slope or
> staircase)

The escalation order (tilt trailer → shed mule → crane → kit → let's talk)
and the rule that "I'm not sure" never changes the recommendation both stay as
in v2 §6.2. Room around the pod still comes from the planner (the 3 ft note),
as in v2.

### 5.1 "What's an electrical panel?"

This goes in the how-to-measure section of #14. In plain words, it covers:

- what the panel is: the metal box where the house's power comes in, with rows
  of switches (breakers) behind a small door
- what it looks like: shown in its own small drawing, door open, rows of
  breakers, with the main breaker at the top
- where it usually is: the garage, the basement or a utility room, or outside
  on a wall next to the electric meter
- that the client doesn't need to know anything about the panel itself. Their
  electrician checks it. If they can't find it, "I'm not sure" is fine, and
  the rep will help on the call.

### 5.2 "I'm not sure"

This keeps the v2 behaviour: the how-to-measure section opens with its drawing
and help, the recommendation stays on its default, and Next moves on. The item
goes on the rep list (§6.3) instead of v2's "To check" list.

## 6. The result

The live card stays on top during the questions, as in v2. After the last
question, the panel below it shows **Your plan**. That's where the client gets
the full answer. *(My call: the card stays compact while they answer, and the
walk-through lives in the end panel, which also works on phones, where the
card is a slim bar.)*

### 6.1 Headline

One sentence on the card (replacing v2's title) and repeated at the top of
Your plan. It names the model, the delivery method and what the client needs
to add. Examples:

- "You can have a Sixteen delivered by truck and shed mule. You'll need a
  gravel pad and an outdoor outlet."
- "You can have a Twelve delivered on a tilt trailer onto your patio. You'll
  need an outdoor outlet."
- "You can have a Sixteen lifted in by crane. You'll need a gravel pad, an
  outdoor outlet and a plumber for the bathroom."
- Kit: "You can have a Sixteen brought in as a kit and built on the spot.
  You'll need …"
- Let's talk (no way in found): "Your yard needs a closer look. Let's work out
  the best way in together." The headline never says no.

The builder writes the sentence rules from the recommendation (model, method,
base, bathroom). Fred reviews the copy.

### 6.2 The walk-through

These are short numbered steps in plain words, each with who does it. There
are four steps at most:

1. **Delivery**: how the pod gets there (tilt trailer / truck and shed mule /
   crane / kit built on site). Inside an install area: "Mini·O arranges this."
   Outside one: "Mini·O ships it; your local crew takes it from there." If #6
   = yes: "The fence section or gate comes down on delivery day and goes back
   up after." (For the "something else" answer: "What's in the way comes
   down …")
2. **Base**: a gravel pad ("Mini·O arranges a local contractor", or outside an
   install area: "your contractor, with this spec sheet"), your existing base
   ("we'll confirm it's big enough and level"), or a raised base ("priced in
   person").
3. **Power**: an electrician adds an outdoor outlet near the pod and a
   breaker in your panel. Fred's rule (2026-10-30): **first** say the client's
   own electrician or general contractor can handle it with this sheet,
   **then** offer help: "or we can help arrange one." Inside an install area:
   "Your electrician or general contractor can handle this. Give them this
   sheet. Or we can help arrange one for you." Outside one, the offer to
   arrange is left out *(my call: Mini·O has no contractors there)*. The step
   links the power spec sheet and adds the hard-surface line from #15 when it
   applies. The power price stays in the range as in v2 (open item 1).
4. **Water** (only with a bathroom): "Your pod will need a licensed plumber to
   connect it to your water and sewer. We can help coordinate one, or if you
   have someone you trust, even better." This is Fred's wording. Don't mention
   permits, distance or assembly.

Steps keep v2's notes where they belong: soft ground goes under Delivery, the
3 ft clearance under Base, kit unloading under Delivery, and Twelve with a
shower near the headline.

### 6.3 "We'll check these with you on the call"

This replaces v2's "To check" list. There's one plain line for each "I'm not
sure" answer and for each existing base to confirm (as in v2). It's shown on
the card and in Your plan. When the list is empty, it doesn't show.

### 6.4 Price

This keeps v2's cost line, breakdown, lead time and coverage label, shown
under the walk-through as a supporting detail. Changes:

- **Water and sewer** are priced without a distance question, at the 25 to 50
  ft band v2 already uses for "not sure". *(My call: the FAQ's ~$5,600 for
  plumbing hookups is in the same range.)*
- The door line goes away, because every pod has the standard door.
- **Ramps** become a new line, at $250 (FAQ Q067), when the shed mule is used
  and #8 = short steps. It shows in the breakdown as "Ramps for the steps".
- The v2 note "Some homes need a panel upgrade (about $2,500)" is removed. Its
  job moves to the Power step ("your electrician checks your panel"). *(My
  call: a $2,500 maybe-cost is exactly the kind of loose end that makes a
  client hesitate.)*

### 6.5 Buttons

These are the same two buttons as v2, **Design my pod** and **Let's talk**,
both going through the email step. When the rep list isn't empty, **Let's
talk** becomes the primary button, with the line "Book a call and we'll go
over these with you." *(My call.)* v2's "Save my plan" button stays on Your
plan.

## 7. Drawings

Every question's drawing is redrawn. Today's are thumbnail-like line sketches
that don't show what to do. The new ones follow the style of the FAQ v4
diagrams (e.g. Q092, the power hookup): a clean side or top view with
**numbered callouts** that match numbered steps in the how-to-measure text.

- **What to measure** is shown with a dimension line labelled with the
  client's model figure (e.g. "12 ft" for a Sixteen path, "13 ft" for a
  Station overhead). So the drawing takes the model as an input.
- A recognisable scene for each one: the house, the fence and gate, the
  street, the truck, the shed mule, the crane, the pod.
- New drawings for #5 (a turn on the way in, with the turning room marked), #6
  (a fence section coming down and going back up), #15 (the route from the
  panel to the pod over lawn vs. under a driveway), and the panel itself
  (§5.1).
- Brand colours: red `#ED3648` marks what the question is about, dark blue
  `#535266` for lines, and sand `#E3CDBF` for fills. The drawings stay
  readable at phone width.
- They stay as inline SVG built from constant strings (as today). No images
  are loaded from elsewhere.

Fred reviews the drawings.

## 8. Lead capture and Airtable

This works as in v2 §7. The submission now carries:

- `Answers`: includes the new answers (#5, #6, #15) as readable text
- `To Check`: the rep list
- `Door`: always "Standard"
- `Assessment Version`: "v3"

v2's water distance answer is no longer sent. There are no new fields.

## 9. Contractor spec sheets

The base sheet is unchanged. The power sheet always uses the standard
layout's inlet corner (back right), since there is no door question for now.
Its connection spec waits on open item 2 below.

## 10. Open items for sales

1. **Can the card show a power price?** The tool shows a range (e.g. $1,500 –
   $4,081 in Seattle, from the Red Glove sheet), but FAQ v4 says electrical
   work can't be quoted in advance. Use for now: keep the range.
2. **30A or 50A?** The client PDF and the current power sheet say 50A, 240V.
   FAQ Q092/Q093 say 30A (120V) is enough without a bathroom, 50A with one,
   and the FAQ itself flags this as a conflict with ops. Use for now: 50A,
   240V everywhere, matching the current power sheet and the PDF.
3. **Shed mule limits.** FAQ Q059 and Q067 flag their own figures as
   disputed (10° vs 15°; 6 in. vs 1 ft bumps; Rod to settle). Use for now:
   the FAQ figures, 10° and steps up to 1.5 ft with $250 ramps. They're
   constants, so changing them later is a one-line edit.
4. v2 launch items that may still be open: the three real model photos, the
   copy and ZIP review, and one real test lead.

## 11. Left to the builder

- The exact copy of the new questions, the help text, the headline sentence
  rules and the walk-through lines, from the facts in this document. Fred
  reviews every string.
- The drawings, within §7.
- How Your plan is laid out, keeping the look of today's card and end panel.
- Which existing code to remove: the `waterDistance` and `door` questions,
  their copy and drawings, and the flip-door pricing line.
- Tests: every rule change in §5 and every pricing change in §6.4 gets a unit
  test. Every headline example in §6.1 gets a test too.
