"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldError } from "@/components/forms/field-error";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({ email: z.string().trim().email("Enter a valid email address") });
type Input = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Input>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Input) {
    const supabase = createClient();
    await supabase.auth.resetPasswordForEmail(values.email, {
      redirectTo: `${window.location.origin}/account/reset-password`,
    });
    // Always show the same confirmation, whether or not the address is
    // registered, so this can't be used to enumerate accounts.
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">Check your email</h1>
        <p className="mt-3 text-sm text-zinc-600">
          If an account exists for that address, we&apos;ve sent a link to reset your password.
        </p>
        <Button asChild className="mt-6">
          <Link href="/login">Back to login</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold text-zinc-900">Reset your password</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Enter your email address and we&apos;ll send you a link to reset your password.
      </p>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
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

        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </div>
  );
}
