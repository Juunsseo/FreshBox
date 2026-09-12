"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AddBoxDialog } from "@/components/add-box-dialog";
import { cn } from "@/lib/utils";

const tabs = [
  { href: "/", label: "Freshness", icon: "/icons/nav/freshness.webp" },
  { href: "/cook", label: "Cook", icon: "/icons/nav/cook.webp" },
  { href: "/grok", label: "Grok AI", icon: "/icons/nav/grok.webp" },
  { href: "/settings", label: "Settings", icon: "/icons/nav/settings.webp" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-full flex-col bg-[#f6f0e4]">
      <header className="sticky top-0 z-40 border-b border-[#e4d8c4]/80 bg-[#f6f0e4]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-lg items-center gap-2 px-3">
          <Link href="/" className="flex items-center gap-2">
            <img
              src="/icons/foods/leafy.webp"
              alt=""
              className="size-8 object-contain"
            />
            <span className="text-sm font-semibold tracking-tight">FreshBox</span>
          </Link>
          <div className="ml-auto">
            <AddBoxDialog compact />
          </div>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-3 pb-28 pt-4 min-h-0">
        {children}
      </main>
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-[#e4d8c4]/80 bg-[#f6f0e4]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className="mx-auto grid max-w-lg grid-cols-4">
          {tabs.map((tab) => {
            const active =
              tab.href === "/"
                ? pathname === "/"
                : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium",
                  active ? "text-[#5f8f4a]" : "text-muted-foreground",
                )}
              >
                <img
                  src={tab.icon}
                  alt=""
                  className={cn(
                    "size-8 object-contain transition-transform",
                    active && "scale-110",
                    !active && "opacity-70 grayscale-[0.25]",
                  )}
                />
                {tab.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
