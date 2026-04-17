'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useRealtime } from 'inngest/react';
import { cardChannel, cardChannelTopics } from '@/lib/inngest/channels';
import { getCardRealtimeToken } from '@/app/actions/card-realtime';

interface CardStreamCallbacks {
  onLabel?: (label: string) => void;
  onIllustration?: (illustrationUrl: string) => void;
  onCompleted?: (data: { label: string; illustrationUrl: string }) => void;
  onError?: (message: string) => void;
}

/**
 * Subscribes to the Inngest Realtime channel for a card and fires callbacks
 * as status updates stream in from the background job.
 */
export function useCardStream(
  cardId: string | null,
  enabled: boolean,
  callbacks: CardStreamCallbacks
) {
  const channel = useMemo(() => (cardId ? cardChannel({ cardId }) : undefined), [cardId]);
  const tokenFactory = useMemo(
    () => (cardId ? () => getCardRealtimeToken(cardId) : undefined),
    [cardId]
  );

  const { messages } = useRealtime({
    channel,
    topics: cardChannelTopics,
    token: tokenFactory,
    enabled: enabled && Boolean(cardId),
  });

  const seen = useRef({ label: false, illustration: false, completed: false, error: false });

  useEffect(() => {
    if (!enabled) return;
    const label = messages.byTopic.label;
    if (label && !seen.current.label) {
      seen.current.label = true;
      callbacks.onLabel?.(label.data.label);
    }
    const illustration = messages.byTopic.illustration;
    if (illustration && !seen.current.illustration) {
      seen.current.illustration = true;
      callbacks.onIllustration?.(illustration.data.illustrationUrl);
    }
    const completed = messages.byTopic.completed;
    if (completed && !seen.current.completed) {
      seen.current.completed = true;
      callbacks.onCompleted?.(completed.data);
    }
    const error = messages.byTopic.error;
    if (error && !seen.current.error) {
      seen.current.error = true;
      callbacks.onError?.(error.data.message);
    }
  }, [messages, enabled, callbacks]);
}
