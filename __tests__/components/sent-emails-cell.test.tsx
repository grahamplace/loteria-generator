import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SentEmailsCell, type SentEmail } from '@/app/(admin)/admin/components/sent-emails-cell';
import {
  LIFECYCLE_EMAIL_TYPE_SIGNUP_NUDGE,
  LIFECYCLE_EMAIL_TYPE_EMPTY_BOARD_NUDGE,
  LIFECYCLE_EMAIL_TYPE_REENGAGEMENT,
} from '@/lib/constants';

const sent = (type: string, extra: Partial<SentEmail> = {}): SentEmail => ({
  type,
  status: 'sent',
  sentAt: '2026-07-23T10:00:00.000Z',
  ...extra,
});

describe('SentEmailsCell', () => {
  it('renders nothing visible when the user has received no email', () => {
    render(<SentEmailsCell emails={[]} selectedTemplateKey="reengagement" />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the icon for a cron email that is not a campaign template', () => {
    render(<SentEmailsCell emails={[sent(LIFECYCLE_EMAIL_TYPE_EMPTY_BOARD_NUDGE)]} />);
    expect(screen.getByRole('button').getAttribute('aria-label')).toContain('Board but no cards');
  });

  it('names every email sent, not just the selected campaign', () => {
    render(
      <SentEmailsCell
        emails={[
          sent(LIFECYCLE_EMAIL_TYPE_REENGAGEMENT),
          sent(LIFECYCLE_EMAIL_TYPE_SIGNUP_NUDGE),
          sent(LIFECYCLE_EMAIL_TYPE_EMPTY_BOARD_NUDGE),
        ]}
        selectedTemplateKey={LIFECYCLE_EMAIL_TYPE_REENGAGEMENT}
      />
    );
    const label = screen.getByRole('button').getAttribute('aria-label') ?? '';
    expect(label).toContain('Re-engagement');
    expect(label).toContain('Signup nudge');
    expect(label).toContain('Board but no cards');
    expect(label).toContain('3 lifecycle emails');
  });

  it('shows the count only when more than one email was sent', () => {
    const { rerender } = render(<SentEmailsCell emails={[sent('signup_nudge')]} />);
    expect(screen.getByRole('button').textContent).toBe('');

    rerender(<SentEmailsCell emails={[sent('signup_nudge'), sent('reengagement')]} />);
    expect(screen.getByRole('button').textContent).toBe('2');
  });

  it('says in words — not only in colour — that the selected campaign was sent', () => {
    render(
      <SentEmailsCell
        emails={[sent(LIFECYCLE_EMAIL_TYPE_REENGAGEMENT)]}
        selectedTemplateKey={LIFECYCLE_EMAIL_TYPE_REENGAGEMENT}
      />
    );
    expect(screen.getByRole('button').getAttribute('aria-label')).toContain(
      'Includes the selected campaign'
    );
  });

  it('surfaces a failed send rather than reporting it as sent', () => {
    render(<SentEmailsCell emails={[sent('signup_nudge', { status: 'failed', sentAt: null })]} />);
    expect(screen.getByRole('button').getAttribute('aria-label')).toContain('failed');
  });
});
