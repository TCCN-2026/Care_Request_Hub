/**
 * Central application settings.
 *
 * Product name, tagline, support contact and similar copy live here so pages
 * never hard-code them. Values that differ per environment are read from
 * env vars with sensible fallbacks for local development.
 */
export const appSettings = {
  productName: "Care Request Hub",
  tagline: "Tell us what your business needs. Hear from the right suppliers—not every supplier.",
  poweredByLine: "Powered by The Care Connector Network",
  organisationName: "The Care Connector Network",
  supportEmail: process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? "support@example.com",
  primaryWebsiteUrl: process.env.NEXT_PUBLIC_PRIMARY_WEBSITE_URL ?? "https://example.com",
  logoUrl: process.env.NEXT_PUBLIC_LOGO_URL ?? "/logo-placeholder.svg",
} as const;

/**
 * Number of days after which an approved introduction should prompt the
 * provider for outcome feedback. Kept here so it can move to an
 * admin-editable app_settings row later without touching call sites.
 */
export const introductionFeedbackDelayDays = 14;
