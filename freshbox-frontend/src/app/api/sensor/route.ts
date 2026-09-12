import { NextResponse } from "next/server";

import { getFridge } from "@/lib/server-fridge";

export async function GET() {
  const { device } = await getFridge();
  return NextResponse.json(device);
}
