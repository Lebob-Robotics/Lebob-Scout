import type { TeamProfile } from "../api";
import { CURRENT_FIELD_KEY } from "../field";
import { clockTime } from "../teams";
import { breakageLine, chips, pitLines, reportLine } from "../teamsView";
import { ProfileMap, type Measure } from "./ProfileMap";

const one = (x: number) => String(Math.round(x * 10) / 10);
const maybe = (x: number | undefined, unit = "") => (x == null ? "–" : one(x) + unit);

// One team: a summary row with its chips, and when open its next match, profile tiles, report lines, pit reports,
// breakages, and buttons to add a pit report or a breakage for it.
// `opening` is the report being loaded for correction; `failed` the one that couldn't be.
export function TeamRow({ team: t, now, timeZone, open, onToggle, measure, onMeasure, opening, failed, onReport, onPit, onBreakage }: {
  team: TeamProfile;
  now: number; // read times against this day
  timeZone?: string; // the event's, when known: times show on its clock
  open: boolean;
  onToggle(open: boolean): void;
  measure: Measure; // what the map shows, kept by the Teams screen
  onMeasure(m: Measure): void;
  opening: string | null;
  failed: string | null;
  onReport(observationId: string): void;
  onPit(): void;
  onBreakage(): void;
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
  const nextAt = t.nextTime ? clockTime(t.nextTime, now, timeZone) : "";

  return (
    <details className={t.need ? "team need" : "team"} open={open} onToggle={(e) => { if (e.currentTarget.open !== open) onToggle(e.currentTarget.open); }}>
      <summary>
        <span className="num">{t.teamNumber}</span>
        <span className="name">{t.name}</span>
        <span className="chips">{chips(t).map((c) => <span key={c.text} className={`chip ${c.tone}`}>{c.text}</span>)}</span>
      </summary>
      <div className="team-body">
        {t.nextLabel && <p className="caption keep">Next scheduled: {t.nextLabel}{nextAt ? ` at ${nextAt}` : ""}.</p>}
        {t.matches ? (
          <>
            <dl className="tiles">{tiles.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
            <ProfileMap fieldKey={CURRENT_FIELD_KEY} squares={t.squares} starts={t.starts} measure={measure} onMeasure={onMeasure} />
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
        {t.pits.length > 0 && (
          <section className="team-notes">
            <h3>Pit</h3>
            {t.pits.map((p) => (
              <div key={p.pitReportId} className="note-block">{pitLines(p).map((line, i) => <p key={i}>{line}</p>)}</div>
            ))}
          </section>
        )}
        {t.breakages.length > 0 && (
          <section className="team-notes">
            <h3>Breakages</h3>
            <ul>{t.breakages.map((b) => <li key={b.breakageId}>{breakageLine(b)}</li>)}</ul>
          </section>
        )}
        <div className="pair">
          <button type="button" onClick={onPit}>Pit report</button>
          <button type="button" onClick={onBreakage}>Breakage</button>
        </div>
      </div>
    </details>
  );
}
