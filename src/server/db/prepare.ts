import { sql } from "drizzle-orm";
import { eq } from "drizzle-orm";
import { ACHIEVEMENTS } from "@/server/engine/achievements";
import type { AppDb } from "@/server/db/index";
import { achievements, personas, themePreferences, themes } from "@/server/db/schema";
import { PERSONAS } from "@/server/personas/definitions";
import { validatePersona } from "@/server/personas/validate";
import { builtinThemes } from "@/lib/theme";

const STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS personas (
    id text PRIMARY KEY,
    slug text NOT NULL UNIQUE,
    name text NOT NULL,
    business_type text NOT NULL,
    summary text NOT NULL,
    offer_context text NOT NULL,
    monogram text NOT NULL,
    sort_order integer NOT NULL,
    tone_profile jsonb NOT NULL,
    objection_patterns jsonb NOT NULL,
    difficulty_scaling jsonb NOT NULL,
    conversation_style jsonb NOT NULL,
    buying_triggers jsonb NOT NULL,
    pain_points jsonb NOT NULL,
    closing_signals jsonb NOT NULL,
    theme jsonb NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS achievements (
    id text PRIMARY KEY,
    name text NOT NULL,
    description text NOT NULL,
    badge_key text NOT NULL,
    criteria jsonb NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS themes (
    id text PRIMARY KEY,
    name text NOT NULL,
    mode text NOT NULL,
    palette jsonb NOT NULL,
    is_built_in boolean NOT NULL DEFAULT false,
    persona_id text,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id text PRIMARY KEY,
    persona_id text NOT NULL REFERENCES personas(id),
    user_name text NOT NULL,
    difficulty text NOT NULL,
    status text NOT NULL,
    outcome text NOT NULL,
    overall_score integer NOT NULL DEFAULT 0,
    phase text NOT NULL,
    state jsonb NOT NULL,
    started_at timestamptz NOT NULL DEFAULT now(),
    ended_at timestamptz
  )`,
  `CREATE TABLE IF NOT EXISTS messages (
    id text PRIMARY KEY,
    session_id text NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    seq integer NOT NULL,
    role text NOT NULL,
    content text NOT NULL,
    objection_id text,
    objection_category text,
    score jsonb,
    meta jsonb,
    created_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS analytics (
    id text PRIMARY KEY,
    session_id text NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
    user_name text NOT NULL,
    persona_id text NOT NULL,
    difficulty text NOT NULL,
    outcome text NOT NULL,
    overall_score integer NOT NULL,
    dimension_scores jsonb NOT NULL,
    objection_breakdown jsonb NOT NULL,
    turn_count integer NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS user_achievements (
    id text PRIMARY KEY,
    user_name text NOT NULL,
    achievement_id text NOT NULL REFERENCES achievements(id),
    session_id text REFERENCES sessions(id) ON DELETE SET NULL,
    unlocked_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_name, achievement_id)
  )`,
  `CREATE TABLE IF NOT EXISTS theme_preferences (
    id text PRIMARY KEY,
    theme_id text NOT NULL REFERENCES themes(id),
    mode text NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS messages_session_idx ON messages(session_id)`,
  `CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_name)`,
  `CREATE INDEX IF NOT EXISTS analytics_user_idx ON analytics(user_name)`,
];

const prepared = new WeakSet<object>();

async function ensureSchema(db: AppDb): Promise<void> {
  for (const statement of STATEMENTS) {
    await db.execute(sql.raw(statement));
  }
}

async function seedContent(db: AppDb): Promise<void> {
  for (const persona of PERSONAS) {
    const errors = validatePersona(persona);
    if (errors.length > 0) {
      throw new Error(`Persona ${persona.id} is incomplete: ${errors.join("; ")}`);
    }
    await db
      .insert(personas)
      .values({
        id: persona.id,
        slug: persona.slug,
        name: persona.name,
        businessType: persona.businessType,
        summary: persona.summary,
        offerContext: persona.offerContext,
        monogram: persona.monogram,
        sortOrder: persona.sortOrder,
        toneProfile: persona.toneProfile,
        objectionPatterns: persona.objectionPatterns,
        difficultyScaling: persona.difficultyScaling,
        conversationStyle: persona.conversationStyle,
        buyingTriggers: persona.buyingTriggers,
        painPoints: persona.painPoints,
        closingSignals: persona.closingSignals,
        theme: persona.theme,
      })
      .onConflictDoUpdate({
        target: personas.id,
        set: {
          slug: persona.slug,
          name: persona.name,
          businessType: persona.businessType,
          summary: persona.summary,
          offerContext: persona.offerContext,
          monogram: persona.monogram,
          sortOrder: persona.sortOrder,
          toneProfile: persona.toneProfile,
          objectionPatterns: persona.objectionPatterns,
          difficultyScaling: persona.difficultyScaling,
          conversationStyle: persona.conversationStyle,
          buyingTriggers: persona.buyingTriggers,
          painPoints: persona.painPoints,
          closingSignals: persona.closingSignals,
          theme: persona.theme,
        },
      });
  }

  for (const achievement of ACHIEVEMENTS) {
    await db
      .insert(achievements)
      .values(achievement)
      .onConflictDoUpdate({
        target: achievements.id,
        set: {
          name: achievement.name,
          description: achievement.description,
          badgeKey: achievement.badgeKey,
          criteria: achievement.criteria,
        },
      });
  }

  const existingThemes = await db.select({ id: themes.id }).from(themes);
  const have = new Set(existingThemes.map((theme) => theme.id));
  const missing = builtinThemes().filter((theme) => !have.has(theme.id));
  if (missing.length > 0) {
    await db.insert(themes).values(
      missing.map((theme) => ({
        id: theme.id,
        name: theme.name,
        mode: theme.mode,
        palette: theme.palette,
        isBuiltIn: true,
        personaId: theme.personaId,
        createdAt: new Date(),
      })),
    );
  }

  const preference = await db.select({ id: themePreferences.id }).from(themePreferences).where(eq(themePreferences.id, "global"));
  if (preference.length === 0) {
    await db.insert(themePreferences).values({
      id: "global",
      themeId: "paper",
      mode: "light",
      updatedAt: new Date(),
    });
  }
}

export async function prepareDatabase(db: AppDb): Promise<void> {
  const key = db as object;
  if (prepared.has(key)) return;
  await ensureSchema(db);
  await seedContent(db);
  prepared.add(key);
}
