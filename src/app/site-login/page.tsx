"use client";

import { useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Logo } from "@/components/branding/logo";
import { unlockSite } from "./actions";

function SiteLoginForm() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const result = await unlockSite(password, next);
    setSubmitting(false);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <Logo className="self-start" />
      <h1 className="mt-8 text-2xl font-semibold text-zinc-900">This site is private</h1>
      <p className="mt-1 text-sm text-zinc-600">Enter the access password to continue.</p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit} noValidate>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div>
          <Label htmlFor="password">Access password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="off"
            autoFocus
            className="mt-1.5"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <Button type="submit" className="w-full" disabled={submitting || password.length === 0}>
          {submitting ? "Checking…" : "Continue"}
        </Button>
      </form>
    </div>
  );
}

export default function SiteLoginPage() {
  return (
    <Suspense>
      <SiteLoginForm />
    </Suspense>
  );
}
