import { useState } from "react";
import type { Ctx } from "../StrategyApp";
import { one, partnersFor, pct, rsNeeded, whole } from "../logic";
import { Card, SortTable, TeamName, Tiles, type Col } from "../parts";
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
    { key: "rank", label: "Rank", num: true, natural: "asc", value: (p) => p.rankNow, show: (p) => whole(p.rankNow), title: "Rank now" },
    { key: "rp", label: "RP", num: true, value: (p) => p.rpNow, show: (p) => whole(p.rpNow), title: "Ranking points now" },
    { key: "rs", label: "RS", num: true, value: (p) => p.rsNow, show: (p) => one(p.rsNow), title: "Ranking score now" },
    { key: "exp", label: "Exp rank", num: true, natural: "asc", value: (p) => p.expRank, show: (p) => one(p.expRank), title: "Expected final rank" },
    { key: "median", label: "Median", num: true, natural: "asc", value: (p) => p.medianRank, show: (p) => whole(p.medianRank), title: "Median final rank" },
    { key: "p1", label: "1st", num: true, value: (p) => p.pRank1, show: (p) => pct(p.pRank1), title: "Chance of finishing 1st" },
    { key: "top4", label: "Top 4", num: true, value: (p) => p.pTop4, show: (p) => pct(p.pTop4), title: "Chance of finishing in the top 4" },
    { key: "top8", label: "Top 8", num: true, value: (p) => p.pTop8, show: (p) => pct(p.pTop8), title: "Chance of finishing in the top 8" },
    { key: "left", label: "Left", num: true, value: (p) => p.remaining, show: (p) => whole(p.remaining), title: "Qualification matches left" },
  ];

  return (
    <div className="strategy-screen">
      <Card title="Rank projection">
        <Tiles tiles={[["RS for 1st", one(need.rank1)], ["RS for 4th", one(need.rank4)], ["RS for 8th", one(need.rank8)]]} />
        {model.projections.length ? (
          <SortTable label="Rank projection" rows={model.projections} cols={cols} initial={{ key: "exp", dir: "asc" }} rowKey={(p) => p.teamNumber} onRow={(p) => ctx.openTeam(p.teamNumber)} />
        ) : <p>No rank projections yet for this event.</p>}
      </Card>

      <div className="cols">
        <Card title={`Partners for ${ourTeam}`}>
          <PartnersTable ctx={ctx} picks={partnersFor(model.picks, ourTeam)} />
        </Card>
        <Card title="Partners for another team" control={shown != null && (
          <select aria-label="Team" value={shown} onChange={(e) => setOther(Number(e.target.value))}>
            {teams.map((t) => <option key={t} value={t}>{t} {model.ratings.find((r) => r.teamNumber === t)?.teamName ?? ""}</option>)}
          </select>
        )}>
          {shown == null ? <p>No alliance picks yet for this event.</p> : <PartnersTable ctx={ctx} picks={partnersFor(model.picks, shown)} />}
        </Card>
      </div>
    </div>
  );
}

// A team's possible partners, best chance of winning the event first (from the model's simulated playoffs).
export function PartnersTable({ ctx, picks }: { ctx: Ctx; picks: Pick[] }) {
  if (!picks.length) return <p>No alliance picks yet for this team.</p>;
  return (
    <div className="table-wrap">
      <table className="stable">
        <thead>
          <tr>
            <th>Partner</th><th className="num">Rating</th><th className="num" title="Chance of winning the event together">Win event</th>
            <th className="num" title="Chance of reaching the finals together">Finals</th><th className="num">Seed</th>
            <th title="Both teams likely still free to pair">Free</th>
          </tr>
        </thead>
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
  );
}
