import type { Env, BetikaMatch, ProviderResult } from "../types";
import { asText, parseDate, fetchJson } from "../utils";

function splitParticipant(value: unknown) {
  const raw = asText(value) || "";
  const match = raw.match(/^(.*?)\s*\(([^()]*)\)\s*$/);

  if (!match) {
    return {
      team: raw || null,
      player: null
    };
  }

  return {
    team: match[1].trim() || null,
    player: match[2].trim() || null
  };
}

export async function getBetikaMatches(
  env: Env
): Promise<ProviderResult<BetikaMatch>> {
  const url = env.BETIKA_URL;

  if (!url) {
    return {
      ok: false,
      data: [],
      error: "BETIKA_URL is not configured"
    };
  }

  try {
    const payload = await fetchJson(
      url,
      Number(env.REQUEST_TIMEOUT_MS || 12000),
      {
        origin: "https://www.betika.com",
        referer: "https://www.betika.com/"
      }
    );

    const rows = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.data)
        ? payload.data
        : [];

    const data: BetikaMatch[] = rows.map((r: any) => {
      const homeRaw = asText(r.home_team) || "";
      const awayRaw = asText(r.away_team) || "";

      const home = splitParticipant(homeRaw);
      const away = splitParticipant(awayRaw);

      return {
        source: "betika",
        id: String(r.match_id ?? r.game_id ?? r.id ?? ""),
        home: homeRaw,
        away: awayRaw,
        homePlayer: home.player,
        awayPlayer: away.player,
        homeTeam: home.team,
        awayTeam: away.team,
        kickoff: parseDate(r.start_time),
        competition: asText(r.competition_name ?? r.category)
      };
    }).filter((m: BetikaMatch) => m.id && m.home && m.away);

    return {
      ok: true,
      data,
      meta: {
        returned: data.length,
        oddsUsed: false
      }
    };
  } catch (e) {
    return {
      ok: false,
      data: [],
      error: e instanceof Error ? e.message : String(e)
    };
  }
}
