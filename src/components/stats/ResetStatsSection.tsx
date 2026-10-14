import { useState } from 'react';

import { useToast } from '@/state';

import { Button } from '../ui/Button';
import { ConfirmDialog } from '../ui/ConfirmDialog';

export interface ResetStatsSectionProps {
  /** What "Reset statistics" deletes, named exactly (FR-47). */
  readonly statisticsDescription: string;
  readonly onResetStatistics: () => void;
  readonly onResetHistory: () => void;
}

/**
 * **Reset statistics** and **Reset history** for one game, each behind the
 * shared confirmation that names what will be deleted (FR-47, FR-67).
 *
 * It lives in a game's own Statistics dialog, so a reset can only reach that
 * game's data. Settings is shared by the whole suite and has no such actions.
 */
export function ResetStatsSection({
  statisticsDescription,
  onResetStatistics,
  onResetHistory,
}: ResetStatsSectionProps): React.JSX.Element {
  const { show } = useToast();
  const [confirming, setConfirming] = useState<'stats' | 'history' | null>(null);

  const confirm = (): void => {
    if (confirming === 'stats') {
      onResetStatistics();
      show('Statistics reset');
    } else if (confirming === 'history') {
      onResetHistory();
      show('History reset');
    }
    setConfirming(null);
  };

  return (
    <section className="rounded border border-danger/40 p-3">
      <h3 className="mb-2 text-xs font-bold tracking-wide text-danger uppercase">Danger zone</h3>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Button
          variant="secondary"
          onClick={() => {
            setConfirming('stats');
          }}
        >
          Reset statistics
        </Button>
        <Button
          variant="secondary"
          onClick={() => {
            setConfirming('history');
          }}
        >
          Reset history
        </Button>
      </div>

      <ConfirmDialog
        isOpen={confirming !== null}
        title={confirming === 'stats' ? 'Reset statistics?' : 'Reset history?'}
        confirmLabel="Delete"
        destructive
        onConfirm={confirm}
        onCancel={() => {
          setConfirming(null);
        }}
      >
        {confirming === 'stats'
          ? `Permanently delete all statistics: ${statisticsDescription}? Your recent games list is kept.`
          : 'Permanently delete your recent games list? Your statistics are kept.'}
      </ConfirmDialog>
    </section>
  );
}
