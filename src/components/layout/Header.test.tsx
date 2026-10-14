import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { Header } from './Header';

function renderHeader(overrides: Partial<Parameters<typeof Header>[0]> = {}) {
  const props = {
    title: 'Wordwright',
    showAllGames: true,
    controlsRef: vi.fn(),
    onOpenSettings: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<Header {...props} />) };
}

describe('Header (FR-64, A11Y-15)', () => {
  it('has exactly one h1 that can take focus but is not a tab stop', () => {
    renderHeader();

    const heading = screen.getByRole('heading', { level: 1, name: 'Wordwright' });
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('shows an All games link to Home in a game, before the title (FR-64)', () => {
    renderHeader();

    const link = screen.getByRole('link', { name: 'All games' });
    expect(link).toHaveAttribute('href', '#/');
    expect(link.compareDocumentPosition(screen.getByRole('heading', { level: 1 }))).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('makes All games the first item in tab order (A11Y-15)', () => {
    renderHeader();

    expect(screen.getAllByRole('link')[0]).toHaveAccessibleName('All games');
  });

  it('shows the suite name and Settings only on Home (FR-64)', () => {
    renderHeader({ title: 'wordgames', showAllGames: false });

    expect(screen.getByRole('heading', { level: 1, name: 'wordgames' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'All games' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  it('calls onOpenSettings from the Settings button', async () => {
    const user = userEvent.setup();
    const { props } = renderHeader();

    await user.click(screen.getByRole('button', { name: 'Settings' }));

    expect(props.onOpenSettings).toHaveBeenCalledOnce();
  });

  it('hands its controls slot to the caller', () => {
    const { props } = renderHeader();

    expect(props.controlsRef).toHaveBeenCalledWith(expect.any(HTMLDivElement));
  });

  it('puts Settings after the controls slot in tab order', () => {
    renderHeader({
      controlsRef: (element) => {
        if (element) element.innerHTML = '<button type="button">Game control</button>';
      },
    });

    const names = screen
      .getAllByRole('button')
      .map((button) => button.textContent || button.ariaLabel);
    expect(names).toEqual(['Game control', 'Settings']);
  });
});
