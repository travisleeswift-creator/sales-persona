export const PERSONA_IDS = [
  "burger-bar",
  "chicken-shop",
  "off-licence",
  "grocer",
  "pub",
  "club",
  "hairdresser",
] as const;

export type PersonaId = (typeof PERSONA_IDS)[number];

export const OBJECTION_CATEGORIES = [
  "price",
  "time",
  "trust",
  "competition",
  "status_quo",
  "need",
  "authority",
  "risk",
] as const;

export type ObjectionCategory = (typeof OBJECTION_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ObjectionCategory, string> = {
  price: "Price",
  time: "Time",
  trust: "Trust",
  competition: "Competition",
  status_quo: "Status quo",
  need: "Need",
  authority: "Authority",
  risk: "Risk",
};

export const DIFFICULTIES = ["easy", "medium", "hard"] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export const DIMENSIONS = [
  "acknowledgement",
  "empathy",
  "reframe",
  "evidence",
  "question",
  "close",
  "relevance",
] as const;

export type Dimension = (typeof DIMENSIONS)[number];
export type DimensionScores = Record<Dimension, number>;

export const DIMENSION_LABELS: Record<Dimension, string> = {
  acknowledgement: "Acknowledgement",
  empathy: "Empathy",
  reframe: "Reframe",
  evidence: "Evidence",
  question: "Question",
  close: "Close",
  relevance: "Relevance",
};

export type Outcome = "in_progress" | "won" | "lost" | "partial";
export type Phase = "opening" | "probing" | "escalated" | "softening" | "closing" | "closed";
export type SessionStatus = "active" | "completed";

export type ToneProfile = {
  formality: number;
  skepticism: number;
  warmth: number;
  directness: number;
  pace: "measured" | "brisk" | "rapid";
  humor: "none" | "dry" | "warm" | "sharp";
  voiceSummary: string;
  samplePhrases: string[];
  vocabulary: string[];
  avoid: string[];
};

export type ObjectionTemplate = {
  id: string;
  category: ObjectionCategory;
  intensity: 1 | 2 | 3;
  painPointId: string;
  text: string;
  escalationText: string;
  probeText: string;
  softenText: string;
  keywords: string[];
};

export type DifficultyBand = {
  advanceScore: number;
  escalateBelow: number;
  maxTurns: number;
  targetObjections: number;
  intensityCeiling: 1 | 2 | 3;
  stacksConcerns: boolean;
  closeScoreRequired: number;
  coachingNote: string;
};

export type DifficultyScaling = Record<Difficulty, DifficultyBand>;

export type ConversationStyle = {
  summary: string;
  interruptLine: string | null;
  interruptAfterWords: number;
  respects: string[];
  irritants: string[];
  greeting: string;
  wonLine: string;
  lostLine: string;
  partialLine: string;
  hesitateLine: string;
  probeLead: string[];
  escalateLead: string[];
  softenLead: string[];
  nextLead: string[];
  closingLead: string[];
};

export type BuyingTrigger = {
  id: string;
  label: string;
  detail: string;
  phrases: string[];
};

export type PainPoint = {
  id: string;
  label: string;
  detail: string;
  keywords: string[];
};

export type ClosingSignal = {
  id: string;
  label: string;
  phrase: string;
};

export type PersonaAccent = {
  accent: string;
  accentInk: string;
  tint: string;
};

export type PersonaDefinition = {
  id: PersonaId;
  slug: string;
  name: string;
  businessType: string;
  summary: string;
  offerContext: string;
  monogram: string;
  sortOrder: number;
  toneProfile: ToneProfile;
  objectionPatterns: ObjectionTemplate[];
  difficultyScaling: DifficultyScaling;
  conversationStyle: ConversationStyle;
  buyingTriggers: BuyingTrigger[];
  painPoints: PainPoint[];
  closingSignals: ClosingSignal[];
  theme: PersonaAccent;
};

export type ActiveObjection = {
  id: string;
  category: ObjectionCategory;
  intensity: number;
  text: string;
  keywords: string[];
  painPointId: string;
  templateText: string;
  escalationText: string;
  probeText: string;
  softenText: string;
};

export type SessionState = {
  phase: Phase;
  objection: ActiveObjection;
  usedObjectionIds: string[];
  consecutiveWeak: number;
  consecutiveStrong: number;
  turn: number;
  escalationLevel: number;
  everEscalated: boolean;
  recoveredFromEscalation: boolean;
  objectionsHandled: number;
  closingSignalId: string | null;
  hesitation: number;
  outcome: Outcome;
};

export type Palette = {
  bg: string;
  bgElev: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  accentInk: string;
  good: string;
  bad: string;
  warn: string;
};

export type ThemeMode = "light" | "dark";

export const OFFER = {
  name: "Counterline",
  summary:
    "A lightweight operations service for independent venues. It tightens the busiest hour, cuts one measurable cost, and can be trialled for two weeks with no lock-in.",
  trial: "a two-week trial",
  price: "a weekly fee you can cancel any week",
};

export function emptyScores(): DimensionScores {
  return {
    acknowledgement: 0,
    empathy: 0,
    reframe: 0,
    evidence: 0,
    question: 0,
    close: 0,
    relevance: 0,
  };
}

export function isPersonaId(value: string): value is PersonaId {
  return (PERSONA_IDS as readonly string[]).includes(value);
}

export function isObjectionCategory(value: string): value is ObjectionCategory {
  return (OBJECTION_CATEGORIES as readonly string[]).includes(value);
}
