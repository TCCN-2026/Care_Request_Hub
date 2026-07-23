import Image from "next/image";
import { cn } from "@/lib/utils";
import { appSettings } from "@/lib/settings";

/**
 * Renders the real logo image once one is configured (see the guidance in
 * src/lib/settings.ts), otherwise a plain text wordmark - swapping in the
 * real asset later needs only an env var change, no code change.
 */
export function Logo({ className, imageSize = 32 }: { className?: string; imageSize?: number }) {
  if (appSettings.logoUrl) {
    return (
      <Image
        src={appSettings.logoUrl}
        alt={appSettings.organisationName}
        width={imageSize}
        height={imageSize}
        className={cn("h-8 w-auto", className)}
      />
    );
  }

  return (
    <span className={cn("font-heading text-lg font-semibold tracking-tight text-primary", className)}>
      {appSettings.productName}
    </span>
  );
}
