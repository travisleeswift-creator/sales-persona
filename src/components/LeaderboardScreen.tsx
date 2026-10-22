"use client";

import { useState } from "react";
import { LeaderboardTable } from "@/components/LeaderboardTable";
import { StatusNote } from "@/components/StatusNote";
import { DIFFICULTIES, type Difficulty } from "@/lib/domain";
import { trpc } from "@/lib/trpc";

export function LeaderboardScreen() {
  const personas = trpc.listPersonas.useQuery(undefined, { retry: false });
  const [personaId, setPersonaId] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty | "">("");
  const board = trpc.analytics.useQuery(
    {
      personaId: personaId || undefined,
      difficulty: difficulty || undefined,
    },
    { retry: false },
  );

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-8 sm:px-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">Leaderboard</p>
        <h1 className="mt-2 font-serif text-5xl">Best finishes</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Ranked by best finished score, then average. Names are whatever you typed when you started. There is no account.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="grid gap-1 text-sm">
          Counter
          <select value={personaId} onChange={(event) => setPersonaId(event.target.value)} className="rounded-full border border-line bg-elev px-3 py-2">
            <option value="">All counters</option>
            {personas.data?.map((persona) => (
              <option key={persona.id} value={persona.id}>{persona.name}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm">
          Difficulty
          <select
            value={difficulty}
            onChange={(event) => {
              const value = event.target.value;
              setDifficulty(value === "easy" || value === "medium" || value === "hard" ? value : "");
            }}
            className="rounded-full border border-line bg-elev px-3 py-2"
          >
            <option value="">All levels</option>
            {DIFFICULTIES.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>
      <StatusNote loading={board.isLoading} error={board.error?.message ?? personas.error?.message} />
      {board.data ? <LeaderboardTable rows={board.data.leaderboard} /> : null}
    </div>
  );
}
