import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { responseStatusLabels, responseStatusBadgeVariant } from "@/lib/domain/status-labels";

export default async function SupplierResponsesPage() {
  const { orgId } = await requireCurrentOrg();
  const supabase = await createClient();

  const { data: responses } = await supabase
    .from("responses")
    .select("id, request_id, status, updated_at")
    .eq("supplier_org_id", orgId)
    .order("updated_at", { ascending: false });

  const requestIds = [...new Set((responses ?? []).map((r) => r.request_id))];
  const { data: requests } = requestIds.length
    ? await supabase.from("requests").select("id, reference, title").in("id", requestIds)
    : { data: [] };
  const requestById = new Map((requests ?? []).map((r) => [r.id, r]));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900">My responses</h1>

      {responses && responses.length > 0 ? (
        <ul className="mt-6 space-y-3">
          {responses.map((response) => {
            const request = requestById.get(response.request_id);
            return (
              <li key={response.id}>
                <Link href={`/supplier/opportunities/${response.request_id}`}>
                  <Card className="transition-colors hover:border-zinc-400">
                    <CardContent className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-zinc-500">{request?.reference}</p>
                        <p className="font-medium text-zinc-900">{request?.title}</p>
                      </div>
                      <Badge variant={responseStatusBadgeVariant[response.status]}>
                        {responseStatusLabels[response.status]}
                      </Badge>
                    </CardContent>
                  </Card>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card className="mt-6">
          <CardContent className="py-10 text-center text-zinc-600">
            You haven&apos;t responded to any requests yet.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
