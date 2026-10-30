import type { Answers, QuestionId } from './types';

export const QUESTION_ORDER: QuestionId[] = [
  'zip', 'bathroom', 'truckAccess', 'pathWidth', 'turn', 'removable', 'overhead', 'pathGround',
  'powerLines', 'streetDistance', 'kitAccess', 'existingBase', 'groundFlat', 'panelDistance', 'panelRoute',
];

export type QuestionGroup = 'Your pod' | 'Getting it there' | 'The spot' | 'Power';

export const QUESTION_GROUP: Record<QuestionId, QuestionGroup> = {
  zip: 'Your pod', bathroom: 'Your pod',
  truckAccess: 'Getting it there', pathWidth: 'Getting it there', turn: 'Getting it there',
  removable: 'Getting it there', overhead: 'Getting it there', pathGround: 'Getting it there',
  powerLines: 'Getting it there', streetDistance: 'Getting it there', kitAccess: 'Getting it there',
  existingBase: 'The spot', groundFlat: 'The spot',
  panelDistance: 'Power', panelRoute: 'Power',
};

// An unanswered question counts as "not that value" everywhere below.

/** The narrow point or tight turn can be taken out: a fence or something else the client can move. */
export function isRemoved(answers: Answers): boolean {
  return answers.removable === 'fence' || answers.removable === 'other';
}

/** The truck cannot reach and the path is too tight, too low or too steep for the shed mule. */
export function isMuleRuledOut(answers: Answers): boolean {
  return answers.truckAccess !== 'yes'
    && (((answers.pathWidth === 'narrow' || answers.turn === 'tight') && !isRemoved(answers))
      || answers.overhead === 'other' || answers.pathGround === 'steep');
}

/** A crane cannot be used either: power lines over the lift, or the street is too far. */
export function isCraneRuledOut(answers: Answers): boolean {
  return isMuleRuledOut(answers)
    && (answers.powerLines === 'yes' || answers.streetDistance === 'over150');
}

function isVisible(id: QuestionId, answers: Answers): boolean {
  switch (id) {
    case 'pathWidth':
    case 'turn':
    case 'overhead':
    case 'pathGround':
      return answers.truckAccess !== 'yes';
    case 'removable':
      return answers.truckAccess !== 'yes' && (answers.pathWidth === 'narrow' || answers.turn === 'tight');
    case 'powerLines':
      return isMuleRuledOut(answers);
    case 'streetDistance':
      return isMuleRuledOut(answers) && answers.powerLines !== 'yes';
    case 'kitAccess':
      return isCraneRuledOut(answers);
    case 'groundFlat':
      return answers.existingBase === 'none';
    default:
      return true;
  }
}

/** The questions to show for these answers, in QUESTION_ORDER. */
export function visibleQuestions(answers: Answers): QuestionId[] {
  return QUESTION_ORDER.filter((id) => isVisible(id, answers));
}
