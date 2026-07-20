import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { requestStatusLabels, requestStatusBadgeVariant } from "@/lib/domain/status-labels";

export default async function ProviderRequestsPage() {
  const { orgId } = await requireCurrentOrg();
  const supabase = await createClient();
  const { data: requests } = await supabase
    .from("requests")
    .select("id, reference, title, status, closing_date, created_at")
    .eq("provider_org_id", orgId)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-zinc-900">Your requests</h1>
        <Button asChild>
          <Link href="/provider/requests/new">New request</Link>
        </Button>
      </div>

      {requests && requests.length > 0 ? (
        <ul className="mt-6 space-y-3">
          {requests.map((request) => (
            <li key={request.id}>
              <Link href={`/provider/requests/${request.id}`}>
                <Card className="transition-colors hover:border-zinc-400">
                  <CardContent className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-zinc-500">{request.reference}</p>
                      <p className="font-medium text-zinc-900">{request.title}</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        Closes {new Date(request.closing_date).toLocaleDateString("en-GB")}
                      </p>
                    </div>
                    <Badge variant={requestStatusBadgeVariant[request.status]}>
                      {requestStatusLabels[request.status]}
                    </Badge>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <Card className="mt-6">
          <CardContent className="py-10 text-center text-zinc-600">
            You haven&apos;t created any requests yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
