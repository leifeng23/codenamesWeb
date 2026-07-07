"use client";

import {
  canGuess,
  canSubmitClue,
  type Faction,
  type GuessOutcome,
  type RoomEventSummary,
  type RoomSnapshot,
  type Team,
  type TeamChatMessage,
  type TurnTeam
} from "@cosmere/shared";
import { AnimatePresence, motion } from "framer-motion";
import {
  Check,
  ChevronDown,
  Copy,
  Crown,
  Eye,
  MessageCircle,
  ScrollText,
  Send,
  Settings,
  ShieldAlert,
  Sparkles,
  Trash2,
  Volume2,
  VolumeX
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useSound } from "./sound-provider";
import { CategoryTree } from "./category-tree";
import { Button } from "./ui/button";
import { Panel } from "./ui/panel";
import { cn } from "../lib/utils";

// 翻开后的卡背阵营色
const backFactionClass: Record<Faction, string> = {
  red: "bg-gradient-to-br from-rose-500/90 to-red-700/95 text-red-50 shadow-[0_0_36px_rgba(255,80,70,.45)]",
  blue: "bg-gradient-to-br from-sky-400/90 to-blue-700/95 text-cyan-50 shadow-[0_0_36px_rgba(80,180,255,.45)]",
  neutral: "bg-gradient-to-br from-amber-300/85 to-amber-600/85 text-amber-950",
  assassin: "bg-gradient-to-br from-zinc-800 to-black text-white shadow-[0_0_48px_rgba(0,0,0,.9)] ring-2 ring-red-600/60"
};

// 间谍视角下未翻开卡牌的阵营提示
const hintFactionClass: Record<Faction, string> = {
  red: "ring-1 ring-rose-400/50 bg-rose-500/[0.12]",
  blue: "ring-1 ring-sky-400/50 bg-sky-500/[0.12]",
  neutral: "ring-1 ring-amber-300/40 bg-amber-400/[0.07]",
  assassin: "ring-1 ring-zinc-200/40 bg-black/40"
};

const ringColorClass: Record<Faction, string> = {
  red: "text-rose-400",
  blue: "text-sky-400",
  neutral: "text-amber-300",
  assassin: "text-red-500"
};

const teamColorHex: Record<TurnTeam, string> = { red: "#ff5d4d", blue: "#5bd7ff" };

const teamLabel: Record<TurnTeam, string> = { red: "红队", blue: "蓝队" };
const factionResultLabel: Record<Faction, string> = {
  red: "红方特工",
  blue: "蓝方特工",
  neutral: "路人",
  assassin: "刺客"
};

function formatEventTime(iso: string) {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

/** 把服务端下发的安全事件摘要转成可读文案；未知类型返回 null 不展示。 */
function describeEvent(
  event: RoomEventSummary,
  cardTextByPosition: Map<number, string> | null,
  currentGameId: string | null
): string | null {
  const actor = event.actorName ?? "某成员";
  const data = event.data;
  switch (event.type) {
    case "game.started":
      return `${actor} 开始了新对局`;
    case "turn.clue_submitted":
      return `${data.turnTeam ? teamLabel[data.turnTeam] : ""}间谍 ${actor} 给出线索「${data.clueWord} ${data.clueCount}」`;
    case "card.revealed": {
      const sameGame = event.gameId != null && event.gameId === currentGameId;
      const text = sameGame && data.position != null ? cardTextByPosition?.get(data.position) : null;
      const target = text ? `「${text}」` : data.position != null ? `第 ${data.position + 1} 张牌` : "一张牌";
      return `${actor} 翻开${target}${data.faction ? ` → ${factionResultLabel[data.faction]}` : ""}`;
    }
    case "turn.ended":
      return data.reason === "manual"
        ? `${actor} 结束了回合`
        : data.nextTurnTeam
          ? `回合结束，轮到${teamLabel[data.nextTurnTeam]}`
          : "回合结束";
    case "game.finished":
      return data.winnerTeam
        ? `${teamLabel[data.winnerTeam]}获胜${data.reason === "assassin" ? "（对方翻中刺客）" : ""}`
        : "对局结束";
    case "member.role_assigned": {
      const role =
        data.team === "spectator"
          ? "旁观"
          : `${data.team ? teamLabel[data.team as TurnTeam] : ""}${data.canSpy ? "间谍" : "队员"}`;
      return `${actor} 将 ${data.targetName ?? "成员"} 设为${role}`;
    }
    case "room.categories_updated":
      return `${actor} 更新了题库${data.categoryCount != null ? `（${data.categoryCount} 个分类）` : ""}`;
    default:
      return null;
  }
}

interface ActiveFx {
  cardId: string;
  outcome: GuessOutcome;
  faction: Faction;
  cx: number;
  cy: number;
  nonce: number;
}

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
  const [roomCategoryIds, setRoomCategoryIds] = useState<string[]>(initialSnapshot.selectedCategoryIds);
  const [clueWord, setClueWord] = useState("");
  const [clueCount, setClueCount] = useState(1);
  const [categorySettingsOpen, setCategorySettingsOpen] = useState(false);
  const [error, setError] = useState("");
  const [fx, setFx] = useState<ActiveFx | null>(null);
  const [shake, setShake] = useState(false);
  const [edgeFlash, setEdgeFlash] = useState<string | null>(null);
  const [assassinBlast, setAssassinBlast] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [confirmDisband, setConfirmDisband] = useState(false);
  const [dismissedResultFor, setDismissedResultFor] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<TeamChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const chatListRef = useRef<HTMLDivElement | null>(null);
  const fxNonce = useRef(0);
  const { enabled, setEnabled, play } = useSound();

  const viewer = snapshot.members.find((member) => member.userId === userId);
  const viewerCanSubmitClue = viewer && snapshot.game ? canSubmitClue(viewer, snapshot.game.turnTeam) : false;
  const viewerCanGuess = viewer && snapshot.game ? canGuess(viewer, snapshot.game.turnTeam) : false;

  useEffect(() => {
    setRoomCategoryIds(snapshot.selectedCategoryIds);
  }, [snapshot.selectedCategoryIds]);

  // 错误提示自动消失
  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setError(""), 4000);
    return () => clearTimeout(timer);
  }, [error]);

  function triggerRevealFx(next: RoomSnapshot & Partial<{ revealedCardId: string; outcome: GuessOutcome }>) {
    const outcome = next.outcome;
    const cardId = next.revealedCardId;
    if (!outcome || !cardId) {
      play("reveal");
      return;
    }
    play(outcome);
    const faction = (next.game?.cards.find((card) => card.id === cardId)?.faction ??
      (outcome === "assassin" ? "assassin" : outcome === "neutral" ? "neutral" : "red")) as Faction;

    // 按卡牌在屏幕上的中心定位特效（固定层，避免被裁剪/遮挡）
    requestAnimationFrame(() => {
      const el = typeof document !== "undefined" ? document.querySelector(`[data-card-id="${cardId}"]`) : null;
      const rect = el?.getBoundingClientRect();
      const cx = rect ? rect.left + rect.width / 2 : window.innerWidth / 2;
      const cy = rect ? rect.top + rect.height / 2 : window.innerHeight / 2;
      fxNonce.current += 1;
      setFx({ cardId, outcome, faction, cx, cy, nonce: fxNonce.current });
      setTimeout(() => setFx((current) => (current?.cardId === cardId ? null : current)), 800);
    });

    if (outcome === "enemy") {
      const color = faction === "blue" ? teamColorHex.blue : teamColorHex.red;
      setEdgeFlash(color);
      setTimeout(() => setEdgeFlash(null), 900);
    }
    if (outcome === "assassin") {
      setShake(true);
      setAssassinBlast(true);
      setTimeout(() => setShake(false), 600);
      setTimeout(() => setAssassinBlast(false), 900);
    }
  }

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
    client.on(
      "card:revealed",
      (next: RoomSnapshot & { revealedCardId?: string; outcome?: GuessOutcome }) => {
        setSnapshot(next);
        triggerRevealFx(next);
      }
    );
    client.on("game:ended", (next: RoomSnapshot & { winnerTeam?: TurnTeam | null }) => {
      setSnapshot(next);
      if (next.winnerTeam) setTimeout(() => play("win"), 420);
    });
    client.on("game:started", (next: RoomSnapshot) => {
      play("start");
      setFx(null);
      setSnapshot(next);
    });
    client.on("chat:message", (message: TeamChatMessage) => {
      setChatMessages((prev) => [...prev.slice(-99), message]);
    });
    client.on("room:disbanded", () => {
      window.location.href = "/";
    });
    client.on("error", (next: { message?: string }) => setError(next.message ?? "操作失败"));
    return () => {
      client.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, realtimeUrl, roomCode, userId]);

  const visibleCards = useMemo(() => snapshot.game?.cards ?? [], [snapshot.game?.cards]);
  const cardTextByPosition = useMemo(
    () => new Map(visibleCards.map((card) => [card.position, card.textCn])),
    [visibleCards]
  );
  const game = snapshot.game;
  const isFinished = game?.phase === "finished";
  const winnerTeam = game?.winnerTeam ?? null;
  const finishReason =
    isFinished && game && game.redRemaining > 0 && game.blueRemaining > 0 ? "assassin" : "all";
  const showResult = isFinished && winnerTeam && dismissedResultFor !== game?.id;

  function startGame() {
    if (!socket) return;
    if (game && !isFinished) {
      setConfirmRestart(true);
      return;
    }
    play("click");
    socket.emit("game:start", { roomCode });
  }

  function confirmRestartGame() {
    setConfirmRestart(false);
    play("click");
    socket?.emit("game:start", { roomCode });
  }

  function disbandRoom() {
    setConfirmDisband(false);
    socket?.emit("room:disband", { roomCode });
  }

  function reveal(cardId: string) {
    if (!socket || !game) return;
    if (game.phase !== "guessing") {
      setError("请等待本队间谍提交线索后再翻牌");
      return;
    }
    if (!viewerCanGuess) {
      setError("只有当前队伍的普通队员可以翻牌");
      return;
    }
    play("click");
    socket.emit("card:reveal", { roomCode, gameId: game.id, cardId });
  }

  function assignRole(targetUserId: string, team: Team, canSpy: boolean) {
    socket?.emit("member:assignRole", { roomCode, targetUserId, team, canSpy });
  }

  function updateCategories() {
    socket?.emit("room:updateCategories", { roomCode, categoryIds: roomCategoryIds });
  }

  function submitTurnClue() {
    if (!socket || !game) return;
    const count = Math.max(1, Math.min(9, Math.round(Number(clueCount) || 1)));
    socket.emit("turn:submitClue", { roomCode, gameId: game.id, clueWord: clueWord.trim(), clueCount: count });
    setClueWord("");
  }

  function endCurrentTurn() {
    if (!socket || !game) return;
    socket.emit("turn:end", { roomCode, gameId: game.id });
  }

  async function copyRoomCode() {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 1600);
    } catch {
      setError("复制失败，请手动复制房间码");
    }
  }

  // ===== 队伍聊天 =====
  const viewerIsSpectator = !viewer || viewer.team === "spectator";
  const canChat = !!viewer && (viewer.team === "red" || viewer.team === "blue") && !viewer.canSpy;
  // 客户端也按当前队伍过滤一遍：切换队伍后不残留原队消息（旁观者看全部）
  const chatVisibleMessages = useMemo(() => {
    if (!viewer || viewer.team === "spectator") return chatMessages;
    return chatMessages.filter((message) => message.team === viewer.team);
  }, [chatMessages, viewer]);

  useEffect(() => {
    const list = chatListRef.current;
    if (list) list.scrollTo({ top: list.scrollHeight, behavior: "smooth" });
  }, [chatVisibleMessages.length]);

  function sendChat(event: React.FormEvent) {
    event.preventDefault();
    const text = chatInput.trim();
    if (!socket || !text || !canChat) return;
    socket.emit("chat:send", { roomCode, text });
    setChatInput("");
  }

  const confetti = useMemo(() => {
    if (!showResult || !winnerTeam) return [];
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
  }, [showResult, winnerTeam]);

  return (
    <div className="relative">
      {/* ===== 错误提示 toast（固定层，不挤压页面布局，也不受震屏 transform 影响） ===== */}
      <AnimatePresence>
        {error ? (
          <motion.div
            className="fixed left-1/2 top-4 z-[90] w-max max-w-[90vw] rounded-lg border border-ember/45 bg-[#241014]/95 px-4 py-2.5 text-sm text-ember shadow-2xl backdrop-blur"
            initial={{ opacity: 0, y: -16, x: "-50%" }}
            animate={{ opacity: 1, y: 0, x: "-50%" }}
            exit={{ opacity: 0, y: -10, x: "-50%" }}
            transition={{ duration: 0.22 }}
            role="alert"
          >
            {error}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* ===== 固定特效层（不受滚动容器裁剪、不被侧栏遮挡） ===== */}
      {edgeFlash ? <div className="edge-flash" style={{ boxShadow: `inset 0 0 140px 36px ${edgeFlash}` }} /> : null}
      {assassinBlast ? (
        <>
          <div className="assassin-overlay" />
          <div className="fx-shockwave" />
        </>
      ) : null}
      {fx ? (
        <div
          key={fx.nonce}
          className={cn("pointer-events-none fixed z-[80]", ringColorClass[fx.faction])}
          style={{ left: fx.cx, top: fx.cy }}
        >
          <span className="fx-ring-fixed" />
          {fx.outcome !== "neutral"
            ? Array.from({ length: 10 }, (_, i) => {
                const angle = (i / 10) * Math.PI * 2;
                return (
                  <span
                    key={i}
                    className="fx-spark"
                    style={
                      {
                        "--dx": `${Math.cos(angle) * 54}px`,
                        "--dy": `${Math.sin(angle) * 54}px`
                      } as React.CSSProperties
                    }
                  />
                );
              })
            : null}
        </div>
      ) : null}

      {/* ===== 主体（刺客时整体震屏） ===== */}
      <div className={cn(shake && "screen-shake")}>
        <div className="mx-auto grid w-full max-w-7xl gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0">
            <header className="mb-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-storm/70">
                  <span
                    className={cn(
                      "inline-block size-2 rounded-full transition",
                      connected
                        ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]"
                        : "animate-pulse bg-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.9)]"
                    )}
                  />
                  {connected ? "实时连接" : "连接中…"}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <h1 className="break-words text-3xl font-black md:text-5xl">房间 {roomCode}</h1>
                  <button
                    onClick={copyRoomCode}
                    className="inline-flex items-center gap-1.5 rounded-md border border-white/12 bg-white/[0.06] px-2.5 py-1.5 text-xs text-white/70 transition hover:bg-white/12 active:scale-95"
                    aria-label="复制房间码"
                  >
                    {codeCopied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                    {codeCopied ? "已复制" : "复制房间码"}
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setEnabled(!enabled)} aria-label="切换音效">
                  {enabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
                </Button>
                {snapshot.viewerIsOwner ? (
                  <Button onClick={startGame} disabled={!connected}>
                    <Crown size={18} />
                    {game ? "重开一局" : "开始游戏"}
                  </Button>
                ) : null}
              </div>
            </header>

            {/* 当前线索醒目横幅 */}
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

            {/* 移动端不再横向滚动：棋盘随视口宽度自适应缩放 */}
            <div className="px-0.5 pt-3 pb-3 md:px-1">
              <div className="grid grid-cols-5 gap-1.5 sm:gap-2 md:gap-3">
                {visibleCards.length > 0
                  ? visibleCards.map((card) => {
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
                      const actionable = !card.revealed && viewerCanGuess && game?.phase === "guessing";
                      return (
                        <motion.button
                          key={card.id}
                          data-card-id={card.id}
                          disabled={card.revealed}
                          aria-label={card.revealed ? `已翻开：${card.textCn}` : `翻开「${card.textCn}」`}
                          onClick={() => {
                            if (!card.revealed) reveal(card.id);
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
                    })
                  : Array.from({ length: 25 }, (_, index) => (
                      <div
                        key={index}
                        className="aspect-[0.92] rounded-lg border border-dashed border-white/12 bg-white/[0.035] sm:aspect-[1.18] sm:rounded-xl"
                      />
                    ))}
              </div>
            </div>
          </section>

          <aside className="min-w-0 space-y-4">
            <Panel>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <Settings size={18} />
                行动状态
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div
                  className={cn(
                    "rounded-md border p-3 transition",
                    game?.turnTeam === "red" && !isFinished
                      ? "border-ember/60 bg-ember/20 shadow-[0_0_22px_rgba(255,93,77,.25)]"
                      : "border-ember/30 bg-ember/10"
                  )}
                >
                  <p className="text-xs text-white/50">红方剩余</p>
                  <p className="text-3xl font-black text-ember">{game?.redRemaining ?? 9}</p>
                </div>
                <div
                  className={cn(
                    "rounded-md border p-3 transition",
                    game?.turnTeam === "blue" && !isFinished
                      ? "border-storm/60 bg-storm/20 shadow-[0_0_22px_rgba(91,215,255,.25)]"
                      : "border-storm/30 bg-storm/10"
                  )}
                >
                  <p className="text-xs text-white/50">蓝方剩余</p>
                  <p className="text-3xl font-black text-storm">{game?.blueRemaining ?? 8}</p>
                </div>
              </div>

              {game ? (
                <div className="mt-4 rounded-md border border-white/10 bg-white/[0.035] p-3">
                  <p className="text-sm font-semibold">
                    当前回合：
                    <span className={game.turnTeam === "red" ? "text-ember" : "text-storm"}>
                      {game.turnTeam === "red" ? "红队" : "蓝队"}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-white/52">
                    {isFinished
                      ? "游戏结束"
                      : game.phase === "waiting_for_clue"
                        ? "等待间谍提交线索"
                        : `线索：${game.currentClue?.word} ${game.currentClue?.count} · ${game.guessesMadeThisTurn}/${game.maxGuessesThisTurn}`}
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-white/50">尚未开始对局。{snapshot.viewerIsOwner ? "点击右上角「开始游戏」抽取密令牌。" : "等待房主开始游戏。"}</p>
              )}

              {/* 行动控件（原「回合」面板并入此处，避免功能重复） */}
              {game && !isFinished ? (
                <div className="mt-4 border-t border-white/10 pt-4">
                  {viewerCanSubmitClue && game.phase === "waiting_for_clue" ? (
                    <form
                      className="space-y-3"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (clueWord.trim()) submitTurnClue();
                      }}
                    >
                      <p className="text-xs font-semibold uppercase tracking-wide text-white/45">你是间谍 · 提交线索</p>
                      <input
                        className="h-10 w-full rounded-md border border-white/12 bg-black/25 px-3 text-sm outline-none transition placeholder:text-white/35 focus:border-storm/70 focus:ring-2 focus:ring-storm/20"
                        value={clueWord}
                        autoComplete="off"
                        maxLength={40}
                        onChange={(event) => setClueWord(event.target.value)}
                        placeholder="输入线索词"
                      />
                      <div className="flex items-center gap-2">
                        <span className="shrink-0 text-xs text-white/45">关联词数</span>
                        <div className="flex flex-1 items-center gap-1">
                          <button
                            type="button"
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-white/12 bg-white/[0.05] text-lg leading-none transition hover:bg-white/12 active:scale-95 disabled:opacity-40"
                            onClick={() => setClueCount((current) => Math.max(1, current - 1))}
                            disabled={clueCount <= 1}
                            aria-label="减少"
                          >
                            −
                          </button>
                          <input
                            className="h-10 w-full min-w-0 rounded-md border border-white/12 bg-black/25 px-3 text-center text-sm font-bold outline-none transition focus:border-storm/70 focus:ring-2 focus:ring-storm/20"
                            type="number"
                            min={1}
                            max={9}
                            value={clueCount}
                            onChange={(event) =>
                              setClueCount(Math.max(1, Math.min(9, Math.round(Number(event.target.value) || 1))))
                            }
                            aria-label="关联词数"
                          />
                          <button
                            type="button"
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-md border border-white/12 bg-white/[0.05] text-lg leading-none transition hover:bg-white/12 active:scale-95 disabled:opacity-40"
                            onClick={() => setClueCount((current) => Math.min(9, current + 1))}
                            disabled={clueCount >= 9}
                            aria-label="增加"
                          >
                            +
                          </button>
                        </div>
                      </div>
                      <Button type="submit" disabled={!clueWord.trim()} className="w-full">
                        提交线索
                      </Button>
                    </form>
                  ) : viewerCanGuess && game.phase === "guessing" ? (
                    <Button onClick={endCurrentTurn} disabled={game.guessesMadeThisTurn < 1} className="w-full">
                      结束回合
                    </Button>
                  ) : (
                    <p className="text-sm text-white/52">
                      {game.phase === "waiting_for_clue" ? "等待当前队伍间谍提交线索。" : "普通队员翻牌中。"}
                    </p>
                  )}
                </div>
              ) : null}
            </Panel>

            <Panel>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <MessageCircle size={18} />
                队伍聊天
              </h2>
              <p className="mt-1 text-xs text-white/40">
                {viewerIsSpectator
                  ? "旁观模式：可同时围观两队讨论"
                  : viewer?.canSpy
                    ? "你是间谍：只能观看队友交流，不能发言"
                    : "只有本队队友（和旁观者）能看到这里的消息"}
              </p>
              <div ref={chatListRef} className="nice-scroll mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                {chatVisibleMessages.length === 0 ? (
                  <p className="text-xs text-white/40">还没有消息{canChat ? "，来和队友商量一下吧" : ""}。</p>
                ) : (
                  chatVisibleMessages.map((message) => (
                    <div key={message.id} className="text-xs leading-relaxed">
                      <span className={cn("font-semibold", message.team === "red" ? "text-ember" : "text-storm")}>
                        {message.username}
                      </span>
                      <span className="ml-1.5 tabular-nums text-white/30">{formatEventTime(message.at)}</span>
                      <p className="break-words text-[13px] text-white/80">{message.text}</p>
                    </div>
                  ))
                )}
              </div>
              {canChat ? (
                <form onSubmit={sendChat} className="mt-3 flex gap-2">
                  <input
                    className="h-9 min-w-0 flex-1 rounded-md border border-white/12 bg-black/25 px-3 text-sm outline-none transition placeholder:text-white/35 focus:border-storm/70 focus:ring-2 focus:ring-storm/20"
                    value={chatInput}
                    maxLength={300}
                    onChange={(event) => setChatInput(event.target.value)}
                    placeholder="和队友商量…"
                  />
                  <Button type="submit" disabled={!chatInput.trim()} className="px-3" aria-label="发送">
                    <Send size={16} />
                  </Button>
                </form>
              ) : null}
            </Panel>

            <Panel>
              <h2 className="text-lg font-bold">成员</h2>
              <div className="mt-3 space-y-2">
                {snapshot.members.map((member) => (
                  <div key={member.userId} className="rounded-md border border-white/10 bg-white/[0.04] p-3">
                    <p className="truncate text-sm font-semibold">
                      {member.username} {member.isOwner ? <span className="text-brass">房主</span> : null}
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
                      <p className="mt-0.5 text-xs text-white/48">
                        {member.team === "red" ? "红队" : member.team === "blue" ? "蓝队" : "旁观"} ·{" "}
                        {member.canSpy ? "间谍" : "队员"}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </Panel>

            <Panel>
              <h2 className="flex items-center gap-2 text-lg font-bold">
                <ScrollText size={18} />
                操作记录
              </h2>
              <div className="nice-scroll mt-3 max-h-64 space-y-1.5 overflow-y-auto pr-1">
                {snapshot.recentEvents?.length ? (
                  snapshot.recentEvents.map((event) => {
                    const text = describeEvent(event, cardTextByPosition, game?.id ?? null);
                    if (!text) return null;
                    return (
                      <div key={event.id} className="flex items-baseline gap-2 text-xs leading-relaxed">
                        <span className="shrink-0 tabular-nums text-white/30">{formatEventTime(event.createdAt)}</span>
                        <span className="min-w-0 break-words text-white/70">{text}</span>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-white/40">还没有操作记录。</p>
                )}
              </div>
            </Panel>

            {snapshot.viewerIsOwner ? (
              <Panel>
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-3 text-left"
                  onClick={() => setCategorySettingsOpen((current) => !current)}
                >
                  <h2 className="text-lg font-bold">题库设置</h2>
                  <ChevronDown size={18} className={cn("transition", categorySettingsOpen ? "" : "-rotate-90")} />
                </button>
                {categorySettingsOpen ? (
                  <>
                    <div className="mt-3">
                      <CategoryTree tree={snapshot.categoryTree} selected={roomCategoryIds} onChange={setRoomCategoryIds} />
                    </div>
                    <Button className="mt-3 w-full" onClick={updateCategories}>
                      保存题库设置
                    </Button>
                  </>
                ) : null}
              </Panel>
            ) : null}

            {snapshot.viewerIsOwner ? (
              <Panel className="border-ember/25">
                <h2 className="text-sm font-bold text-white/70">危险操作</h2>
                <p className="mt-1 text-xs text-white/45">解散后房间、对局与记录将被永久删除，所有成员会被移出。</p>
                <button
                  onClick={() => setConfirmDisband(true)}
                  className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-ember/40 bg-ember/10 px-3 py-2 text-sm text-ember transition hover:bg-ember/20"
                >
                  <Trash2 size={16} />
                  解散房间
                </button>
              </Panel>
            ) : null}
          </aside>
        </div>
      </div>

      {/* 重开确认 */}
      <AnimatePresence>
        {confirmRestart ? (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(event) => {
              if (event.target === event.currentTarget) setConfirmRestart(false);
            }}
          >
            <div className="result-pop w-full max-w-sm rounded-xl border border-white/15 bg-panel p-6 shadow-2xl">
              <h3 className="text-xl font-black">重开一局？</h3>
              <p className="mt-2 text-sm text-white/60">当前对局进度将被清空，重新抽取 25 张密令牌。</p>
              <div className="mt-5 flex justify-end gap-2">
                <Button onClick={() => setConfirmRestart(false)}>取消</Button>
                <Button onClick={confirmRestartGame} className="bg-ember/25">
                  确认重开
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* 解散确认 */}
      <AnimatePresence>
        {confirmDisband ? (
          <motion.div
            className="fixed inset-0 z-50 grid place-items-center bg-black/65 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={(event) => {
              if (event.target === event.currentTarget) setConfirmDisband(false);
            }}
          >
            <div className="result-pop w-full max-w-sm rounded-xl border border-ember/30 bg-panel p-6 shadow-2xl">
              <h3 className="flex items-center gap-2 text-xl font-black text-ember">
                <Trash2 size={20} /> 解散房间？
              </h3>
              <p className="mt-2 text-sm text-white/60">
                房间 {roomCode} 及其全部对局、翻牌记录将被永久删除，无法恢复。所有成员会被移出房间。
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <Button onClick={() => setConfirmDisband(false)}>取消</Button>
                <Button onClick={disbandRoom} className="bg-ember/30 text-ember">
                  确认解散
                </Button>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* 胜负结算 */}
      <AnimatePresence>
        {showResult && winnerTeam ? (
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
                <Button onClick={() => game && setDismissedResultFor(game.id)}>查看棋盘</Button>
                {snapshot.viewerIsOwner ? (
                  <Button onClick={confirmRestartGame} className="bg-storm/20">
                    <Crown size={16} />
                    再来一局
                  </Button>
                ) : null}
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
