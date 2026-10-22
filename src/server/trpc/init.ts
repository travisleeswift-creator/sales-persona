import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import type { AppDb } from "@/server/db/index";
import { getDb } from "@/server/db/index";
import { prepareDatabase } from "@/server/db/prepare";

export type Context = {
  db: AppDb | null;
  configError: string | null;
};

export async function createContext(): Promise<Context> {
  try {
    const db = await getDb();
    return { db, configError: null };
  } catch (error) {
    return {
      db: null,
      configError: error instanceof Error ? error.message : "Database is not configured.",
    };
  }
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError: error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

export const createTRPCRouter = t.router;

const database = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.db) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: ctx.configError ?? "DATABASE_URL is not set.",
    });
  }
  await prepareDatabase(ctx.db);
  return next({ ctx: { db: ctx.db, configError: null } });
});

export const publicProcedure = database;
