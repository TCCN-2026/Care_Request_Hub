"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { setOrganisationMembership } from "./actions";

export function MembershipToggle({ orgId, isMember }: { orgId: string; isMember: boolean }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function toggle() {
    setPending(true);
    await setOrganisationMembership(orgId, !isMember);
    setPending(false);
    router.refresh();
  }

  return (
    <Button size="sm" variant={isMember ? "outline" : "default"} disabled={pending} onClick={toggle}>
      {pending ? "Saving…" : isMember ? "Remove membership" : "Make CCN member"}
    </Button>
  );
}
