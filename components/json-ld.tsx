const siteUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://loteria-generator-eta.vercel.app';

interface FAQItem {
  question: string;
  answer: string;
}

export function WebsiteJsonLd() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'Lotería Generator',
    alternateName: ['Custom Lotería Cards', 'Lotería Card Maker'],
    url: siteUrl,
    description:
      'Create personalized Mexican Lotería cards from your photos. The easiest custom Lotería card maker for weddings, parties, and family events.',
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: `${siteUrl}/search?q={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function OrganizationJsonLd() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'Lotería Generator',
    url: siteUrl,
    logo: `${siteUrl}/icon.ico`,
    sameAs: [],
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'customer service',
      availableLanguage: ['English', 'Spanish'],
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function SoftwareApplicationJsonLd() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'Lotería Generator',
    applicationCategory: 'DesignApplication',
    operatingSystem: 'Web',
    offers: [
      {
        '@type': 'Offer',
        price: '0',
        priceCurrency: 'USD',
        name: 'Free Preview',
        description: 'Create up to 4 cards and 1 board for free',
      },
      {
        '@type': 'Offer',
        price: '5',
        priceCurrency: 'USD',
        name: 'Unlocked Board',
        description: 'Full access with up to 54 cards and unlimited card generations',
      },
    ],
    featureList: [
      'Photo to Lotería card conversion',
      'Traditional Mexican Lotería style illustrations',
      'Automatic Spanish label generation',
      'Printable board generation',
      'Custom card editing',
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function FAQJsonLd({ faqs }: { faqs: FAQItem[] }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((faq) => ({
      '@type': 'Question',
      name: faq.question,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.answer,
      },
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function BreadcrumbJsonLd({ items }: { items: { name: string; url: string }[] }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}

export function HowToJsonLd() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    name: 'How to Create Custom Lotería Cards',
    description:
      'Learn how to create personalized Mexican Lotería cards from your photos in just a few simple steps.',
    image: `${siteUrl}/opengraph-image`,
    totalTime: 'PT10M',
    estimatedCost: {
      '@type': 'MonetaryAmount',
      currency: 'USD',
      value: '0-5',
    },
    step: [
      {
        '@type': 'HowToStep',
        name: 'Sign Up',
        text: 'Create a free account to get started with your custom Lotería project.',
        url: `${siteUrl}/sign-up`,
      },
      {
        '@type': 'HowToStep',
        name: 'Upload Photos',
        text: 'Upload your favorite photos - people, pets, objects, or anything meaningful to you.',
      },
      {
        '@type': 'HowToStep',
        name: 'Lotería Transformation',
        text: 'We automatically transform each photo into a traditional Lotería-style illustration with a Spanish label.',
      },
      {
        '@type': 'HowToStep',
        name: 'Customize Cards',
        text: 'Edit labels and arrange your cards to your liking.',
      },
      {
        '@type': 'HowToStep',
        name: 'Generate Boards',
        text: 'Create randomized 4x4 bingo-style boards ready for printing and playing.',
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
