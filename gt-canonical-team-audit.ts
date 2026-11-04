import { getGtHistory } from "./src/providers/gt.ts";
import { canonicalTeamName } from "./src/utils.ts";

async function main() {
  const env = {
    GT_FIXTURES_URL: "https://api.gtleagues.com/api/fixtures",
    GT_SCAN_OFFSETS: "280000,290000,298000,300000,302000,310000,480000,490000,498000,500000,502000,510000,540000,542000,544000",
    REQUEST_TIMEOUT_MS: "20000"
  } as any;

  const result = await getGtHistory(env);
  if (!result.ok) throw new Error(result.error || "GT history failed");

  const canonicalToIds = new Map<string, Set<string>>();
  const canonicalToNames = new Map<string, Set<string>>();

  for (const match of result.data) {
    for (const side of ["home", "away"] as const) {
      const id = side === "home" ? match.homeTeamId : match.awayTeamId;
      const name = side === "home" ? match.homeTeam : match.awayTeam;
      if (!id || !name) continue;

      const key = canonicalTeamName(name);

      if (!canonicalToIds.has(key)) canonicalToIds.set(key, new Set());
      if (!canonicalToNames.has(key)) canonicalToNames.set(key, new Set());

      canonicalToIds.get(key)!.add(id);
      canonicalToNames.get(key)!.add(name);
    }
  }

  const conflicts = [...canonicalToIds.entries()]
    .filter(([, ids]) => ids.size > 1)
    .map(([canonicalName, ids]) => ({
      canonicalName,
      ids: [...ids],
      names: [...(canonicalToNames.get(canonicalName) || [])]
    }));

  console.log(JSON.stringify({
    canonicalTeamGroups: canonicalToIds.size,
    ambiguousCanonicalNames: conflicts.length,
    conflicts
  }, null, 2));
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
