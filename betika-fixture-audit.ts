import type { Env } from "./src/types.ts";
import { getBetikaMatches } from "./src/providers/betika.ts";

const env: Env = {
  BETIKA_URL: "https://api.betika.com/v1/uo/matches?page=1&limit=100&sport_id=105&period_id=-1",
  EADRIATIC_MATCHHUB_URL: "https://api.leaguerepublic.com/json/getMatchHub/656829288.json",
  EADRIATIC_SEASON12_URL: "https://api.leaguerepublic.com/json/getMatchHub/477927459.json",
  GT_FIXTURES_URL: "https://api.gtleagues.com/api/fixtures",
  GT_RECENT_LIMIT: "500",
  REQUEST_TIMEOUT_MS: "12000"
};

async function main() {
  const result = await getBetikaMatches(env);

  console.log("PROVIDER:", result.ok, "COUNT:", result.data.length);

  if (!result.ok) {
    console.log("ERROR:", result.error);
    return;
  }

  const groups = new Map<string, typeof result.data>();

  for (const match of result.data) {
    const key = match.competition || "NO COMPETITION";
    groups.set(key, [...(groups.get(key) || []), match]);
  }

  for (const [competition, matches] of groups) {
    console.log("\nCOMPETITION:", competition);
    console.log("COUNT:", matches.length);

    for (const match of matches.slice(0, 8)) {
      console.log(JSON.stringify({
        id: match.id,
        homePlayer: match.homePlayer,
        homeTeam: match.homeTeam,
        awayPlayer: match.awayPlayer,
        awayTeam: match.awayTeam,
        kickoff: match.kickoff
      }));
    }
  }
}

main().catch(console.error);
