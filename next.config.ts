import type { NextConfig } from "next";
import { defaultLocale, LOCALE_COOKIE, locales } from "./src/i18n/config";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // The app (and the installed PWA, which starts at "/") opens on the month view in the remembered language.
  // Done here rather than in a page so it's answered by the routing layer without running a function.
  async redirects() {
    return [
      ...locales.map((locale) => ({
        source: "/",
        has: [{ type: "cookie" as const, key: LOCALE_COOKIE, value: locale }],
        destination: `/${locale}/month`,
        permanent: false,
      })),
      { source: "/", destination: `/${defaultLocale}/month`, permanent: false },
    ];
  },
};

export default nextConfig;
