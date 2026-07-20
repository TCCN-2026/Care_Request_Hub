"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/auth/current-org";

export interface AdminActionResult {
  error?: string;
}

export async function setOrganisationMembership(
  orgId: string,
  isMember: boolean,
): Promise<AdminActionResult> {
  const { orgType } = await requireCurrentOrg();
  if (orgType !== "platform_admin") {
    return { error: "Only admins can change membership." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("organisations").update({ is_ccn_member: isMember }).eq("id", orgId);
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/organisations");
  revalidatePath("/admin/suppliers");
  return {};
}
