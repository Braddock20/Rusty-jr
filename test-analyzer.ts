import { getBetikaMatches } from "./src/providers/betika.ts";
import { getGtHistory } from "./src/providers/gt.ts";
import { analyzeBetikaMatches } from "./src/intelligence/analyze.ts";

async function main() {
  const env = {
    BETIKA_URL:
      "https://api.betika.com/v1/uo/matches?page=1&limit=100&sport_id=105&period_id=-1",
    GT_FIXTURES_URL: "https://api.gtleagues.com/api/fixtures",
    GT_RECENT_LIMIT: "100",
    GT_DETAIL_LIMIT: "30",
    REQUEST_TIMEOUT_MS: "20000"
  };

  console.log("Fetching Betika fixtures and GT history...");

  const [betika, gt] = await Promise.all([
    getBetikaMatches(env),
    getGtHistory(env)
  ]);

  console.log("\n========== PROVIDER RESULTS ==========");
  console.log(JSON.stringify({
    betika: {
      ok: betika.ok,
      fixtures: betika.data.length,
      error: betika.error ?? null
    },
    gt: {
      ok: gt.ok,
      historyRecords: gt.data.length,
      error: gt.error ?? null,
      meta: gt.meta ?? null
    },
    eadriatic: "NOT FETCHED"
  }, null, 2));

  if (!betika.ok || !gt.ok) {
    console.log("Test stopped: provider request failed.");
    return;
  }

  const results = analyzeBetikaMatches(
    betika.data,
    gt.data,
    {
      betika: { ok: true },
      gt: { ok: true },
      eadriatic: { ok: false }
    }
  );

  const gtResults = results.filter((r: any) =>
    String(r.match?.competition ?? "").toLowerCase().includes("gt")
  );

  console.log("\n========== ANALYZER SUMMARY ==========");
  console.log(JSON.stringify({
    totalBetikaFixtures: betika.data.length,
    analyzedGtFixtures: gtResults.length,
    gtPredictionsAvailable: gtResults.filter((r: any) =>
      r.prediction?.available === true
    ).length,
    gtPredictionsUnavailable: gtResults.filter((r: any) =>
      r.prediction?.available !== true
    ).length
  }, null, 2));

  console.log("\n========== GT FIXTURE DETAILS ==========");

  for (const r of gtResults) {
    const home = r.playerIntelligence?.home;
    const away = r.playerIntelligence?.away;

    console.log(JSON.stringify({
      fixture: `${r.match?.home} vs ${r.match?.away}`,
      competition: r.match?.competition,
      home: {
        player: home?.player,
        playerId: home?.playerId,
        selectedTeam: home?.selectedTeam,
        overallMatches: home?.overall?.matches,
        selectedTeamHistory: home?.selectedTeamHistory,
        recentForm: home?.recentForm
      },
      away: {
        player: away?.player,
        playerId: away?.playerId,
        selectedTeam: away?.selectedTeam,
        overallMatches: away?.overall?.matches,
        selectedTeamHistory: away?.selectedTeamHistory,
        recentForm: away?.recentForm
      },
      headToHead: r.headToHead,
      prediction: r.prediction,
      dataQuality: r.dataQuality
    }, null, 2));
  }
}

main().catch(error => {
  console.error("TEST ERROR:", error);
  process.exitCode = 1;
});
