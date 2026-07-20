import type { Database } from "@/types/database";

type RequestRow = Database["public"]["Tables"]["requests"]["Row"];

/**
 * The only shape a supplier-facing request may take. An explicit allow-list
 * rather than "select the row and hide fields in the UI" - deliberately
 * excludes provider_org_id, created_by, approved_by and anything else that
 * could resolve to the provider's identity, so a future column added to
 * `requests` can't leak here by accident.
 */
export interface SupplierVisibleRequest {
  id: string;
  reference: string;
  title: string;
  categoryId: string;
  description: string;
  desiredOutcome: string | null;
  mandatoryRequirements: string | null;
  postcodePrefix: string;
  closingDate: string;
  status: RequestRow["status"];
  createdAt: string;
}

export function toSupplierVisibleRequest(row: RequestRow): SupplierVisibleRequest {
  return {
    id: row.id,
    reference: row.reference,
    title: row.title,
    categoryId: row.category_id,
    description: row.description,
    desiredOutcome: row.desired_outcome,
    mandatoryRequirements: row.mandatory_requirements,
    postcodePrefix: row.postcode_prefix,
    closingDate: row.closing_date,
    status: row.status,
    createdAt: row.created_at,
  };
}

/**
 * Assigns stable "Supplier A" / "Supplier B" labels by response creation
 * order, for use before an introduction reveals the real organisation name.
 */
export function anonymousSupplierLabel(index: number): string {
  const letter = String.fromCharCode(65 + (index % 26));
  return `Supplier ${letter}`;
}
