import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Finds the (request, supplier) thread or creates it, respecting the
 * caller's own RLS - authorisation to create a thread is entirely the
 * message_threads_insert policy's job, not this function's.
 */
export async function getOrCreateThread(
  supabase: SupabaseClient<Database>,
  requestId: string,
  supplierOrgId: string,
): Promise<{ threadId?: string; error?: string }> {
  const { data: existing } = await supabase
    .from("message_threads")
    .select("id")
    .eq("request_id", requestId)
    .eq("supplier_org_id", supplierOrgId)
    .maybeSingle();
  if (existing) {
    return { threadId: existing.id };
  }

  const { data: created, error } = await supabase
    .from("message_threads")
    .insert({ request_id: requestId, supplier_org_id: supplierOrgId })
    .select("id")
    .maybeSingle();

  if (created) {
    return { threadId: created.id };
  }

  // Lost a race with a concurrent insert - the unique constraint will have
  // rejected ours, so the row now exists; look it up rather than fail.
  const { data: afterRace } = await supabase
    .from("message_threads")
    .select("id")
    .eq("request_id", requestId)
    .eq("supplier_org_id", supplierOrgId)
    .maybeSingle();
  if (afterRace) {
    return { threadId: afterRace.id };
  }

  return { error: error?.message ?? "Could not start the conversation." };
}
