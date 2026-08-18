import Script from 'next/script';

/**
 * Loads the Google Ads tag (gtag.js) for conversion tracking. Renders nothing
 * unless NEXT_PUBLIC_GOOGLE_ADS_ID is set, so dev/preview builds stay clean.
 * Conversion events are fired from lib/google-ads.ts.
 */
export function GoogleAdsTag() {
  const adsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;
  if (!adsId) {
    return null;
  }

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${adsId}`}
        strategy="afterInteractive"
      />
      <Script id="google-ads-init" strategy="afterInteractive">
        {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${adsId}');`}
      </Script>
    </>
  );
}
