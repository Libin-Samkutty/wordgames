import { Button } from '../ui/Button';

/** No puzzle could be generated (EC-32). Always offers a way forward. */
export function GenerationError({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  return (
    <div
      role="alert"
      className="flex flex-col items-center gap-3 rounded-lg bg-surface-raised px-6 py-8 text-center"
    >
      <p className="font-semibold">Couldn&apos;t create a puzzle.</p>
      <p className="max-w-xs text-sm text-text-muted">
        That sometimes happens. Try again to get a different one.
      </p>
      <Button onClick={onRetry}>Retry</Button>
    </div>
  );
}
