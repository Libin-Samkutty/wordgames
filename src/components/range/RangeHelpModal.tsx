import { RANGE_MAX_GUESSES } from '@/engine/range';

import { Modal } from '../ui/Modal';
import { HeatBadge } from './HeatBadge';
import { HEAT_LABEL } from './heatLabel';
import { RANGE_HELP_EXAMPLE } from './helpExample';

export interface RangeHelpModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
}

/**
 * Explains WordRange to a player who has not seen it (FR-126, US-38). Opened
 * only from the header control, never by the app itself (ADR-020), so it needs
 * no persisted state.
 */
export function RangeHelpModal({ isOpen, onClose }: RangeHelpModalProps): React.JSX.Element {
  return (
    <Modal isOpen={isOpen} title="How to play" onClose={onClose}>
      <div className="flex flex-col gap-4 text-sm">
        <p>
          Find the hidden 5-letter word in {RANGE_MAX_GUESSES} guesses. Each guess must be a real
          word. After every guess you learn whether the hidden word comes{' '}
          <strong className="font-bold">before</strong> or{' '}
          <strong className="font-bold">after</strong> it in the dictionary.
        </p>
        <p>
          The <strong className="font-bold">range</strong> shows the two words you have narrowed it
          down to. The hidden word is always between them, and you can only guess words inside the
          range. A rejected guess costs nothing.
        </p>
        <p>
          <strong className="font-bold">Heat</strong> tells you how close your guess is, counted in
          words of the dictionary:
        </p>
        <ul className="flex flex-col gap-1">
          <li>
            <HeatBadge heat="burning" /> <span className="text-text-muted">within 20 words</span>
          </li>
          <li>
            <HeatBadge heat="hot" /> <span className="text-text-muted">within 100</span>
          </li>
          <li>
            <HeatBadge heat="warm" /> <span className="text-text-muted">within 500</span>
          </li>
          <li>
            <HeatBadge heat="cold" /> <span className="text-text-muted">within 2,000</span>
          </li>
          <li>
            <HeatBadge heat="freezing" /> <span className="text-text-muted">further than that</span>
          </li>
        </ul>

        <section>
          <h3 className="mb-2 text-xs font-bold tracking-wide uppercase">Example</h3>
          {/* Decorative: the sentences below carry the meaning (A11Y-13). */}
          <ol aria-hidden="true" className="flex flex-col gap-1">
            {RANGE_HELP_EXAMPLE.steps.map((step) => (
              <li
                key={step.word}
                className="flex items-center justify-between gap-2 rounded bg-surface-raised px-3 py-1.5"
              >
                <span className="font-mono font-bold tracking-widest">{step.word}</span>
                <span className="text-text-muted">
                  {step.direction === 'after' ? '↓ After' : '↑ Before'}
                </span>
                <HeatBadge heat={step.heat} />
              </li>
            ))}
          </ol>
          <p className="mt-2">
            The hidden word is <strong className="font-bold">{RANGE_HELP_EXAMPLE.secret}</strong>.
          </p>
          <ul className="mt-1 flex flex-col gap-0.5">
            {RANGE_HELP_EXAMPLE.steps.map((step) => (
              <li key={step.word}>
                <strong className="font-bold">{step.word}</strong>: the word is {step.direction} it.{' '}
                {HEAT_LABEL[step.heat]}.
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Modal>
  );
}
