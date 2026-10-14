import { useState } from 'react';

import { Header } from '@/components/layout/Header';
import { HeaderSlotContext } from '@/components/layout/headerSlot';
import { SettingsModal } from '@/components/settings/SettingsModal';
import { ToastRegion } from '@/components/ui/ToastRegion';
import { StorageNotices, useToast } from '@/state';

import { GAMES, type CatalogueEntry } from './catalogue';
import { GameFrame } from './GameFrame';
import { HomeView } from './HomeView';
import { SUITE_NAME, entryFor } from './routes';
import { useHashRoute } from './useHashRoute';

/**
 * The frame around every view: header, the routed view, footer, toasts and the
 * shared Settings dialog (ARCHITECTURE §4.1, FR-61 … FR-66).
 *
 * Providers for a game are mounted by the game's own view, never here, so Home
 * loads no word list (FR-63, NFR-15).
 */
export function AppShell({
  games = GAMES,
}: {
  /** The shipped games. Tests pass a fixture catalogue. */
  games?: readonly CatalogueEntry[];
}): React.JSX.Element {
  const view = useHashRoute(games);
  const entry = entryFor(view, games);
  const { toasts, dismiss } = useToast();

  // The header's controls slot, set by a callback ref so a game can portal into it.
  const [controlsSlot, setControlsSlot] = useState<HTMLElement | null>(null);

  const [isSettingsOpen, setSettingsOpen] = useState(false);

  // Any open dialog closes when the view changes, e.g. Back with Settings open
  // (EC-38). Game dialogs close by unmounting with their view. This is the
  // "adjust state during render" pattern rather than an effect.
  const [shownView, setShownView] = useState(view);
  if (shownView !== view) {
    setShownView(view);
    setSettingsOpen(false);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-surface text-text">
      <Header
        title={entry ? entry.name : SUITE_NAME}
        showAllGames={entry !== undefined}
        controlsRef={setControlsSlot}
        onOpenSettings={() => {
          setSettingsOpen(true);
        }}
      />

      <HeaderSlotContext.Provider value={controlsSlot}>
        {entry ? <GameFrame key={entry.id} entry={entry} /> : <HomeView games={games} />}
      </HeaderSlotContext.Provider>

      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-2xl px-4 py-2 text-center text-xs text-text-muted">
          Plays entirely offline. Your statistics never leave this device.
        </div>
      </footer>

      <StorageNotices />
      <ToastRegion toasts={toasts} onDismiss={dismiss} />

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => {
          setSettingsOpen(false);
        }}
      />
    </div>
  );
}
