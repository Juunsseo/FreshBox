"use client";

import Link from "next/link";
import { Check, X } from "lucide-react";

import { FoodIcon } from "@/components/food-icon";
import { formatClock } from "@/lib/format";
import { useBoxAnalysis, useFreshBox } from "@/lib/store";
import { SwipeToDiscard } from "@/components/swipe-to-discard";
import type { BoxRecord, Verdict } from "@/lib/types";
import { cn } from "@/lib/utils";

export function BoxCard({ box }: { box: BoxRecord }) {
  const analysis = useBoxAnalysis(box);
  const { removeBox } = useFreshBox();

  return (
    <SwipeToDiscard name={box.name} onDiscard={() => removeBox(box.id)}>
    <Link href={`/box/${box.id}`} className="block" draggable={false}>
      <article className="rounded-[1.85rem] border-[1.5px] border-[#b8ddb0] bg-white px-3.5 py-3.5 shadow-[0_1px_0_rgba(80,60,40,0.04)]">
        <div className="flex items-center gap-3.5">
          <span className="flex size-[4.4rem] shrink-0 items-center justify-center rounded-full bg-[#eef8e8]">
            <FoodIcon type={box.foodType} className="size-12" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[1.35rem] font-semibold leading-tight tracking-tight text-zinc-900">
              {box.name}
            </h2>
            <div className="mt-1.5 flex items-center gap-2.5">
              <FreshnessBar score={box.freshness?.score ?? null} />
              <span className="font-mono text-xs">{box.freshness?.score == null ? "--" : `${box.freshness.score.toFixed(1)}%`}</span>
              <StatusMark verdict={analysis.verdict} />
            </div>
            <p className="mt-1.5 text-[13px] text-zinc-500">
              {box.amount}
              <span className="inline-block w-3" />
              {formatClock(box.elapsedHours)}
            </p>
          </div>
        </div>
      </article>
    </Link>
    </SwipeToDiscard>
  );
}

function StatusMark({ verdict }: { verdict: Verdict }) {
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full text-white",
        verdict === "safe" && "bg-[#7bc67e]",
        verdict === "soon" && "bg-[#d4a06a]",
        verdict === "unsafe" && "bg-[#d16b4c]",
      )}
    >
      {verdict === "safe" ? (
        <Check className="size-4" strokeWidth={3} />
      ) : verdict === "soon" ? (
        <span className="text-[1.15rem] leading-none font-black">!</span>
      ) : (
        <X className="size-4" strokeWidth={3} />
      )}
    </span>
  );
}

function FreshnessBar({ score }: { score: number | null }) {
  // Original scale: fresh (100%) on the green left, declining (0%) on the red right.
  const pct = 100 - Math.min(100, Math.max(0, score ?? 0));

  return (
    <div className="relative h-4 min-w-0 flex-1" role="progressbar" aria-label="Freshness" aria-valuemin={0} aria-valuemax={100} aria-valuenow={score ?? undefined}>
      <div
        className="absolute inset-x-0 top-1/2 h-[9px] -translate-y-1/2 rounded-full"
        style={{
          background: "linear-gradient(90deg, #7cde6a 0%, #e8d44a 48%, #e24b3a 100%)",
        }}
      />
      {score !== null && <span
        className="absolute top-1/2 size-[18px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-[#f3f3f3] shadow-sm ring-1 ring-black/10"
        style={{ left: `${pct}%` }}
      />}
    </div>
  );
}
