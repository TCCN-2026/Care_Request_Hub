"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { decideIntroduction } from "./actions";

export function IntroductionDecisionForm({ introductionId }: { introductionId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState<"approved" | "rejected" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "approved" | "rejected") {
    setPending(decision);
    setError(null);
    const result = await decideIntroduction(introductionId, decision, notes);
    setPending(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-3 space-y-2">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Textarea
        placeholder="Decision notes (optional)"
        rows={2}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
      <div className="flex gap-2">
        <Button size="sm" disabled={pending !== null} onClick={() => decide("approved")}>
          {pending === "approved" ? "Approving…" : "Approve introduction"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={pending !== null}
          onClick={() => decide("rejected")}
        >
          {pending === "rejected" ? "Rejecting…" : "Reject"}
        </Button>
      </div>
    </div>
  );
}
