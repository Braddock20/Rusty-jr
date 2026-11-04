import type { Env } from "./src/types.ts";
import { getBetikaMatches } from "./src/providers/betika.ts";
import { getEadriaticHistory } from "./src/providers/eadriatic.ts";

const env: Env = {
  BETIKA_URL: "https://api.betika.com/v1/uo/matches?page=1&limit=100&sport_id=105&period_id=-1",
  EADRIATIC_MATCHHUB_URL: "https://api.leaguerepublic.com/json/getMatchHub/656829288.json",
  EADRIATIC_SEASON12_URL: "https://api.leaguerepublic.com/json/getMatchHub/477927459.json",
  GT_FIXTURES_URL: "https://api.gtleagues.com/api/fixtures",
  GT_RECENT_LIMIT: "500",
  REQUEST_TIMEOUT_MS: "20000"
};

function norm(value: string | null | undefined) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

async function main() {
  const [betika, eadriatic] = await Promise.all([
    getBetikaMatches(env),
    getEadriaticHistory(env)
  ]);

  console.log("===== PROVIDER STATUS =====");
  console.log("Betika:", betika.ok, betika.data.length);
  console.log("eAdriatic:", eadriatic.ok, eadriatic.data.length);
  console.log("eAdriatic error:", eadriatic.error || null);
  console.log("eAdriatic meta:", JSON.stringify(eadriatic.meta || {}));

  if (!betika.ok || !eadriatic.ok) return;

  console.log("\n===== EADRIATIC GROUP / STATUS SUMMARY =====");

  const groups = new Map<string, typeof eadriatic.data>();

  for (const match of eadriatic.data) {
    const key = match.competition || "UNKNOWN GROUP";
    groups.set(key, [...(groups.get(key) || []), match]);
  }

  for (const [name, rows] of groups) {
    const finished = rows.filter(m => m.status === "finished").length;
    const scheduled = rows.filter(m => m.status === "scheduled").length;
    const unknown = rows.filter(m => m.status === "unknown").length;
    const withTeams = rows.filter(m => m.homeTeam && m.awayTeam).length;
    const withAffiliations = rows.filter(
      m => m.homeAffiliation || m.awayAffiliation
    ).length;

    console.log(JSON.stringify({
      group: name,
      total: rows.length,
      finished,
      scheduled,
      unknown,
      withTeams,
      withAffiliations
    }));

    for (const row of rows.slice(0, 2)) {
      console.log(" SAMPLE:", JSON.stringify({
        homePlayer: row.homePlayer,
        homeTeam: row.homeTeam,
        homeAffiliation: row.homeAffiliation,
        awayPlayer: row.awayPlayer,
        awayTeam: row.awayTeam,
        awayAffiliation: row.awayAffiliation,
        kickoff: row.kickoff,
        status: row.status
      }));
    }
  }

  console.log("\n===== BETIKA EADRIATIC FIXTURE CORROBORATION =====");

  const targets = betika.data.filter(
    m => (m.competition || "").toLowerCase().includes("eadriatic")
  );

  for (const target of targets) {
    const candidates = eadriatic.data.filter(h => {
      const samePlayers =
        norm(h.homePlayer) === norm(target.homePlayer) &&
        norm(h.awayPlayer) === norm(target.awayPlayer);

      const reversePlayers =
        norm(h.homePlayer) === norm(target.awayPlayer) &&
        norm(h.awayPlayer) === norm(target.homePlayer);

      return samePlayers || reversePlayers;
    });

    console.log("\nBETIKA:", JSON.stringify({
      id: target.id,
      home: `${target.homeTeam} (${target.homePlayer})`,
      away: `${target.awayTeam} (${target.awayPlayer})`,
      kickoff: target.kickoff
    }));

    console.log("PLAYER-PAIR CANDIDATES:", candidates.length);

    for (const candidate of candidates.slice(0, 5)) {
      console.log(" CANDIDATE:", JSON.stringify({
        id: candidate.id,
        competition: candidate.competition,
        homePlayer: candidate.homePlayer,
        homeTeam: candidate.homeTeam,
        homeAffiliation: candidate.homeAffiliation,
        awayPlayer: candidate.awayPlayer,
        awayTeam: candidate.awayTeam,
        awayAffiliation: candidate.awayAffiliation,
        kickoff: candidate.kickoff,
        status: candidate.status
      }));
    }
  }
}

main().catch(console.error);
