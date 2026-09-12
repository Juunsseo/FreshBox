import { getFood } from "@/lib/foods";
import type { FoodType } from "@/lib/types";
import { cn } from "@/lib/utils";

export function FoodIcon({
  type,
  className,
  alt,
}: {
  type: FoodType;
  className?: string;
  alt?: string;
}) {
  const food = getFood(type);
  return (
    <img
      src={food.icon}
      alt={alt ?? food.label}
      draggable={false}
      className={cn("object-contain", className)}
    />
  );
}
