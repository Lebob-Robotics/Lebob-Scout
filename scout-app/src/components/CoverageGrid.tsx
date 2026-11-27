import type { Coverage, CoverageCell } from "../api";
import type { Target } from "../observation";
import { cellName, cellTarget, coverageLine, gapRows } from "../teams";

const mark = (n: number) => (n === 0 ? "–" : n === 1 ? "✓" : `×${n}`);
const tone = (c: CoverageCell) => (c.reports === 0 ? "gap" : c.reports === 1 ? "ok" : "plain");

// One row per match, cells as given (red first, by station). Matches to come are muted and still open set-up.
// The grid scrolls sideways inside the card when the robots do not fit.
export function CoverageGrid({ coverage, eventUuid, gapsOnly, onGapsOnly, onScout }: {
  coverage: Coverage;
  eventUuid: string;
  gapsOnly: boolean;
  onGapsOnly(on: boolean): void;
  onScout(target: Target): void;
}) {
  if (!coverage.rows.length) return <p>No schedule for this event yet.</p>;
  const rows = gapsOnly ? gapRows(coverage.rows) : coverage.rows;
  const width = Math.max(...coverage.rows.map((r) => r.cells.length));
  return (
    <>
      <p className="caption keep">{coverageLine(coverage)}</p>
      <button type="button" aria-pressed={gapsOnly} onClick={() => onGapsOnly(!gapsOnly)}>Only matches with gaps</button>
      {rows.length ? (
        <div className="coverage" style={{ gridTemplateColumns: `2.25rem repeat(${width}, minmax(3.5rem, 1fr))` }}>
          {rows.map((row) => (
            <div key={row.matchUuid || row.label} className={row.played ? "cov-row" : "cov-row later"}>
              <span className="cov-label">{row.label}</span>
              {row.cells.map((c, i) => {
                const target = cellTarget(eventUuid, row, c);
                return (
                  <button
                    key={c.presenceUuid || i}
                    type="button"
                    className={`cov-cell ${c.alliance} ${row.played ? tone(c) : ""}`}
                    aria-label={cellName(row, c, target !== null)}
                    disabled={!target}
                    onClick={() => target && onScout(target)}
                  >
                    <span>{c.teamNumber} <b>{mark(c.reports)}</b></span>
                    <small>{c.name}</small>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      ) : (
        <p>No gaps in the matches played so far.</p>
      )}
    </>
  );
}
