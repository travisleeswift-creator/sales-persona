import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import {
  emptyScores,
  isObjectionCategory,
  isPersonaId,
  type Difficulty,
  type DimensionScores,
  type ObjectionCategory,
  type Outcome,
  type Palette,
  type PersonaDefinition,
  type PersonaId,
  type Phase,
  type SessionState,
  type ThemeMode,
} from "@/lib/domain";
import { PAPER_PALETTE } from "@/lib/theme";
import { unlockedAchievementIds, type CompletedSitting } from "@/server/engine/achievements";
import { withOptionalLlm } from "@/server/engine/llm";
import { createInitialState, hashSeed, openingLine, runUserTurn } from "@/server/engine/objection-engine";
import type { AppDb } from "@/server/db/index";
import {
  achievements,
  analytics,
  messages,
  personas,
  sessions,
  themePreferences,
  themes,
  userAchievements,
  type MessageMeta,
  type ObjectionBreakdown,
  type StoredScore,
} from "@/server/db/schema";

type PersonaRow = typeof personas.$inferSelect;
type SessionRow = typeof sessions.$inferSelect;
type MessageRow = typeof messages.$inferSelect;
type ThemeRow = typeof themes.$inferSelect;

export type ScoreCard = {
  overall: number;
  dimensions: DimensionScores;
  turnsScored: number;
  outcome: Outcome;
  phase: Phase;
  objectionsHandled: number;
  escalationLevel: number;
  status: "active" | "completed";
  difficulty: Difficulty;
  recoveredFromEscalation: boolean;
};

export type AchievementView = {
  id: string;
  name: string;
  description: string;
  badgeKey: string;
  unlocked: boolean;
  unlockedAt: Date | null;
};

function fail(code: "NOT_FOUND" | "BAD_REQUEST" | "CONFLICT", message: string): never {
  throw new TRPCError({ code, message });
}

function asPersona(row: PersonaRow): PersonaDefinition {
  if (!isPersonaId(row.id)) fail("BAD_REQUEST", "Stored persona is not recognised.");
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    businessType: row.businessType,
    summary: row.summary,
    offerContext: row.offerContext,
    monogram: row.monogram,
    sortOrder: row.sortOrder,
    toneProfile: row.toneProfile,
    objectionPatterns: row.objectionPatterns,
    difficultyScaling: row.difficultyScaling,
    conversationStyle: row.conversationStyle,
    buyingTriggers: row.buyingTriggers,
    painPoints: row.painPoints,
    closingSignals: row.closingSignals,
    theme: row.theme,
  };
}

function asState(value: SessionState | null): SessionState {
  if (!value) fail("BAD_REQUEST", "Session state is missing.");
  return value;
}

function asDifficulty(value: string): Difficulty {
  if (value === "easy" || value === "medium" || value === "hard") return value;
  fail("BAD_REQUEST", "Difficulty is not recognised.");
}

function asOutcome(value: string): Outcome {
  if (value === "in_progress" || value === "won" || value === "lost" || value === "partial") return value;
  return "in_progress";
}

function asPhase(value: string): Phase {
  if (value === "opening" || value === "probing" || value === "escalated" || value === "softening" || value === "closing" || value === "closed") {
    return value;
  }
  return "opening";
}

function asMode(value: string): ThemeMode {
  return value === "dark" ? "dark" : "light";
}

function asRole(value: string): "persona" | "user" | "feedback" {
  if (value === "user" || value === "feedback" || value === "persona") return value;
  return "persona";
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function averageDimensions(rows: DimensionScores[]): DimensionScores {
  if (rows.length === 0) return emptyScores();
  const totals = emptyScores();
  for (const row of rows) {
    for (const key of Object.keys(totals) as Array<keyof DimensionScores>) {
      totals[key] += row[key];
    }
  }
  for (const key of Object.keys(totals) as Array<keyof DimensionScores>) {
    totals[key] = Math.round(totals[key] / rows.length);
  }
  return totals;
}

async function personaById(db: AppDb, id: string): Promise<PersonaDefinition> {
  const [row] = await db.select().from(personas).where(eq(personas.id, id));
  if (!row) fail("NOT_FOUND", "That persona is not on the floor.");
  return asPersona(row);
}

async function sessionById(db: AppDb, id: string): Promise<SessionRow> {
  const [row] = await db.select().from(sessions).where(eq(sessions.id, id));
  if (!row) fail("NOT_FOUND", "That sitting does not exist.");
  return row;
}

async function messageRows(db: AppDb, sessionId: string): Promise<MessageRow[]> {
  const rows = await db.select().from(messages).where(eq(messages.sessionId, sessionId));
  return rows.sort((left, right) => left.seq - right.seq);
}

function scoreCard(session: SessionRow, rows: MessageRow[]): ScoreCard {
  const state = asState(session.state);
  const scored = rows.filter((row) => row.role === "user" && row.score);
  const dimensions = averageDimensions(scored.map((row) => row.score?.dimensions ?? emptyScores()));
  return {
    overall: average(scored.map((row) => row.score?.overall ?? 0)),
    dimensions,
    turnsScored: scored.length,
    outcome: asOutcome(session.outcome),
    phase: asPhase(session.phase),
    objectionsHandled: state.objectionsHandled,
    escalationLevel: state.escalationLevel,
    status: session.status === "completed" ? "completed" : "active",
    difficulty: asDifficulty(session.difficulty),
    recoveredFromEscalation: state.recoveredFromEscalation,
  };
}

function breakdownFor(state: SessionState, rows: MessageRow[]): ObjectionBreakdown {
  const byCategory: ObjectionBreakdown["byCategory"] = {};
  let hardHits = 0;
  let peak = state.escalationLevel;
  for (const row of rows) {
    if (row.role !== "user" || !row.score || !row.objectionCategory) continue;
    const bucket = byCategory[row.objectionCategory] ?? { attempts: 0, totalScore: 0 };
    bucket.attempts += 1;
    bucket.totalScore += row.score.overall;
    byCategory[row.objectionCategory] = bucket;
    const intensity = row.meta?.intensity ?? 0;
    if (intensity >= 3 && row.score.overall >= 70) hardHits += 1;
    if (intensity > peak) peak = intensity;
  }
  return {
    byCategory,
    categories: Object.keys(byCategory),
    recoveredFromEscalation: state.recoveredFromEscalation,
    hardHits,
    peakEscalation: peak,
  };
}

async function writeAnalytics(db: AppDb, session: SessionRow, rows: MessageRow[]): Promise<void> {
  const card = scoreCard(session, rows);
  const state = asState(session.state);
  const payload = {
    userName: session.userName,
    personaId: session.personaId,
    difficulty: session.difficulty,
    outcome: session.outcome,
    overallScore: card.overall,
    dimensionScores: card.dimensions,
    objectionBreakdown: breakdownFor(state, rows),
    turnCount: card.turnsScored,
    updatedAt: new Date(),
  };
  const [existing] = await db.select({ id: analytics.id }).from(analytics).where(eq(analytics.sessionId, session.id));
  if (existing) {
    await db.update(analytics).set(payload).where(eq(analytics.sessionId, session.id));
    return;
  }
  await db.insert(analytics).values({
    id: crypto.randomUUID(),
    sessionId: session.id,
    createdAt: new Date(),
    ...payload,
  });
}

async function award(db: AppDb, userName: string, sessionId: string): Promise<string[]> {
  const catalog = await db.select().from(achievements);
  const known = new Set(catalog.map((item) => item.id));
  const userSessions = await db.select().from(sessions).where(eq(sessions.userName, userName));
  const analyticsRows = await db.select().from(analytics).where(eq(analytics.userName, userName));
  const dimensionsBySession = new Map(analyticsRows.map((row) => [row.sessionId, row.dimensionScores]));
  const completedWithDims: CompletedSitting[] = userSessions
    .filter((session) => session.status === "completed" && isPersonaId(session.personaId))
    .sort((left, right) => (left.endedAt?.getTime() ?? left.startedAt.getTime()) - (right.endedAt?.getTime() ?? right.startedAt.getTime()))
    .map((session) => ({
      personaId: session.personaId as PersonaId,
      difficulty: asDifficulty(session.difficulty),
      outcome: asOutcome(session.outcome),
      overall: session.overallScore,
      dimensions: dimensionsBySession.get(session.id) ?? emptyScores(),
      recoveredFromEscalation: asState(session.state).recoveredFromEscalation,
    }));

  const userMessages = await db
    .select({
      score: messages.score,
      meta: messages.meta,
      category: messages.objectionCategory,
      sessionId: messages.sessionId,
    })
    .from(messages);
  const sessionIds = new Set(userSessions.map((session) => session.id));
  let bestAcknowledgement = 0;
  let hardObjectionHits = 0;
  const categories = new Set<ObjectionCategory>();
  for (const row of userMessages) {
    if (!sessionIds.has(row.sessionId) || !row.score) continue;
    bestAcknowledgement = Math.max(bestAcknowledgement, row.score.dimensions.acknowledgement);
    if ((row.meta?.intensity ?? 0) >= 3 && row.score.overall >= 70) hardObjectionHits += 1;
    if (row.category && isObjectionCategory(row.category)) categories.add(row.category);
  }

  const earned = unlockedAchievementIds({
    completed: completedWithDims,
    categoriesFaced: [...categories],
    hardObjectionHits,
    bestAcknowledgement,
  }).filter((id) => known.has(id));

  const existing = await db.select().from(userAchievements).where(eq(userAchievements.userName, userName));
  const have = new Set(existing.map((row) => row.achievementId));
  const fresh = earned.filter((id) => !have.has(id));
  if (fresh.length > 0) {
    await db
      .insert(userAchievements)
      .values(
        fresh.map((achievementId) => ({
          id: crypto.randomUUID(),
          userName,
          achievementId,
          sessionId,
          unlockedAt: new Date(),
        })),
      )
      .onConflictDoNothing();
  }
  return fresh;
}

async function achievementViews(db: AppDb, userName: string): Promise<AchievementView[]> {
  const catalog = await db.select().from(achievements);
  const unlocked = await db.select().from(userAchievements).where(eq(userAchievements.userName, userName));
  const byId = new Map(unlocked.map((row) => [row.achievementId, row.unlockedAt]));
  return catalog
    .map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      badgeKey: item.badgeKey,
      unlocked: byId.has(item.id),
      unlockedAt: byId.get(item.id) ?? null,
    }))
    .sort((left, right) => Number(right.unlocked) - Number(left.unlocked) || left.name.localeCompare(right.name));
}

function messageDto(row: MessageRow) {
  return {
    id: row.id,
    seq: row.seq,
    role: asRole(row.role),
    content: row.content,
    objectionCategory: row.objectionCategory,
    score: row.score,
    createdAt: row.createdAt,
  };
}

async function presentSession(db: AppDb, session: SessionRow, newlyUnlocked: string[] = []) {
  const persona = await personaById(db, session.personaId);
  const rows = await messageRows(db, session.id);
  return {
    session: {
      id: session.id,
      userName: session.userName,
      difficulty: asDifficulty(session.difficulty),
      status: session.status === "completed" ? "completed" : "active",
      outcome: asOutcome(session.outcome),
      phase: asPhase(session.phase),
      startedAt: session.startedAt,
      endedAt: session.endedAt,
      state: asState(session.state),
    },
    persona,
    messages: rows.map(messageDto),
    score: scoreCard(session, rows),
    achievements: await achievementViews(db, session.userName),
    newlyUnlocked,
  };
}

async function speak(persona: PersonaDefinition, phase: string, objection: string, draft: string) {
  return withOptionalLlm({
    draft,
    personaName: persona.name,
    voiceSummary: persona.toneProfile.voiceSummary,
    phase,
    objection,
  });
}

export async function listPersonas(db: AppDb): Promise<PersonaDefinition[]> {
  const rows = await db.select().from(personas);
  return rows
    .filter((row) => isPersonaId(row.id))
    .map((row) => asPersona(row))
    .sort((left, right) => left.sortOrder - right.sortOrder);
}

export async function createSession(db: AppDb, input: { personaId: string; userName: string; difficulty: Difficulty }) {
  const persona = await personaById(db, input.personaId);
  const id = crypto.randomUUID();
  const seed = hashSeed([id, 0, "open"]);
  const state = createInitialState(persona, input.difficulty, seed);
  const spoken = await speak(persona, "opening", state.objection.text, openingLine(persona, state));
  const now = new Date();
  await db.insert(sessions).values({
    id,
    personaId: persona.id,
    userName: input.userName,
    difficulty: input.difficulty,
    status: "active",
    outcome: "in_progress",
    overallScore: 0,
    phase: state.phase,
    state,
    startedAt: now,
    endedAt: null,
  });
  await db.insert(messages).values({
    id: crypto.randomUUID(),
    sessionId: id,
    seq: 1,
    role: "persona",
    content: spoken.text,
    objectionId: state.objection.id,
    objectionCategory: state.objection.category,
    score: null,
    meta: { source: spoken.source, phase: "opening", objectionId: state.objection.id, intensity: state.objection.intensity },
    createdAt: now,
  });
  const session = await sessionById(db, id);
  return presentSession(db, session);
}

export async function fetchSession(db: AppDb, id: string) {
  return presentSession(db, await sessionById(db, id));
}

export async function scoreSession(db: AppDb, id: string) {
  const session = await sessionById(db, id);
  const rows = await messageRows(db, id);
  return {
    score: scoreCard(session, rows),
    turns: rows
      .filter((row) => row.role === "user" && row.score)
      .map((row) => ({
        seq: row.seq,
        category: row.objectionCategory,
        overall: row.score?.overall ?? 0,
        dimensions: row.score?.dimensions ?? emptyScores(),
        band: row.score?.band ?? "weak",
      })),
  };
}

export async function sendMessage(db: AppDb, input: { sessionId: string; content: string }) {
  const session = await sessionById(db, input.sessionId);
  if (session.status !== "active") fail("BAD_REQUEST", "This sitting is over. Reset it to practise again.");
  const persona = await personaById(db, session.personaId);
  const state = asState(session.state);
  const difficulty = asDifficulty(session.difficulty);
  const seed = hashSeed([session.id, state.turn + 1, "turn"]);
  const turn = runUserTurn({ persona, difficulty, state, userText: input.content, seed });
  const spoken = await speak(persona, turn.result.state.phase, turn.result.state.objection.text, turn.result.personaReply);
  const existing = await messageRows(db, session.id);
  const seq = existing.reduce((max, row) => Math.max(max, row.seq), 0);
  const now = new Date();
  const userScore: StoredScore = {
    overall: turn.score.overall,
    dimensions: turn.score.dimensions,
    band: turn.score.band,
    dismissive: turn.score.dismissive,
    tooShort: turn.score.tooShort,
  };
  const userMeta: MessageMeta = { intensity: state.objection.intensity, objectionId: state.objection.id };
  const personaMeta: MessageMeta = {
    source: spoken.source,
    phase: turn.result.state.phase,
    objectionId: turn.result.state.objection.id,
    intensity: turn.result.state.objection.intensity,
  };
  await db.insert(messages).values([
    {
      id: crypto.randomUUID(),
      sessionId: session.id,
      seq: seq + 1,
      role: "user",
      content: input.content,
      objectionId: state.objection.id,
      objectionCategory: state.objection.category,
      score: userScore,
      meta: userMeta,
      createdAt: now,
    },
    {
      id: crypto.randomUUID(),
      sessionId: session.id,
      seq: seq + 2,
      role: "feedback",
      content: turn.feedback,
      objectionId: state.objection.id,
      objectionCategory: state.objection.category,
      score: null,
      meta: { objectionId: state.objection.id, phase: turn.score.band },
      createdAt: now,
    },
    {
      id: crypto.randomUUID(),
      sessionId: session.id,
      seq: seq + 3,
      role: "persona",
      content: spoken.text,
      objectionId: turn.result.state.objection.id,
      objectionCategory: turn.result.state.objection.category,
      score: null,
      meta: personaMeta,
      createdAt: now,
    },
  ]);
  const rows = await messageRows(db, session.id);
  const card = scoreCard(
    { ...session, state: turn.result.state, outcome: turn.result.state.outcome, phase: turn.result.state.phase },
    rows,
  );
  const finished = turn.result.finished;
  await db
    .update(sessions)
    .set({
      state: turn.result.state,
      outcome: turn.result.state.outcome,
      phase: turn.result.state.phase,
      status: finished ? "completed" : "active",
      overallScore: card.overall,
      endedAt: finished ? now : null,
    })
    .where(eq(sessions.id, session.id));
  const updated = await sessionById(db, session.id);
  await writeAnalytics(db, updated, rows);
  const newlyUnlocked = await award(db, updated.userName, updated.id);
  return presentSession(db, updated, newlyUnlocked);
}

export async function resetSession(db: AppDb, id: string) {
  const session = await sessionById(db, id);
  const persona = await personaById(db, session.personaId);
  const difficulty = asDifficulty(session.difficulty);
  const seed = hashSeed([session.id, Date.now(), "reset"]);
  const state = createInitialState(persona, difficulty, seed);
  const spoken = await speak(persona, "opening", state.objection.text, openingLine(persona, state));
  await db.delete(messages).where(eq(messages.sessionId, id));
  await db.delete(analytics).where(eq(analytics.sessionId, id));
  const now = new Date();
  await db
    .update(sessions)
    .set({
      status: "active",
      outcome: "in_progress",
      overallScore: 0,
      phase: state.phase,
      state,
      startedAt: now,
      endedAt: null,
    })
    .where(eq(sessions.id, id));
  await db.insert(messages).values({
    id: crypto.randomUUID(),
    sessionId: id,
    seq: 1,
    role: "persona",
    content: spoken.text,
    objectionId: state.objection.id,
    objectionCategory: state.objection.category,
    score: null,
    meta: { source: spoken.source, phase: "opening", objectionId: state.objection.id, intensity: state.objection.intensity },
    createdAt: now,
  });
  return presentSession(db, await sessionById(db, id));
}

function dayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function getAnalytics(
  db: AppDb,
  input: { userName?: string; personaId?: string; difficulty?: Difficulty },
) {
  const personaRows = await db.select().from(personas);
  const names = new Map(personaRows.map((row) => [row.id, row.name]));
  const allSessions = await db.select().from(sessions);
  const filtered = allSessions.filter((session) => {
    if (input.userName && session.userName !== input.userName) return false;
    if (input.personaId && session.personaId !== input.personaId) return false;
    if (input.difficulty && session.difficulty !== input.difficulty) return false;
    return true;
  });
  const completed = filtered.filter((session) => session.status === "completed");
  const wins = completed.filter((session) => session.outcome === "won").length;
  const messageRowsAll = await db.select().from(messages);
  const allowed = new Set(filtered.map((session) => session.id));
  const scored = messageRowsAll.filter((row) => row.role === "user" && row.score && allowed.has(row.sessionId));
  const hardestMap = new Map<string, { category: string; personaId: string; attempts: number; total: number }>();
  for (const row of scored) {
    const session = filtered.find((item) => item.id === row.sessionId);
    if (!session || !row.objectionCategory || !row.score) continue;
    const key = `${session.personaId}:${row.objectionCategory}`;
    const bucket = hardestMap.get(key) ?? { category: row.objectionCategory, personaId: session.personaId, attempts: 0, total: 0 };
    bucket.attempts += 1;
    bucket.total += row.score.overall;
    hardestMap.set(key, bucket);
  }
  const hardestObjections = [...hardestMap.values()]
    .map((bucket) => ({
      category: bucket.category,
      personaId: bucket.personaId,
      personaName: names.get(bucket.personaId) ?? bucket.personaId,
      attempts: bucket.attempts,
      avgScore: Math.round(bucket.total / bucket.attempts),
    }))
    .sort((left, right) => left.avgScore - right.avgScore || right.attempts - left.attempts)
    .slice(0, 8);

  const trendMap = new Map<string, { sessions: number; total: number; wins: number }>();
  for (const session of completed) {
    const key = dayKey(session.endedAt ?? session.startedAt);
    const bucket = trendMap.get(key) ?? { sessions: 0, total: 0, wins: 0 };
    bucket.sessions += 1;
    bucket.total += session.overallScore;
    if (session.outcome === "won") bucket.wins += 1;
    trendMap.set(key, bucket);
  }
  const trends = [...trendMap.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([date, bucket]) => ({
      date,
      sessions: bucket.sessions,
      avgScore: Math.round(bucket.total / bucket.sessions),
      wins: bucket.wins,
    }));

  type BoardBucket = {
    scores: number[];
    wins: number;
    personaTotals: Map<string, { total: number; count: number }>;
  };
  const board = new Map<string, BoardBucket>();
  for (const session of completed) {
    const bucket: BoardBucket = board.get(session.userName) ?? {
      scores: [],
      wins: 0,
      personaTotals: new Map<string, { total: number; count: number }>(),
    };
    bucket.scores.push(session.overallScore);
    if (session.outcome === "won") bucket.wins += 1;
    const personaBucket = bucket.personaTotals.get(session.personaId) ?? { total: 0, count: 0 };
    personaBucket.total += session.overallScore;
    personaBucket.count += 1;
    bucket.personaTotals.set(session.personaId, personaBucket);
    board.set(session.userName, bucket);
  }
  const leaderboard = [...board.entries()]
    .map(([userName, bucket]) => {
      let strongestPersona = "";
      let strongestAverage = -1;
      for (const [personaId, personaBucket] of bucket.personaTotals) {
        const avg = personaBucket.total / personaBucket.count;
        if (avg > strongestAverage) {
          strongestAverage = avg;
          strongestPersona = names.get(personaId) ?? personaId;
        }
      }
      return {
        userName,
        sessions: bucket.scores.length,
        wins: bucket.wins,
        average: average(bucket.scores),
        best: Math.max(...bucket.scores),
        strongestPersona,
      };
    })
    .sort((left, right) => right.best - left.best || right.average - left.average || left.userName.localeCompare(right.userName))
    .slice(0, 20)
    .map((row, index) => ({ rank: index + 1, ...row }));

  const personaBreakdown = personaRows
    .filter((row) => isPersonaId(row.id))
    .map((row) => {
      const mine = completed.filter((session) => session.personaId === row.id);
      return {
        personaId: row.id,
        personaName: row.name,
        sessions: mine.length,
        avgScore: average(mine.map((session) => session.overallScore)),
        wins: mine.filter((session) => session.outcome === "won").length,
      };
    })
    .sort((left, right) => right.sessions - left.sessions || left.personaName.localeCompare(right.personaName));

  const catalog = await db.select().from(achievements);
  const unlocks = await db.select().from(userAchievements);
  const relevantUnlocks = input.userName ? unlocks.filter((row) => row.userName === input.userName) : unlocks;
  const unlockedIds = new Set(relevantUnlocks.map((row) => row.achievementId));
  const achievementBoard = catalog
    .map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      badgeKey: item.badgeKey,
      unlocked: input.userName ? unlockedIds.has(item.id) : false,
      holders: unlocks.filter((row) => row.achievementId === item.id).length,
    }))
    .sort((left, right) => Number(right.unlocked) - Number(left.unlocked) || left.name.localeCompare(right.name));
  const recentUnlocks = [...relevantUnlocks]
    .sort((left, right) => right.unlockedAt.getTime() - left.unlockedAt.getTime())
    .slice(0, 8)
    .map((row) => {
      const achievement = catalog.find((item) => item.id === row.achievementId);
      return {
        userName: row.userName,
        achievementId: row.achievementId,
        name: achievement?.name ?? row.achievementId,
        badgeKey: achievement?.badgeKey ?? "seat",
        unlockedAt: row.unlockedAt,
      };
    });

  let userStats: {
    userName: string;
    sessions: number;
    completed: number;
    avgScore: number;
    bestScore: number;
    wins: number;
    losses: number;
    partials: number;
    winRate: number | null;
    favouritePersona: string | null;
    achievementsUnlocked: number;
    achievementsTotal: number;
    dimensions: DimensionScores;
    streak: number;
  } | null = null;
  if (input.userName) {
    const mine = allSessions.filter((session) => session.userName === input.userName);
    const done = mine.filter((session) => session.status === "completed").sort((left, right) => (left.endedAt?.getTime() ?? 0) - (right.endedAt?.getTime() ?? 0));
    const analyticsRows = await db.select().from(analytics).where(eq(analytics.userName, input.userName));
    const counts = new Map<string, number>();
    for (const session of done) counts.set(session.personaId, (counts.get(session.personaId) ?? 0) + 1);
    let favourite: string | null = null;
    let favouriteCount = 0;
    for (const [personaId, count] of counts) {
      if (count > favouriteCount) {
        favouriteCount = count;
        favourite = names.get(personaId) ?? personaId;
      }
    }
    let streak = 0;
    for (let index = done.length - 1; index >= 0; index -= 1) {
      const sitting = done[index];
      if (!sitting || sitting.overallScore < 50) break;
      streak += 1;
    }
    const won = done.filter((session) => session.outcome === "won").length;
    userStats = {
      userName: input.userName,
      sessions: mine.length,
      completed: done.length,
      avgScore: average(done.map((session) => session.overallScore)),
      bestScore: done.reduce((best, session) => Math.max(best, session.overallScore), 0),
      wins: won,
      losses: done.filter((session) => session.outcome === "lost").length,
      partials: done.filter((session) => session.outcome === "partial").length,
      winRate: done.length > 0 ? Math.round((won / done.length) * 100) : null,
      favouritePersona: favourite,
      achievementsUnlocked: unlocks.filter((row) => row.userName === input.userName).length,
      achievementsTotal: catalog.length,
      dimensions: averageDimensions(analyticsRows.filter((row) => row.outcome !== "in_progress").map((row) => row.dimensionScores)),
      streak,
    };
  }

  return {
    overview: {
      sessions: filtered.length,
      completed: completed.length,
      avgScore: average(completed.map((session) => session.overallScore)),
      winRate: completed.length > 0 ? Math.round((wins / completed.length) * 100) : null,
      bestScore: completed.reduce((best, session) => Math.max(best, session.overallScore), 0),
    },
    trends,
    hardestObjections,
    leaderboard,
    personaBreakdown,
    achievements: achievementBoard,
    recentUnlocks,
    recentSessions: [...filtered]
      .sort((left, right) => right.startedAt.getTime() - left.startedAt.getTime())
      .slice(0, 40)
      .map((session) => ({
        id: session.id,
        userName: session.userName,
        personaId: session.personaId,
        personaName: names.get(session.personaId) ?? session.personaId,
        difficulty: session.difficulty,
        status: session.status,
        outcome: session.outcome,
        overallScore: session.overallScore,
        startedAt: session.startedAt,
        endedAt: session.endedAt,
      })),
    userStats,
  };
}

function mapTheme(row: ThemeRow) {
  return {
    id: row.id,
    name: row.name,
    mode: asMode(row.mode),
    palette: row.palette,
    isBuiltIn: row.isBuiltIn,
    personaId: row.personaId,
    createdAt: row.createdAt,
  };
}

export async function listThemes(db: AppDb) {
  const rows = await db.select().from(themes);
  return rows
    .map(mapTheme)
    .sort((left, right) => Number(right.isBuiltIn) - Number(left.isBuiltIn) || left.name.localeCompare(right.name));
}

export async function createTheme(db: AppDb, input: { name: string; mode: ThemeMode; palette: Palette }) {
  const [created] = await db
    .insert(themes)
    .values({
      id: `custom-${crypto.randomUUID()}`,
      name: input.name,
      mode: input.mode,
      palette: input.palette,
      isBuiltIn: false,
      personaId: null,
      createdAt: new Date(),
    })
    .returning();
  if (!created) fail("BAD_REQUEST", "Theme could not be saved.");
  return mapTheme(created);
}

export async function updateTheme(
  db: AppDb,
  input: { id: string; name?: string; mode?: ThemeMode; palette?: Palette },
) {
  const [existing] = await db.select().from(themes).where(eq(themes.id, input.id));
  if (!existing) fail("NOT_FOUND", "Theme not found.");
  if (input.name === undefined && input.mode === undefined && input.palette === undefined) {
    fail("BAD_REQUEST", "Provide a name, mode, or palette to update.");
  }
  const [updated] = await db
    .update(themes)
    .set({
      name: input.name ?? existing.name,
      mode: input.mode ?? existing.mode,
      palette: input.palette ?? existing.palette,
    })
    .where(eq(themes.id, input.id))
    .returning();
  if (!updated) fail("NOT_FOUND", "Theme not found.");
  return mapTheme(updated);
}

export async function deleteTheme(db: AppDb, id: string) {
  const [existing] = await db.select().from(themes).where(eq(themes.id, id));
  if (!existing) fail("NOT_FOUND", "Theme not found.");
  if (existing.isBuiltIn) fail("CONFLICT", "Built-in themes stay on the floor. Create your own if you want one you can remove.");
  const [preference] = await db.select().from(themePreferences).where(eq(themePreferences.id, "global"));
  if (preference?.themeId === id) {
    await db.update(themePreferences).set({ themeId: "paper", mode: "light", updatedAt: new Date() }).where(eq(themePreferences.id, "global"));
  }
  await db.delete(themes).where(eq(themes.id, id));
  return { id };
}

export async function setActiveTheme(db: AppDb, input: { themeId: string; mode: ThemeMode }) {
  const [theme] = await db.select().from(themes).where(eq(themes.id, input.themeId));
  if (!theme) fail("NOT_FOUND", "Theme not found.");
  const [preference] = await db.select().from(themePreferences).where(eq(themePreferences.id, "global"));
  if (preference) {
    await db
      .update(themePreferences)
      .set({ themeId: input.themeId, mode: input.mode, updatedAt: new Date() })
      .where(eq(themePreferences.id, "global"));
  } else {
    await db.insert(themePreferences).values({
      id: "global",
      themeId: input.themeId,
      mode: input.mode,
      updatedAt: new Date(),
    });
  }
  return getActiveTheme(db);
}

export async function getActiveTheme(db: AppDb) {
  const [preference] = await db.select().from(themePreferences).where(eq(themePreferences.id, "global"));
  const themeId = preference?.themeId ?? "paper";
  const [theme] = await db.select().from(themes).where(eq(themes.id, themeId));
  if (!theme) {
    return { themeId: "paper", mode: "light" as const, baseMode: "light" as const, base: PAPER_PALETTE, name: "Paper" };
  }
  return {
    themeId: theme.id,
    name: theme.name,
    mode: asMode(preference?.mode ?? theme.mode),
    baseMode: asMode(theme.mode),
    base: theme.palette,
    isBuiltIn: theme.isBuiltIn,
    personaId: theme.personaId,
  };
}
