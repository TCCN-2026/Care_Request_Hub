import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { toSupplierVisibleRequest } from "@/lib/domain/serialize";
import { responseStatusLabels, responseStatusBadgeVariant } from "@/lib/domain/status-labels";
import { ResponseForm } from "./response-form";
import { WithdrawResponseButton } from "./response-actions";

export default async function OpportunityDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { orgId } = await requireCurrentOrg();
  const supabase = await createClient();

  const { data: row } = await supabase
    .from("requests")
    .select(
      "id, reference, title, category_id, description, desired_outcome, mandatory_requirements, postcode_prefix, closing_date, status, created_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (!row) {
    notFound();
  }
  const opportunity = toSupplierVisibleRequest(row);

  const { data: category } = await supabase
    .from("categories")
    .select("name")
    .eq("id", opportunity.categoryId)
    .maybeSingle();

  const { data: response } = await supabase
    .from("responses")
    .select("*")
    .eq("request_id", id)
    .eq("supplier_org_id", orgId)
    .maybeSingle();

  return (
    <div className="max-w-2xl">
      <p className="text-sm text-zinc-500">
        {opportunity.reference} &middot; {category?.name} &middot; {opportunity.postcodePrefix}
      </p>
      <h1 className="mt-1 text-2xl font-semibold text-zinc-900">{opportunity.title}</h1>

      <Card className="mt-6">
        <CardContent className="space-y-4 pt-6">
          <div>
            <h2 className="text-sm font-medium text-zinc-500">Description</h2>
            <p className="mt-1 whitespace-pre-wrap text-zinc-900">{opportunity.description}</p>
          </div>
          {opportunity.desiredOutcome && (
            <div>
              <h2 className="text-sm font-medium text-zinc-500">Desired outcome</h2>
              <p className="mt-1 whitespace-pre-wrap text-zinc-900">{opportunity.desiredOutcome}</p>
            </div>
          )}
          {opportunity.mandatoryRequirements && (
            <div>
              <h2 className="text-sm font-medium text-zinc-500">Mandatory requirements</h2>
              <p className="mt-1 whitespace-pre-wrap text-zinc-900">{opportunity.mandatoryRequirements}</p>
            </div>
          )}
          <div>
            <h2 className="text-sm font-medium text-zinc-500">Closing date</h2>
            <p className="mt-1 text-zinc-900">
              {new Date(opportunity.closingDate).toLocaleDateString("en-GB")}
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="mt-8">
        {!response && opportunity.status === "open" && (
          <>
            <h2 className="text-lg font-medium text-zinc-900">Your response</h2>
            <div className="mt-4">
              <ResponseForm requestId={id} mode="create" />
            </div>
          </>
        )}

        {response && response.status === "draft" && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-zinc-900">Your response</h2>
              <Badge variant={responseStatusBadgeVariant[response.status]}>
                {responseStatusLabels[response.status]}
              </Badge>
            </div>
            <div className="mt-4">
              <ResponseForm
                requestId={id}
                mode="edit"
                responseId={response.id}
                defaultValues={{
                  summary: response.summary,
                  proposedSolution: response.proposed_solution,
                  oneOffCost: response.one_off_cost ?? undefined,
                  recurringCost: response.recurring_cost ?? undefined,
                  vatStatus: response.vat_status,
                  timescale: response.timescale ?? "",
                  declarationAccurate: true,
                }}
              />
            </div>
          </>
        )}

        {response && !["draft"].includes(response.status) && (
          <>
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-zinc-900">Your response</h2>
              <Badge variant={responseStatusBadgeVariant[response.status]}>
                {responseStatusLabels[response.status]}
              </Badge>
            </div>
            <Card className="mt-4">
              <CardContent className="space-y-3 pt-6">
                <p className="whitespace-pre-wrap text-zinc-900">{response.summary}</p>
                <p className="whitespace-pre-wrap text-zinc-700">{response.proposed_solution}</p>
              </CardContent>
            </Card>
            {response.status === "submitted" && opportunity.status === "open" && (
              <div className="mt-4">
                <WithdrawResponseButton id={response.id} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
