function BadgeMark({ badgeKey }: { badgeKey: string }) {
  const common = "h-8 w-8";
  switch (badgeKey) {
    case "steady":
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden="true">
          <circle cx="16" cy="16" r="11" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M10 16.5 14 20.5 22 12" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "close":
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden="true">
          <rect x="7" y="9" width="18" height="14" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M7 12h18M12 16h8" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "floor":
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden="true">
          <path d="M6 22V12l10-6 10 6v10" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M12 22v-6h8v6" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "hard":
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden="true">
          <path d="M8 22 16 8l8 14" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M11 17h10" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "comeback":
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden="true">
          <path d="M8 18a8 8 0 1 0 2.4-5.7" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M8 8v6h6" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "ear":
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden="true">
          <path d="M20 8a7 7 0 0 0-8 6c0 3 2 4 2 7h5c1-2 3-3 3-6a5 5 0 0 0-2-7Z" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "ask":
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden="true">
          <path d="M8 10h16v9H14l-6 4v-4H8V10Z" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "skin":
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden="true">
          <path d="M16 6 24 10v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10v-6l8-4Z" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "streak":
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden="true">
          <path d="M8 22 14 12l4 6 6-10" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "ack":
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden="true">
          <path d="M8 15h6l2-5 2 10 2-5h4" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
    case "all":
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden="true">
          <circle cx="10" cy="12" r="2" fill="currentColor" />
          <circle cx="16" cy="10" r="2" fill="currentColor" />
          <circle cx="22" cy="12" r="2" fill="currentColor" />
          <circle cx="12" cy="18" r="2" fill="currentColor" />
          <circle cx="18" cy="20" r="2" fill="currentColor" />
          <circle cx="22" cy="17" r="2" fill="currentColor" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 32 32" className={common} aria-hidden="true">
          <rect x="8" y="10" width="16" height="12" rx="2" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M12 10V8h8v2" stroke="currentColor" strokeWidth="2" />
        </svg>
      );
  }
}

type AchievementBadgeProps = {
  name: string;
  description: string;
  badgeKey: string;
  unlocked: boolean;
};

export function AchievementBadge({ name, description, badgeKey, unlocked }: AchievementBadgeProps) {
  return (
    <article className={`flex gap-3 rounded-2xl border border-line p-3 ${unlocked ? "bg-elev text-ink" : "bg-bg text-muted"}`}>
      <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${unlocked ? "bg-accent text-accent-ink" : "bg-line text-muted"}`}>
        <BadgeMark badgeKey={badgeKey} />
      </div>
      <div>
        <h3 className="font-medium">{name}</h3>
        <p className="text-sm leading-5">{description}</p>
        <p className="mt-1 font-mono text-xs uppercase tracking-[0.14em]">{unlocked ? "Unlocked" : "Still locked"}</p>
      </div>
    </article>
  );
}
