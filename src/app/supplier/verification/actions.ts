"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { ATTACHMENT_BUCKET, sanitizeFileName } from "@/lib/attachments/constants";
import { validateUploadedFile } from "@/lib/attachments/server-helpers";
import type { VerificationDocumentType } from "@/types/domain";

export interface VerificationActionResult {
  error?: string;
}

export async function uploadVerificationDocument(
  documentType: VerificationDocumentType,
  formData: FormData,
): Promise<VerificationActionResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "No file was provided." };
  }
  const validation = validateUploadedFile(file);
  if (validation.error) {
    return validation;
  }

  const { userId, orgId, orgType } = await requireCurrentOrg();
  if (orgType !== "supplier") {
    return { error: "Only suppliers can upload verification documents." };
  }

  const supabase = await createClient();
  const documentId = crypto.randomUUID();
  const storagePath = `verification/${orgId}/${documentId}-${sanitizeFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    return { error: uploadError.message };
  }

  const { error: insertError } = await supabase.from("verification_documents").insert({
    id: documentId,
    supplier_org_id: orgId,
    document_type: documentType,
    storage_path: storagePath,
    file_name: sanitizeFileName(file.name),
    file_size: file.size,
    mime_type: file.type,
    uploaded_by: userId,
  });
  if (insertError) {
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([storagePath]);
    return { error: insertError.message };
  }

  revalidatePath("/supplier/verification");
  return {};
}

export async function deleteVerificationDocument(documentId: string): Promise<VerificationActionResult> {
  const supabase = await createClient();

  const { data: document } = await supabase
    .from("verification_documents")
    .select("storage_path")
    .eq("id", documentId)
    .maybeSingle();
  if (!document) {
    return { error: "Document not found." };
  }

  const { error: deleteError } = await supabase.from("verification_documents").delete().eq("id", documentId);
  if (deleteError) {
    return { error: deleteError.message };
  }

  await supabase.storage.from(ATTACHMENT_BUCKET).remove([document.storage_path]);

  revalidatePath("/supplier/verification");
  return {};
}
