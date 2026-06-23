import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
}));

vi.mock('@/lib/admin', () => ({
  isAdminEmail: vi.fn(),
}));

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));

const sendMock = vi.fn();

vi.mock('@/lib/inngest/client', () => ({
  inngest: { send: (...args: unknown[]) => sendMock(...args) },
}));

import { auth } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin';
import { POST } from '@/app/api/admin/users/send-reengagement/route';

const ADMIN_SESSION = { user: { email: 'graham@stonecutterlabs.com', id: 'admin-1' } };
const NON_ADMIN_SESSION = { user: { email: 'someone@example.com', id: 'user-1' } };

function makeReq(body: unknown) {
  return new Request('http://localhost/api/admin/users/send-reengagement', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('POST /api/admin/users/send-reengagement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth.api.getSession).mockResolvedValue(ADMIN_SESSION as any);
    vi.mocked(isAdminEmail).mockImplementation((email) => email === 'graham@stonecutterlabs.com');
    sendMock.mockResolvedValue(undefined);
  });

  it('returns 404 when there is no session', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(null);
    const res = await POST(makeReq({ userIds: ['u1'] }));
    expect(res.status).toBe(404);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('returns 404 when caller is not admin', async () => {
    vi.mocked(auth.api.getSession).mockResolvedValue(NON_ADMIN_SESSION as any);
    vi.mocked(isAdminEmail).mockReturnValue(false);
    const res = await POST(makeReq({ userIds: ['u1'] }));
    expect(res.status).toBe(404);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('returns 400 when body is malformed JSON', async () => {
    const req = new Request('http://localhost/api/admin/users/send-reengagement', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('returns 400 when userIds is missing', async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toHaveProperty('error');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('returns 400 when userIds is an empty array', async () => {
    const res = await POST(makeReq({ userIds: [] }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toHaveProperty('error');
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('returns 400 when userIds is not an array', async () => {
    const res = await POST(makeReq({ userIds: 'u1' }));
    expect(res.status).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('returns 400 when userIds contains non-string elements', async () => {
    const res = await POST(makeReq({ userIds: [1, 2] }));
    expect(res.status).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('queues the event and returns { queued: n } for valid admin request', async () => {
    const res = await POST(makeReq({ userIds: ['u1', 'u2'] }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ queued: 2 });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith({
      name: 'admin/reengagement-email.requested',
      data: { userIds: ['u1', 'u2'] },
    });
  });

  it('queues single-element userIds correctly', async () => {
    const res = await POST(makeReq({ userIds: ['u1'] }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toEqual({ queued: 1 });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock).toHaveBeenCalledWith({
      name: 'admin/reengagement-email.requested',
      data: { userIds: ['u1'] },
    });
  });
});
