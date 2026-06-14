import type { Faction, GamePhase, GeneratedCard, GuessOutcome, Team, TurnTeam } from "./types";

export const BOARD_SIZE = 25;

export const FACTION_COUNTS: Record<Faction, number> = {
  red: 9,
  blue: 8,
  neutral: 7,
  assassin: 1
};

export function createSeededRandom(seed: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }

  return () => {
    h += h << 13;
    h ^= h >>> 7;
    h += h << 3;
    h ^= h >>> 17;
    h += h << 5;
    return (h >>> 0) / 4294967296;
  };
}

export function shuffleWithSeed<T>(items: readonly T[], seed: string): T[] {
  const random = createSeededRandom(seed);
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function buildFactionDeck(seed: string): Faction[] {
  const deck = Object.entries(FACTION_COUNTS).flatMap(([faction, count]) =>
    Array.from({ length: count }, () => faction as Faction)
  );
  return shuffleWithSeed(deck, `${seed}:factions`);
}

export function generateCards<TWordId extends string | number>(
  wordIds: readonly TWordId[],
  seed: string
): GeneratedCard<TWordId>[] {
  if (wordIds.length < BOARD_SIZE) {
    throw new Error(`At least ${BOARD_SIZE} words are required to start a game.`);
  }

  const selectedWords = shuffleWithSeed(wordIds, `${seed}:words`).slice(0, BOARD_SIZE);
  const factions = buildFactionDeck(seed);

  return selectedWords.map((wordEntryId, position) => ({
    wordEntryId,
    position,
    faction: factions[position]
  }));
}

export function countRemaining(cards: Array<{ faction: Faction; revealed: boolean }>) {
  return cards.reduce(
    (remaining, card) => {
      if (!card.revealed) return remaining;
      if (card.faction === "red") remaining.redRemaining -= 1;
      if (card.faction === "blue") remaining.blueRemaining -= 1;
      return remaining;
    },
    { redRemaining: FACTION_COUNTS.red, blueRemaining: FACTION_COUNTS.blue }
  );
}

export function nextTurnTeam(team: TurnTeam): TurnTeam {
  return team === "red" ? "blue" : "red";
}

export function canMemberSpy(member: { team: Team; canSpy: boolean }): member is { team: TurnTeam; canSpy: true } {
  return member.canSpy && (member.team === "red" || member.team === "blue");
}

export function canSubmitClue(member: { team: Team; canSpy: boolean }, turnTeam: TurnTeam) {
  return canMemberSpy(member) && member.team === turnTeam;
}

export function canGuess(member: { team: Team; canSpy: boolean }, turnTeam: TurnTeam) {
  return member.team === turnTeam && !member.canSpy;
}

export function shouldEndTurnAfterReveal({
  revealedFaction,
  turnTeam,
  guessesMade,
  maxGuesses
}: {
  revealedFaction: Faction;
  turnTeam: TurnTeam;
  guessesMade: number;
  maxGuesses: number | null;
}) {
  if (revealedFaction === "assassin") return false;
  if (revealedFaction === "neutral") return true;
  if (revealedFaction !== turnTeam) return true;
  return maxGuesses != null && guessesMade >= maxGuesses;
}

/**
 * 把一次翻牌结果分类，供前端做差异化特效/音效。
 * correct=翻到本队色；neutral=中立；enemy=翻到对方色；assassin=刺客(炸弹)。
 */
export function classifyReveal(revealedFaction: Faction, guessTeam: TurnTeam): GuessOutcome {
  if (revealedFaction === "assassin") return "assassin";
  if (revealedFaction === "neutral") return "neutral";
  return revealedFaction === guessTeam ? "correct" : "enemy";
}

/**
 * 由对局当前状态推导胜方，无需在数据库中额外存字段。
 * - 某队剩余为 0 → 该队获胜（含被对方翻光的情形）。
 * - 其余 finished（即踩到刺客）→ 翻牌方(当前回合队)判负，另一队获胜。
 * - 未结束返回 null。
 */
export function deriveWinner(state: {
  phase: GamePhase;
  redRemaining: number;
  blueRemaining: number;
  turnTeam: TurnTeam;
}): TurnTeam | null {
  if (state.phase !== "finished") return null;
  if (state.redRemaining <= 0) return "red";
  if (state.blueRemaining <= 0) return "blue";
  return nextTurnTeam(state.turnTeam);
}
