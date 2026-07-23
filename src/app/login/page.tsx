"use client";

import { useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldError } from "@/components/forms/field-error";
import { Logo } from "@/components/branding/logo";
import { createClient } from "@/lib/supabase/client";
import { loginSchema, type LoginInput } from "@/lib/validation/auth";
import { appSettings } from "@/lib/settings";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const justConfirmed = searchParams.get("confirmed") === "1";

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  async function onSubmit(values: LoginInput) {
    setFormError(null);
    setSubmitting(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword(values);
    setSubmitting(false);

    if (error) {
      setFormError(
        error.message === "Email not confirmed"
          ? "Please confirm your email address before logging in. Check your inbox for the confirmation link."
          : "Incorrect email or password.",
      );
      return;
    }

    router.push(searchParams.get("next") ?? "/onboarding");
    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <Link href="/" className="self-start">
        <Logo />
      </Link>
      <h1 className="mt-8 text-2xl font-semibold text-zinc-900">Log in</h1>
      <p className="mt-1 text-sm text-zinc-600">to {appSettings.productName}</p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        {justConfirmed && !formError && (
          <Alert>
            <AlertDescription>Email confirmed - log in to continue.</AlertDescription>
          </Alert>
        )}
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <div>
          <Label htmlFor="email">Email address</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            className="mt-1.5"
            {...register("email")}
          />
          <FieldError id="email-error" message={errors.email?.message} />
        </div>

        <div>
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link href="/forgot-password" className="text-sm text-zinc-600 underline underline-offset-2">
              Forgotten password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            className="mt-1.5"
            {...register("password")}
          />
          <FieldError id="password-error" message={errors.password?.message} />
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-600">
        Don&apos;t have an account?{" "}
        <Link href="/signup" className="font-medium text-primary underline underline-offset-2">
          Sign up
        </Link>
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
