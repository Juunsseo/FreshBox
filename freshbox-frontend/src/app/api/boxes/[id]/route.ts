import { NextResponse } from "next/server";

import { patchBox, removeBox } from "@/lib/server-fridge";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  let body: { lidOpen?: boolean; skipHours?: number };
  try {
    body = (await request.json()) as { lidOpen?: boolean; skipHours?: number };
  } catch {
    return NextResponse.json({ error: "JSON body required." }, { status: 400 });
  }
  const box = await patchBox(id, body);
  if (!box) return NextResponse.json({ error: "Box not found." }, { status: 404 });
  return NextResponse.json({ box });
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  await removeBox(id);
  return NextResponse.json({ ok: true });
}
