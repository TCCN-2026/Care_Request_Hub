"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatFileSize } from "@/lib/attachments/constants";
import {
  verificationDocumentStatusLabels,
  verificationDocumentStatusBadgeVariant,
} from "@/lib/domain/status-labels";
import type { VerificationDocumentStatus } from "@/types/domain";

export interface VerificationDocumentListItem {
  id: string;
  fileName: string;
  fileSize: number;
  status: VerificationDocumentStatus;
  rejectionReason: string | null;
}

export function VerificationDocumentList({
  documents,
  getDownloadUrl,
  onDelete,
}: {
  documents: VerificationDocumentListItem[];
  getDownloadUrl: (id: string) => Promise<{ url?: string; error?: string }>;
  onDelete?: (id: string) => Promise<{ error?: string }>;
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

  if (documents.length === 0) {
    return <p className="text-sm text-zinc-500">No documents uploaded yet.</p>;
  }

  return (
    <div className="space-y-2">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <ul className="divide-y divide-zinc-200 rounded-md border border-zinc-200">
        {documents.map((document) => (
          <li key={document.id} className="flex items-center justify-between gap-3 px-3 py-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-zinc-900">{document.fileName}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {formatFileSize(document.fileSize)} ·{" "}
                <Badge variant={verificationDocumentStatusBadgeVariant[document.status]} className="align-middle">
                  {verificationDocumentStatusLabels[document.status]}
                </Badge>
              </p>
              {document.status === "rejected" && document.rejectionReason && (
                <p className="mt-1 text-xs text-red-700">Reason: {document.rejectionReason}</p>
              )}
            </div>
            <div className="flex shrink-0 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pendingId === document.id}
                onClick={() => handleDownload(document.id)}
              >
                {pendingId === document.id ? "Preparing…" : "Download"}
              </Button>
              {onDelete && document.status === "pending_review" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={pendingId === document.id}
                  onClick={() => handleDelete(document.id)}
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
