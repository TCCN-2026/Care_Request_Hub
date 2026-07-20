import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { introductionDecisionLabels } from "@/lib/domain/status-labels";
import { IntroductionDecisionForm } from "./introduction-actions";

export default async function AdminIntroductionsPage() {
  const supabase = await createClient();

  const { data: introductions } = await supabase
    .from("introductions")
    .select("*")
    .order("requested_at", { ascending: false });

  if (!introductions || introductions.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Introductions</h1>
        <p className="mt-4 text-sm text-zinc-500">No introduction requests yet.</p>
      </div>
    );
  }

  const requestIds = [...new Set(introductions.map((i) => i.request_id))];
  const orgIds = [...new Set(introductions.flatMap((i) => [i.provider_org_id, i.supplier_org_id]))];
  const responseIds = [...new Set(introductions.map((i) => i.response_id))];

  const [{ data: requests }, { data: orgs }, { data: responses }] = await Promise.all([
    supabase.from("requests").select("id, reference, title").in("id", requestIds),
    supabase.from("organisations").select("id, name").in("id", orgIds),
    supabase.from("responses").select("id, summary").in("id", responseIds),
  ]);

  const requestById = new Map((requests ?? []).map((r) => [r.id, r]));
  const orgNameById = new Map((orgs ?? []).map((o) => [o.id, o.name]));
  const responseById = new Map((responses ?? []).map((r) => [r.id, r]));

  const pending = introductions.filter((i) => i.decision === "pending");
  const decided = introductions.filter((i) => i.decision !== "pending");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900">Introductions</h1>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-zinc-500">Awaiting review ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Nothing waiting for review.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {pending.map((intro) => (
              <li key={intro.id}>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-zinc-500">{intro.reference}</p>
                    <p className="font-medium text-zinc-900">
                      {requestById.get(intro.request_id)?.reference} &middot;{" "}
                      {requestById.get(intro.request_id)?.title}
                    </p>
                    <p className="mt-1 text-sm text-zinc-700">
                      Provider: {orgNameById.get(intro.provider_org_id)} &rarr; Supplier:{" "}
                      {orgNameById.get(intro.supplier_org_id)}
                    </p>
                    <p className="mt-2 text-sm text-zinc-600">{responseById.get(intro.response_id)?.summary}</p>
                    <IntroductionDecisionForm introductionId={intro.id} />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-zinc-500">Decided</h2>
        {decided.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No decisions made yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {decided.map((intro) => (
              <li key={intro.id}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm text-zinc-500">{intro.reference}</p>
                      <p className="font-medium text-zinc-900">
                        {orgNameById.get(intro.provider_org_id)} &rarr; {orgNameById.get(intro.supplier_org_id)}
                      </p>
                    </div>
                    <Badge variant={intro.decision === "approved" ? "default" : "destructive"}>
                      {introductionDecisionLabels[intro.decision]}
                    </Badge>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
