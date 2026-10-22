type LlmArgs = {
  draft: string;
  personaName: string;
  voiceSummary: string;
  phase: string;
  objection: string;
  fetchImpl?: typeof fetch;
};

export type LlmResult = {
  text: string;
  source: "rules" | "llm";
};

function endpoint(): string {
  const base = (process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1").replace(/\/$/, "");
  return `${base}/chat/completions`;
}

export async function withOptionalLlm(args: LlmArgs): Promise<LlmResult> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return { text: args.draft, source: "rules" };
  const fetchImpl = args.fetchImpl ?? fetch;
  try {
    const response = await fetchImpl(endpoint(), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: [
              `You rewrite a sales-training objection in the voice of ${args.personaName}.`,
              args.voiceSummary,
              "Keep the same decision as the draft. If the draft refuses, stay refused. If it offers a trial, keep the offer.",
              "Two to four sentences. No labels, no coaching notes, no quotation marks around the whole reply.",
            ].join(" "),
          },
          {
            role: "user",
            content: `Phase: ${args.phase}. Objection in play: ${args.objection}. Draft to rewrite: ${args.draft}`,
          },
        ],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return { text: args.draft, source: "rules" };
    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: unknown } }>;
    };
    const content = payload.choices?.[0]?.message?.content;
    if (typeof content !== "string") return { text: args.draft, source: "rules" };
    const text = content.trim();
    if (!text || text.length > 700) return { text: args.draft, source: "rules" };
    return { text, source: "llm" };
  } catch {
    return { text: args.draft, source: "rules" };
  }
}
