import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { toSupplierVisibleRequest } from "@/lib/domain/serialize";
import {
  responseStatusLabels,
  responseStatusBadgeVariant,
  urgencyLevelLabels,
  urgencyLevelBadgeVariant,
} from "@/lib/domain/status-labels";
import { formatBudgetRange } from "@/lib/domain/format";
import { ResponseForm } from "./response-form";
import { WithdrawResponseButton } from "./response-actions";
import { uploadResponseAttachment, deleteResponseAttachment } from "./attachment-actions";
import { getRequestAttachmentDownloadUrl, getResponseAttachmentDownloadUrl } from "@/lib/attachments/actions";
import { AttachmentUploadForm } from "@/components/attachments/attachment-upload-form";
import { AttachmentList } from "@/components/attachments/attachment-list";
import { sendSupplierMessage } from "./message-actions";
import { MessageThread } from "@/components/messages/message-thread";

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
      "id, reference, title, category_id, description, desired_outcome, mandatory_requirements, postcode_prefix, closing_date, budget_min, budget_max, budget_includes_vat, urgency, status, created_at",
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

  // RLS already restricts this to visible_to_suppliers = true rows on an
  // open, matching request - no further filtering needed here.
  const { data: requestAttachments } = await supabase
    .from("request_attachments")
    .select("*")
    .eq("request_id", id)
    .order("created_at", { ascending: true });

  const { data: responseAttachments } = response
    ? await supabase
        .from("response_attachments")
        .select("*")
        .eq("response_id", response.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  const { data: thread } = await supabase
    .from("message_threads")
    .select("id")
    .eq("request_id", id)
    .eq("supplier_org_id", orgId)
    .maybeSingle();
  const { data: threadMessages } = thread
    ? await supabase.from("messages").select("*").eq("thread_id", thread.id).order("created_at", { ascending: true })
    : { data: [] };
  const canMessage = opportunity.status === "open" || !!thread;

  let providerContact: { orgName: string; fullName: string; email: string | null; phone: string | null } | null =
    null;
  if (response?.status === "introduced") {
    const { data: introduction } = await supabase
      .from("introductions")
      .select("*")
      .eq("response_id", response.id)
      .eq("decision", "approved")
      .maybeSingle();

    if (introduction) {
      const [{ data: providerOrg }, { data: providerProfile }] = await Promise.all([
        supabase.from("organisations").select("name").eq("id", introduction.provider_org_id).maybeSingle(),
        supabase.from("profiles").select("*").eq("id", introduction.requested_by).maybeSingle(),
      ]);
      if (providerOrg && providerProfile) {
        providerContact = {
          orgName: providerOrg.name,
          fullName: providerProfile.full_name,
          email: providerProfile.contact_email,
          phone: providerProfile.phone,
        };
      }
    }
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">
          {opportunity.reference} &middot; {category?.name} &middot; {opportunity.postcodePrefix}
        </p>
        <Badge variant={urgencyLevelBadgeVariant[opportunity.urgency]}>
          {urgencyLevelLabels[opportunity.urgency]}
        </Badge>
      </div>
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
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h2 className="text-sm font-medium text-zinc-500">Closing date</h2>
              <p className="mt-1 text-zinc-900">
                {new Date(opportunity.closingDate).toLocaleDateString("en-GB")}
              </p>
            </div>
            <div>
              <h2 className="text-sm font-medium text-zinc-500">Budget range</h2>
              <p className="mt-1 text-zinc-900">
                {formatBudgetRange(opportunity.budgetMin, opportunity.budgetMax, opportunity.budgetIncludesVat) ??
                  "Not given"}
              </p>
            </div>
          </div>
          {requestAttachments && requestAttachments.length > 0 && (
            <div className="border-t pt-4">
              <h2 className="mb-2 text-sm font-medium text-zinc-500">Attachments</h2>
              <AttachmentList
                attachments={requestAttachments.map((a) => ({ id: a.id, fileName: a.file_name, fileSize: a.file_size }))}
                getDownloadUrl={getRequestAttachmentDownloadUrl}
              />
            </div>
          )}
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
            <div className="mt-6">
              <h3 className="text-sm font-medium text-zinc-900">Attachments</h3>
              <div className="mt-2 space-y-4">
                <AttachmentList
                  attachments={(responseAttachments ?? []).map((a) => ({
                    id: a.id,
                    fileName: a.file_name,
                    fileSize: a.file_size,
                  }))}
                  getDownloadUrl={getResponseAttachmentDownloadUrl}
                  onDelete={deleteResponseAttachment}
                  canDelete
                />
                <AttachmentUploadForm
                  onUpload={uploadResponseAttachment.bind(null, response.id, id)}
                  warning="Avoid attaching anything that identifies your organisation (letterhead, logo, named contacts) - the provider can't see your identity until they approve an introduction."
                />
              </div>
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
                {responseAttachments && responseAttachments.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="mb-2 text-sm font-medium text-zinc-500">Attachments</p>
                    <AttachmentList
                      attachments={responseAttachments.map((a) => ({
                        id: a.id,
                        fileName: a.file_name,
                        fileSize: a.file_size,
                      }))}
                      getDownloadUrl={getResponseAttachmentDownloadUrl}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
            {response.status === "submitted" && opportunity.status === "open" && (
              <div className="mt-4">
                <WithdrawResponseButton id={response.id} />
              </div>
            )}
            {providerContact && (
              <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4 text-sm">
                <p className="font-medium text-emerald-900">
                  Introduction approved - contact details
                </p>
                <p className="mt-1 text-emerald-800">{providerContact.orgName}</p>
                <p className="text-emerald-800">{providerContact.fullName}</p>
                {providerContact.email && <p className="text-emerald-800">{providerContact.email}</p>}
                {providerContact.phone && <p className="text-emerald-800">{providerContact.phone}</p>}
              </div>
            )}
          </>
        )}
      </div>

      {canMessage && (
        <div className="mt-10">
          <h2 className="text-lg font-medium text-zinc-900">Messages</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Messages are reviewed for content that could reveal your identity or the provider&apos;s before an
            introduction is approved.
          </p>
          <Card className="mt-4">
            <CardContent className="pt-6">
              <MessageThread
                messages={(threadMessages ?? []).map((m) => ({
                  id: m.id,
                  body: m.body,
                  createdAt: m.created_at,
                  isOwnMessage: m.sender_org_id === orgId,
                  senderLabel: m.sender_org_id === orgId ? "You" : providerContact?.orgName ?? "Provider",
                }))}
                onSend={sendSupplierMessage.bind(null, id)}
                emptyLabel="No messages yet - say hello or ask a question."
              />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
