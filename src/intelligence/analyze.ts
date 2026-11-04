import type { BetikaMatch, HistoricalMatch } from "../types";
import { cleanName, canonicalTeamName } from "../utils";

type SideHistory = {
  matches: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
};

type PlayerIdentity = {
  records: HistoricalMatch[];
  ambiguous: boolean;
  playerId: string | null;
  identityMethod: string;
};

const MIN_TEAM_SAMPLE = 3;

function empty(): SideHistory {
  return {
    matches: 0,
    wins: 0,
    draws: 0,
    losses: 0,
    goalsFor: 0,
    goalsAgainst: 0
  };
}

function add(h: SideHistory, gf: number, ga: number): void {
  h.matches++;
  h.goalsFor += gf;
  h.goalsAgainst += ga;

  if (gf > ga) h.wins++;
  else if (gf === ga) h.draws++;
  else h.losses++;
}

function round(n: number, digits = 3): number {
  return Number(n.toFixed(digits));
}

function summarize(h: SideHistory) {
  if (!h.matches) {
    return {
      ...h,
      winRate: null,
      avgGoalsFor: null,
      avgGoalsAgainst: null,
      goalDifference: null
    };
  }

  return {
    ...h,
    winRate: round(h.wins / h.matches, 4),
    avgGoalsFor: round(h.goalsFor / h.matches),
    avgGoalsAgainst: round(h.goalsAgainst / h.matches),
    goalDifference: round(
      (h.goalsFor - h.goalsAgainst) / h.matches
    )
  };
}

function getSource(
  competition: string | null
): "gt" | "eadriatic" | null {
  const value = cleanName(competition);

  if (value.includes("gt")) return "gt";
  if (value.includes("eadriatic")) return "eadriatic";

  return null;
}

function isValidFinished(m: HistoricalMatch): boolean {
  return (
    m.status === "finished" &&
    m.homeScore !== null &&
    m.awayScore !== null &&
    Number.isFinite(m.homeScore) &&
    Number.isFinite(m.awayScore)
  );
}

function sidePlayer(
  m: HistoricalMatch,
  side: "home" | "away"
) {
  return side === "home" ? m.homePlayer : m.awayPlayer;
}

function sideTeam(
  m: HistoricalMatch,
  side: "home" | "away"
) {
  return side === "home" ? m.homeTeam : m.awayTeam;
}

function sidePlayerId(
  m: HistoricalMatch,
  side: "home" | "away"
) {
  return side === "home" ? m.homePlayerId : m.awayPlayerId;
}

function sideScores(
  m: HistoricalMatch,
  side: "home" | "away"
) {
  if (side === "home") {
    return {
      goalsFor: m.homeScore!,
      goalsAgainst: m.awayScore!
    };
  }

  return {
    goalsFor: m.awayScore!,
    goalsAgainst: m.homeScore!
  };
}

/**
 * Resolve a Betika player against the selected historical provider.
 *
 * GT: exact normalized nickname must resolve to exactly one
 * verified provider player ID.
 *
 * eAdriatic: exact normalized nickname matching only.
 */
function getPlayerRecords(
  history: HistoricalMatch[],
  source: "gt" | "eadriatic",
  playerName: string
): PlayerIdentity {
  const player = cleanName(playerName);

  if (!player) {
    return {
      records: [],
      ambiguous: false,
      playerId: null,
      identityMethod: "missing player name"
    };
  }

  const sourceRows = history.filter(
    m => m.source === source && isValidFinished(m)
  );

  const namedRows = sourceRows.filter(
    m =>
      cleanName(m.homePlayer) === player ||
      cleanName(m.awayPlayer) === player
  );

  if (source === "gt") {
    const ids = new Set<string>();

    for (const m of namedRows) {
      if (cleanName(m.homePlayer) === player && m.homePlayerId) {
        ids.add(String(m.homePlayerId));
      }

      if (cleanName(m.awayPlayer) === player && m.awayPlayerId) {
        ids.add(String(m.awayPlayerId));
      }
    }

    if (ids.size > 1) {
      return {
        records: [],
        ambiguous: true,
        playerId: null,
        identityMethod: "ambiguous GT player IDs within bounded sample; identity withheld"
      };
    }

    if (ids.size === 0) {
      return {
        records: [],
        ambiguous: false,
        playerId: null,
        identityMethod: "no GT player ID found in bounded sample"
      };
    }

    const playerId = [...ids][0];

    // ID is authoritative. The nickname is no longer used
    // to select historical appearances after identity resolution.
    const records = sourceRows.filter(
      m =>
        String(m.homePlayerId || "") === playerId ||
        String(m.awayPlayerId || "") === playerId
    );

    return {
      records,
      ambiguous: false,
      playerId,
      identityMethod: "unique GT player ID within bounded sample: " + playerId
    };
  }

  return {
    records: namedRows,
    ambiguous: false,
    playerId: null,
    identityMethod: "exact normalized eAdriatic player name"
  };
}

function buildPlayerProfile(
  records: HistoricalMatch[],
  playerName: string,
  selectedTeam: string | null,
  source: "gt" | "eadriatic",
  playerId: string | null,
  providerAvailable: boolean
) {
  const player = cleanName(playerName);
  const selected = canonicalTeamName(selectedTeam);

  const overall = empty();
  const selectedStats = empty();
  const byTeam = new Map<string, { team: string; stats: SideHistory }>();

  const appearances: Array<{
    kickoff: string | null;
    team: string | null;
    goalsFor: number;
    goalsAgainst: number;
    result: "win" | "draw" | "loss";
    opponent: string | null;
  }> = [];
  const selectedTeamAppearances: typeof appearances = [];

  for (const m of records) {
    for (const side of ["home", "away"] as const) {
      const isThisPlayer =
        source === "gt"
          ? Boolean(playerId) &&
            String(sidePlayerId(m, side) || "") === playerId
          : cleanName(sidePlayer(m, side)) === player;

      if (!isThisPlayer) continue;

      const teamName = sideTeam(m, side);
      const teamKey = canonicalTeamName(teamName);
      const scores = sideScores(m, side);

      add(overall, scores.goalsFor, scores.goalsAgainst);

      const displayTeam = teamName || "team unknown";

      if (!byTeam.has(teamKey)) {
        byTeam.set(teamKey, {
          team: displayTeam,
          stats: empty()
        });
      }

      add(
        byTeam.get(teamKey)!.stats,
        scores.goalsFor,
        scores.goalsAgainst
      );

      if (selected && teamKey === selected) {
        add(selectedStats, scores.goalsFor, scores.goalsAgainst);
      }

      appearances.push({
        kickoff: m.kickoff,
        team: teamName,
        goalsFor: scores.goalsFor,
        goalsAgainst: scores.goalsAgainst,
        result:
          scores.goalsFor > scores.goalsAgainst
            ? "win"
            : scores.goalsFor === scores.goalsAgainst
              ? "draw"
              : "loss",
        opponent:
          side === "home" ? m.awayPlayer : m.homePlayer
      });
      if (selected && teamKey === selected) {
        selectedTeamAppearances.push(appearances[appearances.length - 1]);
      }
    }
  }

  const newestFirst = (a: { kickoff: string | null }, b: { kickoff: string | null }) =>
    String(b.kickoff || "").localeCompare(String(a.kickoff || ""));

  appearances.sort(newestFirst);
  selectedTeamAppearances.sort(newestFirst);

  const recent = appearances.slice(0, 5);
  const recentStats = empty();

  for (const item of recent) {
    add(recentStats, item.goalsFor, item.goalsAgainst);
  }
  const selectedRecent = selectedTeamAppearances.slice(0, 5);
  const selectedRecentStats = empty();

  for (const item of selectedRecent) {
    add(selectedRecentStats, item.goalsFor, item.goalsAgainst);
  }

  return {
    overall: summarize(overall),
    selectedTeam: {
      team: selectedTeam,
      exactTeamMatchRequired: false,
      teamMatchPolicy: "explicit canonical aliases; no fuzzy matching",
      available: providerAvailable && selectedStats.matches > 0,
      status: !providerAvailable
        ? "provider_unavailable"
        : overall.matches === 0
          ? "no_player_history_in_sample"
          : selectedStats.matches === 0
            ? "no_matching_selected_team_history"
            : "available",
      reason: !providerAvailable
        ? "Historical provider is unavailable; absence of records cannot be confirmed"
        : overall.matches === 0
          ? "No completed history for this player was found in the available sample"
          : selectedStats.matches === 0
            ? "Player history exists, but no completed matches were found for this team or its recognized aliases"
            : null,
      stats: summarize(selectedStats)
    },
    byTeam: [...byTeam.values()]
      .map(({ team, stats }) => ({
        team,
        context: selected && canonicalTeamName(team) === selected
          ? "selected_team"
          : "other_team",
        ...summarize(stats)
      }))
      .sort((a, b) => b.matches - a.matches),
    previousTeamHistory: [...byTeam.values()]
      .filter(({ team }) => !selected || canonicalTeamName(team) !== selected)
      .map(({ team, stats }) => ({
        team,
        ...summarize(stats)
      }))
      .sort((a, b) => b.matches - a.matches),
    recentForm: {
      lastFive: recent,
      stats: summarize(recentStats),
      selectedTeamLastFive: selectedRecent,
      selectedTeamStats: summarize(selectedRecentStats),
      selectedTeam: selectedTeam
    }
  };
}

function headToHead(
  history: HistoricalMatch[],
  source: "gt" | "eadriatic",
  homePlayer: string,
  awayPlayer: string,
  homePlayerId: string | null,
  awayPlayerId: string | null,
  selectedHomeTeam: string | null,
  selectedAwayTeam: string | null,
  providerAvailable: boolean
) {
  const home = cleanName(homePlayer);
  const away = cleanName(awayPlayer);

  const emptyResult = {
    matches: 0,
    available: false,
    reason: "No verified historical meetings found in the available sample",
    homePlayerRecord: summarize(empty()),
    selectedTeamMatches: 0,
    selectedTeamAvailable: false,
    selectedTeamRecord: summarize(empty()),
    crossTeamMatches: 0,
    unclassifiedMatches: 0,
    recentMeetings: [],
    recentSelectedTeamMeetings: [],
    recentCrossTeamMeetings: []
  };

  if (!providerAvailable) {
    return {
      ...emptyResult,
      reason: "Historical provider unavailable; head-to-head evidence could not be checked"
    };
  }

  if (
    source === "gt" &&
    (!homePlayerId || !awayPlayerId || homePlayerId === awayPlayerId)
  ) {
    return {
      ...emptyResult,
      reason: "Both GT player identities must be verified"
    };
  }

  const rows = history.filter(m => {
    if (m.source !== source || !isValidFinished(m)) return false;

    if (source === "gt") {
      const hp = String(m.homePlayerId || "");
      const ap = String(m.awayPlayerId || "");
      return (
        (hp === homePlayerId && ap === awayPlayerId) ||
        (hp === awayPlayerId && ap === homePlayerId)
      );
    }

    const hp = cleanName(m.homePlayer);
    const ap = cleanName(m.awayPlayer);
    return (
      (hp === home && ap === away) ||
      (hp === away && ap === home)
    );
  });

  const stats = empty();
  const selectedStats = empty();
  const selectedRows: HistoricalMatch[] = [];
  const crossRows: HistoricalMatch[] = [];
  const unknownRows: HistoricalMatch[] = [];

  const classifiedRows = rows.map(m => {
    const homeIsHomeSide =
      source === "gt"
        ? String(m.homePlayerId || "") === homePlayerId
        : cleanName(m.homePlayer) === home;

    const homeTeamForPlayer = homeIsHomeSide ? m.homeTeam : m.awayTeam;
    const awayTeamForPlayer = homeIsHomeSide ? m.awayTeam : m.homeTeam;

    add(
      stats,
      homeIsHomeSide ? m.homeScore! : m.awayScore!,
      homeIsHomeSide ? m.awayScore! : m.homeScore!
    );

    let teamContext: "same_selected_teams" | "different_teams" | "unknown";

    if (!selectedHomeTeam || !selectedAwayTeam ||
        !homeTeamForPlayer || !awayTeamForPlayer) {
      teamContext = "unknown";
      unknownRows.push(m);
    } else if (
      canonicalTeamName(homeTeamForPlayer) === canonicalTeamName(selectedHomeTeam) &&
      canonicalTeamName(awayTeamForPlayer) === canonicalTeamName(selectedAwayTeam)
    ) {
      teamContext = "same_selected_teams";
      selectedRows.push(m);
      add(
        selectedStats,
        homeIsHomeSide ? m.homeScore! : m.awayScore!,
        homeIsHomeSide ? m.awayScore! : m.homeScore!
      );
    } else {
      teamContext = "different_teams";
      crossRows.push(m);
    }

    return {
      date: m.kickoff,
      homePlayer: m.homePlayer,
      awayPlayer: m.awayPlayer,
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      homePlayerTeam: homeTeamForPlayer,
      awayPlayerTeam: awayTeamForPlayer,
      score: `${m.homeScore}-${m.awayScore}`,
      teamContext
    };
  });

  const recent = (items: HistoricalMatch[]) =>
    items
      .slice()
      .sort((a, b) =>
        String(b.kickoff || "").localeCompare(String(a.kickoff || ""))
      )
      .slice(0, 5)
      .map(m => {
        const homeIsHomeSide =
          source === "gt"
            ? String(m.homePlayerId || "") === homePlayerId
            : cleanName(m.homePlayer) === home;

        const homePlayerTeam = homeIsHomeSide ? m.homeTeam : m.awayTeam;
        const awayPlayerTeam = homeIsHomeSide ? m.awayTeam : m.homeTeam;

        const teamContext =
          !selectedHomeTeam || !selectedAwayTeam ||
          !homePlayerTeam || !awayPlayerTeam
            ? "unknown"
            : canonicalTeamName(homePlayerTeam) === canonicalTeamName(selectedHomeTeam) &&
              canonicalTeamName(awayPlayerTeam) === canonicalTeamName(selectedAwayTeam)
              ? "same_selected_teams"
              : "different_teams";

        return {
          date: m.kickoff,
          homePlayer: m.homePlayer,
          awayPlayer: m.awayPlayer,
          homeTeam: m.homeTeam,
          awayTeam: m.awayTeam,
          homePlayerTeam,
          awayPlayerTeam,
          score: `${m.homeScore}-${m.awayScore}`,
          teamContext
        };
      });

  return {
    matches: rows.length,
    available: rows.length > 0,
    reason: rows.length > 0
      ? null
      : "No verified historical meetings found in the available sample",
    homePlayerRecord: summarize(stats),
    selectedTeamMatches: selectedRows.length,
    selectedTeamAvailable: selectedRows.length > 0,
    selectedTeamRecord: summarize(selectedStats),
    crossTeamMatches: crossRows.length,
    unclassifiedMatches: unknownRows.length,
    recentMeetings: classifiedRows
      .slice()
      .sort((a, b) =>
        String(b.date || "").localeCompare(String(a.date || ""))
      )
      .slice(0, 5),
    recentSelectedTeamMeetings: recent(selectedRows),
    recentCrossTeamMeetings: recent(crossRows)
  };
}

function poisson(lambda: number, goals: number): number {
  let probability = Math.exp(-lambda);

  for (let i = 1; i <= goals; i++) {
    probability *= lambda / i;
  }

  return probability;
}

function outcomeProbabilities(homeAvg: number, awayAvg: number) {
  let home = 0;
  let draw = 0;
  let away = 0;

  for (let h = 0; h <= 10; h++) {
    for (let a = 0; a <= 10; a++) {
      const probability =
        poisson(homeAvg, h) * poisson(awayAvg, a);

      if (h > a) home += probability;
      else if (h === a) draw += probability;
      else away += probability;
    }
  }

  const total = home + draw + away || 1;

  return {
    home: round(home / total, 4),
    draw: round(draw / total, 4),
    away: round(away / total, 4)
  };
}

function predict(
  home: ReturnType<typeof buildPlayerProfile>,
  away: ReturnType<typeof buildPlayerProfile>
) {
  const homeTeam = home.selectedTeam.stats;
  const awayTeam = away.selectedTeam.stats;

  const homeSample = homeTeam.matches;
  const awaySample = awayTeam.matches;

  if (
    homeSample < MIN_TEAM_SAMPLE ||
    awaySample < MIN_TEAM_SAMPLE ||
    homeTeam.avgGoalsFor === null ||
    homeTeam.avgGoalsAgainst === null ||
    awayTeam.avgGoalsFor === null ||
    awayTeam.avgGoalsAgainst === null
  ) {
    return {
      available: false,
      method: "selected-team historical evidence insufficient",
      probabilities: null,
      mostLikelyOutcome: null,
      confidence: "not rated",
      evidence: {
        homeSelectedTeamMatches: homeSample,
        awaySelectedTeamMatches: awaySample,
        minimumRequiredPerPlayer: MIN_TEAM_SAMPLE
      }
    };
  }

  const homeLambda = Math.max(
    0.15,
    homeTeam.avgGoalsFor * 0.55 +
      awayTeam.avgGoalsAgainst * 0.45
  );

  const awayLambda = Math.max(
    0.15,
    awayTeam.avgGoalsFor * 0.55 +
      homeTeam.avgGoalsAgainst * 0.45
  );

  const probabilities = outcomeProbabilities(
    homeLambda,
    awayLambda
  );

  const mostLikelyOutcome = Object.entries(probabilities)
    .sort((a, b) => b[1] - a[1])[0][0];

  const smallestSample = Math.min(homeSample, awaySample);

  return {
    available: true,
    method: "selected-team goal rates with opposing selected-team defence",
    expectedGoals: {
      home: round(homeLambda),
      away: round(awayLambda)
    },
    probabilities,
    mostLikelyOutcome,
    confidence: smallestSample >= 8 ? "moderate" : "low",
    evidence: {
      homeSelectedTeamMatches: homeSample,
      awaySelectedTeamMatches: awaySample,
      minimumRequiredPerPlayer: MIN_TEAM_SAMPLE
    },
    limitations: [
      "Historical sample size limits reliability",
      "Explicit canonical team aliases are supported; fuzzy matching is disabled",
      "Probabilities are statistical estimates, not guarantees"
    ]
  };
}

export function analyzeBetikaMatches(
  matches: BetikaMatch[],
  history: HistoricalMatch[],
  providerHealth: Record<string, unknown>
) {
  return matches.map(match => {
    const source = getSource(match.competition);

    if (!source) {
      return {
        match,
        prediction: {
          available: false,
          method: "unsupported or unidentified competition",
          probabilities: null,
          mostLikelyOutcome: null,
          confidence: "not rated"
        },
        dataQuality: {
          reason: "Competition could not be mapped to a historical provider"
        },
        providerHealth
      };
    }

    const homePlayer = match.homePlayer || "";
    const awayPlayer = match.awayPlayer || "";
    const sourceHealth = providerHealth[source] as
      | { ok?: boolean }
      | undefined;
    const providerAvailable = sourceHealth?.ok === true;

    const homeIdentity = getPlayerRecords(
      history,
      source,
      homePlayer
    );

    const awayIdentity = getPlayerRecords(
      history,
      source,
      awayPlayer
    );

    const homeProfile = buildPlayerProfile(
      homeIdentity.records,
      homePlayer,
      match.homeTeam || null,
      source,
      homeIdentity.playerId,
      providerAvailable
    );

    const awayProfile = buildPlayerProfile(
      awayIdentity.records,
      awayPlayer,
      match.awayTeam || null,
      source,
      awayIdentity.playerId,
      providerAvailable
    );

    const prediction =
      !providerAvailable
        ? {
            available: false,
            method: "historical provider unavailable",
            probabilities: null,
            mostLikelyOutcome: null,
            confidence: "not rated",
            evidence: {
              provider: source,
              reason: "Historical data could not be retrieved for this analysis"
            }
          }
        : homeIdentity.ambiguous || awayIdentity.ambiguous
        ? {
            available: false,
            method: "ambiguous player identity",
            probabilities: null,
            mostLikelyOutcome: null,
            confidence: "not rated",
            evidence: {
              homeIdentityAmbiguous: homeIdentity.ambiguous,
              awayIdentityAmbiguous: awayIdentity.ambiguous
            }
          }
        : source === "gt" &&
            (!homeIdentity.playerId || !awayIdentity.playerId)
          ? {
              available: false,
              method: "verified GT player identity unavailable",
              probabilities: null,
              mostLikelyOutcome: null,
              confidence: "not rated",
              evidence: {
                homePlayerId: homeIdentity.playerId,
                awayPlayerId: awayIdentity.playerId,
                homeIdentityMethod: homeIdentity.identityMethod,
                awayIdentityMethod: awayIdentity.identityMethod
              }
            }
          : predict(homeProfile, awayProfile);

    return {
      match,
      historicalProvider: source,
      prediction,
      playerIntelligence: {
        home: {
          player: homePlayer || null,
          playerId: homeIdentity.playerId,
          selectedTeam: match.homeTeam || null,
          identityMethod: homeIdentity.identityMethod,
          overall: homeProfile.overall,
          selectedTeamHistory: homeProfile.selectedTeam,
          previousTeamHistory: homeProfile.previousTeamHistory,
          byTeam: homeProfile.byTeam,
          recentForm: homeProfile.recentForm
        },
        away: {
          player: awayPlayer || null,
          playerId: awayIdentity.playerId,
          selectedTeam: match.awayTeam || null,
          identityMethod: awayIdentity.identityMethod,
          overall: awayProfile.overall,
          selectedTeamHistory: awayProfile.selectedTeam,
          previousTeamHistory: awayProfile.previousTeamHistory,
          byTeam: awayProfile.byTeam,
          recentForm: awayProfile.recentForm
        }
      },
      headToHead: headToHead(
        history,
        source,
        homePlayer,
        awayPlayer,
        homeIdentity.playerId,
        awayIdentity.playerId,
        match.homeTeam || null,
        match.awayTeam || null,
        providerAvailable
      ),
      dataQuality: {
        historicalProviderAvailable: providerAvailable,
        historicalProviderUsed: source,
        crossProviderMixing: false,
        exactPlayerNameMatching: true,
        gtIdentityUsesUniqueSamplePlayerId: source === "gt",
        exactTeamNameMatching: false,
        canonicalTeamAliasMatching: true,
        fuzzyMatching: false,
        homeIdentityAmbiguous: homeIdentity.ambiguous,
        awayIdentityAmbiguous: awayIdentity.ambiguous,
        gtHistoryCompleteness:
          source === "gt"
            ? "Bounded sampled GT catalogue pages; not complete player career history"
            : null,
        warning:
          "GT identities must resolve to one provider player ID within the bounded sample. eAdriatic uses exact player names. Explicit canonical team aliases are recognized. Fuzzy matching is disabled. Missing or mismatched team evidence is never substituted with another team's results."
      },
      providerHealth
    };
  });
}
