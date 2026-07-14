// Client-side Google Ads (gtag.js) conversion helpers. Every function no-ops
// unless NEXT_PUBLIC_GOOGLE_ADS_ID and the relevant conversion label are set,
// so dev/preview environments never talk to Google.

import { BOARD_UNLOCK_PRICE_CENTS } from '@/lib/constants';

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
  }
}

const PENDING_SIGNUP_KEY = 'loteria_pending_signup_conversion';

function trackConversion(label: string | undefined, params: Record<string, unknown> = {}) {
  const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  if (!adsId || !label || typeof window === 'undefined') {
    return;
  }
  // The gtag.js loader may not have executed yet (e.g. a conversion fired in a
  // mount effect right after a redirect). Install the standard queue stub so
  // the event lands in dataLayer and is drained when the library loads.
  window.dataLayer = window.dataLayer || [];
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag() {
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
  }
  window.gtag('event', 'conversion', { send_to: `${adsId}/${label}`, ...params });
}

export function fireSignupConversion() {
  trackConversion(process.env.NEXT_PUBLIC_GOOGLE_ADS_SIGNUP_LABEL);
}

export function firePurchaseConversion(transactionId?: string) {
  trackConversion(process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL, {
    value: BOARD_UNLOCK_PRICE_CENTS / 100,
    currency: 'USD',
    ...(transactionId ? { transaction_id: transactionId } : {}),
  });
}

// Google OAuth signup navigates away to Google before we can fire the
// conversion, so stash a flag in sessionStorage (survives same-tab redirects)
// and fire when the user lands back on the dashboard.
export function setPendingSignupConversion() {
  try {
    sessionStorage.setItem(PENDING_SIGNUP_KEY, '1');
  } catch {
    // Storage unavailable (private mode quota, disabled) — drop the conversion.
  }
}

export function clearPendingSignupConversion() {
  try {
    sessionStorage.removeItem(PENDING_SIGNUP_KEY);
  } catch {
    // Storage unavailable (private mode quota, disabled) — nothing to clear.
  }
}

export function consumePendingSignupConversion() {
  try {
    if (sessionStorage.getItem(PENDING_SIGNUP_KEY) !== '1') {
      return;
    }
    sessionStorage.removeItem(PENDING_SIGNUP_KEY);
  } catch {
    return;
  }
  fireSignupConversion();
}
