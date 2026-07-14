'use client';

import { useTranslations } from 'next-intl';
import type { CardComponentProps } from 'nextstepjs';
import { Button } from '@/components/ui/button';

/**
 * Branded coachmark card for the onboarding tours. Matches the Lotería theme
 * (warm surface, primary CTA) and pulls all control labels from next-intl.
 */
export function OnboardingCard({
  step,
  currentStep,
  totalSteps,
  nextStep,
  prevStep,
  skipTour,
  arrow,
}: CardComponentProps) {
  const t = useTranslations('Onboarding.controls');

  const isFirst = currentStep === 0;
  const isLast = currentStep === totalSteps - 1;

  return (
    <div className="relative max-w-[320px] rounded-2xl border border-black/10 bg-background p-5 shadow-[0_12px_32px_-12px_rgba(0,0,0,0.35)]">
      {arrow}

      {step.icon ? <div className="mb-2 text-2xl">{step.icon}</div> : null}

      <h2 className="font-display text-[17px] font-bold leading-tight tracking-tight text-foreground">
        {step.title}
      </h2>

      <div className="mt-1.5 text-[14px] leading-[1.5] text-muted-foreground">{step.content}</div>

      <div className="mt-4 flex items-center justify-between gap-3">
        {step.showSkip && skipTour ? (
          <button
            type="button"
            onClick={skipTour}
            className="text-[13px] font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
          >
            {t('skip')}
          </button>
        ) : (
          <span />
        )}

        <div className="flex items-center gap-2">
          {!isFirst && (
            <Button
              variant="outline"
              size="sm"
              onClick={prevStep}
              className="h-8 rounded-full px-3"
            >
              {t('back')}
            </Button>
          )}
          <Button size="sm" onClick={nextStep} className="h-8 rounded-full px-4 font-semibold">
            {isLast ? t('done') : t('next')}
          </Button>
        </div>
      </div>

      {totalSteps > 1 && (
        <p className="mt-3 text-center font-mono text-[11px] tracking-wider text-muted-foreground">
          {t('progress', { current: currentStep + 1, total: totalSteps })}
        </p>
      )}
    </div>
  );
}
