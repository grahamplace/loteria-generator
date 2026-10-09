'use client';

import { useId } from 'react';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Switch } from '@/components/ui/switch';
import type { PhotoMode } from '@/lib/themes/presets';

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
        className="h-6 w-10 cursor-pointer transition-colors motion-reduce:transition-none"
        thumbClassName="size-5 motion-reduce:transition-none"
      />
      <span>{t('illustrated')}</span>
      <span className="size-4" aria-hidden="true">
        {saving && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" />}
      </span>
    </label>
  );
}
