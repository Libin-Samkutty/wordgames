import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { usePhysicalKeyboard } from './usePhysicalKeyboard';

function Harness({ isRowEmpty }: { isRowEmpty: boolean }): React.JSX.Element {
  usePhysicalKeyboard({
    onLetter: vi.fn(),
    onBackspace: vi.fn(),
    onEnter: onEnterSpy,
    isRowEmpty: () => isRowEmpty,
    disabled: false,
  });

  return (
    <div>
      <a href="#/">All games</a>
      <button type="button">Settings</button>
    </div>
  );
}

const onEnterSpy = vi.fn();

describe('usePhysicalKeyboard Enter on a focused control (FR-10, A11Y-15)', () => {
  it('lets a focused link keep its own Enter when the row is empty', () => {
    onEnterSpy.mockClear();
    render(<Harness isRowEmpty />);

    const notPrevented = fireEvent.keyDown(screen.getByRole('link', { name: 'All games' }), {
      key: 'Enter',
    });

    expect(notPrevented).toBe(true);
    expect(onEnterSpy).not.toHaveBeenCalled();
  });

  it('lets a focused button keep its own Enter when the row is empty', () => {
    onEnterSpy.mockClear();
    render(<Harness isRowEmpty />);

    const notPrevented = fireEvent.keyDown(screen.getByRole('button', { name: 'Settings' }), {
      key: 'Enter',
    });

    expect(notPrevented).toBe(true);
    expect(onEnterSpy).not.toHaveBeenCalled();
  });

  it('still submits from a focused link once letters are on the board', () => {
    onEnterSpy.mockClear();
    render(<Harness isRowEmpty={false} />);

    fireEvent.keyDown(screen.getByRole('link', { name: 'All games' }), { key: 'Enter' });

    expect(onEnterSpy).toHaveBeenCalledOnce();
  });
});
