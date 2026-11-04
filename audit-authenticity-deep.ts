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

const pk = (v: string | null | undefined) => cleanName(v || "");
const tk = (v: string | null | undefined) => canonicalTeamName(v || "");

function minutes(a: string | null, b: string | null) {
  if (!a || !b) return null;
  const x = Date.parse(a);
  const y = Date.parse(b);
  return Number.isFinite(x) && Number.isFinite(y)
    ? Math.abs(x - y) / 60000
    : null;
}

function samePair(a: string, b: string, x: string, y: string) {
  return (a === x && b === y) || (a === y && b === x);
}

async function main() {
  const [betika, ea] = await Promise.all([
    getBetikaMatches(env),
    getEadriaticHistory(env)
  ]);

  if (!betika.ok || !ea.ok) {
    console.log("AUDIT INCOMPLETE", {
      betika: betika.error,
      eadriatic: ea.error
    });
    return;
  }

  const fixtures = betika.data.filter(m =>
    pk(m.competition).includes("eadriatic")
  );

  console.log("CURRENT DEVICE TIME:", new Date().toISOString());
  console.log("EADRIATIC RECORDS:", ea.data.length);
  console.log("SCHEDULED:", ea.data.filter(m => m.status === "scheduled").length);

  for (const b of fixtures) {
    const hp = pk(b.homePlayer);
    const ap = pk(b.awayPlayer);
    const ht = tk(b.homeTeam);
    const at = tk(b.awayTeam);

    const nearby = ea.data.map(h => ({
      h,
      diff: minutes(b.kickoff, h.kickoff)
    })).filter(x => x.diff !== null && x.diff <= 1440);

    const playerPair = nearby.filter(({ h }) =>
      h.homePlayer && h.awayPlayer &&
      samePair(hp, ap, pk(h.homePlayer), pk(h.awayPlayer))
    );

    const teamPair = nearby.filter(({ h }) =>
      h.homeTeam && h.awayTeam &&
      samePair(ht, at, tk(h.homeTeam), tk(h.awayTeam))
    );

    const eitherPlayer = nearby.filter(({ h }) =>
      [pk(h.homePlayer), pk(h.awayPlayer)].some(p => p === hp || p === ap)
    );

    console.log("\nBETIKA:", b.id, b.kickoff, b.home, "vs", b.away);

    console.log("PLAYER PAIR:", playerPair.slice(0, 5).map(x => ({
      id: x.h.id,
      kickoff: x.h.kickoff,
      players: [x.h.homePlayer, x.h.awayPlayer],
      teams: [x.h.homeTeam, x.h.awayTeam],
      affiliations: [x.h.homeAffiliation, x.h.awayAffiliation],
      status: x.h.status,
      minutesDifference: x.diff
    })));

    console.log("TEAM PAIR:", teamPair.slice(0, 5).map(x => ({
      id: x.h.id,
      kickoff: x.h.kickoff,
      players: [x.h.homePlayer, x.h.awayPlayer],
      teams: [x.h.homeTeam, x.h.awayTeam],
      status: x.h.status,
      minutesDifference: x.diff
    })));

    console.log("EITHER PLAYER NEARBY:", eitherPlayer.slice(0, 5).map(x => ({
      id: x.h.id,
      kickoff: x.h.kickoff,
      players: [x.h.homePlayer, x.h.awayPlayer],
      teams: [x.h.homeTeam, x.h.awayTeam],
      affiliations: [x.h.homeAffiliation, x.h.awayAffiliation],
      status: x.h.status,
      minutesDifference: x.diff
    })));
  }
}

main().catch(e => {
  console.error("DEEP AUDIT FAILED:", e);
  process.exitCode = 1;
});
