import path from "node:path";
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "@/server/db/schema";

export type AppDb = NodePgDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  appDb?: AppDb;
  opening?: Promise<AppDb>;
};

function databaseUrl(): string | undefined {
  const value = process.env.DATABASE_URL?.trim();
  return value ? value : undefined;
}

function sslFor(url: string): { rejectUnauthorized: false } | undefined {
  if (/localhost|127\.0\.0\.1/.test(url)) return undefined;
  if (/sslmode=disable/i.test(url)) return undefined;
  return { rejectUnauthorized: false };
}

async function openPostgres(url: string): Promise<AppDb> {
  const pool = new Pool({ connectionString: url, max: 1, ssl: sslFor(url) });
  return drizzlePg({ client: pool, schema });
}

async function openPglite(): Promise<AppDb> {
  const { mkdir } = await import("node:fs/promises");
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const dataDir = path.join(process.cwd(), ".data", "pglite");
  await mkdir(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  return drizzle({ client, schema }) as unknown as AppDb;
}

async function openDb(): Promise<AppDb> {
  const url = databaseUrl();
  if (url) return openPostgres(url);
  const allowFileDb = process.env.ALLOW_PGLITE === "1" && process.env.VERCEL !== "1";
  if (allowFileDb) return openPglite();
  throw new Error(
    "DATABASE_URL is not set. On Vercel, add a Postgres connection string. For local practice without Postgres, set ALLOW_PGLITE=1.",
  );
}

export async function getDb(): Promise<AppDb> {
  if (globalForDb.appDb) return globalForDb.appDb;
  if (!globalForDb.opening) {
    globalForDb.opening = openDb()
      .then((db) => {
        globalForDb.appDb = db;
        return db;
      })
      .catch((error: unknown) => {
        globalForDb.opening = undefined;
        throw error;
      });
  }
  return globalForDb.opening;
}

export function setDbForTests(db: AppDb): void {
  globalForDb.appDb = db;
  globalForDb.opening = Promise.resolve(db);
}
