import "server-only";
import { sendEmail } from "@/lib/email/send";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sends the email side of a notification event. The in-app notifications
 * row is already created by a DB trigger (see 0002_functions.sql) - this
 * covers the separate transactional-email channel, using the admin client
 * since it needs to read another user's contact_email regardless of the
 * caller's session.
 */
export async function notifyUserByEmail(userId: string, subject: string, body: string): Promise<void> {
  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("profiles")
    .select("contact_email, full_name")
    .eq("id", userId)
    .maybeSingle();

  if (!profile?.contact_email) {
    return;
  }

  await sendEmail({ to: profile.contact_email, subject, body });
}
