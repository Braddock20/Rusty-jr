export interface Env {
  BETIKA_URL?: string;
  EADRIATIC_MATCHHUB_URL?: string;
  EADRIATIC_SEASON12_URL?: string;
  GT_FIXTURES_URL?: string;
  GT_RECENT_LIMIT?: string;
  GT_DETAIL_LIMIT?: string;
  GT_SCAN_OFFSETS?: string;
  REQUEST_TIMEOUT_MS?: string;
}

export interface BetikaMatch {
  source: "betika";
  id: string;
  home: string;
  away: string;
  homePlayer?: string | null;
  awayPlayer?: string | null;
  homeTeam?: string | null;
  awayTeam?: string | null;
  kickoff: string | null;
  competition: string | null;
  sport?: string | null;
}

export interface HistoricalMatch {
  source: "eadriatic" | "gt";
  id: string;
  kickoff: string | null;
  homePlayer: string | null;
  awayPlayer: string | null;
  homeTeam: string | null;
  awayTeam: string | null;
  homeParticipantId?: string | null;
  awayParticipantId?: string | null;
  homeAffiliation?: string | null;
  awayAffiliation?: string | null;
  homePlayerId?: string | null;
  awayPlayerId?: string | null;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  homeScore: number | null;
  awayScore: number | null;
  status: "finished" | "scheduled" | "unknown";
  competition: string | null;
  sport?: string | null;
}

export interface ProviderResult<T> {
  ok: boolean;
  data: T[];
  error?: string;
  meta?: Record<string, unknown>;
}
