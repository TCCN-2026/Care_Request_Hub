"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatFileSize } from "@/lib/attachments/constants";
import {
  verificationDocumentTypeLabels,
  verificationDocumentStatusLabels,
  verificationDocumentStatusBadgeVariant,
} from "@/lib/domain/status-labels";
import { getVerificationDocumentDownloadUrl } from "@/lib/attachments/actions";
import { reviewVerificationDocument } from "./actions";
import type { VerificationDocumentType, VerificationDocumentStatus } from "@/types/domain";

export interface AdminDocumentItem {
  id: string;
  documentType: VerificationDocumentType;
  fileName: string;
  fileSize: number;
  status: VerificationDocumentStatus;
  rejectionReason: string | null;
}

export function SupplierDocumentReview({ documents }: { documents: AdminDocumentItem[] }) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleDownload(id: string) {
    setError(null);
    setPendingId(id);
    const result = await getVerificationDocumentDownloadUrl(id);
    setPendingId(null);
    if (result.error || !result.url) {
      setError(result.error ?? "Could not generate a download link.");
      return;
    }
    window.open(result.url, "_blank", "noopener,noreferrer");
  }

  async function handleApprove(id: string) {
    setError(null);
    setPendingId(id);
    const result = await reviewVerificationDocument(id, "approved", "");
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleReject(id: string) {
    setError(null);
    setPendingId(id);
    const result = await reviewVerificationDocument(id, "rejected", reason);
    setPendingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    setRejectingId(null);
    setReason("");
    router.refresh();
  }

  if (documents.length === 0) {
    return <p className="text-xs text-zinc-500">No documents uploaded.</p>;
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
          <li key={document.id} className="px-3 py-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-zinc-900">
                  {verificationDocumentTypeLabels[document.documentType]} &middot; {document.fileName}
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  {formatFileSize(document.fileSize)} ·{" "}
                  <Badge
                    variant={verificationDocumentStatusBadgeVariant[document.status]}
                    className="align-middle"
                  >
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
                {document.status === "pending_review" && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      disabled={pendingId === document.id}
                      onClick={() => handleApprove(document.id)}
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={pendingId === document.id}
                      onClick={() => {
                        setRejectingId(rejectingId === document.id ? null : document.id);
                        setReason("");
                      }}
                    >
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
            {rejectingId === document.id && (
              <div className="mt-2 space-y-2">
                <Textarea
                  placeholder="Reason for rejection"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={pendingId === document.id}
                    onClick={() => handleReject(document.id)}
                  >
                    {pendingId === document.id ? "Rejecting…" : "Confirm rejection"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRejectingId(null);
                      setReason("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
