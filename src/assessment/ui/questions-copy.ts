// Client-facing wording for the 15 questions (spec 5). Plain English: clients have no
// construction knowledge. Help text uses only facts Ops has confirmed. Fred reviews every string.
import { KIT_ACCESS_FT, LEVEL_CUTOFF_TEXT, MODELS, MULE_MAX_SLOPE_DEG, MULE_MAX_STEP_FT } from '../core/data';
import type { ModelId, QuestionId } from '../core/types';


export interface QuestionCopy {
  title: string;
  options: { value: string; label: string }[];
  /** The one-paragraph intro to the how-to-measure section. */
  help: string;
  /** The numbered how-to-measure steps. Step n matches callout n in the drawing. */
  steps: string[];
  /** A contractor spec sheet linked from the how-to-measure section (spec 9). */
  specLink?: 'base' | 'power';
}

const NOT_SURE = { value: 'unsure', label: "I'm not sure" } as const;

const BAND_OPTIONS: QuestionCopy['options'] = [
  { value: 'lt25', label: 'Under 25 ft' },
  { value: '25to50', label: '25 to 50 ft' },
  { value: '50to100', label: '50 to 100 ft' },
  { value: 'gt100', label: 'More than 100 ft' },
  NOT_SURE,
];

/** Shown in the how-to-measure section of the panel question (spec 5.1). */
export const PANEL_EXPLAINER: { title: "What's an electrical panel?"; paragraphs: string[] } = {
  title: "What's an electrical panel?",
  paragraphs: [
    "The electrical panel is the metal box where your home's power comes in. Behind a small door are rows of switches, called breakers. The one at the top is the main breaker.",
    "It's usually in the garage, the basement or a utility room. Some homes have it outside, on a wall next to the electric meter.",
    "You don't need to know anything else about it. Your electrician checks the panel. If you can't find it, choose \"I'm not sure\" and we'll help you on the call.",
  ],
};

export function questionCopy(id: QuestionId, model: ModelId): QuestionCopy {
  const m = MODELS[model];
  // How much room the shed mule needs to turn a corner: 20 ft for the Twelve, 24 ft otherwise.
  const turnFt = model === 'twelve' ? 20 : 24;
  switch (id) {
    case 'zip':
      return {
        title: "What's the ZIP code where the pod is going?",
        options: [],
        help: "Your ZIP code lets us show delivery and local prices. If you're in Canada, use your postal code. You can skip this for now.",
        steps: ['Check the address of the spot where the pod is going and find its ZIP code.'],
      };

    case 'bathroom':
      return {
        title: 'Will the pod have a bathroom?',
        options: [
          { value: 'none', label: 'No bathroom' },
          { value: 'half', label: 'A half bath (toilet and sink)' },
          { value: 'shower', label: 'A bath with a shower' },
          NOT_SURE,
        ],
        help: 'A half bath has a toilet and a sink. The other choice adds a shower. A licensed plumber connects the pod to water and sewer.',
        steps: [
          'Look at the half bath in the drawing: a toilet and a sink.',
          'Look at the bath with a shower, which adds a shower stall.',
        ],
      };

    case 'truckAccess':
      return {
        title: 'Can a truck drive right up to the spot?',
        options: [
          { value: 'yes', label: 'Yes, up a driveway or across an open front yard' },
          { value: 'no', label: 'No' },
          NOT_SURE,
        ],
        help: 'Your pod usually arrives on a tilt trailer. The truck backs up to the spot and slides the pod off. So we need to know if a truck can get right to where the pod goes, like up a driveway or across an open front yard. If you pick "I\'m not sure", it goes on the list we check with you on the call.',
        steps: [
          'Stand at the spot where the pod will go.',
          'Look back toward the street along the way a truck would drive.',
          "Check for a gate, a fence or anything else a truck couldn't get past.",
        ],
      };

    case 'pathWidth':
      return {
        title: 'How wide is the narrowest point on the way to the spot?',
        options: [
          { value: 'wide', label: `${m.minPathWidth} ft or wider` },
          { value: 'narrow', label: `Narrower than ${m.minPathWidth} ft` },
          NOT_SURE,
        ],
        help: `Walk from the street to the spot and find the tightest place, like a gate or the gap between the house and a fence. Hold a tape measure across it and read the number. If the pod has to turn along the way, the small mover (a shed mule) needs a turning space about ${turnFt} ft across.`,
        steps: [
          'Walk from the street to the spot and find the tightest place, like a gate or a gap beside a fence.',
          'Hold a tape measure across that gap, from edge to edge.',
          'Read the number on the tape.',
        ],
      };

    case 'turn':
      return {
        title: 'Does the pod have to go around a tight corner on the way in?',
        options: [
          { value: 'none', label: "No, it's a straight way in" },
          { value: 'roomy', label: `A turn with plenty of room (about ${turnFt} ft across)` },
          { value: 'tight', label: 'A tight turn' },
          NOT_SURE,
        ],
        help: `The small mover (a shed mule) needs room to swing around a corner, about ${turnFt} ft across. Walk the way in and see if there is a corner like that.`,
        steps: [
          'Walk the way in from the street to the spot and look for any corner the pod would have to go around.',
          'Hold a tape measure across the open space at the corner, from one side to the other.',
          `Compare the number with about ${turnFt} ft.`,
        ],
      };

    case 'removable':
      return {
        title: 'Could everything that makes it narrow or tight come down and go back up?',
        options: [
          { value: 'fence', label: 'Yes, a fence section or gate' },
          { value: 'other', label: 'Yes, something else, like a planter or a small shed' },
          { value: 'no', label: 'No' },
          NOT_SURE,
        ],
        help: 'A fence section, a gate, a planter or a small shed can often come down for delivery and go back up after. If that is all that makes the way in narrow or tight, it may not be a problem.',
        steps: [
          'Look at the narrow spot or tight corner you just checked.',
          "Find what's causing it, like a fence, a gate, a planter or a small shed.",
          'Check whether it could be taken down and put back up, like a fence panel or a gate.',
        ],
      };

    case 'overhead':
      return {
        title: `Is anything lower than ${m.minOverhead} ft over the way to the spot, like branches, wires or a roof edge?`,
        options: [
          { value: 'clear', label: `Nothing lower than ${m.minOverhead} ft` },
          { value: 'branches', label: 'Only branches we can trim' },
          { value: 'other', label: 'Yes, something else (wires, a roof edge)' },
          NOT_SURE,
        ],
        help: `Look up as you walk from the street to the spot. Tree branches, wires and roof edges can all hang over the way in. Hold a tape measure up to the lowest one, or ask someone to help you read it. Branches can be trimmed, so tell us if that's all it is.`,
        steps: [
          'Walk from the street to the spot and look up.',
          'Find the lowest branch, wire or roof edge over the way in.',
          'Hold a tape measure up to it, or ask someone to help you read the height.',
        ],
      };

    case 'pathGround':
      return {
        title: "What's the way in like underfoot?",
        options: [
          { value: 'solid', label: `Solid, flat or a gentle slope (under about ${MULE_MAX_SLOPE_DEG}°)` },
          { value: 'soft', label: 'Soft ground, like a lawn' },
          { value: 'shortSteps', label: `A few short steps (under ${MULE_MAX_STEP_FT} ft)` },
          { value: 'steep', label: 'A steep slope or a staircase' },
          NOT_SURE,
        ],
        help: `Walk the way in and look at what is under your feet. The small mover (a shed mule) can handle a slope up to about ${MULE_MAX_SLOPE_DEG}° and a few short steps, with ramps. Soft ground, like a lawn after rain, can get marked, so stop watering about a week before delivery.`,
        steps: [
          "Walk the way in from the street to the spot and look at what's underfoot.",
          'Press your foot down on any lawn or dirt to feel if it is soft.',
          'Measure the height of any step with a tape measure.',
          `Lay your phone flat on any slope with a level app open and read the angle, to see if it is under ${MULE_MAX_SLOPE_DEG}°.`,
        ],
      };

    case 'powerLines':
      return {
        title: 'Are there power lines over the house or yard, between the street and the spot?',
        options: [
          { value: 'no', label: 'No, the way is clear' },
          { value: 'yes', label: 'Yes, there are power lines' },
          NOT_SURE,
        ],
        help: "A crane lifts the pod in from the street. The crane truck needs the street clear, and it can't work near power lines. Look up from the street toward the spot. Any lines over the house or yard in between count.",
        steps: [
          'Stand at the street and look toward the spot.',
          'Look up for any wires over the house or yard in between.',
        ],
      };

    case 'streetDistance':
      return {
        title: 'About how far is the spot from the street?',
        options: [
          { value: 'upTo100', label: 'Up to 100 ft' },
          { value: '100to150', label: '100 to 150 ft' },
          { value: 'over150', label: 'More than 150 ft' },
          NOT_SURE,
        ],
        help: 'The crane truck parks on the street and lifts the pod over to the spot, so the distance matters. Measure in a straight line from the street to the middle of the spot, with a long tape measure. A rough number is fine.',
        steps: [
          'Stand in the middle of the spot where the pod will go.',
          'Stretch a long tape measure in a straight line to the street.',
          'Read the number on the tape.',
        ],
      };

    case 'kitAccess':
      return {
        title: `Is there a way in at least ${KIT_ACCESS_FT} ft wide, like a side gate or a door?`,
        options: [
          { value: 'yes', label: `Yes, at least ${KIT_ACCESS_FT} ft wide` },
          { value: 'no', label: 'No' },
          NOT_SURE,
        ],
        help: `If the pod can't be brought in whole, it can come as a kit of pieces. The pieces fit through a regular door. Unloading takes about 3 people 2 hours. Measure the narrowest gate or door across the opening with a tape measure.`,
        steps: [
          'Find the narrowest gate or door between the street and the spot.',
          'Hold a tape measure across the opening, from edge to edge.',
          `Read the number and compare it with ${KIT_ACCESS_FT} ft.`,
        ],
      };

    case 'existingBase':
      return {
        title: 'Is there already a base where the pod goes?',
        options: [
          { value: 'slab', label: 'Yes, a concrete slab or patio' },
          { value: 'gravel', label: 'Yes, a gravel pad' },
          { value: 'deck', label: 'Yes, a wood deck' },
          { value: 'none', label: "No, it's grass or dirt" },
          NOT_SURE,
        ],
        help: `The pod sits on a base. If you already have a slab, patio, gravel pad or deck where it's going, tell us which. Measure it with a tape: it needs to be at least as big as the pod, and the ${m.name} is ${m.w} ft by ${m.d} ft.`,
        steps: [
          'Find the slab, patio, pad or deck where the pod would go.',
          'Measure its length and width with a tape measure.',
          `Compare it with the pod: ${m.w} ft by ${m.d} ft.`,
        ],
        specLink: 'base',
      };

    case 'groundFlat':
      return {
        title: 'Is the ground at the spot flat?',
        options: [
          { value: 'flat', label: `Flat, or a gentle slope (within ${LEVEL_CUTOFF_TEXT})` },
          { value: 'steep', label: 'Steeper than that' },
          NOT_SURE,
        ],
        help: `Open a level app on your phone and lay the phone flat on the ground where the pod goes. A gentle slope is fine, up to ${LEVEL_CUTOFF_TEXT}. If it's steeper than that, the pod needs a raised base, which is priced in person.`,
        steps: [
          'Open a level app on your phone.',
          'Lay the phone flat on the ground where the pod goes.',
          'Read the slope on the screen.',
        ],
        specLink: 'base',
      };

    case 'panelDistance':
      return {
        title: "How far is the house's electrical panel from the spot?",
        options: BAND_OPTIONS,
        help: "The electrical panel is the metal box with rows of switches. It's usually in the garage, the basement, or outside near the meter. Measure in a straight line from the panel to where the pod goes. A rough guess is fine.",
        steps: [
          'Find the electrical panel: a metal box with rows of switches.',
          'Stretch a tape measure in a straight line from the panel to where the pod goes.',
          'Read the number and pick the range it falls in.',
        ],
        specLink: 'power',
      };

    case 'panelRoute':
      return {
        title: "What's between the panel and the spot?",
        options: [
          { value: 'soft', label: 'Lawn or dirt' },
          { value: 'hard', label: 'A driveway, patio or path' },
          { value: 'both', label: 'Both' },
          NOT_SURE,
        ],
        help: 'Your electrician will bring power from the panel to the pod. Tell us what the ground is like along the way, so we know what to plan for. A rough idea is fine.',
        steps: [
          'Find the panel, then walk in a straight line from it to the spot.',
          'Notice if you cross lawn or dirt, a driveway, patio or path, or both.',
        ],
      };

    default: {
      const never: never = id;
      throw new Error(`questionCopy: unknown question "${String(never)}"`);
    }
  }
}
