export type Faction = "red" | "blue" | "neutral" | "assassin";

export type Team = "red" | "blue" | "spectator";

export type TurnTeam = "red" | "blue";

export type GamePhase = "waiting_for_clue" | "guessing" | "finished";

export type RoomStatus = "lobby" | "playing" | "finished";

export type GameStatus = "active" | "finished";

export interface WordEntrySeed {
  archiveName: string;
  categoryName: string;
  textCn: string;
  textEnOrNote: string;
  sourceSheet: string;
  sourceRow: number;
  enabled: boolean;
}

export interface GeneratedCard<TWordId extends string | number = string> {
  wordEntryId: TWordId;
  position: number;
  faction: Faction;
}

export interface PublicCard {
  id: string;
  position: number;
  textCn: string;
  textEnOrNote: string;
  revealed: boolean;
  faction?: Faction;
}

export interface WordCategoryNode {
  id: string;
  name: string;
  archiveId: string;
  archiveName: string;
  count: number;
}

export interface WordArchiveNode {
  id: string;
  name: string;
  categories: WordCategoryNode[];
}

export interface RoomSnapshot {
  roomCode: string;
  status: RoomStatus;
  currentGameId: string | null;
  viewerIsOwner: boolean;
  selectedCategoryIds: string[];
  categoryTree: WordArchiveNode[];
  members: Array<{
    userId: string;
    email: string;
    username: string;
    team: Team;
    canSpy: boolean;
    isOwner: boolean;
  }>;
  game: null | {
    id: string;
    redRemaining: number;
    blueRemaining: number;
    turnTeam: TurnTeam;
    phase: GamePhase;
    winnerTeam: TurnTeam | null;
    currentClue: null | {
      word: string;
      count: number;
    };
    guessesMadeThisTurn: number;
    maxGuessesThisTurn: number | null;
    cards: PublicCard[];
  };
}

export type GuessOutcome = "correct" | "neutral" | "enemy" | "assassin";

/** card:revealed 实时事件附带的额外字段（叠加在 RoomSnapshot 之上）。 */
export interface CardRevealedExtra {
  revealedCardId: string;
  revealedFaction: Faction;
  outcome: GuessOutcome;
  guessTeam: TurnTeam;
  winnerTeam: TurnTeam | null;
}
