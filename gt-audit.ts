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

  const matches = result.data;
  const players = new Map<string, Set<string>>();
  const teams = new Map<string, Set<string>>();
  const fixtureIds = new Set<string>();

  for (const m of matches) {
    fixtureIds.add(m.id);

    for (const [name, id] of [
      [m.homePlayer || "", m.homePlayerId || ""],
      [m.awayPlayer || "", m.awayPlayerId || ""]
    ]) {
      if (!id) continue;
      if (!players.has(id)) players.set(id, new Set());
      players.get(id)!.add(name);
    }

    for (const [name, id] of [
      [m.homeTeam || "", m.homeTeamId || ""],
      [m.awayTeam || "", m.awayTeamId || ""]
    ]) {
      if (!id) continue;
      if (!teams.has(id)) teams.set(id, new Set());
      teams.get(id)!.add(name);
    }
  }

  const nicknameGroups = new Map<string, Set<string>>();

  for (const [id, names] of players) {
    for (const name of names) {
      const key = name.trim().toLowerCase();
      if (!key) continue;
      if (!nicknameGroups.has(key)) nicknameGroups.set(key, new Set());
      nicknameGroups.get(key)!.add(id);
    }
  }

  const ambiguous = [...nicknameGroups.entries()]
    .filter(([, ids]) => ids.size > 1)
    .map(([nickname, ids]) => ({
      nickname,
      playerIds: [...ids]
    }));

  const dates = matches
    .map(m => m.kickoff)
    .filter((d): d is string => Boolean(d))
    .sort();

  const appearances = new Map<string, number>();
  for (const m of matches) {
    for (const id of [m.homePlayerId, m.awayPlayerId]) {
      if (id) appearances.set(id, (appearances.get(id) || 0) + 1);
    }
  }

  const playerNameConflicts = [...players.entries()]
    .filter(([, names]) => names.size > 1)
    .map(([id, names]) => ({ id, names: [...names] }));

  const teamNameConflicts = [...teams.entries()]
    .filter(([, names]) => names.size > 1)
    .map(([id, names]) => ({ id, names: [...names] }));

  const playerDepth = [...appearances.entries()]
    .map(([id, count]) => ({
      id,
      names: [...(players.get(id) || [])],
      matches: count
    }))
    .sort((a, b) => b.matches - a.matches);

  console.log(JSON.stringify({
    totalFixtures: matches.length,
    uniqueFixtureIds: fixtureIds.size,
    uniquePlayerIds: players.size,
    uniqueTeamIds: teams.size,
    playerDepth: {
      atLeast3: playerDepth.filter(p => p.matches >= 3).length,
      atLeast5: playerDepth.filter(p => p.matches >= 5).length,
      atLeast10: playerDepth.filter(p => p.matches >= 10).length,
      atLeast20: playerDepth.filter(p => p.matches >= 20).length,
      top15: playerDepth.slice(0, 15)
    },
    playerNameConflictCount: playerNameConflicts.length,
    playerNameConflictExamples: playerNameConflicts.slice(0, 20),
    teamNameConflictCount: teamNameConflicts.length,
    teamNameConflictExamples: teamNameConflicts.slice(0, 20),
    ambiguousNicknameCount: ambiguous.length,
    ambiguousNicknameExamples: ambiguous.slice(0, 25),
    oldestKickoff: dates[0] || null,
    newestKickoff: dates.at(-1) || null,
    fixturesWithoutKickoff: matches.length - dates.length,
    providerMeta: result.meta
  }, null, 2));
}

main().catch(console.error);
