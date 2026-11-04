import { getGtHistory } from "./src/providers/gt.ts";
import type { Env } from "./src/types.ts";

const env: Env = {
  GT_FIXTURES_URL: "https://api.gtleagues.com/api/fixtures",
  GT_SCAN_OFFSETS:
    "280000,290000,298000,300000,302000,310000,480000,490000,498000,500000,502000,510000,540000,542000,544000",
  REQUEST_TIMEOUT_MS: "12000"
};

async function main() {
  const result = await getGtHistory(env);

  if (!result.ok) {
    console.log("GT AUDIT FAILED:", result.error);
    return;
  }

  const playerTeams = new Map<string, Map<string, number>>();
  const playerNames = new Map<string, string>();
  const teamNames = new Map<string, string>();

  for (const m of result.data) {
    const sides = [
      { playerId: m.homePlayerId, player: m.homePlayer, teamId: m.homeTeamId, team: m.homeTeam },
      { playerId: m.awayPlayerId, player: m.awayPlayer, teamId: m.awayTeamId, team: m.awayTeam }
    ];

    for (const side of sides) {
      if (!side.playerId || !side.teamId) continue;

      playerNames.set(side.playerId, side.player || "Unknown");
      teamNames.set(side.teamId, side.team || "Unknown");

      if (!playerTeams.has(side.playerId)) {
        playerTeams.set(side.playerId, new Map());
      }

      const teams = playerTeams.get(side.playerId)!;
      teams.set(side.teamId, (teams.get(side.teamId) || 0) + 1);
    }
  }

  const profiles = [...playerTeams.entries()].map(([id, teams]) => {
    const sorted = [...teams.entries()]
      .map(([teamId, matches]) => ({
        teamId,
        team: teamNames.get(teamId),
        matches
      }))
      .sort((a, b) => b.matches - a.matches);

    return {
      playerId: id,
      player: playerNames.get(id),
      totalMatches: sorted.reduce((sum, t) => sum + t.matches, 0),
      teamCount: sorted.length,
      teamsWith3Plus: sorted.filter(t => t.matches >= 3).length,
      teams: sorted
    };
  }).sort((a, b) => b.totalMatches - a.totalMatches);

  console.log(JSON.stringify({
    players: profiles.length,
    playersWithMultipleTeams: profiles.filter(p => p.teamCount > 1).length,
    playersWith3PlusMatchesOnAnyTeam: profiles.filter(p =>
      p.teams.some(t => t.matches >= 3)
    ).length,
    playersWith3PlusOnMultipleTeams: profiles.filter(p =>
      p.teamsWith3Plus >= 2
    ).length,
    playersWith10PlusOnOneTeam: profiles.filter(p =>
      p.teams.some(t => t.matches >= 10)
    ).length,
    playersWith20PlusOnOneTeam: profiles.filter(p =>
      p.teams.some(t => t.matches >= 20)
    ).length,
    top15PlayerTeamProfiles: profiles.slice(0, 15),
    providerMeta: result.meta
  }, null, 2));
}

main().catch(console.error);
