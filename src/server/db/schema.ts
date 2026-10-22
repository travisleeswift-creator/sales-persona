import { boolean, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type {
  BuyingTrigger,
  ClosingSignal,
  ConversationStyle,
  DifficultyScaling,
  DimensionScores,
  ObjectionTemplate,
  PainPoint,
  Palette,
  PersonaAccent,
  SessionState,
  ToneProfile,
} from "@/lib/domain";

export const personas = pgTable("personas", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  businessType: text("business_type").notNull(),
  summary: text("summary").notNull(),
  offerContext: text("offer_context").notNull(),
  monogram: text("monogram").notNull(),
  sortOrder: integer("sort_order").notNull(),
  toneProfile: jsonb("tone_profile").$type<ToneProfile>().notNull(),
  objectionPatterns: jsonb("objection_patterns").$type<ObjectionTemplate[]>().notNull(),
  difficultyScaling: jsonb("difficulty_scaling").$type<DifficultyScaling>().notNull(),
  conversationStyle: jsonb("conversation_style").$type<ConversationStyle>().notNull(),
  buyingTriggers: jsonb("buying_triggers").$type<BuyingTrigger[]>().notNull(),
  painPoints: jsonb("pain_points").$type<PainPoint[]>().notNull(),
  closingSignals: jsonb("closing_signals").$type<ClosingSignal[]>().notNull(),
  theme: jsonb("theme").$type<PersonaAccent>().notNull(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  personaId: text("persona_id")
    .notNull()
    .references(() => personas.id),
  userName: text("user_name").notNull(),
  difficulty: text("difficulty").notNull(),
  status: text("status").notNull(),
  outcome: text("outcome").notNull(),
  overallScore: integer("overall_score").notNull().default(0),
  phase: text("phase").notNull(),
  state: jsonb("state").$type<SessionState>().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  endedAt: timestamp("ended_at", { withTimezone: true, mode: "date" }),
});

export const messages = pgTable("messages", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  seq: integer("seq").notNull(),
  role: text("role").notNull(),
  content: text("content").notNull(),
  objectionId: text("objection_id"),
  objectionCategory: text("objection_category"),
  score: jsonb("score").$type<StoredScore | null>(),
  meta: jsonb("meta").$type<MessageMeta | null>(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const analytics = pgTable("analytics", {
  id: text("id").primaryKey(),
  sessionId: text("session_id")
    .notNull()
    .unique()
    .references(() => sessions.id, { onDelete: "cascade" }),
  userName: text("user_name").notNull(),
  personaId: text("persona_id").notNull(),
  difficulty: text("difficulty").notNull(),
  outcome: text("outcome").notNull(),
  overallScore: integer("overall_score").notNull(),
  dimensionScores: jsonb("dimension_scores").$type<DimensionScores>().notNull(),
  objectionBreakdown: jsonb("objection_breakdown").$type<ObjectionBreakdown>().notNull(),
  turnCount: integer("turn_count").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const achievements = pgTable("achievements", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  badgeKey: text("badge_key").notNull(),
  criteria: jsonb("criteria").$type<Record<string, string | number>>().notNull(),
});

export const userAchievements = pgTable(
  "user_achievements",
  {
    id: text("id").primaryKey(),
    userName: text("user_name").notNull(),
    achievementId: text("achievement_id")
      .notNull()
      .references(() => achievements.id),
    sessionId: text("session_id").references(() => sessions.id, { onDelete: "set null" }),
    unlockedAt: timestamp("unlocked_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("user_achievements_user_achievement").on(table.userName, table.achievementId)],
);

export const themes = pgTable("themes", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  mode: text("mode").notNull(),
  palette: jsonb("palette").$type<Palette>().notNull(),
  isBuiltIn: boolean("is_built_in").notNull().default(false),
  personaId: text("persona_id"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export const themePreferences = pgTable("theme_preferences", {
  id: text("id").primaryKey(),
  themeId: text("theme_id")
    .notNull()
    .references(() => themes.id),
  mode: text("mode").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true, mode: "date" }).notNull().defaultNow(),
});

export type StoredScore = {
  overall: number;
  dimensions: DimensionScores;
  band: "weak" | "mixed" | "strong";
  dismissive: boolean;
  tooShort: boolean;
};

export type MessageMeta = {
  intensity?: number;
  objectionId?: string;
  source?: "rules" | "llm";
  phase?: string;
};

export type ObjectionBreakdown = {
  byCategory: Record<string, { attempts: number; totalScore: number }>;
  categories: string[];
  recoveredFromEscalation: boolean;
  hardHits: number;
  peakEscalation: number;
};
