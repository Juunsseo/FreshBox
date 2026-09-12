"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChefHat,
  DoorOpen,
  FastForward,
  Trash2,
} from "lucide-react";

import { SensorGauge } from "@/components/sensor-gauge";
import { Sparkline } from "@/components/sparkline";
import { VerdictBadge, VerdictBanner } from "@/components/verdict-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFood } from "@/lib/foods";
import { FoodIcon } from "@/components/food-icon";
import { formatHours, formatHumidity, formatPpm, formatTemp } from "@/lib/format";
import { mealsForBox } from "@/lib/recipes";
import { useBoxAnalysis, useFreshBox } from "@/lib/store";
import type { BoxRecord, Verdict } from "@/lib/types";

export function BoxDetailView({ id }: { id: string }) {
  const { boxes, ready } = useFreshBox();
  const box = boxes.find((item) => item.id === id);

  if (!ready) {
    return <div className="h-80 animate-pulse rounded-3xl bg-white/70" />;
  }

  if (!box) {
    return (
      <div className="flex flex-col items-center gap-3 py-24 text-center">
        <p className="text-lg font-medium">This container is gone</p>
        <p className="text-sm text-muted-foreground">
          The demo may have been reset, or this box was deleted.
        </p>
        <Button render={<Link href="/" />}>Back to dashboard</Button>
      </div>
    );
  }

  return <BoxDetailLoaded box={box} />;
}

function BoxDetailLoaded({ box }: { box: BoxRecord }) {
  const router = useRouter();
  const { boxes, toggleLid, skipHours, removeBox } = useFreshBox();
  const food = getFood(box.foodType);
  const analysis = useBoxAnalysis(box);
  const meals = useMemo(() => mealsForBox(box, boxes), [box, boxes]);

  const tempTone = toneFromThreshold(box.sensors.temperature, 4.5, 8);
  const humidityTone = food.moldSensitive
    ? toneFromThreshold(box.sensors.humidity, 78, 85)
    : "safe";
  const co2Tone = toneFromThreshold(
    box.sensors.co2Ppm,
    food.co2Baseline + food.co2Rise * 0.35,
    food.co2Alarm,
  );
  const gasTone = toneFromThreshold(
    box.sensors.gasPpm,
    food.gasBaseline + food.gasRise * 0.35,
    food.gasAlarm,
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" render={<Link href="/" />}>
          <ArrowLeft className="size-4" />
          Back
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <FoodIcon type={box.foodType} className="size-10" />
            <h1 className="font-heading text-2xl font-semibold tracking-tight">
              {box.name}
            </h1>
            <VerdictBadge verdict={analysis.verdict} />
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {food.label} · {formatHours(box.elapsedHours)} stored
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" render={<Link href="/cook" />}>
            <ChefHat className="size-4" />
            Cook ideas
          </Button>
          <Button variant="outline" onClick={() => toggleLid(box.id)}>
            <DoorOpen className="size-4" />
            {box.lidOpen ? "Close lid" : "Open lid"}
          </Button>
          <Button variant="outline" onClick={() => skipHours(box.id, 12)}>
            <FastForward className="size-4" />
            Skip 12 hours
          </Button>
          <Button
            variant="destructive"
            onClick={() => {
              removeBox(box.id);
              router.push("/");
            }}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
      </div>

      <VerdictBanner
        verdict={analysis.verdict}
        headline={analysis.headline}
        advice={analysis.advice}
      />

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SensorGauge
          label="Temperature · SCD41"
          value={box.sensors.temperature.toFixed(1)}
          unit="°C"
          hint="Fridge target is 0–4°C. Warmer air speeds spoilage (Q10)."
          percent={Math.min(100, (box.sensors.temperature / 25) * 100)}
          tone={tempTone}
        />
        <SensorGauge
          label="Humidity · SCD41"
          value={box.sensors.humidity.toFixed(0)}
          unit="%"
          hint={
            food.moldSensitive
              ? "Fruit and greens grow mold faster when humidity is high."
              : "Helper signal from the same SCD41 chip."
          }
          percent={box.sensors.humidity}
          tone={humidityTone}
        />
        <SensorGauge
          label="CO2 · SCD41"
          value={`${Math.round(box.sensors.co2Ppm)}`}
          unit="ppm"
          hint={food.note}
          percent={Math.min(100, ((box.sensors.co2Ppm - 400) / (food.co2Alarm - 400)) * 100)}
          tone={co2Tone}
        />
        <SensorGauge
          label="Gases · MQ-135 / SGP30"
          value={`${Math.round(box.sensors.gasPpm)}`}
          unit="ppm"
          hint="Second channel for ammonia and VOCs the SCD41 does not see."
          percent={Math.min(100, (box.sensors.gasPpm / (food.gasAlarm * 1.4)) * 100)}
          tone={gasTone}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border border-[#e4d8c4] bg-white shadow-none ring-0">
          <CardHeader>
            <CardTitle>CO2 over time</CardTitle>
            <p className="text-sm text-muted-foreground">
              A rising SCD41 line means the food is respiring or spoiling.{" "}
              {food.label} usually sits around {food.co2Baseline} ppm in a sealed box.
            </p>
          </CardHeader>
          <CardContent>
            <Sparkline
              className="h-28"
              tone={analysis.verdict}
              values={box.history.map((point) => point.co2Ppm)}
            />
            <div className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
              <MiniStat label="CO2" value={formatPpm(box.sensors.co2Ppm)} />
              <MiniStat label="Gases" value={formatPpm(box.sensors.gasPpm)} />
              <MiniStat label="Temp" value={formatTemp(box.sensors.temperature)} />
              <MiniStat label="Humidity" value={formatHumidity(box.sensors.humidity)} />
            </div>
          </CardContent>
        </Card>

        <Card className="border border-[#e4d8c4] bg-white shadow-none ring-0">
          <CardHeader>
            <CardTitle>Why this verdict?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <p className="text-sm leading-6 text-muted-foreground">
              {analysis.cookHint} Effective age is{" "}
              {formatHours(analysis.effectiveHours)} at {analysis.q10}× spoilage.
            </p>
            <ul className="space-y-2">
              {analysis.reasons.map((reason) => (
                <li
                  key={reason}
                  className="rounded-xl bg-[#f6f0e4] px-3 py-2 text-sm leading-6"
                >
                  {reason}
                </li>
              ))}
            </ul>
            {meals[0] && analysis.verdict !== "unsafe" && (
              <Button render={<Link href="/cook" />}>
                <ChefHat className="size-4" />
                {meals[0].recipe.title}
              </Button>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f6f0e4] px-3 py-2">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className="font-mono text-sm">{value}</p>
    </div>
  );
}

function toneFromThreshold(value: number, warn: number, danger: number): Verdict {
  if (value >= danger) return "unsafe";
  if (value >= warn) return "soon";
  return "safe";
}
