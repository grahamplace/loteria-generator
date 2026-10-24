import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render } from '@testing-library/react';
import { PostHogIdentify } from '@/components/posthog-identify';

const { identify, getDistinctId, useSession } = vi.hoisted(() => ({
  identify: vi.fn(),
  getDistinctId: vi.fn(),
  useSession: vi.fn(),
}));

vi.mock('posthog-js', () => ({
  default: { identify, get_distinct_id: getDistinctId },
}));

vi.mock('@/hooks/use-session', () => ({ useSession }));

const user = { id: 'user-1', email: 'a@example.com', name: 'Ana' };

describe('PostHogIdentify', () => {
  beforeEach(() => {
    identify.mockReset();
    getDistinctId.mockReset();
    useSession.mockReset();
  });

  it('identifies a signed-in user still on an anonymous id (Google OAuth return)', () => {
    getDistinctId.mockReturnValue('anon-123');
    useSession.mockReturnValue({ user });
    render(<PostHogIdentify />);
    expect(identify).toHaveBeenCalledWith('user-1', { email: 'a@example.com', name: 'Ana' });
  });

  it('does nothing when already identified as that user', () => {
    getDistinctId.mockReturnValue('user-1');
    useSession.mockReturnValue({ user });
    render(<PostHogIdentify />);
    expect(identify).not.toHaveBeenCalled();
  });

  it('does nothing when signed out', () => {
    getDistinctId.mockReturnValue('anon-123');
    useSession.mockReturnValue({ user: null });
    render(<PostHogIdentify />);
    expect(identify).not.toHaveBeenCalled();
  });
});
