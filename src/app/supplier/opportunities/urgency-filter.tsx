import Link from "next/link";
import { cn } from "@/lib/utils";
import { urgencyLevelLabels } from "@/lib/domain/status-labels";
import type { UrgencyLevel } from "@/types/domain";

const URGENCY_OPTIONS: UrgencyLevel[] = ["exploring", "standard", "urgent"];

export function UrgencyFilter({ selected }: { selected: UrgencyLevel | null }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/supplier/opportunities"
        className={cn(
          "rounded-full border px-3 py-1 text-sm",
          selected === null ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-700 hover:bg-zinc-50",
        )}
      >
        All urgencies
      </Link>
      {URGENCY_OPTIONS.map((level) => (
        <Link
          key={level}
          href={`/supplier/opportunities?urgency=${level}`}
          className={cn(
            "rounded-full border px-3 py-1 text-sm",
            selected === level ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-300 text-zinc-700 hover:bg-zinc-50",
          )}
        >
          {urgencyLevelLabels[level]}
        </Link>
      ))}
    </div>
  );
}
