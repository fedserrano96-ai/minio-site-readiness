# Tier 1 Jurisdiction Drafts — Review Sheet for Fred + Urbatec

Researched **2026-06-09** from official sources only. Every cited URL is archived under
`research/sources/<jurisdiction-id>/` with a manifest (URL, fetch date, HTTP status).
All five entries are `status: "draft"` and stay that way until Fred flips them after
this review. Outcomes are postures (likely_exempt / likely_required / depends), never verdicts.

**How to review each entry:** (1) check the rule outcomes against the cited snapshot,
(2) resolve the open `<<verify>>` items, (3) sanity-check against the live permit anchor,
(4) decide whether the safe-error downgrades below should stay or be relaxed.

## Editorial decisions made during assembly (flagging my own changes)

These are places where I changed the raw research output. Original postures preserved here
so you can reverse any of them:

| Jurisdiction | Rule | Researched posture | Shipped posture | Why |
|---|---|---|---|---|
| San Jose | under-120, no plumbing | building: depends | building: **likely_required** | Bulletin #201 conditions the exemption on "will not be electrically wired"; every pod has the 50A inlet, and Bulletin #250 says with electrical "a permit is required regardless of the size." Directly cited, so the stronger (and safer) posture. |
| Del Mar | under-120, no plumbing | building: likely_exempt (medium) | building: **depends** | The CRC exemption is for "tool and storage sheds, playhouses and similar uses" — a conditioned, occupied office may not qualify. Safe-error guardrail: never render exempt while that's unresolved. |
| LA County | under-120, no plumbing | building: likely_exempt (high) | building: **depends** | Same conditioned-office ambiguity, flagged in the research itself ("a conditioned office may be questioned"). |

Net effect: **no Tier 1 draft currently renders likely_exempt for any configuration** (a test
asserts this). If Urbatec confirms an under-120 exemption applies to conditioned office pods
in Del Mar or LA County, flip those back to likely_exempt at verification.

I also normalized rule `when` conditions during assembly (e.g., over-120 rules restricted to
`plumbing: ["none"]` so plumbed configs fall through to the plumbing rule) — this is matching
structure, not outcomes, and it's what makes the San Jose plumbing A/B produce different outputs.

---

## 1. Seattle, King County, WA (`wa-king-seattle`) — anchor: Anna Chen permit

**Headline:** the 120 sqft shed exemption is limited to "generally unoccupied uses"
(storage, plants). A conditioned, occupied office pod may not qualify **at any size** —
under-120 ships as `depends`, not exempt.

Key structure:
- Seattle runs its **own electrical permitting through SDCI** (not WA L&I) — every pod's 50A inlet triggers it.
- **Plumbing permits come from Public Health — Seattle & King County** (206-263-9566), not SDCI.
- Sleeping = DADU (SMC 23.42.022) = full construction permit, all current codes.
- Tiny houses on wheels are "treated like camper trailers" — living in them is prohibited; treatment of a *non-sleeping* trailer office is unaddressed → all-depends.
- Energy: 2021 Seattle Energy Code (largely matches 2021 WSEC).

**Open items for Urbatec:**
1. The underlying Seattle Building/Residential Code exemption section number (SDCI pages summarize it; Municode blocked the code text).
2. Exact boundary: SDCI pages say both "less than 120" and "120 or less."
3. Does SDCI treat a conditioned backyard office as an "unoccupied use" shed if under 120 sqft? (The decisive question.)
4. SMC 23.44 setback/coverage tables (got summaries only).
5. Seattle Electrical Code adopted edition.

**Validation:** run the Anna Chen config through the engine and compare against what SDCI actually required.

---

## 2. San Jose, Santa Clara County, CA (`ca-santa-clara-san-jose`) — anchor: Gary Deng, record 2026-121660-RS

**Headline:** the 120 sqft exemption requires the structure NOT be electrically wired —
**every Mini·O pod needs permits at any size.** Also: ordinary accessory buildings
"Cannot be air conditioned" (Bulletin #250) — a conditioned pod may need planner review
even without plumbing or sleeping.

Key structure:
- Plumbing at any size → building + plumbing permits; accessory buildings capped at two plumbing fixtures (a full bath exceeds it → ADU territory).
- ADU minimum is 150 sqft — **the Twelve (96 sqft) has no clear lawful sleeping configuration.**
- Tiny homes on wheels are regulated as ADUs (Bulletin #210/#291), not vehicles.
- 2025 CA codes (Title 24) effective Jan 1, 2026.

**Verification caveat:** the research agents could only read sanjoseca.gov via Internet Archive
captures (the live site blocks bots), BUT our archive script later fetched the live URLs
successfully — snapshots in `research/sources/ca-santa-clara-san-jose/` are from the live site.
The two bulletin PDFs (002, 003) are binary PDFs; open them manually to confirm content matches.

**Open items for Urbatec:**
1. Verbatim SJMC 24.02.110 / 20.30.500 / 20.80.175-176 text (Municode blocked).
2. Bulletin #291 (THOW checklist) — referenced but not locatable.
3. Bulletins predate the Jan 2026 code switch — re-confirm thresholds with the Permit Center (408-535-3555).
4. Exactly-120-sqft ambiguity in Bulletin #250 (page 1 vs page 2 wording).
5. Does the "cannot be air conditioned" accessory-building rule force conditioned office pods into a different approval path?

**Validation:** the engine now produces different outputs for the Gary Deng A/B (Sixteen
no-plumbing vs Sixteen 3/4-bath) — compare both against record 2026-121660-RS.

---

## 3. Del Mar, San Diego County, CA (`ca-san-diego-del-mar`) — anchor: Htut Zaw permit

**Headline:** Del Mar layers **four gates** on a backyard pod: building/trade permits,
**Design Review** (DMMC 23.08.030 — required for exterior construction of ALL structures;
the administrative shortcut caps at 48 sqft / 6 ft, which every pod exceeds), a **coastal
exemption-or-CDP determination** (DMMC 30.75 — citywide), and, if sleeping, **ADU + Administrative
Coastal Development Permit** (DMMC 30.91.030(E)).

Key structure:
- Zoning review is `likely_required` for every configuration (Design Review + coastal).
- The single-family-improvement coastal exemption (30.75.200.C, includes "storage sheds") plausibly covers a pod — but is lost near bluffs (50 ft), in the Lagoon Overlay, near steep slopes, or in the CDP Appeals Area. Lot location decides.
- The 500-sqft accessory-building rear-yard encroachment allowance **excludes** R1-40/R1-14/R1-10 zones — full setbacks apply there (e.g., R1-10: rear 25 ft, side 7.5 ft).
- 2025 CA codes adopted Oct 22, 2025 (Ord. 1022) → Title 24 energy.

**Citation note:** DMMC text was fetched via Municode's public content API (the cited URLs);
the human-readable pages at library.municode.com/ca/del_mar use the same nodeIds.

**Open items for Urbatec:**
1. Confirm whether the whole city is in the Coastal Zone (couldn't verify on a fetched page — operative assumption is yes given the citywide CDP chapter).
2. The 2019 "Guidelines for Construction Permit Applications" handout is 404 — does a current version exist confirming the 120 sqft exemption locally?
3. Does an occupied office pod qualify for the 30.75.200.C "storage shed" coastal exemption?
4. Trailer-mounted treatment (lowest confidence of the set — all depends).

**Validation:** run the Htut Zaw config and lot location (overlay zones!) against the engine output.

---

## 4. Unincorporated King County, WA (`wa-king-unincorporated`)

**Headline:** the 200 sqft exemption requires **unconditioned** space — the county's 2025
code-update summary says it outright: "Detached accessory structures must be unconditioned
to be exempt." **Every conditioned Mini·O pod should be assumed to need a county building
permit at any size.** This is the strongest under-threshold finding of the five.

Key structure:
- Three authorities: building — County DLS Permitting (MyBuildingPermit.com); electrical — **WA State L&I**; plumbing — Public Health Seattle & King County.
- Factory-built units need L&I Factory Built Structures approval AND a county siting permit.
- Wheeled units treated like RVs: no full-time residence, 60-day camping cap per rolling 365.
- Sleeping = ADU (KCC 21A.08.030 B.7.a): 1,000 sqft heated cap, notice on title, one per rural lot, septic/sewer review.
- Critical areas (wetlands, slopes, streams) void the exemption entirely.

**Open items for Urbatec:**
1. Enacted status of the 2021-code-edition ordinance (only the March 2025 plain-language summary was fetched; fetched KCC Title 16 still shows 2018 editions).
2. Full KCC 16.02.240 exemption text ("certain design requirements" list).
3. Exact numeric setbacks per zone (KCC 21A.12.030 tables too large to extract).

---

## 5. Unincorporated Los Angeles County, CA (`ca-los-angeles-unincorporated`)

**Headline:** the only plausibly-exempt configuration is the Twelve (96 sqft) with no
plumbing/sleeping (limits: 12 ft height, 24 in roof projection) — and even then the 50A
feed triggers an electrical permit and Title 22 zoning applies. Shipped as `depends`
pending the conditioned-office question.

Key structure:
- County renumbers the exemption as **Title 26 Sec. 106.3** (not model-code 105.2).
- Regional Planning approval precedes the building permit for accessory structures over 120 sqft.
- Permits issue via EPIC-LA. 2026 county codes (2025 CA codes) effective Jan 1, 2026.
- No movable-tiny-home provision (unlike City of LA); enforcement flags occupied trailers as violations — trailer mounting is a risk, not an escape hatch.
- Sleeping + kitchen + bath = ADU (Title 22 Sec. 22.140.640).

**Open items for Urbatec:**
1. Codified Title 26 Sec. 106.3 text (Municode blocked; corroborated via county pages + adopting-ordinance PDF).
2. ADU 4-ft side/rear setback (search snippets only).
3. Factory-built / state-insignia unit treatment.
4. Whether a conditioned office qualifies as a "similar use" to tool sheds/playhouses under the exemption.

---

## Construction requirements pass — researched 2026-07-08

The Phase A follow-on research pass. All five Tier 1 entries now carry a populated
`construction_requirements` array (insulation/energy values, footing specs, snow/wind/seismic
design criteria, and jurisdiction-specific "other" constraints), researched from official
sources by parallel agents and assembled the same way as the permit rules: everything stays
inside the draft entries until Fred + Urbatec verify. Snapshots of every cited URL are being
archived via `fetch-sources.js --from-data` (which now also collects `construction_requirements`
citation URLs, not just rule citations).

Counts: Seattle 10 · San Jose 12 · Del Mar 13 (1 unverified-bucket) · King County 13 · LA County 13.

Archive status: all 51 cited URLs snapshotted (2026-07-09). Two needed workarounds:
sandiegocounty.gov does not resolve from this machine, so the two County plan-check PDFs
(PDS 081, PDS 498) are archived from raw Wayback Machine captures (2025-04-05 and 2025-08-14,
CDX digests stable across 2025 snapshots) — snapshots 027/028 in the Del Mar manifest; the
citation code_sections note the Wayback provenance. The up.codes WA foundations page failed
transiently and archived on retry. Notably, sanjoseca.gov answered the archiver directly this
time — Bulletin #250 and the Construction Guidelines are archived from the live site.
The only unverified-bucket item is Del Mar's seismic design category (substantive uncertainty —
no official page publishes the SDC letter), not an archive gap.

**Editorial decisions during assembly (reversible — raw agent output in the session transcript):**

| Jurisdiction | Decision | Why |
|---|---|---|
| Del Mar | Seismic-design-category item forced into the *unverified* bucket (`<<verify>>` in code_section) | No official page publishes Del Mar's SDC letter; the cited county doc only says "specify SDC per CRC Table R301.2.2.1.1". Kept visible but never as a clean claim. |
| San Jose | Dropped a nonresidential-envelope item (Table 140.3-B) and a PV/BESS-applicability item | Both hinge on the unresolved occupancy-classification question (CF1R vs NRCC path for a conditioned non-dwelling pod). Listing both value sets in the KB invites quoting the wrong one — resolve classification first (open item below). |
| San Jose / King County / Del Mar | Footing items citing up.codes kept, marked **low** confidence with "non-official mirror" flagged in the citation title | codes.iccsafe.org blocked fetches; the 12-in/12x6 values are corroborated by official plan-check docs (San Jose guidelines, LA County plan review list) but the code text itself should be re-cited from an official source at verification. |
| King County | Dropped two "other" items (unconditioned-to-be-exempt, critical-areas-void-exemption) | Already captured in the entry's permit rules and notes from the June pass — would have duplicated. |

**Open items for Urbatec (requirements pass):**
1. **Occupancy classification for CA pods** (San Jose + Del Mar): is a conditioned, non-sleeping office pod reviewed under single-family residential energy standards (150.0/150.1, CF1R) or as nonresidential (140.x, NRCC)? Both cities' items assume the residential path.
2. **San Jose Bulletin #250 "cannot be air conditioned"**: bulletin (12/09/2019, fetched via archive.org — live site blocks bots) predates the 2025-code adoption; confirm the current accessory-building path for conditioned pods with the Permit Center.
3. **LA County current ultimate design wind speed**: BCM #11's 85 mph is ASCE 7-05-era; 2026 code uses ASCE 7-22 and the current figure wasn't verifiable on an official page.
4. **Del Mar SDC letter** (the unverified-bucket item) and whether the whole city's coastal/WUI overlays apply to a given lot.
5. **King County WSEC compliance-form specifics**: the "energy code specification sheet" requirement comes from the Residential Basics handout (April 2026); confirm required form set for a heated accessory structure.
6. **Seattle**: whether a non-dwelling conditioned pod owes WSEC R406 additional-efficiency credits (credits language targets "dwelling units").

## Cross-cutting items

- **Quarterly re-verification:** re-run `node research/fetch-sources.js <id> --from-data` and diff
  the new snapshots against the archived ones; review any changed page before re-affirming the entry.
- **Verification workflow:** when an entry passes review, Fred sets `status: "verified"`,
  `last_verified: <date>`, `verified_by`, and resolves remaining `<<verify>>` markers. The test
  suite intentionally asserts that the repo's entries are draft — update that assertion when the
  first entry is verified (it exists to stop *research* from shipping verified status, not Fred).
- **Pattern worth noting for sales:** in 4 of 5 Tier 1 jurisdictions, the "under 120 sqft = no
  permit" rule of thumb does NOT straightforwardly apply to Mini·O pods (occupied-use limits in
  Seattle, the no-wiring condition in San Jose, unconditioned-only in King County, design review +
  coastal in Del Mar). The permitting package CTA is justified basically everywhere.
