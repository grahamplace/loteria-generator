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

interface UnlockPromptProps {
  boardId: string;
  boardName: string;
  trigger: 'card_limit' | 'board_limit' | 'export';
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCardCount?: number;
  maxCards?: number;
}

const features = ['Up to 54 cards', 'Unlimited exports', 'No watermarks'];

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
          You&apos;ve reached the free limit
        </div>
        <div className="font-bold text-[22px] leading-tight tracking-tight">
          Keep building &mdash;{' '}
          <span className="font-caveat text-[32px] text-primary leading-none">
            {remainingCards} more cards
          </span>{' '}
          await
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
        {isLoading ? 'Redirecting\u2026' : 'Unlock'}
      </button>
      <button
        onClick={onDismiss}
        className="mt-1 w-full h-10 text-[12px] font-mono uppercase tracking-wider text-muted-foreground hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded"
      >
        Maybe later
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
  currentCardCount = 16,
  maxCards = 54,
}: UnlockPromptProps) {
  const [isLoading, setIsLoading] = useState(false);
  const isMobile = useIsMobile();

  const remainingCards = maxCards - currentCardCount;

  async function handleUnlock() {
    setIsLoading(true);

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
      toast.error('Failed to start checkout. Please try again.');
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
          <DrawerTitle className="sr-only">Unlock &quot;{boardName}&quot;</DrawerTitle>
          <DrawerDescription className="sr-only">
            Unlock this board for full access to all features.
          </DrawerDescription>
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
          <DialogTitle>Unlock &quot;{boardName}&quot;</DialogTitle>
          <DialogDescription>Unlock this board for full access to all features.</DialogDescription>
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
