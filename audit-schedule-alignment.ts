import type { Env } from "./src/types.ts";
import { getBetikaMatches } from "./src/providers/betika.ts";
import { getEadriaticHistory } from "./src/providers/eadriatic.ts";
import { cleanName, canonicalTeamName } from "./src/utils.ts";

const env: Env = {
  BETIKA_URL: "https://api.betika.com/v1/uo/matches?page=1&limit=100&sport_id=105&period_id=-1",
  EADRIATIC_MATCHHUB_URL: "https://api.leaguerepublic.com/json/getMatchHub/656829288.json",
  EADRIATIC_SEASON12_URL: "https://api.leaguerepublic.com/json/getMatchHub/477927459.json",
  REQUEST_TIMEOUT_MS: "12000"
};

const p = (v: string | null | undefined) => cleanName(v || "");
const t = (v: string | null | undefined) => canonicalTeamName(v || "");

async function main() {
  const [b, e] = await Promise.all([
    getBetikaMatches(env),
    getEadriaticHistory(env)
  ]);

  if (!b.ok || !e.ok) {
    console.log("INCOMPLETE", b.error, e.error);
    return;
  }

  const fixtures = b.data.filter(x => p(x.competition).includes("eadriatic"));

  for (const x of fixtures) {
    const rows = e.data.map(h => {
      const delta = x.kickoff && h.kickoff
        ? (Date.parse(h.kickoff) - Date.parse(x.kickoff)) / 60000
        : NaN;

      const direct =
        p(x.homePlayer) === p(h.homePlayer) &&
        p(x.awayPlayer) === p(h.awayPlayer) &&
        t(x.homeTeam) === t(h.homeTeam) &&
        t(x.awayTeam) === t(h.awayTeam);

      const reversed =
        p(x.homePlayer) === p(h.awayPlayer) &&
        p(x.awayPlayer) === p(h.homePlayer) &&
        t(x.homeTeam) === t(h.awayTeam) &&
        t(x.awayTeam) === t(h.homeTeam);

      return { h, delta, orientation: direct ? "DIRECT" : reversed ? "REVERSED" : null };
    }).filter(r =>
      r.orientation !== null &&
      Number.isFinite(r.delta) &&
      Math.abs(r.delta) <= 180
    ).sort((a, b) => a.delta - b.delta);

    console.log(JSON.stringify({
      betikaId: x.id,
      kickoff: x.kickoff,
      fixture: `${x.home} vs ${x.away}`,
      exactIdentityCandidates: rows.map(r => ({
        eadriaticId: r.h.id,
        kickoff: r.h.kickoff,
        status: r.h.status,
        orientation: r.orientation,
        minutesRelativeToBetika: r.delta,
        competition: r.h.competition
      }))
    }));
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
