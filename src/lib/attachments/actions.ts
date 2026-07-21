"use server";

import { getSignedAttachmentUrl } from "./server-helpers";

export interface AttachmentUrlResult {
  url?: string;
  error?: string;
}

/**
 * Callable from any role's pages (provider, supplier, admin) - access is
 * gated entirely by RLS on the underlying attachment row, not by which
 * route calls this.
 */
export async function getRequestAttachmentDownloadUrl(attachmentId: string): Promise<AttachmentUrlResult> {
  return getSignedAttachmentUrl("request_attachments", attachmentId);
}

export async function getResponseAttachmentDownloadUrl(attachmentId: string): Promise<AttachmentUrlResult> {
  return getSignedAttachmentUrl("response_attachments", attachmentId);
}

export async function getVerificationDocumentDownloadUrl(attachmentId: string): Promise<AttachmentUrlResult> {
  return getSignedAttachmentUrl("verification_documents", attachmentId);
}
