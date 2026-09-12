"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FoodIcon } from "@/components/food-icon";
import {
  FOOD_CATEGORIES,
  foodsInCategory,
  resolveFoodType,
} from "@/lib/foods";
import type { FoodCategory } from "@/lib/types";
import { useFreshBox } from "@/lib/store";
import { cn } from "@/lib/utils";

export function AddBoxDialog({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const { addBox } = useFreshBox();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<FoodCategory>("vegi");
  const [foodType, setFoodType] = useState("tomato");
  const [typeQuery, setTypeQuery] = useState("");

  const [pending, setPending] = useState(false);

  const listed = useMemo(() => foodsInCategory(category), [category]);
  const visible = useMemo(() => {
    const q = typeQuery.trim().toLowerCase();
    if (!q) return listed;
    return listed.filter(
      (food) =>
        food.label.toLowerCase().includes(q) || food.id.includes(q.replaceAll(" ", "_")),
    );
  }, [listed, typeQuery]);

  function pickCategory(next: FoodCategory) {
    setCategory(next);
    const first = foodsInCategory(next)[0];
    setFoodType(first?.id ?? `custom-${next}`);
    setTypeQuery("");
  }

  async function submit() {
    const resolved = typeQuery.trim()
      ? resolveFoodType(category, typeQuery)
      : foodType;
    setPending(true);
    try {
      const box = await addBox({
        foodType: resolved,
        deviceTime: new Date().toISOString(),
      });
      setOpen(false);
      setTypeQuery("");
      router.push(`/box/${box.id}`);
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        aria-label="Add container"
        className={cn(
          buttonVariants({
            variant: compact ? "ghost" : "default",
            size: compact ? "icon" : "default",
          }),
          compact && "size-11",
        )}
      >
        <Plus className="size-4" />
        {compact ? null : "Add"}
      </DialogTrigger>
      <DialogContent className="z-[80] max-h-[min(36rem,calc(100dvh-4rem))] max-w-[calc(100%-1.5rem)] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add food</DialogTitle>
          <DialogDescription>
            Pick the food. This phone stamps the time; the backend pulls the
            SCD41.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Category</Label>
            <div className="grid grid-cols-3 gap-2">
              {FOOD_CATEGORIES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => pickCategory(item.id)}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-2xl border px-2 py-2.5 text-xs font-medium",
                    category === item.id
                      ? "border-[#b8ddb0] bg-[#eef8e8] text-zinc-900"
                      : "border-[#e4d8c4] bg-white text-muted-foreground",
                  )}
                >
                  <img src={item.icon} alt="" className="size-10 object-contain" />
                  {item.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="food-type">Food type</Label>
            <Input
              id="food-type"
              placeholder="Search or type a new type"
              value={typeQuery}
              onChange={(event) => {
                setTypeQuery(event.target.value);
                if (event.target.value.trim()) {
                  setFoodType(resolveFoodType(category, event.target.value));
                }
              }}
            />
            <div className="grid max-h-44 grid-cols-4 gap-1.5 overflow-y-auto rounded-2xl bg-[#f6f0e4] p-1.5">
              {visible.length === 0 ? (
                <p className="col-span-4 px-2 py-6 text-center text-xs text-muted-foreground">
                  Will add as a custom {category} item.
                </p>
              ) : (
                visible.map((food) => (
                  <button
                    key={food.id}
                    type="button"
                    onClick={() => {
                      setFoodType(food.id);
                      setTypeQuery("");
                    }}
                    className={cn(
                      "flex flex-col items-center gap-1 rounded-xl px-1 py-1.5 text-[10px] leading-tight",
                      foodType === food.id && !typeQuery
                        ? "bg-white shadow-sm"
                        : "hover:bg-white/70",
                    )}
                  >
                    <FoodIcon type={food.id} className="size-9" />
                    <span className="line-clamp-2 text-center">{food.label}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} disabled={pending}>
            {pending ? "Reading sensor…" : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
