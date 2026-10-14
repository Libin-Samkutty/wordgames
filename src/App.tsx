import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { SettingsProvider, ToastProvider } from './state';
import { AppShell } from './shell/AppShell';
import type { CatalogueEntry } from './shell/catalogue';

/**
 * The shared providers around the routed shell (ARCHITECTURE §4.1).
 *
 *   Settings outermost — theme must apply before anything paints.
 *   Toast next        — every layer below can raise a message.
 *
 * Each game mounts its own providers inside its view, so Home loads none.
 */
export function App({
  games,
}: {
  /** Tests pass a fixture catalogue; the app uses the real one. */
  games?: readonly CatalogueEntry[];
}): React.JSX.Element {
  return (
    <ErrorBoundary>
      <SettingsProvider>
        <ToastProvider>
          <AppShell {...(games ? { games } : {})} />
        </ToastProvider>
      </SettingsProvider>
    </ErrorBoundary>
  );
}
