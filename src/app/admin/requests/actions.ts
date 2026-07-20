"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { notifyUserByEmail } from "@/lib/notifications/notify-email";

export interface AdminActionResult {
  error?: string;
}

export async function approveAndPublishRequest(id: string): Promise<AdminActionResult> {
  const { orgType, userId } = await requireCurrentOrg();
  if (orgType !== "platform_admin") {
    return { error: "Only admins can approve requests." };
  }

  const supabase = await createClient();
  const { data: updated, error } = await supabase
    .from("requests")
    .update({ status: "open", approved_by: userId, approved_at: new Date().toISOString() })
    .eq("id", id)
    .select("reference, created_by")
    .single();

  if (error) {
    return { error: error.message };
  }

  await notifyUserByEmail(
    updated.created_by,
    `Your request ${updated.reference} is now live`,
    "Suppliers matching your category and area can now see and respond to your request. Sign in to Care Request Hub to see it.",
  );

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
