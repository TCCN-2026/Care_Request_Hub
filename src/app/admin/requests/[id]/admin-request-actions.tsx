"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { approveAndPublishRequest, approveAsPaidPerRequest, closeRequestToResponses } from "../actions";

export function ApproveRequestButton({ id, blockedByLimit }: { id: string; blockedByLimit: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState<"normal" | "paid" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: "normal" | "paid") {
    setPending(action);
    setError(null);
    const result = action === "normal" ? await approveAndPublishRequest(id) : await approveAsPaidPerRequest(id);
    setPending(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      {error && (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {blockedByLimit ? (
        <div className="space-y-2">
          <Alert>
            <AlertDescription>
              This provider has used its 5 free live requests and isn&apos;t a CCN member. Make the
              organisation a member on the Organisations page for unlimited requests, or approve just
              this one as a paid one-off.
            </AlertDescription>
          </Alert>
          <Button disabled={pending !== null} onClick={() => run("paid")}>
            {pending === "paid" ? "Approving…" : "Approve as paid one-off"}
          </Button>
        </div>
      ) : (
        <Button disabled={pending !== null} onClick={() => run("normal")}>
          {pending === "normal" ? "Approving…" : "Approve & publish"}
        </Button>
      )}
    </div>
  );
}

export function CloseRequestButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="outline"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await closeRequestToResponses(id);
        setPending(false);
        router.refresh();
      }}
    >
      {pending ? "Closing…" : "Close to responses"}
    </Button>
  );
}
