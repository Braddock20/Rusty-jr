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

function playerKey(value: string | null | undefined) {
  return cleanName(value || "");
}

function teamKey(value: string | null | undefined) {
  return canonicalTeamName(value || "");
}

function timeDifference(a: string | null, b: string | null) {
  if (!a || !b) return null;
  const x = Date.parse(a);
  const y = Date.parse(b);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  return Math.abs(x - y) / 60000;
}

async function main() {
  console.log("Fetching Betika and eAdriatic once...");

  const [betika, eadriatic] = await Promise.all([
    getBetikaMatches(env),
    getEadriaticHistory(env)
  ]);

  console.log("\nPROVIDER STATUS");
  console.log(JSON.stringify({
    betika: { ok: betika.ok, count: betika.data.length, error: betika.error || null },
    eadriatic: {
      ok: eadriatic.ok,
      count: eadriatic.data.length,
      error: eadriatic.error || null,
      meta: eadriatic.meta || null
    }
  }, null, 2));

  if (!betika.ok || !eadriatic.ok) {
    console.log("\nAUDIT INCOMPLETE: at least one provider is unavailable.");
    return;
  }

  const candidates = betika.data.filter(m =>
    cleanName(m.competition || "").includes("eadriatic")
  );

  const eligible = eadriatic.data.filter(m =>
    m.homePlayer &&
    m.awayPlayer &&
    m.homeTeam &&
    m.awayTeam
  );

  let corroborated = 0;
  let noMatch = 0;

  console.log("\nFIXTURE COMPARISON");

  for (const b of candidates) {
    const matches = eligible.map(h => ({
      record: h,
      minutes: timeDifference(b.kickoff, h.kickoff)
    })).filter(x => {
      const h = x.record;
      return (
        playerKey(b.homePlayer) === playerKey(h.homePlayer) &&
        playerKey(b.awayPlayer) === playerKey(h.awayPlayer) &&
        teamKey(b.homeTeam) === teamKey(h.homeTeam) &&
        teamKey(b.awayTeam) === teamKey(h.awayTeam) &&
        x.minutes !== null &&
        x.minutes <= 30
      );
    }).sort((a, b) => a.minutes! - b.minutes!);

    if (matches.length) corroborated++;
    else noMatch++;

    console.log(JSON.stringify({
      betikaId: b.id,
      kickoff: b.kickoff,
      fixture: `${b.home} vs ${b.away}`,
      result: matches.length ? "CORROBORATED_CANDIDATE" : "NO_MATCH_FOUND",
      evidence: matches.slice(0, 3).map(x => ({
        eadriaticId: x.record.id,
        kickoff: x.record.kickoff,
        status: x.record.status,
        competition: x.record.competition,
        minutesDifference: x.minutes
      }))
    }));
  }

  console.log("\nSUMMARY");
  console.log(JSON.stringify({
    betikaEadriaticFixtures: candidates.length,
    eadriaticRecordsWithBothTeamsAndPlayers: eligible.length,
    corroboratedCandidates: corroborated,
    noMatchFound: noMatch,
    timeToleranceMinutes: 30,
    interpretation: "A match is supporting evidence, not absolute proof of event authenticity. No match means UNVERIFIED, not fake."
  }, null, 2));
}

main().catch(error => {
  console.error("AUDIT FAILED:", error);
  process.exitCode = 1;
});
