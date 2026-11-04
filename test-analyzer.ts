import type { Env } from "./src/types.ts";
import { getBetikaMatches } from "./src/providers/betika.ts";
import { getGtHistory } from "./src/providers/gt.ts";
import { getEadriaticHistory } from "./src/providers/eadriatic.ts";
import { analyzeBetikaMatches } from "./src/intelligence/analyze.ts";

const env: Env = {
  BETIKA_URL:
    "https://api.betika.com/v1/uo/matches?page=1&limit=100&sport_id=105&period_id=-1",
  EADRIATIC_MATCHHUB_URL:
    "https://api.leaguerepublic.com/json/getMatchHub/656829288.json",
  EADRIATIC_SEASON12_URL:
    "https://api.leaguerepublic.com/json/getMatchHub/477927459.json",
  GT_FIXTURES_URL:
    "https://api.gtleagues.com/api/fixtures",
  GT_RECENT_LIMIT: "500",
  REQUEST_TIMEOUT_MS: "12000",
  GT_SCAN_OFFSETS:
    "280000,290000,298000,300000,302000,310000,480000,490000,498000,500000,502000,510000,540000,542000,544000"
};

async function main() {
  console.log("===== FETCHING PROVIDERS =====");

  const [betika, gt, eadriatic] = await Promise.all([
    getBetikaMatches(env),
    getGtHistory(env),
    getEadriaticHistory(env)
  ]);

  console.log(JSON.stringify({
    providerStatus: {
      betika: betika.ok,
      gt: gt.ok,
      eadriatic: eadriatic.ok
    },
    providerErrors: {
      betika: betika.error || null,
      gt: gt.error || null,
      eadriatic: eadriatic.error || null
    },
    counts: {
      betikaFixtures: betika.data.length,
      gtHistory: gt.data.length,
      eadriaticHistory: eadriatic.data.length
    },
    providerMeta: {
      gt: gt.meta || null,
      eadriatic: eadriatic.meta || null
    }
  }, null, 2));

  const history = [...gt.data, ...eadriatic.data];

  const report = analyzeBetikaMatches(
    betika.data,
    history,
    {
      betika: { ok: betika.ok },
      gt: { ok: gt.ok },
      eadriatic: { ok: eadriatic.ok }
    }
  );

  console.log("\n===== ANALYZER RESULTS =====");

  for (const item of report) {
    const intelligence = item.playerIntelligence as any;
    const prediction = item.prediction as any;

    console.log(JSON.stringify({
      fixture: {
        competition: item.match.competition,
        kickoff: item.match.kickoff,
        home: item.match.home,
        away: item.match.away,
        homePlayer: item.match.homePlayer,
        awayPlayer: item.match.awayPlayer,
        homeTeam: item.match.homeTeam,
        awayTeam: item.match.awayTeam
      },
      provider: item.historicalProvider || null,
      prediction: {
        available: prediction.available,
        method: prediction.method,
        outcome: prediction.mostLikelyOutcome,
        confidence: prediction.confidence,
        probabilities: prediction.probabilities
      },
      home: intelligence ? {
        player: intelligence.home.player,
        playerId: intelligence.home.playerId,
        selectedTeam: intelligence.home.selectedTeam,
        overall: intelligence.home.overall,
        selectedTeamHistory: intelligence.home.selectedTeamHistory,
        previousTeamHistory: intelligence.home.previousTeamHistory,
        recentForm: intelligence.home.recentForm,
        byTeam: intelligence.home.byTeam
      } : null,
      away: intelligence ? {
        player: intelligence.away.player,
        playerId: intelligence.away.playerId,
        selectedTeam: intelligence.away.selectedTeam,
        overall: intelligence.away.overall,
        selectedTeamHistory: intelligence.away.selectedTeamHistory,
        previousTeamHistory: intelligence.away.previousTeamHistory,
        recentForm: intelligence.away.recentForm,
        byTeam: intelligence.away.byTeam
      } : null,
      dataQuality: item.dataQuality
    }, null, 2));
  }

  console.log("\n===== ODDS POLICY =====");
  console.log(JSON.stringify({
    oddsUsed: false,
    betikaUsedFor: "Current fixtures only",
    historicalEvidence: "GT and eAdriatic",
    minimumSelectedTeamSample: 3
  }, null, 2));
}

main().catch(error => {
  console.error("TEST FAILED:", error);
  process.exitCode = 1;
});
