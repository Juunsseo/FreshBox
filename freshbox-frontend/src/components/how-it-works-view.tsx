"use client";

import { useState } from "react";
import {
  Cpu,
  RadioReceiver,
  ShieldCheck,
  Thermometer,
  Wind,
  Workflow,
} from "lucide-react";

import { buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FoodIcon } from "@/components/food-icon";
import { FOOD_TYPES, getFood } from "@/lib/foods";
import type { FreshnessResult, FoodType } from "@/lib/types";
import { VerdictBadge } from "@/components/verdict-badge";

export function HowItWorksView() {
  return (
    <div className="flex flex-col gap-8">
      <section className="max-w-2xl">
        <p className="text-xs tracking-[0.22em] text-[#5f8f4a] uppercase">
          Raspberry Pi Pico · SCD41
        </p>
        <h1 className="mt-2 font-heading text-xl font-semibold tracking-tight">
          Hardware, five inputs, one score
        </h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground sm:text-base">
          A Sensirion SCD41 on I2C reads CO2, temperature, and humidity. A Pico
          2 W sends those readings over BLE to the Python backend. FreshBox answers two
          questions: can I eat this, and what should I cook first.
        </p>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        <Step
          icon={<RadioReceiver className="size-4" />}
          title="1. SCD41 measures"
          body="Photoacoustic CO2, temperature, and humidity on I2C (address 0x62). Wire SDA to GP4 and SCL to GP5 at 3.3 V."
        />
        <Step
          icon={<Cpu className="size-4" />}
          title="2. Pico W sends"
          body="MicroPython advertises FreshBox and notifies one compact BLE characteristic. The local Python gateway subscribes and stores every reading."
        />
        <Step
          icon={<ShieldCheck className="size-4" />}
          title="3. The web decides"
          body="Food type + time + temperature + CO2 + other gases become a 0–100 score, then a cook-first recipe."
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card className="border border-[#e4d8c4] bg-white shadow-none ring-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Thermometer className="size-4 text-primary" />
              The five factors
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
            <p>
              <span className="text-foreground">Type of food</span> sets the
              fridge life and the CO2 baseline. Kimchi already exhales a lot of
              CO2. Chicken does not.
            </p>
            <p>
              <span className="text-foreground">Time</span> is hours in the box,
              stretched by temperature (Q10: about 2× faster per +10°C).
            </p>
            <p>
              <span className="text-foreground">Temperature</span> comes from the
              SCD41. 0–4°C is the target. Protein food above ~15°C for 2 hours
              is forced to don&apos;t-eat.
            </p>
            <p>
              <span className="text-foreground">CO2</span> is the SCD41 headline
              number. Microbes and plant tissue breathe; a sealed box climbs
              from ~420 ppm toward the alarm line.
            </p>
            <p>
              <span className="text-foreground">Gases</span> are the extra
              channel (MQ-135 or SGP30 on the Pico). Ammonia and VOCs catch
              protein spoilage that CO2 alone can miss.
            </p>
          </CardContent>
        </Card>
        <Card className="border border-[#e4d8c4] bg-white shadow-none ring-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Workflow className="size-4 text-primary" />
              What to buy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-7 text-muted-foreground">
            <BomRow item="Raspberry Pi Pico 2 W" why="Runs MicroPython and advertises over BLE" />
            <BomRow item="Sensirion SCD41 breakout" why="CO2 + temperature + humidity on I2C" />
            <BomRow item="4 jumper wires" why="3V3, GND, SDA (GP4), SCL (GP5)" />
            <BomRow item="Food container" why="Headspace for the SCD41 to sample" />
            <BomRow item="USB cable" why="Power and programming" />
            <BomRow
              item="MQ-135 or SGP30 (optional)"
              why="Second gas channel for ammonia / TVOC"
            />
            <BomRow item="Breadboard (optional)" why="Prototype before mounting in the lid" />
            <p>
              Firmware: <code className="text-foreground">firmware/pico_scd41.py</code>.
              Install aioble, copy it to the Pico as <code className="text-foreground">main.py</code>,
              and enable BLE ingestion in the backend <code className="text-foreground">.env</code>.
            </p>
          </CardContent>
        </Card>
      </section>

      <AnalyzerPlayground />
    </div>
  );
}

function Step({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-[#e4d8c4] bg-white p-4">
      <div className="flex size-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
        {icon}
      </div>
      <h2 className="mt-3 font-medium">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">{body}</p>
    </div>
  );
}

function BomRow({ item, why }: { item: string; why: string }) {
  return (
    <div className="flex flex-col rounded-xl bg-[#f6f0e4] px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
      <span className="text-sm text-foreground">{item}</span>
      <span className="text-xs text-muted-foreground">{why}</span>
    </div>
  );
}

function AnalyzerPlayground() {
  const [foodType, setFoodType] = useState<FoodType>("chicken");
  const [temperature, setTemperature] = useState("8.2");
  const [co2Ppm, setCo2Ppm] = useState("1480");
  const [gasPpm, setGasPpm] = useState("210");
  const [elapsedHours, setElapsedHours] = useState("20");
  const [result, setResult] = useState<FreshnessResult | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function run() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          foodType,
          elapsedHours: Number(elapsedHours),
          temperature: Number(temperature),
          humidity: 64,
          co2Ppm: Number(co2Ppm),
          gasPpm: Number(gasPpm),
          lidOpen: false,
        }),
      });
      const json = await response.json();
      if (!response.ok) {
        throw new Error(json.error ?? "Analysis failed");
      }
      setResult(json);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Analysis failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border border-[#e4d8c4] bg-white shadow-none ring-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wind className="size-4 text-primary" />
          Same JSON the Pico will send
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Food type, time, temperature, CO2, gases. This calls{" "}
          <code className="text-foreground">POST /api/analyze</code>.
        </p>
      </CardHeader>
      <CardContent className="grid gap-5 lg:grid-cols-2">
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void run();
          }}
        >
          <div className="grid gap-1.5">
            <Label>Type of food</Label>
            <Select
              value={foodType}
              onValueChange={(value) => {
                if (value) setFoodType(value as FoodType);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FOOD_TYPES.filter((type) => !type.startsWith("custom-")).map((type) => (
                  <SelectItem key={type} value={type}>
                    <span className="inline-flex items-center gap-2">
                      <FoodIcon type={type} className="size-5" />
                      {getFood(type).label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Temperature °C" value={temperature} onChange={setTemperature} />
            <Field label="Time (hours)" value={elapsedHours} onChange={setElapsedHours} />
            <Field label="CO2 ppm" value={co2Ppm} onChange={setCo2Ppm} />
            <Field label="Gases ppm" value={gasPpm} onChange={setGasPpm} />
          </div>
          <button type="submit" className={buttonVariants()} disabled={pending}>
            {pending ? "Scoring..." : "Ask the server"}
          </button>
        </form>
        <div className="rounded-2xl bg-[#f6f0e4] p-4" aria-live="polite">
          {error ? (
            <p className="text-sm text-[#b44a32]">{error}</p>
          ) : result ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <VerdictBadge verdict={result.verdict} />
                <span className="font-mono text-sm">{result.score} pts</span>
              </div>
              <p className="text-lg font-medium">{result.headline}</p>
              <p className="text-sm leading-6 text-muted-foreground">
                {result.advice}
              </p>
              <p className="text-sm text-[#5f8f4a]">{result.cookHint}</p>
              <ul className="space-y-1.5 text-sm leading-6">
                {result.reasons.map((reason) => (
                  <li key={reason}>· {reason}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-sm leading-6 text-muted-foreground">
              Enter SCD41-style numbers and press the button. The Pico sketch
              posts this same shape.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{label}</Label>
      <Input value={value} onChange={(event) => onChange(event.target.value)} />
    </div>
  );
}
