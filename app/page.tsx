'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, Sparkles, Upload, Grid3x3, Star, Heart, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSession } from '@/hooks/use-session';
import {
  WebsiteJsonLd,
  OrganizationJsonLd,
  SoftwareApplicationJsonLd,
  FAQJsonLd,
  HowToJsonLd,
} from '@/components/json-ld';

const faqs = [
  {
    question: 'What is Loteria and how do you play it?',
    answer:
      'Loteria is a traditional Mexican game of chance, similar to bingo. Players use boards (tablas) with a 4x4 grid of images. A caller (cantor) draws cards and announces them, and players mark matching images on their boards. The first to complete a pattern wins!',
  },
  {
    question: 'How do I create custom Loteria cards with my own photos?',
    answer:
      'Simply upload your photos to our Loteria maker, and our AI will automatically transform each image into a traditional Loteria-style illustration with a Spanish label. You can then edit labels, arrange cards, and generate printable bingo boards.',
  },
  {
    question: 'Can I use this for my wedding or party?',
    answer:
      'Absolutely! Custom Loteria cards are perfect for weddings, quinceañeras, birthday parties, family reunions, and any special celebration. Create personalized cards featuring your guests, memorable moments, or themed images.',
  },
  {
    question: 'How many cards can I create?',
    answer:
      'With the free preview, you can create up to 16 cards and generate one sample board. By unlocking your board for $5, you get access to 54 cards (a full traditional Loteria deck) and unlimited board generations.',
  },
  {
    question: 'What file formats can I export?',
    answer:
      'You can export your Loteria boards as high-quality printable PDFs, perfect for home or professional printing. Individual cards can also be downloaded as images.',
  },
  {
    question: 'Is there a subscription or recurring fee?',
    answer:
      "No subscriptions! Our pricing is simple - try for free, and when you're ready, pay a one-time $5 fee to unlock your board. That purchase gives you permanent access to that project.",
  },
];

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useSession();

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!isLoading && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isLoading, router]);

  // Show nothing while checking auth to prevent flash
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-50 to-white">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Don't render landing page if authenticated (will redirect)
  if (isAuthenticated) {
    return null;
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
            <Link href="/" className="text-xl font-bold text-primary">
              Loteria Maker
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

        {/* Hero Section */}
        <header className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 md:py-24">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-foreground mb-6">
              Create Custom <span className="text-primary">Loteria</span> Cards
              <br />
              <span className="text-3xl md:text-5xl">from Your Photos</span>
            </h1>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              The easiest <strong>custom Loteria card maker</strong> powered by AI. Transform your
              photos into beautiful Mexican Loteria-style illustrations. Perfect for{' '}
              <strong>weddings</strong>, <strong>quinceañeras</strong>, <strong>parties</strong>,
              and <strong>family celebrations</strong>.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-8">
              <Link href="/sign-up">
                <Button size="lg" className="text-lg px-8 w-full sm:w-auto">
                  Create Your Loteria Cards Free
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button size="lg" variant="outline" className="text-lg px-8 w-full sm:w-auto">
                  See How It Works
                </Button>
              </Link>
            </div>
            <p className="text-sm text-muted-foreground">
              No credit card required. Start creating in seconds.
            </p>
          </div>
        </header>

        {/* Social Proof */}
        <section className="bg-white py-8 border-y">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 text-center">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-primary" />
                <span className="font-semibold">1,000+</span>
                <span className="text-muted-foreground">Boards Created</span>
              </div>
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                <span className="font-semibold">4.8/5</span>
                <span className="text-muted-foreground">User Rating</span>
              </div>
              <div className="flex items-center gap-2">
                <Heart className="w-5 h-5 text-red-500" />
                <span className="text-muted-foreground">Perfect for Celebrations</span>
              </div>
            </div>
          </div>
        </section>

        {/* Use Cases */}
        <section className="py-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center mb-4">
              Perfect for Every Special Occasion
            </h2>
            <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
              Create personalized Loteria cards that make your celebration truly unique and
              memorable.
            </p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  title: 'Wedding Loteria',
                  desc: 'Feature photos of the couple, wedding party, and special moments',
                },
                {
                  title: 'Quinceañera',
                  desc: 'Celebrate with cards featuring the quinceañera and her court',
                },
                {
                  title: 'Family Reunion',
                  desc: 'Include all family members for a game everyone will treasure',
                },
                {
                  title: 'Birthday Party',
                  desc: 'Create themed cards with the birthday person and their favorites',
                },
              ].map((useCase) => (
                <article
                  key={useCase.title}
                  className="bg-white rounded-xl p-6 shadow-sm border hover:shadow-md transition-shadow"
                >
                  <h3 className="font-semibold text-lg mb-2">{useCase.title}</h3>
                  <p className="text-muted-foreground text-sm">{useCase.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="bg-white py-16 border-y scroll-mt-16">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-center mb-4">
              How to Make Custom Loteria Cards
            </h2>
            <p className="text-center text-muted-foreground mb-12 max-w-2xl mx-auto">
              Our AI-powered Loteria maker transforms your photos into authentic Mexican Loteria
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
                  Our AI transforms each photo into a hand-drawn Loteria card style illustration and
                  generates an authentic Spanish label.
                </p>
              </article>
              <article className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Grid3x3 className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold mb-2">3. Generate & Print Boards</h3>
                <p className="text-muted-foreground">
                  Create randomized 4x4 bingo-style boards, each unique. Export high-quality PDFs
                  ready for printing at home or professionally.
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
                    <span>Up to 16 custom Loteria cards</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-5 h-5 text-green-600 flex-shrink-0" />
                    <span>1 board generation</span>
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
                <h3 className="text-xl font-semibold mb-2">Unlocked Board</h3>
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
                    <span>Unlimited board generations</span>
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
              Everything you need to know about creating custom Loteria cards.
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
            <h2 className="text-3xl font-bold mb-4">Ready to Create Your Custom Loteria?</h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
              Join thousands of people creating personalized Loteria cards for their special
              celebrations. Start free in seconds.
            </p>
            <Link href="/sign-up">
              <Button size="lg" className="text-lg px-8">
                Create Your Loteria Board Now
              </Button>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-white border-t py-12">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 mb-8">
              <div>
                <h4 className="font-semibold mb-4">Loteria Maker</h4>
                <p className="text-sm text-muted-foreground">
                  The easiest way to create custom Mexican Loteria cards from your photos using AI.
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
                  <li>Wedding Loteria</li>
                  <li>Quinceañera Games</li>
                  <li>Family Reunions</li>
                  <li>Birthday Parties</li>
                </ul>
              </div>
            </div>
            <div className="border-t pt-8 text-center text-muted-foreground text-sm">
              <p>&copy; {new Date().getFullYear()} Loteria Maker. All rights reserved.</p>
              <p className="mt-2">
                Create custom Loteria cards, personalized Mexican bingo, and Loteria boards for any
                celebration.
              </p>
            </div>
          </div>
        </footer>
      </main>
    </>
  );
}
