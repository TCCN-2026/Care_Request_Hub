"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { approveAndPublishRequest, closeRequestToResponses } from "../actions";

export function ApproveRequestButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      {error && (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        disabled={pending}
        onClick={async () => {
          setPending(true);
          const result = await approveAndPublishRequest(id);
          setPending(false);
          if (result.error) {
            setError(result.error);
            return;
          }
          router.refresh();
        }}
      >
        {pending ? "Approving…" : "Approve & publish"}
      </Button>
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
