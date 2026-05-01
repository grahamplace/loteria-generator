export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  const isDev = process.env.NODE_ENV === 'development';
  const enabledInDev = process.env.NEXT_PUBLIC_POSTHOG_ENABLED_IN_DEV === 'true';
  if (isDev && !enabledInDev) return;

  if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return;

  const { NodeSDK } = await import('@opentelemetry/sdk-node');
  const { resourceFromAttributes } = await import('@opentelemetry/resources');
  const { PostHogSpanProcessor } = await import('@posthog/ai/otel');
  const { OpenAIInstrumentation } = await import('@opentelemetry/instrumentation-openai');

  const sdk = new NodeSDK({
    resource: resourceFromAttributes({
      'service.name': 'loteria-generator',
    }),
    spanProcessors: [
      new PostHogSpanProcessor({
        apiKey: process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN,
        host: process.env.NEXT_PUBLIC_POSTHOG_HOST,
      }),
    ],
    instrumentations: [new OpenAIInstrumentation()],
  });
  sdk.start();
}
