export function strongReply(keywords: string[]): string {
  const topic = keywords.slice(0, 3).join(", ") || "the cost";
  return `I hear you on ${topic}. I have seen this pressure on a real service. The difference is this cuts wasted time, which means the margin holds. One shop saved 6 minutes a shift and it paid for itself in a month. How does this show up on a Saturday? Can we start a two-week trial next Saturday?`;
}

export const WEAK_REPLY = "Buy it.";
