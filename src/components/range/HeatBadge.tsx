import type { Heat } from '@/engine/range';
import { cn } from '@/lib/cn';

import { HEAT_LABEL, heatPips } from './heatLabel';

/**
 * A heat level written as a word with five pips beside it (FR-121). The word
 * is the information; the pips are a quick visual that never stands alone.
 */
export function HeatBadge({
  heat,
  className,
}: {
  heat: Heat;
  className?: string;
}): React.JSX.Element {
  const filled = heatPips(heat);

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm font-bold', className)}>
      <span aria-hidden="true" className="flex gap-0.5">
        {[0, 1, 2, 3, 4].map((pip) => (
          <span
            key={pip}
            className={cn(
              'size-1.5 rounded-full',
              pip < filled ? 'bg-tile-correct' : 'bg-tile-absent',
            )}
          />
        ))}
      </span>
      {HEAT_LABEL[heat]}
    </span>
  );
}
