import * as Sentry from "@sentry/nextjs";

// Browser-side errors. NEXT_PUBLIC_SENTRY_DSN is inlined at build time;
// without it the SDK stays disabled (zero runtime cost for users).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: Boolean(process.env.NEXT_PUBLIC_SENTRY_DSN),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  tracesSampleRate: 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
