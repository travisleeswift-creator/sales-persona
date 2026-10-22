import { DIMENSIONS, DIMENSION_LABELS, type DimensionScores } from "@/lib/domain";

type ChatBubbleProps = {
  role: "persona" | "user" | "feedback";
  content: string;
  score?: { overall: number; dimensions: DimensionScores } | null;
};

export function ChatBubble({ role, content, score }: ChatBubbleProps) {
  if (role === "feedback") {
    return (
      <article className="rounded-2xl border border-line bg-bg px-4 py-3" aria-label="Coaching feedback">
        <p className="font-mono text-xs uppercase tracking-[0.16em] text-warn">Coaching · {score ? `${score.overall}` : "note"}</p>
        <p className="mt-2 text-sm leading-6">{content}</p>
        {score ? (
          <ul className="mt-3 grid gap-1">
            {DIMENSIONS.map((dimension) => (
              <li key={dimension} className="grid grid-cols-[7.5rem_1fr_2rem] items-center gap-2 text-xs">
                <span className="text-muted">{DIMENSION_LABELS[dimension]}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
                  <span className="block h-full bg-accent" style={{ width: `${score.dimensions[dimension]}%` }} />
                </span>
                <span className="text-right font-mono">{score.dimensions[dimension]}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </article>
    );
  }

  const persona = role === "persona";
  return (
    <article className={`flex ${persona ? "justify-start" : "justify-end"}`} aria-label={persona ? "Buyer" : "You"}>
      <div className={`max-w-[42rem] rounded-3xl px-4 py-3 ${persona ? "bg-ink text-bg" : "border border-line bg-elev"}`}>
        <p className={`font-mono text-xs uppercase tracking-[0.16em] ${persona ? "text-bg/70" : "text-muted"}`}>
          {persona ? "Buyer" : "You"}
        </p>
        <p className="mt-1 text-sm leading-6 whitespace-pre-wrap">{content}</p>
      </div>
    </article>
  );
}
