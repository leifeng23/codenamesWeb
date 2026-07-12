import type { ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/utils";

type Variant = "default" | "primary" | "danger" | "ghost";
type Size = "sm" | "md";

const variantClass: Record<Variant, string> = {
  default: "border-white/15 bg-white/10 text-white shadow-glow hover:bg-white/16",
  primary: "border-storm/40 bg-storm/18 text-white shadow-glow hover:bg-storm/28",
  danger: "border-ember/40 bg-ember/10 text-ember hover:bg-ember/20",
  ghost: "border-transparent bg-transparent text-white/75 hover:bg-white/10 hover:text-white"
};

const sizeClass: Record<Size, string> = {
  sm: "px-2.5 py-1.5 text-xs",
  md: "px-4 py-2 text-sm"
};

export function Button({
  className,
  variant = "default",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return (
    <button
      className={cn(
        "inline-flex cursor-pointer select-none items-center justify-center gap-2 rounded-md border font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-storm/60 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100",
        variantClass[variant],
        sizeClass[size],
        className
      )}
      {...props}
    />
  );
}
