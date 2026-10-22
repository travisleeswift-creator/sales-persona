import type {
  ActiveObjection,
  Difficulty,
  ObjectionTemplate,
  PersonaDefinition,
  SessionState,
} from "@/lib/domain";
import { buildFeedback } from "@/server/engine/feedback";
import { CATEGORY_LEXICON, scoreResponse, type ScoreResult } from "@/server/engine/scoring";

export type TurnResult = {
  state: SessionState;
  personaReply: string;
  finished: boolean;
};

export function hashSeed(parts: Array<string | number>): number {
  let hash = 2166136261;
  const value = parts.join("|");
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function pick<T>(items: readonly T[], seed: number): T {
  if (items.length === 0) throw new Error("Cannot pick from an empty list");
  const index = seed % items.length;
  const item = items[index];
  if (item === undefined) throw new Error("Pick missed the list");
  return item;
}

export function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function templateToActive(template: ObjectionTemplate): ActiveObjection {
  return {
    id: template.id,
    category: template.category,
    intensity: template.intensity,
    text: template.text,
    keywords: template.keywords,
    painPointId: template.painPointId,
    templateText: template.text,
    escalationText: template.escalationText,
    probeText: template.probeText,
    softenText: template.softenText,
  };
}

export function chooseObjection(
  persona: PersonaDefinition,
  difficulty: Difficulty,
  usedIds: string[],
  seed: number,
  currentId?: string,
): ObjectionTemplate {
  const ceiling = persona.difficultyScaling[difficulty].intensityCeiling;
  const unused = (template: ObjectionTemplate) => !usedIds.includes(template.id);
  const withinCeiling = (template: ObjectionTemplate) => template.intensity <= ceiling;
  const hardFloor = (template: ObjectionTemplate) => difficulty !== "hard" || template.intensity >= 2;
  let pool = persona.objectionPatterns.filter((template) => unused(template) && withinCeiling(template) && hardFloor(template));
  if (pool.length === 0) {
    pool = persona.objectionPatterns.filter((template) => unused(template) && withinCeiling(template));
  }
  if (pool.length === 0) {
    pool = persona.objectionPatterns.filter((template) => template.id !== currentId);
  }
  if (pool.length === 0) pool = [...persona.objectionPatterns];
  const sorted = [...pool].sort((left, right) => left.id.localeCompare(right.id));
  return pick(sorted, seed);
}

export function createInitialState(persona: PersonaDefinition, difficulty: Difficulty, seed: number): SessionState {
  const objection = chooseObjection(persona, difficulty, [], seed);
  return {
    phase: "opening",
    objection: templateToActive(objection),
    usedObjectionIds: [objection.id],
    consecutiveWeak: 0,
    consecutiveStrong: 0,
    turn: 0,
    escalationLevel: 0,
    everEscalated: false,
    recoveredFromEscalation: false,
    objectionsHandled: 0,
    closingSignalId: null,
    hesitation: 0,
    outcome: "in_progress",
  };
}

export function openingLine(persona: PersonaDefinition, state: SessionState): string {
  return `${persona.conversationStyle.greeting} ${state.objection.text}`;
}

function maybeInterrupt(persona: PersonaDefinition, userText: string, line: string): string {
  const { interruptLine, interruptAfterWords } = persona.conversationStyle;
  if (!interruptLine) return line;
  if (wordCount(userText) < interruptAfterWords) return line;
  return `${interruptLine} ${line}`;
}

export function reduceTurn(input: {
  persona: PersonaDefinition;
  difficulty: Difficulty;
  state: SessionState;
  classification: ScoreResult["band"];
  closeScore: number;
  userText: string;
  seed: number;
}): TurnResult {
  const band = input.persona.difficultyScaling[input.difficulty];
  const style = input.persona.conversationStyle;
  const turn = input.state.turn + 1;
  const used = input.state.usedObjectionIds.includes(input.state.objection.id)
    ? input.state.usedObjectionIds
    : [...input.state.usedObjectionIds, input.state.objection.id];
  const base: SessionState = { ...input.state, turn, usedObjectionIds: used };

  const finish = (outcome: SessionState["outcome"], line: string, extra?: Partial<SessionState>): TurnResult => ({
    finished: true,
    personaReply: line,
    state: { ...base, ...extra, phase: "closed", outcome },
  });

  if (input.classification === "weak") {
    const consecutiveWeak = input.state.consecutiveWeak + 1;
    if (input.state.phase === "escalated" || turn >= band.maxTurns) {
      return finish("lost", style.lostLine, { consecutiveWeak, consecutiveStrong: 0 });
    }
    const intensity = Math.min(band.intensityCeiling, input.state.objection.intensity + 1);
    const otherPains = input.persona.painPoints.filter((pain) => pain.id !== input.state.objection.painPointId);
    const otherPain = pick(otherPains.length > 0 ? otherPains : input.persona.painPoints, input.seed);
    const stacked = band.stacksConcerns ? ` On top of that, ${otherPain.detail}` : "";
    const line = maybeInterrupt(
      input.persona,
      input.userText,
      `${pick(style.escalateLead, input.seed)} ${input.state.objection.escalationText}${stacked}`,
    );
    return {
      finished: false,
      personaReply: line,
      state: {
        ...base,
        phase: "escalated",
        outcome: "in_progress",
        escalationLevel: input.state.escalationLevel + 1,
        everEscalated: true,
        consecutiveWeak,
        consecutiveStrong: 0,
        objection: { ...input.state.objection, intensity, text: input.state.objection.escalationText },
      },
    };
  }

  if (input.classification === "strong") {
    const recovered = input.state.recoveredFromEscalation || input.state.phase === "escalated";
    const consecutiveStrong = input.state.consecutiveStrong + 1;
    const shared = {
      consecutiveStrong,
      consecutiveWeak: 0,
      escalationLevel: 0,
      recoveredFromEscalation: recovered,
    };
    if (input.state.phase === "closing") {
      if (input.closeScore >= band.closeScoreRequired) return finish("won", style.wonLine, shared);
      if (turn >= band.maxTurns || input.state.hesitation >= 1) {
        return finish("partial", style.partialLine, { ...shared, hesitation: input.state.hesitation + 1 });
      }
      return {
        finished: false,
        personaReply: maybeInterrupt(input.persona, input.userText, style.hesitateLine),
        state: { ...base, ...shared, phase: "closing", hesitation: input.state.hesitation + 1, outcome: "in_progress" },
      };
    }

    const handled = input.state.objectionsHandled + 1;
    const ready =
      input.difficulty === "hard"
        ? handled >= band.targetObjections && consecutiveStrong >= 2
        : handled >= band.targetObjections || consecutiveStrong >= 2;

    if (ready) {
      if (turn >= band.maxTurns) {
        if (input.closeScore >= band.closeScoreRequired) return finish("won", style.wonLine, { ...shared, objectionsHandled: handled });
        return finish("partial", style.partialLine, { ...shared, objectionsHandled: handled });
      }
      const signal = pick(input.persona.closingSignals, input.seed);
      const line = maybeInterrupt(
        input.persona,
        input.userText,
        `${pick(style.closingLead, input.seed)} ${pick(style.softenLead, input.seed + 1)} ${input.state.objection.softenText} ${signal.phrase}`,
      );
      return {
        finished: false,
        personaReply: line,
        state: {
          ...base,
          ...shared,
          phase: "closing",
          objectionsHandled: handled,
          closingSignalId: signal.id,
          outcome: "in_progress",
        },
      };
    }

    if (turn >= band.maxTurns) return finish("partial", style.partialLine, { ...shared, objectionsHandled: handled });

    const next = chooseObjection(input.persona, input.difficulty, used, input.seed, input.state.objection.id);
    return {
      finished: false,
      personaReply: maybeInterrupt(
        input.persona,
        input.userText,
        `${pick(style.nextLead, input.seed)} ${next.text}`,
      ),
      state: {
        ...base,
        ...shared,
        phase: "softening",
        objectionsHandled: handled,
        usedObjectionIds: used.includes(next.id) ? used : [...used, next.id],
        objection: templateToActive(next),
        outcome: "in_progress",
      },
    };
  }

  if (turn >= band.maxTurns) {
    return finish("partial", style.partialLine, { consecutiveStrong: 0, consecutiveWeak: 0 });
  }
  return {
    finished: false,
    personaReply: maybeInterrupt(
      input.persona,
      input.userText,
      `${pick(style.probeLead, input.seed)} ${input.state.objection.probeText}`,
    ),
    state: {
      ...base,
      phase: "probing",
      consecutiveStrong: 0,
      consecutiveWeak: 0,
      outcome: "in_progress",
    },
  };
}

export function keywordsForObjection(persona: PersonaDefinition, state: SessionState): string[] {
  const pain = persona.painPoints.find((item) => item.id === state.objection.painPointId);
  return [...state.objection.keywords, ...CATEGORY_LEXICON[state.objection.category], ...(pain?.keywords ?? [])];
}

export function runUserTurn(input: {
  persona: PersonaDefinition;
  difficulty: Difficulty;
  state: SessionState;
  userText: string;
  seed: number;
}): { score: ScoreResult; result: TurnResult; feedback: string } {
  const pain = input.persona.painPoints.find((item) => item.id === input.state.objection.painPointId);
  const score = scoreResponse({
    text: input.userText,
    keywords: keywordsForObjection(input.persona, input.state),
    triggerPhrases: input.persona.buyingTriggers.flatMap((trigger) => trigger.phrases),
    thresholds: input.persona.difficultyScaling[input.difficulty],
  });
  const result = reduceTurn({
    persona: input.persona,
    difficulty: input.difficulty,
    state: input.state,
    classification: score.band,
    closeScore: score.dimensions.close,
    userText: input.userText,
    seed: input.seed,
  });
  const feedback = buildFeedback({
    persona: input.persona,
    objectionText: input.state.objection.text,
    category: input.state.objection.category,
    painLabel: pain?.label ?? "the objection",
    score,
  });
  return { score, result, feedback };
}
