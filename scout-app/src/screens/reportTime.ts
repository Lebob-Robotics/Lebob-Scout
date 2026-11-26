// When a pit or breakage report was saved, as "Sat 2:14 pm". Old reports may hold a time with no zone, read as UTC
// as the old site wrote them.
export function savedAt(iso: string): string {
  if (!iso) return "";
  const ms = Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
}
