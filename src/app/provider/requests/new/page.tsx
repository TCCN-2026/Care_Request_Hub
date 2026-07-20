import { createClient } from "@/lib/supabase/server";
import { RequestForm } from "../request-form";

export default async function NewRequestPage() {
  const supabase = await createClient();
  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .order("sort_order");

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold text-zinc-900">New request</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Suppliers only ever see the anonymous version of this request - your organisation&apos;s
        identity stays private until you request an introduction.
      </p>
      <div className="mt-8">
        <RequestForm categories={categories ?? []} mode="create" />
      </div>
    </div>
  );
}
