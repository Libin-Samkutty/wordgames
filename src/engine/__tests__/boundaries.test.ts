import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * Guards the engine's independence (ADR-003, T-17).
 *
 * ESLint enforces this too, but a test fails loudly in CI, in watch mode, and
 * for anyone who runs the suite without the linter. The engine's value is that
 * it can be tested in milliseconds and reused by a future non-React host; a
 * single stray `import { useState }` would quietly end that.
 */

const ENGINE_DIR = join(import.meta.dirname, '..');

/** Windows paths use backslashes; the checks below match on forward slashes. */
function toPosix(path: string): string {
  return path.split(sep).join('/');
}

/** Engine folders beyond the root: one per game (ARCHITECTURE §2). Add each as it lands. */
const GAME_ENGINE_DIRS = ['weaver', 'stack', 'range', 'code', 'shuffle', 'dodge', 'hunt'];

function engineSourceFiles(): readonly string[] {
  return [ENGINE_DIR, ...GAME_ENGINE_DIRS.map((dir) => join(ENGINE_DIR, dir))].flatMap((dir) =>
    readdirSync(dir)
      .filter((name) => name.endsWith('.ts'))
      .map((name) => join(dir, name)),
  );
}

describe('engine boundaries', () => {
  const files = engineSourceFiles();

  it('has source files to check', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it('covers the WordWeaver engine files too (NFR-16)', () => {
    const names = files.map(toPosix);

    for (const name of [
      'graph',
      'bfs',
      'generate',
      'validate',
      'evaluate',
      'reducer',
      'selectors',
    ]) {
      expect(names.some((file) => file.endsWith(`/weaver/${name}.ts`))).toBe(true);
    }
  });

  it.each(
    files.map((file): [string, string] => [toPosix(file).split('/engine/')[1] ?? file, file]),
  )('%s imports no framework, DOM, or storage module', (_name: string, file: string) => {
    const source = readFileSync(file, 'utf8');
    const imports = [...source.matchAll(/from\s+'([^']+)'/g)].map((match) => match[1] ?? '');

    const forbidden = imports.filter(
      (specifier) =>
        specifier === 'react' ||
        specifier === 'react-dom' ||
        specifier.startsWith('react/') ||
        specifier.startsWith('@/components') ||
        specifier.startsWith('@/hooks') ||
        specifier.startsWith('@/state') ||
        specifier.startsWith('@/storage') ||
        specifier.startsWith('@/dictionary'),
    );

    expect(forbidden).toEqual([]);
  });

  it.each(
    files.map((file): [string, string] => [toPosix(file).split('/engine/')[1] ?? file, file]),
  )('%s touches no browser global or ambient clock', (_name: string, file: string) => {
    const source = readFileSync(file, 'utf8');
    // Strip comments so prose about `Math.random` does not trip the check.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

    // `random.ts` is the single sanctioned wrapper around Math.random,
    // exposed as an injectable RandomSource (ADR-009).
    const isRandomModule = file.endsWith('random.ts');

    expect(code).not.toMatch(/\bwindow\./);
    expect(code).not.toMatch(/\bdocument\./);
    expect(code).not.toMatch(/\blocalStorage\b/);
    expect(code).not.toMatch(/\bsessionStorage\b/);
    expect(code).not.toMatch(/\bsetTimeout\b/);
    expect(code).not.toMatch(/\bsetInterval\b/);
    expect(code).not.toMatch(/\bDate\.now\b/);
    expect(code).not.toMatch(/\bfetch\(/);

    if (!isRandomModule) {
      expect(code).not.toMatch(/\bMath\.random\b/);
    }
  });

  it('confines Math.random to the injectable random source', () => {
    const offenders = files.filter(
      (file) => !file.endsWith('random.ts') && /\bMath\.random\b/.test(readFileSync(file, 'utf8')),
    );

    expect(offenders).toEqual([]);
  });
});
