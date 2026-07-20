import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { requestStatusLabels } from "@/lib/domain/status-labels";
import type { RequestStatus } from "@/types/domain";

export default async function ProviderDashboardPage() {
  const { orgId } = await requireCurrentOrg();
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("requests")
    .select("status")
    .eq("provider_org_id", orgId);

  const counts = (requests ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  const summaryStatuses: RequestStatus[] = ["draft", "submitted", "open", "closed_to_responses"];

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>
        <Button asChild>
          <Link href="/provider/requests/new">New request</Link>
        </Button>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summaryStatuses.map((status) => (
          <Card key={status}>
            <CardHeader>
              <CardTitle className="text-sm font-medium text-zinc-500">
                {requestStatusLabels[status]}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-3xl font-semibold text-zinc-900">
              {counts[status] ?? 0}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8">
        <Link href="/provider/requests" className="text-sm font-medium text-zinc-900 underline underline-offset-2">
          View all requests
        </Link>
      </div>
    </div>
  );
}
