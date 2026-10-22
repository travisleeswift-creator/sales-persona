import {
  CATEGORY_LABELS,
  DIMENSION_LABELS,
  DIMENSIONS,
  OFFER,
  type Dimension,
  type DimensionScores,
  type PersonaDefinition,
} from "@/lib/domain";
import type { ScoreResult } from "@/server/engine/scoring";

const COACHING: Record<Dimension, string> = {
  acknowledgement: "Play the objection back in their words before you answer it.",
  empathy: "Name the pressure this buyer actually feels. A generic sorry will not land.",
  reframe: "Bridge with 'the difference is' or 'which means', and tie it to something they gain.",
  evidence: "Give a number, a time frame, and one concrete example from a venue like theirs.",
  question: "End with a real question that moves the sale, not a speech.",
  close: "Ask for a dated two-week trial. Do not wait for them to invent the next step.",
  relevance: "Stay on the objection they just raised. Answer that, not a different pitch.",
};

export function weakestDimensions(dimensions: DimensionScores): Dimension[] {
  return [...DIMENSIONS].sort((left, right) => dimensions[left] - dimensions[right] || left.localeCompare(right));
}

export function buildFeedback(input: {
  persona: PersonaDefinition;
  objectionText: string;
  category: keyof typeof CATEGORY_LABELS;
  painLabel: string;
  score: ScoreResult;
}): string {
  const weakest = weakestDimensions(input.score.dimensions).slice(0, 2);
  const trigger = input.persona.buyingTriggers[0];
  const lines = [
    `${input.persona.name} pushed on ${CATEGORY_LABELS[input.category].toLowerCase()} (${input.painLabel.toLowerCase()}). This reply scored ${input.score.overall}.`,
    `The thin spots are ${weakest.map((dimension) => DIMENSION_LABELS[dimension].toLowerCase()).join(" and ")}. ${weakest.map((dimension) => COACHING[dimension]).join(" ")}`,
  ];
  if (input.score.dismissive) {
    lines.push("Do not argue the buyer down. A line like 'you're wrong' closes the conversation, not the sale.");
  }
  if (input.score.tooShort) {
    lines.push("This was too short to handle the objection. Acknowledgement, one proof, and a question need a few sentences.");
  }
  if (trigger) {
    lines.push(
      `A lever on this counter is ${trigger.label.toLowerCase()}: ${trigger.detail} You are selling ${OFFER.name}, ${OFFER.trial}.`,
    );
  }
  lines.push(`They said: "${input.objectionText}" Answer that sentence, then ask for the next step.`);
  return lines.join(" ");
}
