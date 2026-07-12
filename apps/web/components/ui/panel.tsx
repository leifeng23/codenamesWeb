import { cn } from "../../lib/utils";

export function Panel({
  className,
  title,
  icon,
  children
}: {
  className?: string;
  title?: React.ReactNode;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-lg border border-white/12 bg-panel/78 p-4 shadow-2xl backdrop-blur-xl",
        className
      )}
    >
      {title ? (
        <h2 className="mb-3 flex items-center gap-2 text-base font-bold">
          {icon}
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}
