'use client';

import { useTheme } from 'next-themes';
import { usePathname } from 'next/navigation';
import { Toaster as Sonner, ToasterProps } from 'sonner';

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = 'system' } = useTheme();
  const pathname = usePathname();
  const isBoardEditor = /^\/(?:es\/|en\/|es-MX\/)?boards\/[^/]+/.test(pathname ?? '');

  return (
    <Sonner
      theme={theme as ToasterProps['theme']}
      position={isBoardEditor ? 'top-center' : 'bottom-right'}
      className="toaster group"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
