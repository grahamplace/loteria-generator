import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { CardMarquee } from '@/components/card-marquee';
import { heroCards } from '@/lib/hero-cards';

const featurePills = [
  {
    title: 'Ready in minutes',
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    title: 'Prints on letter paper',
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polyline points="6 9 6 2 18 2 18 9" />
        <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
        <rect x="6" y="14" width="12" height="8" />
      </svg>
    ),
  },
  {
    title: '$5 one-time, no subscription',
    icon: (
      <svg
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <polygon points="12 2 15 8 22 9 17 14 18 21 12 18 6 21 7 14 2 9 9 8 12 2" />
      </svg>
    ),
  },
];

export function LandingHero() {
  return (
    <header className="relative overflow-hidden bg-gradient-to-b from-orange-50 to-background pb-10 pt-12 md:pb-16 md:pt-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h1 className="mb-6 text-4xl font-bold text-foreground md:text-6xl">
            Create Your Custom <span className="text-primary">Lotería</span> Set
            <br />
            <span className="text-3xl md:text-5xl">from Your Photos</span>
          </h1>
          <p className="mx-auto mb-8 max-w-2xl text-xl text-muted-foreground">
            The easiest <strong>custom Lotería maker</strong> powered by AI. Turn your photos into a
            complete Mexican Lotería set &mdash; <strong>illustrated cards</strong>,{' '}
            <strong>printable tablas</strong>, and everything you need to play. Perfect for{' '}
            <strong>weddings</strong>, <strong>quinceañeras</strong>, <strong>parties</strong>, and{' '}
            <strong>family celebrations</strong>.
          </p>
          <div className="mb-6 flex flex-col justify-center gap-4 sm:flex-row">
            <Link href="/sign-up">
              <Button size="lg" className="w-full px-8 text-lg sm:w-auto">
                Create Your Lotería Set Free
              </Button>
            </Link>
            <Link href="#how-it-works">
              <Button size="lg" variant="outline" className="w-full px-8 text-lg sm:w-auto">
                See How It Works
              </Button>
            </Link>
          </div>
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {featurePills.map((p) => (
              <li key={p.title} className="inline-flex items-center gap-1.5">
                <span className="text-primary">{p.icon}</span>
                {p.title}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-10 md:mt-14">
        <CardMarquee cards={heroCards} />
      </div>
    </header>
  );
}
