import "server-only";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface CurrentOrgContext {
  userId: string;
  orgId: string;
  orgType: "care_provider" | "supplier" | "platform_admin";
}

/**
 * Resolves the signed-in user's organisation. The proxy already redirects
 * unauthenticated users and users without an org before reaching a
 * protected page, so reaching here without one indicates something
 * inconsistent - fail safe by sending back to onboarding rather than
 * rendering with a null org.
 */
export async function requireCurrentOrg(): Promise<CurrentOrgContext> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("organisation_members")
    .select("organisation_id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  const { data: organisation } = await supabase
    .from("organisations")
    .select("type")
    .eq("id", membership.organisation_id)
    .maybeSingle();

  if (!organisation) {
    redirect("/onboarding");
  }

  return { userId: user.id, orgId: membership.organisation_id, orgType: organisation.type };
}
