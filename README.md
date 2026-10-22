# Sales Persona Trainer

A training simulator for objection handling. You sell **Counterline** — a two-week, cancel-any-week operations service — to one of seven independent buyers: Burger Bar, Chicken Shop, Off Licence, Grocer, Pub, Club, or Hairdresser. The buyer raises a realistic objection, you reply, and the app scores the reply, escalates or softens, and keeps the sitting.

Objections, escalation, scoring, and feedback are deterministic and rule-based. No API key is required. An optional OpenAI-compatible model can rewrite the buyer's lines; if the key is missing or the call fails, the rule-based line is used.

## Stack

- Next.js App Router, React, TypeScript (strict)
- tRPC
- Drizzle ORM and Postgres (`DATABASE_URL`, for example Neon)
- Tailwind CSS
- Vitest, with PGlite for tests and for local development without Postgres

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

With `ALLOW_PGLITE=1` and no `DATABASE_URL`, the app creates an embedded Postgres database in `.data/pglite` and seeds it on the first request.

To use your own Postgres (Neon, Supabase, or local):

```bash
# .env.local
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
npm run db:setup
npm run dev
```

`db:setup` creates the tables and loads personas, achievements, and built-in themes. The running app also does this on the first request, so a fresh hosted database only needs `DATABASE_URL`.

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Local app |
| `npm run test` | Vitest (no live database) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run build` | Production build |
| `npm run db:setup` | Create tables and seed |

## Vercel Hobby

Import this GitHub repository. Pushes to `main` deploy automatically when the project’s production branch is `main` (the default for a new import).

Project settings:

| Setting | Value |
| --- | --- |
| Framework preset | Next.js |
| Root directory | `./` |
| Node.js version | 22.x |
| Install command | `npm install` |
| Build command | `npm run build` |
| Output directory | leave empty (Next.js default) |

These match `vercel.ts`.

Environment variables:

| Name | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Yes | Pooled Postgres connection string, for example Neon, including `sslmode=require`. |
| `OPENAI_API_KEY` | No | Enables model-written buyer lines. Omit it to stay on the rule engine. |
| `OPENAI_MODEL` | No | Defaults to `gpt-4o-mini`. |
| `OPENAI_BASE_URL` | No | Defaults to `https://api.openai.com/v1`. Any compatible chat-completions URL works. |

Do not set `ALLOW_PGLITE` on Vercel. The hosted filesystem is not a database.

Tables and seed data are created the first time the deployed app handles a request. You do not need a separate migration step on Hobby unless you prefer to run `npm run db:setup` against `DATABASE_URL` from your own machine.

## How a sitting works

1. Choose a persona, a difficulty, and the name that should appear on the leaderboard.
2. The buyer opens with an objection drawn from that persona’s catalogue. Easy stays on low-intensity objections. Hard starts higher and can stack a second pain point.
3. Your reply is scored on acknowledgement, empathy, reframe, evidence, question, close, and relevance.
4. A weak reply escalates. A second weak reply in a row ends the sitting as a loss. A solid reply moves to the next objection. Two solid replies (four on hard, once the target count is met) produce a closing signal. Ask for the trial and you can win.
5. Finished sittings feed the history, analytics, leaderboard, and badges.

There is no login. The name you enter is the identity on the board.
