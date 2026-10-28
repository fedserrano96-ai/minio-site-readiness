import { MODELS } from './data';
import { isCraneRuledOut, isMuleRuledOut, visibleQuestions } from './questions';
import type {
  Answers, BaseKind, Method, ModelId, NoteCode, PlannerSnapshot, ReasonCode, Recommendation, ToCheckCode,
} from './types';

/**
 * Smallest gap in feet between the pod's rectangle and any object's bounding box or the yard edge.
 * 0 when the pod overlaps an object or sits past the yard edge. Uses the snapshot's model;
 * `recommend` passes the effective model (override or snapshot) in.
 */
export function minClearance(snapshot: PlannerSnapshot): number {
  const dims = MODELS[snapshot.model];
  const w = snapshot.rotation === 90 ? dims.d : dims.w;
  const h = snapshot.rotation === 90 ? dims.w : dims.d;
  let gap = Math.min(
    snapshot.podX - w / 2,
    snapshot.yardW - (snapshot.podX + w / 2),
    snapshot.podY - h / 2,
    snapshot.yardD - (snapshot.podY + h / 2),
  );
  for (const o of snapshot.objects) {
    const dx = Math.max(0, Math.abs(snapshot.podX - o.x) - (w + o.w) / 2);
    const dy = Math.max(0, Math.abs(snapshot.podY - o.y) - (h + o.h) / 2);
    gap = Math.min(gap, Math.hypot(dx, dy));
  }
  return Math.max(0, gap);
}

function methodFor(answers: Answers): Pick<Recommendation, 'method' | 'craneFrom' | 'methodReason'> {
  if (!isMuleRuledOut(answers)) {
    return answers.truckAccess === 'no'
      ? { method: 'shedMule', craneFrom: null, methodReason: 'truckNo' }
      : { method: 'tiltTrailer', craneFrom: null, methodReason: null };
  }
  const pathCause: ReasonCode = answers.pathWidth === 'narrow' ? 'pathNarrow'
    : answers.overhead === 'other' ? 'overheadLow' : 'pathSteps';
  if (!isCraneRuledOut(answers)) {
    return { method: 'crane', craneFrom: answers.streetDistance === '100to150' ? 4000 : 3000, methodReason: pathCause };
  }
  if (answers.kitAccess === 'no') return { method: 'talk', craneFrom: null, methodReason: 'noKitAccess' };
  return { method: 'kit', craneFrom: null, methodReason: answers.powerLines === 'yes' ? 'powerLines' : 'tooFar' };
}

function baseFor(answers: Answers): { base: BaseKind; baseReason: ReasonCode | null; code: ToCheckCode | null } {
  switch (answers.existingBase) {
    case 'slab': return { base: 'existing', baseReason: 'existingBase', code: 'baseSlab' };
    case 'gravel': return { base: 'existing', baseReason: 'existingBase', code: 'baseGravel' };
    case 'deck': return { base: 'existing', baseReason: 'existingBase', code: 'baseDeck' };
    default:
      // groundFlat is only asked (and so only counts) when there is no existing base.
      return answers.existingBase === 'none' && answers.groundFlat === 'steep'
        ? { base: 'raised', baseReason: 'steepGround', code: null }
        : { base: 'gravel', baseReason: null, code: null };
  }
}

export function recommend(snapshot: PlannerSnapshot, answers: Answers, modelOverride?: ModelId): Recommendation {
  const model = modelOverride ?? snapshot.model;
  const visible = visibleQuestions(answers);
  const { method, craneFrom, methodReason } = methodFor(answers);
  const { base, baseReason, code } = baseFor(answers);

  const bathroom = answers.bathroom === 'half' || answers.bathroom === 'shower' ? answers.bathroom : 'none';
  // The flipped door only exists on some models; anywhere else the pod comes with the standard door.
  const flipAvailable = MODELS[model].flipAvailable;
  const door = answers.door === 'flipped' && flipAvailable ? 'flipped' : 'standard';

  const toCheck: ToCheckCode[] = visible.filter((id) => answers[id] === 'unsure');
  if (code) toCheck.push(code);

  const notes: NoteCode[] = [];
  if (visible.includes('pathGround') && answers.pathGround === 'soft') notes.push('softGround');
  notes.push('panelUpgrade');
  if (model === 'twelve' && bathroom === 'shower') notes.push('twelveHalfBathOnly');
  if (visible.includes('door') && answers.door === 'flipped' && !flipAvailable) notes.push('flipNotAvailable');
  if (method === 'kit') notes.push('kitUnloading');
  if (minClearance({ ...snapshot, model }) < 3) notes.push('clearance');

  return { model, method, craneFrom, base, methodReason, baseReason, bathroom, door, toCheck, notes };
}
