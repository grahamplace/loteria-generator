'use client';

import { useState } from 'react';

type Faq = { question: string; answer: string };

export function LandingFaq({ faqs }: { faqs: Faq[] }) {
  return (
    <div className="mt-14 grid grid-cols-1 gap-x-12 gap-y-2 md:grid-cols-2">
      {faqs.map((faq, i) => (
        <FaqItem key={i} {...faq} />
      ))}
    </div>
  );
}

function FaqItem({ question, answer }: Faq) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen((v) => !v)}
      aria-expanded={open}
      className="flex w-full flex-col items-stretch rounded-md border-b border-[var(--color-rule-warm)] px-4 py-6 text-left transition-colors hover:bg-black/[0.03] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
    >
      <span className="flex items-start justify-between gap-4">
        <span className="font-display text-[17px] font-semibold leading-snug text-foreground">
          {question}
        </span>
        <span
          aria-hidden="true"
          className="font-jetbrains text-[18px] font-medium leading-none text-primary"
        >
          {open ? '−' : '+'}
        </span>
      </span>
      {open && (
        <span className="mt-3 block text-[14.5px] leading-relaxed text-muted-foreground">
          {answer}
        </span>
      )}
    </button>
  );
}
