import type { Answers, QuestionId } from './types';

export const QUESTION_ORDER: QuestionId[] = [
  'zip', 'truckAccess', 'pathWidth', 'overhead', 'pathGround', 'powerLines', 'streetDistance',
  'kitAccess', 'existingBase', 'groundFlat', 'bathroom', 'waterDistance', 'panelDistance', 'door',
];

// An unanswered question counts as "not that value" everywhere below.

/** The shed mule cannot be used: the truck cannot reach and the path or overhead rules it out. */
export function isMuleRuledOut(answers: Answers): boolean {
  return answers.truckAccess !== 'yes'
    && (answers.pathWidth === 'narrow' || answers.overhead === 'other' || answers.pathGround === 'steps');
}

/** A crane cannot be used either: power lines over the lift, or the street is too far. */
export function isCraneRuledOut(answers: Answers): boolean {
  return isMuleRuledOut(answers)
    && (answers.powerLines === 'yes' || answers.streetDistance === 'over150');
}

function isVisible(id: QuestionId, answers: Answers): boolean {
  switch (id) {
    case 'pathWidth':
    case 'overhead':
    case 'pathGround':
      return answers.truckAccess !== 'yes';
    case 'powerLines':
      return isMuleRuledOut(answers);
    case 'streetDistance':
      return isMuleRuledOut(answers) && answers.powerLines !== 'yes';
    case 'kitAccess':
      return isCraneRuledOut(answers);
    case 'groundFlat':
      return answers.existingBase === 'none';
    case 'waterDistance':
      return answers.bathroom === 'half' || answers.bathroom === 'shower';
    default:
      return true;
  }
}

/** The questions to show for these answers, in QUESTION_ORDER. */
export function visibleQuestions(answers: Answers): QuestionId[] {
  return QUESTION_ORDER.filter((id) => isVisible(id, answers));
}
