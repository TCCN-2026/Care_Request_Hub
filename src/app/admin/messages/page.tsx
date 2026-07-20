import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function AdminFlaggedMessagesPage() {
  const supabase = await createClient();

  const { data: flagged } = await supabase
    .from("messages")
    .select("*")
    .eq("flagged", true)
    .order("created_at", { ascending: false });

  if (!flagged || flagged.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Flagged messages</h1>
        <p className="mt-4 text-sm text-zinc-500">No messages have been flagged for review.</p>
      </div>
    );
  }

  const threadIds = [...new Set(flagged.map((m) => m.thread_id))];
  const { data: threads } = await supabase
    .from("message_threads")
    .select("id, request_id, supplier_org_id")
    .in("id", threadIds);
  const threadById = new Map((threads ?? []).map((t) => [t.id, t]));

  const requestIds = [...new Set((threads ?? []).map((t) => t.request_id))];
  const orgIds = [
    ...new Set([...(threads ?? []).map((t) => t.supplier_org_id), ...flagged.map((m) => m.sender_org_id)]),
  ];

  const [{ data: requests }, { data: orgs }] = await Promise.all([
    requestIds.length
      ? supabase.from("requests").select("id, reference, title, provider_org_id").in("id", requestIds)
      : Promise.resolve({ data: [] as { id: string; reference: string; title: string; provider_org_id: string }[] }),
    orgIds.length ? supabase.from("organisations").select("id, name").in("id", orgIds) : Promise.resolve({ data: [] }),
  ]);
  const requestById = new Map((requests ?? []).map((r) => [r.id, r]));
  const orgNameById = new Map((orgs ?? []).map((o) => [o.id, o.name]));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900">Flagged messages ({flagged.length})</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Messages the system thinks might contain contact details or a request to move off-platform.
      </p>

      <ul className="mt-6 space-y-3">
        {flagged.map((message) => {
          const thread = threadById.get(message.thread_id);
          const request = thread ? requestById.get(thread.request_id) : undefined;
          const senderName = orgNameById.get(message.sender_org_id) ?? "Unknown sender";

          return (
            <li key={message.id}>
              <Card>
                <CardContent className="space-y-2 pt-6">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-zinc-500">
                      {request ? (
                        <Link href={`/admin/requests/${request.id}`} className="underline underline-offset-2">
                          {request.reference} &middot; {request.title}
                        </Link>
                      ) : (
                        "Request not found"
                      )}
                    </p>
                    <Badge variant="destructive">Flagged</Badge>
                  </div>
                  <p className="text-sm font-medium text-zinc-900">{senderName}</p>
                  <p className="whitespace-pre-wrap text-sm text-zinc-800">{message.body}</p>
                  <p className="text-xs text-red-700">Reason: {message.flag_reason}</p>
                  <p className="text-xs text-zinc-400">
                    {new Date(message.created_at).toLocaleString("en-GB")}
                  </p>
                </CardContent>
              </Card>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
