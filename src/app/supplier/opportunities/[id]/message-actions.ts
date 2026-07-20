"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { getOrCreateThread } from "@/lib/messages/server-helpers";

export interface MessageActionResult {
  error?: string;
}

export async function sendSupplierMessage(requestId: string, body: string): Promise<MessageActionResult> {
  const trimmed = body.trim();
  if (trimmed.length === 0) {
    return { error: "Enter a message before sending." };
  }
  if (trimmed.length > 4000) {
    return { error: "Message is too long (4000 characters max)." };
  }

  const { userId, orgId } = await requireCurrentOrg();
  const supabase = await createClient();

  const { threadId, error: threadError } = await getOrCreateThread(supabase, requestId, orgId);
  if (!threadId) {
    return { error: threadError };
  }

  const { error } = await supabase.from("messages").insert({
    thread_id: threadId,
    sender_org_id: orgId,
    sender_user_id: userId,
    body: trimmed,
  });
  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/supplier/opportunities/${requestId}`);
  return {};
}
