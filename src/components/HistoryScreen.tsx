"use client";

import { useState, useSyncExternalStore } from "react";
import { SessionHistoryList } from "@/components/SessionHistoryList";
import { StatusNote } from "@/components/StatusNote";
import { readUserName, serverUserName, subscribePreference, writeUserName } from "@/lib/preferences";
import { trpc } from "@/lib/trpc";

export function HistoryScreen() {
  const storedName = useSyncExternalStore(subscribePreference, readUserName, serverUserName);
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [appliedOverride, setAppliedOverride] = useState<string | null>(null);
  const name = nameOverride ?? storedName;
  const applied = (appliedOverride ?? storedName).trim();
  const history = trpc.analytics.useQuery({ userName: applied || undefined }, { retry: false });

  return (
    <div className="mx-auto grid w-full max-w-3xl gap-6 px-4 py-8 sm:px-6">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">Session history</p>
        <h1 className="mt-2 font-serif text-5xl">Sittings</h1>
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setAppliedOverride(name.trim());
        }}
      >
        <label className="sr-only" htmlFor="history-name">Filter by name</label>
        <input id="history-name" value={name} onChange={(event) => setNameOverride(event.target.value)} placeholder="Filter by name" className="min-w-0 flex-1 rounded-full border border-line bg-elev px-4 py-2 text-sm" />
        <button
          type="submit"
          className="rounded-full bg-ink px-4 py-2 text-sm text-bg"
          onClick={() => {
            const next = name.trim();
            if (next) writeUserName(next);
          }}
        >
          Filter
        </button>
      </form>
      <StatusNote loading={history.isLoading} error={history.error?.message} />
      {history.data ? <SessionHistoryList items={history.data.recentSessions} /> : null}
    </div>
  );
}
