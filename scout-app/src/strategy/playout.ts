// The Alliance tab's play-out, from scouting: the rest of the qualifications go to the scouting forecast, then
// alliance selection and the playoffs go by strength. The most likely outcome, not chances.
import { allianceScore, isPlayed, type Game, type Strength } from "./scouted";
import type { Projection } from "./types";

export type Row = {
  teamNumber: number; rankNow: number | null; rpNow: number; rsNow: number | null; played: number;
  predRp: number; predPlayed: number; predRs: number; predRank: number; strength: number | null;
};
export type Alliance = { seed: number; captain: number; pick: number | null; strength: number; complete: boolean; finish: number };
export type Playout = { finished: boolean; remaining: number; rows: Row[]; alliances: Alliance[] };

const r2 = (x: number) => Math.round(x * 100) / 100;

// 1st, 2nd, 3rd, 4th ... 11th, 12th, 13th ... 21st.
export function ordinal(n: number): string {
  const r = Math.round(n), t = r % 100;
  const end = t >= 11 && t <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[r % 10] ?? "th";
  return `${r}${end}`;
}
const sideOf = (g: Game, t: number) => (g.red.includes(t) ? "red" : g.blue.includes(t) ? "blue" : null);

// Plays out the remaining qualification matches and the playoffs.
// Standing now: RP and rank from RankProjection (right only during qualifications), quals played from the official
// scores. Each remaining qual goes to the higher expected alliance (3 RP; 1 each when level or when a robot has no
// strength), and each alliance adds its expected bonus RP. Predicted RS = RP over quals; ranks by RS, ties by
// strength. Captains take seeds in predicted rank order, each picking the strongest team still free (a lower captain
// can be picked, and the next team moves up). Alliances finish in order of their strengths added.
// With no qualification left, the last standings stand and the play-out is finished.
export function playOut(games: Game[], projections: Projection[], st: Map<number, Strength>, rates: Map<number, number>, allianceCount: number): Playout {
  const quals = games.filter((g) => g.level === "qual");
  const left = quals.filter((g) => !isPlayed(g));
  const teams = [...new Set([...projections.map((p) => p.teamNumber), ...quals.flatMap((g) => [...g.red, ...g.blue])])];
  const proj = new Map(projections.map((p) => [p.teamNumber, p]));
  const strength = (t: number) => st.get(t)?.mean ?? null;
  const added = new Map<number, number>(), more = new Map<number, number>();
  const give = (ts: number[], rp: number) => ts.forEach((t) => { added.set(t, (added.get(t) ?? 0) + rp); more.set(t, (more.get(t) ?? 0) + 1); });
  left.forEach((g) => {
    const red = allianceScore(g.red, st), blue = allianceScore(g.blue, st);
    const bonus = (ts: number[]) => ts.reduce((a, t) => a + (rates.get(t) ?? 0), 0) / ts.length;
    const [rRp, bRp] = !red || !blue || red.mean === blue.mean ? [1, 1] : red.mean > blue.mean ? [3, 0] : [0, 3];
    give(g.red, rRp + bonus(g.red));
    give(g.blue, bRp + bonus(g.blue));
  });

  const finished = !left.length;
  const rows = teams.map((t): Omit<Row, "predRank"> => {
    const p = proj.get(t);
    const played = quals.filter((g) => isPlayed(g) && sideOf(g, t)).length;
    const rpNow = p?.rpNow ?? 0;
    const predPlayed = played + (more.get(t) ?? 0);
    const predRp = rpNow + (added.get(t) ?? 0);
    const rsNow = p?.rsNow ?? (played ? rpNow / played : null);
    return {
      teamNumber: t, rankNow: p?.rankNow ?? null, rpNow, rsNow, played, predRp: r2(predRp), predPlayed,
      predRs: r2(finished ? rsNow ?? 0 : predPlayed ? predRp / predPlayed : 0), strength: strength(t),
    };
  });
  const key = (v: number | null) => (v == null ? -Infinity : v);
  const ordered = [...rows].sort((a, b) => finished && a.rankNow != null && b.rankNow != null
    ? a.rankNow - b.rankNow
    : b.predRs - a.predRs || key(b.strength) - key(a.strength) || a.teamNumber - b.teamNumber);
  const ranked: Row[] = ordered.map((r, i) => ({ ...r, predRank: i + 1 }));

  // Alliance selection, then the playoffs by strength.
  const taken = new Set<number>();
  const count = Math.min(allianceCount, Math.floor(ranked.length / 2));
  const picks: Omit<Alliance, "finish">[] = [];
  for (let seed = 1; seed <= count; seed++) {
    const captain = ranked.find((r) => !taken.has(r.teamNumber));
    if (!captain) break;
    taken.add(captain.teamNumber);
    const pick = ranked.filter((r) => !taken.has(r.teamNumber))
      .sort((a, b) => key(b.strength) - key(a.strength) || a.predRank - b.predRank)[0];
    if (pick) taken.add(pick.teamNumber);
    const members = [captain, ...(pick ? [pick] : [])];
    picks.push({
      seed, captain: captain.teamNumber, pick: pick?.teamNumber ?? null,
      strength: Math.round(members.reduce((a, m) => a + (m.strength ?? 0), 0) * 10) / 10, complete: members.every((m) => m.strength != null),
    });
  }
  const finishOrder = [...picks].sort((a, b) => b.strength - a.strength || a.seed - b.seed).map((a) => a.seed);
  const alliances = picks.map((a) => ({ ...a, finish: finishOrder.indexOf(a.seed) + 1 }));
  return { finished, remaining: left.length, rows: ranked, alliances };
}

// What the play-out means for one team: its row, its alliance and partner (who it picks, or who picks it), the
// alliance most likely to beat it (the strongest one stronger than its own), and the predicted winner.
export function ourView(p: Playout, team: number) {
  const row = p.rows.find((r) => r.teamNumber === team) ?? null;
  const alliance = p.alliances.find((a) => a.captain === team || a.pick === team) ?? null;
  const captain = alliance?.captain === team;
  const partner = alliance ? (captain ? alliance.pick : alliance.captain) : null;
  const threat = alliance ? [...p.alliances].filter((a) => a.seed !== alliance.seed && a.strength > alliance.strength).sort((a, b) => b.strength - a.strength)[0] ?? null : null;
  const winner = p.alliances.find((a) => a.finish === 1) ?? null;
  return { row, alliance, captain, partner, threat, winner };
}
