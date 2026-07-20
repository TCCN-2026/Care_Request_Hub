"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { responseFormSchema, type ResponseFormInput } from "@/lib/validation/response";

export interface ResponseActionResult {
  error?: string;
}

function toRow(input: ResponseFormInput) {
  return {
    summary: input.summary,
    proposed_solution: input.proposedSolution,
    one_off_cost: input.oneOffCost ?? null,
    recurring_cost: input.recurringCost ?? null,
    vat_status: input.vatStatus,
    timescale: input.timescale || null,
  };
}

export async function createResponse(
  requestId: string,
  input: ResponseFormInput,
  submit: boolean,
): Promise<ResponseActionResult> {
  const parsed = responseFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  const { userId, orgId, orgType } = await requireCurrentOrg();
  if (orgType !== "supplier") {
    return { error: "Only suppliers can respond to requests." };
  }

  const supabase = await createClient();
  const { data: created, error } = await supabase
    .from("responses")
    .insert({
      ...toRow(parsed.data),
      request_id: requestId,
      supplier_org_id: orgId,
      created_by: userId,
      status: "draft",
    })
    .select("id")
    .single();

  if (error || !created) {
    return { error: error?.message ?? "Could not save your response." };
  }

  if (submit) {
    const { error: submitError } = await supabase
      .from("responses")
      .update({ status: "submitted" })
      .eq("id", created.id);
    if (submitError) {
      return { error: submitError.message };
    }
  }

  revalidatePath("/supplier/opportunities");
  revalidatePath("/supplier/responses");
  redirect(`/supplier/opportunities/${requestId}`);
}

export async function updateResponse(
  id: string,
  input: ResponseFormInput,
): Promise<ResponseActionResult> {
  const parsed = responseFormSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("responses").update(toRow(parsed.data)).eq("id", id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/supplier/opportunities");
  revalidatePath("/supplier/responses");
  return {};
}

export async function submitResponse(id: string): Promise<ResponseActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("responses").update({ status: "submitted" }).eq("id", id);
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/supplier/opportunities");
  revalidatePath("/supplier/responses");
  return {};
}

export async function withdrawResponse(id: string): Promise<ResponseActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("responses").update({ status: "withdrawn" }).eq("id", id);
  if (error) {
    return { error: error.message };
  }
  revalidatePath("/supplier/opportunities");
  revalidatePath("/supplier/responses");
  return {};
}
