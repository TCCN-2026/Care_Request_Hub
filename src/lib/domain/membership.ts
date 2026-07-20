import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const FREE_LIVE_REQUEST_LIMIT = 5;

/**
 * A request counts toward the free-tier limit once it has ever gone live
 * (approved_at is set), regardless of what happens to it afterwards -
 * matches the DB trigger's own counting logic (enforce_provider_membership_gate).
 */
export async function getProviderLiveRequestCount(
  supabase: SupabaseClient<Database>,
  providerOrgId: string,
): Promise<number> {
  const { count } = await supabase
    .from("requests")
    .select("id", { count: "exact", head: true })
    .eq("provider_org_id", providerOrgId)
    .not("approved_at", "is", null);
  return count ?? 0;
}
