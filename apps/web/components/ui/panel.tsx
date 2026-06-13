import { cn } from "../../lib/utils";

export function Panel({
  className,
  children
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-white/12 bg-panel/78 p-5 shadow-2xl backdrop-blur-xl",
        className
      )}
    >
      {children}
    </section>
  );
}
