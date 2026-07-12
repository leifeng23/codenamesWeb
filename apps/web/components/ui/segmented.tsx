"use client";

import { cn } from "../../lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: React.ReactNode;
  /** 选中态的强调色 class，如 "bg-ember/25 text-ember" */
  activeClass?: string;
}

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  disabled = false,
  className
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("inline-flex gap-0.5 rounded-md border border-white/10 bg-black/25 p-0.5", className)}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => {
              if (!active) onChange(option.value);
            }}
            className={cn(
              "rounded px-2 py-1 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40",
              active
                ? option.activeClass ?? "bg-white/12 text-white"
                : "text-white/50 hover:bg-white/[0.06] hover:text-white/80"
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
