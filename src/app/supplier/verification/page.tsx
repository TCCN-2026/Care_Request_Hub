import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { requireCurrentOrg } from "@/lib/auth/current-org";
import { AttachmentUploadForm } from "@/components/attachments/attachment-upload-form";
import { VerificationDocumentList } from "@/components/verification/document-list";
import { getVerificationDocumentDownloadUrl } from "@/lib/attachments/actions";
import { uploadVerificationDocument, deleteVerificationDocument } from "./actions";
import { verificationDocumentTypeLabels } from "@/lib/domain/status-labels";
import type { VerificationDocumentType } from "@/types/domain";

const DOCUMENT_TYPES: { type: VerificationDocumentType; description: string }[] = [
  {
    type: "public_liability_insurance",
    description: "Required before your organisation can be marked as verified.",
  },
  {
    type: "professional_indemnity_insurance",
    description: "Where applicable to the services you provide.",
  },
  { type: "accreditation", description: "Any relevant accreditations or certifications." },
];

export default async function SupplierVerificationPage() {
  const { orgId } = await requireCurrentOrg();
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organisations")
    .select("status")
    .eq("id", orgId)
    .maybeSingle();

  const { data: documents } = await supabase
    .from("verification_documents")
    .select("id, document_type, file_name, file_size, status, rejection_reason, created_at")
    .eq("supplier_org_id", orgId)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="text-2xl font-semibold text-zinc-900">Verification documents</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Upload the documents below so The Care Connector Network can verify your organisation. Only you and
        platform admins can see these files.
      </p>

      {org?.status === "active" ? (
        <Alert className="mt-6">
          <AlertTitle>Your organisation is verified</AlertTitle>
          <AlertDescription>You can still add or update documents below at any time.</AlertDescription>
        </Alert>
      ) : (
        <Alert className="mt-6">
          <AlertTitle>Awaiting verification</AlertTitle>
          <AlertDescription>
            An admin will review your uploaded documents. Approved public liability insurance is required before
            your organisation can be verified.
          </AlertDescription>
        </Alert>
      )}

      <div className="mt-8 space-y-6">
        {DOCUMENT_TYPES.map(({ type, description }) => {
          const docsOfType = (documents ?? []).filter((d) => d.document_type === type);
          return (
            <Card key={type}>
              <CardHeader>
                <CardTitle className="text-base">{verificationDocumentTypeLabels[type]}</CardTitle>
                <p className="text-sm text-zinc-500">{description}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <VerificationDocumentList
                  documents={docsOfType.map((d) => ({
                    id: d.id,
                    fileName: d.file_name,
                    fileSize: d.file_size,
                    status: d.status,
                    rejectionReason: d.rejection_reason,
                  }))}
                  getDownloadUrl={getVerificationDocumentDownloadUrl}
                  onDelete={deleteVerificationDocument}
                />
                <AttachmentUploadForm onUpload={uploadVerificationDocument.bind(null, type)} />
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
