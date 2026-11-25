import type { TeamProfile } from "../api";
import { clockTime } from "../teams";
import { chips, reportLine } from "../teamsView";

const one = (x: number) => String(Math.round(x * 10) / 10);
const maybe = (x: number | undefined, unit = "") => (x == null ? "–" : one(x) + unit);

// One team: a summary row with its chips, and when open its next match, profile tiles and report lines.
// `opening` is the report being loaded for correction; `failed` the one that couldn't be.
export function TeamRow({ team: t, open, onToggle, opening, failed, onReport }: {
  team: TeamProfile;
  open: boolean;
  onToggle(open: boolean): void;
  opening: string | null;
  failed: string | null;
  onReport(observationId: string): void;
}) {
  const tiles: [string, string][] = [
    ["points / match", String(Math.round(t.points))],
    ["auto pts", one(t.autoPoints)],
    ["teleop pts", one(t.teleopPoints)],
    ["park pts", one(t.parkPoints)],
    ["auto scored", one(t.autoScored)],
    ["cycles", one(t.cycles)],
    ["cycle time", maybe(t.cycleSeconds, "s")],
    ["driver 1-5", maybe(t.driverSkill)],
    ["speed 1-5", maybe(t.robotSpeed)],
    ["matches", String(t.matches)],
  ];

  return (
    <details className="team" open={open} onToggle={(e) => { if (e.currentTarget.open !== open) onToggle(e.currentTarget.open); }}>
      <summary>
        <span className="num">{t.teamNumber}</span>
        <span className="name">{t.name}</span>
        <span className="chips">{chips(t).map((c) => <span key={c.text} className={`chip ${c.tone}`}>{c.text}</span>)}</span>
      </summary>
      <div className="team-body">
        {t.nextLabel && <p className="caption">Next scheduled: {t.nextLabel}{t.nextTime ? ` at ${clockTime(t.nextTime)}` : ""}.</p>}
        {t.matches ? (
          <>
            <dl className="tiles">{tiles.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            {/* The map (Task 8) goes here, between the tiles and the report lines. */}
            <ul className="report-list">
              {t.reports.map((r) => (
                <li key={r.observationId}>
                  <button type="button" className="report" aria-busy={opening === r.observationId} onClick={() => onReport(r.observationId)}>
                    {reportLine(r)}
                    {opening === r.observationId && <span className="meta">Opening…</span>}
                  </button>
                  {failed === r.observationId && <p className="save-note error" role="alert">Couldn't open that report.</p>}
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>Nothing scouted yet.</p>
        )}
      </div>
    </details>
  );
}
