"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { ATTACHMENT_BUCKET, sanitizeFileName } from "@/lib/attachments/constants";
import { validateUploadedFile } from "@/lib/attachments/server-helpers";

export interface AttachmentActionResult {
  error?: string;
}

export async function uploadRequestAttachment(
  requestId: string,
  formData: FormData,
): Promise<AttachmentActionResult> {
  const file = formData.get("file");
  const visibleToSuppliers = formData.get("visibleToSuppliers") === "true";

  if (!(file instanceof File)) {
    return { error: "No file was provided." };
  }
  const validation = validateUploadedFile(file);
  if (validation.error) {
    return validation;
  }

  const { userId } = await requireCurrentOrg();
  const supabase = await createClient();

  const { count } = await supabase
    .from("request_attachments")
    .select("id", { count: "exact", head: true })
    .eq("request_id", requestId);
  if ((count ?? 0) >= 5) {
    return { error: "You can attach up to 5 files per request." };
  }

  const attachmentId = crypto.randomUUID();
  const storagePath = `requests/${requestId}/${attachmentId}-${sanitizeFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    return { error: uploadError.message };
  }

  const { error: insertError } = await supabase.from("request_attachments").insert({
    id: attachmentId,
    request_id: requestId,
    storage_path: storagePath,
    file_name: sanitizeFileName(file.name),
    file_size: file.size,
    mime_type: file.type,
    visible_to_suppliers: visibleToSuppliers,
    uploaded_by: userId,
  });
  if (insertError) {
    await supabase.storage.from(ATTACHMENT_BUCKET).remove([storagePath]);
    return { error: insertError.message };
  }

  revalidatePath(`/provider/requests/${requestId}`);
  return {};
}

export async function deleteRequestAttachment(attachmentId: string): Promise<AttachmentActionResult> {
  const supabase = await createClient();

  const { data: attachment } = await supabase
    .from("request_attachments")
    .select("storage_path, request_id")
    .eq("id", attachmentId)
    .maybeSingle();
  if (!attachment) {
    return { error: "Attachment not found." };
  }

  const { error: deleteError } = await supabase.from("request_attachments").delete().eq("id", attachmentId);
  if (deleteError) {
    return { error: deleteError.message };
  }

  await supabase.storage.from(ATTACHMENT_BUCKET).remove([attachment.storage_path]);

  revalidatePath(`/provider/requests/${attachment.request_id}`);
  return {};
}
