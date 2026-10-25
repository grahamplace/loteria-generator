import { describe, expect, it } from 'vitest';
import { cornerIconGroups, cornerIcons } from '@/lib/themes/corner-icons';
import en from '@/messages/en.json';
import esMX from '@/messages/es-MX.json';

describe('corner icon picker groups', () => {
  it('lists every icon except None in exactly one group', () => {
    const grouped = cornerIconGroups.flatMap((group) => group.icons);
    expect(new Set(grouped).size).toBe(grouped.length);
    expect([...grouped].sort()).toEqual(cornerIcons.filter((icon) => icon !== 'none').sort());
  });

  it.each([
    ['en', en],
    ['es-MX', esMX],
  ])('labels every group and icon in %s', (_, messages) => {
    const { corners, cornerGroups } = messages.Themes.Builder;
    for (const icon of cornerIcons) expect(corners).toHaveProperty([icon]);
    for (const group of cornerIconGroups) expect(cornerGroups).toHaveProperty([group.id]);
  });
});
