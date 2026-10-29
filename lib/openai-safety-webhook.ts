// OpenAI safety enforcement notices for a user's safety_identifier.
// https://developers.openai.com/api/docs/guides/safety-enforcement
//
// The webhook payload carries only a case ID; the case lookup (a restricted
// key with Safety: Read) names the identifier, which is our user ID.
import * as React from 'react';
import { ADMIN_EMAIL } from '@/lib/admin';
import { sendEmail } from '@/lib/email/resend';
import { markOpenAIBlocked } from '@/lib/openai-blocked';

export const SAFETY_EVENT_TYPES = ['safety.warning_issued', 'safety.deactivation_issued'] as const;
type SafetyEventType = (typeof SAFETY_EVENT_TYPES)[number];

export function isSafetyEvent(type: unknown): type is SafetyEventType {
  return SAFETY_EVENT_TYPES.includes(type as SafetyEventType);
}

type SafetyCase = { entity_identifier?: string; reason?: string };

async function fetchSafetyCase(caseId: string): Promise<SafetyCase> {
  const res = await fetch(`https://api.openai.com/v1/safety/cases/${encodeURIComponent(caseId)}`, {
    headers: { Authorization: `Bearer ${process.env.OPENAI_SAFETY_API_KEY}` },
  });
  if (!res.ok) throw new Error(`safety case lookup failed: ${res.status}`);
  return (await res.json()) as SafetyCase;
}

export async function handleSafetyEvent(type: SafetyEventType, caseId: string): Promise<void> {
  const safetyCase = await fetchSafetyCase(caseId);
  const userId = safetyCase.entity_identifier;
  const deactivated = type === 'safety.deactivation_issued';

  if (userId && deactivated) {
    // An identifier that is not one of our users (deleted account) still
    // deserves the email, and must not make OpenAI redeliver forever.
    await markOpenAIBlocked(userId).catch((error) =>
      console.error('OpenAI safety webhook: could not mark user blocked', { userId, error })
    );
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3006';
  const lines = [
    `OpenAI ${deactivated ? 'deactivated' : 'warned'} a user.`,
    `User: ${userId ? `${appUrl}/admin/users/${userId}` : 'unknown'}`,
    `Reason: ${safetyCase.reason ?? 'not given'}`,
    `Case: ${caseId}`,
  ];
  console.warn('OpenAI safety notice', { type, caseId, userId, reason: safetyCase.reason });
  await sendEmail({
    to: ADMIN_EMAIL,
    subject: `OpenAI safety ${deactivated ? 'deactivation' : 'warning'} for a user`,
    react: React.createElement(
      'div',
      null,
      lines.map((line) => React.createElement('p', { key: line }, line))
    ),
  });
}
