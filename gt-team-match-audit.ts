import type { Env } from "./src/types.ts";
import { getBetikaMatches } from "./src/providers/betika.ts";
import { getGtHistory } from "./src/providers/gt.ts";
import { canonicalTeamName } from "./src/utils.ts";

const env: Env = {
  BETIKA_URL: "https://api.betika.com/v1/uo/matches?page=1&limit=100&sport_id=105&period_id=-1",
  EADRIATIC_MATCHHUB_URL: "https://api.leaguerepublic.com/json/getMatchHub/656829288.json",
  EADRIATIC_SEASON12_URL: "https://api.leaguerepublic.com/json/getMatchHub/477927459.json",
  GT_FIXTURES_URL: "https://api.gtleagues.com/api/fixtures",
  GT_RECENT_LIMIT: "500",
  REQUEST_TIMEOUT_MS: "12000",
  GT_SCAN_OFFSETS: "280000,290000,298000,300000,302000,310000,480000,490000,498000,500000,502000,510000,540000,542000,544000"
};

async function main() {
  const [betika, gt] = await Promise.all([
    getBetikaMatches(env),
    getGtHistory(env)
  ]);

  console.log("PROVIDER STATUS", {
    betika: betika.ok,
    gt: gt.ok,
    betikaCount: betika.data.length,
    gtCount: gt.data.length
  });

  if (!betika.ok || !gt.ok) {
    console.log("Provider fetch failed. No matching conclusions can be drawn.");
    return;
  }

  const gtTeams = new Map<string, Set<string>>();

  for (const m of gt.data) {
    if (m.source !== "gt") continue;

    for (const side of ["home", "away"] as const) {
      const name = side === "home" ? m.homeTeam : m.awayTeam;
      const id = side === "home" ? m.homeTeamId : m.awayTeamId;

      if (!name || !id) continue;

      if (!gtTeams.has(name)) gtTeams.set(name, new Set());
      gtTeams.get(name)!.add(String(id));
    }
  }

  const betikaTeams = new Set<string>();

  for (const m of betika.data) {
    if (m.homeTeam) betikaTeams.add(m.homeTeam);
    if (m.awayTeam) betikaTeams.add(m.awayTeam);
  }

  const gtRows = [...gtTeams.entries()].map(([name, ids]) => ({
    name,
    key: canonicalTeamName(name),
    ids: [...ids]
  }));

  console.log("\n===== BETIKA TEAM MATCH AUDIT =====");

  for (const name of [...betikaTeams].sort()) {
    const key = canonicalTeamName(name);
    const exact = gtRows.filter(row => row.key === key);

    console.log(JSON.stringify({
      betikaName: name,
      canonicalKey: key,
      exactGtMatches: exact
    }));
  }

  console.log("\n===== GT TEAMS WITH IDS =====");
  console.log("Unique GT names:", gtRows.length);
  console.log(JSON.stringify(gtRows.sort((a, b) => a.name.localeCompare(b.name)), null, 2));
}

main().catch(error => {
  console.error("AUDIT FAILED:", error);
  process.exitCode = 1;
});
