"use client";

import type { RoomSnapshot } from "@cosmere/shared";
import { useEffect, useState } from "react";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";

type Game = NonNullable<RoomSnapshot["game"]>;

/**
 * 棋盘正下方的行动栏：轮到你时展示线索表单或结束回合按钮，否则一行状态提示。
 * 移动端吸底，保证核心操作不需要滚动。
 * pending 为真表示已发出操作、等待服务器确认（按钮禁用 + 转圈）。
 */
export function ActionBar({
  game,
  viewerCanSubmitClue,
  viewerCanGuess,
  pending,
  onSubmitClue,
  onEndTurn
}: {
  game: Game | null;
  viewerCanSubmitClue: boolean;
  viewerCanGuess: boolean;
  pending: boolean;
  onSubmitClue: (word: string, count: number) => void;
  onEndTurn: () => void;
}) {
  const [clueWord, setClueWord] = useState("");
  const [clueCount, setClueCount] = useState(1);

  // 线索被服务器接受（进入 guessing）后再清空输入：提交失败时不丢词
  const phase = game?.phase;
  useEffect(() => {
    if (phase === "guessing") {
      setClueWord("");
      setClueCount(1);
    }
  }, [phase]);

  if (!game || game.phase === "finished") return null;

  const showClueForm = viewerCanSubmitClue && game.phase === "waiting_for_clue";
  const showEndTurn = viewerCanGuess && game.phase === "guessing";

  return (
    <div className="sticky bottom-0 z-30 -mx-0.5 mt-1 rounded-t-xl border-t border-white/10 bg-void/92 px-3 py-3 backdrop-blur-lg md:static md:mx-0 md:rounded-xl md:border md:bg-white/[0.04] xl:mt-2">
      {showClueForm ? (
        <form
          className="flex flex-wrap items-center gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const word = clueWord.trim();
            if (!word || pending) return;
            onSubmitClue(word, clueCount);
          }}
        >
          <span className="w-full text-xs font-semibold uppercase tracking-wide text-white/45 sm:w-auto">
            你是间谍 · 提交线索
          </span>
          <input
            className="h-10 min-w-0 flex-1 rounded-md border border-white/12 bg-black/25 px-3 text-sm outline-none transition placeholder:text-white/35 focus:border-storm/70 focus:ring-2 focus:ring-storm/20"
            value={clueWord}
            autoComplete="off"
            maxLength={40}
            disabled={pending}
            onChange={(event) => setClueWord(event.target.value)}
            placeholder="输入线索词"
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-white/12 bg-white/[0.05] text-lg leading-none transition hover:bg-white/12 active:scale-95 disabled:opacity-40"
              onClick={() => setClueCount((current) => Math.max(1, current - 1))}
              disabled={clueCount <= 1 || pending}
              aria-label="减少关联词数"
            >
              −
            </button>
            <input
              className="h-10 w-14 rounded-md border border-white/12 bg-black/25 px-2 text-center text-sm font-bold outline-none transition focus:border-storm/70 focus:ring-2 focus:ring-storm/20"
              type="number"
              min={1}
              max={9}
              value={clueCount}
              disabled={pending}
              onChange={(event) =>
                setClueCount(Math.max(1, Math.min(9, Math.round(Number(event.target.value) || 1))))
              }
              aria-label="关联词数"
            />
            <button
              type="button"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-white/12 bg-white/[0.05] text-lg leading-none transition hover:bg-white/12 active:scale-95 disabled:opacity-40"
              onClick={() => setClueCount((current) => Math.min(9, current + 1))}
              disabled={clueCount >= 9 || pending}
              aria-label="增加关联词数"
            >
              +
            </button>
          </div>
          <Button type="submit" variant="primary" disabled={!clueWord.trim() || pending} className="shrink-0">
            {pending ? <Spinner size={16} /> : null}
            {pending ? "提交中…" : "提交线索"}
          </Button>
        </form>
      ) : showEndTurn ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-white/60">点击棋盘上的密令牌翻牌，或主动结束回合。</p>
          <Button onClick={onEndTurn} disabled={game.guessesMadeThisTurn < 1 || pending} className="shrink-0">
            {pending ? <Spinner size={16} /> : null}
            {pending ? "处理中…" : "结束回合"}
          </Button>
        </div>
      ) : (
        <p className="text-center text-sm text-white/52">
          {game.phase === "waiting_for_clue" ? "等待当前队伍间谍提交线索…" : "当前队伍翻牌行动中…"}
        </p>
      )}
    </div>
  );
}
