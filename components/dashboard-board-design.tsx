'use client';

import Image from 'next/image';
import { useEffect, useRef, type CSSProperties } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  getTheme,
  boardBorderStyle,
  boardThemeVariables,
  type BoardStyleOptions,
} from '@/lib/themes/presets';
import { drawThemeFrame, resolveBoardStyle } from '@/lib/themes/render-style';
import { loadPrintFont } from '@/lib/themes/fonts';
import { BOARD_TITLE_BAND_PX, computeBoardLayout } from '@/lib/board-layout';
import { BoardThemeBadge } from '@/components/board-theme-badge';

export function DashboardBoardTheme({ styles }: { styles?: BoardStyleOptions | null }) {
  const t = useTranslations('Dashboard.boardCard');
  const themeT = useTranslations('Themes.Builder');
  const locale = useLocale() === 'es-MX' ? 'es-MX' : 'en';
  return (
    <BoardThemeBadge
      styles={styles}
      locale={locale}
      customLabel={themeT('custom')}
      themeLabel={t('theme')}
    />
  );
}

/** A small themed tabla using the existing, single cached photo montage. */
export function DashboardBoardThumbnail({
  boardId,
  boardName,
  updatedAt,
  cardCount,
  styles,
}: {
  boardId: string;
  boardName: string;
  updatedAt: Date;
  cardCount: number;
  styles?: BoardStyleOptions | null;
}) {
  const frame = useRef<HTMLCanvasElement>(null);
  const border = boardBorderStyle(styles);
  const framed = border !== 'hand-drawn' && border !== 'none';
  const layout = computeBoardLayout({
    width: 2550,
    height: 3300,
    hasFrame: framed,
    titleBandHeight: styles?.showTitle ? BOARD_TITLE_BAND_PX : 0,
  });
  const font = styles?.font ?? getTheme(styles?.presetId).font;
  useEffect(() => {
    const ctx = frame.current?.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, 510, 660);
    ctx.save();
    ctx.scale(0.2, 0.2);
    drawThemeFrame(ctx, 2550, 3300, resolveBoardStyle(styles ?? {}));
    ctx.restore();
  }, [styles]);
  useEffect(() => {
    if (styles?.showTitle) void loadPrintFont(font).catch(() => {});
  }, [font, styles?.showTitle]);

  const src = `/api/boards/${encodeURIComponent(boardId)}/preview?v=${encodeURIComponent(String(updatedAt))}`;
  return (
    <div
      aria-hidden="true"
      className="relative aspect-[17/22] w-full overflow-hidden rounded-sm bg-[var(--theme-paper)] shadow-sm ring-1 ring-foreground/10 [container-type:inline-size]"
      style={boardThemeVariables(styles) as CSSProperties}
    >
      <canvas ref={frame} width={510} height={660} className="absolute inset-0 size-full" />
      {layout.titleBand && (
        <div
          className="absolute flex items-center justify-center overflow-hidden text-[4.7cqw] text-[var(--theme-ink)]"
          style={{
            top: `${layout.titleBand.top / 33}%`,
            height: `${layout.titleBand.height / 33}%`,
            left: `${layout.offsetX / 25.5}%`,
            width: `${layout.gridWidth / 25.5}%`,
            fontFamily: 'var(--theme-font)',
          }}
        >
          <span className="truncate uppercase">{boardName}</span>
        </div>
      )}
      <div
        className="absolute grid grid-cols-4 grid-rows-4"
        style={{
          left: `${layout.offsetX / 25.5}%`,
          top: `${layout.offsetY / 33}%`,
          width: `${layout.gridWidth / 25.5}%`,
          height: `${layout.gridHeight / 33}%`,
          columnGap: `${(layout.cardSpacing / layout.gridWidth) * 100}%`,
          rowGap: `${(layout.cardSpacing / layout.gridHeight) * 100}%`,
        }}
      >
        {Array.from({ length: 16 }, (_, index) => (
          <div
            key={index}
            className="relative min-h-0 min-w-0 overflow-hidden bg-[color-mix(in_srgb,var(--theme-ink)_8%,var(--theme-paper))]"
            style={{
              borderColor: 'var(--theme-accent)',
              borderStyle: border === 'none' ? 'none' : border === 'dashed' ? 'dashed' : 'solid',
              borderWidth: index < cardCount ? 0.5 : 0,
            }}
          >
            {index < cardCount && (
              <Image
                src={src}
                alt=""
                width={492}
                height={732}
                unoptimized
                draggable={false}
                onError={(event) => {
                  event.currentTarget.style.opacity = '0';
                }}
                onLoad={(event) => {
                  event.currentTarget.style.opacity = '1';
                }}
                className="absolute max-w-none"
                style={{
                  // Each cell crops its photo from the same cached 4×4 image.
                  // Empty cells and gutters use the saved palette, not baked-in gray.
                  width: `${(492 / 120) * 100}%`,
                  height: `${(732 / 180) * 100}%`,
                  left: `${((-(index % 4) * 124) / 120) * 100}%`,
                  top: `${((-Math.floor(index / 4) * 184) / 180) * 100}%`,
                }}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
