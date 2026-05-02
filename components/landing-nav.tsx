import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { LanguageSwitch } from '@/components/language-switch';

export function LandingNav() {
  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--color-rule-warm)] bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1240px] items-center justify-between px-6 py-4 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <Image src="/loteria-star.png" alt="" width={32} height={32} className="h-8 w-8" />
          <span className="font-display text-[19px] font-bold tracking-tight text-foreground">
            Lotería Generator
          </span>
        </Link>
        <div className="flex items-center gap-7">
          <Link
            href="/#how-it-works"
            className="hidden text-sm font-medium text-foreground hover:text-primary md:inline"
          >
            How it works
          </Link>
          <Link
            href="/#occasions"
            className="hidden text-sm font-medium text-foreground hover:text-primary md:inline"
          >
            Occasions
          </Link>
          <Link
            href="/#pricing"
            className="hidden text-sm font-medium text-foreground hover:text-primary md:inline"
          >
            Pricing
          </Link>
          <Link
            href="/faq"
            className="hidden text-sm font-medium text-foreground hover:text-primary md:inline"
          >
            FAQ
          </Link>
          <LanguageSwitch />
          <Link
            href="/sign-in"
            className="hidden text-sm font-medium text-foreground hover:text-primary sm:inline"
          >
            Sign in
          </Link>
          <Link href="/sign-up">
            <Button
              size="sm"
              className="h-auto rounded-full px-5 py-2.5 text-sm font-semibold shadow-[0_8px_18px_-10px_rgba(230,57,70,0.7)]"
            >
              Start free
            </Button>
          </Link>
        </div>
      </div>
    </nav>
  );
}
