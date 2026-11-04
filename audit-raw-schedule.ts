const urls = {
  betika: "https://api.betika.com/v1/uo/matches?page=1&limit=100&sport_id=105&period_id=-1",
  season11: "https://api.leaguerepublic.com/json/getMatchHub/656829288.json",
  season12: "https://api.leaguerepublic.com/json/getMatchHub/477927459.json"
};

const targetEadriatic = new Set([
  "45620955", "45620965",
  "45620954", "45620964",
  "45620974", "45620984",
  "45620975", "45620985",
  "45620957", "45620967",
  "45620956", "45620966",
  "45620976", "45620986",
  "45620977", "45620987",
  "45620992", "45621002",
  "45620991", "45621001",
  "45620978", "45620988",
  "45620979", "45620989",
  "45620993", "45621003",
  "45620994", "45621004"
]);

async function getJson(url: string) {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${url}`);
  }

  return response.json();
}

async function main() {
  const [betika, season11, season12] = await Promise.all([
    getJson(urls.betika),
    getJson(urls.season11),
    getJson(urls.season12)
  ]);

  const betikaRows =
    Array.isArray((betika as any)?.data)
      ? (betika as any).data
      : Array.isArray(betika)
        ? betika
        : [];

  console.log("===== RAW BETIKA EADRIATIC FIXTURES =====");

  for (const r of betikaRows) {
    const competition = String(r.competition_name ?? r.category ?? "");
    if (!competition.toLowerCase().includes("eadriatic")) continue;

    console.log(JSON.stringify({
      id: r.match_id ?? r.game_id ?? r.id,
      start_time: r.start_time,
      home_team: r.home_team,
      away_team: r.away_team,
      competition_name: r.competition_name,
      category: r.category,
      status: r.status,
      match_status: r.match_status
    }));
  }

  console.log("===== RAW EADRIATIC MATCH RECORDS =====");

  for (const [season, payload] of [
    ["season11", season11],
    ["season12", season12]
  ] as const) {
    const groups = Array.isArray((payload as any)?.fixtureGroupList)
      ? (payload as any).fixtureGroupList
      : [];

    for (const group of groups) {
      for (const f of group.fixtures ?? []) {
        const id = String(f.fixtureID ?? "");
        if (!targetEadriatic.has(id)) continue;

        console.log(JSON.stringify({
          season,
          group: group.fixtureGroupDesc,
          fixtureID: id,
          fixtureDateInMilliseconds: f.fixtureDateInMilliseconds,
          fixtureDate: f.fixtureDate,
          homeTeam: f.homeTeam,
          roadTeam: f.roadTeam,
          homeTeamName: f.homeTeamName,
          roadTeamName: f.roadTeamName,
          approved: f.approved,
          result: f.result,
          homeScore: f.homeScore,
          roadScore: f.roadScore
        }));
      }
    }
  }
}

main().catch(error => {
  console.error("AUDIT FAILED:", error);
  process.exitCode = 1;
});
