import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  fireSignupConversion,
  firePurchaseConversion,
  setPendingSignupConversion,
  consumePendingSignupConversion,
  clearPendingSignupConversion,
} from '@/lib/google-ads';
import { BOARD_UNLOCK_PRICE_CENTS } from '@/lib/constants';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

describe('google-ads conversion helpers', () => {
  let gtagSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    gtagSpy = vi.fn();
    window.gtag = gtagSpy;
    window.dataLayer = [];
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    delete window.gtag;
    delete window.dataLayer;
  });

  function stubAdsEnv() {
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', 'AW-123456');
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL', 'signupLbl');
    vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL', 'purchaseLbl');
  }

  describe('fireSignupConversion', () => {
    it('no-ops when NEXT_PUBLIC_GOOGLE_ADS_ID is unset', () => {
      fireSignupConversion();
      expect(gtagSpy).not.toHaveBeenCalled();
    });

    it('no-ops when the signup label is unset', () => {
      vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', 'AW-123456');
      fireSignupConversion();
      expect(gtagSpy).not.toHaveBeenCalled();
    });

    it('fires a conversion event with send_to = id/label', () => {
      stubAdsEnv();
      fireSignupConversion();
      expect(gtagSpy).toHaveBeenCalledWith('event', 'conversion', {
        send_to: 'AW-123456/signupLbl',
      });
    });
  });

  describe('firePurchaseConversion', () => {
    it('fires with value from BOARD_UNLOCK_PRICE_CENTS, USD currency, and transaction id', () => {
      stubAdsEnv();
      firePurchaseConversion('cs_test_abc');
      expect(gtagSpy).toHaveBeenCalledWith('event', 'conversion', {
        send_to: 'AW-123456/purchaseLbl',
        value: BOARD_UNLOCK_PRICE_CENTS / 100,
        currency: 'USD',
        transaction_id: 'cs_test_abc',
      });
    });

    it('omits transaction_id when not provided', () => {
      stubAdsEnv();
      firePurchaseConversion();
      expect(gtagSpy).toHaveBeenCalledWith('event', 'conversion', {
        send_to: 'AW-123456/purchaseLbl',
        value: BOARD_UNLOCK_PRICE_CENTS / 100,
        currency: 'USD',
      });
    });

    it('no-ops when NEXT_PUBLIC_GOOGLE_ADS_ID is unset', () => {
      firePurchaseConversion('cs_test_abc');
      expect(gtagSpy).not.toHaveBeenCalled();
    });

    it('no-ops when the purchase label is unset', () => {
      vi.stubEnv('NEXT_PUBLIC_GOOGLE_ADS_ID', 'AW-123456');
      firePurchaseConversion('x');
      expect(gtagSpy).not.toHaveBeenCalled();
    });
  });

  describe('gtag queue stub', () => {
    it('defines window.gtag and queues into dataLayer when the tag script has not loaded', () => {
      stubAdsEnv();
      delete window.gtag;
      window.dataLayer = [];
      fireSignupConversion();
      expect(typeof window.gtag).toBe('function');
      expect(window.dataLayer).toHaveLength(1);
    });
  });

  describe('pending signup conversion (OAuth redirect flow)', () => {
    it('consumePendingSignupConversion fires once and clears the flag', () => {
      stubAdsEnv();
      setPendingSignupConversion();
      consumePendingSignupConversion();
      consumePendingSignupConversion();
      expect(gtagSpy).toHaveBeenCalledTimes(1);
      expect(gtagSpy).toHaveBeenCalledWith('event', 'conversion', {
        send_to: 'AW-123456/signupLbl',
      });
    });

    it('consumePendingSignupConversion no-ops when no flag is set', () => {
      stubAdsEnv();
      consumePendingSignupConversion();
      expect(gtagSpy).not.toHaveBeenCalled();
    });

    it('clearPendingSignupConversion removes the flag so a later consume fires nothing', () => {
      stubAdsEnv();
      setPendingSignupConversion();
      clearPendingSignupConversion();
      consumePendingSignupConversion();
      expect(gtagSpy).not.toHaveBeenCalled();
    });
  });
});
