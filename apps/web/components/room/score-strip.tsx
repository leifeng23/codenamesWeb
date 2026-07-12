"use client";

import type { RoomSnapshot } from "@cosmere/shared";
import { cn } from "../../lib/utils";

type Game = NonNullable<RoomSnapshot["game"]>;

/** 棋盘上方的紧凑比分条：红方剩余 / 当前回合与阶段 / 蓝方剩余。 */
export function ScoreStrip({ game, isOwner }: { game: Game | null; isOwner: boolean }) {
  const isFinished = game?.phase === "finished";

  return (
    <div className="mb-3 grid grid-cols-[1fr_auto_1fr] items-stretch gap-2 sm:gap-3">
      <div
        className={cn(
          "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition",
          game?.turnTeam === "red" && !isFinished
            ? "border-ember/60 bg-ember/20 shadow-[0_0_22px_rgba(255,93,77,.25)]"
            : "border-ember/30 bg-ember/10"
        )}
      >
        <span className="text-xs text-white/55">红方剩余</span>
        <span className="text-2xl font-black text-ember sm:text-3xl">{game?.redRemaining ?? 9}</span>
      </div>

      <div className="flex min-w-[7.5rem] flex-col items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1 text-center sm:min-w-[10rem]">
        {game ? (
          <>
            <span className="text-sm font-semibold">
              当前回合：
              <span className={game.turnTeam === "red" ? "text-ember" : "text-storm"}>
                {game.turnTeam === "red" ? "红队" : "蓝队"}
              </span>
            </span>
            <span className="text-xs text-white/52">
              {isFinished
                ? "游戏结束"
                : game.phase === "waiting_for_clue"
                  ? "等待间谍提交线索"
                  : `已猜 ${game.guessesMadeThisTurn}/${game.maxGuessesThisTurn ?? "-"}`}
            </span>
          </>
        ) : (
          <span className="text-xs text-white/50">
            {isOwner ? "点击右上角「开始游戏」" : "等待房主开始游戏"}
          </span>
        )}
      </div>

      <div
        className={cn(
          "flex items-center justify-between gap-2 rounded-lg border px-3 py-2 transition",
          game?.turnTeam === "blue" && !isFinished
            ? "border-storm/60 bg-storm/20 shadow-[0_0_22px_rgba(91,215,255,.25)]"
            : "border-storm/30 bg-storm/10"
        )}
      >
        <span className="text-xs text-white/55">蓝方剩余</span>
        <span className="text-2xl font-black text-storm sm:text-3xl">{game?.blueRemaining ?? 8}</span>
      </div>
    </div>
  );
}
