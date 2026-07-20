"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { ATTACHMENT_BUCKET, sanitizeFileName } from "@/lib/attachments/constants";
import { validateUploadedFile } from "@/lib/attachments/server-helpers";

export interface AttachmentActionResult {
  error?: string;
}

export async function uploadResponseAttachment(
  responseId: string,
  requestId: string,
  formData: FormData,
): Promise<AttachmentActionResult> {
  const file = formData.get("file");

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
    .from("response_attachments")
    .select("id", { count: "exact", head: true })
    .eq("response_id", responseId);
  if ((count ?? 0) >= 5) {
    return { error: "You can attach up to 5 files per response." };
  }

  const attachmentId = crypto.randomUUID();
  const storagePath = `responses/${responseId}/${attachmentId}-${sanitizeFileName(file.name)}`;

  const { error: uploadError } = await supabase.storage.from(ATTACHMENT_BUCKET).upload(storagePath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    return { error: uploadError.message };
  }

  const { error: insertError } = await supabase.from("response_attachments").insert({
    id: attachmentId,
    response_id: responseId,
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

  revalidatePath(`/supplier/opportunities/${requestId}`);
  return {};
}

export async function deleteResponseAttachment(attachmentId: string): Promise<AttachmentActionResult> {
  const supabase = await createClient();

  const { data: attachment } = await supabase
    .from("response_attachments")
    .select("storage_path, response_id")
    .eq("id", attachmentId)
    .maybeSingle();
  if (!attachment) {
    return { error: "Attachment not found." };
  }

  const { data: response } = await supabase
    .from("responses")
    .select("request_id")
    .eq("id", attachment.response_id)
    .maybeSingle();

  const { error: deleteError } = await supabase.from("response_attachments").delete().eq("id", attachmentId);
  if (deleteError) {
    return { error: deleteError.message };
  }

  await supabase.storage.from(ATTACHMENT_BUCKET).remove([attachment.storage_path]);

  if (response) {
    revalidatePath(`/supplier/opportunities/${response.request_id}`);
  }
  return {};
}
