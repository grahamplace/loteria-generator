import { LandingNav } from '@/components/landing-nav';
import { LandingFooter } from '@/components/landing-footer';

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-background font-sans text-foreground">
      <LandingNav />
      {children}
      <LandingFooter />
    </main>
  );
}
