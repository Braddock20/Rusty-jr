# eSoccer Intelligence — Version 1

A clean Cloudflare Worker project. It uses Betika only for upcoming prediction fixtures, and eAdriatic + GT Sports as historical evidence sources.

## Strict project rules
- Betika supplies the only fixtures shown for prediction.
- Betika odds are deliberately discarded and never enter the analysis.
- No database, KV, R2, Cron, scheduled collection, or automatic historical backfill.
- Every `/analyze` request fetches provider data live.
- Player histories are separated by team where the source exposes player and team identity.
- Insufficient evidence must remain un-rated; it must not be replaced with fabricated certainty.

## Endpoints
- `GET /health` — project status and rules.
- `GET /matches` — current Betika eSoccer fixtures only.
- `GET /analyze` — Betika fixtures analysed against currently retrievable eAdriatic and GT history.

## Run in Termux
```sh
pkg update -y
pkg install nodejs-lts git unzip -y
# Extract this project, then:
cd esoccer-intelligence
npm install
npx wrangler login
npm run dev
```

Open the local URL printed by Wrangler and test `/health`, `/matches`, then `/analyze`.

## Deploy
```sh
npx wrangler deploy
```

## Configuration
Edit `wrangler.toml` if provider endpoints or season IDs change.
`EADRIATIC_MATCHHUB_URL` currently points to the MatchHub season endpoint previously tested:
`656829288`.

GT's fixture endpoint reports a total count. The collector probes that count and requests the last `GT_RECENT_LIMIT` records because the provider's first page was observed to contain old 2020 records. This is a best-effort recent window, not proof that all GT eSoccer history is included.

## Important limitations in this first runnable foundation
1. Provider schemas and status flags are not fully consistent. eAdriatic records with ambiguous status are deliberately not treated as finished unless status/result fields support it.
2. The initial player identity match is exact normalized name matching. It does not merge similar names automatically. A later mapping layer should use provider IDs and verified aliases.
3. eAdriatic's tested detail endpoint returned no player statistics for the sample fixture. This build uses the player/team fields available in fixture records.
4. GT may return multiple sports and competitions. A production-ready filter must be validated against the actual eSoccer category metadata before relying on its entire returned page.
5. The Poisson model is a transparent baseline, not a trained or backtested model. Treat probabilities as experimental until provider matching, competition filters, and historical coverage are verified.
6. No Betika odds, odds-derived features, or odds fields are used or returned.

## Next validation steps
- Verify the live `/matches` output contains only eSoccer Betika fixtures.
- Inspect `/analyze` provider counts and sample records.
- Validate GT eSoccer filtering and player/team field mappings.
- Validate eAdriatic final-result status handling.
- Add a verified cross-provider player/team identity map before expanding prediction markets.
