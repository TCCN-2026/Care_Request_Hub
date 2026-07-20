import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requestStatusLabels, requestStatusBadgeVariant } from "@/lib/domain/status-labels";
import { RequestForm } from "../request-form";
import { SubmitRequestButton, CancelRequestButton } from "./request-actions";

export default async function ProviderRequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: request } = await supabase.from("requests").select("*").eq("id", id).maybeSingle();
  if (!request) {
    notFound();
  }

  if (request.status === "draft") {
    const { data: categories } = await supabase
      .from("categories")
      .select("id, name")
      .order("sort_order");

    return (
      <div className="max-w-2xl">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-zinc-900">Edit draft request</h1>
          <Badge variant={requestStatusBadgeVariant[request.status]}>
            {requestStatusLabels[request.status]}
          </Badge>
        </div>
        <p className="mt-1 text-sm text-zinc-500">{request.reference}</p>

        <div className="mt-8">
          <RequestForm
            categories={categories ?? []}
            mode="edit"
            requestId={request.id}
            defaultValues={{
              title: request.title,
              categoryId: request.category_id,
              description: request.description,
              desiredOutcome: request.desired_outcome ?? "",
              mandatoryRequirements: request.mandatory_requirements ?? "",
              postcodePrefix: request.postcode_prefix,
              closingDate: request.closing_date,
              confirmNoPersonalData: true,
            }}
          />
        </div>

        <div className="mt-6">
          <SubmitRequestButton id={request.id} />
        </div>
      </div>
    );
  }

  const canCancel = ["submitted", "approved", "open"].includes(request.status);

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">{request.title}</h1>
        <Badge variant={requestStatusBadgeVariant[request.status]}>
          {requestStatusLabels[request.status]}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-zinc-500">{request.reference}</p>

      <Card className="mt-6">
        <CardContent className="space-y-4 pt-6">
          <div>
            <h2 className="text-sm font-medium text-zinc-500">Description</h2>
            <p className="mt-1 whitespace-pre-wrap text-zinc-900">{request.description}</p>
          </div>
          {request.desired_outcome && (
            <div>
              <h2 className="text-sm font-medium text-zinc-500">Desired outcome</h2>
              <p className="mt-1 whitespace-pre-wrap text-zinc-900">{request.desired_outcome}</p>
            </div>
          )}
          {request.mandatory_requirements && (
            <div>
              <h2 className="text-sm font-medium text-zinc-500">Mandatory requirements</h2>
              <p className="mt-1 whitespace-pre-wrap text-zinc-900">{request.mandatory_requirements}</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4 border-t pt-4">
            <div>
              <h2 className="text-sm font-medium text-zinc-500">Postcode prefix</h2>
              <p className="mt-1 text-zinc-900">{request.postcode_prefix}</p>
            </div>
            <div>
              <h2 className="text-sm font-medium text-zinc-500">Closing date</h2>
              <p className="mt-1 text-zinc-900">
                {new Date(request.closing_date).toLocaleDateString("en-GB")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {canCancel && (
        <div className="mt-6">
          <CancelRequestButton id={request.id} />
        </div>
      )}
    </div>
  );
}
