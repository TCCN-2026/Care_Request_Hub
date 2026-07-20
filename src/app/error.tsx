"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="text-3xl font-semibold text-zinc-900">Something went wrong</h1>
      <p className="max-w-md text-zinc-600">
        We&apos;ve logged the problem. Please try again, and contact support if it continues.
      </p>
      <Button onClick={() => reset()}>Try again</Button>
    </div>
  );
}
