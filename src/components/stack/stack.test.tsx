import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SplitKey } from './SplitKey';
import { splitKeyLabel } from './splitKeyLabel';
import { StackKeyboard } from './StackKeyboard';

/** The split keyboard (T-76: FR-109, A11Y-20, A11Y-8). */

describe('splitKeyLabel (A11Y-20)', () => {
  it('lists every board, like "A: board 1 present, board 2 absent, board 3 solved, board 4 absent"', () => {
    expect(splitKeyLabel('A', ['present', 'absent', null, 'absent'])).toBe(
      'A: board 1 present, board 2 absent, board 3 solved, board 4 absent',
    );
  });

  it('says correct, and unused for a letter not yet guessed', () => {
    expect(splitKeyLabel('Q', ['correct', undefined])).toBe('Q: board 1 correct, board 2 unused');
  });

  it('works for Duo', () => {
    expect(splitKeyLabel('E', ['absent', 'present'])).toBe('E: board 1 absent, board 2 present');
  });
});

describe('SplitKey', () => {
  /** The decorative segment container: the first span inside the button. */
  function segmentsOf(container: HTMLElement): Element[] {
    return [...(container.querySelector('button > span')?.children ?? [])];
  }

  it('is one button named for every board, and presses its letter', async () => {
    const user = userEvent.setup();
    const onPress = vi.fn();
    render(
      <SplitKey
        letter="A"
        segments={['present', 'absent', null, 'absent']}
        disabled={false}
        onPress={onPress}
      />,
    );

    await user.click(
      screen.getByRole('button', {
        name: 'A: board 1 present, board 2 absent, board 3 solved, board 4 absent',
      }),
    );

    expect(onPress).toHaveBeenCalledWith('A');
  });

  it('draws one segment per board: two for Duo, four for Quad', () => {
    const { container, rerender } = render(
      <SplitKey letter="A" segments={['absent', 'absent']} disabled={false} onPress={vi.fn()} />,
    );
    expect(segmentsOf(container)).toHaveLength(2);

    rerender(
      <SplitKey
        letter="A"
        segments={['absent', 'absent', 'absent', 'absent']}
        disabled={false}
        onPress={vi.fn()}
      />,
    );
    expect(segmentsOf(container)).toHaveLength(4);
  });

  it('colours each segment by its own board state and leaves a solved board blank', () => {
    const { container } = render(
      <SplitKey
        letter="A"
        segments={['correct', 'present', 'absent', null]}
        disabled={false}
        onPress={vi.fn()}
      />,
    );

    const classes = segmentsOf(container).map((el) => el.className);
    expect(classes[0]).toContain('bg-key-correct');
    expect(classes[1]).toContain('bg-key-present');
    expect(classes[2]).toContain('bg-key-absent');
    expect(classes[3]).toContain('bg-surface-sunken');
    expect(classes[3]).not.toContain('bg-key-');
  });

  it('shows an unused letter on the neutral key colour', () => {
    const { container } = render(
      <SplitKey letter="Z" segments={[undefined, undefined]} disabled={false} onPress={vi.fn()} />,
    );

    for (const segment of segmentsOf(container)) expect(segment.className).toContain('bg-key');
  });

  it('marks a correct and a present segment for the colourblind palette, never colour alone (A11Y-8)', () => {
    const { container } = render(
      <SplitKey
        letter="A"
        segments={['correct', 'present', 'absent', null]}
        disabled={false}
        onPress={vi.fn()}
      />,
    );

    const segments = segmentsOf(container);
    expect(segments[0]?.textContent).toBe('✓');
    expect(segments[1]?.textContent).toBe('◐');
    expect(segments[2]?.textContent).toBe('');
    // The glyphs are hidden until the colourblind palette is on.
    const glyph = segments[0]?.querySelector('span');
    expect(glyph?.className).toContain('opacity-0');
    expect(glyph?.className).toContain('in-data-[palette=cb]:opacity-100');
  });

  it('is disabled when asked to', () => {
    render(<SplitKey letter="A" segments={['absent', 'absent']} disabled onPress={vi.fn()} />);

    expect(screen.getByRole('button')).toBeDisabled();
  });
});

describe('StackKeyboard', () => {
  const none = new Map<string, 'correct' | 'present' | 'absent'>();

  it('has the Wordwright layout: 26 letters plus Enter and Backspace', () => {
    render(<StackKeyboard boardKeyStates={[none, none]} disabled={false} onKeyPress={vi.fn()} />);

    expect(screen.getAllByRole('button')).toHaveLength(28);
    expect(screen.getByRole('button', { name: 'Enter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Backspace' })).toBeInTheDocument();
  });

  it('names each letter key after every board state', () => {
    const boardOne = new Map([['A', 'present' as const]]);
    const boardTwo = new Map([['A', 'absent' as const]]);

    render(
      <StackKeyboard
        boardKeyStates={[boardOne, boardTwo, null, none]}
        disabled={false}
        onKeyPress={vi.fn()}
      />,
    );

    expect(
      screen.getByRole('button', {
        name: 'A: board 1 present, board 2 absent, board 3 solved, board 4 unused',
      }),
    ).toBeInTheDocument();
  });

  it('presses letters, Enter and Backspace through one handler', async () => {
    const user = userEvent.setup();
    const onKeyPress = vi.fn();
    render(
      <StackKeyboard boardKeyStates={[none, none]} disabled={false} onKeyPress={onKeyPress} />,
    );

    await user.click(screen.getByRole('button', { name: /^Q:/ }));
    await user.click(screen.getByRole('button', { name: 'Enter' }));
    await user.click(screen.getByRole('button', { name: 'Backspace' }));

    expect(onKeyPress).toHaveBeenNthCalledWith(1, 'Q');
    expect(onKeyPress).toHaveBeenNthCalledWith(2, 'ENTER');
    expect(onKeyPress).toHaveBeenNthCalledWith(3, 'BACKSPACE');
  });

  it('disables every key together', () => {
    render(<StackKeyboard boardKeyStates={[none, none]} disabled onKeyPress={vi.fn()} />);

    for (const key of screen.getAllByRole('button')) expect(key).toBeDisabled();
  });
});
