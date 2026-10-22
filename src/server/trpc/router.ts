import { z } from "zod";
import { DIFFICULTIES } from "@/lib/domain";
import {
  createSession,
  createTheme,
  deleteTheme,
  fetchSession,
  getActiveTheme,
  getAnalytics,
  listPersonas,
  listThemes,
  resetSession,
  scoreSession,
  sendMessage,
  setActiveTheme,
  updateTheme,
} from "@/server/services/training";
import { createTRPCRouter, publicProcedure } from "@/server/trpc/init";

const userName = z.string().trim().min(1, "Enter the name you want on the board.").max(32);
const difficulty = z.enum(DIFFICULTIES);
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a 6-digit hex colour.");
const palette = z.object({
  bg: hex,
  bgElev: hex,
  ink: hex,
  muted: hex,
  line: hex,
  accent: hex,
  accentInk: hex,
  good: hex,
  bad: hex,
  warn: hex,
});
const mode = z.enum(["light", "dark"]);

export const appRouter = createTRPCRouter({
  listPersonas: publicProcedure.query(({ ctx }) => listPersonas(ctx.db)),
  createSession: publicProcedure
    .input(z.object({ personaId: z.string().min(1), userName, difficulty }))
    .mutation(({ ctx, input }) => createSession(ctx.db, input)),
  sendMessage: publicProcedure
    .input(z.object({ sessionId: z.string().min(1), content: z.string().trim().min(1).max(2000) }))
    .mutation(({ ctx, input }) => sendMessage(ctx.db, input)),
  fetchSession: publicProcedure.input(z.object({ id: z.string().min(1) })).query(({ ctx, input }) => fetchSession(ctx.db, input.id)),
  scoreSession: publicProcedure.input(z.object({ id: z.string().min(1) })).query(({ ctx, input }) => scoreSession(ctx.db, input.id)),
  resetSession: publicProcedure.input(z.object({ id: z.string().min(1) })).mutation(({ ctx, input }) => resetSession(ctx.db, input.id)),
  analytics: publicProcedure
    .input(
      z.object({
        userName: userName.optional(),
        personaId: z.string().min(1).optional(),
        difficulty: difficulty.optional(),
      }),
    )
    .query(({ ctx, input }) => getAnalytics(ctx.db, input)),
  themeCRUD: createTRPCRouter({
    list: publicProcedure.query(({ ctx }) => listThemes(ctx.db)),
    create: publicProcedure
      .input(z.object({ name: z.string().trim().min(2).max(40), mode, palette }))
      .mutation(({ ctx, input }) => createTheme(ctx.db, input)),
    update: publicProcedure
      .input(
        z.object({
          id: z.string().min(1),
          name: z.string().trim().min(2).max(40).optional(),
          mode: mode.optional(),
          palette: palette.optional(),
        }),
      )
      .mutation(({ ctx, input }) => updateTheme(ctx.db, input)),
    delete: publicProcedure.input(z.object({ id: z.string().min(1) })).mutation(({ ctx, input }) => deleteTheme(ctx.db, input.id)),
    getActive: publicProcedure.query(({ ctx }) => getActiveTheme(ctx.db)),
    setActive: publicProcedure
      .input(z.object({ themeId: z.string().min(1), mode }))
      .mutation(({ ctx, input }) => setActiveTheme(ctx.db, input)),
  }),
});

export type AppRouter = typeof appRouter;
