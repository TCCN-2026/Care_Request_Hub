import Link from "next/link";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/auth/current-org";

export default async function SupplierDashboardPage() {
  const { orgId } = await requireCurrentOrg();
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organisations")
    .select("status")
    .eq("id", orgId)
    .maybeSingle();

  const { data: responses } = await supabase
    .from("responses")
    .select("status")
    .eq("supplier_org_id", orgId);

  const counts = (responses ?? []).reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900">Dashboard</h1>

      {org?.status === "pending_verification" && (
        <Alert className="mt-6">
          <AlertTitle>Your account is awaiting verification</AlertTitle>
          <AlertDescription>
            Once The Care Connector Network verifies your organisation, you&apos;ll be able to see
            and respond to matching requests.
          </AlertDescription>
        </Alert>
      )}

      {org?.status === "suspended" && (
        <Alert variant="destructive" className="mt-6">
          <AlertTitle>Your account is suspended</AlertTitle>
          <AlertDescription>Contact support if you believe this is a mistake.</AlertDescription>
        </Alert>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-500">Draft responses</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-zinc-900">{counts.draft ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-500">Submitted responses</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-zinc-900">{counts.submitted ?? 0}</CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-zinc-500">Shortlisted</CardTitle>
          </CardHeader>
          <CardContent className="text-3xl font-semibold text-zinc-900">{counts.shortlisted ?? 0}</CardContent>
        </Card>
      </div>

      {org?.status === "active" && (
        <div className="mt-8">
          <Link href="/supplier/opportunities" className="text-sm font-medium text-zinc-900 underline underline-offset-2">
            View open opportunities
          </Link>
        </div>
      )}
    </div>
  );
}
