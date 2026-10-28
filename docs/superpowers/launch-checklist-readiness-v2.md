# Launch checklist: the new readiness assessment

For Fred. Plain English, in the order you'd do things. The new yard planner, the plan card with its questions, lead saving and the two contractor spec sheets are all built and tested. These are the things only you (or sales) can finish.

## Must do before launch

1. **Add the new fields to the Airtable `Submissions` table.** The lead form writes to these. If one is missing, Airtable refuses the save and the client sees an error. The names must match exactly. Old fields stay as they are for past leads.

   | Field | Type to use |
   |---|---|
   | Email | Email (or Single line text) |
   | First Name | Single line text |
   | Phone | Phone number (or Single line text) |
   | Submission Date | Date, with time |
   | Last Updated | Date, with time |
   | Buttons Clicked | Single line text |
   | ZIP | Single line text |
   | State | Single line text |
   | Price Region | Single line text |
   | In Coverage | Checkbox |
   | Pod Model | Single line text |
   | Pod Use | Single line text |
   | Yard Dimensions | Single line text |
   | Pod Orientation | Single line text |
   | Recommended Method | Single line text |
   | Base | Single line text |
   | Bathroom | Single line text |
   | Door | Single line text |
   | Cost Low | Number (whole number) |
   | Cost High | Number (whole number) |
   | Cost Notes | Long text |
   | Shipping Estimate | Number |
   | Lead Time | Single line text |
   | To Check | Long text |
   | Answers | Long text |
   | Planner Snapshot | Long text |
   | Assessment Version | Single line text |

   Keep these as text, not dropdowns (single select). The tool saves with Airtable's "typecast" option on, so a dropdown would quietly add a new option whenever a value doesn't match an existing one exactly, instead of showing an error. Pod Use only ever holds Office, Studio, Guest Suite or Other, but keep it as text for the same reason.

2. **Replace the three placeholder photos in `assets/models/`.** `twelve.jpg`, `sixteen.jpg` and `station.jpg` are all the same placeholder picture right now (a photo of the Sixteen). Put a real photo of each pod in, with the same file names. The plan card shows the one for the model the client ends up with.

3. **Get sales to answer two questions** (they change what the tool asks and says). Send the answers to the developer, who makes the change:
   - **How level must the ground be?** The ops FAQ says under 2 degrees, or 1/4 in. per foot. The handbook slab spec says 1/4 in. per 10 ft. The tool uses 1/4 in. per foot for now. The developer changes `LEVEL_CUTOFF_TEXT` in `src/assessment/core/data.ts`, which updates the ground question and the base spec sheet together. Also note that phone level apps show degrees, not inches per foot, so the wording "within 1/4 in. per foot" may need a degrees version.
   - **How wide must the way in be for a kit?** The kit FAQ says any regular door (about 3 ft). Peter's task says 4 ft. The tool uses 3 ft for now. The developer changes `KIT_ACCESS_FT` in the same file.

4. **Read all the client-facing wording** and mark anything that doesn't sound like Mini·O. The easiest way is to go through the tool on the deploy preview; the text lives in `src/assessment/ui/copy.ts` (the plan card) and `src/assessment/ui/questions-copy.ts` (the questions and their how-to-measure help). A first draft was written from the facts in the spec, so it needs your eye. Send your changes to the developer, who edits those files.

5. **Review the ZIP tables in `src/assessment/core/location.ts`.** These decide which ZIPs count as "we arrange contractors here", which price region applies, and which state's shipping figure is used. Tell the developer what to fix. Known gaps to look at: in Virginia, only ZIP prefixes 220 to 223 (Arlington, Alexandria, Fairfax) are in the Virginia/Pennsylvania/Maryland price region. Prefix 201 (Loudoun County, also northern Virginia) and 224 to 246 (Fredericksburg south, including Richmond and Norfolk) are not, and a few Canadian postal codes with invalid first letters are treated as "outside the US and Canada".

6. **Make sure the Netlify site still has the `AIRTABLE_PAT` setting** (the Airtable access token the old form already used). Without it, every lead save fails.

## Decisions for Fred / sales

These all have a working default today. Change them only if you disagree.

- **Concrete slab spec.** The kit FAQ says 5 in. with #4 rebar 12 in. apart. Older notes say 4 in., 3,000 PSI, mesh. Until answered, the base sheet says "ask your Mini·O advisor".
- **Power for pods with no bathroom.** The 2024 ops FAQ allows 30A. Newer notes say always 50A. The tool says 50A only.
- **Kit unloading.** Kit FAQ: 3 people, about 2 hours, 40 sq ft of dry storage, 3 ft walkway. Older notes: 2 people, about 1 hour, 4 ft. The tool uses the kit FAQ.
- **Does the gravel pad spec apply to pre-built pods?** It is written in the kit FAQ, and a pre-built Sixteen weighs about 7,200 lbs. The tool applies it.
- **Is the shed mule charged twice?** The tool adds $2,000 on top of the state shipping figure and nothing else.
- **Flipped door.** The tool offers it on the Twelve and the Sixteen only (+$500) and says it is not available on the Station. Confirm which models can really do it.
- **Missing regional prices.** California North power, all North Carolina figures, New Jersey/New York and Virginia/Pennsylvania/Maryland beyond the gravel pad, and the Station in several regions use the general reference figures until you fill them in. Those lines say "(reference)" on the card.
- **Station weight and path clearance** are not confirmed. The Station spec sheet says "ask your Mini·O advisor" for weight.
- **The Twelve with a shower.** The card says the Twelve fits a half bath only and offers "Switch to the Sixteen". Confirm that is true.
- **Phone layout.** On phones the plan card collapses into a bar at the bottom with the price and two buttons. Confirm you like it.
- **"Continue without saving."** If saving a lead fails, the client sees the error with "Try again" and "Continue without saving", so they are never stuck. On phones, any button press closes the plan details first, so this message is never hidden behind them. After continuing without saving from "Save my plan", the client can still print the plan. Confirm you want that fallback.
- **One lead record per visit.** The first save creates the Airtable record and later button clicks update it, so sales doesn't get duplicates. "Buttons Clicked" lists every button used, in order.
- **Moving from a priced plan to "Let's talk".** If a client's answers change so the card turns into "Let's talk", the next save clears Cost Low, Cost High and Shipping Estimate in their Airtable record, so no out-of-date figures are left behind.
- **Crane price.** Shown as "+ crane, from $3,000" (or $4,000) next to the range, since the client pays the crane company directly.
- **Outside our install areas.** The card says "We don't arrange contractors in your area yet. These prices are a reference for your own contractor." Confirm the wording, and the list of install areas.
- **Out-of-area Washington.** A Washington ZIP outside the install area uses Washington's own kit assembly figure, not the general reference figure (for the Sixteen, $11,000 instead of $12,000). Confirm.
- **Small wording items.** "Some homes need a panel upgrade" may be jargon for clients. The base type on the card ("Base: gravel pad") can read like a promise. "Let's talk" cards still show the base and power spec links.
- **Planner pod colour.** The pod used to turn red near the yard edges. It no longer does. Decide whether to bring it back when clearance is under 3 ft.
- **Button colour contrast.** White text on the red button, and red text on white, is a little below the usual accessibility target. Decide whether to darken the red.

## Check on the first deploy preview

1. In the preview, **go through the tool once like a client** (planner, then the plan card, then the questions) at desktop size and on a phone.
2. **Submit one real lead** with your own email: press "Save my plan", fill the form, and check the new record in Airtable. ZIP, Pod Model, To Check, Answers, Planner Snapshot and the rest should be filled in. Some fields are empty on purpose: Cost Low and Cost High on a "Let's talk" plan, Shipping Estimate when shipping is quoted separately or there is no ZIP, and Price Region outside the priced regions. If Airtable shows an "Unknown field name" error, a field from the list above is missing or misspelled.
3. Press "Design my pod" and "Let's talk" afterwards. They should go to minioffice.co/quote and minioffice.co/lets-talk, and the same Airtable record should update (Buttons Clicked grows), not a second record appear.
4. On the preview, open "Print / save as PDF" after saving and look at the print preview. It should show only the plan summary, not the planner or buttons.
5. Open the two contractor spec sheets from a plan card ("Get the base spec", "Get the power spec") and print one.
6. Delete your test records from Airtable.

### For the developer

1. Read the first deploy preview's **deploy log**. You should see: dependencies installed, the build running (`npm run build`), the functions bundled (`submit` and `geocode`), and no `node_modules` folder in what gets published. `package.json` asks for Node 18; confirm the Node version in the deploy log.
2. Visit `<preview url>/.netlify/functions/submit` in a browser. It should show `{"error":"Method not allowed"}` (a 405), not "not found" or a server error.
