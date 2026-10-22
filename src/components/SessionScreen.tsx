"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { AchievementBadge } from "@/components/AchievementBadge";
import { ChatBubble } from "@/components/ChatBubble";
import { ObjectionPanel } from "@/components/ObjectionPanel";
import { StatsCard } from "@/components/StatsCard";
import { StatusNote } from "@/components/StatusNote";
import { CATEGORY_LABELS, DIMENSION_LABELS, DIMENSIONS } from "@/lib/domain";
import { formatScore } from "@/lib/format";
import { trpc } from "@/lib/trpc";

export function SessionScreen({ id }: { id: string }) {
  const utils = trpc.useUtils();
  const session = trpc.fetchSession.useQuery({ id }, { retry: false });
  const score = trpc.scoreSession.useQuery({ id }, { retry: false });
  const [draft, setDraft] = useState("");
  const [fresh, setFresh] = useState<string[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const fieldRef = useRef<HTMLTextAreaElement>(null);

  const send = trpc.sendMessage.useMutation({
    onSuccess: async (result) => {
      setDraft("");
      setFresh(result.newlyUnlocked);
      utils.fetchSession.setData({ id }, result);
      await utils.scoreSession.invalidate({ id });
      fieldRef.current?.focus();
    },
  });
  const reset = trpc.resetSession.useMutation({
    onSuccess: async (result) => {
      setFresh([]);
      setDraft("");
      utils.fetchSession.setData({ id }, result);
      await utils.scoreSession.invalidate({ id });
    },
  });

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [session.data?.messages.length]);

  if (session.isLoading) return <div className="mx-auto max-w-6xl px-4 py-8"><StatusNote loading /></div>;
  if (session.error || !session.data) {
    return (
      <div className="mx-auto grid max-w-3xl gap-4 px-4 py-8">
        <StatusNote error={session.error?.message ?? "That sitting does not exist."} />
        <Link href="/" className="text-sm underline">Back to the counters</Link>
      </div>
    );
  }

  const data = session.data;
  const state = data.session.state;
  const pain = data.persona.painPoints.find((item) => item.id === state.objection.painPointId) ?? data.persona.painPoints[0];
  const lever = data.persona.buyingTriggers[0];
  const closed = data.session.status === "completed";
  const card = score.data?.score ?? data.score;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[18rem_minmax(0,1fr)_16rem]">
      {pain ? (
        <ObjectionPanel
          personaName={data.persona.name}
          phase={data.session.phase}
          difficultyNote={data.persona.difficultyScaling[data.session.difficulty].coachingNote}
          category={state.objection.category}
          intensity={state.objection.intensity}
          objection={state.objection.text}
          painLabel={pain.label}
          painDetail={pain.detail}
          respects={data.persona.conversationStyle.respects}
          irritants={data.persona.conversationStyle.irritants}
          samplePhrase={data.persona.toneProfile.samplePhrases[0] ?? data.persona.toneProfile.voiceSummary}
          lever={lever ? `${lever.label}. ${lever.detail}` : data.persona.offerContext}
        />
      ) : null}
      <section className="grid gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">{data.session.userName} · {data.session.difficulty}</p>
            <h1 className="font-serif text-4xl">{data.persona.name}</h1>
          </div>
          <button type="button" onClick={() => reset.mutate({ id })} disabled={reset.isPending} className="rounded-full border border-line px-3 py-1.5 text-sm">
            {reset.isPending ? "Resetting…" : "Reset sitting"}
          </button>
        </div>
        {closed ? (
          <p className="rounded-2xl border border-line bg-elev px-4 py-3 text-sm" role="status">
            Sitting closed · {data.session.outcome.replaceAll("_", " ")} · score {formatScore(card.overall)}. The last buyer line is their decision.
          </p>
        ) : null}
        {fresh.length > 0 ? (
          <p className="text-sm text-good" role="status">
            New badge{fresh.length === 1 ? "" : "s"}: {data.achievements.filter((item) => fresh.includes(item.id)).map((item) => item.name).join(", ")}
          </p>
        ) : null}
        <div className="grid gap-3" aria-live="polite">
          {data.messages.map((message) => {
            const previous = data.messages.find((item) => item.seq === message.seq - 1);
            return (
              <ChatBubble
                key={message.id}
                role={message.role}
                content={message.content}
                score={message.role === "feedback" ? previous?.score : message.score}
              />
            );
          })}
          <div ref={endRef} />
        </div>
        <form
          className="grid gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            if (closed || draft.trim().length === 0) return;
            send.mutate({ sessionId: id, content: draft });
          }}
        >
          <label htmlFor="reply" className="text-sm">Your reply</label>
          <textarea
            id="reply"
            ref={fieldRef}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            disabled={closed || send.isPending}
            rows={4}
            maxLength={2000}
            className="rounded-3xl border border-line bg-elev px-4 py-3 text-sm leading-6"
            placeholder={closed ? "This sitting is over. Reset to run it again." : `Answer the ${CATEGORY_LABELS[state.objection.category].toLowerCase()} objection.`}
          />
          <div className="flex items-center justify-between gap-3">
            <button type="submit" disabled={closed || send.isPending || draft.trim().length === 0} className="rounded-full bg-accent px-4 py-2 text-sm text-accent-ink disabled:opacity-50">
              {send.isPending ? "Scoring…" : "Send reply"}
            </button>
            {send.error ? <p role="alert" className="text-sm text-bad">{send.error.message}</p> : null}
          </div>
        </form>
      </section>
      <aside className="grid content-start gap-3">
        <StatsCard label="Score" value={formatScore(card.overall)} hint={`${card.turnsScored} scored ${card.turnsScored === 1 ? "reply" : "replies"}`} />
        <StatsCard label="Handled" value={String(card.objectionsHandled)} hint={card.recoveredFromEscalation ? "Recovered after an escalation" : "Objections moved past"} />
        <article className="rounded-3xl border border-line bg-elev p-4">
          <p className="font-mono text-xs uppercase tracking-[0.16em] text-muted">Dimensions</p>
          <ul className="mt-3 grid gap-2">
            {DIMENSIONS.map((dimension) => (
              <li key={dimension} className="grid grid-cols-[7rem_1fr_2rem] items-center gap-2 text-xs">
                <span>{DIMENSION_LABELS[dimension]}</span>
                <span className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden="true">
                  <span className="block h-full bg-accent" style={{ width: `${card.dimensions[dimension]}%` }} />
                </span>
                <span className="text-right font-mono">{card.dimensions[dimension]}</span>
              </li>
            ))}
          </ul>
        </article>
        <div className="grid gap-2">
          {data.achievements.filter((item) => item.unlocked).slice(0, 4).map((item) => (
            <AchievementBadge key={item.id} name={item.name} description={item.description} badgeKey={item.badgeKey} unlocked />
          ))}
        </div>
      </aside>
    </div>
  );
}
