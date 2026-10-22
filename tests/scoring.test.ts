import { describe, expect, it } from "vitest";
import { PERSONAS } from "@/server/personas/definitions";
import {
  classifyScore,
  isDismissive,
  scoreAcknowledgement,
  scoreClose,
  scoreEvidence,
  scoreQuestion,
  scoreRelevance,
  scoreResponse,
  weightedOverall,
} from "@/server/engine/scoring";
import { buildFeedback, weakestDimensions } from "@/server/engine/feedback";
import { strongReply, WEAK_REPLY } from "./helpers";

const burger = PERSONAS.find((persona) => persona.id === "burger-bar");
if (!burger) throw new Error("Burger Bar missing");

const price = burger.objectionPatterns.find((objection) => objection.category === "price");
if (!price) throw new Error("Price objection missing");

describe("scoring", () => {
  it("scores a full reply as strong and keeps the weighted total when there is no penalty", () => {
    const result = scoreResponse({
      text: strongReply(price.keywords),
      keywords: price.keywords,
      triggerPhrases: burger.buyingTriggers.flatMap((trigger) => trigger.phrases),
      thresholds: burger.difficultyScaling.medium,
    });
    expect(result.dismissive).toBe(false);
    expect(result.tooShort).toBe(false);
    expect(result.dimensions.acknowledgement).toBeGreaterThanOrEqual(90);
    expect(result.dimensions.evidence).toBeGreaterThanOrEqual(90);
    expect(result.dimensions.close).toBeGreaterThanOrEqual(90);
    expect(result.dimensions.question).toBeGreaterThanOrEqual(80);
    expect(result.overall).toBe(weightedOverall(result.dimensions));
    expect(result.band).toBe("strong");
  });

  it("caps a short reply and punishes a dismissive one", () => {
    const polite = scoreResponse({
      text: strongReply(["fee"]),
      keywords: ["fee", "saturday", "money"],
      triggerPhrases: [],
      thresholds: burger.difficultyScaling.medium,
    });
    const rude = scoreResponse({
      text: `That's not true, you're wrong. ${strongReply(["fee"])}`,
      keywords: ["fee", "saturday", "money"],
      triggerPhrases: [],
      thresholds: burger.difficultyScaling.medium,
    });
    const tiny = scoreResponse({
      text: WEAK_REPLY,
      keywords: price.keywords,
      triggerPhrases: [],
      thresholds: burger.difficultyScaling.medium,
    });
    expect(isDismissive("you're wrong about the fee")).toBe(true);
    expect(rude.dismissive).toBe(true);
    expect(rude.overall).toBeLessThan(polite.overall);
    expect(rude.dimensions.empathy).toBeLessThanOrEqual(20);
    expect(tiny.tooShort).toBe(true);
    expect(tiny.overall).toBeLessThanOrEqual(20);
    expect(tiny.band).toBe("weak");
  });

  it("scores the pieces independently", () => {
    expect(scoreAcknowledgement("I hear you on the fee", ["fee"])).toBe(100);
    expect(scoreAcknowledgement("hello there friend", ["fee"])).toBe(0);
    expect(scoreQuestion("Can we talk")).toBe(0);
    expect(scoreQuestion("How does the Saturday rush actually look for the pass?")).toBe(85);
    expect(scoreQuestion("How?")).toBe(65);
    expect(scoreEvidence("one shop saved 6 minutes in a month")).toBe(100);
    expect(scoreEvidence("it is nice")).toBe(0);
    expect(scoreClose("Can we start a two-week trial next Saturday?")).toBe(100);
    expect(scoreRelevance("nothing relevant here", ["oil", "fryer"])).toBe(10);
    expect(scoreRelevance("The oil and the fryer both matter here", ["oil", "fryer"])).toBe(75);
  });

  it("raises the bar as difficulty increases", () => {
    expect(classifyScore(80, burger.difficultyScaling.easy)).toBe("strong");
    expect(classifyScore(80, burger.difficultyScaling.medium)).toBe("strong");
    expect(classifyScore(80, burger.difficultyScaling.hard)).toBe("mixed");
    expect(classifyScore(30, burger.difficultyScaling.easy)).toBe("weak");
  });

  it("names the weakest dimensions in the coaching note", () => {
    const score = scoreResponse({
      text: WEAK_REPLY,
      keywords: price.keywords,
      triggerPhrases: [],
      thresholds: burger.difficultyScaling.medium,
    });
    const feedback = buildFeedback({
      persona: burger,
      objectionText: price.text,
      category: "price",
      painLabel: "Agency staff",
      score,
    });
    const weakest = weakestDimensions(score.dimensions)[0];
    expect(weakest).toBeTruthy();
    expect(feedback).toContain("Burger Bar");
    expect(feedback).toContain("price");
    expect(feedback.toLowerCase()).toContain("acknowledgement");
    expect(feedback).toContain(price.text);
  });
});
