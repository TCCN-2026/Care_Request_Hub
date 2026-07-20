import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { getProviderLiveRequestCount, FREE_LIVE_REQUEST_LIMIT } from "@/lib/domain/membership";
import { MembershipToggle } from "./membership-toggle";

export default async function AdminOrganisationsPage() {
  const supabase = await createClient();

  const { data: orgs } = await supabase
    .from("organisations")
    .select("id, type, name, status, is_ccn_member")
    .in("type", ["care_provider", "supplier"])
    .order("type")
    .order("name");

  const providerOrgs = (orgs ?? []).filter((o) => o.type === "care_provider");
  const supplierOrgs = (orgs ?? []).filter((o) => o.type === "supplier");

  const liveCounts = await Promise.all(
    providerOrgs.map((o) => getProviderLiveRequestCount(supabase, o.id)),
  );
  const liveCountByOrgId = new Map(providerOrgs.map((o, i) => [o.id, liveCounts[i]]));

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900">Organisations</h1>
      <p className="mt-1 text-sm text-zinc-500">
        Membership is set manually for now - members get unlimited live requests (providers) or can
        see and respond to live requests at all (suppliers).
      </p>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-zinc-500">Care providers</h2>
        {providerOrgs.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No provider organisations yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {providerOrgs.map((org) => {
              const liveCount = liveCountByOrgId.get(org.id) ?? 0;
              return (
                <li key={org.id}>
                  <Card>
                    <CardContent className="flex items-center justify-between gap-4">
                      <div>
                        <p className="font-medium text-zinc-900">{org.name}</p>
                        <p className="mt-1 text-sm text-zinc-500">
                          {org.is_ccn_member
                            ? "Unlimited live requests"
                            : `${liveCount} of ${FREE_LIVE_REQUEST_LIMIT} free live requests used`}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={org.is_ccn_member ? "default" : "outline"}>
                          {org.is_ccn_member ? "CCN member" : "Not a member"}
                        </Badge>
                        <MembershipToggle orgId={org.id} isMember={org.is_ccn_member} />
                      </div>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-zinc-500">Suppliers</h2>
        {supplierOrgs.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No supplier organisations yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {supplierOrgs.map((org) => (
              <li key={org.id}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-zinc-900">{org.name}</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {org.status === "active" ? "Verified" : org.status === "suspended" ? "Suspended" : "Awaiting verification"}
                        {!org.is_ccn_member && " · Can't see live requests until a CCN member"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={org.is_ccn_member ? "default" : "outline"}>
                        {org.is_ccn_member ? "CCN member" : "Not a member"}
                      </Badge>
                      <MembershipToggle orgId={org.id} isMember={org.is_ccn_member} />
                    </div>
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
