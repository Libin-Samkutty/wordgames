export interface DistributionProps {
  /** One count per row, top to bottom. */
  readonly counts: readonly number[];
  /** Row label for index 0 when `labels` is not given. Later rows count up from it. */
  readonly firstLabel?: number;
  /** Explicit row labels, for rows that are not consecutive numbers. */
  readonly labels?: readonly string[];
  /** The row to mark, for example the bar for the game that was just finished. */
  readonly highlightIndex?: number | null;
}

/** A horizontal bar chart of counts, shared by every game's statistics (FR-41: no NaN). */
export function Distribution({
  counts,
  firstLabel = 1,
  labels,
  highlightIndex = null,
}: DistributionProps): React.JSX.Element {
  const max = Math.max(1, ...counts);

  return (
    <div className="flex flex-col gap-1">
      {counts.map((count, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <span className="min-w-4 shrink-0 tabular-nums">
            {labels?.[index] ?? String(firstLabel + index)}
          </span>
          <div className="flex-1">
            <div
              className="flex justify-end rounded-sm bg-tile-absent px-1.5 py-0.5 text-xs font-bold text-tile-text-revealed data-[has-count=true]:bg-tile-correct data-[highlight=true]:bg-tile-present"
              style={{ width: `${String(Math.max(7, (count / max) * 100))}%` }}
              data-has-count={count > 0}
              data-highlight={index === highlightIndex}
            >
              {count}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
