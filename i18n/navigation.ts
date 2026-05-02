// i18n/navigation.ts
// next-intl v4.x: hooks must be created from createNavigation(routing) — they
// are NOT exported directly from 'next-intl/navigation'.
import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
