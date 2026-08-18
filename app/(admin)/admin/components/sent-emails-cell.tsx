'use client';

import { MailCheck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { lifecycleEmailLabel } from '@/lib/email/lifecycle-labels';
import { cn } from '@/lib/utils';

export interface SentEmail {
  type: string;
  /** pending | sent | skipped | failed */
  status: string;
  /** ISO timestamp, null while the row is still pending. */
  sentAt: string | null;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

/** "sent Jul 23" for the happy path, "failed" / "skipped Jul 23" otherwise. */
function describeStatus(email: SentEmail): string {
  const date = formatDate(email.sentAt);
  if (email.status === 'sent') return date || 'sent';
  return date ? `${email.status} · ${date}` : email.status;
}

/**
 * The "Sent" column: every lifecycle email this user has received, not just the
 * campaign currently picked in the send dropdown.
 *
 * The icon tints when the user already has the selected campaign — that is the
 * signal for "this row will be skipped by the pending bulk send" — and the
 * tooltip repeats it in words so the cue is never colour-only.
 */
export function SentEmailsCell({
  emails,
  selectedTemplateKey,
}: {
  emails: SentEmail[];
  selectedTemplateKey?: string;
}) {
  if (emails.length === 0) {
    return <span className="sr-only">No emails sent</span>;
  }

  const hasSelected = Boolean(
    selectedTemplateKey && emails.some((e) => e.type === selectedTemplateKey)
  );

  const summary = `${emails.length} lifecycle email${emails.length === 1 ? '' : 's'} sent: ${emails
    .map((e) => `${lifecycleEmailLabel(e.type)} (${describeStatus(e)})`)
    .join(', ')}${hasSelected ? '. Includes the selected campaign.' : ''}`;

  return (
    <Tooltip delayDuration={300}>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={summary}
          style={{ touchAction: 'manipulation' }}
          className="mx-auto flex size-6 items-center justify-center gap-1 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          <MailCheck
            aria-hidden
            className={cn('size-4', hasSelected ? 'text-primary' : 'text-muted-foreground')}
          />
          {emails.length > 1 && (
            <span aria-hidden className="text-xs tabular-nums text-muted-foreground">
              {emails.length}
            </span>
          )}
        </button>
      </TooltipTrigger>
      <TooltipContent side="left" className="max-w-xs px-0 py-1">
        <ul className="text-xs">
          {emails.map((e) => (
            <li key={e.type} className="flex items-baseline justify-between gap-4 px-3 py-1">
              <span className={cn(e.type === selectedTemplateKey && 'font-semibold')}>
                {lifecycleEmailLabel(e.type)}
                {e.type === selectedTemplateKey && ' — selected'}
              </span>
              <span className="whitespace-nowrap tabular-nums opacity-70">{describeStatus(e)}</span>
            </li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
