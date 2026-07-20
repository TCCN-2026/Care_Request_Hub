export const ATTACHMENT_BUCKET = "attachments";
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB, matches the storage bucket's file_size_limit
export const MAX_ATTACHMENTS_PER_ENTITY = 5;
export const SIGNED_URL_EXPIRY_SECONDS = 300; // 5 minutes

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
] as const;

export function isAllowedMimeType(mimeType: string): boolean {
  return (ALLOWED_ATTACHMENT_MIME_TYPES as readonly string[]).includes(mimeType);
}

/**
 * Strips anything that isn't a safe display/storage character. The storage
 * key itself is always prefixed with the attachment's own UUID, so this is
 * about avoiding path traversal and control characters in the human-facing
 * file name, not about uniqueness.
 */
export function sanitizeFileName(originalName: string): string {
  const trimmed = originalName.trim().slice(-150);
  const safe = trimmed.replace(/[^a-zA-Z0-9.\-_ ]/g, "_");
  return safe.length > 0 ? safe : "file";
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
