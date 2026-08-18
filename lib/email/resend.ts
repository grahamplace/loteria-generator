// lib/email/resend.ts
import * as React from 'react';
import { Resend } from 'resend';

// The single chokepoint for sending mail through Resend. Cross-cutting email
// rules live here so individual flows never have to know about them — add an
// email flow anywhere and it inherits these automatically.

// Outside real production, redirect ALL outbound mail to Resend's test inbox so
// we can never email real users from local dev or a preview deploy.
// `delivered@resend.dev` is Resend's address that always reports delivered.
const NON_PROD_REDIRECT_TO = 'delivered@resend.dev';

let client: Resend | null = null;
function resendClient(): Resend {
  if (!client) client = new Resend(process.env.RESEND_API_KEY!);
  return client;
}

/**
 * "Real production" for email purposes. On Vercel, `VERCEL_ENV` distinguishes
 * production from preview; locally it's unset, so we fall back to `NODE_ENV`.
 * Anything that is not real production (next dev, preview deploys, tests) gets
 * its recipients redirected to the Resend test inbox.
 */
export function isProductionEmailEnv(): boolean {
  if (process.env.VERCEL_ENV) return process.env.VERCEL_ENV === 'production';
  return process.env.NODE_ENV === 'production';
}

export type SendEmailParams = {
  to: string | string[];
  subject: string;
  react: React.ReactElement;
  /** Defaults to `EMAIL_FROM`. */
  from?: string;
  /** Where replies go. Omit to let replies follow `from`. */
  replyTo?: string;
  headers?: Record<string, string>;
};

/**
 * Send an email through Resend. In non-production environments the recipient is
 * forced to `delivered@resend.dev` regardless of `to`. Throws on Resend error.
 */
export async function sendEmail(params: SendEmailParams): Promise<{ id: string | null }> {
  const to = isProductionEmailEnv() ? params.to : NON_PROD_REDIRECT_TO;

  const { data, error } = await resendClient().emails.send({
    from: params.from ?? process.env.EMAIL_FROM!,
    to,
    subject: params.subject,
    react: params.react,
    ...(params.replyTo ? { replyTo: params.replyTo } : {}),
    ...(params.headers ? { headers: params.headers } : {}),
  });

  if (error) {
    throw new Error(`Resend send failed: ${error.message}`);
  }
  return { id: data?.id ?? null };
}
