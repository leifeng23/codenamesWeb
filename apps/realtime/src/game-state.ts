import type { Faction, WordArchiveNode } from "@cosmere/shared";
import {
  canGuess,
  canMemberSpy,
  canSubmitClue,
  classifyReveal,
  countRemaining,
  deriveWinner,
  generateCards,
  nextTurnTeam,
  shouldEndTurnAfterReveal,
  type TurnTeam
} from "@cosmere/shared";
import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";

export async function ensureRoomCategories(roomId: string) {
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

export async function buildCategoryTree(): Promise<WordArchiveNode[]> {
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

export async function createGameForRoom(roomId: string, userId: string) {
  const selectedCategoryIds = await ensureRoomCategories(roomId);
  const words = await prisma.wordEntry.findMany({
    where: { enabled: true, wordCategoryId: { in: selectedCategoryIds } },
    select: { id: true }
  });
  if (words.length < 25) {
    throw new Error("当前房间选中的题库不足 25 条，无法开局");
  }

  const seed = randomUUID();
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

export async function revealCard(gameId: string, cardId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
    const card = await tx.gameCard.findUnique({
      where: { id: cardId },
      include: { game: { include: { room: { include: { members: true } } } } }
    });
    if (!card || card.gameId !== gameId) throw new Error("Card not found");
    if (card.revealed) {
      return {
        card,
        outcome: null,
        guessTeam: card.game.turnTeam as TurnTeam,
        turnEnded: false,
        gameFinished: false,
        winnerTeam: null as TurnTeam | null
      };
    }
    if (card.game.phase !== "guessing") throw new Error("当前回合还没有提交线索");

    const guessTeam = card.game.turnTeam as TurnTeam;
    const member = card.game.room.members.find((item) => item.userId === userId);
    if (!member || !canGuess(member, guessTeam)) {
      throw new Error("只有当前队伍的普通队员可以翻牌");
    }

    const updated = await tx.gameCard.update({
      where: { id: card.id },
      data: { revealed: true, revealedAt: new Date(), revealedBy: userId }
    });
    const cards = await tx.gameCard.findMany({ where: { gameId }, select: { faction: true, revealed: true } });
    const remaining = countRemaining(cards as Array<{ faction: Faction; revealed: boolean }>);
    const guessesMade = card.game.guessesMadeThisTurn + 1;
    const gameFinished = updated.faction === "assassin" || remaining.redRemaining === 0 || remaining.blueRemaining === 0;
    const turnShouldEnd =
      !gameFinished &&
      shouldEndTurnAfterReveal({
        revealedFaction: updated.faction,
        turnTeam: card.game.turnTeam as TurnTeam,
        guessesMade,
        maxGuesses: card.game.maxGuessesThisTurn
      });

    const nextTeam = turnShouldEnd ? nextTurnTeam(guessTeam) : guessTeam;
    const nextPhase = gameFinished ? "finished" : turnShouldEnd ? "waiting_for_clue" : "guessing";
    const gameStatus = gameFinished ? "finished" : "active";
    const outcome = classifyReveal(updated.faction, guessTeam);
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
        status: gameStatus,
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
          faction: updated.faction,
          position: updated.position,
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
            reason: updated.faction === "assassin" ? "assassin" : "all_cards_found",
            winnerTeam
          }
        }
      });
    }
    return { card: updated, outcome, guessTeam, turnEnded: turnShouldEnd, gameFinished, winnerTeam };
  });
}

export async function submitClue(gameId: string, userId: string, clueWord: string, clueCount: number) {
  return prisma.$transaction(async (tx) => {
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

export async function endTurn(gameId: string, userId: string) {
  return prisma.$transaction(async (tx) => {
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
export async function disbandRoom(roomId: string) {
  await prisma.$transaction([
    prisma.gameEvent.deleteMany({ where: { roomId } }),
    prisma.room.delete({ where: { id: roomId } })
  ]);
}

export async function buildRoomSnapshot(roomCode: string, viewerUserId?: string) {
  const room = await prisma.room.findUnique({
    where: { code: roomCode },
    include: {
      members: { include: { user: { select: { id: true, email: true, username: true } } } },
      wordCategories: true,
      currentGame: {
        include: {
          cards: { include: { wordEntry: true }, orderBy: { position: "asc" } }
        }
      }
    }
  });
  if (!room) return null;
  const viewer = room.members.find((member) => member.userId === viewerUserId);
  const canSeeFactions = viewer ? canMemberSpy(viewer) : false;
  const categoryTree = await buildCategoryTree();
  const selectedCategoryIds = room.wordCategories.length
    ? room.wordCategories.map((item) => item.wordCategoryId)
    : categoryTree.flatMap((archive) => archive.categories.map((category) => category.id));
  return {
    roomCode: room.code,
    status: room.status,
    currentGameId: room.currentGameId,
    viewerIsOwner: room.ownerId === viewerUserId,
    selectedCategoryIds,
    categoryTree,
    members: room.members.map((member) => ({
      userId: member.user.id,
      email: member.user.email,
      username: member.user.username,
      team: member.team,
      canSpy: member.canSpy,
      isOwner: member.user.id === room.ownerId
    })),
    game: room.currentGame
      ? {
          id: room.currentGame.id,
          redRemaining: room.currentGame.redRemaining,
          blueRemaining: room.currentGame.blueRemaining,
          turnTeam: room.currentGame.turnTeam,
          phase: room.currentGame.phase,
          winnerTeam: deriveWinner({
            phase: room.currentGame.phase,
            redRemaining: room.currentGame.redRemaining,
            blueRemaining: room.currentGame.blueRemaining,
            turnTeam: room.currentGame.turnTeam as TurnTeam
          }),
          currentClue:
            room.currentGame.currentClueWord && room.currentGame.currentClueCount != null
              ? { word: room.currentGame.currentClueWord, count: room.currentGame.currentClueCount }
              : null,
          guessesMadeThisTurn: room.currentGame.guessesMadeThisTurn,
          maxGuessesThisTurn: room.currentGame.maxGuessesThisTurn,
          cards: room.currentGame.cards.map((card) => ({
            id: card.id,
            position: card.position,
            textCn: card.wordEntry.textCn,
            textEnOrNote: card.wordEntry.textEnOrNote,
            revealed: card.revealed,
            faction: card.revealed || canSeeFactions ? card.faction : undefined
          }))
        }
      : null
  };
}
