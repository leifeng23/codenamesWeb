import { createGameState } from "@cosmere/shared/server";
import { prisma } from "./prisma";

const gameState = createGameState(prisma);

export const { buildCategoryTree, buildRoomSnapshot, cleanupStaleRooms } = gameState;
