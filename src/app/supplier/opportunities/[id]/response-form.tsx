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
import { responseFormSchema, type ResponseFormInput } from "@/lib/validation/response";
import { createResponse, updateResponse } from "./actions";

function numberOrUndefined(value: string): number | undefined {
  return value === "" ? undefined : Number(value);
}

export function ResponseForm({
  requestId,
  mode,
  responseId,
  defaultValues,
}: {
  requestId: string;
  mode: "create" | "edit";
  responseId?: string;
  defaultValues?: Partial<ResponseFormInput>;
}) {
  const router = useRouter();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState<"draft" | "submit" | null>(null);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<ResponseFormInput>({
    resolver: zodResolver(responseFormSchema),
    defaultValues: { vatStatus: "not_applicable", ...defaultValues },
  });

  async function save(values: ResponseFormInput, submit: boolean) {
    setFormError(null);
    setPending(submit ? "submit" : "draft");

    if (mode === "create") {
      const result = await createResponse(requestId, values, submit);
      setPending(null);
      if (result?.error) setFormError(result.error);
      return;
    }

    const result = await updateResponse(responseId!, values);
    setPending(null);
    if (result.error) {
      setFormError(result.error);
      return;
    }
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
        <Label htmlFor="summary">Response summary</Label>
        <Textarea id="summary" rows={3} className="mt-1.5" {...register("summary")} />
        <FieldError id="summary-error" message={errors.summary?.message} />
      </div>

      <div>
        <Label htmlFor="proposedSolution">Proposed solution</Label>
        <Textarea id="proposedSolution" rows={5} className="mt-1.5" {...register("proposedSolution")} />
        <FieldError id="proposedSolution-error" message={errors.proposedSolution?.message} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <Label htmlFor="oneOffCost">One-off cost, £ (optional)</Label>
          <Input
            id="oneOffCost"
            type="number"
            step="0.01"
            min="0"
            className="mt-1.5"
            {...register("oneOffCost", { setValueAs: numberOrUndefined })}
          />
        </div>
        <div>
          <Label htmlFor="recurringCost">Recurring cost, £ (optional)</Label>
          <Input
            id="recurringCost"
            type="number"
            step="0.01"
            min="0"
            className="mt-1.5"
            {...register("recurringCost", { setValueAs: numberOrUndefined })}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="vatStatus">VAT status</Label>
        <Controller
          control={control}
          name="vatStatus"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger id="vatStatus" className="mt-1.5 w-full sm:w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="inclusive">Costs include VAT</SelectItem>
                <SelectItem value="exclusive">Costs exclude VAT</SelectItem>
                <SelectItem value="not_applicable">Not applicable</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div>
        <Label htmlFor="timescale">Implementation or delivery timescale (optional)</Label>
        <Input id="timescale" className="mt-1.5" {...register("timescale")} />
      </div>

      <div>
        <label className="flex items-start gap-2 text-sm text-zinc-700">
          <Controller
            control={control}
            name="declarationAccurate"
            render={({ field }) => (
              <Checkbox
                checked={field.value === true}
                onCheckedChange={(checked) => field.onChange(checked === true)}
                className="mt-0.5"
              />
            )}
          />
          <span>
            I confirm this information is accurate. I understand submitting a response does not
            guarantee selection.
          </span>
        </label>
        <FieldError id="declarationAccurate-error" message={errors.declarationAccurate?.message} />
      </div>

      <div className="flex gap-3">
        {mode === "create" ? (
          <>
            <Button
              type="button"
              variant="outline"
              disabled={pending !== null}
              onClick={handleSubmit((values) => save(values, false))}
            >
              {pending === "draft" ? "Saving…" : "Save as draft"}
            </Button>
            <Button
              type="button"
              disabled={pending !== null}
              onClick={handleSubmit((values) => save(values, true))}
            >
              {pending === "submit" ? "Submitting…" : "Submit response"}
            </Button>
          </>
        ) : (
          <Button
            type="button"
            disabled={pending !== null}
            onClick={handleSubmit((values) => save(values, false))}
          >
            {pending === "draft" ? "Saving…" : "Save changes"}
          </Button>
        )}
      </div>
    </form>
  );
}
