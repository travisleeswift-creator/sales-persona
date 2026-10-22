import Link from "next/link";
import { formatScore, formatWhen } from "@/lib/format";

type HistoryItem = {
  id: string;
  userName: string;
  personaName: string;
  difficulty: string;
  status: string;
  outcome: string;
  overallScore: number;
  startedAt: Date | string;
};

export function SessionHistoryList({ items }: { items: HistoryItem[] }) {
  if (items.length === 0) {
    return (
      <p className="rounded-3xl border border-dashed border-line px-4 py-8 text-sm text-muted">
        No sittings yet. Pick a counter and run the first objection.
      </p>
    );
  }

  return (
    <ol className="grid gap-3">
      {items.map((item) => (
        <li key={item.id}>
          <Link href={`/session/${item.id}`} className="grid gap-2 rounded-3xl border border-line bg-elev px-4 py-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <span>
              <span className="font-serif text-2xl">{item.personaName}</span>
              <span className="mt-1 block text-sm text-muted">
                {item.userName} · {item.difficulty} · {item.outcome.replaceAll("_", " ")} · {formatWhen(item.startedAt)}
              </span>
            </span>
            <span className="font-mono text-sm uppercase tracking-[0.14em]">
              {item.status === "active" ? "In progress" : formatScore(item.overallScore)}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
