'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Loader2, LogOut, Settings, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Link, useRouter } from '@/i18n/navigation';
import { useSession } from '@/hooks/use-session';
import { signOut } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function AccountMenu() {
  const t = useTranslations('Dashboard');
  const errors = useTranslations('BoardSwitcher');
  const { user } = useSession();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function leave() {
    setSigningOut(true);
    try {
      const result = await signOut();
      if (result.error) throw new Error('Sign out failed');
      router.push('/');
      router.refresh();
    } catch {
      toast.error(errors('signOutError'));
      setSigningOut(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-11 shrink-0 rounded-full touch-manipulation"
          aria-label={t('userMenu.openMenuAriaLabel')}
        >
          {user?.image ? (
            <Image
              src={user.image}
              alt=""
              width={32}
              height={32}
              unoptimized
              referrerPolicy="no-referrer"
              className="size-8 rounded-full object-cover"
            />
          ) : (
            <User className="size-5" aria-hidden="true" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-64 max-w-[calc(100vw-2rem)] rounded-xl p-2 motion-reduce:animate-none"
      >
        {user && (
          <>
            <div className="px-2 py-2">
              <p className="truncate text-sm font-medium">{user.name || t('userFallbackName')}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        <DropdownMenuItem asChild className="min-h-11 touch-manipulation">
          <Link href="/account">
            <Settings aria-hidden="true" />
            {t('userMenu.accountSettings')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={signingOut}
          className="min-h-11 touch-manipulation"
          onSelect={(event) => {
            event.preventDefault();
            void leave();
          }}
        >
          {signingOut ? (
            <Loader2 className="animate-spin motion-reduce:animate-none" aria-hidden="true" />
          ) : (
            <LogOut aria-hidden="true" />
          )}
          {t('userMenu.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
