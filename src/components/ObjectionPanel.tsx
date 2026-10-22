import { CATEGORY_LABELS, type ObjectionCategory, type Phase } from "@/lib/domain";

type ObjectionPanelProps = {
  personaName: string;
  phase: Phase;
  difficultyNote: string;
  category: ObjectionCategory;
  intensity: number;
  objection: string;
  painLabel: string;
  painDetail: string;
  respects: string[];
  irritants: string[];
  samplePhrase: string;
  lever: string;
};

const PHASE_LABEL: Record<Phase, string> = {
  opening: "Opening",
  probing: "Probing",
  escalated: "Escalated",
  softening: "Softening",
  closing: "Closing signal",
  closed: "Closed",
};

export function ObjectionPanel(props: ObjectionPanelProps) {
  return (
    <aside className="rounded-3xl border border-line bg-elev p-4 shadow-[var(--shadow)]">
      <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">{props.personaName}</p>
      <div className="mt-3 flex items-center justify-between gap-3">
        <h2 className="font-serif text-3xl leading-none">{CATEGORY_LABELS[props.category]}</h2>
        <p className="text-sm">
          <span className="sr-only">Intensity </span>
          <span aria-hidden="true">{"●".repeat(props.intensity)}{"○".repeat(Math.max(0, 3 - props.intensity))}</span>
          <span className="ml-2 font-mono text-xs text-muted">{props.intensity}/3</span>
        </p>
      </div>
      <p className="mt-2 text-xs uppercase tracking-[0.16em] text-accent">{PHASE_LABEL[props.phase]}</p>
      <blockquote className="mt-4 border-l-2 border-accent pl-3 text-sm leading-6">{props.objection}</blockquote>
      <p className="mt-4 text-sm leading-6">
        <span className="font-medium">{props.painLabel}. </span>
        {props.painDetail}
      </p>
      <p className="mt-4 text-sm leading-6 text-muted">{props.difficultyNote}</p>
      <p className="mt-4 font-serif text-lg leading-6">“{props.samplePhrase}”</p>
      <div className="mt-4 grid gap-3 text-sm">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-good">What lands</p>
          <ul className="mt-1 list-disc pl-4">
            {props.respects.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.14em] text-bad">What irritates</p>
          <ul className="mt-1 list-disc pl-4">
            {props.irritants.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      </div>
      <details className="mt-4 rounded-2xl border border-line px-3 py-2">
        <summary className="cursor-pointer text-sm">A lever you can pull</summary>
        <p className="mt-2 text-sm leading-6">{props.lever}</p>
      </details>
    </aside>
  );
}
