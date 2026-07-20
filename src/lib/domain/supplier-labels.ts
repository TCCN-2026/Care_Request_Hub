import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { anonymousSupplierLabel } from "./serialize";

/**
 * Assigns "Supplier A"/"Supplier B"/... consistently across the response
 * comparison view and message threads for the same request, ordered by
 * whichever came first - a response or a message thread (a supplier may
 * open a thread to ask a question before responding).
 */
export async function getSupplierLabelMap(
  supabase: SupabaseClient<Database>,
  requestId: string,
): Promise<Map<string, string>> {
  const [{ data: responses }, { data: threads }] = await Promise.all([
    supabase.from("responses").select("supplier_org_id, created_at").eq("request_id", requestId),
    supabase.from("message_threads").select("supplier_org_id, created_at").eq("request_id", requestId),
  ]);

  const earliestBySupplier = new Map<string, string>();
  for (const row of [...(responses ?? []), ...(threads ?? [])]) {
    const existing = earliestBySupplier.get(row.supplier_org_id);
    if (!existing || row.created_at < existing) {
      earliestBySupplier.set(row.supplier_org_id, row.created_at);
    }
  }

  const ordered = [...earliestBySupplier.entries()].sort((a, b) => a[1].localeCompare(b[1]));

  const labelBySupplier = new Map<string, string>();
  ordered.forEach(([supplierOrgId], index) => {
    labelBySupplier.set(supplierOrgId, anonymousSupplierLabel(index));
  });

  return labelBySupplier;
}
