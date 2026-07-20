import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const accountType = user.user_metadata?.account_type === "supplier" ? "supplier" : "care_provider";

  const { data: categories } = await supabase
    .from("categories")
    .select("id, name")
    .order("sort_order");

  return (
    <div className="mx-auto w-full max-w-xl flex-1 px-6 py-16">
      <h1 className="text-2xl font-semibold text-zinc-900">
        {accountType === "supplier" ? "Tell us about your business" : "Tell us about your organisation"}
      </h1>
      <p className="mt-1 text-sm text-zinc-600">
        This takes about two minutes. You can update these details later.
      </p>

      <div className="mt-8">
        <OnboardingForm accountType={accountType} categories={categories ?? []} />
      </div>
    </div>
  );
}
