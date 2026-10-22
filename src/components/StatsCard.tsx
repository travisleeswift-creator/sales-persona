type StatsCardProps = {
  label: string;
  value: string;
  hint?: string;
};

export function StatsCard({ label, value, hint }: StatsCardProps) {
  return (
    <article className="rounded-3xl border border-line bg-elev p-4 shadow-[var(--shadow)]">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">{label}</p>
      <p className="mt-2 font-serif text-4xl leading-none tabular-nums">{value}</p>
      {hint ? <p className="mt-2 text-sm leading-5 text-muted">{hint}</p> : null}
    </article>
  );
}
