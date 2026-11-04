import { getGtHistory } from "./src/providers/gt.ts";

async function main() {
  const env = {
    GT_FIXTURES_URL: "https://api.gtleagues.com/api/fixtures",
    GT_SCAN_OFFSETS: "280000,290000,298000,300000,302000,310000,480000,490000,498000,500000,502000,510000,540000,542000,544000",
    REQUEST_TIMEOUT_MS: "20000"
  } as any;

  const result = await getGtHistory(env);
  if (!result.ok) throw new Error(result.error || "GT history failed");

  const idToNames = new Map<string, Set<string>>();
  const nameToIds = new Map<string, Set<string>>();

  for (const match of result.data) {
    for (const side of ["home", "away"] as const) {
      const id = side === "home" ? match.homeTeamId : match.awayTeamId;
      const name = side === "home" ? match.homeTeam : match.awayTeam;
      if (!id || !name) continue;

      if (!idToNames.has(id)) idToNames.set(id, new Set());
      idToNames.get(id)!.add(name);

      const key = name.trim().toLowerCase();
      if (!nameToIds.has(key)) nameToIds.set(key, new Set());
      nameToIds.get(key)!.add(id);
    }
  }

  const idConflicts = [...idToNames.entries()]
    .filter(([, names]) => names.size > 1)
    .map(([id, names]) => ({ id, names: [...names] }));

  const nameConflicts = [...nameToIds.entries()]
    .filter(([, ids]) => ids.size > 1)
    .map(([name, ids]) => ({ name, ids: [...ids] }));

  console.log(JSON.stringify({
    fixtures: result.data.length,
    uniqueTeamIds: idToNames.size,
    uniqueTeamNames: nameToIds.size,
    idsWithMultipleNames: idConflicts.length,
    namesWithMultipleIds: nameConflicts.length,
    idConflictExamples: idConflicts.slice(0, 20),
    nameConflictExamples: nameConflicts.slice(0, 30)
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
