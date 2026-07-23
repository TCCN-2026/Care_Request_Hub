/**
 * Shared constants/logic for the whole-site password gate, used by both
 * src/proxy.ts (Edge runtime) and the site-login server action (Node
 * runtime) - plain Web Crypto so it works in both without extra deps.
 *
 * This is a coarse "keep it to trusted testers" gate, separate from the
 * app's real authentication - the cookie only ever proves "knows the
 * shared password", never a user identity.
 */
export const SITE_GATE_COOKIE = "site_access";
export const SITE_GATE_PATH = "/site-login";

export async function hashSitePassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
