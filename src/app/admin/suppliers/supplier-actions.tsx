"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { verifySupplier, suspendSupplier } from "./actions";

export function VerifySupplierButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await verifySupplier(id);
        setPending(false);
        router.refresh();
      }}
    >
      {pending ? "Verifying…" : "Verify"}
    </Button>
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
