// Client-facing wording for the 14 questions (spec 6.1). Plain English: clients have no
// construction knowledge. Help text uses only facts Ops has confirmed. Fred reviews every string.
import { FLIP_DOOR, KIT_ACCESS_FT, LEVEL_CUTOFF_TEXT, MODELS } from '../core/data';
import type { ModelId, QuestionId } from '../core/types';


export interface QuestionCopy {
  title: string;
  options: { value: string; label: string }[];
  help: string;
}

const NOT_SURE = { value: 'unsure', label: "I'm not sure" } as const;

const BAND_OPTIONS: QuestionCopy['options'] = [
  { value: 'lt25', label: 'Under 25 ft' },
  { value: '25to50', label: '25 to 50 ft' },
  { value: '50to100', label: '50 to 100 ft' },
  { value: 'gt100', label: 'More than 100 ft' },
  NOT_SURE,
];

export function questionCopy(id: QuestionId, model: ModelId): QuestionCopy {
  const m = MODELS[model];
  switch (id) {
    case 'zip':
      return {
        title: "What's the ZIP code where the pod is going?",
        options: [],
        help: "Your ZIP code lets us show delivery and local prices. If you're in Canada, use your postal code. You can skip this for now.",
      };

    case 'truckAccess':
      return {
        title: 'Can a truck drive right up to the spot?',
        options: [
          { value: 'yes', label: 'Yes, up a driveway or across an open front yard' },
          { value: 'no', label: 'No' },
          NOT_SURE,
        ],
        help: 'Your pod usually arrives on a tilt trailer. The truck backs up to the spot and slides the pod off. So we need to know if a truck can get right to where the pod goes, like up a driveway or across an open front yard. If you pick "I\'m not sure", it goes on the "To check" list on your plan.',
      };

    case 'pathWidth': {
      const turn = model === 'twelve' ? 20 : 24;
      return {
        title: 'How wide is the narrowest point on the way to the spot?',
        options: [
          { value: 'wide', label: `${m.minPathWidth} ft or wider` },
          { value: 'narrow', label: `Narrower than ${m.minPathWidth} ft` },
          NOT_SURE,
        ],
        help: `Walk from the street to the spot and find the tightest place, like a gate or the gap between the house and a fence. Hold a tape measure across it and read the number. If the pod has to turn along the way, the small mover (a shed mule) needs a turning space about ${turn} ft across.`,
      };
    }

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
      };

    case 'pathGround':
      return {
        title: 'Is the way to the spot solid and fairly flat, or are there steps, steep parts or soft ground?',
        options: [
          { value: 'solid', label: 'Solid and fairly flat' },
          { value: 'soft', label: 'Soft ground' },
          { value: 'steps', label: 'Steps or steep parts' },
          NOT_SURE,
        ],
        help: 'Walk the way in and look at what is under your feet. To check a slope, lay your phone flat on the ground with a level app open. Soft ground, like a lawn after rain, can get marked, so stop watering about a week before delivery.',
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
        help: 'A bathroom needs a water and sewer line run from the house to the pod, which is why we ask. A half bath has a toilet and a sink. The other choice adds a shower.',
      };

    case 'waterDistance':
      return {
        title: "How far are the house's water and sewer lines from the spot?",
        options: BAND_OPTIONS,
        help: 'Water and sewer usually leave the house near the front, or from the basement. Find that spot and measure in a straight line to where the pod goes. A rough guess is fine, because we only need to know which range it falls in.',
      };

    case 'panelDistance':
      return {
        title: "How far is the house's electrical panel from the spot?",
        options: BAND_OPTIONS,
        help: "The electrical panel is the metal box with rows of switches. It's usually in the garage, the basement, or outside near the meter. Measure in a straight line from the panel to where the pod goes. A rough guess is fine.",
      };

    case 'door':
      return {
        title: 'Which way should the door face?',
        options: [
          { value: 'standard', label: 'Standard' },
          { value: 'flipped', label: 'Flipped' },
          NOT_SURE,
        ],
        help: `The flipped door moves the sliding door toward the middle of the pod. It's +$${FLIP_DOOR} on select models. The drawing shows both. Standing where the pod will go, think about which side you'll walk up from.`,
      };

    default: {
      const never: never = id;
      throw new Error(`questionCopy: unknown question "${String(never)}"`);
    }
  }
}
