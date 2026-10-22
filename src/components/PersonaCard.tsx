type PersonaCardProps = {
  persona: {
    id: string;
    name: string;
    businessType: string;
    summary: string;
    monogram: string;
    toneProfile: {
      pace: string;
      skepticism: number;
      warmth: number;
      voiceSummary: string;
      vocabulary: string[];
    };
    painPoints: Array<{ id: string; label: string }>;
    theme: { accent: string; accentInk: string; tint: string };
  };
  selected: boolean;
  onSelect: () => void;
};

export function PersonaCard({ persona, selected, onSelect }: PersonaCardProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={`flex h-full flex-col rounded-3xl border p-4 text-left shadow-[var(--shadow)] transition ${selected ? "border-accent bg-elev" : "border-line bg-elev/80 hover:border-accent"}`}
      style={{ backgroundColor: selected ? persona.theme.tint : undefined }}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className="grid h-12 w-12 place-items-center rounded-2xl font-mono text-sm font-medium"
          style={{ background: persona.theme.accent, color: persona.theme.accentInk }}
        >
          {persona.monogram}
        </span>
        <span className="text-right text-xs uppercase tracking-[0.16em] text-muted">{persona.businessType}</span>
      </div>
      <h2 className="mt-4 font-serif text-3xl leading-none">{persona.name}</h2>
      <p className="mt-3 text-sm leading-6 text-muted">{persona.summary}</p>
      <p className="mt-3 text-sm leading-6">{persona.toneProfile.voiceSummary}</p>
      <p className="mt-3 font-mono text-xs uppercase tracking-[0.14em] text-muted">
        {persona.toneProfile.pace} · scepticism {persona.toneProfile.skepticism}/5 · warmth {persona.toneProfile.warmth}/5
      </p>
      <ul className="mt-4 flex flex-wrap gap-2">
        {persona.painPoints.slice(0, 3).map((pain) => (
          <li key={pain.id} className="rounded-full border border-line px-2.5 py-1 text-xs">
            {pain.label}
          </li>
        ))}
      </ul>
      <p className="mt-4 text-xs text-muted">{persona.toneProfile.vocabulary.slice(0, 4).join(" · ")}</p>
    </button>
  );
}
