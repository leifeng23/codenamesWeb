import { cn } from "../../lib/utils";

type Tone = "storm" | "ember" | "brass" | "neutral" | "emerald";

const toneClass: Record<Tone, string> = {
  storm: "bg-storm/20 text-storm",
  ember: "bg-ember/20 text-ember",
  brass: "bg-brass/20 text-brass",
  neutral: "bg-white/5 text-white/45",
  emerald: "bg-emerald-400/15 text-emerald-300"
};

export function Badge({
  tone = "neutral",
  className,
  children
}: {
  tone?: Tone;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold", toneClass[tone], className)}>
      {children}
    </span>
  );
}
