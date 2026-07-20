"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { withdrawResponse } from "./actions";

export function WithdrawResponseButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <Button variant="outline" onClick={() => setConfirming(true)}>
        Withdraw response
      </Button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-zinc-600">Are you sure?</span>
      <Button
        variant="destructive"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          await withdrawResponse(id);
          setPending(false);
          router.refresh();
        }}
      >
        {pending ? "Withdrawing…" : "Yes, withdraw it"}
      </Button>
      <Button variant="ghost" onClick={() => setConfirming(false)}>
        No, keep it
      </Button>
    </div>
  );
}
