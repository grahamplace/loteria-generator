'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, User, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/hooks/use-session';
import { useBoards } from '@/hooks/use-boards';
import { signOut } from '@/lib/auth-client';
import { LanguageSwitch } from '@/components/language-switch';

export default function AccountPage() {
  const router = useRouter();
  const { user, isLoading: sessionLoading } = useSession();
  const { boards, isLoading: boardsLoading } = useBoards();
  const t = useTranslations('Account');

  async function handleSignOut() {
    await signOut();
    router.push('/');
  }

  const isLoading = sessionLoading || boardsLoading;

  const unlockedBoards = boards.filter((b) => b.isUnlocked);
  const totalCards = boards.reduce((sum, b) => sum + b.cardCount, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
        <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Skeleton className="h-8 w-32" />
            <LanguageSwitch />
          </div>
        </header>
        <main className="container mx-auto px-4 py-8">
          <Skeleton className="h-48 w-full max-w-md" />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <h1 className="text-xl font-bold">{t('pageTitle')}</h1>
          </div>
          <LanguageSwitch />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="space-y-6">
          {/* Profile Info */}
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.title')}</CardTitle>
              <CardDescription>{t('profile.description')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  {user?.image ? (
                    <Image
                      src={user.image}
                      alt={user.name || t('profile.imageAlt')}
                      width={64}
                      height={64}
                      className="w-16 h-16 rounded-full object-cover"
                    />
                  ) : (
                    <User className="w-8 h-8 text-primary" />
                  )}
                </div>
                <div>
                  <p className="font-semibold text-lg">{user?.name || t('profile.userFallback')}</p>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Mail className="w-4 h-4" />
                    {user?.email}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Usage Stats */}
          <Card>
            <CardHeader>
              <CardTitle>{t('usage.title')}</CardTitle>
              <CardDescription>{t('usage.description')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{boards.length}</p>
                  <p className="text-sm text-muted-foreground">{t('usage.totalBoards')}</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{unlockedBoards.length}</p>
                  <p className="text-sm text-muted-foreground">{t('usage.unlocked')}</p>
                </div>
                <div className="text-center p-4 bg-muted rounded-lg">
                  <p className="text-2xl font-bold">{totalCards}</p>
                  <p className="text-sm text-muted-foreground">{t('usage.cardsCreated')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Purchases */}
          {unlockedBoards.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t('purchases.title')}</CardTitle>
                <CardDescription>{t('purchases.description')}</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2">
                  {unlockedBoards.map((board) => (
                    <li
                      key={board.id}
                      className="flex items-center justify-between p-3 bg-muted rounded-lg"
                    >
                      <span className="font-medium">{board.name}</span>
                      <span className="text-sm text-muted-foreground">
                        {t('purchases.cardCount', { count: board.cardCount })}
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Sign Out */}
          <Card>
            <CardContent className="pt-6">
              <Button
                variant="outline"
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={handleSignOut}
              >
                {t('signOut')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
