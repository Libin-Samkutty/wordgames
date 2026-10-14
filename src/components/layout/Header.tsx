import { cn } from '@/lib/cn';

export interface HeaderProps {
  /** The `<h1>`: the suite name on Home, the game's name in a game (FR-64). */
  readonly title: string;
  /** True in a game view: shows the **All games** link first. */
  readonly showAllGames: boolean;
  /**
   * Receives the element that holds the game's own controls. The game view
   * portals its controls into it (see `HeaderControls`), because they need
   * the game's context, which sits below the shell.
   */
  readonly controlsRef: (element: HTMLDivElement | null) => void;
  readonly onOpenSettings: () => void;
}

/**
 * The header frame, owned by the shell (FR-64, A11Y-15).
 *
 * In a game it reads, in tab order: **All games**, the game name as the
 * `<h1>`, the game's controls, then Settings. On Home it is the suite name and
 * Settings only. Below `sm` a game header wraps onto two rows so every control
 * keeps a 44px target at 320px (FR-58, AC-22).
 */
export function Header({
  title,
  showAllGames,
  controlsRef,
  onOpenSettings,
}: HeaderProps): React.JSX.Element {
  return (
    <header className="border-b border-border">
      <div
        className={cn(
          'mx-auto flex w-full max-w-2xl gap-x-1 px-1 py-1 sm:flex-row sm:items-center sm:gap-x-2 sm:px-4',
          showAllGames ? 'flex-col' : 'flex-row items-center',
        )}
      >
        <div className="flex min-w-0 items-center gap-1 sm:flex-1 sm:gap-3">
          {showAllGames ? (
            <a
              href="#/"
              className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded px-2 text-sm font-semibold text-text-muted transition-colors hover:text-text"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="size-4"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m15 18-6-6 6-6" />
              </svg>
              All games
            </a>
          ) : null}

          {/* Truncates rather than pushing the controls off-screen at 320px (AC-22). */}
          <h1
            // Focus lands here after a view change (A11Y-15); it is not a tab stop.
            tabIndex={-1}
            className="min-w-0 truncate text-sm font-bold tracking-[0.1em] capitalize sm:text-xl sm:tracking-[0.15em]"
          >
            {title}
          </h1>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-0.5 sm:gap-1">
          <div ref={controlsRef} className="flex items-center gap-0.5 sm:gap-1" />

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Settings"
            className="flex size-11 shrink-0 items-center justify-center rounded text-text-muted transition-colors hover:text-text"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" />
            </svg>
          </button>
        </div>
      </div>
    </header>
  );
}

/**
 * A header icon button, shared by every game's controls so they match.
 */
export function HeaderIconButton({
  label,
  onClick,
  disabled = false,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className="flex size-11 shrink-0 items-center justify-center rounded text-text-muted transition-colors hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  );
}
