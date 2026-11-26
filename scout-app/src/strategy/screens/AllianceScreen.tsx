import { useState } from "react";
import type { Ctx } from "../StrategyApp";
import { one, partnersFor, pct, rsNeeded, whole } from "../logic";
import { SortTable, TeamName, type Col } from "../parts";
import type { Pick, Projection } from "../types";

// Alliance selection: where every team is likely to finish, and the best partners for us or any team.
export function AllianceScreen({ ctx }: { ctx: Ctx }) {
  const { model, ourTeam } = ctx;
  const teams = [...new Set(model.picks.map((p) => p.teamNumber))].sort((a, b) => a - b);
  const [other, setOther] = useState<number | null>(null);
  const shown = other ?? teams.find((t) => t !== ourTeam) ?? null;
  const need = rsNeeded(model.projections);
  const cols: Col<Projection>[] = [
    { key: "team", label: "Team", natural: "asc", value: (p) => p.teamNumber, show: (p) => <TeamName team={p.teamNumber} name={p.teamName} onOpen={ctx.openTeam} /> },
    { key: "rank", label: "Rank", num: true, natural: "asc", value: (p) => p.rankNow, show: (p) => whole(p.rankNow) },
    { key: "rp", label: "RP", num: true, value: (p) => p.rpNow, show: (p) => whole(p.rpNow), title: "Ranking points now" },
    { key: "rs", label: "RS", num: true, value: (p) => p.rsNow, show: (p) => one(p.rsNow), title: "Ranking score now" },
    { key: "exp", label: "Exp rank", num: true, natural: "asc", value: (p) => p.expRank, show: (p) => one(p.expRank) },
    { key: "median", label: "Median", num: true, natural: "asc", value: (p) => p.medianRank, show: (p) => whole(p.medianRank), title: "Median final rank" },
    { key: "p1", label: "1st", num: true, value: (p) => p.pRank1, show: (p) => pct(p.pRank1) },
    { key: "top4", label: "Top 4", num: true, value: (p) => p.pTop4, show: (p) => pct(p.pTop4) },
    { key: "top8", label: "Top 8", num: true, value: (p) => p.pTop8, show: (p) => pct(p.pTop8) },
    { key: "left", label: "Left", num: true, value: (p) => p.remaining, show: (p) => whole(p.remaining), title: "Qualification matches left" },
  ];

  return (
    <div className="strategy-screen">
      <section className="card">
        <h2>Rank projection</h2>
        {model.projections.length ? (
          <SortTable label="Rank projection" rows={model.projections} cols={cols} initial={{ key: "exp", dir: "asc" }} rowKey={(p) => p.teamNumber} onRow={(p) => ctx.openTeam(p.teamNumber)} />
        ) : <p>No rank projections yet for this event.</p>}
        <p className="caption">Ranking score needed to finish 1st: {one(need.rank1)} · 4th: {one(need.rank4)} · 8th: {one(need.rank8)}.</p>
      </section>

      <div className="cols">
        <section className="card">
          <h2>Partners for {ourTeam}</h2>
          <PartnersTable ctx={ctx} picks={partnersFor(model.picks, ourTeam)} />
        </section>
        <section className="card">
          <h2>Partners for another team</h2>
          {shown == null ? <p>No alliance picks yet for this event.</p> : (
            <>
              <select aria-label="Team" value={shown} onChange={(e) => setOther(Number(e.target.value))}>
                {teams.map((t) => <option key={t} value={t}>{t} {model.ratings.find((r) => r.teamNumber === t)?.teamName ?? ""}</option>)}
              </select>
              <PartnersTable ctx={ctx} picks={partnersFor(model.picks, shown)} />
            </>
          )}
        </section>
      </div>
    </div>
  );
}

// A team's possible partners, best chance of winning the event first.
export function PartnersTable({ ctx, picks }: { ctx: Ctx; picks: Pick[] }) {
  if (!picks.length) return <p>No alliance picks yet for this team.</p>;
  return (
    <>
      <div className="table-wrap">
        <table className="stable">
          <thead><tr><th>Partner</th><th className="num">Rating</th><th className="num">Win event</th><th className="num">Finals</th><th className="num">Seed</th><th>Free</th></tr></thead>
          <tbody>
            {picks.map((p) => (
              <tr key={p.partnerNumber}>
                <td><TeamName team={p.partnerNumber} name={p.partnerName} onOpen={ctx.openTeam} /></td>
                <td className="num">{one(p.partnerOpr)}</td>
                <td className="num">{pct(p.pWinEvent)}</td>
                <td className="num">{pct(p.pFinals)}</td>
                <td className="num">{whole(p.seed)}</td>
                <td>{p.free == null ? "–" : p.free ? "Yes" : "No"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="caption">From the model's simulated playoffs with each partner. Free: both teams likely still free to pair.</p>
    </>
  );
}
