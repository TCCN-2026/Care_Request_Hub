"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldError } from "@/components/forms/field-error";
import { createClient } from "@/lib/supabase/client";

const schema = z.object({ password: z.string().min(8, "Password must be at least 8 characters") });
type Input = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<Input>({ resolver: zodResolver(schema) });

  async function onSubmit(values: Input) {
    setFormError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: values.password });
    if (error) {
      setFormError(error.message);
      return;
    }
    router.push("/onboarding");
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <h1 className="text-2xl font-semibold text-zinc-900">Set a new password</h1>

      <form className="mt-8 space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}
        <div>
          <Label htmlFor="password">New password</Label>
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
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting ? "Saving…" : "Save new password"}
        </Button>
      </form>
    </div>
  );
}
