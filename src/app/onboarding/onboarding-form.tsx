"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldError } from "@/components/forms/field-error";
import {
  providerOnboardingSchema,
  supplierOnboardingSchema,
  type ProviderOnboardingInput,
  type SupplierOnboardingInput,
} from "@/lib/validation/auth";
import { completeProviderOnboarding, completeSupplierOnboarding } from "./actions";

interface Category {
  id: string;
  name: string;
}

export function OnboardingForm({
  accountType,
  categories,
}: {
  accountType: "care_provider" | "supplier";
  categories: Category[];
}) {
  return accountType === "supplier" ? (
    <SupplierForm categories={categories} />
  ) : (
    <ProviderForm />
  );
}

function ProviderForm() {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<ProviderOnboardingInput>({
    resolver: zodResolver(providerOnboardingSchema),
    defaultValues: { accountType: "care_provider" },
  });

  async function onSubmit(values: ProviderOnboardingInput) {
    setFormError(null);
    const result = await completeProviderOnboarding(values);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    router.push("/provider/dashboard");
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div>
        <Label htmlFor="organisationName">Organisation name</Label>
        <Input id="organisationName" className="mt-1.5" {...register("organisationName")} />
        <FieldError id="organisationName-error" message={errors.organisationName?.message} />
      </div>

      <div>
        <Label htmlFor="postcodePrefix">Postcode prefix, e.g. KA5</Label>
        <Input
          id="postcodePrefix"
          className="mt-1.5 max-w-[10rem]"
          placeholder="KA5"
          {...register("postcodePrefix")}
        />
        <p className="mt-1 text-sm text-zinc-500">
          Just the outward part of your postcode. This is what suppliers see, never your full address.
        </p>
        <FieldError id="postcodePrefix-error" message={errors.postcodePrefix?.message} />
      </div>

      <div>
        <Label htmlFor="fullName">Your full name</Label>
        <Input id="fullName" className="mt-1.5" {...register("fullName")} />
        <FieldError id="fullName-error" message={errors.fullName?.message} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="jobTitle">Job title</Label>
          <Input id="jobTitle" className="mt-1.5" {...register("jobTitle")} />
        </div>
        <div>
          <Label htmlFor="phone">Phone number</Label>
          <Input id="phone" type="tel" className="mt-1.5" {...register("phone")} />
        </div>
      </div>

      <TermsCheckbox control={control} name="acceptedTerms" error={errors.acceptedTerms?.message} />

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Setting up…" : "Continue"}
      </Button>
    </form>
  );
}

function SupplierForm({ categories }: { categories: Category[] }) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [coverageInput, setCoverageInput] = useState("");
  const {
    register,
    handleSubmit,
    control,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<SupplierOnboardingInput>({
    resolver: zodResolver(supplierOnboardingSchema),
    defaultValues: { accountType: "supplier", coveragePrefixes: [], categoryIds: [] },
  });

  const coveragePrefixes = watch("coveragePrefixes") ?? [];
  const categoryIds = watch("categoryIds") ?? [];

  function addPrefix() {
    const value = coverageInput.trim().toUpperCase();
    if (value && !coveragePrefixes.includes(value)) {
      setValue("coveragePrefixes", [...coveragePrefixes, value], { shouldValidate: true });
    }
    setCoverageInput("");
  }

  function removePrefix(prefix: string) {
    setValue(
      "coveragePrefixes",
      coveragePrefixes.filter((p) => p !== prefix),
      { shouldValidate: true },
    );
  }

  function toggleCategory(id: string, checked: boolean) {
    setValue(
      "categoryIds",
      checked ? [...categoryIds, id] : categoryIds.filter((c) => c !== id),
      { shouldValidate: true },
    );
  }

  async function onSubmit(values: SupplierOnboardingInput) {
    setFormError(null);
    const result = await completeSupplierOnboarding(values);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    router.push("/supplier/dashboard");
    router.refresh();
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit(onSubmit)} noValidate>
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div>
        <Label htmlFor="organisationName">Organisation name</Label>
        <Input id="organisationName" className="mt-1.5" {...register("organisationName")} />
        <FieldError id="organisationName-error" message={errors.organisationName?.message} />
      </div>

      <div>
        <Label htmlFor="fullName">Your full name</Label>
        <Input id="fullName" className="mt-1.5" {...register("fullName")} />
        <FieldError id="fullName-error" message={errors.fullName?.message} />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="jobTitle">Job title</Label>
          <Input id="jobTitle" className="mt-1.5" {...register("jobTitle")} />
        </div>
        <div>
          <Label htmlFor="phone">Phone number</Label>
          <Input id="phone" type="tel" className="mt-1.5" {...register("phone")} />
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-medium text-zinc-900">Service categories</legend>
        <p className="text-sm text-zinc-500">Select every category you can supply.</p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {categories.map((category) => (
            <label key={category.id} className="flex items-center gap-2 text-sm text-zinc-700">
              <Checkbox
                checked={categoryIds.includes(category.id)}
                onCheckedChange={(checked) => toggleCategory(category.id, checked === true)}
              />
              {category.name}
            </label>
          ))}
        </div>
        <FieldError id="categoryIds-error" message={errors.categoryIds?.message} />
      </fieldset>

      <div>
        <Label htmlFor="coverageInput">Postcode areas you cover</Label>
        <div className="mt-1.5 flex gap-2">
          <Input
            id="coverageInput"
            placeholder="e.g. KA, G, ML"
            value={coverageInput}
            onChange={(event) => setCoverageInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                addPrefix();
              }
            }}
          />
          <Button type="button" variant="outline" onClick={addPrefix}>
            Add
          </Button>
        </div>
        <p className="mt-1 text-sm text-zinc-500">
          Add each postcode prefix you cover, e.g. &quot;KA&quot; covers KA1 through KA30.
        </p>
        {coveragePrefixes.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-2">
            {coveragePrefixes.map((prefix) => (
              <li key={prefix}>
                <button
                  type="button"
                  onClick={() => removePrefix(prefix)}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-sm text-zinc-700 hover:bg-zinc-200"
                >
                  {prefix} &times;
                </button>
              </li>
            ))}
          </ul>
        )}
        <FieldError id="coveragePrefixes-error" message={errors.coveragePrefixes?.message} />
      </div>

      <Alert>
        <AlertDescription>
          New supplier accounts are reviewed before they can see live requests. We&apos;ll email you
          once your account is verified.
        </AlertDescription>
      </Alert>

      <TermsCheckbox control={control} name="acceptedTerms" error={errors.acceptedTerms?.message} />

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "Setting up…" : "Continue"}
      </Button>
    </form>
  );
}

function TermsCheckbox<T extends { acceptedTerms: true }>({
  control,
  name,
  error,
}: {
  control: import("react-hook-form").Control<T>;
  name: "acceptedTerms";
  error?: string;
}) {
  return (
    <div>
      <label className="flex items-start gap-2 text-sm text-zinc-700">
        <Controller
          control={control}
          name={name as never}
          render={({ field }) => (
            <Checkbox
              checked={field.value === true}
              onCheckedChange={(checked) => field.onChange(checked === true)}
              className="mt-0.5"
            />
          )}
        />
        <span>
          I have read and accept the platform rules, including the requirement not to include
          resident, patient or employee personal data in any request or response.
        </span>
      </label>
      <FieldError id="acceptedTerms-error" message={error} />
    </div>
  );
}
