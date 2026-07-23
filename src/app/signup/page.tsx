"use client";

import { useState, Suspense } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldError } from "@/components/forms/field-error";
import { Logo } from "@/components/branding/logo";
import { createClient } from "@/lib/supabase/client";
import { signUpSchema, type SignUpInput } from "@/lib/validation/auth";
import { appSettings } from "@/lib/settings";

function SignUpForm() {
  const searchParams = useSearchParams();
  const defaultType = searchParams.get("type") === "supplier" ? "supplier" : "care_provider";
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [emailSent, setEmailSent] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<SignUpInput>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { accountType: defaultType },
  });

  const accountType = watch("accountType");

  async function onSubmit(values: SignUpInput) {
    setFormError(null);
    setSubmitting(true);
    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: { account_type: values.accountType },
        // Built from wherever the app is actually running, rather than
        // relying solely on Supabase's dashboard-configured Site URL -
        // works the same in local dev and on any deployed URL. Supabase
        // still requires this exact URL to be in the project's Redirect
        // URLs allow-list (Authentication -> URL Configuration).
        emailRedirectTo: `${window.location.origin}/login?confirmed=1`,
      },
    });
    setSubmitting(false);

    if (error) {
      setFormError(
        error.message.toLowerCase().includes("already registered")
          ? "An account already exists with that email address. Try logging in instead."
          : error.message,
      );
      return;
    }

    if (data.session) {
      window.location.href = "/onboarding";
      return;
    }

    setEmailSent(true);
  }

  if (emailSent) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">Check your email</h1>
        <p className="mt-3 text-sm text-zinc-600">
          We&apos;ve sent a confirmation link to your email address. Follow it to activate your
          account, then log in to finish setting up your organisation.
        </p>
        <Button asChild className="mt-6">
          <Link href="/login">Go to login</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <Link href="/" className="self-start">
        <Logo />
      </Link>
      <h1 className="mt-8 text-2xl font-semibold text-zinc-900">Create your account</h1>
      <p className="mt-1 text-sm text-zinc-600">on {appSettings.productName}</p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <fieldset>
          <legend className="text-sm font-medium text-zinc-900">I represent a…</legend>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setValue("accountType", "care_provider")}
              aria-pressed={accountType === "care_provider"}
              className={`rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
                accountType === "care_provider"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              Care provider
            </button>
            <button
              type="button"
              onClick={() => setValue("accountType", "supplier")}
              aria-pressed={accountType === "supplier"}
              className={`rounded-md border px-4 py-3 text-sm font-medium transition-colors ${
                accountType === "supplier"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              Supplier
            </button>
          </div>
        </fieldset>

        <div>
          <Label htmlFor="email">Work email address</Label>
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
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            autoComplete="new-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? "password-error" : undefined}
            className="mt-1.5"
            {...register("password")}
          />
          <FieldError id="password-error" message={errors.password?.message} />
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-zinc-600">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-primary underline underline-offset-2">
          Log in
        </Link>
      </p>
    </div>
  );
}

export default function SignUpPage() {
  return (
    <Suspense>
      <SignUpForm />
    </Suspense>
  );
}
