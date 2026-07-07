import type { TeamChatMessage, TurnTeam } from "@cosmere/shared";
import { createAdapter } from "@socket.io/redis-adapter";
import { randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { Redis } from "ioredis";
import { Server } from "socket.io";
import { z } from "zod";
import { readUserIdFromCookie } from "./auth";
import {
  buildRoomSnapshotBase,
  createGameForRoom,
  disbandRoom,
  endTurn,
  projectRoomSnapshot,
  revealCard,
  submitClue
} from "./game-state";
import { prisma } from "./prisma";

const port = Number(process.env.REALTIME_PORT ?? 4001);
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";

const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  cors: {
    origin: process.env.WEB_ORIGIN ?? "http://localhost:3000",
    credentials: true
  }
});

const pubClient = new Redis(redisUrl);
const subClient = pubClient.duplicate();
io.adapter(createAdapter(pubClient, subClient));

const joinSchema = z.object({ roomCode: z.string() });
const roleSchema = joinSchema.extend({
  targetUserId: z.string(),
  team: z.enum(["red", "blue", "spectator"]),
  canSpy: z.boolean()
});
const startSchema = joinSchema;
const revealSchema = joinSchema.extend({ gameId: z.string(), cardId: z.string() });
const categoriesSchema = joinSchema.extend({
  categoryIds: z.array(z.string().min(1)).min(1)
});
const clueSchema = joinSchema.extend({
  gameId: z.string(),
  clueWord: z.string().trim().min(1).max(40),
  clueCount: z.number().int().min(1).max(9)
});
const endTurnSchema = joinSchema.extend({ gameId: z.string() });
const chatSchema = joinSchema.extend({ text: z.string().trim().min(1).max(300) });

async function emitSnapshot(roomCode: string, event = "room:snapshot", extra?: Record<string, unknown>) {
  const sockets = await io.in(roomCode).fetchSockets();
  if (sockets.length === 0) return;
  // 只查一次库，按观察者视角零查询投影（此前是每个 socket 全量重建，N 人房 = N 份查询）
  const base = await buildRoomSnapshotBase(roomCode);
  if (!base) return;
  for (const socket of sockets) {
    const userId = socket.data.userId as string | undefined;
    socket.emit(event, { ...projectRoomSnapshot(base, userId), ...extra });
  }
}

io.on("connection", (socket) => {
  socket.on("room:join", async (payload) => {
    try {
      const input = joinSchema.parse(payload);
      const userId = await readUserIdFromCookie(socket.handshake.headers.cookie);
      if (!userId) throw new Error("Unauthenticated");
      const roomCode = input.roomCode.trim().toUpperCase();
      const room = await prisma.room.findUnique({ where: { code: roomCode } });
      if (!room) throw new Error("Room not found");
      const member = await prisma.roomMember.findUnique({
        where: { roomId_userId: { roomId: room.id, userId } }
      });
      if (!member) throw new Error("Not a room member");
      socket.data.userId = userId;
      await socket.join(roomCode);
      await emitSnapshot(roomCode);
    } catch (error) {
      socket.emit("error", { message: error instanceof Error ? error.message : "Join failed" });
    }
  });

  socket.on("member:assignRole", async (payload) => {
    try {
      const input = roleSchema.parse(payload);
      const userId = socket.data.userId as string | undefined;
      if (!userId) throw new Error("Unauthenticated");
      const room = await prisma.room.findUnique({ where: { code: input.roomCode } });
      if (!room) throw new Error("Room not found");
      if (room.ownerId !== userId) throw new Error("Only owner can assign roles");
      const canSpy = input.team === "spectator" ? false : input.canSpy;
      await prisma.roomMember.update({
        where: { roomId_userId: { roomId: room.id, userId: input.targetUserId } },
        data: { team: input.team, canSpy }
      });
      await prisma.gameEvent.create({
        data: {
          roomId: room.id,
          userId,
          type: "member.role_assigned",
          payload: { targetUserId: input.targetUserId, team: input.team, canSpy }
        }
      });
      await emitSnapshot(input.roomCode, "member:changed");
    } catch (error) {
      socket.emit("error", { message: error instanceof Error ? error.message : "Role update failed" });
    }
  });

  socket.on("room:updateCategories", async (payload) => {
    try {
      const input = categoriesSchema.parse(payload);
      const userId = socket.data.userId as string | undefined;
      if (!userId) throw new Error("Unauthenticated");
      const room = await prisma.room.findUnique({ where: { code: input.roomCode } });
      if (!room) throw new Error("Room not found");
      if (room.ownerId !== userId) throw new Error("Only owner can update categories");
      const existingCount = await prisma.wordCategory.count({
        where: { id: { in: input.categoryIds } }
      });
      if (existingCount !== new Set(input.categoryIds).size) throw new Error("题库分类不存在");
      const enabledCount = await prisma.wordEntry.count({
        where: { enabled: true, wordCategoryId: { in: input.categoryIds } }
      });
      if (enabledCount < 25) throw new Error("选中的题库不足 25 条，无法开局");
      await prisma.$transaction(async (tx) => {
        await tx.roomWordCategory.deleteMany({ where: { roomId: room.id } });
        await tx.roomWordCategory.createMany({
          data: input.categoryIds.map((wordCategoryId) => ({ roomId: room.id, wordCategoryId }))
        });
        await tx.gameEvent.create({
          data: {
            roomId: room.id,
            userId,
            type: "room.categories_updated",
            payload: { categoryIds: input.categoryIds }
          }
        });
      });
      await emitSnapshot(input.roomCode, "room:snapshot");
    } catch (error) {
      socket.emit("error", { message: error instanceof Error ? error.message : "Category update failed" });
    }
  });

  socket.on("game:start", async (payload) => {
    try {
      const input = startSchema.parse(payload);
      const userId = socket.data.userId as string | undefined;
      if (!userId) throw new Error("Unauthenticated");
      const room = await prisma.room.findUnique({ where: { code: input.roomCode }, include: { members: true } });
      if (!room) throw new Error("Room not found");
      if (room.ownerId !== userId) throw new Error("只有房主可以开始或重开游戏");
      await createGameForRoom(room.id, userId);
      await emitSnapshot(input.roomCode, "game:started");
    } catch (error) {
      socket.emit("error", { message: error instanceof Error ? error.message : "Start failed" });
    }
  });

  socket.on("room:disband", async (payload) => {
    try {
      const input = joinSchema.parse(payload);
      const userId = socket.data.userId as string | undefined;
      if (!userId) throw new Error("Unauthenticated");
      const room = await prisma.room.findUnique({ where: { code: input.roomCode } });
      if (!room) throw new Error("Room not found");
      if (room.ownerId !== userId) throw new Error("只有房主可以解散房间");
      // 先广播再删除，确保房内成员都能收到通知并离开
      io.in(input.roomCode).emit("room:disbanded", { roomCode: input.roomCode });
      await disbandRoom(room.id);
    } catch (error) {
      socket.emit("error", { message: error instanceof Error ? error.message : "Disband failed" });
    }
  });

  socket.on("card:reveal", async (payload) => {
    try {
      const input = revealSchema.parse(payload);
      const userId = socket.data.userId as string | undefined;
      if (!userId) throw new Error("Unauthenticated");
      const room = await prisma.room.findUnique({ where: { code: input.roomCode }, include: { members: true } });
      if (!room?.members.some((member) => member.userId === userId)) throw new Error("Not a room member");
      const result = await revealCard(input.gameId, input.cardId, userId);
      if (!result.outcome) {
        // 卡牌已被翻开（并发重复点击）：只同步状态，不重复触发特效
        await emitSnapshot(input.roomCode);
        return;
      }
      await emitSnapshot(input.roomCode, "card:revealed", {
        revealedCardId: result.card.id,
        revealedFaction: result.card.faction,
        outcome: result.outcome,
        guessTeam: result.guessTeam,
        winnerTeam: result.winnerTeam
      });
      if (result.gameFinished) {
        await emitSnapshot(input.roomCode, "game:ended", { winnerTeam: result.winnerTeam });
      }
    } catch (error) {
      socket.emit("error", { message: error instanceof Error ? error.message : "Reveal failed" });
    }
  });

  socket.on("turn:submitClue", async (payload) => {
    try {
      const input = clueSchema.parse(payload);
      const userId = socket.data.userId as string | undefined;
      if (!userId) throw new Error("Unauthenticated");
      await submitClue(input.gameId, userId, input.clueWord, input.clueCount);
      await emitSnapshot(input.roomCode, "turn:clueSubmitted");
    } catch (error) {
      socket.emit("error", { message: error instanceof Error ? error.message : "Clue failed" });
    }
  });

  socket.on("chat:send", async (payload) => {
    try {
      const input = chatSchema.parse(payload);
      const userId = socket.data.userId as string | undefined;
      if (!userId) throw new Error("Unauthenticated");
      // 轻量防刷屏：同一连接两条消息至少间隔 400ms（静默丢弃）
      const now = Date.now();
      const last = (socket.data.lastChatAt as number | undefined) ?? 0;
      if (now - last < 400) return;
      socket.data.lastChatAt = now;

      const room = await prisma.room.findUnique({
        where: { code: input.roomCode },
        include: { members: { include: { user: { select: { id: true, username: true } } } } }
      });
      if (!room) throw new Error("Room not found");
      const sender = room.members.find((member) => member.userId === userId);
      if (!sender) throw new Error("Not a room member");
      if (sender.team === "spectator") throw new Error("旁观者不能发言");
      if (sender.canSpy) throw new Error("间谍只能观看队友交流，不能发言");

      const message: TeamChatMessage = {
        id: randomUUID(),
        team: sender.team as TurnTeam,
        userId,
        username: sender.user.username,
        text: input.text,
        at: new Date().toISOString()
      };
      // 可见范围：发送者本队（含本队间谍）+ 旁观者；对方队伍不可见
      const teamByUser = new Map(room.members.map((member) => [member.userId, member.team]));
      const sockets = await io.in(input.roomCode).fetchSockets();
      for (const target of sockets) {
        const targetUserId = target.data.userId as string | undefined;
        const targetTeam = targetUserId ? teamByUser.get(targetUserId) : undefined;
        if (targetTeam === sender.team || targetTeam === "spectator") {
          target.emit("chat:message", message);
        }
      }
    } catch (error) {
      socket.emit("error", { message: error instanceof Error ? error.message : "Chat failed" });
    }
  });

  socket.on("turn:end", async (payload) => {
    try {
      const input = endTurnSchema.parse(payload);
      const userId = socket.data.userId as string | undefined;
      if (!userId) throw new Error("Unauthenticated");
      await endTurn(input.gameId, userId);
      await emitSnapshot(input.roomCode, "turn:ended");
    } catch (error) {
      socket.emit("error", { message: error instanceof Error ? error.message : "End turn failed" });
    }
  });
});

httpServer.listen(port, () => {
  console.log(`Realtime service listening on :${port}`);
});
