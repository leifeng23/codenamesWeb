"use client";

import type { Faction, PublicCard } from "@cosmere/shared";
import { motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import { memo } from "react";
import { cn } from "../../lib/utils";
import { backFactionClass, hintFactionClass } from "./labels";
import type { ActiveFx } from "./reveal-fx";

function BoardCardInner({
  card,
  actionable,
  cardFx,
  pending,
  onReveal
}: {
  card: PublicCard;
  actionable: boolean;
  cardFx: ActiveFx | null;
  pending: boolean;
  onReveal: (cardId: string) => void;
}) {
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
      aria-busy={pending}
      onClick={() => {
        if (!card.revealed && !pending) onReveal(card.id);
      }}
      className={cn(
        "card-tile relative aspect-[0.92] select-none rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-storm/60 sm:aspect-[1.18] sm:rounded-xl",
        !card.revealed && "card-idle",
        actionable ? "cursor-pointer" : "cursor-default",
        // 等待服务器确认：立即给出脉冲光圈反馈，避免高延迟下点击后毫无动静
        pending && "animate-pulse ring-2 ring-storm/70",
        fxAnimClass
      )}
      whileHover={actionable && !pending ? { y: -4, scale: 1.02 } : undefined}
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

/**
 * 每次快照都会生成全新的 card 对象，25 张卡牌默认会整板重渲染；
 * 按内容做浅比较，只有状态真正变化的卡牌才重渲染（低配设备上明显更顺）。
 */
export const BoardCard = memo(
  BoardCardInner,
  (prev, next) =>
    prev.actionable === next.actionable &&
    prev.pending === next.pending &&
    prev.cardFx === next.cardFx &&
    prev.onReveal === next.onReveal &&
    prev.card.id === next.card.id &&
    prev.card.revealed === next.card.revealed &&
    prev.card.faction === next.card.faction &&
    prev.card.textCn === next.card.textCn &&
    prev.card.textEnOrNote === next.card.textEnOrNote &&
    prev.card.position === next.card.position
);
