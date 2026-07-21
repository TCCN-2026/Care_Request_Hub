import "server-only";
import { createClient } from "@/lib/supabase/server";
import {
  ATTACHMENT_BUCKET,
  MAX_ATTACHMENT_SIZE_BYTES,
  SIGNED_URL_EXPIRY_SECONDS,
  isAllowedMimeType,
  formatFileSize,
} from "./constants";

export function validateUploadedFile(file: File): { error?: string } {
  if (file.size === 0) {
    return { error: "The selected file is empty." };
  }
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return { error: `File is too large - the maximum size is ${formatFileSize(MAX_ATTACHMENT_SIZE_BYTES)}.` };
  }
  if (!isAllowedMimeType(file.type)) {
    return { error: "That file type isn't supported. Use a PDF, Word, Excel or image file." };
  }
  return {};
}

/**
 * Fetches a short-lived signed download URL for an attachment, gated by
 * the same RLS policy that protects the metadata row - if the caller can't
 * see the row, they can't get a URL, regardless of whether they know or
 * can guess the storage path.
 */
export async function getSignedAttachmentUrl(
  table: "request_attachments" | "response_attachments" | "verification_documents",
  attachmentId: string,
): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const { data: attachment, error } = await supabase
    .from(table)
    .select("storage_path")
    .eq("id", attachmentId)
    .maybeSingle();

  if (error || !attachment) {
    return { error: "Attachment not found or you don't have permission to view it." };
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(ATTACHMENT_BUCKET)
    .createSignedUrl(attachment.storage_path, SIGNED_URL_EXPIRY_SECONDS);

  if (signError || !signed) {
    return { error: signError?.message ?? "Could not generate a download link." };
  }

  return { url: signed.signedUrl };
}
