'use client';

import { useState } from 'react';
import { Unlock, CreditCard, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';

interface UnlockPromptProps {
  boardId: string;
  boardName: string;
  trigger: 'card_limit' | 'board_limit' | 'export';
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const UNLOCK_PRICE = '$5';

const features = [
  'Up to 54 cards per board',
  'Unlimited board generations',
  'Full print-quality exports',
  'No watermarks',
];

export function UnlockPrompt({
  boardId,
  boardName,
  trigger,
  open,
  onOpenChange,
}: UnlockPromptProps) {
  const [isLoading, setIsLoading] = useState(false);

  const triggerMessages = {
    card_limit: "You've reached the free tier limit of 16 cards.",
    board_limit: 'The free tier only allows 1 example board generation.',
    export: 'Full exports are available with an unlocked board.',
  };

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

      // Redirect to Stripe Checkout
      window.location.href = url;
    } catch (error) {
      console.error('Checkout error:', error);
      toast.error('Failed to start checkout. Please try again.');
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center mb-4">
            <Unlock className="h-6 w-6 text-orange-600" />
          </div>
          <DialogTitle className="text-center">Unlock &quot;{boardName}&quot;</DialogTitle>
          <DialogDescription className="text-center">
            {triggerMessages[trigger]} Unlock this board for full access.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="bg-muted rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="font-medium">Full Board Access</span>
              <span className="text-2xl font-bold">{UNLOCK_PRICE}</span>
            </div>
            <p className="text-sm text-muted-foreground mb-4">One-time payment for this board</p>
            <ul className="space-y-2">
              {features.map((feature) => (
                <li key={feature} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-600" />
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={handleUnlock} disabled={isLoading} className="w-full">
            <CreditCard className="h-4 w-4 mr-2" />
            {isLoading ? 'Redirecting...' : `Unlock for ${UNLOCK_PRICE}`}
          </Button>
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="w-full">
            Continue with Free Preview
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
