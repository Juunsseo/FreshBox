"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { Trash2 } from "lucide-react";

const REVEAL = 96;

export function SwipeToDiscard({ name, onDiscard, children }: {
  name: string;
  onDiscard: () => Promise<boolean>;
  children: ReactNode;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const pending = useRef(false);
  const suppressClick = useRef(false);
  const gesture = useRef<{
    id: number; x: number; y: number; start: number; offset: number;
    axis: "x" | "y" | null; width: number;
  } | null>(null);

  async function discard() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(false);
    try {
      if (await onDiscard()) return;
    } catch {
      // Keep the card available for a retry if the request fails.
    } finally {
      pending.current = false;
      setBusy(false);
    }
    setOffset(-REVEAL);
    setError(true);
  }

  function finish(event: PointerEvent<HTMLDivElement>, cancelled = false) {
    const current = gesture.current;
    if (!current || current.id !== event.pointerId) return;
    gesture.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (current.axis !== "x") return;
    if (!cancelled && -current.offset >= Math.max(REVEAL * 1.5, current.width * 0.65)) {
      void discard();
    } else {
      setOffset(cancelled ? current.start : current.offset < -REVEAL / 2 ? -REVEAL : 0);
    }
  }

  return (
    <div>
      <div className="relative isolate overflow-hidden rounded-[1.85rem] bg-[#b44a32]">
        <button
          type="button"
          aria-label={`Discard ${name}`}
          disabled={busy}
          onFocus={() => setOffset(-REVEAL)}
          onClick={() => void discard()}
          className="absolute inset-y-0 right-0 flex w-24 flex-col items-center justify-center gap-1 text-xs font-semibold text-white focus-visible:outline-2 focus-visible:outline-offset-[-6px] focus-visible:outline-white disabled:opacity-60"
        >
          <Trash2 className="size-5" />
          {busy ? "Discarding…" : "Discard"}
        </button>
        <div
          className="relative touch-pan-y select-none motion-safe:transition-transform motion-safe:duration-200"
          style={{ transform: `translateX(${offset}px)`, transition: dragging ? "none" : undefined }}
          onDragStart={(event) => event.preventDefault()}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOffset(0);
          }}
          onPointerDown={(event) => {
            if (busy || !event.isPrimary || event.button !== 0) return;
            suppressClick.current = false;
            gesture.current = { id: event.pointerId, x: event.clientX, y: event.clientY,
              start: offset, offset, axis: null, width: event.currentTarget.clientWidth };
          }}
          onPointerMove={(event) => {
            const current = gesture.current;
            if (!current || current.id !== event.pointerId) return;
            const dx = event.clientX - current.x;
            const dy = event.clientY - current.y;
            if (!current.axis && Math.max(Math.abs(dx), Math.abs(dy)) > 8) {
              current.axis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
              if (current.axis === "x") {
                event.currentTarget.setPointerCapture(event.pointerId);
                suppressClick.current = true;
                setDragging(true);
              }
            }
            if (current.axis !== "x") return;
            current.offset = Math.max(-current.width, Math.min(0, current.start + dx));
            setOffset(current.offset);
          }}
          onPointerUp={(event) => finish(event)}
          onPointerCancel={(event) => finish(event, true)}
          onClickCapture={(event) => {
            if (suppressClick.current || offset !== 0 || busy) {
              event.preventDefault();
              event.stopPropagation();
              if (!suppressClick.current && !busy) setOffset(0);
              suppressClick.current = false;
            }
          }}
        >
          {children}
        </div>
      </div>
      {error && <p role="alert" className="mt-1 px-3 text-xs text-[#b44a32]">Couldn’t discard {name}. Please try again.</p>}
    </div>
  );
}
