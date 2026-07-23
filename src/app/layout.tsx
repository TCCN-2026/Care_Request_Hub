import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { appSettings } from "@/lib/settings";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: `${appSettings.productName} | ${appSettings.organisationName}`,
  description: appSettings.tagline,
};

const { colors } = appSettings;

/**
 * Applies the brand palette from src/lib/settings.ts as CSS custom
 * properties, overriding the neutral defaults in globals.css - this is
 * what makes the palette actually configurable from one file rather than
 * needing a matching edit in the stylesheet.
 */
const themeStyle = {
  "--primary": colors.primary,
  "--primary-foreground": colors.primaryForeground,
  "--secondary": colors.secondary,
  "--secondary-foreground": colors.secondaryForeground,
  "--muted": colors.muted,
  "--muted-foreground": colors.mutedForeground,
  "--accent": colors.accent,
  "--accent-foreground": colors.accentForeground,
  "--background": colors.background,
  "--foreground": colors.foreground,
  "--card": colors.card,
  "--card-foreground": colors.cardForeground,
  "--popover": colors.popover,
  "--popover-foreground": colors.popoverForeground,
  "--border": colors.border,
  "--input": colors.input,
  "--ring": colors.ring,
  "--highlight": colors.highlight,
  "--highlight-foreground": colors.highlightForeground,
} as React.CSSProperties;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en-GB"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      style={themeStyle}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
