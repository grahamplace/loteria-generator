'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import { Check, Plus } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { DEFAULT_CARDS, type DefaultCard } from '@/lib/default-cards';

interface DefaultCardsPickerProps {
  open: boolean;
  onClose: () => void;
  onAdd: (ids: string[]) => void;
  alreadyAddedIds: Set<string>;
  remainingSlots: number;
  cardLimit: number;
}

export function DefaultCardsPicker({
  open,
  onClose,
  onAdd,
  alreadyAddedIds,
  remainingSlots,
  cardLimit,
}: DefaultCardsPickerProps) {
  const t = useTranslations('BoardEditor.DefaultCardsPicker');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const allAdded = useMemo(
    () => DEFAULT_CARDS.every((c) => alreadyAddedIds.has(c.id)),
    [alreadyAddedIds]
  );

  function toggle(id: string) {
    if (alreadyAddedIds.has(id)) return;
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        if (next.size >= remainingSlots) return prev;
        next.add(id);
      }
      return next;
    });
  }

  function handleAdd() {
    if (selected.size === 0) return;
    onAdd(Array.from(selected));
    setSelected(new Set());
    onClose();
  }

  function handleClose() {
    setSelected(new Set());
    onClose();
  }

  const overLimit = selected.size === remainingSlots && remainingSlots < DEFAULT_CARDS.length;

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : handleClose())}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="font-caveat text-2xl">{t('title')}</DialogTitle>
          <DialogDescription>{t('subtitle')}</DialogDescription>
        </DialogHeader>

        {allAdded ? (
          <div className="py-12 text-center text-muted-foreground">{t('empty')}</div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 max-h-[60vh] overflow-y-auto p-1">
            {DEFAULT_CARDS.map((card) => (
              <PickerCell
                key={card.id}
                card={card}
                added={alreadyAddedIds.has(card.id)}
                selected={selected.has(card.id)}
                disabledByLimit={
                  !selected.has(card.id) &&
                  !alreadyAddedIds.has(card.id) &&
                  selected.size >= remainingSlots
                }
                onToggle={() => toggle(card.id)}
              />
            ))}
          </div>
        )}

        {overLimit ? (
          <p className="text-xs text-muted-foreground" aria-live="polite">
            {t('cardLimitNote', { limit: cardLimit })}
          </p>
        ) : null}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={handleClose}>
            {t('cancel')}
          </Button>
          <Button onClick={handleAdd} disabled={selected.size === 0}>
            {t('addButton', { count: selected.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PickerCell({
  card,
  added,
  selected,
  disabledByLimit,
  onToggle,
}: {
  card: DefaultCard;
  added: boolean;
  selected: boolean;
  disabledByLimit: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('BoardEditor.DefaultCardsPicker');
  const interactive = !added && !disabledByLimit;
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!interactive}
      aria-pressed={selected}
      title={added ? t('alreadyAdded') : `${card.label} — ${card.labelEn}`}
      className={`group relative bg-[#f5f0e1] overflow-hidden border-2 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
        added
          ? 'border-black/20 opacity-50 cursor-not-allowed'
          : selected
            ? 'border-primary ring-2 ring-primary'
            : 'border-black/80 hover:border-primary cursor-pointer'
      } ${disabledByLimit && !selected ? 'opacity-40 cursor-not-allowed' : ''}`}
      style={{ borderRadius: '2px' }}
    >
      <div className="relative w-full aspect-[2/3] bg-muted overflow-hidden">
        <Image
          src={card.src}
          alt={card.label}
          fill
          sizes="(max-width: 640px) 30vw, 180px"
          className="object-cover pointer-events-none"
          draggable={false}
        />
        {added ? (
          <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
            <div className="bg-white rounded-full p-1.5 shadow">
              <Check className="w-4 h-4 text-emerald-600" aria-hidden="true" />
            </div>
          </div>
        ) : selected ? (
          <div className="absolute top-2 right-2 bg-primary text-white rounded-full w-7 h-7 flex items-center justify-center shadow">
            <Check className="w-4 h-4" aria-hidden="true" />
          </div>
        ) : (
          <div className="absolute top-2 right-2 bg-white/80 text-foreground rounded-full w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Plus className="w-4 h-4" aria-hidden="true" />
          </div>
        )}
      </div>
      <div className="p-2 bg-[#f5f0e1]">
        <p className="text-xs font-semibold text-center text-foreground line-clamp-1 uppercase tracking-wide">
          {card.label}
        </p>
      </div>
    </button>
  );
}
