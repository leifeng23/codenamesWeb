"use client";

import { canGuess, canSubmitClue, type Faction, type RoomSnapshot, type Team, type WordCategory } from "@cosmere/shared";
import { motion } from "framer-motion";
import { Crown, Eye, Radio, ScrollText, Settings, ShieldAlert, Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useSound } from "./sound-provider";
import { CategoryTree } from "./category-tree";
import { Button } from "./ui/button";
import { Panel } from "./ui/panel";
import { cn } from "../lib/utils";

const factionClass: Record<Faction, string> = {
  red: "border-ember/70 bg-ember/25 text-red-50 shadow-[0_0_30px_rgba(255,93,77,.28)]",
  blue: "border-storm/70 bg-storm/24 text-cyan-50 shadow-[0_0_30px_rgba(91,215,255,.28)]",
  neutral: "border-brass/60 bg-brass/18 text-amber-50",
  assassin: "border-white/30 bg-black text-white shadow-[0_0_45px_rgba(255,255,255,.18)]"
};

export function RoomClient({
  initialSnapshot,
  roomId,
  roomCode,
  userId,
  realtimeUrl
}: {
  initialSnapshot: RoomSnapshot;
  roomId: string;
  roomCode: string;
  userId: string;
  realtimeUrl: string;
}) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [roomCategories, setRoomCategories] = useState<WordCategory[]>(initialSnapshot.selectedCategories);
  const [clueWord, setClueWord] = useState("");
  const [clueCount, setClueCount] = useState(1);
  const [error, setError] = useState("");
  const { enabled, setEnabled, play } = useSound();
  const viewer = snapshot.members.find((member) => member.userId === userId);
  const viewerCanSubmitClue = viewer && snapshot.game ? canSubmitClue(viewer, snapshot.game.turnTeam) : false;
  const viewerCanGuess = viewer && snapshot.game ? canGuess(viewer, snapshot.game.turnTeam) : false;

  useEffect(() => {
    setRoomCategories(snapshot.selectedCategories);
  }, [snapshot.selectedCategories]);

  useEffect(() => {
    const client = io(realtimeUrl, { transports: ["websocket", "polling"] });
    setSocket(client);
    client.on("connect", () => {
      setConnected(true);
      client.emit("room:join", { roomCode });
    });
    client.on("disconnect", () => setConnected(false));
    client.on("room:snapshot", (next: RoomSnapshot) => setSnapshot(next));
    client.on("member:changed", (next: RoomSnapshot) => setSnapshot(next));
    client.on("turn:clueSubmitted", (next: RoomSnapshot) => setSnapshot(next));
    client.on("turn:ended", (next: RoomSnapshot) => setSnapshot(next));
    client.on("card:revealed", (next: RoomSnapshot & { revealedFaction?: Faction }) => {
      if (next.revealedFaction === "assassin") play("assassin");
      else play("reveal");
      setSnapshot(next);
    });
    client.on("game:started", (next: RoomSnapshot) => {
      play("start");
      setSnapshot(next);
    });
    client.on("error", (next: { message?: string }) => setError(next.message ?? "操作失败"));
    return () => {
      client.close();
    };
  }, [play, realtimeUrl, roomCode, userId]);

  const visibleCards = useMemo(() => snapshot.game?.cards ?? [], [snapshot.game?.cards]);

  function startGame() {
    if (!socket) return;
    play("click");
    socket.emit("game:start", { roomCode });
  }

  function reveal(cardId: string) {
    if (!socket || !snapshot.game) return;
    if (!viewerCanGuess || snapshot.game.phase !== "guessing") {
      setError("只有当前队伍的普通队员可在提交线索后翻牌");
      return;
    }
    socket.emit("card:reveal", { roomCode, gameId: snapshot.game.id, cardId });
  }

  function assignRole(targetUserId: string, team: Team, canSpy: boolean) {
    socket?.emit("member:assignRole", { roomCode, targetUserId, team, canSpy });
  }

  function updateCategories() {
    socket?.emit("room:updateCategories", { roomCode, categories: roomCategories });
  }

  function submitTurnClue() {
    if (!socket || !snapshot.game) return;
    socket.emit("turn:submitClue", {
      roomCode,
      gameId: snapshot.game.id,
      clueWord,
      clueCount
    });
    setClueWord("");
  }

  function endCurrentTurn() {
    if (!socket || !snapshot.game) return;
    socket.emit("turn:end", { roomCode, gameId: snapshot.game.id });
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-4 xl:grid-cols-[1fr_320px]">
      <section>
        <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-storm/70">
              <Radio size={14} /> {connected ? "实时连接" : "离线重连中"}
            </p>
            <h1 className="mt-2 text-3xl font-black md:text-5xl">房间 {roomCode}</h1>
            {error ? <p className="mt-2 text-sm text-ember">{error}</p> : null}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setEnabled(!enabled)} aria-label="切换音效">
              {enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </Button>
            <Button onClick={startGame}>
              <Crown size={18} />
              {snapshot.game ? "重开一局" : "开始游戏"}
            </Button>
          </div>
        </header>

        <div className="grid grid-cols-5 gap-2 md:gap-3">
          {visibleCards.length > 0
            ? visibleCards.map((card) => (
                <motion.button
                  key={card.id}
                  layout
                  onClick={() => {
                    play("click");
                    if (!card.revealed) reveal(card.id);
                  }}
                  className={cn(
                    "relative aspect-[1.18] overflow-hidden rounded-lg border border-white/12 bg-white/[0.055] p-2 text-left shadow-xl transition md:p-3",
                    card.faction ? factionClass[card.faction] : viewerCanGuess && snapshot.game?.phase === "guessing" ? "hover:border-storm/40 hover:bg-white/[0.09]" : "opacity-80"
                  )}
                  whileHover={{ y: -3 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="block text-[11px] text-white/42">{String(card.position + 1).padStart(2, "0")}</span>
                  <span className="mt-2 block text-base font-black leading-tight md:text-xl">{card.textCn}</span>
                  <span className="mt-1 block break-words text-xs leading-tight text-white/55 md:text-sm">{card.textEnOrNote}</span>
                  {card.faction === "assassin" ? <ShieldAlert className="absolute bottom-2 right-2 opacity-60" size={20} /> : null}
                </motion.button>
              ))
            : Array.from({ length: 25 }, (_, index) => (
                <div key={index} className="aspect-[1.18] rounded-lg border border-dashed border-white/12 bg-white/[0.035]" />
              ))}
        </div>
      </section>

      <aside className="space-y-4">
        <Panel>
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <Settings size={18} />
            行动状态
          </h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-md border border-ember/30 bg-ember/10 p-3">
              <p className="text-xs text-white/50">红方剩余</p>
              <p className="text-3xl font-black text-ember">{snapshot.game?.redRemaining ?? 9}</p>
            </div>
            <div className="rounded-md border border-storm/30 bg-storm/10 p-3">
              <p className="text-xs text-white/50">蓝方剩余</p>
              <p className="text-3xl font-black text-storm">{snapshot.game?.blueRemaining ?? 8}</p>
            </div>
          </div>
          {snapshot.game ? (
            <div className="mt-4 rounded-md border border-white/10 bg-white/[0.035] p-3">
              <p className="text-sm font-semibold">
                当前回合：{snapshot.game.turnTeam === "red" ? "红队" : "蓝队"}
              </p>
              <p className="mt-1 text-xs text-white/52">
                {snapshot.game.phase === "waiting_for_clue"
                  ? "等待间谍提交线索"
                  : snapshot.game.phase === "guessing"
                    ? `线索：${snapshot.game.currentClue?.word} ${snapshot.game.currentClue?.count} · ${snapshot.game.guessesMadeThisTurn}/${snapshot.game.maxGuessesThisTurn}`
                    : "游戏结束"}
              </p>
            </div>
          ) : null}
        </Panel>

        {snapshot.game ? (
          <Panel>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <ScrollText size={18} />
              回合
            </h2>
            {viewerCanSubmitClue && snapshot.game.phase === "waiting_for_clue" ? (
              <div className="mt-4 space-y-3">
                <input
                  className="h-10 w-full rounded-md border border-white/12 bg-black/25 px-3 text-sm"
                  value={clueWord}
                  onChange={(event) => setClueWord(event.target.value)}
                  placeholder="输入线索"
                />
                <input
                  className="h-10 w-full rounded-md border border-white/12 bg-black/25 px-3 text-sm"
                  type="number"
                  min={1}
                  max={9}
                  value={clueCount}
                  onChange={(event) => setClueCount(Number(event.target.value))}
                />
                <Button onClick={submitTurnClue} disabled={!clueWord.trim()} className="w-full">
                  提交线索
                </Button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-white/52">
                {snapshot.game.phase === "waiting_for_clue" ? "等待当前队伍间谍提交线索。" : "普通队员翻牌中。"}
              </p>
            )}
            {viewerCanGuess && snapshot.game.phase === "guessing" ? (
              <Button onClick={endCurrentTurn} disabled={snapshot.game.guessesMadeThisTurn < 1} className="mt-3 w-full">
                结束回合
              </Button>
            ) : null}
          </Panel>
        ) : null}

        <Panel>
          <h2 className="text-lg font-bold">题库设置</h2>
          <div className="mt-3">
            <CategoryTree
              selected={roomCategories}
              onChange={setRoomCategories}
              counts={snapshot.categoryCounts}
              readonly={!snapshot.viewerIsOwner}
            />
          </div>
          {snapshot.viewerIsOwner ? (
            <Button className="mt-3 w-full" onClick={updateCategories}>
              保存题库设置
            </Button>
          ) : null}
        </Panel>

        <Panel>
          <h2 className="text-lg font-bold">成员</h2>
          <div className="mt-3 space-y-2">
            {snapshot.members.map((member) => (
              <div key={member.userId} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                <p className="truncate text-sm font-semibold">
                  {member.email} {member.isOwner ? <span className="text-brass">房主</span> : null}
                </p>
                {snapshot.viewerIsOwner ? (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <select
                      value={member.team}
                      onChange={(event) => assignRole(member.userId, event.target.value as Team, member.canSpy)}
                      className="rounded-md border border-white/12 bg-black/25 px-2 py-2 text-xs"
                    >
                      <option value="red">红队</option>
                      <option value="blue">蓝队</option>
                      <option value="spectator">旁观</option>
                    </select>
                    <button
                      onClick={() => assignRole(member.userId, member.team, !member.canSpy)}
                      disabled={member.team === "spectator"}
                      className="rounded-md border border-white/12 bg-white/[0.05] px-2 py-2 text-xs disabled:opacity-40"
                    >
                      <Eye size={14} className="mr-1 inline" />
                      {member.canSpy ? "间谍" : "队员"}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-white/48">
                    {member.team === "red" ? "红队" : member.team === "blue" ? "蓝队" : "旁观"} · {member.canSpy ? "间谍" : "队员"}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Panel>
      </aside>
    </div>
  );
}
