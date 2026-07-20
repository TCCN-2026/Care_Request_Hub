"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatFileSize } from "@/lib/attachments/constants";

export interface AttachmentListItem {
  id: string;
  fileName: string;
  fileSize: number;
  visibleToSuppliers?: boolean;
}

export function AttachmentList({
  attachments,
  getDownloadUrl,
  onDelete,
  canDelete,
}: {
  attachments: AttachmentListItem[];
  getDownloadUrl: (id: string) => Promise<{ url?: string; error?: string }>;
  onDelete?: (id: string) => Promise<{ error?: string }>;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload(id: string) {
    setError(null);
    setPendingId(id);
    const result = await getDownloadUrl(id);
    setPendingId(null);
    if (result.error || !result.url) {
      setError(result.error ?? "Could not generate a download link.");
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  async function handleDelete(id: string) {
    if (!onDelete) return;
    setError(null);
    setPendingId(id);
    const result = await onDelete(id);
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (attachments.length === 0) {
    return <p className="text-sm text-zinc-500">No files attached.</p>;
  }

  return (
    <div className="space-y-2">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200">
        {attachments.map((attachment) => (
          <li key={attachment.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-900">{attachment.fileName}</p>
              <p className="text-xs text-zinc-500">
                {formatFileSize(attachment.fileSize)}
                {attachment.visibleToSuppliers !== undefined && (
                  <>
                    {" · "}
                    <Badge variant={attachment.visibleToSuppliers ? "default" : "outline"} className="align-middle">
                      {attachment.visibleToSuppliers ? "Visible to suppliers" : "Private"}
                    </Badge>
                  </>
                )}
              </p>
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pendingId === attachment.id}
                onClick={() => handleDownload(attachment.id)}
              >
                {pendingId === attachment.id ? "Preparing…" : "Download"}
              </Button>
              {canDelete && onDelete && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pendingId === attachment.id}
                  onClick={() => handleDelete(attachment.id)}
                >
                  Remove
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
