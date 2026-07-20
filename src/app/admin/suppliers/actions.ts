"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/auth/current-org";

export interface AdminActionResult {
  error?: string;
}

export async function verifySupplier(orgId: string): Promise<AdminActionResult> {
  const { orgType } = await requireCurrentOrg();
  if (orgType !== "platform_admin") {
    return { error: "Only admins can verify suppliers." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("organisations").update({ status: "active" }).eq("id", orgId);
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/suppliers");
  return {};
}

export async function suspendSupplier(orgId: string): Promise<AdminActionResult> {
  const { orgType } = await requireCurrentOrg();
  if (orgType !== "platform_admin") {
    return { error: "Only admins can suspend suppliers." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("organisations").update({ status: "suspended" }).eq("id", orgId);
  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/suppliers");
  return {};
}
