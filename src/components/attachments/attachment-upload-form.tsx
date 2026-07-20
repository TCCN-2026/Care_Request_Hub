"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ALLOWED_ATTACHMENT_MIME_TYPES, MAX_ATTACHMENT_SIZE_BYTES, formatFileSize } from "@/lib/attachments/constants";

export function AttachmentUploadForm({
  onUpload,
  visibilityToggle,
  warning,
}: {
  onUpload: (formData: FormData) => Promise<{ error?: string }>;
  /** When provided, shows a "visible to suppliers" checkbox and includes it in the submitted form data. */
  visibilityToggle?: { label: string };
  warning?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [visibleToSuppliers, setVisibleToSuppliers] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploading(true);

    const formData = new FormData();
    formData.set("file", file);
    if (visibilityToggle) {
      formData.set("visibleToSuppliers", visibleToSuppliers ? "true" : "false");
    }

    const result = await onUpload(formData);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";

    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {warning && (
        <Alert>
          <AlertDescription className="text-amber-700">{warning}</AlertDescription>
        </Alert>
      )}
      {visibilityToggle && (
        <label className="flex items-center gap-2 text-sm text-zinc-700">
          <Checkbox
            checked={visibleToSuppliers}
            onCheckedChange={(checked) => setVisibleToSuppliers(checked === true)}
          />
          {visibilityToggle.label}
        </label>
      )}
      <div className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="file"
          accept={ALLOWED_ATTACHMENT_MIME_TYPES.join(",")}
          onChange={handleFileChange}
          disabled={uploading}
          className="text-sm text-zinc-700 file:mr-3 file:rounded-md file:border file:border-zinc-300 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-zinc-700 hover:file:bg-zinc-50"
        />
        {uploading && <span className="text-sm text-zinc-500">Uploading…</span>}
      </div>
      <p className="text-xs text-zinc-500">
        PDF, Word, Excel or image files up to {formatFileSize(MAX_ATTACHMENT_SIZE_BYTES)}.
      </p>
    </div>
  );
}
