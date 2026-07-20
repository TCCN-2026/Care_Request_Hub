import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/server";
import {
  requestStatusLabels,
  requestStatusBadgeVariant,
  responseStatusLabels,
  responseStatusBadgeVariant,
} from "@/lib/domain/status-labels";
import { anonymousSupplierLabel } from "@/lib/domain/serialize";
import { RequestForm } from "../request-form";
import { SubmitRequestButton, CancelRequestButton } from "./request-actions";
import { ResponseCardActions } from "./response-card-actions";
import { uploadRequestAttachment, deleteRequestAttachment } from "./attachment-actions";
import { getRequestAttachmentDownloadUrl, getResponseAttachmentDownloadUrl } from "@/lib/attachments/actions";
import { AttachmentUploadForm } from "@/components/attachments/attachment-upload-form";
import { AttachmentList } from "@/components/attachments/attachment-list";

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

        <div className="mt-8">
          <h2 className="text-lg font-medium text-zinc-900">Attachments</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Choose which files suppliers can see before you introduce them. Files marked private are only ever
            visible to you and admins.
          </p>
          <div className="mt-3">
            <RequestAttachments requestId={request.id} editable />
          </div>
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

      <div className="mt-10">
        <h2 className="text-lg font-medium text-zinc-900">Attachments</h2>
        <div className="mt-3">
          <RequestAttachments requestId={request.id} editable={false} />
        </div>
      </div>

      <ResponsesSection requestId={request.id} />
    </div>
  );
}

async function RequestAttachments({ requestId, editable }: { requestId: string; editable: boolean }) {
  const supabase = await createClient();
  const { data: attachments } = await supabase
    .from("request_attachments")
    .select("*")
    .eq("request_id", requestId)
    .order("created_at", { ascending: true });

  const items = (attachments ?? []).map((a) => ({
    id: a.id,
    fileName: a.file_name,
    fileSize: a.file_size,
    visibleToSuppliers: a.visible_to_suppliers,
  }));

  return (
    <div className="space-y-4">
      <AttachmentList
        attachments={items}
        getDownloadUrl={getRequestAttachmentDownloadUrl}
        onDelete={editable ? deleteRequestAttachment : undefined}
        canDelete={editable}
      />
      {editable && (
        <AttachmentUploadForm
          onUpload={uploadRequestAttachment.bind(null, requestId)}
          visibilityToggle={{ label: "Visible to suppliers before introduction" }}
          warning="If you mark a file visible to suppliers, avoid anything that identifies your organisation (letterhead, logo, named contacts) - your identity stays hidden until you approve an introduction."
        />
      )}
    </div>
  );
}

async function ResponsesSection({ requestId }: { requestId: string }) {
  const supabase = await createClient();

  const { data: responses } = await supabase
    .from("responses")
    .select("*")
    .eq("request_id", requestId)
    .neq("status", "draft")
    .order("created_at", { ascending: true });

  if (!responses || responses.length === 0) {
    return (
      <div className="mt-10">
        <h2 className="text-lg font-medium text-zinc-900">Responses</h2>
        <p className="mt-2 text-sm text-zinc-500">No supplier has responded yet.</p>
      </div>
    );
  }

  const responseIds = responses.map((r) => r.id);
  const { data: introductions } = await supabase
    .from("introductions")
    .select("*")
    .in("response_id", responseIds);
  const introductionByResponseId = new Map((introductions ?? []).map((i) => [i.response_id, i]));

  const approvedSupplierOrgIds = (introductions ?? [])
    .filter((i) => i.decision === "approved")
    .map((i) => i.supplier_org_id);

  const { data: revealedOrgs } = approvedSupplierOrgIds.length
    ? await supabase.from("organisations").select("id, name").in("id", approvedSupplierOrgIds)
    : { data: [] };
  const revealedOrgNameById = new Map((revealedOrgs ?? []).map((o) => [o.id, o.name]));

  const revealedUserIds = responses
    .filter((r) => introductionByResponseId.get(r.id)?.decision === "approved")
    .map((r) => r.created_by);
  const { data: revealedProfiles } = revealedUserIds.length
    ? await supabase.from("profiles").select("*").in("id", revealedUserIds)
    : { data: [] };
  const revealedProfileByUserId = new Map((revealedProfiles ?? []).map((p) => [p.id, p]));

  const { data: attachments } = await supabase
    .from("response_attachments")
    .select("*")
    .in("response_id", responseIds)
    .order("created_at", { ascending: true });
  const attachmentsByResponseId = new Map<string, typeof attachments>();
  for (const attachment of attachments ?? []) {
    const list = attachmentsByResponseId.get(attachment.response_id) ?? [];
    list.push(attachment);
    attachmentsByResponseId.set(attachment.response_id, list);
  }

  return (
    <div className="mt-10">
      <h2 className="text-lg font-medium text-zinc-900">Responses ({responses.length})</h2>
      <Alert className="mt-3">
        <AlertDescription>
          {ccnDisclaimer}
        </AlertDescription>
      </Alert>

      <ul className="mt-4 space-y-4">
        {responses.map((response, index) => {
          const introduction = introductionByResponseId.get(response.id);
          const introduced = introduction?.decision === "approved";
          const supplierLabel = introduced
            ? revealedOrgNameById.get(response.supplier_org_id) ?? anonymousSupplierLabel(index)
            : anonymousSupplierLabel(index);
          const contact = introduced ? revealedProfileByUserId.get(response.created_by) : undefined;

          return (
            <li key={response.id}>
              <Card>
                <CardContent className="space-y-3 pt-6">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-zinc-900">{supplierLabel}</span>
                    <Badge variant={responseStatusBadgeVariant[response.status]}>
                      {responseStatusLabels[response.status]}
                    </Badge>
                  </div>
                  <p className="text-zinc-900">{response.summary}</p>
                  <p className="whitespace-pre-wrap text-sm text-zinc-700">{response.proposed_solution}</p>
                  <div className="grid grid-cols-2 gap-3 border-t pt-3 text-sm sm:grid-cols-4">
                    <div>
                      <p className="text-zinc-500">One-off cost</p>
                      <p className="text-zinc-900">
                        {response.one_off_cost != null ? `£${response.one_off_cost}` : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Recurring cost</p>
                      <p className="text-zinc-900">
                        {response.recurring_cost != null ? `£${response.recurring_cost}` : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-zinc-500">VAT</p>
                      <p className="text-zinc-900">{response.vat_status.replace("_", " ")}</p>
                    </div>
                    <div>
                      <p className="text-zinc-500">Timescale</p>
                      <p className="text-zinc-900">{response.timescale ?? "-"}</p>
                    </div>
                  </div>

                  {(attachmentsByResponseId.get(response.id)?.length ?? 0) > 0 && (
                    <div className="border-t pt-3">
                      <p className="mb-2 text-sm font-medium text-zinc-500">Attachments</p>
                      <AttachmentList
                        attachments={(attachmentsByResponseId.get(response.id) ?? []).map((a) => ({
                          id: a.id,
                          fileName: a.file_name,
                          fileSize: a.file_size,
                        }))}
                        getDownloadUrl={getResponseAttachmentDownloadUrl}
                      />
                    </div>
                  )}

                  {introduced && contact && (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm">
                      <p className="font-medium text-emerald-900">Contact details</p>
                      <p className="text-emerald-800">{contact.full_name}</p>
                      {contact.contact_email && <p className="text-emerald-800">{contact.contact_email}</p>}
                      {contact.phone && <p className="text-emerald-800">{contact.phone}</p>}
                    </div>
                  )}

                  <ResponseCardActions
                    responseId={response.id}
                    requestId={requestId}
                    status={response.status}
                    hasIntroduction={!!introduction}
                  />
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

const ccnDisclaimer =
  "The Care Connector Network hosts the request and introduction process. You remain responsible for checking the supplier, proposed solution, contract, insurance, references, accreditations and suitability.";
