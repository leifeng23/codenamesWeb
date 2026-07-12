"use client";

import { AnimatePresence, motion } from "framer-motion";
import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { cn } from "../../lib/utils";

interface ToastItem {
  id: number;
  tone: "ok" | "err";
  text: string;
}

interface ToastApi {
  ok: (text: string) => void;
  err: (text: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const MAX_VISIBLE = 3;
const DISMISS_MS = 4000;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(0);

  const push = useCallback((tone: "ok" | "err", text: string) => {
    nextId.current += 1;
    const id = nextId.current;
    setItems((current) => [...current.slice(-(MAX_VISIBLE - 1)), { id, tone, text }]);
    setTimeout(() => {
      setItems((current) => current.filter((item) => item.id !== id));
    }, DISMISS_MS);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({ ok: (text) => push("ok", text), err: (text) => push("err", text) }),
    [push]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className="pointer-events-none fixed left-1/2 top-4 z-[90] flex w-max max-w-[90vw] -translate-x-1/2 flex-col items-center gap-2">
        <AnimatePresence>
          {items.map((item) => (
            <motion.div
              key={item.id}
              className={cn(
                "rounded-lg border px-4 py-2.5 text-sm shadow-2xl backdrop-blur",
                item.tone === "err"
                  ? "border-ember/45 bg-[#241014]/95 text-ember"
                  : "border-storm/40 bg-[#0d1b24]/95 text-storm"
              )}
              initial={{ opacity: 0, y: -16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.22 }}
              role={item.tone === "err" ? "alert" : "status"}
            >
              {item.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used within ToastProvider");
  return api;
}
