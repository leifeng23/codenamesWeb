import { createGameState } from "@cosmere/shared/server";
import { prisma } from "./prisma";

const gameState = createGameState(prisma);

export const {
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
} = gameState;
