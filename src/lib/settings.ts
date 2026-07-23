/**
 * Central application settings.
 *
 * Product name, tagline, support contact, logo and brand colours all live
 * here so pages never hard-code them and the whole look can be swapped for
 * the real thing later by editing this one file.
 *
 * `logoUrl` is null until a real logo image is added: drop the file in
 * `public/brand/` (e.g. `public/brand/logo.png`) and set
 * `NEXT_PUBLIC_LOGO_URL=/brand/logo.png` in `.env.local` - `<Logo>`
 * (src/components/branding/logo.tsx) then renders the image automatically
 * instead of the text wordmark, no other code changes needed.
 *
 * `colors` is the single source of truth for the brand palette - it's
 * applied as CSS custom properties by the root layout
 * (src/app/layout.tsx), which is how every themed component (buttons,
 * badges, links, focus rings, etc.) actually picks up the colour, so
 * changing a value here is enough on its own.
 */
export const appSettings = {
  productName: "Care Request Hub",
  tagline: "Tell us what your business needs. Hear from the right suppliers—not every supplier.",
  poweredByLine: "Powered by The Care Connector Network",
  organisationName: "The Care Connector Network",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@example.com",
  primaryWebsiteUrl: process.env.NEXT_PUBLIC_PRIMARY_WEBSITE_URL ?? "https://thecareconnector.co.uk",
  logoUrl: process.env.NEXT_PUBLIC_LOGO_URL || null,
  colors: {
    // Deep navy - the network's primary brand colour (from thecareconnector.co.uk).
    primary: "#083064",
    primaryForeground: "#ffffff",
    // Soft neutral tint used for secondary surfaces, muted text backgrounds,
    // and subtle hover states - kept understated rather than using the gold
    // highlight everywhere, so that colour stays meaningful when it is used.
    secondary: "#eef1f6",
    secondaryForeground: "#083064",
    muted: "#f4f6f9",
    mutedForeground: "#5b6472",
    accent: "#eef1f6",
    accentForeground: "#083064",
    background: "#ffffff",
    foreground: "#1f2933",
    card: "#ffffff",
    cardForeground: "#1f2933",
    popover: "#ffffff",
    popoverForeground: "#1f2933",
    border: "#dfe4ea",
    input: "#dfe4ea",
    ring: "#083064",
    // Gold accent from the logo and network site - used sparingly and
    // deliberately (e.g. a small rule near the logo), not as a general UI
    // colour, so it stays a genuine highlight rather than noise.
    highlight: "#f5c400",
    highlightForeground: "#083064",
  },
} as const;

/**
 * Number of days after which an approved introduction should prompt the
 * provider for outcome feedback. Kept here so it can move to an
 * admin-editable app_settings row later without touching call sites.
 */
export const introductionFeedbackDelayDays = 14;
