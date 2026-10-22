import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import type { AppDb } from "@/server/db/index";
import { prepareDatabase } from "@/server/db/prepare";
import * as schema from "@/server/db/schema";
import { appRouter } from "@/server/trpc/router";
import { strongReply, WEAK_REPLY } from "./helpers";

type Caller = ReturnType<typeof appRouter.createCaller>;

let caller: Caller;

beforeAll(async () => {
  const client = new PGlite();
  const db = drizzle({ client, schema }) as unknown as AppDb;
  await prepareDatabase(db);
  caller = appRouter.createCaller({ db, configError: null });
});

const palette = {
  bg: "#112233",
  bgElev: "#223344",
  ink: "#f4efe6",
  muted: "#aabbcc",
  line: "#334455",
  accent: "#ff8800",
  accentInk: "#1a1008",
  good: "#227744",
  bad: "#aa3344",
  warn: "#cc9922",
};

describe("integration", () => {
  it("lists the seven personas from the database", async () => {
    const personas = await caller.listPersonas();
    expect(personas.map((persona) => persona.name)).toEqual([
      "Burger Bar",
      "Chicken Shop",
      "Off Licence",
      "Grocer",
      "Pub",
      "Club",
      "Hairdresser",
    ]);
    for (const persona of personas) {
      expect(persona.toneProfile.voiceSummary.length).toBeGreaterThan(20);
      expect(persona.objectionPatterns).toHaveLength(8);
      expect(persona.difficultyScaling.hard.coachingNote.length).toBeGreaterThan(20);
      expect(persona.conversationStyle.summary.length).toBeGreaterThan(20);
      expect(persona.buyingTriggers.length).toBeGreaterThanOrEqual(4);
      expect(persona.painPoints.length).toBeGreaterThanOrEqual(4);
      expect(persona.closingSignals.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("plays a scored sitting through to a win, then resets it", async () => {
    const created = await caller.createSession({ personaId: "burger-bar", userName: "Ava", difficulty: "medium" });
    expect(created.messages).toHaveLength(1);
    expect(created.messages[0]?.role).toBe("persona");
    expect(created.session.state.phase).toBe("opening");

    let current = created;
    for (let turn = 0; turn < 3; turn += 1) {
      current = await caller.sendMessage({
        sessionId: created.session.id,
        content: strongReply(current.session.state.objection.keywords),
      });
    }
    expect(current.session.outcome).toBe("won");
    expect(current.session.status).toBe("completed");
    expect(current.score.overall).toBeGreaterThanOrEqual(70);
    expect(current.newlyUnlocked).toEqual(expect.arrayContaining(["first_session", "deal_closed"]));
    await expect(caller.sendMessage({ sessionId: created.session.id, content: strongReply(["fee"]) })).rejects.toThrow(/over/i);

    const scored = await caller.scoreSession({ id: created.session.id });
    expect(scored.turns).toHaveLength(3);
    expect(scored.score.outcome).toBe("won");

    const fetched = await caller.fetchSession({ id: created.session.id });
    expect(fetched.messages.some((message) => message.role === "feedback")).toBe(true);

    const analytics = await caller.analytics({ userName: "Ava" });
    expect(analytics.overview.completed).toBeGreaterThanOrEqual(1);
    expect(analytics.overview.winRate).toBe(100);
    expect(analytics.leaderboard.some((row) => row.userName === "Ava")).toBe(true);
    expect(analytics.trends.length).toBeGreaterThan(0);
    expect(analytics.hardestObjections.length).toBeGreaterThan(0);
    expect(analytics.userStats?.wins).toBe(1);
    expect(analytics.recentSessions[0]?.id).toBe(created.session.id);
    expect(analytics.achievements.some((item) => item.id === "deal_closed" && item.unlocked)).toBe(true);

    const reset = await caller.resetSession({ id: created.session.id });
    expect(reset.session.status).toBe("active");
    expect(reset.session.outcome).toBe("in_progress");
    expect(reset.messages).toHaveLength(1);
    expect(reset.score.overall).toBe(0);
  });

  it("loses the sitting after two weak replies", async () => {
    const created = await caller.createSession({ personaId: "pub", userName: "Nia", difficulty: "easy" });
    const first = await caller.sendMessage({ sessionId: created.session.id, content: WEAK_REPLY });
    expect(first.session.phase).toBe("escalated");
    const second = await caller.sendMessage({ sessionId: created.session.id, content: WEAK_REPLY });
    expect(second.session.outcome).toBe("lost");
    expect(second.session.status).toBe("completed");
  });

  it("creates, updates, activates, and deletes themes without dropping built-ins", async () => {
    const listed = await caller.themeCRUD.list();
    expect(listed.some((theme) => theme.id === "paper" && theme.isBuiltIn)).toBe(true);
    expect(listed.some((theme) => theme.personaId === "club")).toBe(true);

    const created = await caller.themeCRUD.create({ name: "Night market", mode: "dark", palette });
    expect(created.isBuiltIn).toBe(false);
    const updated = await caller.themeCRUD.update({ id: created.id, name: "Late market" });
    expect(updated.name).toBe("Late market");
    const active = await caller.themeCRUD.setActive({ themeId: created.id, mode: "light" });
    expect(active.themeId).toBe(created.id);
    expect(active.mode).toBe("light");
    expect((await caller.themeCRUD.getActive()).themeId).toBe(created.id);

    await expect(caller.themeCRUD.delete({ id: "paper" })).rejects.toThrow(/Built-in/);
    await caller.themeCRUD.delete({ id: created.id });
    const after = await caller.themeCRUD.list();
    expect(after.some((theme) => theme.id === created.id)).toBe(false);
    expect((await caller.themeCRUD.getActive()).themeId).toBe("paper");
  });
});
