"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { notifyUserByEmail } from "@/lib/notifications/notify-email";

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
  const { data: updated, error } = await supabase
    .from("introductions")
    .update({ decision, decision_notes: notes || null })
    .eq("id", introductionId)
    .select("reference, requested_by, response_id")
    .single();

  if (error) {
    return { error: error.message };
  }

  if (decision === "approved") {
    const { data: response } = await supabase
      .from("responses")
      .select("created_by")
      .eq("id", updated.response_id)
      .maybeSingle();

    await Promise.all([
      notifyUserByEmail(
        updated.requested_by,
        `Introduction approved for ${updated.reference}`,
        "The supplier's contact details are now available on the request page.",
      ),
      response
        ? notifyUserByEmail(
            response.created_by,
            `Introduction approved for ${updated.reference}`,
            "The provider's contact details are now available on this response.",
          )
        : Promise.resolve(),
    ]);
  } else {
    await notifyUserByEmail(
      updated.requested_by,
      `Introduction request declined for ${updated.reference}`,
      notes || "The Care Connector Network was unable to approve this introduction.",
    );
  }

  revalidatePath("/admin/introductions");
  return {};
}
