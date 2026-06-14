import { describe, expect, it } from "vitest";
import {
  canGuess,
  canSubmitClue,
  classifyReveal,
  deriveWinner,
  FACTION_COUNTS,
  generateCards,
  shouldEndTurnAfterReveal
} from "../src/game";

describe("generateCards", () => {
  it("creates a stable 25-card board with the expected faction counts", () => {
    const ids = Array.from({ length: 100 }, (_, index) => index + 1);
    const first = generateCards(ids, "stormlight");
    const second = generateCards(ids, "stormlight");

    expect(first).toEqual(second);
    expect(first).toHaveLength(25);
    expect(new Set(first.map((card) => card.wordEntryId)).size).toBe(25);

    const counts = Object.fromEntries(
      Object.keys(FACTION_COUNTS).map((faction) => [
        faction,
        first.filter((card) => card.faction === faction).length
      ])
    );
    expect(counts).toEqual(FACTION_COUNTS);
  });

  it("requires enough words for a board", () => {
    expect(() => generateCards([1, 2, 3], "tiny")).toThrow(/At least 25/);
  });
});

describe("strict turn helpers", () => {
  it("allows only current-team spies to submit clues", () => {
    expect(canSubmitClue({ team: "red", canSpy: true }, "red")).toBe(true);
    expect(canSubmitClue({ team: "blue", canSpy: true }, "red")).toBe(false);
    expect(canSubmitClue({ team: "red", canSpy: false }, "red")).toBe(false);
    expect(canSubmitClue({ team: "spectator", canSpy: true }, "red")).toBe(false);
  });

  it("allows only current-team non-spies to guess", () => {
    expect(canGuess({ team: "red", canSpy: false }, "red")).toBe(true);
    expect(canGuess({ team: "red", canSpy: true }, "red")).toBe(false);
    expect(canGuess({ team: "blue", canSpy: false }, "red")).toBe(false);
  });

  it("ends turns on wrong colors or max guesses", () => {
    expect(shouldEndTurnAfterReveal({ revealedFaction: "red", turnTeam: "red", guessesMade: 1, maxGuesses: 3 })).toBe(false);
    expect(shouldEndTurnAfterReveal({ revealedFaction: "blue", turnTeam: "red", guessesMade: 1, maxGuesses: 3 })).toBe(true);
    expect(shouldEndTurnAfterReveal({ revealedFaction: "neutral", turnTeam: "red", guessesMade: 1, maxGuesses: 3 })).toBe(true);
    expect(shouldEndTurnAfterReveal({ revealedFaction: "red", turnTeam: "red", guessesMade: 3, maxGuesses: 3 })).toBe(true);
  });
});

describe("classifyReveal", () => {
  it("labels each reveal outcome relative to the guessing team", () => {
    expect(classifyReveal("red", "red")).toBe("correct");
    expect(classifyReveal("blue", "red")).toBe("enemy");
    expect(classifyReveal("neutral", "red")).toBe("neutral");
    expect(classifyReveal("assassin", "red")).toBe("assassin");
  });
});

describe("deriveWinner", () => {
  it("returns null while the game is unfinished", () => {
    expect(deriveWinner({ phase: "guessing", redRemaining: 3, blueRemaining: 2, turnTeam: "red" })).toBeNull();
  });

  it("awards the win to whichever team is cleared first", () => {
    expect(deriveWinner({ phase: "finished", redRemaining: 0, blueRemaining: 2, turnTeam: "red" })).toBe("red");
    expect(deriveWinner({ phase: "finished", redRemaining: 4, blueRemaining: 0, turnTeam: "red" })).toBe("blue");
  });

  it("makes the assassin-flipping team lose (opponent wins)", () => {
    // 红队回合翻到刺客，双方都还有剩余 → 蓝队获胜
    expect(deriveWinner({ phase: "finished", redRemaining: 3, blueRemaining: 4, turnTeam: "red" })).toBe("blue");
    expect(deriveWinner({ phase: "finished", redRemaining: 3, blueRemaining: 4, turnTeam: "blue" })).toBe("red");
  });
});
