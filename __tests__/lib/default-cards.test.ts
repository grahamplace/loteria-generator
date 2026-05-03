import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_CARDS, DEFAULT_CARDS_BY_ID } from '@/lib/default-cards';

describe('DEFAULT_CARDS manifest', () => {
  it('has at least one entry', () => {
    expect(DEFAULT_CARDS.length).toBeGreaterThan(0);
  });

  it('has unique kebab-case ids', () => {
    const ids = DEFAULT_CARDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(id).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });

  it('every src points to an existing file in public/default-cards/', () => {
    for (const card of DEFAULT_CARDS) {
      expect(card.src).toMatch(/^\/default-cards\/[a-z0-9-]+\.webp$/);
      const filename = card.src.replace(/^\//, '');
      const fsPath = join(
        process.cwd(),
        'public',
        filename.replace('default-cards/', 'default-cards/')
      );
      expect(existsSync(fsPath), `missing asset for ${card.id} at ${fsPath}`).toBe(true);
    }
  });

  it('DEFAULT_CARDS_BY_ID resolves every entry', () => {
    for (const card of DEFAULT_CARDS) {
      expect(DEFAULT_CARDS_BY_ID[card.id]).toBe(card);
    }
  });
});
