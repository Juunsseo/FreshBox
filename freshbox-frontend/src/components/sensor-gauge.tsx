import { cn } from "@/lib/utils";

export function SensorGauge({
  label,
  value,
  unit,
  hint,
  percent,
  tone,
}: {
  label: string;
  value: string;
  unit: string;
  hint: string;
  percent: number;
  tone: "safe" | "soon" | "unsafe";
}) {
  return (
    <div className="rounded-2xl border border-[#e4d8c4] bg-white p-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs tracking-wide text-muted-foreground">{label}</p>
        <p className="font-mono text-lg font-medium tracking-tight">
          {value}
          <span className="ml-1 text-xs text-muted-foreground">{unit}</span>
        </p>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#efe6d6]">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            tone === "safe" && "bg-[#7bc67e]",
            tone === "soon" && "bg-[#d4a06a]",
            tone === "unsafe" && "bg-[#d16b4c]",
          )}
          style={{ width: `${Math.min(100, Math.max(4, percent))}%` }}
        />
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{hint}</p>
    </div>
  );
}
