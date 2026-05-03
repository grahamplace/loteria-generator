'use client';

import { useState } from 'react';
import { Unlock, Check, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { toast } from 'sonner';
import posthog from 'posthog-js';
import { useTranslations } from 'next-intl';
import { FREE_CARD_LIMIT, TOTAL_CARD_COUNT } from '@/lib/constants';

interface UnlockPromptProps {
  boardId: string;
  boardName: string;
  trigger: 'card_limit' | 'board_limit' | 'export';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function UnlockContent({
  boardName,
  isLoading,
  onUnlock,
  onDismiss,
  remainingCards,
}: {
  boardName: string;
  isLoading: boolean;
  onUnlock: () => void;
  onDismiss: () => void;
  remainingCards: number;
}) {
  const t = useTranslations('BoardEditor.UnlockPrompt');

  const features = [t('featureCards'), t('featureExports'), t('featureWatermarks')];

  return (
    <div className="px-6 pt-3 pb-1">
      {/* Lock badge + $5 chip */}
      <div className="flex justify-center mb-3">
        <div className="relative">
          <div className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-lg">
            <Unlock className="w-6 h-6" />
          </div>
          <div className="absolute -top-1 -right-1 w-7 h-7 rounded-full bg-secondary text-foreground flex items-center justify-center text-[12px] font-bold shadow">
            $5
          </div>
        </div>
      </div>

      <div className="text-center">
        <div className="text-[10px] font-mono uppercase tracking-wider text-primary mb-1">
          {t('freeLimitReached')}
        </div>
        <div className="font-bold text-[22px] leading-tight tracking-tight">
          {t('keepBuildingPrefix')}{' '}
          <span className="font-caveat text-[32px] text-primary leading-none">
            {t('moreCards', { count: remainingCards })}
          </span>{' '}
          {t('keepBuildingSuffix')}
        </div>
      </div>

      {/* Feature list */}
      <div className="mt-5 flex flex-col gap-2">
        {features.map((feature) => (
          <div
            key={feature}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/60 border border-border/60"
          >
            <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Check className="w-3 h-3" />
            </div>
            <div className="text-[13px] font-semibold text-foreground">{feature}</div>
          </div>
        ))}
      </div>

      <button
        onClick={onUnlock}
        disabled={isLoading}
        className="mt-5 w-full h-12 rounded-xl bg-primary text-white text-[15px] font-semibold flex items-center justify-center gap-2 shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-70 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <Unlock className="w-4 h-4" />
        {isLoading ? t('redirectingButton') : t('unlockButton')}
      </button>
      <button
        onClick={onDismiss}
        className="mt-1 w-full h-10 text-[12px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
      >
        {t('maybeLater')}
      </button>
    </div>
  );
}

export function UnlockPrompt({
  boardId,
  boardName,
  trigger,
  open,
  onOpenChange,
}: UnlockPromptProps) {
  const t = useTranslations('BoardEditor.UnlockPrompt');
  const [isLoading, setIsLoading] = useState(false);
  const isMobile = useIsMobile();

  const remainingCards = TOTAL_CARD_COUNT - FREE_CARD_LIMIT;

  async function handleUnlock() {
    setIsLoading(true);
    posthog.capture('checkout_initiated', { board_id: boardId, trigger });

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ boardId }),
      });

      if (!response.ok) {
        throw new Error('Failed to create checkout session');
      }

      const { url } = await response.json();
      window.location.href = url;
    } catch (error) {
      console.error('Checkout error:', error);
      posthog.captureException(error);
      toast.error(t('toasts.checkoutFailed'));
      setIsLoading(false);
    }
  }

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent
          className="rounded-t-[28px] border-t-0"
          style={{ background: 'linear-gradient(180deg, #faf5e6 0%, #f2e6c8 100%)' }}
        >
          <DrawerTitle className="sr-only">
            {t('drawerTitleSrOnly', { name: boardName })}
          </DrawerTitle>
          <DrawerDescription className="sr-only">{t('drawerDescSrOnly')}</DrawerDescription>
          <DrawerClose className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/5 flex items-center justify-center text-foreground/70 z-10">
            <X className="w-4 h-4" />
          </DrawerClose>
          <UnlockContent
            boardName={boardName}
            isLoading={isLoading}
            onUnlock={handleUnlock}
            onDismiss={() => onOpenChange(false)}
            remainingCards={remainingCards}
          />
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md border-0"
        style={{ background: 'linear-gradient(180deg, #faf5e6 0%, #f2e6c8 100%)' }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>{t('dialogTitleSrOnly', { name: boardName })}</DialogTitle>
          <DialogDescription>{t('dialogDescSrOnly')}</DialogDescription>
        </DialogHeader>
        <UnlockContent
          boardName={boardName}
          isLoading={isLoading}
          onUnlock={handleUnlock}
          onDismiss={() => onOpenChange(false)}
          remainingCards={remainingCards}
        />
      </DialogContent>
    </Dialog>
  );
}
