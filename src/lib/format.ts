export function formatWhen(value: Date | string | null | undefined): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatScore(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return String(value);
}
