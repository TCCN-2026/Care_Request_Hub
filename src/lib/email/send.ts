import "server-only";
import { appSettings } from "@/lib/settings";

interface SendEmailInput {
  to: string;
  subject: string;
  body: string;
}

/**
 * Resend-compatible transactional email abstraction. With no RESEND_API_KEY
 * set (the local-dev default), emails are logged instead of sent so the
 * core loop works without any email provider configured.
 */
export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.log(`[email:dev-stub] to=${input.to} subject="${input.subject}"\n${input.body}`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM_ADDRESS ?? `${appSettings.productName} <notifications@example.com>`,
      to: input.to,
      subject: input.subject,
      text: input.body,
    }),
  });

  if (!res.ok) {
    console.error(`[email] Resend request failed: ${res.status} ${await res.text()}`);
  }
}
