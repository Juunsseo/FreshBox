"use client";

import { useState } from "react";
import Link from "next/link";
import { Cpu, Download, Info, Link2, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useFreshBox } from "@/lib/store";

export function SettingsView() {
  const { resetDemo, device } = useFreshBox();
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    const url = window.location.origin;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-xs text-muted-foreground">Shared demo fridge · one SCD41</p>
      </div>

      <a
        href="/api/download"
        download="freshbox.zip"
        className="flex items-center gap-3 rounded-[1.4rem] border border-[#e4d8c4] bg-white px-4 py-3.5 text-left"
      >
        <Download className="size-5 text-[#5f8f4a]" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Download source zip</p>
          <p className="text-xs text-muted-foreground">
            All project code, without node_modules.
          </p>
        </div>
      </a>

      <button
        type="button"
        onClick={() => void copyLink()}
        className="flex items-center gap-3 rounded-[1.4rem] border border-[#e4d8c4] bg-white px-4 py-3.5 text-left"
      >
        <Link2 className="size-5 text-[#5f8f4a]" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{copied ? "Link copied" : "Copy share link"}</p>
          <p className="truncate text-xs text-muted-foreground">
            Anyone with this URL sees the same fridge.
          </p>
        </div>
      </button>

      <Link
        href="/how-it-works"
        className="flex items-center gap-3 rounded-[1.4rem] border border-[#e4d8c4] bg-white px-4 py-3.5"
      >
        <img src="/icons/foods/seedling.webp" alt="" className="size-10 object-contain" />
        <div>
          <p className="text-sm font-medium">Hardware · Pico W + SCD41</p>
          <p className="text-xs text-muted-foreground">Wiring, BOM, and the analyze API</p>
        </div>
      </Link>

      <div className="rounded-[1.4rem] border border-[#e4d8c4] bg-white px-4 py-3.5 text-sm leading-6 text-muted-foreground">
        <p className="inline-flex items-center gap-2 text-foreground">
          <Info className="size-4 text-primary" />
          What the box measures
        </p>
        <p className="mt-2">
          Sensirion SCD41 on I2C: CO2, temperature, humidity. This demo has one
          chip
          {device
            ? ` — live ${device.temperature.toFixed(1)}°C, ${device.co2Ppm} ppm CO2`
            : ""}
          . Food type and device time complete the score.
        </p>
      </div>

      <div className="rounded-[1.4rem] border border-[#e4d8c4] bg-white px-4 py-3.5 text-sm leading-6 text-muted-foreground">
        <p className="inline-flex items-center gap-2 text-foreground">
          <img src="/icons/nav/grok.webp" alt="" className="size-6 object-contain" />
          Grok AI
        </p>
        <p className="mt-2">
          The Grok tab reads your live boxes and answers cook-first questions. Add{" "}
          <code className="text-foreground">XAI_API_KEY</code> to the backend <code className="text-foreground">.env</code> to talk to xAI Grok; without it, the fridge agent still answers from the shared boxes.
        </p>
      </div>

      <Button
        variant="outline"
        className="h-11 justify-start rounded-2xl bg-white"
        onClick={() => resetDemo()}
      >
        <RotateCcw className="size-4" />
        Reset demo boxes
      </Button>

      <p className="inline-flex items-center gap-2 text-xs text-muted-foreground">
        <Cpu className="size-3.5" />
        Simulation demo — not a certified food-safety device.
      </p>
    </div>
  );
}
