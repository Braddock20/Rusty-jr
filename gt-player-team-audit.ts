import type { Env } from "./src/types.ts";
import { getGtHistory } from "./src/providers/gt.ts";
import { cleanName } from "./src/utils.ts";

const env: Env = {
  BETIKA_URL: "https://api.betika.com/v1/uo/matches?page=1&limit=100&sport_id=105&period_id=-1",
  EADRIATIC_MATCHHUB_URL: "https://api.leaguerepublic.com/json/getMatchHub/656829288.json",
  EADRIATIC_SEASON12_URL: "https://api.leaguerepublic.com/json/getMatchHub/477927459.json",
  GT_FIXTURES_URL: "https://api.gtleagues.com/api/fixtures",
  GT_RECENT_LIMIT: "500",
  REQUEST_TIMEOUT_MS: "12000",
  GT_SCAN_OFFSETS: "280000,290000,298000,300000,302000,310000,480000,490000,498000,500000,502000,510000,540000,542000,544000"
};

const targets = [
  { player: "Fred", team: "AC Milan", teamId: "19" },
  { player: "Carlos", team: "Como", teamId: "291" },
  { player: "Walnut", team: "S.C Freiburg", teamId: "69" },
  { player: "Scorpion", team: "Panathinaikos", teamId: "39" },
  { player: "Voodoo", team: "Brighton and Hove Albion Football Club", teamId: "144" }
];

async function main() {
  const result = await getGtHistory(env);

  console.log("GT PROVIDER", {
    ok: result.ok,
    count: result.data.length
  });

  if (!result.ok) return;

  const history = result.data.filter(m => m.source === "gt");

  for (const target of targets) {
    const playerRows = history.flatMap(m => {
      const sides = [];

      if (cleanName(m.homePlayer) === cleanName(target.player)) {
        sides.push({
          match: m,
          side: "home",
          playerId: m.homePlayerId,
          team: m.homeTeam,
          teamId: m.homeTeamId
        });
      }

      if (cleanName(m.awayPlayer) === cleanName(target.player)) {
        sides.push({
          match: m,
          side: "away",
          playerId: m.awayPlayerId,
          team: m.awayTeam,
          teamId: m.awayTeamId
        });
      }

      return sides;
    });

    const selectedRows = playerRows.filter(
      row => String(row.teamId || "").trim() === target.teamId
    );

    const teamRows = history.filter(
      m => String(m.homeTeamId || "").trim() === target.teamId ||
           String(m.awayTeamId || "").trim() === target.teamId
    );

    console.log("\n===== PLAYER / TEAM =====");
    console.log(JSON.stringify({
      player: target.player,
      selectedTeam: target.team,
      selectedTeamId: target.teamId,
      playerAppearancesInSample: playerRows.length,
      playerIdsFound: [...new Set(playerRows.map(r => r.playerId).filter(Boolean))],
      selectedTeamAppearances: selectedRows.length,
      selectedTeamFixtureCount: teamRows.length,
      playerTeamsFound: [...new Map(
        playerRows.map(r => [
          String(r.teamId || "missing"),
          {
            team: r.team,
            teamId: r.teamId,
            appearances: playerRows.filter(x =>
              String(x.teamId || "missing") === String(r.teamId || "missing")
            ).length
          }
        ])
      ).values()]
    }, null, 2));
  }
}

main().catch(error => {
  console.error("AUDIT FAILED:", error);
  process.exitCode = 1;
});
