import type { Faction, GeneratedCard, Team, TurnTeam } from "./types";

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
