"use client";

import type { PublicCard, RoomSnapshot } from "@cosmere/shared";
import { motion } from "framer-motion";
import { cn } from "../../lib/utils";
import { BoardCard } from "./board-card";
import type { ActiveFx } from "./reveal-fx";

type Game = NonNullable<RoomSnapshot["game"]>;

/** 线索横幅 + 5×5 棋盘。移动端棋盘随视口宽度自适应缩放，不横向滚动。 */
export function GameBoard({
  game,
  cards,
  fx,
  viewerCanGuess,
  onReveal
}: {
  game: Game | null;
  cards: PublicCard[];
  fx: ActiveFx | null;
  viewerCanGuess: boolean;
  onReveal: (cardId: string) => void;
}) {
  return (
    <>
      {game && game.phase === "guessing" && game.currentClue ? (
        <motion.div
          key={`${game.currentClue.word}-${game.turnTeam}`}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-3 backdrop-blur",
            game.turnTeam === "red" ? "border-ember/40 bg-ember/10" : "border-storm/40 bg-storm/10"
          )}
        >
          <div className="flex items-baseline gap-3">
            <span className={cn("text-xs uppercase tracking-[0.25em]", game.turnTeam === "red" ? "text-ember" : "text-storm")}>
              {game.turnTeam === "red" ? "红队线索" : "蓝队线索"}
            </span>
            <span className="text-2xl font-black md:text-3xl">{game.currentClue.word}</span>
            <span className="rounded-md bg-white/10 px-2 py-0.5 text-lg font-bold">{game.currentClue.count}</span>
          </div>
          <span className="text-sm text-white/60">
            已猜 {game.guessesMadeThisTurn}/{game.maxGuessesThisTurn ?? "-"}
          </span>
        </motion.div>
      ) : null}
      {game && game.phase === "waiting_for_clue" ? (
        <div className="mb-4 rounded-xl border border-white/12 bg-white/[0.04] px-5 py-3 text-sm text-white/70">
          等待{" "}
          <span className={game.turnTeam === "red" ? "text-ember" : "text-storm"}>
            {game.turnTeam === "red" ? "红队" : "蓝队"}
          </span>{" "}
          间谍提交线索…
        </div>
      ) : null}

      <div className="px-0.5 pb-3 pt-1 md:px-1">
        <div className="grid grid-cols-5 gap-1.5 sm:gap-2 md:gap-3">
          {cards.length > 0
            ? cards.map((card) => (
                <BoardCard
                  key={card.id}
                  card={card}
                  actionable={!card.revealed && viewerCanGuess && game?.phase === "guessing"}
                  fx={fx}
                  onReveal={onReveal}
                />
              ))
            : Array.from({ length: 25 }, (_, index) => (
                <div
                  key={index}
                  className="aspect-[0.92] rounded-lg border border-dashed border-white/12 bg-white/[0.035] sm:aspect-[1.18] sm:rounded-xl"
                />
              ))}
        </div>
      </div>
    </>
  );
}
