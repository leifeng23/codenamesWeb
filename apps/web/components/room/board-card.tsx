"use client";

import type { Faction, PublicCard } from "@cosmere/shared";
import { motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import { cn } from "../../lib/utils";
import { backFactionClass, hintFactionClass } from "./labels";
import type { ActiveFx } from "./reveal-fx";

export function BoardCard({
  card,
  actionable,
  fx,
  onReveal
}: {
  card: PublicCard;
  actionable: boolean;
  fx: ActiveFx | null;
  onReveal: (cardId: string) => void;
}) {
  const cardFx = fx?.cardId === card.id ? fx : null;
  const fxAnimClass = cardFx
    ? cardFx.outcome === "correct"
      ? "fx-correct"
      : cardFx.outcome === "neutral"
        ? "fx-neutral"
        : cardFx.outcome === "enemy"
          ? "fx-enemy"
          : ""
    : "";
  const showHint = !card.revealed && card.faction;

  return (
    <motion.button
      data-card-id={card.id}
      disabled={card.revealed}
      aria-label={card.revealed ? `已翻开：${card.textCn}` : `翻开「${card.textCn}」`}
      onClick={() => {
        if (!card.revealed) onReveal(card.id);
      }}
      className={cn(
        "card-tile relative aspect-[0.92] select-none rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-storm/60 sm:aspect-[1.18] sm:rounded-xl",
        !card.revealed && "card-idle",
        actionable ? "cursor-pointer" : "cursor-default",
        fxAnimClass
      )}
      whileHover={actionable ? { y: -4, scale: 1.02 } : undefined}
      whileTap={!card.revealed ? { scale: 0.97 } : undefined}
    >
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        initial={false}
        animate={{ rotateY: card.revealed ? 180 : 0 }}
        transition={{ duration: 0.55, ease: [0.2, 0.7, 0.2, 1] }}
      >
        {/* 正面：词 */}
        <div
          className={cn(
            "card-face absolute inset-0 flex flex-col overflow-hidden rounded-lg border border-white/12 bg-white/[0.055] p-1 text-left shadow-xl sm:rounded-xl sm:p-2 md:p-3",
            showHint ? hintFactionClass[card.faction as Faction] : null
          )}
        >
          <span className="hidden text-[11px] text-white/45 sm:block">
            {String(card.position + 1).padStart(2, "0")}
          </span>
          <span className="mt-0.5 block text-[13px] font-black leading-tight sm:mt-1.5 sm:text-base md:text-xl">{card.textCn}</span>
          <span className="mt-0.5 line-clamp-2 block break-words text-[10px] leading-tight text-white/55 sm:mt-1 sm:text-xs md:text-sm">
            {card.textEnOrNote}
          </span>
          {showHint && card.faction === "assassin" ? (
            <ShieldAlert className="absolute bottom-2 right-2 text-red-400 opacity-70" size={18} />
          ) : null}
        </div>
        {/* 背面：阵营色 */}
        <div
          className={cn(
            "card-face absolute inset-0 flex flex-col justify-between overflow-hidden rounded-lg border border-white/15 p-1 text-left sm:rounded-xl sm:p-2 md:p-3",
            card.faction ? backFactionClass[card.faction] : "bg-white/10"
          )}
          style={{ transform: "rotateY(180deg)" }}
        >
          <span className="hidden text-[11px] opacity-70 sm:block">{String(card.position + 1).padStart(2, "0")}</span>
          <span className="block text-[11px] font-black leading-tight sm:text-sm md:text-base">{card.textCn}</span>
          {card.faction === "assassin" ? (
            <ShieldAlert className="absolute bottom-2 right-2 opacity-80" size={22} />
          ) : null}
        </div>
      </motion.div>
    </motion.button>
  );
}
