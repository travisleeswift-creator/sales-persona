"use client";

import { useState, useSyncExternalStore } from "react";
import { AchievementBadge } from "@/components/AchievementBadge";
import { StatsCard } from "@/components/StatsCard";
import { StatusNote } from "@/components/StatusNote";
import { CATEGORY_LABELS, isObjectionCategory } from "@/lib/domain";
import { formatScore } from "@/lib/format";
import { readUserName, serverUserName, subscribePreference, writeUserName } from "@/lib/preferences";
import { trpc } from "@/lib/trpc";

function TrendChart({ points }: { points: Array<{ date: string; avgScore: number; sessions: number }> }) {
  if (points.length === 0) return <p className="text-sm text-muted">Trends appear after a finished sitting.</p>;
  const width = 640;
  const height = 180;
  const step = points.length === 1 ? 0 : width / (points.length - 1);
  const coords = points.map((point, index) => {
    const x = index * step;
    const y = height - (point.avgScore / 100) * (height - 20) - 8;
    return `${x},${y}`;
  });
  return (
    <div className="rounded-3xl border border-line bg-elev p-4">
      <h2 className="font-serif text-3xl">Score trend</h2>
      <svg viewBox={`0 0 ${width} ${height}`} className="mt-4 h-44 w-full text-accent" role="img" aria-label="Average score by day">
        <polyline fill="none" stroke="currentColor" strokeWidth="3" points={coords.join(" ")} />
      </svg>
      <table className="mt-2 w-full text-left text-sm">
        <caption className="sr-only">Daily averages</caption>
        <thead>
          <tr className="font-mono text-xs uppercase tracking-[0.14em] text-muted">
            <th scope="col" className="py-1">Day</th>
            <th scope="col" className="py-1">Sittings</th>
            <th scope="col" className="py-1">Average</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.date} className="border-t border-line">
              <td className="py-1">{point.date}</td>
              <td className="py-1 tabular-nums">{point.sessions}</td>
              <td className="py-1 tabular-nums">{point.avgScore}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AnalyticsScreen() {
  const storedName = useSyncExternalStore(subscribePreference, readUserName, serverUserName);
  const [nameOverride, setNameOverride] = useState<string | null>(null);
  const [appliedOverride, setAppliedOverride] = useState<string | null>(null);
  const name = nameOverride ?? storedName;
  const applied = (appliedOverride ?? storedName).trim();
  const analytics = trpc.analytics.useQuery({ userName: applied || undefined }, { retry: false });

  const data = analytics.data;
  const overview = data?.overview;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">Analytics</p>
          <h1 className="mt-2 font-serif text-5xl">The floor, in numbers</h1>
        </div>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const next = name.trim();
            setAppliedOverride(next);
            if (next) writeUserName(next);
          }}
        >
          <label className="sr-only" htmlFor="stats-name">Your name</label>
          <input id="stats-name" value={name} onChange={(event) => setNameOverride(event.target.value)} placeholder="Your name" className="rounded-full border border-line bg-elev px-4 py-2 text-sm" />
          <button type="submit" className="rounded-full bg-ink px-4 py-2 text-sm text-bg">Show stats</button>
        </form>
      </div>
      <StatusNote loading={analytics.isLoading} error={analytics.error?.message} />
      {data && overview ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatsCard label="Sittings" value={String(overview.sessions)} hint={`${overview.completed} finished`} />
            <StatsCard label="Average" value={formatScore(overview.avgScore)} hint="Finished sittings only" />
            <StatsCard label="Win rate" value={overview.winRate === null ? "—" : `${overview.winRate}%`} hint="Trials earned" />
            <StatsCard label="Best" value={formatScore(overview.bestScore)} hint={data.userStats?.streak ? `${data.userStats.streak} in a row at 50+` : "Highest finish"} />
          </section>
          {data.userStats ? (
            <p className="text-sm text-muted">
              {data.userStats.userName} · {data.userStats.wins} wins, {data.userStats.losses} losses, {data.userStats.partials} partial · favourite counter {data.userStats.favouritePersona ?? "not yet"} · {data.userStats.achievementsUnlocked}/{data.userStats.achievementsTotal} badges
            </p>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            <TrendChart points={data.trends} />
            <section className="rounded-3xl border border-line bg-elev p-4">
              <h2 className="font-serif text-3xl">Hardest objections</h2>
              {data.hardestObjections.length === 0 ? (
                <p className="mt-3 text-sm text-muted">Once replies are scored, the lowest categories show up here.</p>
              ) : (
                <ol className="mt-3 grid gap-2">
                  {data.hardestObjections.map((item) => (
                    <li key={`${item.personaId}-${item.category}`} className="flex items-center justify-between gap-3 border-t border-line py-2 text-sm">
                      <span>
                        {isObjectionCategory(item.category) ? CATEGORY_LABELS[item.category] : item.category}
                        <span className="block text-muted">{item.personaName} · {item.attempts} tries</span>
                      </span>
                      <span className="font-mono">{item.avgScore}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
          <section>
            <h2 className="font-serif text-3xl">By counter</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {data.personaBreakdown.map((item) => (
                <li key={item.personaId} className="rounded-2xl border border-line bg-elev px-3 py-3 text-sm">
                  <span className="font-medium">{item.personaName}</span>
                  <span className="mt-1 block text-muted">{item.sessions} finished · avg {item.avgScore} · {item.wins} wins</span>
                </li>
              ))}
            </ul>
          </section>
          <section>
            <h2 className="font-serif text-3xl">Badges</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {data.achievements.map((item) => (
                <AchievementBadge key={item.id} name={item.name} description={item.description} badgeKey={item.badgeKey} unlocked={item.unlocked} />
              ))}
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
