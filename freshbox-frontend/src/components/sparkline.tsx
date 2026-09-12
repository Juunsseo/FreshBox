import { cn } from "@/lib/utils";
import type { Verdict } from "@/lib/types";

export function Sparkline({
  values,
  className,
  tone = "safe",
}: {
  values: number[];
  className?: string;
  tone?: Verdict;
}) {
  if (values.length < 2) {
    return <div className={cn("h-10", className)} />;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const coords = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100;
    const y = 26 - ((value - min) / range) * 22;
    return `${x},${y}`;
  });
  const stroke =
    tone === "unsafe" ? "#fb7185" : tone === "soon" ? "#fbbf24" : "#34d399";

  return (
    <svg
      viewBox="0 0 100 28"
      className={cn("h-10 w-full overflow-visible", className)}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
        points={coords.join(" ")}
      />
    </svg>
  );
}

export function ScoreRing({
  score,
  tone,
  size = 88,
}: {
  score: number;
  tone: Verdict;
  size?: number;
}) {
  const radius = 34;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (score / 100) * circ;
  const color =
    tone === "unsafe" ? "#fb7185" : tone === "soon" ? "#fbbf24" : "#34d399";

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox="0 0 80 80" className="h-full w-full -rotate-90">
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-[#e4d8c4]"
          strokeWidth="7"
        />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-xl font-semibold tracking-tight">
          {score}
        </span>
        <span className="text-[10px] tracking-wide text-muted-foreground">
          /100
        </span>
      </div>
    </div>
  );
}
