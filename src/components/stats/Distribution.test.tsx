import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Distribution } from './Distribution';
import { ViewSwitcher } from './ViewSwitcher';

function bars(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-has-count]'));
}

describe('Distribution', () => {
  it('labels rows from firstLabel and shows each count', () => {
    const { container } = render(<Distribution counts={[0, 3, 1]} firstLabel={2} />);

    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(bars(container).map((bar) => bar.textContent)).toEqual(['0', '3', '1']);
  });

  it('uses explicit labels when given', () => {
    render(<Distribution counts={[1, 2]} labels={['Par', '+1']} />);

    expect(screen.getByText('Par')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument();
  });

  it('marks only the highlighted row', () => {
    const { container } = render(<Distribution counts={[1, 1, 1]} highlightIndex={1} />);

    expect(bars(container).map((bar) => bar.dataset.highlight)).toEqual(['false', 'true', 'false']);
  });

  it('marks nothing without a highlight, and never shows a zero width', () => {
    const { container } = render(<Distribution counts={[0, 0]} />);

    for (const bar of bars(container)) {
      expect(bar.dataset.highlight).toBe('false');
      expect(bar.dataset.hasCount).toBe('false');
      expect(bar.style.width).toBe('7%');
    }
  });
});

describe('ViewSwitcher', () => {
  const views = [
    { value: 'all', label: 'All' },
    { value: 5, label: '5 letters' },
  ] as const;

  it('shows the chosen view as checked', () => {
    render(<ViewSwitcher views={views} value={5} onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: '5 letters' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'All' })).not.toBeChecked();
  });

  it('reports the value of the view that was clicked', async () => {
    const onChange = vi.fn();
    render(<ViewSwitcher views={views} value={5} onChange={onChange} />);

    await userEvent.click(screen.getByRole('radio', { name: 'All' }));

    expect(onChange).toHaveBeenCalledWith('all');
  });
});
