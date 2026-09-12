"use client";

import { useMemo, useState } from "react";
import { Container } from "lucide-react";

import { AddBoxDialog } from "@/components/add-box-dialog";
import { BoxCard } from "@/components/box-card";
import { Button } from "@/components/ui/button";
import { analyzeBox } from "@/lib/freshness";
import { useFreshBox } from "@/lib/store";
import type { Verdict } from "@/lib/types";
import { cn } from "@/lib/utils";

const filters: { id: "all" | Verdict; label: string }[] = [
  { id: "all", label: "All" },
  { id: "safe", label: "Safe" },
  { id: "soon", label: "Soon" },
  { id: "unsafe", label: "Don't eat" },
];

export function DashboardView() {
  const { boxes, ready, device } = useFreshBox();
  const [filter, setFilter] = useState<"all" | Verdict>("all");

  const analyzed = useMemo(
    () =>
      boxes.map((box) => ({
        box,
        analysis: analyzeBox(box),
      })),
    [boxes],
  );

  const counts = {
    all: analyzed.length,
    safe: analyzed.filter((item) => item.analysis.verdict === "safe").length,
    soon: analyzed.filter((item) => item.analysis.verdict === "soon").length,
    unsafe: analyzed.filter((item) => item.analysis.verdict === "unsafe").length,
  };

  const visible = analyzed.filter((item) =>
    filter === "all" ? true : item.analysis.verdict === filter,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="font-heading text-xl font-semibold tracking-tight">
            Fridge
          </h1>
          <p className="text-xs text-muted-foreground">
            {counts.soon} to cook today · {counts.unsafe} to toss
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Swipe left on a food to discard it.</p>
          {device ? (
            <p className="mt-1 font-mono text-[11px] text-[#5f8f4a]">
              {device.name} · {device.temperature.toFixed(1)}°C · {device.co2Ppm} ppm
              CO2 · {device.source ?? "unknown"}
            </p>
          ) : null}
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-full bg-[#efe6d6] p-1">
        {filters.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-pressed={filter === item.id}
            onClick={() => setFilter(item.id)}
            className={cn(
              "flex-1 rounded-full px-2 py-1.5 text-xs font-medium whitespace-nowrap transition-colors",
              filter === item.id
                ? "bg-white text-zinc-900 shadow-sm"
                : "text-muted-foreground",
            )}
          >
            {item.label}
            <span className="ml-1 opacity-70">{counts[item.id]}</span>
          </button>
        ))}
      </div>

      {!ready ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-[1.6rem] bg-white/70" />
          ))}
        </div>
      ) : visible.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[1.6rem] border border-dashed border-[#d9cbb3] bg-white/60 px-4 py-12 text-center">
          <Container className="size-7 text-muted-foreground" />
          <p className="text-sm font-medium">Nothing in this filter</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setFilter("all")}>
              Show all
            </Button>
            <AddBoxDialog />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {visible.map(({ box }) => (
            <BoxCard key={box.id} box={box} />
          ))}
        </div>
      )}
    </div>
  );
}
