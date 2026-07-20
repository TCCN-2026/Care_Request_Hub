import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { toSupplierVisibleRequest } from "@/lib/domain/serialize";

export default async function SupplierOpportunitiesPage() {
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
  const { data: rows } = await supabase
    .from("requests")
    .select(
      "id, reference, title, category_id, description, desired_outcome, mandatory_requirements, postcode_prefix, closing_date, status, created_at",
    )
    .eq("status", "open")
    .order("closing_date", { ascending: true });

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
                      </div>
                      {existingStatus && (
                        <Badge variant={existingStatus === "draft" ? "outline" : "secondary"}>
                          {existingStatus === "draft" ? "Draft response saved" : "You responded"}
                        </Badge>
                      )}
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
