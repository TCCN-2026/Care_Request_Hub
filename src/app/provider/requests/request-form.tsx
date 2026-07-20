"use client";

import { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldError } from "@/components/forms/field-error";
import { requestFormSchema, type RequestFormInput } from "@/lib/validation/request";
import { createRequest, updateRequest } from "./actions";

interface Category {
  id: string;
  name: string;
}

export function RequestForm({
  categories,
  mode,
  requestId,
  defaultValues,
}: {
  categories: Category[];
  mode: "create" | "edit";
  requestId?: string;
  defaultValues?: Partial<RequestFormInput>;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [submittingAction, setSubmittingAction] = useState<"draft" | "submit" | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<RequestFormInput>({
    resolver: zodResolver(requestFormSchema),
    defaultValues,
  });

  async function save(values: RequestFormInput, submit: boolean) {
    setFormError(null);
    setSubmittingAction(submit ? "submit" : "draft");

    if (mode === "create") {
      const result = await createRequest(values, submit);
      setSubmittingAction(null);
      if (result?.error) setFormError(result.error);
      return;
    }

    const result = await updateRequest(requestId!, values);
    setSubmittingAction(null);
    if (result.error) {
      setFormError(result.error);
      return;
    }
    router.push(`/provider/requests/${requestId}`);
    router.refresh();
  }

  return (
    <form className="space-y-6" noValidate>
      {formError && (
        <Alert variant="destructive">
          <AlertDescription>{formError}</AlertDescription>
        </Alert>
      )}

      <div>
        <Label htmlFor="title">Request title</Label>
        <Input id="title" className="mt-1.5" {...register("title")} />
        <FieldError id="title-error" message={errors.title?.message} />
      </div>

      <div>
        <Label htmlFor="categoryId">Category</Label>
        <Controller
          control={control}
          name="categoryId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="categoryId" className="mt-1.5 w-full">
                <SelectValue placeholder="Choose a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        <FieldError id="categoryId-error" message={errors.categoryId?.message} />
      </div>

      <div>
        <Label htmlFor="description">What do you need?</Label>
        <p className="mt-1 text-sm text-amber-700">
          Do not include names or personal information about residents, patients, service users or
          employees. Do not upload care plans, medical information or other sensitive personal data.
        </p>
        <Textarea id="description" rows={5} className="mt-1.5" {...register("description")} />
        <FieldError id="description-error" message={errors.description?.message} />
      </div>

      <div>
        <Label htmlFor="desiredOutcome">Desired outcome (optional)</Label>
        <Textarea id="desiredOutcome" rows={3} className="mt-1.5" {...register("desiredOutcome")} />
      </div>

      <div>
        <Label htmlFor="mandatoryRequirements">Mandatory requirements (optional)</Label>
        <Textarea
          id="mandatoryRequirements"
          rows={3}
          className="mt-1.5"
          {...register("mandatoryRequirements")}
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Label htmlFor="postcodePrefix">Postcode prefix, e.g. KA5</Label>
          <Input id="postcodePrefix" className="mt-1.5" {...register("postcodePrefix")} />
          <FieldError id="postcodePrefix-error" message={errors.postcodePrefix?.message} />
        </div>
        <div>
          <Label htmlFor="closingDate">Closing date for responses</Label>
          <Input id="closingDate" type="date" className="mt-1.5" {...register("closingDate")} />
          <FieldError id="closingDate-error" message={errors.closingDate?.message} />
        </div>
      </div>

      <div>
        <label className="flex items-start gap-2 text-sm text-zinc-700">
          <Controller
            control={control}
            name="confirmNoPersonalData"
            render={({ field }) => (
              <Checkbox
                checked={field.value === true}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                className="mt-0.5"
              />
            )}
          />
          <span>
            I confirm this request does not include resident, patient, employee-health or other
            special-category personal data.
          </span>
        </label>
        <FieldError id="confirmNoPersonalData-error" message={errors.confirmNoPersonalData?.message} />
      </div>

      <div className="flex gap-3">
        {mode === "create" ? (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={submittingAction !== null}
              onClick={handleSubmit((values) => save(values, false))}
            >
              {submittingAction === "draft" ? "Saving…" : "Save as draft"}
            </Button>
            <Button
              type="button"
              disabled={submittingAction !== null}
              onClick={handleSubmit((values) => save(values, true))}
            >
              {submittingAction === "submit" ? "Submitting…" : "Submit for review"}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            disabled={submittingAction !== null}
            onClick={handleSubmit((values) => save(values, false))}
          >
            {submittingAction === "draft" ? "Saving…" : "Save changes"}
          </Button>
        )}
      </div>
    </form>
  );
}
