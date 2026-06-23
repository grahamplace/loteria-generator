// lib/email/guard.ts
export function lifecycleEmailsEnabled(): boolean {
  if (!process.env.RESEND_API_KEY) return false;
  return process.env.NODE_ENV === 'production' || process.env.LIFECYCLE_EMAILS_ENABLED === 'true';
}
