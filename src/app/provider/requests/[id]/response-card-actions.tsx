"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { shortlistResponse, declineResponse, requestIntroduction } from "./response-actions";

export function ResponseCardActions({
  responseId,
  requestId,
  status,
  hasIntroduction,
}: {
  responseId: string;
  requestId: string;
  status: "submitted" | "shortlisted" | "declined" | "withdrawn" | "introduced" | "draft";
  hasIntroduction: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: string, fn: () => Promise<{ error?: string }>) {
    setPending(action);
    setError(null);
    const result = await fn();
    setPending(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  if (status === "introduced") {
    return null;
  }

  return (
    <div>
      {error && (
        <Alert variant="destructive" className="mb-2">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <div className="flex flex-wrap gap-2">
        {status === "submitted" && (
          <>
            <Button
              size="sm"
              disabled={pending !== null}
              onClick={() => run("shortlist", () => shortlistResponse(responseId, requestId))}
            >
              {pending === "shortlist" ? "Shortlisting…" : "Shortlist"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending !== null}
              onClick={() => run("decline", () => declineResponse(responseId, requestId))}
            >
              {pending === "decline" ? "Declining…" : "Decline"}
            </Button>
          </>
        )}
        {status === "shortlisted" && !hasIntroduction && (
          <Button
            size="sm"
            disabled={pending !== null}
            onClick={() => run("introduce", () => requestIntroduction(responseId, requestId))}
          >
            {pending === "introduce" ? "Requesting…" : "Request introduction"}
          </Button>
        )}
        {status === "shortlisted" && hasIntroduction && (
          <span className="text-sm text-zinc-500">Introduction requested - awaiting admin review</span>
        )}
      </div>
    </div>
  );
}
