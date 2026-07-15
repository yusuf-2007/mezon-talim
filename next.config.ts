import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const nextConfig: NextConfig = {
  // Bunny.net is the only external media host (video). Add remote image hosts here
  // as needed; all personal data and uploads stay in-country (MinIO).

  // Certificate PDFs embed bundled Unicode fonts (read at runtime via fs). Make
  // sure Next's output file tracing ships the .ttf files into the serverless
  // function bundle (otherwise on-demand PDF generation 500s in production).
  outputFileTracingIncludes: {
    "/api/certificates/**": ["./lib/certificates/assets/*.ttf"],
  },

  // Static landing-page mockups live in public/preview/*.html. Serve them at
  // clean, extensionless URLs (/preview, /preview/1a …) so clients can compare
  // directions. These are throwaway design previews, not app routes — no i18n.
  async rewrites() {
    return [
      { source: "/preview", destination: "/preview/index.html" },
      { source: "/preview/:variant", destination: "/preview/:variant.html" },
    ];
  },
};

export default withNextIntl(nextConfig);
