"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { verifySupplier, suspendSupplier } from "./actions";

export function VerifySupplierButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-2">
      {error && (
        <Alert variant="destructive" className="max-w-xs">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        size="sm"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          setError(null);
          const result = await verifySupplier(id);
          setPending(false);
          if (result.error) {
            setError(result.error);
            return;
          }
          router.refresh();
        }}
      >
        {pending ? "Verifying…" : "Verify"}
      </Button>
    </div>
  );
}

export function SuspendSupplierButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await suspendSupplier(id);
        setPending(false);
        router.refresh();
      }}
    >
      {pending ? "Suspending…" : "Suspend"}
    </Button>
  );
}
