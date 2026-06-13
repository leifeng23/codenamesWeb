-- CreateEnum
CREATE TYPE "TurnTeam" AS ENUM ('red', 'blue');

-- CreateEnum
CREATE TYPE "GamePhase" AS ENUM ('waiting_for_clue', 'guessing', 'finished');

-- AlterTable
ALTER TABLE "Game" ADD COLUMN     "currentClueCount" INTEGER,
ADD COLUMN     "currentClueWord" TEXT,
ADD COLUMN     "guessesMadeThisTurn" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "maxGuessesThisTurn" INTEGER,
ADD COLUMN     "phase" "GamePhase" NOT NULL DEFAULT 'waiting_for_clue',
ADD COLUMN     "turnTeam" "TurnTeam" NOT NULL DEFAULT 'red';

-- CreateTable
CREATE TABLE "RoomWordCategory" (
    "id" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "category" "WordCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RoomWordCategory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RoomWordCategory_category_idx" ON "RoomWordCategory"("category");

-- CreateIndex
CREATE UNIQUE INDEX "RoomWordCategory_roomId_category_key" ON "RoomWordCategory"("roomId", "category");

-- AddForeignKey
ALTER TABLE "RoomWordCategory" ADD CONSTRAINT "RoomWordCategory_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;

