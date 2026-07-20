"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface ProviderResponseActionResult {
  error?: string;
}

export async function shortlistResponse(
  responseId: string,
  requestId: string,
): Promise<ProviderResponseActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("responses").update({ status: "shortlisted" }).eq("id", responseId);
  if (error) {
    return { error: error.message };
  }
  revalidatePath(`/provider/requests/${requestId}`);
  return {};
}

export async function declineResponse(
  responseId: string,
  requestId: string,
): Promise<ProviderResponseActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("responses").update({ status: "declined" }).eq("id", responseId);
  if (error) {
    return { error: error.message };
  }
  revalidatePath(`/provider/requests/${requestId}`);
  return {};
}

export async function requestIntroduction(
  responseId: string,
  requestId: string,
): Promise<ProviderResponseActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("introductions").insert({
    request_id: requestId,
    response_id: responseId,
  });
  if (error) {
    return { error: error.message };
  }
  revalidatePath(`/provider/requests/${requestId}`);
  return {};
}
