'use client';

import { useId } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Switch } from '@/components/ui/switch';
import type { PhotoMode } from '@/lib/themes/presets';
import styles from './photo-mode-switch.module.css';

export function PhotoModeSwitch({
  photoMode,
  saving = false,
  disabled = false,
  onChange,
}: {
  photoMode: PhotoMode;
  saving?: boolean;
  disabled?: boolean;
  onChange: (photoMode: PhotoMode) => void;
}) {
  const t = useTranslations('Themes.Builder');
  const id = useId();

  return (
    <div>
      <label
        htmlFor={id}
        className="flex min-h-11 w-fit cursor-pointer touch-manipulation items-center gap-3 text-sm has-[:disabled]:cursor-wait"
      >
        <Switch
          id={id}
          checked={photoMode === 'illustrated'}
          onCheckedChange={(checked) => onChange(checked ? 'illustrated' : 'original')}
          disabled={saving || disabled}
          aria-busy={saving}
          aria-describedby={`${id}-description`}
          className={`${styles.track} cursor-pointer transition-colors motion-reduce:transition-none`}
          thumbClassName={styles.thumb}
        />
        <span className="inline-flex items-center gap-2">
          <Sparkles className="size-4 shrink-0" aria-hidden="true" />
          {t('illustrated')}
        </span>
        <span className="size-4" aria-hidden="true">
          {saving && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
        </span>
      </label>
      <p id={`${id}-description`} className="text-sm text-muted-foreground" aria-live="polite">
        {t(photoMode === 'illustrated' ? 'illustratedDescription' : 'originalDescription')}
      </p>
    </div>
  );
}
