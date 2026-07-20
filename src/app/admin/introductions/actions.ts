"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/auth/current-org";

export interface AdminActionResult {
  error?: string;
}

export async function decideIntroduction(
  introductionId: string,
  decision: "approved" | "rejected",
  notes: string,
): Promise<AdminActionResult> {
  const { orgType } = await requireCurrentOrg();
  if (orgType !== "platform_admin") {
    return { error: "Only admins can decide an introduction." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("introductions")
    .update({ decision, decision_notes: notes || null })
    .eq("id", introductionId);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/introductions");
  return {};
}
