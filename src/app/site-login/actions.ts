"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SITE_GATE_COOKIE, hashSitePassword } from "@/lib/site-gate";

export interface SiteGateResult {
  error?: string;
}

export async function unlockSite(password: string, next: string): Promise<SiteGateResult> {
  const sitePassword = process.env.SITE_PASSWORD;

  // Gate isn't configured on this deploy - nothing to unlock.
  if (!sitePassword) {
    redirect(next || "/");
  }

  if (password !== sitePassword) {
    return { error: "Incorrect password." };
  }

  const token = await hashSitePassword(sitePassword);
  const cookieStore = await cookies();
  cookieStore.set(SITE_GATE_COOKIE, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect(next || "/");
}
