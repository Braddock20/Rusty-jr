import type { Env } from "./types";
import { json } from "./utils";
import { getBetikaMatches } from "./providers/betika";
import { getEadriaticHistory } from "./providers/eadriatic";
import { getGtHistory } from "./providers/gt";
import { analyzeBetikaMatches } from "./intelligence/analyze";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method !== "GET") return json({ error: "Use GET for this API" }, 405);

    if (url.pathname === "/" || url.pathname === "/health") {
      return json({
        name: "eSoccer Intelligence",
        version: "1.0.0",
        status: "ready",
        rules: {
          predictionFixtures: "Betika only",
          betikaOdds: "never fetched into intelligence, used, or returned",
          storage: "none",
          scheduledCollection: "disabled"
        },
        endpoints: ["/health", "/matches", "/analyze"]
      });
    }

    if (url.pathname === "/matches") {
      const result = await getBetikaMatches(env);
      return json({ provider: "betika", ...result }, result.ok ? 200 : 502);
    }

    if (url.pathname === "/analyze") {
      const [betika, eadriatic, gt] = await Promise.all([
        getBetikaMatches(env), getEadriaticHistory(env), getGtHistory(env)
      ]);
      const health = {
        betika: { ok: betika.ok, count: betika.data.length, error: betika.error ?? null },
        eadriatic: { ok: eadriatic.ok, count: eadriatic.data.length, error: eadriatic.error ?? null, meta: eadriatic.meta ?? null },
        gt: { ok: gt.ok, count: gt.data.length, error: gt.error ?? null }
      };
      if (!betika.ok) return json({ error: "Betika fixture retrieval failed", providers: health }, 502);
      const history = [...eadriatic.data, ...gt.data];
      const analyses = analyzeBetikaMatches(betika.data, history, health);
      return json({
        generatedAt: new Date().toISOString(),
        fixtureSource: "Betika",
        oddsUsed: false,
        historicalSources: ["eAdriatic", "GT Sports"],
        providerHealth: health,
        matchCount: analyses.length,
        analyses
      });
    }

    return json({ error: "Not found", available: ["/health", "/matches", "/analyze"] }, 404);
  }
} satisfies ExportedHandler<Env>;
