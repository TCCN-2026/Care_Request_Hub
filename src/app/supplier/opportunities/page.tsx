import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { toSupplierVisibleRequest } from "@/lib/domain/serialize";
import { formatBudgetRange } from "@/lib/domain/format";
import { urgencyLevelLabels, urgencyLevelBadgeVariant } from "@/lib/domain/status-labels";
import type { UrgencyLevel } from "@/types/domain";
import { UrgencyFilter } from "./urgency-filter";

const URGENCY_FILTER_VALUES: UrgencyLevel[] = ["exploring", "standard", "urgent"];

export default async function SupplierOpportunitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ urgency?: string }>;
}) {
  const { urgency: urgencyParam } = await searchParams;
  const urgencyFilter = URGENCY_FILTER_VALUES.includes(urgencyParam as UrgencyLevel)
    ? (urgencyParam as UrgencyLevel)
    : null;

  const { orgId } = await requireCurrentOrg();
  const supabase = await createClient();

  const { data: org } = await supabase.from("organisations").select("is_ccn_member").eq("id", orgId).maybeSingle();

  if (!org?.is_ccn_member) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Opportunities</h1>
        <Alert className="mt-6">
          <AlertTitle>You need to be a CCN member to see live requests</AlertTitle>
          <AlertDescription>
            Your organisation isn&apos;t currently a CCN member, so it can&apos;t view or respond to live
            requests. Contact The Care Connector Network to become a member.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // RLS already restricts this to open requests matching this supplier's
  // categories and postcode coverage - the explicit column list is a
  // second, independent guarantee that no provider-identifying column can
  // ever be selected here, even if the requests table gains one later.
  let query = supabase
    .from("requests")
    .select(
      "id, reference, title, category_id, description, desired_outcome, mandatory_requirements, postcode_prefix, closing_date, budget_min, budget_max, budget_includes_vat, urgency, status, created_at",
    )
    .eq("status", "open")
    .order("closing_date", { ascending: true });
  if (urgencyFilter) {
    query = query.eq("urgency", urgencyFilter);
  }
  const { data: rows } = await query;

  const opportunities = (rows ?? []).map(toSupplierVisibleRequest);

  const { data: categories } = await supabase.from("categories").select("id, name");
  const categoryNameById = new Map((categories ?? []).map((c) => [c.id, c.name]));

  const { data: existingResponses } = await supabase
    .from("responses")
    .select("request_id, status")
    .eq("supplier_org_id", orgId);
  const responseStatusByRequestId = new Map((existingResponses ?? []).map((r) => [r.request_id, r.status]));
  // Server Component rendered fresh per request - not subject to the client
  // memoization concerns react-hooks/purity is guarding against.
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900">Opportunities</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Requests matching your service categories and coverage areas. You&apos;re seeing the
        anonymous version - the provider&apos;s identity is never shown here.
      </p>

      <div className="mt-4">
        <UrgencyFilter selected={urgencyFilter} />
      </div>

      {opportunities.length === 0 ? (
        <Card className="mt-6">
          <CardContent className="py-10 text-center text-zinc-600">
            No open requests match your categories and coverage right now.
          </CardContent>
        </Card>
      ) : (
        <ul className="mt-6 space-y-3">
          {opportunities.map((opportunity) => {
            const daysRemaining = Math.ceil(
              (new Date(opportunity.closingDate).getTime() - now) / (1000 * 60 * 60 * 24),
            );
            const existingStatus = responseStatusByRequestId.get(opportunity.id);

            return (
              <li key={opportunity.id}>
                <Link href={`/supplier/opportunities/${opportunity.id}`}>
                  <Card className="transition-colors hover:border-zinc-400">
                    <CardContent className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-zinc-500">
                          {opportunity.reference} &middot; {categoryNameById.get(opportunity.categoryId) ?? "Category"} &middot;{" "}
                          {opportunity.postcodePrefix}
                        </p>
                        <p className="font-medium text-zinc-900">{opportunity.title}</p>
                        <p className="mt-1 text-sm text-zinc-500">
                          {daysRemaining >= 0 ? `${daysRemaining} day${daysRemaining === 1 ? "" : "s"} left to respond` : "Closing date has passed"}
                          {opportunity.mandatoryRequirements ? " · Has mandatory requirements" : ""}
                        </p>
                        {formatBudgetRange(opportunity.budgetMin, opportunity.budgetMax, opportunity.budgetIncludesVat) && (
                          <p className="mt-1 text-sm text-zinc-500">
                            Budget:{" "}
                            {formatBudgetRange(opportunity.budgetMin, opportunity.budgetMax, opportunity.budgetIncludesVat)}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <Badge variant={urgencyLevelBadgeVariant[opportunity.urgency]}>
                          {urgencyLevelLabels[opportunity.urgency]}
                        </Badge>
                        {existingStatus && (
                          <Badge variant={existingStatus === "draft" ? "outline" : "secondary"}>
                            {existingStatus === "draft" ? "Draft response saved" : "You responded"}
                          </Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
