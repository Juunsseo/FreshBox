import { NextResponse } from "next/server";

import { isFoodType } from "@/lib/foods";
import { analyzeFreshness } from "@/lib/freshness";
import { getFridge } from "@/lib/server-fridge";
import type { FoodType } from "@/lib/types";

type Payload = {
  foodType?: string;
  deviceTime?: string;
  elapsedHours?: number;
  temperature?: number;
  humidity?: number;
  co2Ppm?: number;
  gasPpm?: number;
  vocPpm?: number;
  lidOpen?: boolean;
};

export async function POST(request: Request) {
  let body: Payload;
  try {
    body = (await request.json()) as Payload;
  } catch {
    return NextResponse.json({ error: "JSON body required." }, { status: 400 });
  }

  const foodType = body.foodType as FoodType | undefined;
  if (!foodType || !isFoodType(foodType)) {
    return NextResponse.json(
      { error: "Unsupported foodType. Use a listed type or custom-vegi / custom-fruits / custom-meal." },
      { status: 400 },
    );
  }

  const device = (await getFridge()).device;
  const started = body.deviceTime ? Date.parse(body.deviceTime) : Number.NaN;
  const elapsedHours = Number.isFinite(started)
    ? Math.max(0, (Date.now() - started) / 3600 / 1000)
    : Number(body.elapsedHours);
  const temperature = Number(body.temperature ?? device.temperature);
  const humidity = Number(body.humidity ?? device.humidity);
  const co2Ppm = Number(body.co2Ppm ?? device.co2Ppm);
  const gasPpm = Number(body.gasPpm ?? body.vocPpm ?? device.gasPpm);

  if ([elapsedHours, temperature, co2Ppm].some((n) => Number.isNaN(n))) {
    return NextResponse.json(
      {
        error:
          "foodType is required. deviceTime (or elapsedHours) lets the server pull the SCD41.",
      },
      { status: 400 },
    );
  }

  const result = analyzeFreshness({
    foodType,
    elapsedHours,
    lidOpen: Boolean(body.lidOpen),
    sensors: {
      temperature,
      humidity: Number.isNaN(humidity) ? device.humidity : humidity,
      co2Ppm,
      gasPpm: Number.isNaN(gasPpm) ? device.gasPpm : gasPpm,
    },
  });

  return NextResponse.json({
    ...result,
    deviceTime: body.deviceTime ?? new Date(Date.now() - elapsedHours * 3600 * 1000).toISOString(),
    sensors: {
      temperature,
      humidity,
      co2Ppm,
      gasPpm,
    },
    device,
  });
}
