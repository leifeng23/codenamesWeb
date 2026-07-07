/**
 * 服务端共享对局逻辑（web / realtime 共用，消除双拷贝）。
 * 通过 createGameState(prisma) 注入各应用自己的 PrismaClient 实例。
 *
 * 并发安全：reveal/clue/endTurn 事务内先对 Game 行加 FOR UPDATE 锁，
 * 串行化同一对局的所有状态变更，避免重复翻牌、计数丢失更新。
 */
import type { Prisma, PrismaClient } from "@prisma/client";
import {
  canGuess,
  canMemberSpy,
  canSubmitClue,
  classifyReveal,
  countRemaining,
  deriveWinner,
  generateCards,
  nextTurnTeam,
  shouldEndTurnAfterReveal
} from "../game";
import type {
  Faction,
  GuessOutcome,
  RoomEventSummary,
  RoomSnapshot,
  Team,
  TurnTeam,
  WordArchiveNode
} from "../types";

const CATEGORY_TREE_TTL_MS = 30_000;
const RECENT_EVENTS_LIMIT = 30;

export interface RevealResult {
  card: { id: string; position: number; faction: Faction };
  outcome: GuessOutcome | null;
  guessTeam: TurnTeam;
  turnEnded: boolean;
  gameFinished: boolean;
  winnerTeam: TurnTeam | null;
}

/** 快照公共底座：一次查询构建，按观察者视角做零查询投影。 */
export interface RoomSnapshotBase {
  ownerId: string;
  roomCode: string;
  status: RoomSnapshot["status"];
  currentGameId: string | null;
  selectedCategoryIds: string[];
  categoryTree: WordArchiveNode[];
  recentEvents: RoomEventSummary[];
  members: RoomSnapshot["members"];
  game: null | {
    meta: Omit<NonNullable<RoomSnapshot["game"]>, "cards">;
    cardsPublic: NonNullable<RoomSnapshot["game"]>["cards"];
    cardsSpy: NonNullable<RoomSnapshot["game"]>["cards"];
  };
}

/** 按观察者投影快照：间谍看阵营；对局结束后全员公开底牌（复盘体验）。 */
export function projectRoomSnapshot(base: RoomSnapshotBase, viewerUserId?: string): RoomSnapshot {
  const viewer = base.members.find((member) => member.userId === viewerUserId);
  const canSeeFactions = viewer ? canMemberSpy(viewer) : false;
  return {
    roomCode: base.roomCode,
    status: base.status,
    currentGameId: base.currentGameId,
    viewerIsOwner: base.ownerId === viewerUserId,
    selectedCategoryIds: base.selectedCategoryIds,
    categoryTree: base.categoryTree,
    recentEvents: base.recentEvents,
    members: base.members,
    game: base.game
      ? {
          ...base.game.meta,
          cards:
            canSeeFactions || base.game.meta.phase === "finished"
              ? base.game.cardsSpy
              : base.game.cardsPublic
        }
      : null
  };
}

function summarizeEvent(
  event: {
    id: string;
    type: string;
    payload: Prisma.JsonValue;
    createdAt: Date;
    gameId: string | null;
    user: { username: string } | null;
  },
  usernameById: Map<string, string>
): RoomEventSummary {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const data: RoomEventSummary["data"] = {};
  switch (event.type) {
    case "turn.clue_submitted":
      data.clueWord = payload.clueWord as string;
      data.clueCount = payload.clueCount as number;
      data.turnTeam = payload.turnTeam as TurnTeam;
      break;
    case "card.revealed":
      data.faction = payload.faction as Faction;
      data.position = payload.position as number;
      data.turnEnded = payload.turnEnded as boolean;
      data.gameFinished = payload.gameFinished as boolean;
      break;
    case "turn.ended":
      data.reason = payload.reason as string;
      data.nextTurnTeam = payload.nextTurnTeam as TurnTeam;
      break;
    case "game.finished":
      data.reason = payload.reason as string;
      data.winnerTeam = (payload.winnerTeam ?? null) as TurnTeam | null;
      break;
    case "member.role_assigned":
      data.team = payload.team as Team;
      data.canSpy = payload.canSpy as boolean;
      data.targetName = usernameById.get(payload.targetUserId as string) ?? "已离开的成员";
      break;
    case "room.categories_updated":
      data.categoryCount = Array.isArray(payload.categoryIds) ? payload.categoryIds.length : undefined;
      break;
    default:
      // game.started 等：不透出 payload（seed 可反推棋盘，属敏感信息）
      break;
  }
  return {
    id: event.id,
    type: event.type,
    createdAt: event.createdAt.toISOString(),
    actorName: event.user?.username ?? null,
    gameId: event.gameId,
    data
  };
}

export function createGameState(prisma: PrismaClient) {
  let categoryTreeCache: { at: number; tree: WordArchiveNode[] } | null = null;

  async function queryCategoryTree(): Promise<WordArchiveNode[]> {
    const [archives, counts] = await Promise.all([
      prisma.wordArchive.findMany({
        include: { categories: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }]
      }),
      prisma.wordEntry.groupBy({
        by: ["wordCategoryId"],
        where: { enabled: true },
        _count: { _all: true }
      })
    ]);
    const countByCategory = new Map(counts.map((item) => [item.wordCategoryId, item._count._all]));
    return archives.map((archive) => ({
      id: archive.id,
      name: archive.name,
      categories: archive.categories.map((category) => ({
        id: category.id,
        name: category.name,
        archiveId: archive.id,
        archiveName: archive.name,
        count: countByCategory.get(category.id) ?? 0
      }))
    }));
  }

  /** 题库树带 30s TTL 缓存：它只在管理员编辑题库时才变化，无需每次快照都查两遍库。 */
  async function buildCategoryTree(forceFresh = false): Promise<WordArchiveNode[]> {
    if (!forceFresh && categoryTreeCache && Date.now() - categoryTreeCache.at < CATEGORY_TREE_TTL_MS) {
      return categoryTreeCache.tree;
    }
    const tree = await queryCategoryTree();
    categoryTreeCache = { at: Date.now(), tree };
    return tree;
  }

  async function ensureRoomCategories(roomId: string) {
    const existing = await prisma.roomWordCategory.findMany({
      where: { roomId },
      select: { wordCategoryId: true }
    });
    if (existing.length > 0) {
      return existing.map((item) => item.wordCategoryId);
    }
    const availableCategories = await prisma.wordCategory.findMany({
      where: { words: { some: { enabled: true } } },
      select: { id: true },
      orderBy: [{ archive: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }]
    });
    await prisma.roomWordCategory.createMany({
      data: availableCategories.map((category) => ({ roomId, wordCategoryId: category.id })),
      skipDuplicates: true
    });
    return availableCategories.map((category) => category.id);
  }

  async function createGameForRoom(roomId: string, userId: string) {
    const selectedCategoryIds = await ensureRoomCategories(roomId);
    const words = await prisma.wordEntry.findMany({
      where: { enabled: true, wordCategoryId: { in: selectedCategoryIds } },
      select: { id: true }
    });
    if (words.length < 25) {
      throw new Error("当前房间选中的题库不足 25 条，无法开局");
    }

    const seed = crypto.randomUUID();
    const cards = generateCards(words.map((word) => word.id), seed);

    return prisma.$transaction(async (tx) => {
      const game = await tx.game.create({
        data: {
          roomId,
          seed,
          turnTeam: "red",
          phase: "waiting_for_clue",
          currentClueWord: null,
          currentClueCount: null,
          guessesMadeThisTurn: 0,
          maxGuessesThisTurn: null,
          cards: {
            create: cards.map((card) => ({
              wordEntryId: card.wordEntryId,
              position: card.position,
              faction: card.faction
            }))
          }
        }
      });

      await tx.room.update({
        where: { id: roomId },
        data: { status: "playing", currentGameId: game.id }
      });
      await tx.gameEvent.create({
        data: {
          roomId,
          gameId: game.id,
          userId,
          type: "game.started",
          payload: { seed, categoryIds: selectedCategoryIds }
        }
      });
      return game;
    });
  }

  /** 事务内锁定 Game 行，串行化同一对局的并发操作。 */
  async function lockGame(tx: Prisma.TransactionClient, gameId: string) {
    await tx.$queryRaw`SELECT id FROM "Game" WHERE id = ${gameId} FOR UPDATE`;
  }

  async function revealCard(gameId: string, cardId: string, userId: string): Promise<RevealResult> {
    return prisma.$transaction(async (tx) => {
      await lockGame(tx, gameId);
      const card = await tx.gameCard.findUnique({
        where: { id: cardId },
        include: { game: { include: { room: { include: { members: true } } } } }
      });
      if (!card || card.gameId !== gameId) throw new Error("Card not found");
      const alreadyRevealed: RevealResult = {
        card: { id: card.id, position: card.position, faction: card.faction as Faction },
        outcome: null,
        guessTeam: card.game.turnTeam as TurnTeam,
        turnEnded: false,
        gameFinished: false,
        winnerTeam: null
      };
      if (card.revealed) return alreadyRevealed;
      if (card.game.phase !== "guessing") throw new Error("当前回合还没有提交线索");

      const guessTeam = card.game.turnTeam as TurnTeam;
      const member = card.game.room.members.find((item) => item.userId === userId);
      if (!member || !canGuess(member, guessTeam)) {
        throw new Error("只有当前队伍的普通队员可以翻牌");
      }

      // revealed=false 守卫 + 行锁双保险：并发重复点击只会有一次生效
      const claimed = await tx.gameCard.updateMany({
        where: { id: card.id, revealed: false },
        data: { revealed: true, revealedAt: new Date(), revealedBy: userId }
      });
      if (claimed.count === 0) return alreadyRevealed;

      const cards = await tx.gameCard.findMany({ where: { gameId }, select: { faction: true, revealed: true } });
      const remaining = countRemaining(cards as Array<{ faction: Faction; revealed: boolean }>);
      const guessesMade = card.game.guessesMadeThisTurn + 1;
      const revealedFaction = card.faction as Faction;
      const gameFinished =
        revealedFaction === "assassin" || remaining.redRemaining === 0 || remaining.blueRemaining === 0;
      const turnShouldEnd =
        !gameFinished &&
        shouldEndTurnAfterReveal({
          revealedFaction,
          turnTeam: guessTeam,
          guessesMade,
          maxGuesses: card.game.maxGuessesThisTurn
        });

      const nextTeam = turnShouldEnd ? nextTurnTeam(guessTeam) : guessTeam;
      const nextPhase = gameFinished ? "finished" : turnShouldEnd ? "waiting_for_clue" : "guessing";
      const outcome = classifyReveal(revealedFaction, guessTeam);
      const winnerTeam = gameFinished
        ? deriveWinner({
            phase: "finished",
            redRemaining: remaining.redRemaining,
            blueRemaining: remaining.blueRemaining,
            turnTeam: nextTeam
          })
        : null;

      await tx.game.update({
        where: { id: gameId },
        data: {
          ...remaining,
          status: gameFinished ? "finished" : "active",
          turnTeam: nextTeam,
          phase: nextPhase,
          guessesMadeThisTurn: turnShouldEnd || gameFinished ? 0 : guessesMade,
          currentClueWord: turnShouldEnd || gameFinished ? null : card.game.currentClueWord,
          currentClueCount: turnShouldEnd || gameFinished ? null : card.game.currentClueCount,
          maxGuessesThisTurn: turnShouldEnd || gameFinished ? null : card.game.maxGuessesThisTurn
        }
      });
      if (gameFinished) {
        await tx.room.update({ where: { id: card.game.roomId }, data: { status: "finished" } });
      }
      await tx.gameEvent.create({
        data: {
          roomId: card.game.roomId,
          gameId,
          userId,
          type: "card.revealed",
          payload: {
            cardId: card.id,
            faction: revealedFaction,
            position: card.position,
            guessesMade,
            turnEnded: turnShouldEnd,
            gameFinished
          }
        }
      });
      if (turnShouldEnd) {
        await tx.gameEvent.create({
          data: {
            roomId: card.game.roomId,
            gameId,
            userId,
            type: "turn.ended",
            payload: { reason: "reveal", nextTurnTeam: nextTeam }
          }
        });
      }
      if (gameFinished) {
        await tx.gameEvent.create({
          data: {
            roomId: card.game.roomId,
            gameId,
            userId,
            type: "game.finished",
            payload: {
              reason: revealedFaction === "assassin" ? "assassin" : "all_cards_found",
              winnerTeam
            }
          }
        });
      }
      return {
        card: { id: card.id, position: card.position, faction: revealedFaction },
        outcome,
        guessTeam,
        turnEnded: turnShouldEnd,
        gameFinished,
        winnerTeam
      };
    });
  }

  async function submitClue(gameId: string, userId: string, clueWord: string, clueCount: number) {
    return prisma.$transaction(async (tx) => {
      await lockGame(tx, gameId);
      const game = await tx.game.findUnique({
        where: { id: gameId },
        include: { room: { include: { members: true } } }
      });
      if (!game) throw new Error("对局不存在");
      if (game.phase !== "waiting_for_clue") throw new Error("当前不能提交线索");
      const member = game.room.members.find((item) => item.userId === userId);
      if (!member || !canSubmitClue(member, game.turnTeam as TurnTeam)) {
        throw new Error("只有当前队伍的间谍可以提交线索");
      }
      const updated = await tx.game.update({
        where: { id: gameId },
        data: {
          phase: "guessing",
          currentClueWord: clueWord,
          currentClueCount: clueCount,
          maxGuessesThisTurn: clueCount + 1,
          guessesMadeThisTurn: 0
        }
      });
      await tx.gameEvent.create({
        data: {
          roomId: game.roomId,
          gameId,
          userId,
          type: "turn.clue_submitted",
          payload: { clueWord, clueCount, maxGuesses: clueCount + 1, turnTeam: game.turnTeam }
        }
      });
      return updated;
    });
  }

  async function endTurn(gameId: string, userId: string) {
    return prisma.$transaction(async (tx) => {
      await lockGame(tx, gameId);
      const game = await tx.game.findUnique({
        where: { id: gameId },
        include: { room: { include: { members: true } } }
      });
      if (!game) throw new Error("对局不存在");
      if (game.phase !== "guessing") throw new Error("当前不能结束回合");
      if (game.guessesMadeThisTurn < 1) throw new Error("至少翻开一张牌后才能结束回合");
      const member = game.room.members.find((item) => item.userId === userId);
      if (!member || !canGuess(member, game.turnTeam as TurnTeam)) {
        throw new Error("只有当前队伍的普通队员可以结束回合");
      }
      const nextTeam = nextTurnTeam(game.turnTeam as TurnTeam);
      const updated = await tx.game.update({
        where: { id: gameId },
        data: {
          turnTeam: nextTeam,
          phase: "waiting_for_clue",
          currentClueWord: null,
          currentClueCount: null,
          guessesMadeThisTurn: 0,
          maxGuessesThisTurn: null
        }
      });
      await tx.gameEvent.create({
        data: {
          roomId: game.roomId,
          gameId,
          userId,
          type: "turn.ended",
          payload: { reason: "manual", nextTurnTeam: nextTeam }
        }
      });
      return updated;
    });
  }

  /** 解散房间：删除房间及其所有成员、对局、卡牌、事件、题库选择（房主操作）。 */
  async function disbandRoom(roomId: string) {
    await prisma.$transaction([
      prisma.gameEvent.deleteMany({ where: { roomId } }),
      prisma.room.delete({ where: { id: roomId } })
    ]);
  }

  /**
   * 惰性清理长期不活跃的房间。
   * 以「房间 + 当前对局」两者的 updatedAt 共同判定活跃度，
   * 避免超长对局或刚打完还想续玩的房间被误删。
   */
  async function cleanupStaleRooms(maxIdleHours = 24) {
    const cutoff = new Date(Date.now() - maxIdleHours * 60 * 60 * 1000);
    const stale = await prisma.room.findMany({
      where: {
        updatedAt: { lt: cutoff },
        OR: [{ currentGameId: null }, { currentGame: { updatedAt: { lt: cutoff } } }]
      },
      select: { id: true }
    });
    if (stale.length === 0) return 0;
    const ids = stale.map((room) => room.id);
    await prisma.$transaction([
      prisma.gameEvent.deleteMany({ where: { roomId: { in: ids } } }),
      prisma.room.deleteMany({ where: { id: { in: ids } } })
    ]);
    return ids.length;
  }

  /** 一次查询构建快照底座；对房间内所有观察者复用（realtime 广播用）。 */
  async function buildRoomSnapshotBase(roomCode: string): Promise<RoomSnapshotBase | null> {
    const room = await prisma.room.findUnique({
      where: { code: roomCode },
      include: {
        members: { include: { user: { select: { id: true, username: true } } } },
        wordCategories: true,
        currentGame: {
          include: { cards: { include: { wordEntry: true }, orderBy: { position: "asc" } } }
        }
      }
    });
    if (!room) return null;

    const [categoryTree, events] = await Promise.all([
      buildCategoryTree(),
      prisma.gameEvent.findMany({
        where: { roomId: room.id },
        orderBy: { createdAt: "desc" },
        take: RECENT_EVENTS_LIMIT,
        select: {
          id: true,
          type: true,
          payload: true,
          createdAt: true,
          gameId: true,
          user: { select: { username: true } }
        }
      })
    ]);

    const usernameById = new Map(room.members.map((member) => [member.user.id, member.user.username]));
    const selectedCategoryIds = room.wordCategories.length
      ? room.wordCategories.map((item) => item.wordCategoryId)
      : categoryTree.flatMap((archive) => archive.categories.map((category) => category.id));

    const game = room.currentGame;
    return {
      ownerId: room.ownerId,
      roomCode: room.code,
      status: room.status,
      currentGameId: room.currentGameId,
      selectedCategoryIds,
      categoryTree,
      recentEvents: events.map((event) => summarizeEvent(event, usernameById)),
      members: room.members.map((member) => ({
        userId: member.user.id,
        username: member.user.username,
        team: member.team as Team,
        canSpy: member.canSpy,
        isOwner: member.user.id === room.ownerId
      })),
      game: game
        ? {
            meta: {
              id: game.id,
              redRemaining: game.redRemaining,
              blueRemaining: game.blueRemaining,
              turnTeam: game.turnTeam as TurnTeam,
              phase: game.phase,
              winnerTeam: deriveWinner({
                phase: game.phase,
                redRemaining: game.redRemaining,
                blueRemaining: game.blueRemaining,
                turnTeam: game.turnTeam as TurnTeam
              }),
              currentClue:
                game.currentClueWord && game.currentClueCount != null
                  ? { word: game.currentClueWord, count: game.currentClueCount }
                  : null,
              guessesMadeThisTurn: game.guessesMadeThisTurn,
              maxGuessesThisTurn: game.maxGuessesThisTurn
            },
            cardsPublic: game.cards.map((card) => ({
              id: card.id,
              position: card.position,
              textCn: card.wordEntry.textCn,
              textEnOrNote: card.wordEntry.textEnOrNote,
              revealed: card.revealed,
              faction: card.revealed ? (card.faction as Faction) : undefined
            })),
            cardsSpy: game.cards.map((card) => ({
              id: card.id,
              position: card.position,
              textCn: card.wordEntry.textCn,
              textEnOrNote: card.wordEntry.textEnOrNote,
              revealed: card.revealed,
              faction: card.faction as Faction
            }))
          }
        : null
    };
  }

  /** 单观察者快照（web 首屏渲染用）。 */
  async function buildRoomSnapshot(roomCode: string, viewerUserId?: string): Promise<RoomSnapshot | null> {
    const base = await buildRoomSnapshotBase(roomCode);
    if (!base) return null;
    return projectRoomSnapshot(base, viewerUserId);
  }

  return {
    buildCategoryTree,
    ensureRoomCategories,
    createGameForRoom,
    revealCard,
    submitClue,
    endTurn,
    disbandRoom,
    cleanupStaleRooms,
    buildRoomSnapshotBase,
    buildRoomSnapshot,
    projectRoomSnapshot
  };
}
