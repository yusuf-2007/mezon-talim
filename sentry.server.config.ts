import * as Sentry from "@sentry/nextjs";

// No-op until SENTRY_DSN is set (see .env.example). Errors from Server
// Components, server actions, and route handlers flow in via the
// onRequestError hook in instrumentation.ts.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enabled: Boolean(process.env.SENTRY_DSN),
  environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
  // Keep tracing cheap: errors are the point, perf tracing is a bonus.
  tracesSampleRate: 0.1,
});
