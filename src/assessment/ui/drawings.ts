// One drawing per question (spec 7), plus the electrical panel (spec 5.1). Static, trusted SVG
// strings: illustrative, not to scale. Red marks what the question is about, and each numbered
// callout (data-callout="n") points at what step n of the how-to-measure section asks for.
import { KIT_ACCESS_FT, MODELS, MULE_MAX_SLOPE_DEG, MULE_MAX_STEP_FT, MULE_TURN_FT } from '../core/data';
import type { ModelId, QuestionId } from '../core/types';

const RED = '#ED3648';
const RED_LT = '#FDE7E9'; // a light tint of the red, for fixtures in the bathroom plans
const INK = '#535266';
const INK_LT = '#DDDCE3'; // a light tint of the dark blue, for paving, glass and streets
const SAND = '#E3CDBF';
const SAND_LT = '#F5EBE4'; // a light tint of the sand, for walls, yards and fences
const WHITE = '#FFFFFF';
const METAL = '#EEEDF2'; // the panel box
const GY = 160; // the ground line in side views
const DASH = ' stroke-dasharray="6 5"';

function svg(label: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 340 200" role="img" aria-label="${label}" `
    + 'font-family="system-ui, -apple-system, Segoe UI, Roboto, sans-serif" stroke-linecap="round" stroke-linejoin="round">'
    + `${body}</svg>`;
}

const line = (d: string, stroke = INK, width = 2, extra = ''): string =>
  `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${width}"${extra}/>`;
const shape = (d: string, fill: string, stroke = INK, width = 2): string =>
  `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
const box = (x: number, y: number, w: number, h: number, fill: string, stroke = INK, width = 2, rx = 0): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;

interface TextOpts { anchor?: 'start' | 'middle' | 'end'; size?: number; bold?: boolean; color?: string; rotate?: number }

/** A label with a white halo, so it stays readable over lines and fills. */
function label(x: number, y: number, s: string, o: TextOpts = {}): string {
  const turn = o.rotate ? ` transform="rotate(${o.rotate} ${x} ${y})"` : '';
  return `<text x="${x}" y="${y}"${turn} text-anchor="${o.anchor ?? 'middle'}" font-size="${o.size ?? 14}" `
    + `font-weight="${o.bold ? 700 : 500}" fill="${o.color ?? INK}" stroke="${WHITE}" stroke-width="4" paint-order="stroke">${s}</text>`;
}

/** A numbered red circle: step n of the how-to-measure section. */
function callout(n: number, x: number, y: number): string {
  return `<g data-callout="${n}"><circle cx="${x}" cy="${y}" r="11" fill="${RED}" stroke="${WHITE}" stroke-width="2"/>`
    + `<text x="${x}" y="${y + 4.5}" text-anchor="middle" font-size="13" font-weight="700" fill="${WHITE}">${n}</text></g>`;
}

/** A filled arrowhead with its tip at (x, y), pointing at angle degrees (0 = right, 90 = down). */
const arrowHead = (x: number, y: number, angle: number, color = RED): string =>
  `<path d="M0 0L-10 -5V5z" transform="translate(${x} ${y}) rotate(${angle})" fill="${color}"/>`;

/** A dimension line from x1 to x2 at height y, with end ticks and arrowheads. */
const dimH = (x1: number, x2: number, y: number, color = RED): string =>
  line(`M${x1} ${y}H${x2}M${x1} ${y - 7}V${y + 7}M${x2} ${y - 7}V${y + 7}`, color, 2)
  + arrowHead(x1, y, 180, color) + arrowHead(x2, y, 0, color);

/** A dimension line from y1 down to y2 at x. */
const dimV = (x: number, y1: number, y2: number, color = RED): string =>
  line(`M${x} ${y1}V${y2}M${x - 7} ${y1}H${x + 7}M${x - 7} ${y2}H${x + 7}`, color, 2)
  + arrowHead(x, y1, -90, color) + arrowHead(x, y2, 90, color);

// ---- Side-view pieces ----

function ground(gy = GY): string {
  return box(0, gy, 340, 200 - gy, SAND, 'none', 0) + line(`M0 ${gy}H340`);
}

/** A house in side view: wall from x to x + w, a pitched roof up to apex. */
function house(x: number, w: number, wallTop: number, apex: number, gy = GY): string {
  return shape(`M${x - 8} ${wallTop}L${x + w / 2} ${apex}L${x + w + 8} ${wallTop}z`, SAND)
    + box(x, wallTop, w, gy - wallTop, SAND_LT)
    + box(x + 14, gy - 38, 20, 38, WHITE, INK, 1.5)
    + box(x + 44, wallTop + 14, 22, 18, INK_LT, INK, 1.5);
}

/** The pod in side view: a flat-roofed box with a glass door, on skids. */
function pod(x: number, w: number, h: number, gy = GY): string {
  const top = gy - h;
  return box(x, top + 5, w, h - 9, WHITE)
    + box(x - 4, top, w + 8, 7, INK, INK, 1, 1)
    + box(x + 10, top + 16, w - 52, (h - 24) / 2, INK_LT, INK, 1.5)
    + box(x + w - 30, top + 16, 20, h - 24, INK_LT, INK, 1.5)
    + line(`M${x + 6} ${gy - 2}H${x + w - 6}`, INK, 4);
}

/** A person standing, feet on the ground at x. */
const person = (x: number, gy = GY): string =>
  `<circle cx="${x}" cy="${gy - 38}" r="6" fill="${INK}"/>`
  + line(`M${x} ${gy - 31}V${gy - 14}M${x} ${gy - 14}L${x - 6} ${gy}M${x} ${gy - 14}L${x + 6} ${gy}`
    + `M${x} ${gy - 27}L${x - 7} ${gy - 18}M${x} ${gy - 27}L${x + 7} ${gy - 18}`, INK, 2.5);

/** A run of fence in side view, pickets and two rails. */
function fencePanel(x1: number, x2: number, top: number, color = INK, gy = GY): string {
  let pickets = '';
  for (let x = x1 + 5; x < x2 - 2; x += 8) pickets += `M${x} ${top}V${gy}`;
  return box(x1, top, x2 - x1, gy - top, SAND_LT, 'none', 0)
    + line(pickets, color, 1.5) + line(`M${x1} ${top + 12}H${x2}M${x1} ${gy - 12}H${x2}`, color, 2);
}
const post = (x: number, top: number, gy = GY): string => box(x - 3, top - 4, 6, gy - top + 4, INK, INK, 1, 1);

/** Grass tufts along the ground from x1 to x2. */
function grass(x1: number, x2: number, gy = GY): string {
  let d = '';
  for (let x = x1 + 3; x < x2 - 4; x += 9) d += `M${x} ${gy}l2 -6l2 6`;
  return line(d, INK, 1.5);
}

// ---- Top-view pieces ----

const yard = (): string => box(0, 0, 340, 200, SAND_LT, 'none', 0);

/** A street along the bottom edge, from y down. */
const streetBottom = (y: number): string =>
  box(0, y, 340, 200 - y, INK_LT, 'none', 0) + line(`M0 ${y}H340`) + label(304, y + 20, 'Street');

/** Where the pod goes, from above: a dashed red outline, labelled at labelY (the middle by default). */
const podTop = (x: number, y: number, w: number, h: number, labelY = y + h / 2 + 5): string =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${WHITE}" stroke="${RED}" stroke-width="2.5"${DASH}/>`
  + label(x + w / 2, labelY, 'Pod', { bold: true });

/** A fence seen from above: a line with posts. */
function fenceTop(d: string, posts: [number, number][]): string {
  return line(d, INK, 2) + posts.map(([x, y]) => box(x - 3, y - 3, 6, 6, INK, INK, 1)).join('');
}

// ---- Bathroom fixtures, from above ----

const toilet = (x: number, y: number, c: string, fill: string): string =>
  box(x, y, 30, 11, fill, c, 2, 2) + `<ellipse cx="${x + 15}" cy="${y + 27}" rx="11" ry="14" fill="${fill}" stroke="${c}" stroke-width="2"/>`;
const sink = (x: number, y: number, c: string, fill: string): string =>
  box(x, y, 46, 26, fill, c, 2, 3) + `<ellipse cx="${x + 23}" cy="${y + 14}" rx="15" ry="7" fill="${WHITE}" stroke="${c}" stroke-width="1.5"/>`;
const shower = (x: number, y: number, s: number, c: string, fill: string): string =>
  box(x, y, s, s, fill, c, 2, 2) + line(`M${x} ${y}L${x + s} ${y + s}M${x + s} ${y}L${x} ${y + s}`, c, 1)
  + `<circle cx="${x + s / 2}" cy="${y + s / 2}" r="4" fill="${WHITE}" stroke="${c}" stroke-width="1.5"/>`;

/** A small room from above: thick walls, a door gap in the bottom wall at doorX. */
function room(x: number, y: number, w: number, h: number, doorX: number): string {
  return box(x, y, w, h, WHITE, INK, 4, 2)
    + line(`M${doorX} ${y + h}h34`, WHITE, 6)
    + line(`M${doorX} ${y + h}v-34a34 34 0 0 1 34 34`, INK, 1.5);
}

// ---- The drawings ----

const DRAWINGS: Record<QuestionId, (model: ModelId) => string> = {
  zip: () => svg('A house and the spot for the pod, with a pin on the spot and the ZIP code on its address marked',
    ground() + house(20, 104, 96, 56) + pod(150, 76, 48)
    + shape('M188 106C188 106 172 88 172 76a16 16 0 0 1 32 0c0 12-16 30-16 30z', RED, RED, 1)
    + `<circle cx="188" cy="76" r="6" fill="${WHITE}"/>`
    + line('M236 66C222 66 214 70 206 74', INK, 1.5, ' stroke-dasharray="4 4"')
    + box(236, 28, 94, 80, WHITE, INK, 2, 8) + label(248, 48, 'Address', { anchor: 'start', size: 13, bold: true })
    + box(248, 56, 66, 6, INK_LT, 'none', 0, 3) + box(248, 67, 48, 6, INK_LT, 'none', 0, 3)
    + box(246, 80, 46, 18, RED_LT, RED, 2, 4) + label(269, 93, 'ZIP', { size: 13, bold: true, color: RED })
    + callout(1, 312, 89)),

  bathroom: () => svg('Two bathroom plans from above: a half bath with a toilet and a sink, and a bath that adds a shower stall',
    label(87, 17, 'Half bath', { bold: true }) + label(253, 17, 'Bath with shower', { bold: true })
    + room(14, 26, 146, 142, 64) + toilet(28, 32, RED, RED_LT) + sink(100, 32, RED, RED_LT)
    + room(180, 26, 146, 142, 206) + toilet(194, 32, INK, WHITE) + sink(266, 32, INK, WHITE)
    + shower(264, 104, 58, RED, RED_LT) + label(293, 98, 'shower', { size: 13, color: RED })
    + callout(1, 56, 70) + callout(2, 276, 116)),

  truckAccess: () => svg('A yard from above: a truck on the street, a driveway beside the house with a gate across it, and the route to the spot for the pod',
    yard() + streetBottom(166)
    + box(24, 66, 112, 84, SAND, INK, 2, 2) + label(80, 113, 'House')
    + box(146, 66, 54, 100, INK_LT, 'none', 0) + line('M146 66V166M200 66V166', INK, 1.5)
    + fenceTop('M8 60H146M200 60H332', [[8, 60], [40, 60], [72, 60], [104, 60], [232, 60], [264, 60], [296, 60], [328, 60]])
    + line('M148 60H171M175 60H198', INK, 4) + `<circle cx="147" cy="60" r="3" fill="${INK}"/><circle cx="199" cy="60" r="3" fill="${INK}"/>`
    + label(206, 78, 'gate', { anchor: 'start', size: 13 })
    + podTop(214, 10, 96, 40)
    + box(56, 172, 82, 22, WHITE, INK, 2, 3) + box(30, 173, 26, 20, INK, INK, 2, 4)
    + line('M140 183C166 183 173 176 173 156V72C173 46 186 30 206 30', RED, 3, ' stroke-dasharray="7 6"')
    + arrowHead(212, 30, 0)
    + callout(1, 294, 30) + callout(2, 186, 120) + callout(3, 128, 44)),

  pathWidth: (model) => svg('A side path from above, between the house and a fence, with the narrowest width marked',
    yard() + streetBottom(166)
    + box(16, 52, 126, 104, SAND, INK, 2, 2) + label(79, 108, 'House')
    + fenceTop('M226 48V166', [[226, 52], [226, 84], [226, 116], [226, 148]]) + label(234, 140, 'Fence', { anchor: 'start', size: 13 })
    + podTop(150, 8, 110, 34)
    + line('M160 162V58', INK, 2, DASH) + arrowHead(160, 52, -90, INK)
    + dimH(144, 224, 104) + label(190, 95, `${MODELS[model].minPathWidth} ft`, { bold: true, size: 14, color: RED })
    + callout(1, 204, 140) + callout(2, 242, 104) + callout(3, 190, 70)),

  turn: (model) => svg('A way in from above that turns a corner behind the house, with the room to turn marked',
    yard() + streetBottom(172)
    + fenceTop('M8 8V172', [[8, 20], [8, 60], [8, 100], [8, 140]])
    + box(122, 100, 150, 64, SAND, INK, 2, 2) + label(197, 137, 'House')
    + podTop(268, 26, 62, 52)
    + `<circle cx="66" cy="62" r="52" fill="${RED_LT}" stroke="${RED}" stroke-width="2"${DASH}/>`
    + line('M90 170V110C90 96 100 86 118 86H262', INK, 2, DASH) + arrowHead(266, 86, 0, INK)
    + dimH(14, 118, 62) + label(66, 53, `${MULE_TURN_FT[model]} ft`, { bold: true, size: 14, color: RED })
    + label(126, 34, 'room to turn', { anchor: 'start', size: 13, bold: true, color: RED })
    + callout(1, 110, 108) + callout(2, 36, 62) + callout(3, 66, 30)),

  removable: () => svg('A fence beside a narrow gate, with one fence section taken down and set aside, to go back up after',
    ground()
    + box(0, 44, 64, 116, SAND_LT) + line('M0 44H72', INK, 4) + label(32, 100, 'House')
    + fencePanel(80, 118, 96) + fencePanel(214, 250, 96)
    + `<rect x="150" y="96" width="64" height="64" fill="none" stroke="${RED}" stroke-width="2"${DASH}/>`
    + post(80, 96) + post(118, 96) + post(150, 96) + post(214, 96) + post(250, 96)
    + dimH(124, 144, 138, INK) + label(134, 88, 'narrow', { size: 13 })
    + `<g transform="rotate(-8 296 160)">${fencePanel(268, 324, 100, RED)}${box(268, 100, 56, 60, 'none', RED, 2)}</g>`
    + line('M184 90C198 44 268 42 290 84', RED, 2.5) + arrowHead(184, 92, 105) + arrowHead(291, 88, 70)
    + label(238, 36, 'take down, put back', { size: 13, bold: true, color: RED })
    + callout(1, 134, 66) + callout(2, 99, 128) + callout(3, 318, 50)),

  overhead: (model) => svg('A person on the way in looking up at an overhanging branch, with the height under it marked',
    ground()
    + box(0, 66, 70, 94, SAND_LT) + shape('M0 36H64L100 66H0z', SAND)
    + box(282, 96, 12, 64, SAND) + `<circle cx="288" cy="62" r="40" fill="${SAND_LT}" stroke="${INK}" stroke-width="2"/>`
    + line('M262 80C240 84 214 86 198 92', INK, 4)
    + `<circle cx="214" cy="84" r="7" fill="${SAND_LT}" stroke="${INK}" stroke-width="1.5"/><circle cx="236" cy="80" r="7" fill="${SAND_LT}" stroke="${INK}" stroke-width="1.5"/>`
    + person(140) + line('M145 118L192 96', INK, 1.5, ' stroke-dasharray="4 4"')
    + dimV(198, 96, 160) + label(188, 134, `${MODELS[model].minOverhead} ft`, { anchor: 'end', bold: true, size: 14, color: RED })
    + label(104, 62, 'roof edge', { anchor: 'start', size: 13 }) + label(230, 108, 'branch', { anchor: 'start', size: 13 })
    + callout(1, 118, 110) + callout(2, 214, 64) + callout(3, 214, 140)),

  pathGround: () => svg('The way in from the side: paving, lawn, a short step and a slope with a phone on it, with the step height and the slope marked',
    shape('M0 140H150V108H178L292 70H340V200H0z', SAND, 'none', 0) + line('M0 140H150V108H178L292 70H340')
    + box(0, 140, 60, 7, INK_LT, INK, 1.5) + grass(60, 150, 140)
    + person(28, 140) + line('M50 50H300', INK, 2, DASH) + arrowHead(308, 50, 0, INK)
    + dimV(138, 108, 140) + label(158, 96, `under ${MULE_MAX_STEP_FT} ft`, { bold: true, size: 14, color: RED })
    + line('M178 108H262', INK, 1.5, ' stroke-dasharray="4 4"') + line('M222 108A44 44 0 0 0 219.7 94.1', RED, 2.5)
    + label(268, 128, `under ${MULE_MAX_SLOPE_DEG}°`, { bold: true, size: 14, color: RED })
    + `<g transform="rotate(-18.4 246 82)">${box(228, 75, 36, 8, INK, INK, 1, 2)}${box(232, 77, 28, 4, WHITE, 'none', 0, 1)}</g>`
    + label(30, 172, 'paving', { size: 13 }) + label(105, 172, 'lawn', { size: 13 }) + label(164, 172, 'step', { size: 13 })
    + label(240, 172, 'slope', { size: 13 })
    + callout(1, 28, 50) + callout(2, 82, 124) + callout(3, 100, 92) + callout(4, 258, 56)),

  powerLines: () => svg('A crane truck on the street, power lines running over the house and yard, and the pod behind',
    ground() + box(0, 160, 112, 10, INK_LT, 'none', 0) + line('M0 160H340') + label(40, 188, 'Street', { size: 13 })
    + line('M30 130L88 84', INK, 5) + line('M88 84V104', INK, 1.5)
    + box(8, 130, 60, 20, WHITE, INK, 2, 2) + box(68, 124, 24, 26, INK_LT, INK, 2, 3)
    + `<circle cx="24" cy="152" r="7" fill="${INK}"/><circle cx="78" cy="152" r="7" fill="${INK}"/>`
    + person(104) + line('M108 118L150 66', INK, 1.5, ' stroke-dasharray="4 4"')
    + house(126, 88, 100, 72) + pod(254, 76, 50)
    + line('M240 34V160', INK, 4) + line('M226 34H254', INK, 3)
    + line('M0 44Q117 70 226 34M0 52Q117 80 254 34M226 34Q290 52 340 46M254 34Q300 60 340 54', RED, 2)
    + callout(1, 104, 98) + callout(2, 176, 30)),

  streetDistance: () => svg('A yard from above, with a straight line from the middle of the spot for the pod to the street',
    yard() + box(0, 0, 46, 200, INK_LT, 'none', 0) + line('M46 0V200') + line('M23 0V200', WHITE, 2, ' stroke-dasharray="10 8"')
    + label(28, 150, 'Street', { rotate: -90 })
    + box(70, 106, 120, 74, SAND, INK, 2, 2) + label(130, 148, 'House')
    + podTop(226, 24, 96, 80, 94) + `<circle cx="274" cy="60" r="4" fill="${RED}"/>`
    + dimH(48, 274, 60) + label(150, 51, 'how far?', { bold: true, size: 14, color: RED })
    + callout(1, 298, 78) + callout(2, 110, 78) + callout(3, 66, 36)),

  kitAccess: () => svg('A side gate standing open in a fence, with the width of the opening marked and flat kit pieces leaning nearby',
    ground()
    + box(0, 50, 56, 110, SAND_LT) + line('M0 50H62', INK, 4)
    + fencePanel(56, 126, 92) + fencePanel(194, 340, 92)
    + post(56, 92) + box(122, 86, 8, 74, INK, INK, 1, 1) + box(190, 86, 8, 74, INK, INK, 1, 1)
    + shape('M198 92L222 102V168L198 160z', SAND_LT, INK, 1.5) + line('M198 104L222 113M198 148L222 157', INK, 1.5)
    + `<g transform="rotate(-6 280 160)">${box(240, 82, 46, 78, SAND, INK, 2, 2)}${box(262, 88, 46, 72, SAND, INK, 2, 2)}</g>`
    + label(290, 184, 'kit pieces', { size: 13 }) + label(160, 184, 'gate', { size: 13 })
    + dimH(132, 188, 132) + label(160, 123, `${KIT_ACCESS_FT} ft`, { bold: true, size: 14, color: RED })
    + callout(1, 160, 70) + callout(2, 110, 132) + callout(3, 160, 148)),

  existingBase: (model) => {
    const m = MODELS[model];
    const h = Math.round((150 * m.d) / m.w); // the pod's outline, 150 wide, to its own proportions
    const top = 90 - h / 2;
    return svg(`A base from above with its length and width marked, and the outline of the ${m.name}, ${m.w} ft by ${m.d} ft, on it`,
      yard()
      + box(40, 20, 230, 140, INK_LT, INK, 2, 2) + line('M117 20V160M193 20V160M40 90H270', INK, 0.75)
      + `<rect x="80" y="${top}" width="150" height="${h}" rx="2" fill="${WHITE}" stroke="${RED}" stroke-width="2.5"${DASH}/>`
      + label(155, 90, m.name, { bold: true }) + label(155, 107, `${m.w} ft × ${m.d} ft`, { bold: true, color: RED })
      + dimH(40, 270, 178, INK) + label(155, 196, 'length', { size: 13 })
      + dimV(292, 20, 160, INK) + label(302, 94, 'width', { anchor: 'start', size: 13 })
      + callout(1, 58, 38) + callout(2, 100, 178) + callout(3, 230, top));
  },

  groundFlat: () => svg('A phone lying on the ground at the spot, and a close-up of its level app showing the slope',
    shape('M0 146L340 162V200H0z', SAND, 'none', 0) + line('M0 146L340 162')
    + `<g transform="rotate(2.7 102 150)">${box(80, 142, 44, 8, INK, INK, 1, 2)}${box(84, 144, 36, 4, WHITE, 'none', 0, 1)}</g>`
    + line('M126 140L212 120', INK, 1.5, ' stroke-dasharray="4 4"')
    + box(214, 12, 72, 132, WHITE, INK, 3, 10) + box(220, 26, 60, 104, SAND_LT, 'none', 0, 2)
    + label(250, 46, 'Level', { size: 13, bold: true })
    + box(226, 70, 48, 14, WHITE, INK, 1.5, 7) + line('M246 68V86M254 68V86', INK, 1)
    + `<circle cx="258" cy="77" r="5" fill="${RED}"/>`
    + label(100, 184, 'the spot', { size: 13 })
    + callout(1, 302, 42) + callout(2, 102, 120) + callout(3, 302, 77)),

  panelDistance: () => svg('A house with the electrical panel on its wall and a straight line from the panel to the pod',
    ground() + house(0, 120, 70, 36) + pod(246, 86, 56)
    + box(96, 92, 18, 26, RED, RED, 1.5, 2) + line('M100 100h10M100 106h10M100 112h10', WHITE, 1.5)
    + dimH(116, 244, 105) + label(180, 96, 'straight line', { bold: true, size: 14, color: RED })
    + callout(1, 82, 105) + callout(2, 180, 124) + callout(3, 180, 74)),

  panelRoute: () => svg('A cut through the ground from the house panel to the pod: the line runs under a lawn and under a driveway',
    ground(128)
    + shape('M-8 56L45 28L98 56z', SAND) + box(0, 56, 90, 72, SAND_LT)
    + box(68, 76, 16, 24, RED, RED, 1.5, 2) + line('M71 83h10M71 89h10M71 95h10', WHITE, 1.5)
    + grass(90, 104, 128) + grass(194, 248, 128)
    + box(104, 122, 90, 12, INK_LT, INK, 2, 1)
    + pod(252, 78, 50, 128)
    + line('M76 100V164H264V128', RED, 3)
    + line('M100 86H238', INK, 2, DASH) + arrowHead(246, 86, 0, INK)
    + label(146, 114, 'driveway', { size: 13 }) + label(230, 116, 'lawn', { size: 13 })
    + label(170, 184, 'power line', { size: 13, color: RED })
    + callout(1, 110, 70) + callout(2, 194, 108)),
};

export function drawing(id: QuestionId, model: ModelId): string {
  const draw = DRAWINGS[id];
  if (!draw) throw new Error(`drawing: no drawing for question "${id}"`);
  return draw(model);
}

/** The house's electrical panel, door open: the main breaker at the top, rows of breakers below (spec 5.1). */
export function panelDrawing(): string {
  let breakers = '';
  for (let y = 66; y <= 150; y += 14) {
    for (const x of [146, 180]) breakers += box(x, y, 26, 9, WHITE, INK, 1.5, 2) + line(`M${x + 9} ${y + 4.5}h8`, INK, 3);
  }
  return svg('An electrical panel with its door open: the main breaker at the top and rows of breakers below',
    shape('M124 18L70 34V170L124 184z', INK_LT, INK, 2) + line('M80 94V112', INK, 3)
    + box(124, 16, 104, 170, METAL, INK, 3, 4) + box(134, 26, 84, 150, WHITE, INK, 1.5, 2)
    + box(150, 34, 52, 22, RED, RED, 1.5, 3) + box(170, 40, 12, 10, WHITE, 'none', 0, 2)
    + breakers
    + line('M206 45H236', INK, 1.5) + label(240, 50, 'Main breaker', { anchor: 'start', size: 13, bold: true })
    + line('M210 112H236', INK, 1.5) + label(240, 117, 'Breakers', { anchor: 'start', size: 13, bold: true })
    + label(62, 104, 'Door', { anchor: 'end', size: 13 }));
}
