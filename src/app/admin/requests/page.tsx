import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import {
  requestStatusLabels,
  requestStatusBadgeVariant,
  urgencyLevelLabels,
  urgencyLevelBadgeVariant,
} from "@/lib/domain/status-labels";

export default async function AdminRequestsPage() {
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("requests")
    .select("id, reference, title, status, urgency, provider_org_id, submitted_at, created_at")
    .order("created_at", { ascending: false });

  const orgIds = [...new Set((requests ?? []).map((r) => r.provider_org_id))];
  const { data: orgs } = orgIds.length
    ? await supabase.from("organisations").select("id, name").in("id", orgIds)
    : { data: [] };
  const orgNameById = new Map((orgs ?? []).map((o) => [o.id, o.name]));

  const pending = (requests ?? []).filter((r) => r.status === "submitted");
  const rest = (requests ?? []).filter((r) => r.status !== "submitted");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900">Requests</h1>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-zinc-500">Awaiting review ({pending.length})</h2>
        <RequestList requests={pending} orgNameById={orgNameById} emptyLabel="Nothing waiting for review." />
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-zinc-500">All other requests</h2>
        <RequestList requests={rest} orgNameById={orgNameById} emptyLabel="No other requests yet." />
      </section>
    </div>
  );
}

function RequestList({
  requests,
  orgNameById,
  emptyLabel,
}: {
  requests: {
    id: string;
    reference: string;
    title: string;
    status: keyof typeof requestStatusLabels;
    urgency: keyof typeof urgencyLevelLabels;
    provider_org_id: string;
  }[];
  orgNameById: Map<string, string>;
  emptyLabel: string;
}) {
  if (requests.length === 0) {
    return <p className="mt-3 text-sm text-zinc-500">{emptyLabel}</p>;
  }

  return (
    <ul className="mt-3 space-y-3">
      {requests.map((request) => (
        <li key={request.id}>
          <Link href={`/admin/requests/${request.id}`}>
            <Card className="transition-colors hover:border-zinc-400">
              <CardContent className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm text-zinc-500">
                    {request.reference} &middot; {orgNameById.get(request.provider_org_id) ?? "Unknown organisation"}
                  </p>
                  <p className="font-medium text-zinc-900">{request.title}</p>
                </div>
                <div className="flex gap-2">
                  <Badge variant={urgencyLevelBadgeVariant[request.urgency]}>
                    {urgencyLevelLabels[request.urgency]}
                  </Badge>
                  <Badge variant={requestStatusBadgeVariant[request.status]}>
                    {requestStatusLabels[request.status]}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
