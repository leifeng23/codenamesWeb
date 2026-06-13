import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-md border border-white/12 bg-black/25 px-3 text-sm text-white outline-none transition placeholder:text-white/35 focus:border-storm/70 focus:ring-2 focus:ring-storm/20",
        className
      )}
      {...props}
    />
  );
}
