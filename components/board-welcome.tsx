'use client';

import { ArrowRight, Unlock } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { HeroCard } from '@/components/hero-card';
import { heroCards } from '@/lib/hero-cards';
import { BOARD_UNLOCK_PRICE_DISPLAY } from '@/lib/constants';
import { ANCHOR_GET_STARTED } from '@/components/onboarding/onboarding-steps';

interface BoardWelcomeProps {
  onContinue: () => void;
  onUnlock: () => void;
}

const fannedCardIds = ['la-boda', 'la-quinceanera', 'la-familia', 'el-cumpleanos'];
const fannedRotations = ['-rotate-[12deg]', '-rotate-[4deg]', 'rotate-[4deg]', 'rotate-[12deg]'];
const fannedOffsets = ['translate-y-0', '-translate-y-3', '-translate-y-3', 'translate-y-0'];

export function BoardWelcome({ onContinue, onUnlock }: BoardWelcomeProps) {
  const t = useTranslations('BoardEditor.Welcome');

  return (
    <div className="flex-1 flex items-center justify-center px-6 py-10">
      <div className="text-center max-w-2xl mx-auto">
        <div
          className="mb-8 flex items-center justify-center scale-[0.7] sm:scale-[0.85] md:scale-[0.9]"
          style={{ perspective: '1000px' }}
          aria-hidden="true"
        >
          {fannedCardIds.map((id, i) => {
            const card = heroCards.find((c) => c.id === id);
            if (!card) return null;
            return (
              <div
                key={card.id}
                className={`flex-none -mx-6 ${fannedRotations[i]} ${fannedOffsets[i]}`}
              >
                <HeroCard card={card} duplicate />
              </div>
            );
          })}
        </div>

        <h1 className="font-display text-[clamp(26px,3.6vw,40px)] font-bold leading-[1.05] tracking-[-0.02em] text-foreground">
          {t('headlineLine1')}
          <br />
          {t('headlineLine2Prefix')}{' '}
          <span className="relative inline-block">
            <span
              aria-hidden="true"
              className="absolute inset-x-0 bottom-[0.05em] -z-0 h-[0.18em] -skew-x-6 bg-secondary"
            />
            <span className="relative">Lotería</span>
          </span>{' '}
          <span className="font-display italic font-medium">{t('headlineLine2Suffix')}</span>
        </h1>

        <p className="mt-5 max-w-[480px] mx-auto text-[15px] leading-[1.55] text-muted-foreground">
          {t('subtitle', { price: BOARD_UNLOCK_PRICE_DISPLAY })}
        </p>

        <div className="mt-7 flex flex-wrap justify-center gap-3.5">
          <Button
            id={ANCHOR_GET_STARTED}
            size="lg"
            onClick={onContinue}
            className="h-auto rounded-full px-7 py-[12px] text-[15px] font-semibold shadow-[0_8px_18px_-10px_rgba(230,57,70,0.7)] hover:-translate-y-[1px] hover:shadow-[0_12px_22px_-10px_rgba(230,57,70,0.8)]"
          >
            {t('startFree')}
            <ArrowRight className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={onUnlock}
            className="h-auto rounded-full border-[1.5px] border-foreground bg-transparent px-7 py-[12px] text-[15px] font-semibold text-foreground hover:bg-foreground hover:text-background"
          >
            <Unlock className="w-4 h-4" />
            {t('unlockFull', { price: BOARD_UNLOCK_PRICE_DISPLAY })}
          </Button>
        </div>

        <ul className="mt-5 flex flex-wrap justify-center gap-x-7 gap-y-2 font-jetbrains text-[12px] tracking-wider text-muted-foreground">
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
            {t('trustOneTime')}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
            {t('trustPerBoard')}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-accent" />
            {t('trustNoSubscription')}
          </li>
        </ul>
      </div>
    </div>
  );
}
