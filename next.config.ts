import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const nextConfig: NextConfig = {
  // Bunny.net is the only external media host (video). Add remote image hosts here
  // as needed; all personal data and uploads stay in-country (MinIO).
};

export default withNextIntl(nextConfig);
