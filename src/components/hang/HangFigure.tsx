import { memo } from 'react';

import { MAX_MISSES } from '@/engine/hang';

export interface HangFigureProps {
  /** How many parts to draw, 0 to 6 (FR-170). */
  readonly misses: number;
}

/** The six parts, in the order a miss adds them: head, body, left arm, right arm, left leg, right leg. */
const PARTS: readonly React.JSX.Element[] = [
  <circle key="head" cx="75" cy="34" r="10" />,
  <line key="body" x1="75" y1="44" x2="75" y2="78" />,
  <line key="left-arm" x1="75" y1="52" x2="60" y2="66" />,
  <line key="right-arm" x1="75" y1="52" x2="90" y2="66" />,
  <line key="left-leg" x1="75" y1="78" x2="62" y2="100" />,
  <line key="right-leg" x1="75" y1="78" x2="88" y2="100" />,
];

/**
 * The gallows and the figure (FR-171). It is decorative: the misses are also
 * given as text next to it, and as an announcement, so it is hidden from
 * assistive technology (A11Y-27). It is drawn in the text colour, so it follows
 * the theme, and its height follows the screen so the keyboard stays in view.
 */
export const HangFigure = memo(function HangFigure({ misses }: HangFigureProps): React.JSX.Element {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 100 120"
      className="h-[clamp(5rem,20dvh,9rem)] w-auto text-text"
      fill="none"
      stroke="currentColor"
      strokeWidth="4"
      strokeLinecap="round"
      strokeLinejoin="round"
      data-misses={misses}
    >
      {/* The gallows is always there: base, post, beam and rope. */}
      <path d="M10 112h50M30 112V10h45v14" />
      {PARTS.slice(0, Math.min(Math.max(misses, 0), MAX_MISSES))}
    </svg>
  );
});
