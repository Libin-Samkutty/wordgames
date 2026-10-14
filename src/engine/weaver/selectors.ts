import { MAX_MOVES } from './constants';
import { evaluateRung } from './evaluate';
import type {
  LadderRowView,
  LadderTileView,
  ResultSummary,
  WeaverRecord,
  WeaverState,
} from './types';

/** True once the puzzle has ended, either way. There is no lost state (FR-85). */
export function isGameOver(state: WeaverState): boolean {
  return state.status === 'solved' || state.status === 'gave-up';
}

/** True when Undo would do something (FR-83, EC-30). */
export function canUndo(state: WeaverState): boolean {
  return state.status === 'playing' && state.rungs.length > 0;
}

/** True once the 500-move safety cap has disabled rung input (FR-85, EC-34). */
export function moveLimitReached(state: WeaverState): boolean {
  return state.moves >= MAX_MOVES;
}

/** The word the next rung must differ from by one letter: the last rung, or the start. */
export function previousWord(state: WeaverState): string {
  return state.rungs[state.rungs.length - 1]?.word ?? state.start;
}

/** Every word already in the ladder: the start word and each current rung (EC-29). */
export function usedWords(state: WeaverState): readonly string[] {
  return [state.start, ...state.rungs.map((rung) => rung.word)];
}

/** `moves - par`. Negative when the player beat par with a word outside the ladder list (FR-84). */
export function overPar(state: WeaverState): number {
  return state.moves - state.par;
}

/** A solve with `moves <= par` (FR-84). */
export function isParHit(state: WeaverState): boolean {
  return state.status === 'solved' && state.moves <= state.par;
}

/** `Par!`, `Under par by n!` or `+n` (FR-91). */
function parLabel(over: number): string {
  if (over === 0) return 'Par!';
  if (over < 0) return `Under par by ${String(-over)}!`;
  return `+${String(over)}`;
}

/**
 * How the puzzle compares with par (FR-84, FR-91, FR-87).
 *
 * There is no numeric score. The label is set only for a solve; a give up has
 * moves and par to show but nothing to praise.
 */
export function resultSummary(state: WeaverState): ResultSummary {
  const over = overPar(state);

  return {
    moves: state.moves,
    par: state.par,
    ladderLength: state.rungs.length,
    overPar: over,
    parHit: isParHit(state),
    label: state.status === 'solved' ? parLabel(over) : null,
  };
}

/** A finished puzzle for the statistics log (FR-92), or null while it is still in play. */
export function weaverRecord(state: WeaverState): WeaverRecord | null {
  if (!isGameOver(state)) return null;

  return {
    id: state.id,
    // `finishedAt` is always set by the reducer when the status changes.
    playedAt: state.finishedAt ?? 0,
    length: state.length,
    start: state.start,
    end: state.end,
    par: state.par,
    moves: state.moves,
    ladderLength: state.rungs.length,
    solved: state.status === 'solved',
  };
}

function tiles(word: string, end: string): LadderTileView[] {
  return evaluateRung(word, end).map((state, index) => ({
    letter: word[index] as string,
    state,
  }));
}

/**
 * Projects state into the rows the ladder board renders (FR-88, A11Y-16): the
 * start row (scored like any rung), each accepted rung, the input row while the
 * puzzle is still being played, and the end row, which is always shown.
 */
export function ladderRows(state: WeaverState): readonly LadderRowView[] {
  const revealingIndex = state.status === 'revealing' ? state.rungs.length - 1 : -1;

  const rows: LadderRowView[] = [
    {
      kind: 'start',
      label: 'Start',
      tiles: tiles(state.start, state.end),
      isActive: false,
      isRevealing: false,
    },
    ...state.rungs.map((rung, index): LadderRowView => ({
      kind: 'rung',
      label: `Rung ${String(index + 1)}`,
      tiles: tiles(rung.word, state.end),
      isActive: false,
      isRevealing: index === revealingIndex,
    })),
  ];

  if (!isGameOver(state)) {
    const isActive = state.status === 'playing';
    rows.push({
      kind: 'input',
      label: 'Next rung',
      tiles: Array.from({ length: state.length }, (_unused, index): LadderTileView => {
        const letter = isActive ? state.currentInput[index] : undefined;
        return letter === undefined ? { letter: '', state: 'empty' } : { letter, state: 'filled' };
      }),
      isActive,
      isRevealing: false,
    });
  }

  rows.push({
    kind: 'end',
    label: 'End',
    tiles: tiles(state.end, state.end),
    isActive: false,
    isRevealing: false,
  });

  return rows;
}
