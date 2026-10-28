// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { renderCard, type CardView } from '../../src/assessment/ui/card';
import {
  coverageText, costLineText, describeChange, formatMoney, leadTimeText, methodTitle, pillText,
  noteText, toCheckText, reasonText,
} from '../../src/assessment/ui/copy';
import { recommend } from '../../src/assessment/core/rules';
import { priceRecommendation, leadTime } from '../../src/assessment/core/pricing';
import { lookupLocation } from '../../src/assessment/core/location';
import type { Answers, Location, ModelId, PlannerSnapshot, Recommendation } from '../../src/assessment/core/types';

const snapshot: PlannerSnapshot = {
  model: 'sixteen', rotation: 0, yardW: 40, yardD: 30, podX: 20, podY: 15, podUse: 'office', objects: [],
};

function loc(zip: string): Location {
  const l = lookupLocation(zip);
  if (!l) throw new Error(`test setup: no location for ${zip}`);
  return l;
}

function view(answers: Answers = {}, location: Location | null = null, model?: ModelId,
  change: CardView['change'] = null, snap: PlannerSnapshot = snapshot, open = false): CardView {
  const rec = recommend(snap, answers, model);
  return { rec, cost: priceRecommendation(rec, location, answers), lead: leadTime(rec, location), location, change, open };
}

function render(v: CardView): HTMLElement {
  const el = document.createElement('div');
  document.body.appendChild(el);
  renderCard(el, v);
  return el;
}

const text = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ');
const button = (el: HTMLElement, label: string): HTMLButtonElement => {
  const b = Array.from(el.querySelectorAll('button')).find(x => x.textContent?.trim() === label);
  if (!b) throw new Error(`no button "${label}"`);
  return b;
};

describe('renderCard', () => {
  it('renders the starting card', () => {
    const el = render(view());
    const t = text(el);
    expect(t).toContain('The Sixteen, delivered ready-built');
    expect(t).toContain('Delivery: tilt trailer');
    expect(t).toContain('Base: gravel pad');
    expect(t).toContain('Delivery and site prep: $4,500 – $10,545');
    expect(t).toContain('Add your ZIP code to see delivery and local prices.');
    expect(t).toContain("Your pod's price comes from the configurator. This is what goes on top of it.");
    expect(t).toContain('Ready to ship about 5–6 weeks after we receive payment');
    const img = el.querySelector('img');
    expect(img?.getAttribute('src')).toBe('assets/models/sixteen.jpg');
    expect(img?.getAttribute('alt')).toBe('The Sixteen');
  });

  it('shows the change line', () => {
    const v = view({ truckAccess: 'no' }, null, undefined, { what: 'truck + shed mule delivery', why: 'a truck cannot reach' });
    const t = text(render(v));
    expect(t).toContain('Changed: truck + shed mule delivery. Why: a truck cannot reach');
  });

  it('shows no change line when there is no change', () => {
    expect(text(render(view()))).not.toContain('Changed:');
  });

  it('shows the change line in the phone bar too', () => {
    const v = view({ truckAccess: 'no' }, null, undefined, { what: 'truck + shed mule delivery', why: 'a truck cannot reach' });
    const bar = render(v).querySelector('.mo-card__bar')!;
    expect(text(bar)).toContain('Changed: truck + shed mule delivery. Why: a truck cannot reach');
    expect(render(view()).querySelector('.mo-card__bar .mo-card__bar-change')).toBeNull();
  });

  it('talk mode hides the range', () => {
    const el = render(view({ truckAccess: 'no', overhead: 'other', powerLines: 'yes', kitAccess: 'no' }));
    const t = text(el);
    expect(t).toContain("We'll work this out with you");
    expect(t).not.toContain('Delivery and site prep');
    expect(t).toContain("The Sixteen: let's work out the best way in");
    expect(button(el, 'Design my pod')).toBeTruthy();
    expect(button(el, "Let's talk")).toBeTruthy();
  });

  it('buttons dispatch minio:cta', () => {
    const el = render(view());
    const seen: string[] = [];
    document.body.addEventListener('minio:cta', e => seen.push((e as CustomEvent<string>).detail));
    button(el, 'Design my pod').click();
    button(el, "Let's talk").click();
    expect(seen).toEqual(['design', 'talk']);
  });

  it('switch model button appears with the twelve shower note', () => {
    const v = view({ bathroom: 'shower' }, null, 'twelve');
    const el = render(v);
    expect(text(el)).toContain('The Twelve fits a half bath only');
    let detail: string | null = null;
    el.addEventListener('minio:switch-model', e => { detail = (e as CustomEvent<string>).detail; });
    button(el, 'Switch to the Sixteen').click();
    expect(detail).toBe('sixteen');
  });

  it('has no switch button without the twelve shower note', () => {
    const el = render(view({ bathroom: 'half' }, null, 'twelve'));
    expect(Array.from(el.querySelectorAll('button')).some(b => b.textContent === 'Switch to the Sixteen')).toBe(false);
  });

  it('clearance note links back to the yard planner', () => {
    const crowded: PlannerSnapshot = { ...snapshot, podX: 8.5 }; // 0.5 ft from the yard edge
    const el = render(view({}, null, undefined, null, crowded));
    expect(text(el)).toContain('Leave about 3 ft clear around the pod for installation and service');
    let fired = false;
    el.addEventListener('minio:edit-yard', () => { fired = true; });
    const link = Array.from(el.querySelectorAll('a, button')).find(x => x.textContent === 'Adjust in the yard planner') as HTMLElement | undefined;
    if (!link) throw new Error('no yard link');
    link.click();
    expect(fired).toBe(true);
  });

  it('lists to-checks and notes', () => {
    const el = render(view({ truckAccess: 'unsure' }));
    const heading = Array.from(el.querySelectorAll('h3, h4')).find(h => h.textContent === 'To check');
    expect(heading).toBeTruthy();
    const items = el.querySelectorAll('.mo-card__tocheck li');
    expect(items).toHaveLength(1);
    expect(items[0].textContent).toBe(toCheckText('truckAccess'));
    expect(text(el)).toContain('Some homes need a panel upgrade (about $2,500)');
  });

  it('shows no To check heading when there is nothing to check', () => {
    const el = render(view());
    expect(text(el)).not.toContain('To check');
  });

  it('shows side items beside the range', () => {
    const crane = text(render(view({ truckAccess: 'no', pathWidth: 'narrow', powerLines: 'no', streetDistance: '100to150' })));
    expect(crane).toContain('+ crane, from $4,000');
    const raised = text(render(view({ existingBase: 'none', groundFlat: 'steep' }, loc('98101'))));
    expect(raised).toContain('+ raised base, from $14,025, priced in person');
    const ak = text(render(view({}, loc('99501'))));
    expect(ak).toContain('+ shipping, quoted separately');
  });

  it('lists the breakdown and marks reference lines', () => {
    const el = render(view());
    const details = el.querySelector('details');
    expect(details).toBeTruthy();
    const rows = Array.from(details!.querySelectorAll('li')).map(li => text(li));
    expect(rows.some(r => r.startsWith('Power') && r.includes('(reference)'))).toBe(true);
    expect(rows.some(r => r.startsWith('Base') && r.includes('(reference)'))).toBe(true);
    const priced = Array.from(render(view({}, loc('98101'))).querySelectorAll('details li')).map(li => text(li));
    expect(priced.find(r => r.startsWith('Shipping'))).toContain('$1,100');
    expect(priced.find(r => r.startsWith('Base'))).not.toContain('(reference)');
  });

  it('shows the coverage label for the location', () => {
    expect(text(render(view({}, loc('98101'))))).toContain('Mini·O arranges local contractors in your area.');
  });

  it('links the contractor specs outside install areas', () => {
    const outside = loc('59001'); // Montana: not an install area
    expect(outside.inCoverage).toBe(false);
    const el = render(view({}, outside));
    const hrefs = Array.from(el.querySelectorAll('a')).map(a => a.getAttribute('href'));
    expect(hrefs).toContain('contractor/base.html?model=sixteen');
    expect(hrefs).toContain('contractor/power.html?model=sixteen&door=standard');
    expect(text(el)).toContain("We don't arrange contractors in your area yet. These prices are a reference for your own contractor.");
  });

  it('power link uses the standard door for a Station whose client asked for a flipped door', () => {
    const station = { ...snapshot, model: 'station' as const };
    const el = render(view({ door: 'flipped' }, loc('59001'), undefined, null, station));
    expect(el.querySelector('a[href="contractor/power.html?model=station&door=standard"]')).toBeTruthy();
    expect(el.querySelector('a[href*="door=flipped"]')).toBeNull();
  });

  it('links the contractor specs for a gravel pad even inside an install area', () => {
    const el = render(view({}, loc('98101')));
    expect(el.querySelector('a[href="contractor/base.html?model=sixteen"]')).toBeTruthy();
  });

  it('omits the contractor links for a raised base inside an install area', () => {
    const el = render(view({ existingBase: 'none', groundFlat: 'steep' }, loc('98101')));
    expect(el.querySelectorAll('a[href^="contractor/"]')).toHaveLength(0);
  });

  it('collapses on small screens with an aria-expanded toggle', () => {
    const el = render(view());
    const toggles: unknown[] = [];
    el.addEventListener('minio:card-toggle', (e) => toggles.push((e as CustomEvent).detail));
    const toggle = el.querySelector('button[aria-expanded]') as HTMLButtonElement;
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    toggle.click();
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(el.dataset.open).toBe('true');
    expect(toggles).toEqual([true]);
    toggle.click();
    expect(toggles).toEqual([true, false]);
  });

  it('takes the open state from the view, not from the last render', () => {
    const el = render(view(undefined, null, undefined, null, snapshot, true));
    expect(el.dataset.open).toBe('true');
    expect(text(el.querySelector('.mo-card__toggle')!)).toContain('Hide details');
    renderCard(el, view());
    expect(el.dataset.open).toBe('false');
    expect((el.querySelector('button[aria-expanded]') as HTMLButtonElement).getAttribute('aria-expanded')).toBe('false');
  });

  it('escapes text instead of injecting markup', () => {
    const v = view({}, null, undefined, { what: '<img src=x onerror=alert(1)>', why: '<b>x</b>' });
    const el = render(v);
    expect(el.querySelector('img[onerror]')).toBeNull();
    expect(el.querySelector('b')).toBeNull();
  });
});

describe('describeChange', () => {
  const a = recommend(snapshot, {});
  it('returns null with no previous recommendation', () => {
    expect(describeChange(null, a)).toBeNull();
  });
  it('returns null when method and base are unchanged', () => {
    expect(describeChange(a, recommend(snapshot, { truckAccess: 'unsure' }))).toBeNull();
  });
  it('names a new method', () => {
    const next = recommend(snapshot, { truckAccess: 'no', pathWidth: 'narrow', powerLines: 'no' });
    expect(next.method).toBe('crane');
    const c = describeChange(a, next);
    expect(c?.what).toBe('crane delivery');
    expect(c?.why).toBe(reasonText('pathNarrow'));
  });
  it('names a new base', () => {
    const next = recommend(snapshot, { existingBase: 'none', groundFlat: 'steep' });
    const c = describeChange(a, next);
    expect(c?.what).toBe('a raised base');
    expect(c?.why).toBe(reasonText('steepGround'));
  });
  it('names both when method and base change together', () => {
    const next = recommend(snapshot, { truckAccess: 'no', existingBase: 'slab' });
    const c = describeChange(a, next);
    expect(c?.what).toBe('truck + shed mule delivery and your existing base');
  });
  it('explains a return to the starting option', () => {
    const mule = recommend(snapshot, { truckAccess: 'no' });
    const c = describeChange(mule, a);
    expect(c?.what).toBe('tilt trailer delivery');
    expect(c?.why.length).toBeGreaterThan(0);
  });
});

describe('copy', () => {
  it('formats money', () => {
    expect(formatMoney(7600)).toBe('$7,600');
    expect(formatMoney(0)).toBe('$0');
    expect(formatMoney(1234567)).toBe('$1,234,567');
    expect(() => formatMoney(NaN)).toThrow();
  });

  it('writes method titles', () => {
    expect(methodTitle('sixteen', 'tiltTrailer')).toBe('The Sixteen, delivered ready-built');
    expect(methodTitle('twelve', 'shedMule')).toBe('The Twelve, delivered ready-built');
    expect(methodTitle('station', 'crane')).toBe('The Station, lifted in by crane');
    expect(methodTitle('sixteen', 'kit')).toBe('The Sixteen as a kit, assembled on site');
    expect(methodTitle('sixteen', 'talk')).toBe("The Sixteen: let's work out the best way in");
  });

  it('writes pill text', () => {
    const r = (o: Partial<Recommendation>): Recommendation => ({ ...recommend(snapshot, {}), ...o });
    expect(pillText(r({ method: 'shedMule' }))).toEqual({ delivery: 'truck + shed mule', base: 'gravel pad' });
    expect(pillText(r({ method: 'crane', base: 'existing' }))).toEqual({ delivery: 'crane', base: 'your existing base' });
    expect(pillText(r({ method: 'kit', base: 'raised' }))).toEqual({ delivery: 'kit', base: 'raised base, priced in person' });
    expect(pillText(r({ method: 'talk' })).delivery).toBe("let's talk");
  });

  it('writes the cost line', () => {
    expect(costLineText({ mode: 'talk' })).toBe("We'll work this out with you");
    const base = { mode: 'range' as const, lines: [], side: [], locationKnown: true };
    expect(costLineText({ ...base, low: 4500, high: 10545, andUp: false })).toBe('Delivery and site prep: $4,500 – $10,545');
    expect(costLineText({ ...base, low: 3000, high: 3000, andUp: false })).toBe('Delivery and site prep: $3,000');
    expect(costLineText({ ...base, low: 4500, high: 10545, andUp: true })).toBe('Delivery and site prep: $4,500 – $10,545+');
    expect(costLineText({ ...base, low: 3000, high: 3000, andUp: true })).toBe('Delivery and site prep: $3,000+');
  });

  it('writes lead times without dates', () => {
    expect(leadTimeText({ minWeeks: 5, maxWeeks: 5 })).toBe('Ready to ship about 5 weeks after we receive payment');
    expect(leadTimeText({ minWeeks: 5, maxWeeks: 6 })).toBe('Ready to ship about 5–6 weeks after we receive payment');
  });

  it('writes the coverage label', () => {
    expect(coverageText(null)).toBe('Add your ZIP code to see delivery and local prices.');
    expect(coverageText(loc('98101'))).toBe('Mini·O arranges local contractors in your area.');
    expect(coverageText({ ...loc('98101'), inCoverage: false }))
      .toBe("We don't arrange contractors in your area yet. These prices are a reference for your own contractor.");
  });

  it('has text for every note, to-check and reason code', () => {
    const r = recommend(snapshot, {});
    for (const n of ['softGround', 'panelUpgrade', 'twelveHalfBathOnly', 'flipNotAvailable', 'kitUnloading', 'clearance'] as const) {
      expect(noteText(n, { ...r, model: 'station' }).length).toBeGreaterThan(0);
    }
    for (const c of ['zip', 'truckAccess', 'pathWidth', 'overhead', 'pathGround', 'powerLines', 'streetDistance',
      'kitAccess', 'existingBase', 'groundFlat', 'bathroom', 'waterDistance', 'panelDistance', 'door',
      'baseSlab', 'baseGravel', 'baseDeck'] as const) {
      expect(toCheckText(c).length).toBeGreaterThan(0);
    }
    for (const c of ['truckNo', 'pathNarrow', 'overheadLow', 'pathSteps', 'powerLines', 'tooFar', 'noKitAccess',
      'existingBase', 'steepGround'] as const) {
      expect(reasonText(c).length).toBeGreaterThan(0);
    }
  });

  it('never writes a date', () => {
    const all = [
      leadTimeText({ minWeeks: 5, maxWeeks: 6 }),
      reasonText('truckNo'), reasonText('noKitAccess'), toCheckText('kitAccess'),
      noteText('kitUnloading', recommend(snapshot, {})),
    ].join(' ');
    expect(all).not.toMatch(/\b(20\d\d|January|February|March|April|May|June|July|August|September|October|November|December)\b/);
  });
});
