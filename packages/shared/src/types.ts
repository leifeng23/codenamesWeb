export type Faction = "red" | "blue" | "neutral" | "assassin";

export type Team = "red" | "blue" | "spectator";

export type Universe = "cosmere" | "cytonic" | "qq";

export type TurnTeam = "red" | "blue";

export type GamePhase = "waiting_for_clue" | "guessing" | "finished";

export type WordCategory =
  | "cosmere_characters"
  | "cosmere_culture"
  | "cosmere_lifeforms"
  | "cosmere_locations"
  | "cosmere_magic"
  | "cosmere_object_material"
  | "cytonic_characters"
  | "cytonic_spots"
  | "cytonic_concepts"
  | "qq_friends";

export type RoomStatus = "lobby" | "playing" | "finished";

export type GameStatus = "active" | "finished";

export interface WordEntrySeed {
  universe: Universe;
  category: WordCategory;
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

export interface RoomSnapshot {
  roomCode: string;
  status: RoomStatus;
  currentGameId: string | null;
  viewerIsOwner: boolean;
  selectedCategories: WordCategory[];
  categoryCounts: Partial<Record<WordCategory, number>>;
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
    currentClue: null | {
      word: string;
      count: number;
    };
    guessesMadeThisTurn: number;
    maxGuessesThisTurn: number | null;
    cards: PublicCard[];
  };
}
