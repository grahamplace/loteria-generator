import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FAQJsonLd, BreadcrumbJsonLd } from '@/components/json-ld';

export const metadata: Metadata = {
  title: 'FAQ - Custom Lotería Card Questions Answered',
  description:
    'Find answers to common questions about creating custom Lotería cards. Learn how it works, pricing, printing, and more.',
  keywords: [
    'loteria faq',
    'custom loteria questions',
    'how to play loteria',
    'loteria card maker help',
    'personalized loteria guide',
  ],
  alternates: { canonical: '/faq' },
  openGraph: {
    title: 'FAQ - Custom Lotería Card Questions Answered',
    description:
      'Find answers to common questions about creating custom Lotería cards with our generator.',
  },
};

const faqs = [
  {
    category: 'About Lotería',
    questions: [
      {
        question: 'What is Lotería?',
        answer:
          'Lotería is a traditional Mexican game of chance, often called "Mexican Bingo." It dates back to the 15th century and uses a deck of 54 cards with colorful illustrations. Players mark matching images on their boards (tablas) as a caller (cantor) draws and announces cards. The first to complete a pattern calls out "Lotería!" to win.',
      },
      {
        question: 'How do you play Lotería?',
        answer:
          'Each player gets a board (tabla) with a 4x4 grid of images. The caller draws cards from the deck and announces them, often using traditional rhymes or riddles. Players mark matching images on their boards using beans, chips, or coins. The first player to complete a winning pattern (full board, row, column, or diagonal) calls "Lotería!" to win.',
      },
      {
        question: 'What makes Lotería different from Bingo?',
        answer:
          'While similar to Bingo, Lotería uses images instead of numbers, making it more visual and culturally rich. Traditional Lotería cards feature iconic Mexican imagery like "La Luna" (The Moon), "El Sol" (The Sun), and "La Rosa" (The Rose). The caller often uses riddles and rhymes to announce cards, adding to the entertainment.',
      },
    ],
  },
  {
    category: 'Creating Custom Cards',
    questions: [
      {
        question: 'How do I create custom Lotería cards with my photos?',
        answer:
          'Simply sign up for a free account, create a new board, and upload your photos. We automatically transform each photo into a traditional Lotería-style illustration and generate an authentic Spanish label. You can edit labels, rearrange cards, and generate printable boards.',
      },
      {
        question: 'What types of photos work best?',
        answer:
          'Clear photos with good lighting work best. Photos of people, pets, objects, places, or anything meaningful to you can be transformed. The AI works with portraits, group shots, landscapes, and close-ups of objects. Avoid blurry or very dark images for best results.',
      },
      {
        question: 'Can I edit the Spanish labels on my cards?',
        answer:
          'Yes! While we generate authentic Spanish labels automatically, you can edit any label to customize it. Click the Edit button on any card to change its label to whatever you prefer.',
      },
      {
        question: 'How long does it take to process a photo?',
        answer:
          'Each photo typically takes 10-30 seconds to process. We transform the image into a Lotería-style illustration and generate an appropriate Spanish label. You can upload multiple photos and they will process in parallel.',
      },
    ],
  },
  {
    category: 'Pricing & Plans',
    questions: [
      {
        question: 'Is there a free option?',
        answer:
          'Yes! Our Free Preview lets you create up to 4 cards and generate one sample board at no cost. This lets you try the service before committing to a purchase.',
      },
      {
        question: 'How much does it cost to unlock a board?',
        answer:
          'Unlocking a board costs a one-time fee of $5. This gives you access to create up to 54 cards (a full traditional Lotería deck) and generate unlimited boards from those cards. There are no subscriptions or recurring fees.',
      },
      {
        question: 'What do I get when I unlock a board?',
        answer:
          'With an unlocked board you get: up to 54 custom cards (full Lotería deck), unlimited board generations, high-quality print exports, and no watermarks. Your unlock never expires.',
      },
      {
        question: 'Is there a subscription fee?',
        answer:
          "No subscriptions! We use a simple one-time payment model. Pay $5 once per board project and you have permanent access to that board's full features.",
      },
    ],
  },
  {
    category: 'Printing & Export',
    questions: [
      {
        question: 'What file formats can I export?',
        answer:
          'You can export your Lotería boards as high-quality PDF files, perfect for home printing or professional print services. Individual cards can also be downloaded as PNG images.',
      },
      {
        question: 'What paper size should I print on?',
        answer:
          'Our boards are optimized for standard letter size (8.5" x 11") paper. For best results, use cardstock (65-110 lb) for durability. You can also have them professionally printed at any print shop.',
      },
      {
        question: 'How many unique boards can I generate?',
        answer:
          'With an unlocked board, you can generate unlimited unique boards. Each board randomizes the placement of your cards, so every board is different. This is perfect for parties where each player needs a unique board.',
      },
    ],
  },
  {
    category: 'Use Cases',
    questions: [
      {
        question: 'Can I use this for my wedding?',
        answer:
          'Absolutely! Wedding Lotería is increasingly popular. Create cards featuring photos of the couple, wedding party, meaningful locations, and special moments. It makes for a memorable reception activity and a unique keepsake for guests.',
      },
      {
        question: 'Is this good for a quinceañera?',
        answer:
          'Yes! Quinceañera Lotería is a wonderful tradition. Feature the quinceañera, her court, family members, and special moments from her life. It adds a personal touch to the celebration.',
      },
      {
        question: 'Can I make Lotería cards for a family reunion?',
        answer:
          'Family reunion Lotería is one of our most popular use cases. Include photos of all family members, from grandparents to the youngest kids. It becomes a treasured keepsake that celebrates your family.',
      },
    ],
  },
];

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://loteria-generator-eta.vercel.app';

export default function FAQPage() {
  // Flatten FAQs for JSON-LD
  const allFaqs = faqs.flatMap((category) =>
    category.questions.map((q) => ({
      question: q.question,
      answer: q.answer,
    }))
  );

  return (
    <>
      <FAQJsonLd faqs={allFaqs} />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: siteUrl },
          { name: 'FAQ', url: `${siteUrl}/faq` },
        ]}
      />

      <main className="min-h-screen bg-gradient-to-b from-orange-50 to-white">
        {/* Navigation */}
        <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-sm border-b">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
            <Link href="/" className="text-xl font-bold text-primary">
              Lotería Generator
            </Link>
            <div className="flex items-center gap-4">
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

        {/* Hero */}
        <header className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <h1 className="text-4xl font-bold mb-4">Frequently Asked Questions</h1>
          <p className="text-xl text-muted-foreground">
            Everything you need to know about creating custom Lotería cards with our generator.
          </p>
        </header>

        {/* FAQ Content */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          {faqs.map((category, categoryIndex) => (
            <div key={categoryIndex} className="mb-12">
              <h2 className="text-2xl font-bold mb-6 text-primary">{category.category}</h2>
              <div className="space-y-6">
                {category.questions.map((faq, faqIndex) => (
                  <article key={faqIndex} className="bg-white rounded-lg p-6 shadow-sm border">
                    <h3 className="text-lg font-semibold mb-3">{faq.question}</h3>
                    <p className="text-muted-foreground leading-relaxed">{faq.answer}</p>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* CTA */}
        <section className="bg-primary/5 py-16 border-t">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Ready to Create Your Custom Lotería?</h2>
            <p className="text-muted-foreground mb-6">
              Start creating personalized Lotería cards for your next celebration.
            </p>
            <Link href="/sign-up">
              <Button size="lg">Create Your Lotería Cards Free</Button>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="bg-white border-t py-8">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-muted-foreground text-sm">
            <p>&copy; {new Date().getFullYear()} Lotería Generator. All rights reserved.</p>
          </div>
        </footer>
      </main>
    </>
  );
}
