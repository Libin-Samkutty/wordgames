import { Component, Suspense, lazy, type ComponentType, type LazyExoticComponent } from 'react';

import { Button } from '@/components/ui/Button';

import { GameLoadError, type CatalogueEntry } from './catalogue';

/** What the shell shows while a game's code downloads. The header and its `<h1>` are already there. */
function ViewSkeleton(): React.JSX.Element {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4 py-6">
      <p role="status" className="text-sm text-text-muted">
        Loading…
      </p>
    </main>
  );
}

/** A game's code could not be loaded (EC-50). Always offers a way forward. */
function LoadErrorPanel({ onRetry }: { onRetry: () => void }): React.JSX.Element {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 items-center justify-center px-4 py-6">
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-lg bg-surface-raised px-6 py-8 text-center"
      >
        <p className="font-semibold">Couldn&apos;t load this game.</p>
        <p className="max-w-xs text-sm text-text-muted">
          This can happen after an update while the page was open. Try again, or pick another game.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={onRetry}>Retry</Button>
          <a
            href="#/"
            className="inline-flex min-h-11 items-center justify-center rounded border-2 border-border-strong px-4 py-2 text-sm font-semibold tracking-wide uppercase transition-colors hover:bg-surface-raised"
          >
            All games
          </a>
        </div>
      </div>
    </main>
  );
}

interface GameFrameProps {
  readonly entry: CatalogueEntry;
}

interface GameFrameState {
  readonly error: unknown;
  readonly View: LazyExoticComponent<ComponentType>;
}

/**
 * Loads one catalogue game and shows it (FR-97, NFR-20, EC-50).
 *
 * The view is a lazy chunk. While it downloads there is a short fallback, and
 * if the download fails there is an inline panel with **Retry** and **All
 * games**, not the app's crash screen. **Retry** asks the entry's loader again
 * through a fresh `React.lazy`, because a rejected one stays rejected.
 *
 * Only a `GameLoadError` is handled here. Any other error was thrown while the
 * game rendered, which is a real crash, so it is rethrown to the app's error
 * boundary.
 */
export class GameFrame extends Component<GameFrameProps, GameFrameState> {
  override state: GameFrameState = { error: null, View: this.props.entry.View };

  static getDerivedStateFromError(error: unknown): Pick<GameFrameState, 'error'> {
    return { error };
  }

  private readonly retry = (): void => {
    const { entry } = this.props;
    this.setState({
      error: null,
      View: lazy(() => entry.load().then((component) => ({ default: component }))),
    });
  };

  override render(): React.ReactNode {
    const { error, View } = this.state;

    if (error !== null) {
      if (!(error instanceof GameLoadError)) {
        throw new Error('A game crashed while rendering', { cause: error });
      }
      return <LoadErrorPanel onRetry={this.retry} />;
    }

    return (
      <Suspense fallback={<ViewSkeleton />}>
        <View />
      </Suspense>
    );
  }
}
