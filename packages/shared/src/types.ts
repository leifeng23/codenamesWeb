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

/** 房间操作日志条目（服务端已过滤为可公开字段，seed 等敏感信息不会下发）。 */
export interface RoomEventSummary {
  id: string;
  type: string;
  createdAt: string;
  actorName: string | null;
  gameId: string | null;
  data: {
    clueWord?: string;
    clueCount?: number;
    turnTeam?: TurnTeam;
    faction?: Faction;
    position?: number;
    turnEnded?: boolean;
    gameFinished?: boolean;
    reason?: string;
    nextTurnTeam?: TurnTeam;
    winnerTeam?: TurnTeam | null;
    targetName?: string;
    team?: Team;
    canSpy?: boolean;
    categoryCount?: number;
  };
}

export interface RoomSnapshot {
  roomCode: string;
  status: RoomStatus;
  currentGameId: string | null;
  viewerIsOwner: boolean;
  selectedCategoryIds: string[];
  categoryTree: WordArchiveNode[];
  recentEvents: RoomEventSummary[];
  members: Array<{
    userId: string;
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

/**
 * 队内聊天消息（不落库，仅向在线成员广播）。
 * 可见范围：发送者本队（含本队间谍）+ 旁观者；间谍与旁观者只读。
 */
export interface TeamChatMessage {
  id: string;
  team: TurnTeam;
  userId: string;
  username: string;
  text: string;
  at: string;
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
