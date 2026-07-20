import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  const [
    { count: pendingRequests },
    { count: pendingSuppliers },
    { count: openRequests },
    { count: pendingIntroductions },
    { count: flaggedMessages },
  ] = await Promise.all([
    supabase.from("requests").select("id", { count: "exact", head: true }).eq("status", "submitted"),
    supabase
      .from("organisations")
      .select("id", { count: "exact", head: true })
      .eq("type", "supplier")
      .eq("status", "pending_verification"),
    supabase.from("requests").select("id", { count: "exact", head: true }).eq("status", "open"),
    supabase.from("introductions").select("id", { count: "exact", head: true }).eq("decision", "pending"),
    supabase.from("messages").select("id", { count: "exact", head: true }).eq("flagged", true),
  ]);

  const tiles = [
    { label: "Requests awaiting review", value: pendingRequests ?? 0, href: "/admin/requests" },
    { label: "Suppliers awaiting verification", value: pendingSuppliers ?? 0, href: "/admin/suppliers" },
    { label: "Live requests", value: openRequests ?? 0, href: "/admin/requests" },
    { label: "Introduction requests pending", value: pendingIntroductions ?? 0, href: "/admin/introductions" },
    { label: "Flagged messages", value: flaggedMessages ?? 0, href: "/admin/messages" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900">Admin dashboard</h1>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <Link key={tile.label} href={tile.href}>
            <Card className="transition-colors hover:border-zinc-400">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-zinc-500">{tile.label}</CardTitle>
              </CardHeader>
              <CardContent className="text-3xl font-semibold text-zinc-900">{tile.value}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
