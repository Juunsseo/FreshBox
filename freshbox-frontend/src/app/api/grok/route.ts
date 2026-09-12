import { NextResponse } from "next/server";

import {
  localAgentReply,
  snapshotBoxes,
  type FridgeSnapshot,
} from "@/lib/grok-agent";
import { askBackendGrok, getFridge } from "@/lib/server-fridge";

type Incoming = {
  messages?: { role: "user" | "assistant"; content: string }[];
  boxes?: FridgeSnapshot[];
};

export async function POST(request: Request) {
  let body: Incoming;
  try {
    body = (await request.json()) as Incoming;
  } catch {
    return NextResponse.json({ error: "JSON body required." }, { status: 400 });
  }

  const messages = body.messages ?? [];
  const lastUser = [...messages].reverse().find((item) => item.role === "user");
  if (!lastUser?.content.trim()) {
    return NextResponse.json({ error: "Ask Grok a question." }, { status: 400 });
  }

  const snap: FridgeSnapshot[] =
    body.boxes && body.boxes.length > 0
      ? body.boxes
      : snapshotBoxes((await getFridge()).boxes);
  try {
    return NextResponse.json(
      await askBackendGrok({ messages: messages.slice(-8), fridge: snap }),
    );
  } catch {
    // Keep the deterministic local fallback when no key is configured.
  }

  return NextResponse.json({
    reply: localAgentReply(lastUser.content, snap),
    source: "fridge",
  });
}
