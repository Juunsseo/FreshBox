import { NextResponse } from "next/server";

import { addFoodBox, getFridge, resetFridge } from "@/lib/server-fridge";

export async function GET() {
  try {
    return NextResponse.json(await getFridge());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Backend unavailable." },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  let body: { foodType?: string; deviceTime?: string; reset?: boolean };
  try {
    body = (await request.json()) as { foodType?: string; deviceTime?: string; reset?: boolean };
  } catch {
    return NextResponse.json({ error: "JSON body required." }, { status: 400 });
  }

  if (body.reset) {
    return NextResponse.json(await resetFridge());
  }

  if (!body.foodType) {
    return NextResponse.json({ error: "foodType is required." }, { status: 400 });
  }

  try {
    const result = await addFoodBox({
      foodType: body.foodType,
      deviceTime: body.deviceTime,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Could not add food." },
      { status: 400 },
    );
  }
}
