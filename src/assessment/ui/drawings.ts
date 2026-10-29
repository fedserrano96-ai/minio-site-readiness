// Simple line drawings, one per question (spec 6.1). Static, trusted SVG strings: they are
// illustrative, not to scale. The red line is the thing the question is about.
import type { QuestionId } from '../core/types';

const RED = '#ED3648';

function svg(label: string, body: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 170" role="img" aria-label="${label}" `
    + 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'
    + `${body}</svg>`;
}

const GROUND = '<path d="M8 140H312"/>';
const red = (inner: string): string => `<g stroke="${RED}">${inner}</g>`;
const text = (x: number, y: number, s: string): string =>
  `<text x="${x}" y="${y}" fill="currentColor" stroke="none" font-size="13" text-anchor="middle" font-family="system-ui, sans-serif">${s}</text>`;

/** A small house, front view, its left edge at x. */
function house(x: number): string {
  return `<path d="M${x} 140V90L${x + 45} 55L${x + 90} 90V140"/><path d="M${x + 35} 140V112H${x + 55}V140"/>`;
}

/** The pod, side view, left edge at x and 60 wide. */
function pod(x: number, door = 'left'): string {
  const dx = door === 'left' ? x + 8 : door === 'middle' ? x + 24 : x + 40;
  return red(`<rect x="${x}" y="100" width="60" height="40"/><rect x="${dx}" y="108" width="14" height="32"/>`);
}

function arrowH(x1: number, x2: number, y: number): string {
  return `<path d="M${x1} ${y}H${x2}M${x1 + 8} ${y - 6}L${x1} ${y}L${x1 + 8} ${y + 6}M${x2 - 8} ${y - 6}L${x2} ${y}L${x2 - 8} ${y + 6}"/>`;
}

function arrowV(x: number, y1: number, y2: number): string {
  return `<path d="M${x} ${y1}V${y2}M${x - 6} ${y1 + 8}L${x} ${y1}L${x + 6} ${y1 + 8}M${x - 6} ${y2 - 8}L${x} ${y2}L${x + 6} ${y2 - 8}"/>`;
}

const tree = (x: number): string =>
  `<path d="M${x} 140V105"/><circle cx="${x}" cy="85" r="22"/>`;

const DRAWINGS: Record<QuestionId, string> = {
  zip: svg('A house with a map pin showing where the pod is going',
    `${GROUND}${house(40)}<path d="M200 60c0-14 10-24 22-24s22 10 22 24c0 16-22 40-22 40S200 76 200 60z"/><circle cx="222" cy="60" r="7"/>${pod(240)}`),

  truckAccess: svg('A truck backing up a driveway toward the spot where the pod goes',
    `${GROUND}<rect x="20" y="96" width="62" height="36"/><path d="M82 108h22l12 14v10H82z"/><circle cx="40" cy="138" r="8"/><circle cx="100" cy="138" r="8"/>`
    + `<path d="M130 120H196" stroke-dasharray="6 6"/>${pod(220)}${text(160, 100, 'driveway')}`),

  pathWidth: svg('A path between a house wall and a fence with an arrow marking its narrowest width',
    `${GROUND}<path d="M50 140V50L110 50V140"/><path d="M230 140V80M270 140V80M230 100H270M230 120H270"/>`
    + `${red(arrowH(116, 224, 112))}${text(170, 100, 'how wide?')}`),

  overhead: svg('A path under a tree branch and a wire, with an arrow marking the height to measure',
    `${GROUND}<path d="M40 36C110 48 200 48 290 36"/>${tree(70)}<path d="M92 80H130"/>`
    + `<path d="M250 140V100L280 82"/>${red(arrowV(180, 52, 140))}${text(226, 100, 'height?')}`),

  pathGround: svg('A path with steps, a steep part and a soft, muddy patch',
    `<path d="M8 140H70V124H100V108H130V92H160L210 140H312"/><path d="M230 148c12 8 24-8 36 0s24-8 36 0" stroke-dasharray="4 5"/>`
    + `${text(100, 80, 'steps')}${text(185, 80, 'steep')}${text(266, 128, 'soft')}`),

  powerLines: svg('Power lines running over a house and yard toward the spot for the pod',
    `${GROUND}${house(30)}<path d="M190 140V20M174 30H206"/><path d="M174 30C130 54 70 54 16 32M206 30C240 54 280 54 308 32"/>${pod(240, 'middle')}`),

  streetDistance: svg('The distance from the street to the spot where the pod goes',
    `<path d="M8 150H70M8 130H70" /><path d="M8 140H70" stroke-dasharray="8 8"/>${GROUND.replace('M8', 'M70')}`
    + `${red(arrowH(78, 224, 120))}${pod(240)}${text(150, 108, 'how far?')}${text(38, 118, 'street')}`),

  kitAccess: svg('A side gate with the flat pieces of a pod kit being carried through',
    `${GROUND}<path d="M60 140V60M140 140V60M60 60H140"/><path d="M60 80H140" stroke-dasharray="3 5"/>`
    + `${red(arrowH(66, 134, 120))}${text(100, 50, 'gate or door')}`
    + '<path d="M190 140V90H250V140z"/><path d="M200 140V100H260V140"/><path d="M210 140V110H270V140"/>'),

  existingBase: svg('Three kinds of base: a concrete slab, a gravel pad and a wood deck',
    `${GROUND}<path d="M20 140V124H100V140"/>${text(60, 112, 'slab')}`
    + '<path d="M120 140V124H200V140"/><path d="M135 132h2M155 134h2M175 131h2M190 135h2M145 129h2" stroke-width="3"/>'
    + `${text(160, 112, 'gravel')}<path d="M220 140V124H300V140M236 124V140M252 124V140M268 124V140M284 124V140"/>${text(260, 112, 'deck')}`),

  groundFlat: svg('A phone with a level app lying on sloping ground',
    `<path d="M8 120L312 120" stroke-dasharray="4 6"/><path d="M8 130C100 134 200 142 312 150"/>`
    + `<g transform="rotate(3 160 112)"><rect x="115" y="96" width="90" height="20" rx="4"/>${red('<circle cx="160" cy="106" r="5"/>')}</g>`
    + text(160, 70, 'is it flat?')),

  bathroom: svg('A plan view of a pod with a small bathroom in one corner',
    `<rect x="60" y="30" width="200" height="110"/>${red('<path d="M60 90H130V140"/><rect x="72" y="104" width="22" height="26" rx="8"/><circle cx="110" cy="112" r="8"/><rect x="72" y="40" width="40" height="40"/>')}`
    + `${text(205, 90, 'pod')}`),

  waterDistance: svg('A water and sewer pipe running from the house to the pod',
    `${GROUND}${house(30)}${pod(240)}<path d="M120 148H240" stroke-dasharray="6 5"/><path d="M120 156H240" stroke-dasharray="6 5"/>`
    + `${text(180, 130, 'water + sewer')}`),

  panelDistance: svg('An electrical panel on the house wall with a line running to the pod',
    `${GROUND}${house(30)}<rect x="104" y="90" width="22" height="30"/><path d="M110 98h10M110 106h10M110 114h10"/>`
    + `${pod(240)}<path d="M126 105C160 105 200 125 240 125" stroke-dasharray="6 5"/>${text(190, 98, 'power')}`),

  door: svg('Two pods side by side: one with a standard door and one with the door moved toward the middle',
    `${GROUND}${pod(40, 'left')}${pod(220, 'middle')}${text(70, 160, 'Standard')}${text(250, 160, 'Flipped')}`),
};

export function drawing(id: QuestionId): string {
  const svgText = DRAWINGS[id];
  if (!svgText) throw new Error(`drawing: no drawing for question "${id}"`);
  return svgText;
}
