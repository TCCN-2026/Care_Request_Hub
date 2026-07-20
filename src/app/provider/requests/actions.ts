"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { requestFormSchema, type RequestFormInput } from "@/lib/validation/request";

export interface RequestActionResult {
  error?: string;
}

function toRow(input: RequestFormInput) {
  return {
    title: input.title,
    category_id: input.categoryId,
    description: input.description,
    desired_outcome: input.desiredOutcome || null,
    mandatory_requirements: input.mandatoryRequirements || null,
    postcode_prefix: input.postcodePrefix,
    closing_date: input.closingDate,
  };
}

export async function createRequest(
  input: RequestFormInput,
  submit: boolean,
): Promise<RequestActionResult> {
  const parsed = requestFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  const { userId, orgId, orgType } = await requireCurrentOrg();
  if (orgType !== "care_provider") {
    return { error: "Only care providers can create requests." };
  }

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("requests")
    .insert({
      ...toRow(parsed.data),
      provider_org_id: orgId,
      created_by: userId,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !created) {
    return { error: error?.message ?? "Could not create the request." };
  }

  if (submit) {
    const { error: submitError } = await supabase
      .from("requests")
      .update({ status: "submitted" })
      .eq("id", created.id);
    if (submitError) {
      return { error: submitError.message };
    }
  }

  revalidatePath("/provider/requests");
  redirect(`/provider/requests/${created.id}`);
}

export async function updateRequest(
  id: string,
  input: RequestFormInput,
): Promise<RequestActionResult> {
  const parsed = requestFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("requests").update(toRow(parsed.data)).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/provider/requests/${id}`);
  revalidatePath("/provider/requests");
  return {};
}

export async function submitRequest(id: string): Promise<RequestActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("requests").update({ status: "submitted" }).eq("id", id);
  if (error) {
    return { error: error.message };
  }
  revalidatePath(`/provider/requests/${id}`);
  revalidatePath("/provider/requests");
  return {};
}

export async function cancelRequest(id: string): Promise<RequestActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("requests").update({ status: "cancelled" }).eq("id", id);
  if (error) {
    return { error: error.message };
  }
  revalidatePath(`/provider/requests/${id}`);
  revalidatePath("/provider/requests");
  return {};
}
