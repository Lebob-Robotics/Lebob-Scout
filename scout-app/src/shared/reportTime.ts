// A saved time in milliseconds; NaN when there is none or it can't be read. Old reports may hold a time with no zone,
// read as UTC as the old site wrote them.
export function storedMs(iso: string): number {
  if (!iso) return NaN;
  return Date.parse(/[zZ]|[+-]\d\d:?\d\d$/.test(iso) ? iso : `${iso}Z`);
}

// When a pit or breakage report was saved, as "Sat 2:14 pm".
export function savedAt(iso: string): string {
  const ms = storedMs(iso);
  if (Number.isNaN(ms)) return "";
  return new Date(ms).toLocaleString([], { weekday: "short", hour: "numeric", minute: "2-digit" });
}
