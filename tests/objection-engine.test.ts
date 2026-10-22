import { afterEach, describe, expect, it } from "vitest";
import { emptyScores, OBJECTION_CATEGORIES, PERSONA_IDS } from "@/lib/domain";
import { unlockedAchievementIds } from "@/server/engine/achievements";
import { withOptionalLlm } from "@/server/engine/llm";
import {
  chooseObjection,
  createInitialState,
  openingLine,
  reduceTurn,
  runUserTurn,
} from "@/server/engine/objection-engine";
import { PERSONAS } from "@/server/personas/definitions";
import { validatePersona } from "@/server/personas/validate";
import { strongReply, WEAK_REPLY } from "./helpers";

const burger = PERSONAS.find((persona) => persona.id === "burger-bar");
if (!burger) throw new Error("Burger Bar missing");

describe("objection engine", () => {
  it("ships seven complete personas with every required part", () => {
    expect(PERSONAS.map((persona) => persona.id)).toEqual([...PERSONA_IDS]);
    for (const persona of PERSONAS) {
      expect(validatePersona(persona)).toEqual([]);
      expect(new Set(persona.objectionPatterns.map((objection) => objection.category))).toEqual(new Set(OBJECTION_CATEGORIES));
      expect(persona.buyingTriggers.length).toBeGreaterThanOrEqual(4);
      expect(persona.painPoints.length).toBeGreaterThanOrEqual(4);
      expect(persona.closingSignals.length).toBeGreaterThanOrEqual(3);
      expect(persona.difficultyScaling.hard.stacksConcerns).toBe(true);
      expect(persona.conversationStyle.greeting.length).toBeGreaterThan(20);
    }
    const ids = PERSONAS.flatMap((persona) => persona.objectionPatterns.map((objection) => objection.id));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("picks a deterministic opening inside the difficulty ceiling", () => {
    const first = createInitialState(burger, "easy", 0);
    const again = createInitialState(burger, "easy", 0);
    const other = createInitialState(burger, "easy", 1);
    expect(first.objection.id).toBe(again.objection.id);
    expect(other.objection.id).not.toBe(first.objection.id);
    expect(first.objection.intensity).toBeLessThanOrEqual(burger.difficultyScaling.easy.intensityCeiling);
    expect(openingLine(burger, first)).toContain(first.objection.text);
    for (const persona of PERSONAS) {
      const hard = createInitialState(persona, "hard", 4);
      expect(hard.objection.intensity).toBeGreaterThanOrEqual(2);
      expect(hard.objection.intensity).toBeLessThanOrEqual(persona.difficultyScaling.hard.intensityCeiling);
    }
  });

  it("escalates, stacks on hard, and loses a second weak reply", () => {
    const opened = createInitialState(burger, "hard", 2);
    const escalated = reduceTurn({
      persona: burger,
      difficulty: "hard",
      state: opened,
      classification: "weak",
      closeScore: 0,
      userText: WEAK_REPLY,
      seed: 3,
    });
    expect(escalated.state.phase).toBe("escalated");
    expect(escalated.state.everEscalated).toBe(true);
    expect(escalated.personaReply).toContain("On top of that");
    expect(escalated.personaReply).toContain(opened.objection.escalationText);
    const easy = reduceTurn({
      persona: burger,
      difficulty: "easy",
      state: createInitialState(burger, "easy", 2),
      classification: "weak",
      closeScore: 0,
      userText: WEAK_REPLY,
      seed: 3,
    });
    expect(easy.personaReply).not.toContain("On top of that");
    const lost = reduceTurn({
      persona: burger,
      difficulty: "hard",
      state: escalated.state,
      classification: "weak",
      closeScore: 0,
      userText: WEAK_REPLY,
      seed: 4,
    });
    expect(lost.finished).toBe(true);
    expect(lost.state.outcome).toBe("lost");
    expect(lost.personaReply).toBe(burger.conversationStyle.lostLine);
  });

  it("advances early on medium and makes hard earn four objections before the close", () => {
    let state = createInitialState(burger, "medium", 0);
    state = reduceTurn({ persona: burger, difficulty: "medium", state, classification: "strong", closeScore: 90, userText: "Noted.", seed: 1 }).state;
    expect(state.phase).toBe("softening");
    const closing = reduceTurn({ persona: burger, difficulty: "medium", state, classification: "strong", closeScore: 90, userText: "Noted.", seed: 2 });
    expect(closing.state.phase).toBe("closing");
    expect(burger.closingSignals.some((signal) => closing.personaReply.includes(signal.phrase))).toBe(true);
    const won = reduceTurn({
      persona: burger,
      difficulty: "medium",
      state: closing.state,
      classification: "strong",
      closeScore: 90,
      userText: "Noted.",
      seed: 3,
    });
    expect(won.state.outcome).toBe("won");
    expect(won.personaReply).toBe(burger.conversationStyle.wonLine);

    let hard = createInitialState(burger, "hard", 1);
    for (let turn = 0; turn < 3; turn += 1) {
      hard = reduceTurn({ persona: burger, difficulty: "hard", state: hard, classification: "strong", closeScore: 90, userText: "Noted.", seed: turn }).state;
      expect(hard.phase).not.toBe("closing");
    }
    hard = reduceTurn({ persona: burger, difficulty: "hard", state: hard, classification: "strong", closeScore: 90, userText: "Noted.", seed: 8 }).state;
    expect(hard.phase).toBe("closing");
  });

  it("remembers a comeback and interrupts a long speech", () => {
    const escalated = reduceTurn({
      persona: burger,
      difficulty: "medium",
      state: createInitialState(burger, "medium", 1),
      classification: "weak",
      closeScore: 0,
      userText: WEAK_REPLY,
      seed: 1,
    });
    const recovered = reduceTurn({
      persona: burger,
      difficulty: "medium",
      state: escalated.state,
      classification: "strong",
      closeScore: 40,
      userText: "Noted.",
      seed: 2,
    });
    expect(recovered.state.recoveredFromEscalation).toBe(true);
    const longWinded = Array.from({ length: 80 }, () => "detail").join(" ");
    const interrupted = reduceTurn({
      persona: burger,
      difficulty: "medium",
      state: createInitialState(burger, "medium", 5),
      classification: "mixed",
      closeScore: 10,
      userText: longWinded,
      seed: 6,
    });
    expect(interrupted.personaReply.startsWith("I'll stop you there.")).toBe(true);
  });

  it("runs the scorer and the state machine together", () => {
    const state = createInitialState(burger, "medium", 0);
    const strong = runUserTurn({
      persona: burger,
      difficulty: "medium",
      state,
      userText: strongReply(state.objection.keywords),
      seed: 4,
    });
    expect(strong.score.band).toBe("strong");
    expect(strong.feedback).toContain(burger.name);
    const weak = runUserTurn({ persona: burger, difficulty: "medium", state, userText: WEAK_REPLY, seed: 4 });
    expect(weak.score.band).toBe("weak");
    expect(weak.result.state.phase).toBe("escalated");
  });

  it("does not repeat an objection until the catalogue is used", () => {
    const used = ["burger-bar-price"];
    const next = chooseObjection(burger, "medium", used, 0, "burger-bar-price");
    expect(next.id).not.toBe("burger-bar-price");
  });

  it("falls back when the model is missing or fails, and uses it when it answers", async () => {
    const rules = await withOptionalLlm({
      draft: "No.",
      personaName: "Pub",
      voiceSummary: "Dry.",
      phase: "probing",
      objection: "price",
    });
    expect(rules).toEqual({ text: "No.", source: "rules" });

    process.env.OPENAI_API_KEY = "test-key";
    try {
      const failed = await withOptionalLlm({
        draft: "No.",
        personaName: "Pub",
        voiceSummary: "Dry.",
        phase: "probing",
        objection: "price",
        fetchImpl: (async () => {
          throw new Error("offline");
        }) as typeof fetch,
      });
      expect(failed.source).toBe("rules");
      const rewritten = await withOptionalLlm({
        draft: "No.",
        personaName: "Club",
        voiceSummary: "Blunt.",
        phase: "escalated",
        objection: "price",
        fetchImpl: (async () =>
          new Response(JSON.stringify({ choices: [{ message: { content: "Two nights pay the week. Your fee does not." } }] }), {
            status: 200,
          })) as typeof fetch,
      });
      expect(rewritten).toEqual({ text: "Two nights pay the week. Your fee does not.", source: "llm" });
    } finally {
      delete process.env.OPENAI_API_KEY;
    }
  });

  it("unlocks badges from a finished record", () => {
    const ids = unlockedAchievementIds({
      completed: [
        {
          personaId: "burger-bar",
          difficulty: "hard",
          outcome: "won",
          overall: 88,
          dimensions: { ...emptyScores(), empathy: 90, close: 92, acknowledgement: 95 },
          recoveredFromEscalation: true,
        },
      ],
      categoriesFaced: [...OBJECTION_CATEGORIES],
      hardObjectionHits: 5,
      bestAcknowledgement: 95,
    });
    expect(ids).toEqual(expect.arrayContaining(["first_session", "high_score", "deal_closed", "hard_shift", "comeback", "empathy", "closer", "five_hard", "ack", "all_categories"]));
    expect(ids).not.toContain("full_floor");
    expect(ids).not.toContain("streak");
  });
});

afterEach(() => {
  delete process.env.OPENAI_API_KEY;
});
