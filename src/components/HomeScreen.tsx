"use client";

import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { PersonaCard } from "@/components/PersonaCard";
import { StatusNote } from "@/components/StatusNote";
import { DIFFICULTIES, OFFER, type Difficulty } from "@/lib/domain";
import { readDifficulty, readUserName, serverDifficulty, serverUserName, subscribePreference, writeDifficulty, writeUserName } from "@/lib/preferences";
import { trpc } from "@/lib/trpc";

export function HomeScreen() {
  const router = useRouter();
  const personas = trpc.listPersonas.useQuery(undefined, { retry: false });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const storedName = useSyncExternalStore(subscribePreference, readUserName, serverUserName);
  const storedDifficulty = useSyncExternalStore(subscribePreference, readDifficulty, serverDifficulty);
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [difficultyOverride, setDifficultyOverride] = useState<Difficulty | null>(null);
  const name = nameOverride ?? storedName;
  const difficulty: Difficulty =
    difficultyOverride ?? (storedDifficulty === "easy" || storedDifficulty === "hard" ? storedDifficulty : "medium");
  const create = trpc.createSession.useMutation({
    onSuccess: (result) => {
      writeUserName(result.session.userName);
      writeDifficulty(result.session.difficulty);
      router.push(`/session/${result.session.id}`);
    },
  });

  const selected = personas.data?.find((persona) => persona.id === selectedId) ?? null;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-8 px-4 py-8 sm:px-6">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)] lg:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-accent">Sales Persona Trainer</p>
          <h1 className="mt-3 max-w-3xl font-serif text-5xl leading-[0.95] sm:text-6xl">Learn the objection before you hear it twice.</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-muted">
            Seven counters. You are selling {OFFER.name}: {OFFER.summary} Pick a buyer, answer in their language, and get scored on the reply you actually gave.
          </p>
        </div>
        <form
          className="grid gap-3 rounded-3xl border border-line bg-elev p-4 shadow-[var(--shadow)]"
          onSubmit={(event) => {
            event.preventDefault();
            if (!selectedId) return;
            create.mutate({ personaId: selectedId, userName: name, difficulty });
          }}
        >
          <label className="grid gap-1 text-sm">
            Name on the board
            <input
              value={name}
              onChange={(event) => setNameOverride(event.target.value)}
              required
              maxLength={32}
              className="rounded-2xl border border-line bg-bg px-3 py-2"
              placeholder="Your name"
            />
          </label>
          <fieldset className="grid gap-2">
            <legend className="text-sm">Difficulty</legend>
            <div className="flex flex-wrap gap-2">
              {DIFFICULTIES.map((option) => (
                <label key={option} className={`rounded-full border px-3 py-1.5 text-sm ${difficulty === option ? "border-accent bg-accent text-accent-ink" : "border-line"}`}>
                  <input
                    type="radio"
                    name="difficulty"
                    value={option}
                    checked={difficulty === option}
                    onChange={() => setDifficultyOverride(option)}
                    className="sr-only"
                  />
                  {option}
                </label>
              ))}
            </div>
          </fieldset>
          {selected ? <p className="text-sm leading-6 text-muted">{selected.difficultyScaling[difficulty].coachingNote}</p> : <p className="text-sm text-muted">Choose a counter to see how this difficulty behaves.</p>}
          <button type="submit" disabled={!selectedId || create.isPending} className="rounded-full bg-ink px-4 py-2 text-sm text-bg disabled:opacity-50">
            {create.isPending ? "Opening the sitting…" : "Start sitting"}
          </button>
          {create.error ? <p role="alert" className="text-sm text-bad">{create.error.message}</p> : null}
        </form>
      </section>
      <StatusNote loading={personas.isLoading} error={personas.error?.message} />
      <section aria-label="Personas" className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {personas.data?.map((persona) => (
          <PersonaCard key={persona.id} persona={persona} selected={persona.id === selectedId} onSelect={() => setSelectedId(persona.id)} />
        ))}
      </section>
    </div>
  );
}
