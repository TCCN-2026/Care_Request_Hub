import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requestStatusLabels, requestStatusBadgeVariant } from "@/lib/domain/status-labels";
import { ApproveRequestButton, CloseRequestButton } from "./admin-request-actions";
import { getRequestAttachmentDownloadUrl } from "@/lib/attachments/actions";
import { AttachmentList } from "@/components/attachments/attachment-list";

export default async function AdminRequestDetailPage({
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

  const { data: providerOrg } = await supabase
    .from("organisations")
    .select("name, postcode_prefix")
    .eq("id", request.provider_org_id)
    .maybeSingle();

  const { data: category } = await supabase
    .from("categories")
    .select("name")
    .eq("id", request.category_id)
    .maybeSingle();

  const { data: attachments } = await supabase
    .from("request_attachments")
    .select("*")
    .eq("request_id", id)
    .order("created_at", { ascending: true });

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">{request.title}</h1>
        <Badge variant={requestStatusBadgeVariant[request.status]}>
          {requestStatusLabels[request.status]}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        {request.reference} &middot; {providerOrg?.name ?? "Unknown organisation"} &middot; {category?.name}
      </p>

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
          {attachments && attachments.length > 0 && (
            <div className="border-t pt-4">
              <h2 className="mb-2 text-sm font-medium text-zinc-500">Attachments</h2>
              <AttachmentList
                attachments={attachments.map((a) => ({
                  id: a.id,
                  fileName: a.file_name,
                  fileSize: a.file_size,
                  visibleToSuppliers: a.visible_to_suppliers,
                }))}
                getDownloadUrl={getRequestAttachmentDownloadUrl}
              />
            </div>
          )}
        </CardContent>
      </Card>

      <div className="mt-6 flex gap-3">
        {request.status === "submitted" && <ApproveRequestButton id={request.id} />}
        {request.status === "open" && <CloseRequestButton id={request.id} />}
      </div>
    </div>
  );
}
