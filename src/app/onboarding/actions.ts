"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  providerOnboardingSchema,
  supplierOnboardingSchema,
  type ProviderOnboardingInput,
  type SupplierOnboardingInput,
} from "@/lib/validation/auth";

export interface OnboardingResult {
  error?: string;
}

export async function completeProviderOnboarding(
  input: ProviderOnboardingInput,
): Promise<OnboardingResult> {
  const parsed = providerOnboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_organisation_and_join", {
    p_org_type: "care_provider",
    p_org_name: parsed.data.organisationName,
    p_postcode_prefix: parsed.data.postcodePrefix,
    p_coverage_prefixes: null,
    p_full_name: parsed.data.fullName,
    p_job_title: parsed.data.jobTitle || null,
    p_phone: parsed.data.phone || null,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/", "layout");
  return {};
}

export async function completeSupplierOnboarding(
  input: SupplierOnboardingInput,
): Promise<OnboardingResult> {
  const parsed = supplierOnboardingSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Please check the form and try again." };
  }

  const supabase = await createClient();
  const { data: orgId, error } = await supabase.rpc("create_organisation_and_join", {
    p_org_type: "supplier",
    p_org_name: parsed.data.organisationName,
    p_postcode_prefix: null,
    p_coverage_prefixes: parsed.data.coveragePrefixes,
    p_full_name: parsed.data.fullName,
    p_job_title: parsed.data.jobTitle || null,
    p_phone: parsed.data.phone || null,
  });

  if (error) {
    return { error: error.message };
  }

  const { error: categoriesError } = await supabase.from("supplier_categories").insert(
    parsed.data.categoryIds.map((categoryId) => ({
      supplier_org_id: orgId as string,
      category_id: categoryId,
    })),
  );

  if (categoriesError) {
    return { error: categoriesError.message };
  }

  revalidatePath("/", "layout");
  return {};
}
