"use client";

import type { RoomSnapshot, TurnTeam } from "@cosmere/shared";
import { AnimatePresence, motion } from "framer-motion";
import { Crown, Sparkles } from "lucide-react";
import { useMemo } from "react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";
import { teamColorHex } from "./labels";

type Game = NonNullable<RoomSnapshot["game"]>;

export function ResultModal({
  show,
  winnerTeam,
  finishReason,
  game,
  isOwner,
  onViewBoard,
  onRestart
}: {
  show: boolean;
  winnerTeam: TurnTeam | null;
  finishReason: "assassin" | "all";
  game: Game | null;
  isOwner: boolean;
  onViewBoard: () => void;
  onRestart: () => void;
}) {
  const confetti = useMemo(() => {
    if (!show || !winnerTeam) return [];
    const palette =
      winnerTeam === "red"
        ? ["#ff5d4d", "#ff8a7a", "#ffd5cf", "#ffae42"]
        : ["#5bd7ff", "#8ae9ff", "#c9f3ff", "#a78bfa"];
    return Array.from({ length: 90 }, (_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.8,
      dur: 1.8 + Math.random() * 1.6,
      color: palette[i % palette.length],
      rotate: Math.random() * 360
    }));
  }, [show, winnerTeam]);

  return (
    <AnimatePresence>
      {show && winnerTeam ? (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center overflow-hidden bg-black/70 p-4 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="pointer-events-none absolute inset-0">
            {confetti.map((piece) => (
              <span
                key={piece.id}
                className="confetti-piece"
                style={{
                  left: `${piece.left}%`,
                  background: piece.color,
                  animationDelay: `${piece.delay}s`,
                  animationDuration: `${piece.dur}s`,
                  transform: `rotate(${piece.rotate}deg)`
                }}
              />
            ))}
          </div>
          <div className="result-pop relative z-10 w-full max-w-md rounded-2xl border border-white/15 bg-panel/90 p-8 text-center shadow-2xl">
            <Sparkles className={cn("mx-auto", winnerTeam === "red" ? "text-ember" : "text-storm")} size={40} />
            <p className="mt-4 text-xs uppercase tracking-[0.3em] text-white/50">
              {finishReason === "assassin" ? "对方踩中刺客" : "找齐所有特工"}
            </p>
            <h2
              className={cn("mt-2 text-4xl font-black md:text-5xl", winnerTeam === "red" ? "text-ember" : "text-storm")}
              style={{ textShadow: `0 0 30px ${teamColorHex[winnerTeam]}66` }}
            >
              {winnerTeam === "red" ? "红队获胜" : "蓝队获胜"}
            </h2>
            <p className="mt-3 text-sm text-white/55">
              红方剩余 {game?.redRemaining} · 蓝方剩余 {game?.blueRemaining}
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button onClick={onViewBoard}>查看棋盘</Button>
              {isOwner ? (
                <Button variant="primary" onClick={onRestart}>
                  <Crown size={16} />
                  再来一局
                </Button>
              ) : null}
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
