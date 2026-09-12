import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { verdictLabel } from "@/lib/freshness";
import type { Verdict } from "@/lib/types";

const toneClass: Record<Verdict, string> = {
  safe: "border-[#b8ddb0] bg-[#eef8e8] text-[#3f7a3c]",
  soon: "border-[#ead3a8] bg-[#fbf3e2] text-[#9a6b2a]",
  unsafe: "border-[#edc4b4] bg-[#fbeae4] text-[#b44a32]",
};

export function VerdictBadge({
  verdict,
  className,
}: {
  verdict: Verdict;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("border px-2.5", toneClass[verdict], className)}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          verdict === "safe" && "bg-[#7bc67e]",
          verdict === "soon" && "bg-[#d4a06a]",
          verdict === "unsafe" && "animate-pulse bg-[#d16b4c]",
        )}
      />
      {verdictLabel(verdict)}
    </Badge>
  );
}

export function VerdictBanner({
  headline,
  advice,
  verdict,
}: {
  headline: string;
  advice: string;
  verdict: Verdict;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-5 sm:p-6",
        verdict === "safe" && "border-[#b8ddb0] bg-[#eef8e8]",
        verdict === "soon" && "border-[#ead3a8] bg-[#fbf3e2]",
        verdict === "unsafe" && "border-[#edc4b4] bg-[#fbeae4]",
      )}
    >
      <h2 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
        {headline}
      </h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/80">
        {advice}
      </p>
    </div>
  );
}
