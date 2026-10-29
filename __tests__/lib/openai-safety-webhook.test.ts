import { describe, it, expect, beforeEach, vi } from 'vitest';

const { sendEmail, markOpenAIBlocked } = vi.hoisted(() => ({
  sendEmail: vi.fn(),
  markOpenAIBlocked: vi.fn(),
}));
vi.mock('@/lib/email/resend', () => ({ sendEmail }));
vi.mock('@/lib/openai-blocked', () => ({ markOpenAIBlocked }));

import { handleSafetyEvent, isSafetyEvent } from '@/lib/openai-safety-webhook';

const fetchMock = vi.fn();
const caseResponse = (body: object) => ({ ok: true, status: 200, json: async () => body });

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('fetch', fetchMock);
  sendEmail.mockResolvedValue({ id: 'e1' });
  markOpenAIBlocked.mockResolvedValue(undefined);
});

describe('isSafetyEvent', () => {
  it('accepts only the two safety notices', () => {
    expect(isSafetyEvent('safety.warning_issued')).toBe(true);
    expect(isSafetyEvent('safety.deactivation_issued')).toBe(true);
    expect(isSafetyEvent('batch.completed')).toBe(false);
  });
});

describe('handleSafetyEvent', () => {
  it('blocks the user and emails the admin on a deactivation', async () => {
    fetchMock.mockResolvedValue(caseResponse({ entity_identifier: 'u1', reason: 'csam' }));
    await handleSafetyEvent('safety.deactivation_issued', 'case_1');
    expect(fetchMock.mock.calls[0][0]).toBe('https://api.openai.com/v1/safety/cases/case_1');
    expect(markOpenAIBlocked).toHaveBeenCalledWith('u1');
    expect(sendEmail).toHaveBeenCalledOnce();
    expect(sendEmail.mock.calls[0][0].subject).toMatch(/deactivation/);
  });

  it('only emails on a warning', async () => {
    fetchMock.mockResolvedValue(caseResponse({ entity_identifier: 'u1' }));
    await handleSafetyEvent('safety.warning_issued', 'case_2');
    expect(markOpenAIBlocked).not.toHaveBeenCalled();
    expect(sendEmail.mock.calls[0][0].subject).toMatch(/warning/);
  });

  it('still emails when the identifier is not one of our users', async () => {
    fetchMock.mockResolvedValue(caseResponse({ entity_identifier: 'gone' }));
    markOpenAIBlocked.mockRejectedValue(new Error('foreign key violation'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await handleSafetyEvent('safety.deactivation_issued', 'case_3');
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it('throws when the case lookup fails so OpenAI redelivers', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    await expect(handleSafetyEvent('safety.warning_issued', 'case_4')).rejects.toThrow('500');
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
