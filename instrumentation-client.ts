import posthog from 'posthog-js';

const isDev = process.env.NODE_ENV === 'development';
const enabledInDev = process.env.NEXT_PUBLIC_POSTHOG_ENABLED_IN_DEV === 'true';

if (!isDev || enabledInDev) {
  posthog.init(process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN!, {
    api_host: '/ingest',
    ui_host: 'https://us.posthog.com',
    defaults: '2026-01-30',
    capture_exceptions: true,
    debug: isDev,
  });
}
