"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import { cn } from "../../lib/utils";

type Tone = "default" | "danger";
type Size = "sm" | "md";

const sizeClass: Record<Size, string> = {
  sm: "max-w-sm",
  md: "max-w-md"
};

export function Modal({
  open,
  onClose,
  title,
  tone = "default",
  size = "sm",
  showClose = false,
  children,
  footer
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  tone?: Tone;
  size?: Size;
  showClose?: boolean;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <div
            className={cn(
              "result-pop w-full rounded-xl border bg-panel p-6 shadow-2xl",
              tone === "danger" ? "border-ember/30" : "border-white/15",
              sizeClass[size]
            )}
            role="dialog"
            aria-modal="true"
          >
            {title || showClose ? (
              <div className="flex items-start justify-between gap-3">
                {title ? (
                  <h3 className={cn("text-xl font-black", tone === "danger" && "flex items-center gap-2 text-ember")}>
                    {title}
                  </h3>
                ) : (
                  <span />
                )}
                {showClose ? (
                  <button
                    className="-mr-2 -mt-2 rounded p-2 transition hover:bg-white/10"
                    onClick={onClose}
                    aria-label="关闭"
                  >
                    <X size={18} />
                  </button>
                ) : null}
              </div>
            ) : null}
            {children}
            {footer ? <div className="mt-5 flex justify-end gap-2">{footer}</div> : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
