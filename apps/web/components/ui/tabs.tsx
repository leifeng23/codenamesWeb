"use client";

import { cn } from "../../lib/utils";

export interface TabItem {
  value: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export function Tabs({
  items,
  value,
  onChange,
  className
}: {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex gap-1 rounded-lg border border-white/10 bg-black/25 p-1", className)} role="tablist">
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              "relative flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-semibold transition",
              active ? "bg-white/10 text-white" : "text-white/50 hover:bg-white/[0.06] hover:text-white/80"
            )}
          >
            {item.icon}
            {item.label}
            {item.badge}
          </button>
        );
      })}
    </div>
  );
}
