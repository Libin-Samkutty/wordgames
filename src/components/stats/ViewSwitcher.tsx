import { cn } from '@/lib/cn';

export interface ViewSwitcherProps<T extends string | number> {
  readonly views: readonly { readonly value: T; readonly label: string }[];
  readonly value: T;
  readonly onChange: (value: T) => void;
}

/** The All / length / mode radio buttons at the top of a statistics modal. */
export function ViewSwitcher<T extends string | number>({
  views,
  value,
  onChange,
}: ViewSwitcherProps<T>): React.JSX.Element {
  return (
    <div role="radiogroup" aria-label="Statistics for" className="flex gap-1">
      {views.map((view) => (
        <button
          key={view.value}
          type="button"
          role="radio"
          aria-checked={value === view.value}
          onClick={() => {
            onChange(view.value);
          }}
          className={cn(
            'min-h-9 rounded px-2.5 text-xs font-semibold text-text-muted',
            'aria-checked:bg-surface-sunken aria-checked:text-text',
          )}
        >
          {view.label}
        </button>
      ))}
    </div>
  );
}
