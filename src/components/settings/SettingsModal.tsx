import { useSettings } from '@/state';
import type { Theme } from '@/storage';

import { Modal } from '../ui/Modal';

const THEMES: readonly { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

function Row({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-3 last:border-b-0">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {description ? <p className="text-xs text-text-muted">{description}</p> : null}
      </div>
      {children}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}): React.JSX.Element {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => {
        onChange(!checked);
      }}
      className="relative h-6 w-11 shrink-0 rounded-full bg-border transition-colors aria-checked:bg-tile-correct"
    >
      <span
        aria-hidden="true"
        className="absolute top-0.5 left-0.5 size-5 rounded-full bg-surface transition-transform"
        style={{ transform: checked ? 'translateX(1.25rem)' : 'translateX(0)' }}
      />
    </button>
  );
}

export function SettingsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}): React.JSX.Element {
  const { settings, setTheme, setColorblind, setMotion } = useSettings();

  return (
    <Modal isOpen={isOpen} title="Settings" onClose={onClose}>
      <div className="flex flex-col">
        <Row label="Theme">
          <div role="radiogroup" aria-label="Theme" className="flex gap-1">
            {THEMES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={settings.theme === value}
                onClick={() => {
                  setTheme(value);
                }}
                className="min-h-11 rounded px-2.5 text-xs font-semibold text-text-muted aria-checked:bg-surface-sunken aria-checked:text-text"
              >
                {label}
              </button>
            ))}
          </div>
        </Row>

        <Row
          label="Colourblind mode"
          description="High-contrast blue and orange tiles with markers"
        >
          <Toggle checked={settings.colorblind} onChange={setColorblind} label="Colourblind mode" />
        </Row>

        <Row label="Reduce motion" description="Turn off tile flips and shakes">
          <Toggle
            checked={settings.motion === 'reduced'}
            onChange={(value) => {
              setMotion(value ? 'reduced' : 'system');
            }}
            label="Reduce motion"
          />
        </Row>
      </div>
    </Modal>
  );
}
