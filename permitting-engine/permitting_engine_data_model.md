# Mini·O Permitting Triage Engine — Data Model (v0.1)

Internal spec for the sales-enablement permitting tool. Defines how one jurisdiction's
permitting logic is stored, how a pod configuration is matched against it, and what the
tool returns. Hand this to Claude Code when the schema is locked and the pilot jurisdiction
is researched.

---

## 1. Design principles

1. **Guidance, not verdict.** Every outcome is `likely_exempt`, `likely_required`, or
   `depends`, never a flat yes/no. The customer carries final responsibility; the tool points.
2. **Every claim is dated and cited.** No outcome ships without a source citation and a
   `last_verified` date. If it can't be cited, it's `depends` with a "confirm with the office" note.
3. **Graceful degradation.** A jurisdiction that hasn't been researched yet returns the
   generic product logic plus a "we'll verify your specific city" message. The tool is useful
   with two jurisdictions loaded; it does not need full coverage to ship.
4. **Product facts are known; jurisdiction facts are researched.** The pod side (sizes,
   configs) is fixed and lives in this spec. The jurisdiction side is filled in only after
   verification against the official source and a gut-check with Production (Rod).
5. **Sells the package.** Any result containing a required permit surfaces the paid
   permitting-package call to action.

---

## 2. Pod configuration (the input)

What the rep or customer selects. These values are fixed Mini·O product facts.

```json
{
  "model": "twelve | sixteen | station | custom",
  "footprint_sqft": 96,
  "plumbing": "none | half_bath | kitchenette | full_bath",
  "sleeping_intended": false,
  "on_trailer": false,
  "electrical": "standard"
}
```

| Field | Notes |
|---|---|
| `model` | The Twelve = 12×8 = **96 sqft**. The Sixteen = 16×10 = **160 sqft**. The Station = 30×10 = **300 sqft**. Custom sets its own footprint. The three models form a clean size ladder: the Twelve sits under the common 120 sqft exemption line, the Sixteen sits just over it, and the Station is well above it and the most likely to be read as a dwelling unit. |
| `footprint_sqft` | The single most important variable. The common **120 sqft** line is where many jurisdictions flip an accessory structure from exempt to permit-required, which is exactly why a Twelve and a Sixteen can land on opposite sides. |
| `plumbing` | Any water/sewer connection (half bath, kitchenette, full bath) is the second big trigger, often reclassifying the pod toward a dwelling unit (DADU). |
| `sleeping_intended` | Pushes toward dwelling-unit / habitable-space classification in some jurisdictions. |
| `on_trailer` | Trailer-mounted units can fall outside "structure" rules in some jurisdictions (treated as a vehicle/RV). First-class option, not an edge case. |
| `electrical` | Standardized; may trigger a standalone electrical permit independent of the building permit. |

---

## 3. Jurisdiction record (the knowledge base entry)

One object per permitting authority. A city is its own jurisdiction; unincorporated county
is a separate jurisdiction.

```json
{
  "id": "wa-king-seattle",
  "name": "Seattle",
  "level": "city | unincorporated_county",
  "county": "King",
  "state": "WA",
  "status": "verified | draft | not_researched",
  "last_verified": "2026-06-01",
  "verified_by": "Fred",
  "authority": {
    "dept": "Seattle Dept of Construction & Inspections",
    "url": "https://...",
    "phone": "",
    "email": ""
  },
  "adopted_codes": "context only, e.g. 2021 IRC + local amendments",
  "rules": [ /* see section 4 */ ],
  "zoning_note": "Setbacks, lot coverage, ADU rules. Cited, freeform.",
  "hoa_note": "Standard reminder that an HOA may impose separate rules.",
  "notes": "Caveats, edge cases, anything a rep should know."
}
```

---

## 4. Rule (condition → outcome) — the core object

Each rule maps a pod configuration to a set of permit outcomes. The tool evaluates a pod
config against all rules in a jurisdiction; the **most specific matching rule wins**.

```json
{
  "id": "seattle-accessory-under-120-no-plumbing",
  "when": {
    "footprint": { "max": 120 },
    "plumbing": ["none"],
    "on_trailer": "any",
    "sleeping": false
  },
  "result": {
    "building_permit": "likely_exempt",
    "electrical_permit": "depends",
    "plumbing_permit": "not_applicable",
    "zoning_review": "depends"
  },
  "citation": {
    "code_section": "<<verify>>",
    "title": "<<verify>>",
    "url": "<<verify>>",
    "snippet": "<<short paraphrase of the official rule, <15 words if quoted>>"
  },
  "confidence": "high | medium | low",
  "rationale": "Plain-English why, one or two sentences."
}
```

**`when` matching:** any field set to `"any"` is a wildcard. `footprint` accepts
`{ "max": n }`, `{ "min": n }`, or a range. `plumbing` is a list of qualifying values.
A rule matches only if every specified condition is satisfied.

**Specificity:** more non-wildcard conditions = more specific = higher priority. If two rules
tie, the lower-confidence one should not override a higher-confidence one.

---

## 5. Evaluation + output

The tool runs the pod config against the matched jurisdiction (or the product-default set if
`status: not_researched`) and assembles:

```json
{
  "jurisdiction": "Seattle, King County, WA",
  "verified_as_of": "2026-06-01",
  "config_summary": "The Sixteen, half bath, slab foundation",
  "permits": {
    "building_permit": "likely_required",
    "electrical_permit": "likely_required",
    "plumbing_permit": "likely_required",
    "zoning_review": "depends"
  },
  "citations": [ /* one per non-exempt determination */ ],
  "next_step": "Official contact + the 2-3 questions to ask them.",
  "package_cta": true,
  "disclaimer": "see section 7",
  "coverage": "verified | product_default"
}
```

---

## 6. Keeping it tractable (tiers)

- **Tier 1 (build first):** the handful of jurisdictions with real sales/lead volume —
  City of Seattle, unincorporated King County, City of LA, unincorporated LA County.
- **Tier 2:** next ring by volume (Bellevue, Tacoma, San Diego, San Jose, Portland, Orange County cities).
- **Everything else:** `not_researched` → product-default output + "we'll confirm your city."

Re-verify Tier 1 quarterly; Tier 2 can run on a longer cadence.

---

## 7. Standard disclaimer (client-facing, when exposed)

> This is general guidance based on our reading of publicly available requirements as of
> [DATE], not a permitting determination. Requirements change and are interpreted by your
> local office. Confirming what applies to your property is the property owner's
> responsibility. Mini·O offers a permitting package that handles this for you.

---

## 8. Blank jurisdiction template

```json
{
  "id": "",
  "name": "",
  "level": "city",
  "county": "",
  "state": "",
  "status": "draft",
  "last_verified": "",
  "verified_by": "Fred",
  "authority": { "dept": "", "url": "", "phone": "", "email": "" },
  "adopted_codes": "",
  "rules": [],
  "zoning_note": "",
  "hoa_note": "An HOA may impose separate requirements regardless of city rules.",
  "notes": ""
}
```
