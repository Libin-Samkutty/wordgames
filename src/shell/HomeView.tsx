import { useId } from 'react';

import { GAMES, type CatalogueEntry } from './catalogue';

function GameCard({ entry }: { entry: CatalogueEntry }): React.JSX.Element {
  const descriptionId = useId();

  return (
    <li>
      <a
        href={entry.route}
        aria-label={`Play ${entry.name}`}
        aria-describedby={descriptionId}
        className="flex min-h-11 flex-col gap-1 rounded-lg border-2 border-border-strong bg-surface-raised px-4 py-3 transition-colors hover:border-text-muted"
      >
        <span aria-hidden="true" className="text-lg font-bold tracking-wide uppercase">
          {entry.name}
        </span>
        <span id={descriptionId} className="text-sm text-text-muted">
          {entry.description}
        </span>
      </a>
    </li>
  );
}

/**
 * Home (`#/`): one card per catalogue entry, in catalogue order (FR-63, FR-97,
 * A11Y-14).
 *
 * It mounts no game provider and loads no word list or game code, so the first
 * visit costs only the shell (NFR-15, NFR-20). The `<h1>` is the header's.
 */
export function HomeView({
  games = GAMES,
}: {
  games?: readonly CatalogueEntry[];
}): React.JSX.Element {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
      <ul className="flex flex-col gap-3">
        {games.map((entry) => (
          <GameCard key={entry.id} entry={entry} />
        ))}
      </ul>
    </main>
  );
}
