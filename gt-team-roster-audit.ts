import type { Env } from "./src/types.ts";
import { getGtHistory } from "./src/providers/gt.ts";

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
  { team: "AC Milan", id: "19" },
  { team: "Como", id: "291" },
  { team: "S.C Freiburg", id: "69" },
  { team: "Panathinaikos", id: "39" },
  { team: "Brighton", id: "144" }
];

async function main() {
  const result = await getGtHistory(env);
  console.log("GT PROVIDER", { ok: result.ok, count: result.data.length });
  if (!result.ok) return;

  const history = result.data.filter(m => m.source === "gt");

  for (const target of targets) {
    const appearances = history.flatMap(m => {
      const rows = [];

      if (String(m.homeTeamId || "") === target.id) {
        rows.push({
          player: m.homePlayer,
          playerId: m.homePlayerId,
          opponent: m.awayTeam,
          opponentPlayer: m.awayPlayer,
          kickoff: m.kickoff
        });
      }

      if (String(m.awayTeamId || "") === target.id) {
        rows.push({
          player: m.awayPlayer,
          playerId: m.awayPlayerId,
          opponent: m.homeTeam,
          opponentPlayer: m.homePlayer,
          kickoff: m.kickoff
        });
      }

      return rows;
    });

    const players = new Map<string, {
      player: string | null;
      playerId: string | null;
      appearances: number;
    }>();

    for (const row of appearances) {
      const key = String(row.playerId || row.player || "unknown");
      const existing = players.get(key);

      if (existing) existing.appearances++;
      else players.set(key, {
        player: row.player || null,
        playerId: row.playerId || null,
        appearances: 1
      });
    }

    console.log("\n===== TEAM ROSTER SAMPLE =====");
    console.log(JSON.stringify({
      team: target.team,
      teamId: target.id,
      fixtureAppearances: appearances.length,
      uniquePlayers: players.size,
      players: [...players.values()].sort(
        (a, b) => b.appearances - a.appearances
      ),
      examples: appearances.slice(0, 5)
    }, null, 2));
  }
}

main().catch(error => {
  console.error("AUDIT FAILED:", error);
  process.exitCode = 1;
});
