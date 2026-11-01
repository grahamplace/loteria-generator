import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getTableColumns } from 'drizzle-orm';
import { cards } from '@/db/schema';

/**
 * insertCardsWithinLimit inserts with a positional SELECT (one expression per
 * cards column, in schema order). A new column without a matching expression
 * fails only against a real database, so count them here.
 */
describe('insertCardsWithinLimit positional insert', () => {
  it('has one SELECT expression per cards column', () => {
    const source = readFileSync(join(process.cwd(), 'lib/boards/add-cards.ts'), 'utf8');
    const select = source.match(/SELECT (gen_random_uuid\(\),[\s\S]*?)\n\s*FROM boards b/)![1];
    // Split on top-level commas only (COALESCE(…, 0) has one inside parens).
    let depth = 0;
    let count = 1;
    for (const ch of select) {
      if (ch === '(') depth++;
      else if (ch === ')') depth--;
      else if (ch === ',' && depth === 0) count++;
    }
    expect(count).toBe(Object.keys(getTableColumns(cards)).length);
  });
});
