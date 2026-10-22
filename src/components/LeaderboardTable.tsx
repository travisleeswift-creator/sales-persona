type LeaderboardRow = {
  rank: number;
  userName: string;
  sessions: number;
  wins: number;
  average: number;
  best: number;
  strongestPersona: string;
};

export function LeaderboardTable({ rows }: { rows: LeaderboardRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-line px-4 py-8 text-sm text-muted">
        No finished sittings yet. Scores land here after a session ends.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-3xl border border-line bg-elev">
      <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
        <caption className="sr-only">Leaderboard of finished training sessions</caption>
        <thead>
          <tr className="border-b border-line font-mono text-xs uppercase tracking-[0.14em] text-muted">
            <th scope="col" className="px-4 py-3">Rank</th>
            <th scope="col" className="px-4 py-3">Name</th>
            <th scope="col" className="px-4 py-3">Sittings</th>
            <th scope="col" className="px-4 py-3">Wins</th>
            <th scope="col" className="px-4 py-3">Average</th>
            <th scope="col" className="px-4 py-3">Best</th>
            <th scope="col" className="px-4 py-3">Strongest counter</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.userName} className="border-b border-line last:border-0">
              <td className="px-4 py-3 font-mono">{row.rank}</td>
              <td className="px-4 py-3 font-medium">{row.userName}</td>
              <td className="px-4 py-3 tabular-nums">{row.sessions}</td>
              <td className="px-4 py-3 tabular-nums">{row.wins}</td>
              <td className="px-4 py-3 tabular-nums">{row.average}</td>
              <td className="px-4 py-3 tabular-nums">{row.best}</td>
              <td className="px-4 py-3">{row.strongestPersona}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
