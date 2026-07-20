import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { VerifySupplierButton, SuspendSupplierButton } from "./supplier-actions";

export default async function AdminSuppliersPage() {
  const supabase = await createClient();
  const { data: suppliers } = await supabase
    .from("organisations")
    .select("id, name, status, coverage_prefixes, created_at")
    .eq("type", "supplier")
    .order("created_at", { ascending: false });

  const pending = (suppliers ?? []).filter((s) => s.status === "pending_verification");
  const rest = (suppliers ?? []).filter((s) => s.status !== "pending_verification");

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900">Suppliers</h1>

      <section className="mt-6">
        <h2 className="text-sm font-medium text-zinc-500">Awaiting verification ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Nothing waiting for verification.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {pending.map((supplier) => (
              <li key={supplier.id}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-zinc-900">{supplier.name}</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        Covers: {supplier.coverage_prefixes.join(", ") || "none listed"}
                      </p>
                    </div>
                    <VerifySupplierButton id={supplier.id} />
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-medium text-zinc-500">All other suppliers</h2>
        {rest.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">No other suppliers yet.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {rest.map((supplier) => (
              <li key={supplier.id}>
                <Card>
                  <CardContent className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium text-zinc-900">{supplier.name}</p>
                      <p className="mt-1 text-sm text-zinc-500">
                        Covers: {supplier.coverage_prefixes.join(", ") || "none listed"}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge variant={supplier.status === "active" ? "default" : "destructive"}>
                        {supplier.status === "active" ? "Verified" : "Suspended"}
                      </Badge>
                      {supplier.status === "active" && <SuspendSupplierButton id={supplier.id} />}
                      {supplier.status === "suspended" && <VerifySupplierButton id={supplier.id} />}
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
