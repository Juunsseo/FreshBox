"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChefHat, Clock3, Flame, ListOrdered, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FoodIcon } from "@/components/food-icon";
import { planMeals, type MealPlan } from "@/lib/recipes";
import { useFreshBox } from "@/lib/store";
import { VerdictBadge } from "@/components/verdict-badge";
import { cn } from "@/lib/utils";

export function CookView() {
  const { boxes, ready } = useFreshBox();
  const plan = useMemo(() => planMeals(boxes), [boxes]);

  if (!ready) {
    return <div className="h-80 animate-pulse rounded-3xl bg-white/70" />;
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="max-w-2xl">
        <h1 className="font-heading text-xl font-semibold tracking-tight">
          Cook first
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Least fresh goes to the pan first. Tired food gets a hotter recipe.
        </p>
      </section>

      <section className="grid gap-3 lg:grid-cols-3">
        <Card className="border border-[#e4d8c4] bg-white shadow-none ring-0 lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ListOrdered className="size-4 text-primary" />
              Cook first
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Lowest freshness score goes to the pan first.
            </p>
          </CardHeader>
          <CardContent className="space-y-2">
            {plan.cookQueue.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing left that is safe to cook.
              </p>
            ) : (
              plan.cookQueue.map((item, index) => (
                <Link
                  key={item.box.id}
                  href={`/box/${item.box.id}`}
                  className="flex items-center gap-3 rounded-xl bg-[#f6f0e4] px-3 py-2.5 transition-colors hover:bg-[#efe6d6]"
                >
                  <span className="font-mono text-sm text-muted-foreground">
                    {index + 1}
                  </span>
                  <FoodIcon type={item.box.foodType} className="size-8" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{item.box.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {item.analysis.cookHint}
                    </p>
                  </div>
                  <span className="font-mono text-sm">{item.analysis.score}</span>
                  <VerdictBadge verdict={item.analysis.verdict} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        <Card className="border border-[#e4d8c4] bg-white shadow-none ring-0">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="size-4 text-[#d16b4c]" />
              Discard
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {plan.discard.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing to throw out right now.
              </p>
            ) : (
              plan.discard.map((item) => (
                <Link
                  key={item.box.id}
                  href={`/box/${item.box.id}`}
                  className="block rounded-xl border border-[#edc4b4] bg-[#fbeae4] px-3 py-2.5"
                >
                  <p className="flex items-center gap-2 font-medium">
                    <FoodIcon type={item.box.foodType} className="size-6" />
                    {item.box.name}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[#b44a32]">
                    {item.analysis.cookHint}
                  </p>
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold">Suggested meals</h2>
          <p className="text-sm text-muted-foreground">
            Pantry extras are listed so you know what to buy besides the sensor
            box.
          </p>
        </div>
        {plan.meals.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[#d9cbb3] bg-white/60 px-6 py-12 text-center text-sm text-muted-foreground">
            Add more food to a container to unlock recipes.
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {plan.meals.map((meal) => (
              <MealCard key={meal.recipe.id} meal={meal} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function MealCard({ meal }: { meal: MealPlan }) {
  return (
    <Card className="border border-[#e4d8c4] bg-white shadow-none ring-0">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <span>{meal.recipe.emoji}</span>
            {meal.recipe.title}
          </CardTitle>
          <Badge
            variant="outline"
            className={cn(
              meal.mode === "optimise" &&
                "border-[#ead3a8] bg-[#fbf3e2] text-[#9a6b2a]",
              meal.mode === "fresh" &&
                "border-[#b8ddb0] bg-[#eef8e8] text-[#3f7a3c]",
            )}
          >
            {meal.replacements.length > 0 ? "Fresh replacement needed" : meal.mode === "optimise" ? (
              <>
                <Flame className="size-3" />
                Rescue cook
              </>
            ) : (
              <>
                <ChefHat className="size-3" />
                Fresh serve
              </>
            )}
          </Badge>
        </div>
        <p className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock3 className="size-3" />
            {meal.recipe.minutes} min
          </span>
          <span>{meal.recipe.servings}</span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm leading-6 text-muted-foreground">{meal.why}</p>
        <div>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            From your boxes
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {meal.used.map((item) => (
              <Button
                key={item.box.id}
                size="sm"
                variant="outline"
                render={<Link href={`/box/${item.box.id}`} />}
              >
                <FoodIcon type={item.box.foodType} className="size-4" /> {item.box.name}
              </Button>
            ))}
            {meal.optionalUsed.map((item) => (
              <Badge key={item.box.id} variant="secondary">
                optional · {item.box.name}
              </Badge>
            ))}
          </div>
        </div>
        <div>
          <p className="text-xs tracking-wide text-muted-foreground uppercase">
            Extra ingredients
          </p>
          <p className="mt-1 text-sm">{meal.recipe.pantry.join(", ")}</p>
        </div>
        <ol className="space-y-1.5 text-sm leading-6">
          {meal.steps.map((step, index) => (
            <li key={step}>
              <span className="mr-2 font-mono text-xs text-muted-foreground">
                {index + 1}.
              </span>
              {step}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
