/** Placeholder while the word list loads and the ladder graph builds (FR-96). */
export function WeaverSkeleton({ length }: { length: number }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-4" role="status">
      <div className="grid gap-1.5" aria-hidden="true">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className="grid justify-center gap-1.5"
            style={{ gridTemplateColumns: `repeat(${String(length)}, minmax(0, auto))` }}
          >
            {Array.from({ length }, (_tile, column) => (
              <div
                key={column}
                className="size-(--size-tile) animate-pulse rounded-sm border-2 border-tile-empty-border bg-surface-raised"
              />
            ))}
          </div>
        ))}
      </div>
      <span className="text-sm text-text-muted">Preparing puzzle…</span>
    </div>
  );
}
