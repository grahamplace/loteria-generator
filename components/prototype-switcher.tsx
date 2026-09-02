'use client';

/**
 * PROTOTYPE ONLY — floating variant switcher. Not production UI.
 * Renders nothing in production builds so a stray merge can't ship it.
 */
import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

export function PrototypeSwitcher({
  variants,
  current,
  names,
}: {
  variants: string[];
  current: string;
  names: Record<string, string>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const go = (delta: number) => {
    const i = variants.indexOf(current);
    const next = variants[(i + delta + variants.length) % variants.length];
    const params = new URLSearchParams(searchParams.toString());
    params.set('variant', next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement;
      if (
        el instanceof HTMLInputElement ||
        el instanceof HTMLTextAreaElement ||
        (el instanceof HTMLElement && el.isContentEditable)
      ) {
        return;
      }
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  if (process.env.NODE_ENV === 'production') return null;

  return (
    <div
      className="fixed bottom-3 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/20 bg-neutral-900 px-2 py-1.5 text-white shadow-lg"
      style={{ touchAction: 'manipulation' }}
    >
      <button
        onClick={() => go(-1)}
        aria-label="Previous variant"
        className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15"
      >
        ←
      </button>
      <span className="min-w-0 px-2 text-xs font-medium whitespace-nowrap">
        {current} · {names[current]}
      </span>
      <button
        onClick={() => go(1)}
        aria-label="Next variant"
        className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-white/15"
      >
        →
      </button>
    </div>
  );
}
