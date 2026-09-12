"use client";

import { useRef, useState } from "react";
import { SendHorizonal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { snapshotBoxes, localAgentReply, type ChatMessage } from "@/lib/grok-agent";
import { useFreshBox } from "@/lib/store";
import { cn } from "@/lib/utils";

const SUGGESTIONS = [
  "What should I cook first?",
  "What's going bad?",
  "What's in my fridge?",
];

export function GrokView() {
  const { boxes, ready } = useFreshBox();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content:
        "I'm Grok for this fridge. I can see the sensor boxes and tell you what to cook first, what to toss, and how to rescue tired food.",
    },
  ]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const content = text.trim();
    if (!content || pending) return;
    const next = [...messages, { role: "user" as const, content }];
    setMessages(next);
    setInput("");
    setPending(true);
    setError("");
    const snap = snapshotBoxes(boxes);
    const local = localAgentReply(content, snap);
    setMessages([...next, { role: "assistant", content: local }]);
    setPending(false);
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
    });
    try {
      const response = await fetch("/api/grok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: next,
          boxes: snap,
        }),
        signal: AbortSignal.timeout(8000),
      });
      const json = await response.json();
      if (response.ok && json.source === "grok" && json.reply) {
        setMessages([...next, { role: "assistant", content: json.reply }]);
      }
    } catch {
      // On-device reply is already on screen.
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div>
        <h1 className="font-heading text-xl font-semibold tracking-tight">Grok AI</h1>
        <p className="text-xs text-muted-foreground">
          Fridge agent — cook-first, never cook food marked don&apos;t-eat.
        </p>
      </div>

      <div
        ref={listRef}
        className="flex flex-1 flex-col gap-2 overflow-y-auto rounded-[1.6rem] border border-[#e4d8c4] bg-white p-3"
      >
        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={cn(
              "max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm leading-6",
              message.role === "assistant"
                ? "self-start bg-[#f6f0e4] text-zinc-800"
                : "self-end bg-[#eef8e8] text-zinc-900",
            )}
          >
            {message.role === "assistant" && (
              <img
                src="/icons/nav/grok.webp"
                alt=""
                className="mb-1 size-6 object-contain"
              />
            )}
            {message.content}
          </div>
        ))}
        {pending ? (
          <p className="text-xs text-muted-foreground">Grok is looking at the boxes…</p>
        ) : null}
        {error ? <p className="text-xs text-[#b44a32]">{error}</p> : null}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {SUGGESTIONS.map((item) => (
          <button
            key={item}
            type="button"
            disabled={!ready || pending}
            onClick={() => void send(item)}
            className="rounded-full border border-[#e4d8c4] bg-white px-3 py-1 text-[11px] text-muted-foreground"
          >
            {item}
          </button>
        ))}
      </div>

      <form
        className="flex items-center gap-2 rounded-full border border-[#e4d8c4] bg-white py-1 pr-1 pl-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
      >
        <input
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Ask Grok about the fridge"
          className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <Button type="submit" size="icon" className="size-9 rounded-full" disabled={pending}>
          <SendHorizonal className="size-4" />
        </Button>
      </form>
    </div>
  );
}
