import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Check, Sparkles, Upload, Grid3x3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { auth } from '@/lib/auth';
import { LandingHero } from '@/components/landing-hero';
import { HeroCard } from '@/components/hero-card';
import { heroCards } from '@/lib/hero-cards';
import {
  WebsiteJsonLd,
  OrganizationJsonLd,
  SoftwareApplicationJsonLd,
  FAQJsonLd,
  HowToJsonLd,
} from '@/components/json-ld';

export const metadata = {
  alternates: {
    canonical: '/',
  },
};

const faqs = [
  {
    question: 'What is Lotería and how do you play it?',
    answer:
      'Lotería is a traditional Mexican game of chance, similar to bingo. Players use boards (tablas) with a 4x4 grid of images. A caller (cantor) draws cards and announces them, and players mark matching images on their boards. The first to complete a pattern wins!',
  },
  {
    question: 'How do I create a custom Lotería set with my own photos?',
    answer:
      'Upload your photos and our AI restyles each one into a traditional Lotería-style illustration with a Spanish label. You then arrange your cards, edit labels, and generate printable tablas (boards) so you have a complete Lotería set ready to play.',
  },
  {
    question: 'Can I use this for my wedding or party?',
    answer:
      'Absolutely! A custom Lotería set is perfect for weddings, quinceañeras, birthday parties, family reunions, and any special celebration. Personalize the cards with your guests, memorable moments, or themed photos &mdash; and print tablas for everyone at the party.',
  },
  {
    question: 'How many cards can I create?',
    answer:
      'With the free preview, you can create up to 4 cards and generate one sample board. By unlocking your board for $5, you get access to 54 cards (a full traditional Lotería deck) and unlimited board generations.',
  },
  {
    question: 'What file formats can I export?',
    answer:
      'You can export your Lotería boards as high-quality printable PDFs, perfect for home or professional printing. Individual cards can also be downloaded as images.',
  },
  {
    question: 'Is there a subscription or recurring fee?',
    answer:
      "No subscriptions! Our pricing is simple - try for free, and when you're ready, pay a one-time $5 fee to unlock your board. That purchase gives you permanent access to that project.",
  },
];

export default async function LandingPage() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session?.user) {
    redirect('/dashboard');
  }

  return (
    <>
      {/* Structured Data */}
      <WebsiteJsonLd />
      <OrganizationJsonLd />
      <SoftwareApplicationJsonLd />
      <FAQJsonLd faqs={faqs} />
      <HowToJsonLd />

      <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
        {/* Navigation */}
        <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-primary flex items-center gap-2">
              <Image src="/loteria-star.png" alt="" width={28} height={28} className="h-7 w-7" />
              Lotería Generator
            </Link>
            <div className="flex items-center gap-4">
              <Link
                href="#how-it-works"
                className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground"
              >
                How It Works
              </Link>
              <Link
                href="#pricing"
                className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground"
              >
                Pricing
              </Link>
              <Link
                href="#faq"
                className="hidden sm:inline text-sm text-muted-foreground hover:text-foreground"
              >
                FAQ
              </Link>
              <Link href="/sign-in">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/sign-up">
                <Button size="sm">Get Started</Button>
              </Link>
            </div>
          </div>
        </nav>

        <LandingHero />

        {/* Use Cases */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center mb-4">
              Perfect for Every Special Occasion
            </h2>
            <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
              Create a personalized Lotería set &mdash; cards and printable tablas &mdash; that
              makes your celebration truly unique and memorable.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  title: 'Wedding Lotería',
                  desc: 'Feature photos of the couple, wedding party, and special moments.',
                  cardId: 'la-boda',
                },
                {
                  title: 'Quinceañera',
                  desc: 'Celebrate with cards featuring the quinceañera and her court.',
                  cardId: 'la-quinceanera',
                },
                {
                  title: 'Family Reunion',
                  desc: 'Include all family members for a game everyone will treasure.',
                  cardId: 'la-familia',
                },
                {
                  title: 'Birthday Party',
                  desc: 'Themed cards with the birthday person, the cake, and their favorites.',
                  cardId: 'las-velitas',
                },
              ].map((useCase) => {
                const card = heroCards.find((c) => c.id === useCase.cardId);
                return (
                  <article
                    key={useCase.title}
                    className="bg-white rounded-xl p-6 pt-8 shadow-sm border hover:shadow-md transition-shadow flex flex-col items-center text-center"
                  >
                    {card && (
                      <div className="mb-5">
                        <HeroCard card={card} />
                      </div>
                    )}
                    <h3 className="font-semibold text-lg mb-2">{useCase.title}</h3>
                    <p className="text-muted-foreground text-sm">{useCase.desc}</p>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="bg-white py-16 border-y scroll-mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center mb-4">
              How to Make a Custom Lotería Set
            </h2>
            <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
              Our AI-powered Lotería generator transforms your photos into authentic Mexican Lotería
              cards in minutes.
            </p>
            <div className="grid md:grid-cols-3 gap-8">
              <article className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">1. Upload Your Photos</h3>
                <p className="text-muted-foreground">
                  Upload photos of people, pets, objects, or anything meaningful. Our system accepts
                  JPG, PNG, and other common formats.
                </p>
              </article>
              <article className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">2. AI Creates Illustrations</h3>
                <p className="text-muted-foreground">
                  Our AI transforms each photo into a hand-drawn Lotería card style illustration and
                  generates an authentic Spanish label.
                </p>
              </article>
              <article className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Grid3x3 className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">3. Generate &amp; Print Tablas</h3>
                <p className="text-muted-foreground">
                  Generate as many unique 4x4 tablas as you need &mdash; one per player. Export
                  high-quality PDFs ready for printing at home or professionally.
                </p>
              </article>
            </div>
            <div className="text-center mt-12">
              <Link href="/sign-up">
                <Button size="lg" className="text-lg px-8">
                  Start Creating Now
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-16 scroll-mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center mb-4">Simple, Transparent Pricing</h2>
            <p className="text-center text-muted-foreground mb-12 max-w-xl mx-auto">
              Try for free, then unlock when you&apos;re ready. No subscriptions - pay once per
              project.
            </p>

            <div className="grid md:grid-cols-2 gap-8 max-w-3xl mx-auto">
              {/* Free Tier */}
              <article className="bg-white rounded-2xl shadow-lg border p-8">
                <h3 className="text-xl font-semibold mb-2">Free Preview</h3>
                <p className="text-4xl font-bold mb-4">$0</p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>Up to 4 custom Lotería cards</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>1 printable tabla</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>AI-generated illustrations</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>Spanish label generation</span>
                  </li>
                </ul>
                <Link href="/sign-up">
                  <Button variant="outline" className="w-full">
                    Start Free
                  </Button>
                </Link>
              </article>

              {/* Unlocked */}
              <article className="bg-primary rounded-2xl shadow-lg p-8 text-white relative overflow-hidden">
                <div className="absolute top-4 right-4 bg-white/20 text-white text-xs px-2 py-1 rounded">
                  Most Popular
                </div>
                <h3 className="text-xl font-semibold mb-2">Unlocked Set</h3>
                <p className="text-4xl font-bold mb-4">
                  $5 <span className="text-lg font-normal">one-time</span>
                </p>
                <ul className="space-y-3 mb-8">
                  <li className="flex items-center gap-2">
                    <Check className="w-5 h-5 flex-shrink-0" />
                    <span>Up to 54 cards (full deck)</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-5 h-5 flex-shrink-0" />
                    <span>Unlimited printable tablas</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-5 h-5 flex-shrink-0" />
                    <span>High-quality print exports</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-5 h-5 flex-shrink-0" />
                    <span>No watermarks</span>
                  </li>
                </ul>
                <Link href="/sign-up">
                  <Button variant="secondary" className="w-full">
                    Get Started
                  </Button>
                </Link>
              </article>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="bg-white py-16 border-t scroll-mt-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center mb-4">Frequently Asked Questions</h2>
            <p className="text-center text-muted-foreground mb-12">
              Everything you need to know about creating a custom Lotería set.
            </p>
            <div className="space-y-6">
              {faqs.map((faq, index) => (
                <article key={index} className="border-b pb-6">
                  <h3 className="text-lg font-semibold mb-2">{faq.question}</h3>
                  <p className="text-muted-foreground">{faq.answer}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="bg-primary/5 py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl font-bold mb-4">Ready to Create Your Custom Lotería Set?</h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Join thousands of people creating personalized Lotería sets &mdash; cards and tablas
              &mdash; for their special celebrations. Start free in seconds.
            </p>
            <Link href="/sign-up">
              <Button size="lg" className="text-lg px-8">
                Create Your Lotería Set Now
              </Button>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-white border-t py-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
              <div>
                <h4 className="font-semibold mb-4">Lotería Generator</h4>
                <p className="text-sm text-muted-foreground">
                  The easiest way to create a custom Mexican Lotería set &mdash; cards and tablas
                  &mdash; from your photos using AI.
                </p>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Product</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <Link href="#how-it-works" className="hover:text-foreground">
                      How It Works
                    </Link>
                  </li>
                  <li>
                    <Link href="#pricing" className="hover:text-foreground">
                      Pricing
                    </Link>
                  </li>
                  <li>
                    <Link href="#faq" className="hover:text-foreground">
                      FAQ
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Get Started</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <Link href="/sign-up" className="hover:text-foreground">
                      Create Account
                    </Link>
                  </li>
                  <li>
                    <Link href="/sign-in" className="hover:text-foreground">
                      Sign In
                    </Link>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Use Cases</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>Wedding Lotería</li>
                  <li>Quinceañera Games</li>
                  <li>Family Reunions</li>
                  <li>Birthday Parties</li>
                </ul>
              </div>
            </div>
            <div className="border-t pt-8 text-center text-muted-foreground text-sm">
              <p>&copy; {new Date().getFullYear()} Lotería Generator. All rights reserved.</p>
              <p className="mt-2">
                Create custom Lotería sets &mdash; personalized cards and printable tablas &mdash;
                for any celebration.
              </p>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
