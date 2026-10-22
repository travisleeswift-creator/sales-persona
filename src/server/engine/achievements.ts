import {
  OBJECTION_CATEGORIES,
  PERSONA_IDS,
  type Difficulty,
  type DimensionScores,
  type ObjectionCategory,
  type Outcome,
  type PersonaId,
} from "@/lib/domain";

export type AchievementDefinition = {
  id: string;
  name: string;
  description: string;
  badgeKey: string;
  criteria: Record<string, string | number>;
};

export const ACHIEVEMENTS: AchievementDefinition[] = [
  {
    id: "first_session",
    name: "First sitting",
    description: "Finish your first training session, whatever the result.",
    badgeKey: "seat",
    criteria: { type: "sessions_completed", count: 1 },
  },
  {
    id: "high_score",
    name: "Steady hand",
    description: "Finish a session at 80 or above.",
    badgeKey: "steady",
    criteria: { type: "score_at_least", score: 80 },
  },
  {
    id: "deal_closed",
    name: "Counter closed",
    description: "Win a session by earning the trial.",
    badgeKey: "close",
    criteria: { type: "outcome", outcome: "won" },
  },
  {
    id: "full_floor",
    name: "Full floor",
    description: "Finish a session with every persona.",
    badgeKey: "floor",
    criteria: { type: "all_personas", count: PERSONA_IDS.length },
  },
  {
    id: "hard_shift",
    name: "Hard shift",
    description: "Finish a hard session at 70 or above.",
    badgeKey: "hard",
    criteria: { type: "hard_score", score: 70 },
  },
  {
    id: "comeback",
    name: "Comeback",
    description: "Win a session after the buyer has escalated.",
    badgeKey: "comeback",
    criteria: { type: "comeback_win" },
  },
  {
    id: "empathy",
    name: "Good ear",
    description: "Average 85 or more on empathy in a finished session.",
    badgeKey: "ear",
    criteria: { type: "dimension", dimension: "empathy", score: 85 },
  },
  {
    id: "closer",
    name: "Asked for it",
    description: "Win a session with a close score of 80 or more.",
    badgeKey: "ask",
    criteria: { type: "closer", score: 80 },
  },
  {
    id: "five_hard",
    name: "Thick skin",
    description: "Handle five high-intensity objections at 70 or more.",
    badgeKey: "skin",
    criteria: { type: "hard_objections", count: 5, score: 70 },
  },
  {
    id: "streak",
    name: "Three on the trot",
    description: "Finish three sessions in a row at 50 or above.",
    badgeKey: "streak",
    criteria: { type: "streak", count: 3, score: 50 },
  },
  {
    id: "ack",
    name: "Played it back",
    description: "Score 90 or more on acknowledgement in a single reply.",
    badgeKey: "ack",
    criteria: { type: "single_dimension", dimension: "acknowledgement", score: 90 },
  },
  {
    id: "all_categories",
    name: "Every pushback",
    description: "Face every objection category.",
    badgeKey: "all",
    criteria: { type: "all_categories", count: OBJECTION_CATEGORIES.length },
  },
];

export type CompletedSitting = {
  personaId: PersonaId;
  difficulty: Difficulty;
  outcome: Outcome;
  overall: number;
  dimensions: DimensionScores;
  recoveredFromEscalation: boolean;
};

export type AchievementSnapshot = {
  completed: CompletedSitting[];
  categoriesFaced: ObjectionCategory[];
  hardObjectionHits: number;
  bestAcknowledgement: number;
};

function trailingStreak(sessions: CompletedSitting[]): number {
  let count = 0;
  for (let index = sessions.length - 1; index >= 0; index -= 1) {
    const sitting = sessions[index];
    if (!sitting || sitting.overall < 50) break;
    count += 1;
  }
  return count;
}

export function unlockedAchievementIds(snapshot: AchievementSnapshot): string[] {
  const ids: string[] = [];
  const { completed } = snapshot;
  if (completed.length >= 1) ids.push("first_session");
  if (completed.some((sitting) => sitting.overall >= 80)) ids.push("high_score");
  if (completed.some((sitting) => sitting.outcome === "won")) ids.push("deal_closed");
  const personas = new Set(completed.map((sitting) => sitting.personaId));
  if (PERSONA_IDS.every((id) => personas.has(id))) ids.push("full_floor");
  if (completed.some((sitting) => sitting.difficulty === "hard" && sitting.overall >= 70)) ids.push("hard_shift");
  if (completed.some((sitting) => sitting.outcome === "won" && sitting.recoveredFromEscalation)) ids.push("comeback");
  if (completed.some((sitting) => sitting.dimensions.empathy >= 85)) ids.push("empathy");
  if (completed.some((sitting) => sitting.outcome === "won" && sitting.dimensions.close >= 80)) ids.push("closer");
  if (snapshot.hardObjectionHits >= 5) ids.push("five_hard");
  if (trailingStreak(completed) >= 3) ids.push("streak");
  if (snapshot.bestAcknowledgement >= 90) ids.push("ack");
  const categories = new Set(snapshot.categoriesFaced);
  if (OBJECTION_CATEGORIES.every((category) => categories.has(category))) ids.push("all_categories");
  return ids;
}
