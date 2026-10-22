import {
  DIMENSIONS,
  type DifficultyBand,
  type DimensionScores,
  type ObjectionCategory,
} from "@/lib/domain";

export type ScoreBand = "weak" | "mixed" | "strong";

export type ScoreResult = {
  dimensions: DimensionScores;
  overall: number;
  band: ScoreBand;
  dismissive: boolean;
  tooShort: boolean;
};

export const WEIGHTS: Record<keyof DimensionScores, number> = {
  acknowledgement: 0.18,
  empathy: 0.14,
  reframe: 0.16,
  evidence: 0.16,
  question: 0.12,
  close: 0.12,
  relevance: 0.12,
};

export const CATEGORY_LEXICON: Record<ObjectionCategory, string[]> = {
  price: ["price", "cost", "expensive", "margin", "afford", "budget", "fee", "money", "weekly"],
  time: ["time", "busy", "rush", "hours", "setup", "minutes", "schedule", "training"],
  trust: ["trust", "promise", "failed", "proof", "reliable", "guarantee", "saturday", "friday"],
  competition: ["competitor", "down the road", "chain", "rival", "elsewhere", "queue"],
  status_quo: ["years", "already", "routine", "always", "the way", "used to"],
  need: ["need", "problem", "staff", "real issue", "instead"],
  authority: ["partner", "brother", "books", "landlord", "brewery", "manager", "ask"],
  risk: ["risk", "licence", "license", "fine", "inspection", "commission", "compliance"],
};

const ACK_PATTERNS = [
  /\bi (hear|get|understand|see)\b/i,
  /\bthat makes sense\b/i,
  /\bfair point\b/i,
  /\byou(?:'re| are) right\b/i,
  /\bsounds like\b/i,
  /\bthe (?:worry|concern|issue|problem) is\b/i,
  /\bi appreciate\b/i,
];

const EMPATHY_PATTERNS = [
  /\b(tough|frustrating|pressure|headache|stress|tight|rough|annoying)\b/i,
  /\bi(?:'ve| have) seen\b/i,
  /\bthat(?:'s| is) a lot\b/i,
  /\bfair enough\b/i,
  /\bunder (?:the|that)\b/i,
];

const REFRAME_PATTERNS = [
  /\bwhich means\b/i,
  /\bso that\b/i,
  /\bthe difference is\b/i,
  /\binstead\b/i,
  /\bwhat (?:that|this) (?:gives|gets|does)\b/i,
  /\bthe upside\b/i,
  /\bthat(?:'s| is) why\b/i,
];

const DISMISSIVE_PATTERN =
  /\b(you(?:'re| are) wrong|that(?:'s| is) not true|no you(?:'re| are) not|whatever|stop moaning|calm down|you don(?:'t| not) understand)\b/i;

export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function weightedOverall(dimensions: DimensionScores): number {
  const total = DIMENSIONS.reduce((sum, key) => sum + dimensions[key] * WEIGHTS[key], 0);
  return clampScore(total);
}

export function classifyScore(overall: number, band: DifficultyBand): ScoreBand {
  if (overall >= band.advanceScore) return "strong";
  if (overall < band.escalateBelow) return "weak";
  return "mixed";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function mentions(text: string, keyword: string): boolean {
  const needle = keyword.toLowerCase().trim();
  if (needle.length < 3) return false;
  if (needle.includes(" ")) return text.toLowerCase().includes(needle);
  return new RegExp(`\\b${escapeRegExp(needle)}\\b`, "i").test(text);
}

export function countMentions(text: string, keywords: string[]): number {
  const seen = new Set<string>();
  let hits = 0;
  for (const keyword of keywords) {
    const key = keyword.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);
    if (mentions(text, key)) hits += 1;
  }
  return hits;
}

export function scoreAcknowledgement(text: string, keywords: string[]): number {
  let score = 0;
  if (ACK_PATTERNS.some((pattern) => pattern.test(text))) score += 60;
  if (keywords.some((keyword) => mentions(text, keyword))) score += 25;
  if (/\b(you|your)\b/i.test(text)) score += 15;
  return clampScore(score);
}

export function scoreEmpathy(text: string): number {
  const hits = EMPATHY_PATTERNS.filter((pattern) => pattern.test(text)).length;
  let score = Math.min(2, hits) * 35;
  if (/\byou\b/i.test(text) && !/\b(you should|you(?:'re| are) wrong)\b/i.test(text)) score += 20;
  if (/\b(i|we) (promise|guarantee)\b/i.test(text)) score -= 10;
  return clampScore(score);
}

export function scoreReframe(text: string, triggerPhrases: string[]): number {
  let score = 0;
  if (REFRAME_PATTERNS.some((pattern) => pattern.test(text))) score += 50;
  if (triggerPhrases.some((phrase) => mentions(text, phrase))) score += 30;
  if (/\b(save|saves|cut|cuts|reduce|reduces|protect|protects|free|frees|shorten|shortens|speed|speeds)\b/i.test(text)) {
    score += 20;
  }
  return clampScore(score);
}

export function scoreEvidence(text: string): number {
  let score = 0;
  if (/\d/.test(text) || /£|%/.test(text)) score += 45;
  if (/\b(for example|for instance|last (?:week|month|saturday|friday)|one (?:shop|pub|salon|store|bar)|a trial)\b/i.test(text)) {
    score += 30;
  }
  if (/\b(per (?:week|month|shift|cover|head)|this week|in a month|two weeks|14 days)\b/i.test(text)) score += 25;
  return clampScore(score);
}

export function scoreQuestion(text: string): number {
  if (!text.includes("?")) return 0;
  let score = 55;
  if (/\b(how|what|which|where|when|who|why)\b[^.?!]{0,90}\?/i.test(text)) score += 30;
  if (text.trim().length < 40) score -= 20;
  return clampScore(score);
}

export function scoreClose(text: string): number {
  let score = 0;
  if (/\b(trial|pilot|test (?:it|this)|two[- ]weeks|2 weeks)\b/i.test(text)) score += 40;
  if (/\b(next step|shall we|can we (?:start|book|set|agree)|let(?:'|’)s (?:start|book|set)|go ahead)\b/i.test(text)) {
    score += 35;
  }
  if (/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|next week)\b/i.test(text)) score += 25;
  return clampScore(score);
}

export function scoreRelevance(text: string, keywords: string[]): number {
  const hits = countMentions(text, keywords);
  if (hits <= 0) return 10;
  if (hits === 1) return 50;
  if (hits === 2) return 75;
  return 100;
}

export function isDismissive(text: string): boolean {
  return DISMISSIVE_PATTERN.test(text);
}

export function scoreResponse(input: {
  text: string;
  keywords: string[];
  triggerPhrases: string[];
  thresholds: DifficultyBand;
}): ScoreResult {
  const text = input.text.trim();
  const dismissive = isDismissive(text);
  const dimensions: DimensionScores = {
    acknowledgement: scoreAcknowledgement(text, input.keywords),
    empathy: scoreEmpathy(text),
    reframe: scoreReframe(text, input.triggerPhrases),
    evidence: scoreEvidence(text),
    question: scoreQuestion(text),
    close: scoreClose(text),
    relevance: scoreRelevance(text, input.keywords),
  };

  if (dismissive) {
    dimensions.acknowledgement = Math.min(dimensions.acknowledgement, 30);
    dimensions.empathy = Math.min(dimensions.empathy, 20);
  }

  let overall = weightedOverall(dimensions);
  if (dismissive) overall = clampScore(overall - 25);
  const tooShort = text.length < 50;
  if (text.length < 25) overall = Math.min(overall, 20);
  else if (text.length < 50) overall = Math.min(overall, 45);

  return {
    dimensions,
    overall,
    band: classifyScore(overall, input.thresholds),
    dismissive,
    tooShort,
  };
}
