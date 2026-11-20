[![token-radar-01 bounty](https://make.fun/badge/token-radar-01.svg)](https://make.fun/bounty/token-radar-01)
[![rank](https://make.fun/badge/token-radar-01/Diolyte/token-radar-01/rank.svg)](https://make.fun/bounty/token-radar-01)
[![reward](https://make.fun/badge/token-radar-01/Diolyte/token-radar-01/reward.svg)](https://make.fun/bounty/token-radar-01)

# Ignition — a token launch radar

Ignition ranks the protocols that record no token yet by what a token would be worth if it
launched at the protocol's current scale, and tells the reader, protocol by protocol, whether
farming it is worth the fees and the weeks. It reads only the sealed snapshot
(`/input/snapshot.json`, DefiLlama data as of 2026-11-14): 758 protocols, of which 342 record no
token. The board ranks **192** of them, covers all **40** of the house watchlist, and accounts for
every one of the 758 on the dashboard — priced anchors, tokens recorded without a price, ranked
candidates, and the pre-token protocols screened out as products, each with its reason.

`main.ts` (Node 22, standard library only) writes `/output/board.json`, writes the dashboard's
dataset to `/output/data.js` from the same board, copies `dashboard/` and `screenshots/` to
`/output`, and writes `/output/dossier.json`. The run is deterministic: the same snapshot writes
the same bytes twice.

## The value model

No protocol is priced by hand and no name is special-cased. The model is fitted, tested, and only
then trusted:

- **Anchors.** The 128 protocols whose token already trades with a recorded market cap are the
  only ground truth in the snapshot, so the fit uses them and nothing else.
- **The fit.** `log(market cap) = 6.9646 + 0.5223 × log(TVL)`, least squares over the anchors,
  plus one offset per category: the category's median residual, shrunk toward zero by
  `n / (n + 10)` so a category with two anchors barely moves the line. The slope under 1 is the
  snapshot's own fact: market cap grows slower than TVL. The global median cap/TVL multiple is
  0.2138. Lending's offset is −0.33 (lenders trade cheap against TVL); RWA's is +0.21.
- **Shape.** The fitted value is adjusted by the week's TVL momentum (change clamped to
  −50%…+100%, weight 0.35) and a maturity factor for how long the protocol has run with no token
  (0.85 when new, rising to 1.15 at four years; a protocol with no listing date is scored at one
  year).

## The held-out test

Before the fit ranks anything, it is graded on anchors it never saw. The split is deterministic:
anchors whose slug hashes (FNV-1a) to a multiple of 3 are held out — 86 train, 42 test. The
production fit is then refitted on all 128 anchors with the same recipe.

| Metric (held-out, 42 anchors) | Ignition fit | Naive median multiple |
| --- | ---: | ---: |
| Median absolute error | **81.7%** | 86.2% |
| Log-space R² | **0.265** | 0.069 |
| Priced within 2× | **40.5%** | 31.0% |
| Priced within 3× | **54.8%** | — |

The honest reading: pricing a token off TVL alone is noisy — the typical held-out cap lands
within roughly a factor of two of the fit, not on it. The fit still beats the naive
one-multiple-for-everything model on every metric, and the dashboard publishes this table rather
than hiding it. Implied values are a ranking instrument, not price targets.

## Launch odds

A launch is not certain, so implied value is fitted value × momentum × maturity × **odds**. The
odds are the peers' record: across the snapshot, 54.9% of protocols record a token. Each
candidate's odds blend its own category's token-record rate with its TVL band's rate (bands:
under $25M, $25–100M, $100–500M, $500M+), each shrunk toward the global rate, blended half and
half and clamped to 4%…92%. Dexs peers record tokens 74% of the time; Risk Curators only 13% —
which is why the two biggest curator candidates carry 42% odds and rank below what their raw
fitted value alone would suggest.

## The screen

A protocol is ranked when it records no token and is not visibly a product of one that trades.
The board applies the house's own watchlist screen at every size, not just above the $50M floor:
exchanges (42 set aside), bridge/staking/wrapped-product categories (61), wrapped or staked
product names (20), versioned deployments (11), bare asset tickers for names — WBTC, USDT0 (10),
and exchange-branded products (6): 150 set aside, each reason counted on the dashboard. Every
watchlist slug is ranked regardless of the screen. Language is kept exact throughout: the board
says a protocol *records no token* in the snapshot, never that it has none.

## Farm plans and verdicts

Every row carries a seven-step farm plan generated from the protocol's own record — its category's
real actions (supply and borrow for lenders, swap and provide for dexes, stake and re-use the
receipt for staking, bridge both ways for bridges), its main chain's gas prices, a capital size
scaled to its TVL ($100–$1,000), a weekly cadence and a hold period scaled to its age. Each step
states its cost and its time; no two plans on the board are alike. The last step is the verdict,
and the verdict is arithmetic, not adjectives: the plan's season cost (gas, bridges, ten weeks of
cadence) is estimated chain by chain, and

- **FARM** — implied value ≥ $20M and ≥ 3,000× the season cost (6 protocols),
- **THIN** — implied value ≥ $4M and ≥ 1,200× cover (80),
- **SKIP** — the rest (106): the edge does not justify ten weeks of attention.

## The board's head

| # | Protocol | TVL | Fitted | Odds | Implied | Verdict |
| ---: | --- | ---: | ---: | ---: | ---: | --- |
| 1 | Steakhouse Financial | $2,754M | $107.2M | 42% | $43.2M | FARM |
| 2 | Sentora Curator | $2,758M | $107.2M | 42% | $42.7M | FARM |
| 3 | Gauntlet | $1,578M | $80.1M | 42% | $33.2M | FARM |
| 4 | Polymarket International | $320M | $53.0M | 54% | $32.8M | FARM |
| 5 | USDD | $1,056M | $51.3M | 57% | $28.1M | FARM |

## Run it

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts --input <path-to-snapshot.json>
```

## Files

- `main.ts` — the hand-in program: snapshot in, board, data, dashboard, screenshots and dossier out.
- `lib/model.ts` — the whole model: the fit and its held-out test, the odds tables, the screen,
  the farm-plan generator and the board's own gate checks.
- `dashboard/` — the page: KPI strip, sortable and filterable board, per-protocol detail with the
  model's working and the farm plan, and the method section with the test published.
- `screenshots/` — the board, a detail view, and the method view, rendered from this dashboard.
- `vendor/makefun-board.ts` — make.fun's dossier library, vendored unchanged.
