import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock server-only dependencies that are imported by lib/admin
vi.mock('@/lib/auth', () => ({ auth: { api: { getSession: vi.fn() } } }));
vi.mock('next/headers', () => ({ headers: vi.fn() }));
vi.mock('next/navigation', () => ({ notFound: vi.fn() }));

import {
  isAdminEmail,
  ADMIN_EMAIL,
  requireAdmin,
  isRetriableCard,
  STUCK_PROCESSING_THRESHOLD_MS,
} from '@/lib/admin';
import { auth } from '@/lib/auth';
import { notFound } from 'next/navigation';

describe('isAdminEmail', () => {
  it('should return true for the admin email', () => {
    expect(isAdminEmail('graham@stonecutterlabs.com')).toBe(true);
  });

  it('should return false for other emails', () => {
    expect(isAdminEmail('user@example.com')).toBe(false);
  });

  it('should return false for null/undefined', () => {
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });

  it('should be case-insensitive', () => {
    expect(isAdminEmail('Graham@StonecutterLabs.com')).toBe(true);
  });

  it('should export the admin email constant', () => {
    expect(ADMIN_EMAIL).toBe('graham@stonecutterlabs.com');
  });
});

describe('requireAdmin', () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mockGetSession = vi.mocked(auth.api.getSession) as any;
  const mockNotFound = vi.mocked(notFound);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls notFound() when there is no session', async () => {
    mockGetSession.mockResolvedValue(null);
    await requireAdmin();
    expect(mockNotFound).toHaveBeenCalledOnce();
  });

  it('calls notFound() when the session user email is not the admin email', async () => {
    mockGetSession.mockResolvedValue({ user: { email: 'user@example.com' } });
    await requireAdmin();
    expect(mockNotFound).toHaveBeenCalledOnce();
  });

  it('returns the session when the email matches the admin email', async () => {
    const session = { user: { email: 'graham@stonecutterlabs.com' } };
    mockGetSession.mockResolvedValue(session);
    const result = await requireAdmin();
    expect(mockNotFound).not.toHaveBeenCalled();
    expect(result).toBe(session);
  });
});

describe('isRetriableCard', () => {
  const now = new Date('2026-05-01T12:00:00Z');

  it('treats error-status cards with an original image as retriable', () => {
    expect(
      isRetriableCard({ status: 'error', originalImageUrl: 'https://blob/x', updatedAt: now }, now)
    ).toBe(true);
  });

  it('skips error-status cards that have no original image (nothing to regenerate from)', () => {
    expect(isRetriableCard({ status: 'error', originalImageUrl: null, updatedAt: now }, now)).toBe(
      false
    );
  });

  it('treats processing cards older than the staleness threshold as retriable', () => {
    const stuckSince = new Date(now.getTime() - STUCK_PROCESSING_THRESHOLD_MS - 60_000);
    expect(
      isRetriableCard(
        { status: 'processing', originalImageUrl: 'https://blob/x', updatedAt: stuckSince },
        now
      )
    ).toBe(true);
  });

  it('does not retry processing cards that are still within the staleness window (likely just queued)', () => {
    const recentlyUpdated = new Date(now.getTime() - 60_000);
    expect(
      isRetriableCard(
        { status: 'processing', originalImageUrl: 'https://blob/x', updatedAt: recentlyUpdated },
        now
      )
    ).toBe(false);
  });

  it('does not retry pending or completed cards', () => {
    expect(
      isRetriableCard(
        { status: 'pending', originalImageUrl: 'https://blob/x', updatedAt: now },
        now
      )
    ).toBe(false);
    expect(
      isRetriableCard(
        { status: 'completed', originalImageUrl: 'https://blob/x', updatedAt: now },
        now
      )
    ).toBe(false);
  });
});
