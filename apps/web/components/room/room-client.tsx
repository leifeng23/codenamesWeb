"use client";

import {
  canGuess,
  canSubmitClue,
  type Faction,
  type GuessOutcome,
  type RoomSnapshot,
  type Team,
  type TeamChatMessage,
  type TurnTeam
} from "@cosmere/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { useSound } from "../sound-provider";
import { ConfirmDialog } from "../ui/confirm-dialog";
import { useToast } from "../ui/toast";
import { cn } from "../../lib/utils";
import { ActionBar } from "./action-bar";
import { GameBoard } from "./game-board";
import { teamColorHex } from "./labels";
import { ResultModal } from "./result-modal";
import { RevealFx, type ActiveFx } from "./reveal-fx";
import { RoomHeader } from "./room-header";
import { RoomSettingsModal } from "./room-settings-modal";
import { RoomSidebar } from "./room-sidebar";
import { ScoreStrip } from "./score-strip";

export function RoomClient({
  initialSnapshot,
  roomId: _roomId,
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
  const [connected, setConnected] = useState(false);
  const [roomCategoryIds, setRoomCategoryIds] = useState<string[]>(initialSnapshot.selectedCategoryIds);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [fx, setFx] = useState<ActiveFx | null>(null);
  const [shake, setShake] = useState(false);
  const [edgeFlash, setEdgeFlash] = useState<string | null>(null);
  const [assassinBlast, setAssassinBlast] = useState(false);
  const [confirmRestart, setConfirmRestart] = useState(false);
  const [dismissedResultFor, setDismissedResultFor] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<TeamChatMessage[]>([]);
  // 等待服务器响应的即时反馈：让每次点击立刻有视觉回应，弱化网络往返的延迟感
  const [pendingCardId, setPendingCardId] = useState<string | null>(null);
  const [actionPending, setActionPending] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const fxNonce = useRef(0);
  const { enabled, setEnabled, play } = useSound();
  const toast = useToast();

  const viewer = snapshot.members.find((member) => member.userId === userId);
  const viewerCanSubmitClue = viewer && snapshot.game ? canSubmitClue(viewer, snapshot.game.turnTeam) : false;
  const viewerCanGuess = viewer && snapshot.game ? canGuess(viewer, snapshot.game.turnTeam) : false;

  const game = snapshot.game;
  // 供稳定回调读取最新状态（避免每次快照都生成新回调、连带 25 张卡牌全部重渲染）
  const gameRef = useRef(game);
  gameRef.current = game;
  const viewerCanGuessRef = useRef(viewerCanGuess);
  viewerCanGuessRef.current = viewerCanGuess;

  useEffect(() => {
    setRoomCategoryIds(snapshot.selectedCategoryIds);
  }, [snapshot.selectedCategoryIds]);

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
    // withCredentials：跨源部署（realtime 独立域名/端口）时轮询兜底也能带上会话 cookie
    const client = io(realtimeUrl, { transports: ["websocket", "polling"], withCredentials: true });
    socketRef.current = client;

    // 任何服务器消息到达都意味着一次往返完成，清掉等待态
    const settle = () => {
      setPendingCardId(null);
      setActionPending(false);
    };
    const applySnapshot = (next: RoomSnapshot) => {
      settle();
      setSnapshot(next);
    };

    client.on("connect", () => {
      setConnected(true);
      client.emit("room:join", { roomCode });
    });
    client.on("disconnect", () => setConnected(false));
    client.on("room:snapshot", applySnapshot);
    client.on("member:changed", applySnapshot);
    client.on("turn:clueSubmitted", applySnapshot);
    client.on("turn:ended", applySnapshot);
    client.on(
      "card:revealed",
      (next: RoomSnapshot & { revealedCardId?: string; outcome?: GuessOutcome }) => {
        applySnapshot(next);
        triggerRevealFx(next);
      }
    );
    client.on("game:ended", (next: RoomSnapshot & { winnerTeam?: TurnTeam | null }) => {
      applySnapshot(next);
      if (next.winnerTeam) setTimeout(() => play("win"), 420);
    });
    client.on("game:started", (next: RoomSnapshot) => {
      play("start");
      setFx(null);
      applySnapshot(next);
    });
    client.on("chat:message", (message: TeamChatMessage) => {
      setChatMessages((prev) => [...prev.slice(-99), message]);
    });
    client.on("room:disbanded", () => {
      window.location.href = "/";
    });
    client.on("error", (next: { message?: string }) => {
      settle();
      toast.err(next.message ?? "操作失败");
      // 操作被拒绝时服务器不会推快照，重新 join 拉一份权威状态，纠正乐观更新
      client.emit("room:join", { roomCode });
    });
    return () => {
      socketRef.current = null;
      client.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [play, realtimeUrl, roomCode, userId]);

  const visibleCards = useMemo(() => snapshot.game?.cards ?? [], [snapshot.game?.cards]);
  const cardTextByPosition = useMemo(
    () => new Map(visibleCards.map((card) => [card.position, card.textCn])),
    [visibleCards]
  );
  const isFinished = game?.phase === "finished";
  const winnerTeam = game?.winnerTeam ?? null;
  const finishReason =
    isFinished && game && game.redRemaining > 0 && game.blueRemaining > 0 ? "assassin" : "all";
  const showResult = Boolean(isFinished && winnerTeam && dismissedResultFor !== game?.id);

  function startGame() {
    if (!socketRef.current) return;
    if (game && !isFinished) {
      setConfirmRestart(true);
      return;
    }
    play("click");
    socketRef.current.emit("game:start", { roomCode });
  }

  function confirmRestartGame() {
    setConfirmRestart(false);
    play("click");
    socketRef.current?.emit("game:start", { roomCode });
  }

  function disbandRoom() {
    socketRef.current?.emit("room:disband", { roomCode });
  }

  const reveal = useCallback(
    (cardId: string) => {
      const socket = socketRef.current;
      const currentGame = gameRef.current;
      if (!socket || !currentGame) return;
      if (currentGame.phase !== "guessing") {
        toast.err("请等待本队间谍提交线索后再翻牌");
        return;
      }
      if (!viewerCanGuessRef.current) {
        toast.err("只有当前队伍的普通队员可以翻牌");
        return;
      }
      play("click");
      setPendingCardId(cardId);
      socket.emit("card:reveal", { roomCode, gameId: currentGame.id, cardId });
    },
    [play, roomCode, toast]
  );

  const assignRole = useCallback(
    (targetUserId: string, team: Team, canSpy: boolean) => {
      // 乐观更新：立即反映到成员列表，若服务器拒绝会通过 error→re-join 纠正
      setSnapshot((prev) => ({
        ...prev,
        members: prev.members.map((member) =>
          member.userId === targetUserId
            ? { ...member, team, canSpy: team === "spectator" ? false : canSpy }
            : member
        )
      }));
      socketRef.current?.emit("member:assignRole", { roomCode, targetUserId, team, canSpy });
    },
    [roomCode]
  );

  function updateCategories() {
    socketRef.current?.emit("room:updateCategories", { roomCode, categoryIds: roomCategoryIds });
  }

  const submitTurnClue = useCallback(
    (word: string, count: number) => {
      const socket = socketRef.current;
      const currentGame = gameRef.current;
      if (!socket || !currentGame) return;
      const safeCount = Math.max(1, Math.min(9, Math.round(count) || 1));
      setActionPending(true);
      socket.emit("turn:submitClue", { roomCode, gameId: currentGame.id, clueWord: word, clueCount: safeCount });
    },
    [roomCode]
  );

  const endCurrentTurn = useCallback(() => {
    const socket = socketRef.current;
    const currentGame = gameRef.current;
    if (!socket || !currentGame) return;
    setActionPending(true);
    socket.emit("turn:end", { roomCode, gameId: currentGame.id });
  }, [roomCode]);

  // ===== 队伍聊天 =====
  const viewerIsSpectator = !viewer || viewer.team === "spectator";
  const canChat = !!viewer && (viewer.team === "red" || viewer.team === "blue") && !viewer.canSpy;
  const chatHint = viewerIsSpectator
    ? "旁观模式：可同时围观两队讨论"
    : viewer?.canSpy
      ? "你是间谍：只能观看队友交流，不能发言"
      : "只有本队队友（和旁观者）能看到这里的消息";
  // 客户端也按当前队伍过滤一遍：切换队伍后不残留原队消息（旁观者看全部）
  const chatVisibleMessages = useMemo(() => {
    if (!viewer || viewer.team === "spectator") return chatMessages;
    return chatMessages.filter((message) => message.team === viewer.team);
  }, [chatMessages, viewer]);

  const sendChat = useCallback(
    (text: string) => {
      socketRef.current?.emit("chat:send", { roomCode, text });
    },
    [roomCode]
  );

  return (
    <div className="relative">
      <RevealFx fx={fx} edgeFlash={edgeFlash} assassinBlast={assassinBlast} />

      {/* ===== 主体（刺客时整体震屏） ===== */}
      <div className={cn(shake && "screen-shake")}>
        <div className="mx-auto grid w-full max-w-7xl gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
          <section className="min-w-0">
            <RoomHeader
              roomCode={roomCode}
              connected={connected}
              hasGame={Boolean(game)}
              isOwner={snapshot.viewerIsOwner}
              soundEnabled={enabled}
              onToggleSound={() => setEnabled(!enabled)}
              onStartGame={startGame}
              onOpenSettings={() => setSettingsOpen(true)}
              onCopyError={() => toast.err("复制失败，请手动复制房间码")}
            />

            <ScoreStrip game={game} isOwner={snapshot.viewerIsOwner} />

            <GameBoard
              game={game}
              cards={visibleCards}
              fx={fx}
              pendingCardId={pendingCardId}
              viewerCanGuess={viewerCanGuess}
              onReveal={reveal}
            />

            <ActionBar
              game={game}
              viewerCanSubmitClue={viewerCanSubmitClue}
              viewerCanGuess={viewerCanGuess}
              pending={actionPending}
              onSubmitClue={submitTurnClue}
              onEndTurn={endCurrentTurn}
            />
          </section>

          <aside className="min-w-0">
            <RoomSidebar
              members={snapshot.members}
              viewerIsOwner={snapshot.viewerIsOwner}
              onAssignRole={assignRole}
              chatMessages={chatVisibleMessages}
              canChat={canChat}
              chatHint={chatHint}
              onSendChat={sendChat}
              events={snapshot.recentEvents ?? []}
              cardTextByPosition={cardTextByPosition}
              currentGameId={game?.id ?? null}
            />
          </aside>
        </div>
      </div>

      {snapshot.viewerIsOwner ? (
        <RoomSettingsModal
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          roomCode={roomCode}
          categoryTree={snapshot.categoryTree}
          selectedCategoryIds={roomCategoryIds}
          onChangeCategories={setRoomCategoryIds}
          onSaveCategories={updateCategories}
          onDisband={disbandRoom}
        />
      ) : null}

      <ConfirmDialog
        open={confirmRestart}
        title="重开一局？"
        body="当前对局进度将被清空，重新抽取 25 张密令牌。"
        confirmLabel="确认重开"
        onCancel={() => setConfirmRestart(false)}
        onConfirm={confirmRestartGame}
      />

      <ResultModal
        show={showResult}
        winnerTeam={winnerTeam}
        finishReason={finishReason}
        game={game}
        isOwner={snapshot.viewerIsOwner}
        onViewBoard={() => game && setDismissedResultFor(game.id)}
        onRestart={confirmRestartGame}
      />
    </div>
  );
}
