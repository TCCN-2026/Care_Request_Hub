import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  requestStatusLabels,
  requestStatusBadgeVariant,
  urgencyLevelLabels,
  urgencyLevelBadgeVariant,
} from "@/lib/domain/status-labels";
import { formatBudgetRange } from "@/lib/domain/format";
import { ApproveRequestButton, CloseRequestButton } from "./admin-request-actions";
import { getRequestAttachmentDownloadUrl } from "@/lib/attachments/actions";
import { AttachmentList } from "@/components/attachments/attachment-list";
import { MessageThread } from "@/components/messages/message-thread";
import { getProviderLiveRequestCount, FREE_LIVE_REQUEST_LIMIT } from "@/lib/domain/membership";

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
    .select("name, postcode_prefix, is_ccn_member")
    .eq("id", request.provider_org_id)
    .maybeSingle();

  const liveRequestCount = await getProviderLiveRequestCount(supabase, request.provider_org_id);
  const blockedByLimit =
    !providerOrg?.is_ccn_member && !request.paid_per_request && liveRequestCount >= FREE_LIVE_REQUEST_LIMIT;

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
        <div className="flex gap-2">
          <Badge variant={urgencyLevelBadgeVariant[request.urgency]}>{urgencyLevelLabels[request.urgency]}</Badge>
          <Badge variant={requestStatusBadgeVariant[request.status]}>
            {requestStatusLabels[request.status]}
          </Badge>
        </div>
      </div>
      <p className="mt-1 text-sm text-zinc-500">
        {request.reference} &middot; {providerOrg?.name ?? "Unknown organisation"} &middot; {category?.name}
      </p>
      <p className="mt-1 text-sm text-zinc-500">
        {providerOrg?.is_ccn_member
          ? "CCN member - unlimited live requests"
          : `${liveRequestCount} of ${FREE_LIVE_REQUEST_LIMIT} free live requests used`}
        {request.paid_per_request && " · Marked paid-per-request"}
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
            <div>
              <h2 className="text-sm font-medium text-zinc-500">Budget range</h2>
              <p className="mt-1 text-zinc-900">
                {formatBudgetRange(request.budget_min, request.budget_max, request.budget_includes_vat) ??
                  "Not given"}
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
        {request.status === "submitted" && (
          <ApproveRequestButton id={request.id} blockedByLimit={blockedByLimit} />
        )}
        {request.status === "open" && <CloseRequestButton id={request.id} />}
      </div>

      <AdminMessages requestId={id} providerName={providerOrg?.name ?? "Provider"} />
    </div>
  );
}

async function AdminMessages({ requestId, providerName }: { requestId: string; providerName: string }) {
  const supabase = await createClient();

  const { data: threads } = await supabase
    .from("message_threads")
    .select("id, supplier_org_id")
    .eq("request_id", requestId);

  if (!threads || threads.length === 0) {
    return (
      <div className="mt-10">
        <h2 className="text-lg font-medium text-zinc-900">Messages</h2>
        <p className="mt-2 text-sm text-zinc-500">No conversations yet.</p>
      </div>
    );
  }

  const supplierOrgIds = threads.map((t) => t.supplier_org_id);
  const threadIds = threads.map((t) => t.id);

  const [{ data: supplierOrgs }, { data: allMessages }] = await Promise.all([
    supabase.from("organisations").select("id, name").in("id", supplierOrgIds),
    supabase.from("messages").select("*").in("thread_id", threadIds).order("created_at", { ascending: true }),
  ]);
  const supplierNameById = new Map((supplierOrgs ?? []).map((o) => [o.id, o.name]));

  const messagesByThreadId = new Map<string, typeof allMessages>();
  for (const message of allMessages ?? []) {
    const list = messagesByThreadId.get(message.thread_id) ?? [];
    list.push(message);
    messagesByThreadId.set(message.thread_id, list);
  }

  return (
    <div className="mt-10">
      <h2 className="text-lg font-medium text-zinc-900">Messages</h2>
      <p className="mt-1 text-sm text-zinc-500">Admins see real organisation names; providers and suppliers don&apos;t, until an introduction is approved.</p>

      <ul className="mt-4 space-y-4">
        {threads.map((thread) => {
          const supplierName = supplierNameById.get(thread.supplier_org_id) ?? "Unknown supplier";
          const messages = messagesByThreadId.get(thread.id) ?? [];

          return (
            <li key={thread.id}>
              <Card>
                <CardContent className="pt-6">
                  <h3 className="mb-3 font-medium text-zinc-900">
                    {providerName} &harr; {supplierName}
                  </h3>
                  <MessageThread
                    messages={messages.map((m) => ({
                      id: m.id,
                      body: m.body,
                      createdAt: m.created_at,
                      isOwnMessage: false,
                      senderLabel: m.sender_org_id === thread.supplier_org_id ? supplierName : providerName,
                      flagged: m.flagged,
                      flagReason: m.flag_reason,
                    }))}
                    showFlags
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
