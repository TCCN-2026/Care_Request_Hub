"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/auth/current-org";

export interface AdminActionResult {
  error?: string;
}

export async function approveAndPublishRequest(id: string): Promise<AdminActionResult> {
  const { orgType, userId } = await requireCurrentOrg();
  if (orgType !== "platform_admin") {
    return { error: "Only admins can approve requests." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("requests")
    .update({ status: "open", approved_by: userId, approved_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/requests");
  revalidatePath(`/admin/requests/${id}`);
  return {};
}

export async function closeRequestToResponses(id: string): Promise<AdminActionResult> {
  const { orgType } = await requireCurrentOrg();
  if (orgType !== "platform_admin") {
    return { error: "Only admins can close a request." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("requests")
    .update({ status: "closed_to_responses" })
    .eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/admin/requests");
  revalidatePath(`/admin/requests/${id}`);
  return {};
}
