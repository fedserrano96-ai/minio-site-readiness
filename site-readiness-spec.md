# Mini·O Site Readiness Assessment Tool
## Project Spec for Claude Code Build

---

## 1. What This Is

A branded, interactive web app that guides homeowners through a self-assessment of their property's readiness for a Mini·O pod installation. The tool ships inside a physical sample box sent to early-stage leads, accessed via QR code on a printed card.

**It is not a quiz or a test.** It is a collaborative tool that helps leads understand what their property needs, gives them specific actionable tasks for anything they don't know, and produces a structured summary the Mini·O sales team can use to accelerate the first call.

**Audience:** Homeowners early in the sales cycle. Not contractors. Not technical people. The language must be warm, clear, and jargon-free. Never use em dashes in any client-facing content.

---

## 2. Tech Stack

- **Frontend:** Single-page HTML/CSS/JS app (vanilla, no framework). Matches the existing backyard planner codebase style.
- **Hosting:** Netlify (static deploy)
- **Data Backend:** Airtable (dedicated base, not shared with the survey/feedback system)
- **Notifications:** Airtable native automation sends email to the generic sales inbox on every new submission
- **Design System:** Mini·O brand guidelines (see Section 9)

---

## 3. User Flow Overview

6 steps, linear progression with a progress bar. Users can navigate back to previous steps but cannot skip ahead. Each step saves state locally so a user can close and resume (use localStorage or sessionStorage).

```
Step 1: Your Space (Backyard Planner)
  |
Step 2: Access Path
  |
Step 3: Foundation & Placement
  |
Step 4: Utilities (Electrical always, Plumbing conditional, Internet)
  |
Step 5: Permitting & HOA
  |
Step 6: Your Readiness Report (Summary + Evidence Upload Prompts)
```

---

## 4. Step-by-Step Content Spec

### Step 1: Your Space (Backyard Planner)

**Purpose:** Establish the pod model, yard dimensions, and desired placement. This data feeds into subsequent steps.

**This step has two sub-screens:**

#### Step 1A: Contact Info (required before planner loads)

Simple form: First Name, Last Name, Email, Phone (optional), Property Address. Full-width stacked fields on mobile. Large tap targets (48px minimum input height). The address is used later for permitting context and for the sales team follow-up.

#### Step 1B: Backyard Planner (full overhaul of existing app)

The existing planner (file: `minio-planner.html`) must be rebuilt for mobile-first use. The current version has fundamental layout problems for phone screens and uses an off-brand color system. Below is a detailed breakdown of what exists, what's wrong, and what the rebuild needs.

**Current state of the planner (problems to solve):**

1. **Layout is desktop-only.** Uses a CSS Grid with a fixed 320px sidebar + flexible canvas area (`grid-template-columns: 320px 1fr`). On a phone screen this means either the sidebar is cut off or the canvas is invisible. There are no media queries, no responsive breakpoints, no mobile layout at all.

2. **Canvas interaction assumes mouse.** Touch events exist (`touchstart`, `touchmove`, `touchend`) but the implementation has issues: `e.preventDefault()` on `touchmove` is attached to `window` which can block page scrolling entirely. The drag-to-position interaction is also difficult on small screens because the pod is small relative to finger size, making precise placement frustrating.

3. **Pod data is wrong.** The Twelve is listed as 12x12 ft but it's actually 12x8 ft. The Station is listed as 16x10 but needs verification. The Sixteen is listed as 16x14 but it's actually 16x10 ft. Pod dimensions must match actual Mini·O specs.

4. **Color system is off-brand.** Uses a nature palette (--cream, --bark, --moss, --cedar, --sky, --grass) that doesn't match Mini·O's brand colors (Red #ED3648, Dark Blue #535266, Slate #9398A5, Sand #E3CDBF).

5. **Typography is off-brand.** Uses DM Serif Display + DM Mono. Should use Inter (Google Fonts fallback for Geomanist).

6. **Missing features for the assessment context:** No pod use selector, no connection to assessment state, no "Continue to next step" flow, the CTA is "Get a Quote" which doesn't apply here.

7. **Status bar and toolbar are desktop-oriented.** Scale readout, pod position coordinates, and coverage percentage are useful technical info but take up space on mobile with small text. Need to be simplified or hidden on mobile.

**Mobile-first planner rebuild spec:**

**Layout (mobile, < 768px):**
- Single column, full width
- Order from top to bottom:
  1. Pod selector (horizontal scrollable cards or tabs, not vertical list)
  2. Canvas area (takes remaining viewport height, minimum 300px)
  3. Controls drawer (collapsible, slides up from bottom): yard dimensions, orientation toggle, pod use selector
- The canvas should fill the available width and be tall enough to interact with comfortably. Use `100vw` width and calculate height from remaining viewport space after header, pod selector, and progress bar.
- Controls that aren't needed during drag interaction (yard size, orientation) go in a bottom drawer that can be collapsed to maximize canvas space.

**Layout (tablet/desktop, >= 768px):**
- Side-by-side layout similar to current version but using the brand system
- Sidebar on left (280px) with all controls
- Canvas area fills remaining space
- Status bar below canvas with position/clearance info

**Canvas interaction (mobile):**
- **Tap to place:** Instead of only drag-to-move, allow the user to tap anywhere in the yard to reposition the pod center to that point. This is much easier on mobile than trying to grab and drag a small rectangle.
- **Drag still works** but with a larger hit target. Expand the hit test area by 20px on each side of the pod so it's easier to grab with a finger.
- **Prevent scroll conflicts:** Only attach `preventDefault` to touch events on the canvas element itself, not on window. When not dragging the pod, the page should scroll normally.
- **Pinch to zoom:** Optional for v1, but design the canvas so it could support this later. For now, "Fit to View" auto-scales.
- **No hover states on mobile.** Remove the grab/pointer cursor changes and tooltip that depend on mouse hover.

**Canvas rendering updates:**
- Rebrand the grass area to use a lighter, subtler green that works with the Mini·O palette. The current gradient (#8BBF77 to #6B9D5B) is fine conceptually but the yard border, setback lines, and grid should use brand colors.
- Pod fill color: Use Mini·O Dark Blue (#535266) with slight transparency instead of the current cedar brown.
- Pod stroke: Mini·O Red (#ED3648) for the selected/active state.
- Setback warning state: Use Mini·O Red for the pod fill when outside the setback zone (current behavior is similar, keep it).
- Grid lines: Subtle, use Slate (#9398A5) at low opacity.
- Yard border: Dark Blue (#535266).
- Labels and text on canvas: Inter font, not DM Mono.

**Pod data (corrected):**
```javascript
const PODS = [
  { id: 'twelve',  name: 'The Twelve',  w: 12, d: 8,  label: '96 sq ft' },
  { id: 'sixteen', name: 'The Sixteen', w: 16, d: 10, label: '160 sq ft' },
  // Add The Station if it's a current product, verify dimensions with Chris/team
];
```
Note: Verify current product lineup and exact dimensions before build. The Twelve is 12x8 and The Sixteen is 16x10 based on project knowledge. The Station may or may not be current.

**Pod Use selector (new):**
- Added below the pod selector or in the controls drawer
- Options: Office, Studio, Guest Suite, Other (free text)
- This determines whether plumbing questions appear in Step 4 (Guest Suite triggers plumbing section)

**Info box (redesigned for mobile):**
- The current info box sits in the sidebar and updates with placement feedback. On mobile, this should be a small floating toast/banner above the canvas that shows clearance status and setback warnings.
- Keep it to one line on mobile: "5.2 ft clearance, within setback" or "Outside setback zone, move inward"

**CTA button:**
- Replace "Get a Quote" with "Continue" or "Next: Access Path"
- Styled as the primary brand CTA (Red background, white text, ALL CAPS)

**State connection:**
- All planner outputs (pod_model, pod_dimensions, yard_width, yard_depth, pod_position_x, pod_position_y, pod_orientation, pod_use) must be written to the shared assessment state object
- These values are referenced in later steps: Step 3 dynamically inserts pod dimensions into foundation clearance questions, Step 4 references pod model for plumbing conditional logic

**Output stored:** pod_model, pod_dimensions, yard_width, yard_depth, pod_position_x, pod_position_y, pod_orientation, pod_use, contact_info

---

### Step 2: Access Path

**Purpose:** Determine if a clear path exists from the street to the pod's final location, and whether a shed mule, crane, or on-site assembly will be needed.

**Intro text (shown to user):**
"Let's figure out how your pod gets from the street to its final spot. We need to check the path for clearance, obstacles, and tight turns. Don't worry if you're not sure about some of these. We'll tell you exactly what to check."

**Questions:**

**Q2.1: What is the narrowest width along the path from the street to the pod location?**
- More than 12 feet
- Between 10 and 12 feet
- Less than 10 feet
- I'm not sure

*If "I'm not sure":*
> **What to do:** Grab a tape measure and measure the narrowest point between the street and where you want the pod. Include gate openings, gaps between structures, and any spots where fences or walls create a bottleneck. Take a photo of each measurement.

**Q2.2: What is the lowest overhead clearance along the path? (tree branches, wires, eaves, pergolas)**
- More than 13 feet 6 inches
- Between 12 and 13 feet 6 inches
- Less than 12 feet
- I'm not sure

*If "I'm not sure":*
> **What to do:** Walk the full path from the street to the pod spot and look up. Note any low-hanging branches, power lines, cable lines, or structures that cross overhead. If you can, estimate the height or measure with a tape measure held vertically.

**Q2.3: Are there any 90-degree turns or sharp corners along the path?**
- No, it's a straight or gently curving path
- Yes, there is at least one sharp turn
- I'm not sure

*If "Yes":*
> **Good to know:** Sharp turns require a turning radius of 20 to 24 feet depending on the pod model. If the turn is tight, a crane or on-site assembly may be the better option. Take a photo of the turn so we can evaluate it.

**Q2.4: Is there a significant slope along the path?**
- No, it's mostly flat
- Yes, there is a noticeable slope or hill
- I'm not sure

**Q2.5: Can a truck back in from the street to your backyard?**
- Yes, there is a driveway or clear path for a truck
- No, the truck would need to park on the street
- I'm not sure

**Q2.6: After the pod is placed, is there room for the delivery equipment to exit the property?**
- Yes
- No, it would be blocked
- I'm not sure

*If "I'm not sure":*
> **What to do:** The shed mule (the machine that carries the pod into your backyard) needs to be able to drive out after placing the pod. Check if there's enough space for it to back out or turn around. The mule needs about 5 feet of length beyond the pod.

**Auto-recommendation logic (not shown as a question, computed from answers):**

| Access Width | Overhead | Turns | Recommendation |
|---|---|---|---|
| >12 ft, clear overhead, no sharp turns | >13'6" | No | Shed Mule (ground delivery) |
| 10-12 ft, marginal | 12-13'6" | Maybe | Shed Mule possible, may need adjustments |
| <10 ft OR overhead obstructions OR sharp turns | Any | Any | Crane or On-Site Assembly likely |
| Multiple "I'm not sure" | Any | Any | "We'll figure this out together on your call" |

**If crane is recommended, show additional context:**
"A crane lifts the pod over obstacles and places it directly into position. This works well when ground access is limited. On your call with Mini·O, we'll help you get a crane quote. For reference: crane deliveries start around $3,000 for shorter distances and go up from there depending on the lift distance and complexity."

**Output stored:** access_width, overhead_clearance, sharp_turns, slope, truck_access, equipment_exit, delivery_recommendation, per-question "i_dont_know" flags

---

### Step 3: Foundation & Placement

**Purpose:** Confirm the ground conditions at the pod's final location.

**Intro text:**
"Now let's look at the spot where your pod will sit. The ground needs to be level and solid. Here's what to check."

**Questions:**

**Q3.1: What is the surface where the pod will be placed?**
- Grass / lawn
- Gravel
- Concrete / patio slab
- Wood deck
- Something else (free text)
- I'm not sure

**Q3.2: Is the ground level at the pod location?**
- Yes, it looks flat
- No, there is a noticeable slope
- I'm not sure

*If "I'm not sure":*
> **What to do:** Open the Measure app on your iPhone (or a free level app on Android), tap "Level," and place your phone flat on the ground where you want the pod. Take a screenshot of the reading. Anything under 2 degrees is good. If the slope is more than that, a gravel or concrete pad can usually solve it.

*If "No, there is a noticeable slope":*
> **Good to know:** The ground needs to be level within about 1/4 inch per foot to avoid issues with the pod's sliding doors. If there's a slope, a properly built gravel or concrete pad can level things out. This is something your site prep contractor handles before delivery.

**Q3.3: Does anything need to be temporarily removed for installation? (fences, planters, ramps, garden beds)**
- No, the area is clear
- Yes (free text: describe what needs to be moved)
- I'm not sure

**Q3.4: Is there at least 3 feet of clearance around the pod location on all sides?**
- Yes
- No
- I'm not sure

*If "I'm not sure":*
> **What to do:** Measure from the edges of where the pod will sit to the nearest wall, fence, or structure on each side. Your pod is [dynamically insert pod dimensions from Step 1]. You need at least 3 feet on each side for installation access. More clearance is needed if using a shed mule (2 feet wider than the pod's narrow side).

**Q3.5: Do you already have a foundation or pad prepared?**
- Yes, concrete slab
- Yes, gravel pad
- No, I haven't prepared anything yet
- I'm not sure what I need

*If "No" or "I'm not sure":*
> **What to do:** Most pods sit on a gravel or concrete pad. The pad should match the pod's footprint ([insert dimensions]) and extend about 12 inches beyond each side for drainage. The ground underneath needs to be compacted and level. We recommend working with a local site prep company for this, and we can point you to resources on our site.

**Output stored:** surface_type, ground_level, temporary_removals, clearance_around, foundation_status, per-question "i_dont_know" flags

---

### Step 4: Utilities

**Purpose:** Understand the electrical setup, and if applicable, plumbing and internet needs.

**Intro text:**
"Your pod needs to be connected to your home's electrical system. If you're adding a bathroom, we'll also need to know about water and sewer. Let's see what your setup looks like."

#### 4A: Electrical (always shown)

**Q4A.1: Do you know where your home's main electrical panel is?**
- Yes
- No

*If "No":*
> **What to do:** Your electrical panel is usually a gray metal box, about 1 foot wide and 2 feet tall. Common locations: garage, basement, utility room, or on an exterior wall near the electric meter. When you find it, take a photo of the panel with the door open. The label inside the door shows your home's total amperage.

**Q4A.2: What is your home's electrical service amperage?**
- 200 amps
- 100 amps
- Other (free text)
- I don't know

*If "I don't know":*
> **What to do:** Open your electrical panel door and look at the main breaker at the top. It will have a number on it (usually 100 or 200). That's your home's total amperage. Take a photo and share it with us. Your pod needs a 50-amp connection, and most homes with 200-amp service can handle this easily. If you have 100-amp service, your electrician can advise whether an upgrade is needed.

**Q4A.3: Approximately how far is your electrical panel from the pod location?**
- Less than 25 feet
- 25 to 50 feet
- 50 to 100 feet
- More than 100 feet
- I'm not sure

*If "I'm not sure":*
> **What to do:** Walk from your electrical panel to the pod spot and count your steps. Each step is roughly 2.5 feet. Multiply your step count by 2.5 for an approximate distance. This helps your electrician estimate the wiring cost.

**Q4A.4: Are there any obstacles between the panel and the pod location that would make running a wire difficult? (driveways, patios, retaining walls)**
- No, it's a clear path through soil/grass
- Yes (free text: describe)
- I'm not sure

#### 4B: Plumbing (conditional: only shown if pod model includes bathroom OR user selected "Guest Suite" as pod use)

**Conditional intro:** "Since your pod includes a bathroom, we'll need water and sewer connections."

**Q4B.1: Do you know where your home's nearest water line access point is?**
- Yes
- No

*If "No":*
> **What to do:** Your water line typically enters the house near the water meter (usually at the front of the house or in the basement). You can also look for outdoor hose bibs (outdoor faucets) as potential connection points. If you have your home's blueprint or site plan, it will show utility locations. Your city/county building department can also provide this.

**Q4B.2: How far is the nearest water line from the pod location?**
- Less than 25 feet
- 25 to 50 feet
- 50 to 100 feet
- More than 100 feet
- I don't know

**Q4B.3: Do you have sewer or septic?**
- Sewer (connected to city/municipal system)
- Septic tank
- I don't know

**Q4B.4: How far is the sewer/septic connection from the pod location?**
- Less than 25 feet
- 25 to 50 feet
- 50 to 100 feet
- More than 100 feet
- I don't know

*If "I don't know" on distance:*
> **What to do:** If you have a septic system, the tank is usually in the yard (look for a slightly raised or different-colored patch of grass). For sewer, the cleanout is typically a white or black pipe sticking out of the ground near the house. Your home's site plan will show exact locations.

#### 4C: Internet

**Q4C.1: How do you plan to get internet to your pod?**
- Wi-Fi from my house (router close enough)
- I'll run an ethernet cable
- I'll figure it out later
- I'm not sure

*If "I'm not sure":*
> **Good to know:** Most homeowners use their home Wi-Fi. If your router is within 50 to 75 feet of the pod and there aren't too many walls in between, Wi-Fi usually works fine. For more reliable connections, you can run a Cat6 ethernet cable from your router to the pod. Your electrician can do this at the same time as the electrical hookup.

**Output stored:** panel_location_known, service_amperage, panel_distance, wiring_obstacles, water_line_known, water_distance, sewer_type, sewer_distance, internet_plan, per-question "i_dont_know" flags

---

### Step 5: Permitting & HOA

**Purpose:** Flag awareness level and potential blockers. Mini·O handles the actual research, but early awareness prevents surprises.

**Intro text:**
"Permit requirements depend on where you live, the size of the pod, and how it will be used. Most of our customers don't need to worry about this because we help you navigate it. But it's good to know where you stand."

**Q5.1: Have you checked whether your city or county requires a building permit for an accessory structure?**
- Yes, and a permit is required
- Yes, and a permit is NOT required
- No, I haven't checked
- I'm not sure

*If "No" or "I'm not sure":*
> **What to do:** Call your city's building department and ask: "Do I need a permit for a prefabricated accessory structure under [120/200] square feet in my backyard?" In many areas, structures under 120 square feet don't need a building permit, but this varies by city and state. Don't worry if this feels complicated. Mini·O has experience with permits across the country, and we can research your specific requirements for you.

*If "Yes, a permit is required":*
> **Good to know:** Mini·O handles permitting for many of our customers. We'll research what's needed for your specific location and walk you through the process. Permits typically add 1 to 5 months to the timeline and may require minor modifications to the pod to meet local code.

**Q5.2: Is your property part of a Homeowners Association (HOA)?**
- Yes
- No
- I'm not sure

*If "Yes":*
> **What to do:** Check your HOA's CC&Rs (Covenants, Conditions & Restrictions) for rules about outbuildings, accessory structures, or sheds. Some HOAs require approval before installation, and may have rules about placement, size, or materials. If you can, share the relevant section of your CC&Rs with us and we'll review it.

**Q5.3: Are you aware of any setback requirements for your property? (minimum distance structures must be from property lines)**
- Yes, I know my setbacks
- No
- I'm not sure

*If "No" or "I'm not sure":*
> **What to do:** Setback requirements are usually available from your city's building or planning department. Common setbacks are 5 to 10 feet from rear and side property lines. Your property's plat map (available from the county assessor) shows your lot boundaries.

**Output stored:** permit_checked, permit_required, hoa_status, setback_awareness, per-question "i_dont_know" flags

---

### Step 6: Your Readiness Report

**Purpose:** Generate a personalized summary with a readiness status per section, actionable next steps for every "I don't know" or flagged item, the auto-recommended delivery method, and prompts for evidence collection.

**This step has three parts:**

#### Part A: Readiness Overview

Display a visual summary showing each section's status:

| Status | Label | Color | Meaning |
|---|---|---|---|
| Ready | "You're set" | Green (#4CAF50) | All questions answered positively, no blockers |
| Action Needed | "A few things to sort out" | Amber (#F5A623) | Specific tasks the homeowner needs to complete |
| Find Out | "Let's figure this out" | Blue (Mini·O Slate #9398A5) | User selected "I don't know" and needs guidance |
| Potential Blocker | "Let's talk about this" | Red (Mini·O Red #ED3648) | Access < 10ft, major slope, etc. |

**Readiness logic per section:**

**Access Path:**
- All clear answers + adequate clearance = Ready
- Some "I'm not sure" but no red flags = Find Out
- Width < 10ft OR overhead < 12ft OR blocked exit = Potential Blocker

**Foundation:**
- Level ground + surface identified + clearance confirmed = Ready
- Slope or no foundation yet = Action Needed
- "I'm not sure" on levelness = Find Out

**Electrical:**
- Panel located + amperage known + distance measured = Ready
- Panel not located OR amperage unknown = Find Out
- Distance > 100ft = Action Needed (flag cost implication)

**Plumbing (if applicable):**
- Lines located + distances measured = Ready
- Lines not located = Find Out
- Distance > 100ft = Action Needed

**Permitting:**
- Checked and no permit needed = Ready
- Permit required = Action Needed (not a blocker, just work to do)
- Haven't checked = Find Out

**Overall status line:**
- If all sections Ready: "Your property looks great for a Mini·O pod. Let's get started."
- If mix of Ready/Action/Find Out: "You're in good shape. Here are [X] things to take care of before your next call with us."
- If any Potential Blocker: "Your property has a couple of things we should discuss together. Don't worry, there's almost always a solution."

#### Part B: Your Personalized Checklist

Generate a to-do list based on all "Find Out" and "Action Needed" items. Each item includes:
- What to do (the specific micro-guide from the "I don't know" response)
- Why it matters (one sentence)
- How to share it with us (photo, measurement, screenshot)

Group by priority:
1. Things to find out (the "I don't know" items with their specific instructions)
2. Things to prepare (action items like clearing the path, leveling ground, etc.)
3. Things we'll handle together (items flagged for the sales call)

#### Part C: Evidence Collection Prompts

Before submission, prompt the user to capture and note the following. These are optional but recommended. Use a checklist format with the ability to mark as "done" or "will do later":

- [ ] Walkthrough video: Record yourself walking the full path from the street to the pod spot. Point out any tight spots, low branches, or obstacles.
- [ ] Access path measurements: Photos of tape measure at the narrowest and lowest clearance points.
- [ ] Pod spot photo: Take a photo of the area where the pod will sit, showing the ground surface and surroundings.
- [ ] Electrical panel photo: Open the panel door and photograph the label showing your amperage.
- [ ] Distance measurements: Step count or tape measure from panel to pod spot, and (if bathroom) from water/sewer to pod spot.

**Note:** Do NOT build actual file upload functionality in v1. Instead, prompt the user to have these ready for their call with Mini·O. The checklist is about preparation, not file transfer. If file upload is added later, it should connect to a Google Drive folder or similar (separate scope).

#### Submission

**Submit button:** "Send My Results to Mini·O"

On submit:
1. Validate contact info from Step 1
2. POST all assessment data to Airtable via API
3. Show confirmation: "Thanks, [First Name]. Your readiness report has been sent to our team. One of our pod specialists will review your results and reach out within 2 business days. In the meantime, work through any checklist items and we'll pick up where you left off."
4. Offer to download/print a copy of their readiness report (generate a clean HTML print view)

---

## 5. "I Don't Know" System (Global Rules)

Every technical question must include an "I don't know" or "I'm not sure" option. This is non-negotiable. These leads are homeowners, not contractors.

When a user selects "I don't know":

1. **Immediately show a micro-guide** below the question with specific, actionable instructions for how to find the answer. Use simple language. Reference tools they already have (iPhone Measure app, tape measure, walking and counting steps).

2. **In the final report,** roll up all "I don't know" items into the "Things to find out" section with the same micro-guides, so the lead has a printable to-do list.

3. **In the Airtable record,** flag which questions were answered as "I don't know" so the sales rep knows what to cover on the call.

4. **Never penalize "I don't know" answers.** They should not turn a section red. They result in "Find Out" status (blue), which is positioned as collaborative, not as failure.

---

## 6. Delivery Method Recommendation (Auto-Computed)

The delivery method is NOT a step the user completes. It is auto-computed from the Access Path answers and displayed in the final report.

**Logic:**

```
IF access_width >= 12ft
   AND overhead_clearance >= 13.5ft
   AND sharp_turns == false
   AND truck_access == true
   AND equipment_exit == true
THEN recommend "Shed Mule (Ground Delivery)"
   Note: "Your pod will be delivered on a trailer and moved into position using a shed mule.
   This is the simplest and most common installation method."

ELSE IF access_width >= 10ft (but other constraints exist)
THEN recommend "Shed Mule Possible With Adjustments"
   Note: "Ground delivery may work, but [specific constraint] needs attention.
   We'll confirm the best approach on your call."

ELSE IF access_width < 10ft OR significant overhead obstructions
THEN recommend "Crane Delivery Likely"
   Note: "A crane will lift your pod over obstacles and place it directly into position.
   This is common and works well for properties with limited ground access.
   On your call, we'll help you get a crane quote."

IF multiple "I don't know" on access questions
THEN recommend "To Be Determined"
   Note: "We need a few more details about your access path before recommending
   a delivery method. Complete the checklist items above, or we'll figure it out
   together on your call."
```

---

## 7. Airtable Schema

### Base Name: "Mini·O Site Readiness Assessments"

### Table: Submissions

| Field Name | Type | Notes |
|---|---|---|
| First Name | Single line text | |
| Last Name | Single line text | |
| Email | Email | |
| Phone | Phone number | Optional |
| Property Address | Long text | |
| Submission Date | Date | Auto-filled |
| Pod Model | Single select | The Twelve, The Sixteen, The Station |
| Pod Use | Single select | Office, Studio, Guest Suite, Other |
| Yard Dimensions | Single line text | e.g. "40 x 30 ft" |
| Pod Orientation | Single select | 0°, 90° |
| **Access Path** | | |
| Access Width | Single select | >12ft, 10-12ft, <10ft, Unknown |
| Overhead Clearance | Single select | >13'6", 12-13'6", <12ft, Unknown |
| Sharp Turns | Single select | No, Yes, Unknown |
| Slope | Single select | Flat, Slope, Unknown |
| Truck Access | Single select | Yes, No, Unknown |
| Equipment Exit | Single select | Yes, No, Unknown |
| Delivery Recommendation | Single select | Shed Mule, Shed Mule With Adjustments, Crane Likely, TBD |
| **Foundation** | | |
| Surface Type | Single select | Grass, Gravel, Concrete, Wood Deck, Other, Unknown |
| Ground Level | Single select | Level, Slope, Unknown |
| Temporary Removals | Long text | Free text or "None" |
| Clearance Around Pod | Single select | Yes, No, Unknown |
| Foundation Status | Single select | Concrete, Gravel, Not Prepared, Unknown |
| **Electrical** | | |
| Panel Location Known | Checkbox | |
| Service Amperage | Single select | 200A, 100A, Other, Unknown |
| Panel to Pod Distance | Single select | <25ft, 25-50ft, 50-100ft, >100ft, Unknown |
| Wiring Obstacles | Long text | Free text or "None" |
| **Plumbing** | | |
| Plumbing Applicable | Checkbox | |
| Water Line Known | Checkbox | |
| Water Distance | Single select | <25ft, 25-50ft, 50-100ft, >100ft, Unknown |
| Sewer Type | Single select | Sewer, Septic, Unknown |
| Sewer Distance | Single select | <25ft, 25-50ft, 50-100ft, >100ft, Unknown |
| **Internet** | | |
| Internet Plan | Single select | Wi-Fi, Ethernet, Later, Unknown |
| **Permitting** | | |
| Permit Checked | Single select | Required, Not Required, Not Checked, Unknown |
| HOA Status | Single select | Yes, No, Unknown |
| Setback Awareness | Single select | Yes, No, Unknown |
| **Summary** | | |
| Overall Status | Single select | Ready, Mostly Ready, Needs Attention, Has Blockers |
| "I Don't Know" Count | Number | Total questions answered as unknown |
| Section Statuses | Long text | JSON string: {"access": "ready", "foundation": "find_out", ...} |
| Evidence Checklist | Long text | Which items marked as done/will do later |
| Notes | Long text | Any free-text entries compiled |

### Airtable Automation Setup

**Trigger:** When a new record is created in the Submissions table.

**Action:** Send an email.

**To:** [generic sales email address]

**Subject:** "New Site Readiness Assessment: [First Name] [Last Name]"

**Body:**
```
A new Site Readiness Assessment has been submitted.

Lead: [First Name] [Last Name]
Email: [Email]
Phone: [Phone]
Address: [Property Address]
Pod: [Pod Model] for [Pod Use]

Overall Status: [Overall Status]
Delivery Recommendation: [Delivery Recommendation]
"I Don't Know" Items: [I Don't Know Count]

View full details: [Link to Airtable record]
```

---

## 8. Mobile-First Design Requirements

**The primary use case is a homeowner scanning a QR code on their phone.** Every design decision starts with mobile. Desktop is the enhancement, not the other way around.

### Design Philosophy
- Build for a 375px wide screen first (iPhone SE/13 Mini). Everything works here before adding tablet/desktop enhancements.
- Every interactive element must be usable with a thumb. Minimum tap target: 48px height, 44px width.
- No horizontal scrolling. Ever.
- No hover-dependent interactions. Hover states can exist as progressive enhancement on desktop but nothing should require hover to function.
- Page content must remain scrollable even when interactive elements (like the planner canvas) are on screen. Touch conflicts between scrolling and dragging must be resolved in favor of scroll unless the user is clearly interacting with a draggable element.

### Breakpoints
```css
/* Mobile first: base styles target phones */

/* Tablet */
@media (min-width: 768px) { ... }

/* Desktop */
@media (min-width: 1024px) { ... }
```

### Global Mobile Layout

**Header (sticky):**
- Mini·O logo (left), compact. 40px height max.
- Progress bar below the logo bar, thin (4px), always visible.
- Step label: "Step 2 of 6: Access Path" in small text below the progress bar.
- Total header height on mobile: approximately 80px.

**Content area:**
- Full-width, with 16px horizontal padding.
- Questions stack vertically, one at a time or in a scrollable list per step (depending on step length).
- Each question card has generous vertical spacing (24px between cards).

**Navigation (sticky bottom):**
- Fixed to bottom of viewport, 60px height.
- Two buttons: "Back" (left, secondary style) and "Next" (right, primary CTA style).
- "Next" is disabled until required questions in the current step are answered.
- On Step 6 (final), "Next" becomes "Send My Results to Mini·O."

### Component Sizing for Mobile

**Question cards:**
- Full width minus padding (calc(100vw - 32px))
- White background, 8px border radius, 20px padding
- Question text: 16px Inter 600 (not smaller, readability matters on phones)
- Helper text below question: 14px Inter 400, Slate color

**Option buttons (answer choices):**
- Full width, stacked vertically
- 52px minimum height (larger than standard, easier to tap)
- 16px text
- 12px gap between options
- Selected state: Dark Blue background, white text, subtle checkmark icon
- "I'm not sure" option: Same size as other options. Slate border and text color to differentiate without making it feel lesser.

**Micro-guide cards ("What to do"):**
- Appear inline below the question when "I'm not sure" is selected
- Sand (#E3CDBF) background, 4px left border in Slate
- 14px body text
- Slightly indented (8px left margin beyond the question card)
- Include a small lightbulb or info icon (SVG, not emoji)

**Text inputs (yard dimensions, free-text fields):**
- 48px height minimum
- 16px font size (prevents iOS zoom on focus)
- `inputmode="numeric"` for number fields (shows number keyboard on mobile)
- `inputmode="email"` for email field
- `inputmode="tel"` for phone field

### Step-Specific Mobile Considerations

**Step 1 (Planner):**
- See the detailed planner overhaul spec in Section 4. The planner has its own mobile layout with pod selector tabs on top, canvas in the middle, and a collapsible controls drawer at the bottom.
- The canvas must not steal scroll. Touch events on the canvas should only preventDefault when the user is actively dragging the pod.

**Steps 2-5 (Question steps):**
- Single column of question cards, scrollable.
- If a step has more than 4 questions, consider progressive disclosure: show questions one at a time with a "Next question" micro-step within the step. This avoids overwhelming the user with a long scroll of questions on a small screen.
- Conditional questions (e.g., plumbing in Step 4) should animate in smoothly when triggered, not cause a jarring layout shift.

**Step 6 (Summary):**
- Readiness overview: horizontal status pills or a compact grid showing each section's status with color coding.
- Personalized checklist: collapsible sections, one per assessment area. Expand to see the micro-guides.
- Evidence checklist: simple checkboxes, full width, generous spacing.
- Submit button: full width, 56px height, sticky at bottom (replaces the nav bar on this step).
- Print/download: secondary action, placed below the submit button.

### Performance on Mobile
- Total page weight target: under 200KB (excluding images). The planner canvas is rendered, not image-based, so this should be achievable.
- No heavy frameworks. Vanilla JS, minimal CSS, Inter font loaded async.
- Canvas rendering should use `requestAnimationFrame` properly and avoid redrawing when nothing has changed.
- Test on throttled 3G in Chrome DevTools to ensure acceptable load time (under 3 seconds on slow connection).

---

## 9. Brand System

### Colors
```css
:root {
  --mini-o-red: #ED3648;       /* CTAs, accents, key highlights */
  --mini-o-dark-blue: #535266; /* Backgrounds, headings, dark text */
  --mini-o-slate: #9398A5;    /* Secondary text, dividers, "Find Out" status */
  --mini-o-sand: #E3CDBF;     /* Warm backgrounds, card surfaces */
  --mini-o-white: #FFFFFF;    /* Page background */

  /* Status colors (not from brand palette, used for assessment only) */
  --status-ready: #4CAF50;
  --status-action: #F5A623;
  --status-find-out: #9398A5; /* Reuse slate */
  --status-blocker: #ED3648;  /* Reuse red */
}
```

### Typography
- **Primary font:** Inter (Google Fonts fallback for Geomanist)
- **Load:** `https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap`
- **Headings:** Inter 600/700, Dark Blue
- **Body:** Inter 400, Dark Blue
- **CTAs:** Inter 700, ALL CAPS, White on Red background
- **Micro-guides ("What to do"):** Inter 400, slightly smaller, on Sand background card

### Logo
- Use the red version on white backgrounds
- Minimum size 60px wide
- Clear space: height of "m" on all sides
- SVG source available at skill assets: `mini-o_logo_red.svg`
- Position: top-left of the header bar

### Component Patterns
- **Question cards:** White background with subtle border (Slate at 20% opacity), rounded corners (8px), comfortable padding (24px)
- **Option buttons:** Large, full-width on mobile. Selected state: Dark Blue background with white text. Unselected: White with Dark Blue border.
- **"I don't know" option:** Visually distinct but not lesser. Same size as other options. Use Slate color to differentiate without suggesting it's a wrong answer.
- **Micro-guide cards:** Sand background, left border in Slate, slightly indented. Icon: lightbulb or info circle.
- **Progress bar:** Thin (4px), Red fill on Slate track. Step labels below.
- **Submit button:** Red background, white text, ALL CAPS ("SEND MY RESULTS TO MINI·O"), full-width on mobile, centered on desktop.

### Content Voice
- Warm and clear. Confident, not corporate.
- Second person ("your pod," "your backyard").
- Short sentences. No jargon.
- Never use em dashes. Use periods, commas, or colons instead.
- Avoid exclamation marks except in the final confirmation.
- When reassuring the user: "Don't worry, we'll figure this out together."

---

## 10. Build Phases for Claude Code

### Phase 1: Project Setup + Mobile Shell
- Initialize project structure (HTML, CSS, JS files)
- Implement mobile-first responsive layout shell
- Build the sticky header with Mini·O logo + progress bar
- Build the sticky bottom navigation (Back/Next)
- Apply Mini·O brand system globally (colors, typography, logo via SVG)
- Implement step-to-step navigation framework
- Implement local state management with sessionStorage (save/resume)
- Build the contact info form (Step 1A) with proper mobile input types
- Test on mobile viewport (375px) before proceeding

### Phase 2: Backyard Planner Rebuild (Step 1B)
This is the biggest single phase. The existing planner must be rebuilt, not patched.
- Build mobile layout: pod selector tabs (top) + canvas (middle) + collapsible controls drawer (bottom)
- Build tablet/desktop layout: sidebar + canvas side-by-side
- Correct pod dimensions (The Twelve: 12x8, The Sixteen: 16x10, verify others)
- Rebrand canvas rendering: Mini·O colors for pod, grid, borders, setback zone
- Rebrand UI: Inter font, brand color system, proper CTA styling
- Implement tap-to-place interaction for mobile (tap anywhere in yard to move pod)
- Fix touch event handling: preventDefault only on canvas during active drag, not on window
- Expand hit test area for finger-friendly dragging (+20px padding around pod)
- Add pod use selector (Office, Studio, Guest Suite, Other)
- Connect all planner state to the shared assessment state object
- Remove desktop-only status bar on mobile, replace with floating clearance toast
- Replace "Get a Quote" CTA with "Next: Access Path" integrated into bottom nav
- Test drag interaction on actual phones (iOS Safari, Android Chrome)

### Phase 3: Question Card System + Steps 2-3
- Build the reusable question card component
- Build the option button component with selected/unselected states
- Build the "I'm not sure" micro-guide component (Sand background, expandable)
- Build progressive disclosure for long question lists on mobile
- Implement Step 2 (Access Path) with all questions and conditional micro-guides
- Implement Step 3 (Foundation) with all questions and conditional micro-guides
- Wire dynamic content injection (pod dimensions from Step 1 into Step 3 copy)
- Build the delivery recommendation engine (auto-computed from Step 2 answers)
- Test question flow on mobile: scrolling, answer selection, micro-guide expand/collapse

### Phase 4: Steps 4-5 (Utilities + Permitting)
- Build Step 4 with conditional plumbing section (triggered by pod model or pod use = Guest Suite)
- Build Step 5 permitting questions
- All micro-guides for "I don't know" responses
- Test conditional logic: plumbing section appears/hides correctly based on Step 1 selections

### Phase 5: Readiness Report + Submission (Step 6)
- Build readiness scoring engine (per-section status calculation)
- Build the visual summary view (status per section with color coding)
- Build the personalized checklist generator (rolls up all "I don't know" and "Action Needed" items)
- Build the evidence collection checklist (checkboxes, not file upload)
- Build the delivery recommendation display (auto-computed, not user-selected)
- Implement Airtable API submission via Netlify serverless function (keeps API key server-side)
- Build confirmation screen
- Build print/download view (clean HTML print stylesheet)
- Test full flow end-to-end on mobile

### Phase 6: Polish + QA
- Cross-browser testing: Safari iOS, Chrome Android, Chrome desktop, Firefox, Safari desktop
- Accessibility: keyboard navigation, ARIA labels, focus management between steps, color contrast ratios (WCAG AA minimum)
- Test on slow connections (throttled 3G): ensure under 3 second load
- Edge cases: user goes back and changes pod model (does plumbing section appear/disappear correctly?), user selects all "I don't know," user leaves and resumes later
- Final brand consistency review against Mini·O guidelines
- Test Airtable submission and email automation end-to-end

---

## 11. Files to Reference During Build

These files are available in the project and should be referenced as needed:

| File | Use |
|---|---|
| `minio-planner.html` (uploaded) | Existing backyard planner to integrate into Step 1 |
| `Brand_Guidelines_MiniOcompressed.pdf` | Full brand guidelines PDF |
| `mini-o_logo_red.svg` (in brand skill assets) | Logo SVG for embedding |
| `Sales_Resources____master_-*.pdf` | Installation checklist, delivery methods, FAQ content |
| `Ops_Manual_and_Resources*.pdf` | Foundation specs, electrical hookup details, delivery logistics |
| `Terms__Conditions*.pdf` | Foundation levelness requirements, payment terms |
| `MiniO___Specs_and_Aesthetics_Guidelines_*.pdf` | Pod dimensions and specs |

---

## 12. Out of Scope for V1

- File/video upload functionality (prompt users to prepare, but no actual upload)
- CRM integration beyond Airtable
- Automated lead scoring or assignment
- Integration with ClickUp task creation
- Multi-language support
- User accounts or login
- Zapier/Make automations (Airtable native automation only)
- Detailed crane quoting tool
- Permit research automation

---

## 13. Success Metrics

- Lead completes the full assessment (not just Step 1)
- Sales rep has enough info from the submission to skip basic discovery on the first call
- Leads who complete the assessment convert at a higher rate than those who don't (track over time)
- Overall satisfaction score on sales calls improves (less time spent on logistics, more on value)
- Average "I don't know" count decreases as leads prepare before their call
