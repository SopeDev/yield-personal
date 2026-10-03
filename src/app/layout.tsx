import type { Metadata, Viewport } from "next";
import { DM_Mono, Inter, Syne } from "next/font/google";
import { cookies } from "next/headers";
import { defaultLocale, isLocale, LOCALE_COOKIE } from "@/i18n/config";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const syne = Syne({
  variable: "--font-syne",
  subsets: ["latin"],
});

const dmMono = DM_Mono({
  variable: "--font-dm-mono",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

export const metadata: Metadata = {
  title: "Yield",
  description: "Your personal finances, at a glance.",
  applicationName: "Yield Personal",
  manifest: "/manifest.webmanifest",
  icons: {
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Yield",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0d0f12",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = cookieLocale && isLocale(cookieLocale) ? cookieLocale : defaultLocale;

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${syne.variable} ${dmMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}
