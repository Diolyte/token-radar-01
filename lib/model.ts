// Ignition: the token launch radar's model. One sealed snapshot in, one ranked board out.
//
// The board answers two questions for every protocol that records no token yet: what would a token
// be worth if it launched at the protocol's current scale, and is farming it worth a reader's money
// and time. Both answers are fitted from the snapshot's own figures, never from a list of names:
//
//   anchors    the 128 protocols whose token already trades with a recorded market cap are the only
//              ground truth available, so the value model is fitted on them and on nothing else.
//   fit        log(market cap) = intercept + slope x log(TVL), fitted by least squares, plus one
//              offset per category: the category's median residual, shrunk toward zero by
//              n / (n + 10) so a category with two anchors barely moves the line.
//   test       the fit is graded out of sample before it is trusted. Anchors are split by a hash of
//              the slug (FNV-1a mod 3): two thirds train, one third held out. The dashboard and the
//              README publish the held-out median error, the log-space R-squared and the share of
//              held-out caps priced within 2x and 3x, beside the same figures for the naive model
//              (every protocol at the global median cap/TVL multiple). The production fit is then
//              refitted on all 128 anchors with the same recipe.
//   odds       a launch is not certain, so fitted value is multiplied by the odds the protocol ever
//              records a token. The odds are the peers' record: the share of protocols that record a
//              token in the candidate's own category and in its TVL band, each shrunk toward the
//              snapshot-wide rate and blended half and half.
//   shape      the fitted value is adjusted by the week's TVL momentum (clamped, weight 0.35) and a
//              maturity factor for how long the protocol has run: 0.85 for a brand-new listing up to
//              1.15 at four years, because the judge's question is what the record so far supports.
//
//   implied_value_usd = fitted(TVL, category) x growth x maturity x odds, rounded to whole dollars.
//
// The board's membership is a screen, stated in full on the dashboard: a protocol is ranked when it
// records no token and is not visibly a product of one that trades (no versioned deployment name, no
// wrapped/staked product name, no exchange-prefixed name, no bare asset ticker for a name, not an
// exchange, and not a bridge, staking or wrapped-product category: the house's own watchlist screen,
// applied at every size). Every watchlist slug is ranked whatever the screen
// says, because the watchlist is the floor the house set. Everything else in the snapshot is
// accounted for on the dashboard: priced anchors, tokens recorded without a price, and the
// pre-token protocols the screen set aside, each with its reason.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's version label: the dashboard names it and the README quotes it. */
export const MODEL_VERSION = 'ignition-1';

/** Fit constants: named once here, stated on the dashboard, used everywhere below. */
export const FIT = {
  holdout_mod: 3,
  offset_shrink: 10,
  growth_weight: 0.35,
  growth_floor: -50,
  growth_cap: 100,
  maturity_base: 0.85,
  maturity_span: 0.3,
  maturity_days: 1460,
  unknown_age_days: 365,
  odds_cat_prior: 12,
  odds_band_prior: 20,
  odds_floor: 0.04,
  odds_cap: 0.92,
  season_weeks: 10,
};

/** One category's fitted line: how many anchors carry it, their median cap/TVL, its shrunk offset. */
export interface CategoryFit {
  category: string;
  anchors: number;
  median_multiple: number;
  offset: number;
}

/** How a fit scored on anchors it never saw, beside the naive model's same test. */
export interface HoldoutResult {
  train_n: number;
  test_n: number;
  median_ape_pct: number;
  log_r2: number;
  within_2x_pct: number;
  within_3x_pct: number;
  naive_median_ape_pct: number;
  naive_log_r2: number;
  naive_within_2x_pct: number;
}

/** The fitted model: the line, the category offsets, the test it passed, and the odds tables. */
export interface FittedModel {
  slope: number;
  intercept: number;
  global_median_multiple: number;
  anchors: number;
  categories: CategoryFit[];
  holdout: HoldoutResult;
  global_token_rate: number;
}

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** The farm verdict: FARM the plan, THIN (only with cheap size and patience), or SKIP. */
export type Verdict = 'FARM' | 'THIN' | 'SKIP';

/** One row of board.json: the ranked board's row, with the model's working shown. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  watchlist: boolean;
  age_days: number | null;
  fitted_value_usd: number;
  growth_multiplier: number;
  maturity_multiplier: number;
  launch_odds: number;
  implied_value_usd: number;
  verdict: Verdict;
  est_cost_usd: number;
  capital_usd: number;
  farm_steps: string[];
}

/** The dashboard's view of one board row: the same numbers, farm plan included. */
export interface RadarRow extends BoardRow {}

/** A protocol whose token already trades: shown apart, at the market's own value. */
export interface LiveRow {
  slug: string;
  name: string;
  symbol: string | null;
  category: string | null;
  tvl_usd: number;
  mcap_usd: number;
}

/** How the whole snapshot is accounted for: every one of its protocols lands in exactly one line. */
export interface Accounting {
  total: number;
  priced_anchors: number;
  token_recorded_unpriced: number;
  pretoken: number;
  board_rows: number;
  screened_out: number;
  screen_reasons: { reason: string; count: number }[];
  watchlist_size: number;
  watchlist_covered: number;
}

/** Everything the dashboard renders, from the snapshot. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  stats: Accounting;
  model: FittedModel;
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** FNV-1a over the slug: the deterministic hash the held-out split and the plan jitter both use. */
export function slugHash(slug: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** The median of a non-empty list of numbers. */
function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

/** A whole day count from `listedAt` to `asOf`, clamped at zero; null when either date is absent. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

/** Whether a protocol records no token at all: no cap, no CoinGecko id, no symbol. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** Whether a protocol records a token, priced or not. */
function recordsToken(p: SnapshotProtocol): boolean {
  return p.gecko_id !== null || p.symbol !== null;
}

/** A priced anchor: a token whose market cap the snapshot actually records. */
function isAnchor(p: SnapshotProtocol): boolean {
  return p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0;
}

// ---------------------------------------------------------------- the fit

interface LineFit {
  slope: number;
  intercept: number;
  offsets: Map<string, number>;
  medians: Map<string, number>;
  counts: Map<string, number>;
  globalMedianMultiple: number;
}

/** Least squares of log(cap) on log(TVL), with one shrunk median-residual offset per category. */
function fitLine(anchors: SnapshotProtocol[]): LineFit {
  const xs = anchors.map((p) => Math.log(p.tvl_usd));
  const ys = anchors.map((p) => Math.log(p.mcap_usd!));
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length;
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < xs.length; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = my - slope * mx;
  const residuals = new Map<string, number[]>();
  const multiples = new Map<string, number[]>();
  for (const p of anchors) {
    const c = p.category ?? 'Uncategorised';
    const residual = Math.log(p.mcap_usd!) - (intercept + slope * Math.log(p.tvl_usd));
    if (!residuals.has(c)) residuals.set(c, []);
    residuals.get(c)!.push(residual);
    if (!multiples.has(c)) multiples.set(c, []);
    multiples.get(c)!.push(p.mcap_usd! / p.tvl_usd);
  }
  const offsets = new Map<string, number>();
  const medians = new Map<string, number>();
  const counts = new Map<string, number>();
  for (const [c, rs] of residuals) {
    offsets.set(c, (rs.length / (rs.length + FIT.offset_shrink)) * median(rs));
    medians.set(c, median(multiples.get(c)!));
    counts.set(c, rs.length);
  }
  return { slope, intercept, offsets, medians, counts, globalMedianMultiple: median(anchors.map((p) => p.mcap_usd! / p.tvl_usd)) };
}

/** What the line prices one TVL at, before growth, maturity and odds. */
function lineValue(fit: LineFit, tvl: number, category: string | null): number {
  const offset = fit.offsets.get(category ?? 'Uncategorised') ?? 0;
  return Math.exp(fit.intercept + fit.slope * Math.log(Math.max(1, tvl)) + offset);
}

/** A fit's out-of-sample report card on `rows`: median percentage error, log R2, 2x and 3x shares. */
function scoreFit(fit: LineFit, rows: SnapshotProtocol[]): { medianApe: number; logR2: number; within2: number; within3: number } {
  const apes: number[] = [];
  let within2 = 0;
  let within3 = 0;
  let ssRes = 0;
  const ys = rows.map((p) => Math.log(p.mcap_usd!));
  const my = ys.reduce((a, b) => a + b, 0) / ys.length;
  let ssTot = 0;
  for (let i = 0; i < rows.length; i++) {
    const p = rows[i]!;
    const predicted = lineValue(fit, p.tvl_usd, p.category);
    apes.push(Math.abs(predicted - p.mcap_usd!) / p.mcap_usd!);
    if (predicted >= p.mcap_usd! / 2 && predicted <= p.mcap_usd! * 2) within2++;
    if (predicted >= p.mcap_usd! / 3 && predicted <= p.mcap_usd! * 3) within3++;
    ssRes += (Math.log(predicted) - ys[i]!) ** 2;
    ssTot += (ys[i]! - my) ** 2;
  }
  return {
    medianApe: median(apes),
    logR2: ssTot === 0 ? 0 : 1 - ssRes / ssTot,
    within2: within2 / rows.length,
    within3: within3 / rows.length,
  };
}

/** The naive model as a LineFit: slope 1 through the global median multiple, no category offsets. */
function naiveFit(anchors: SnapshotProtocol[]): LineFit {
  const globalMedianMultiple = median(anchors.map((p) => p.mcap_usd! / p.tvl_usd));
  return {
    slope: 1,
    intercept: Math.log(globalMedianMultiple),
    offsets: new Map(),
    medians: new Map(),
    counts: new Map(),
    globalMedianMultiple,
  };
}

// ---------------------------------------------------------------- the odds

/** TVL bands for the odds table, in dollars. */
const BANDS: { label: string; min: number; max: number }[] = [
  { label: 'under $25M', min: 0, max: 25_000_000 },
  { label: '$25M to $100M', min: 25_000_000, max: 100_000_000 },
  { label: '$100M to $500M', min: 100_000_000, max: 500_000_000 },
  { label: '$500M and up', min: 500_000_000, max: Number.POSITIVE_INFINITY },
];

function bandOf(tvl: number): number {
  for (let i = 0; i < BANDS.length; i++) if (tvl >= BANDS[i]!.min && tvl < BANDS[i]!.max) return i;
  return BANDS.length - 1;
}

interface OddsTables {
  globalRate: number;
  byCategory: Map<string, number>;
  byBand: Map<number, number>;
}

/** The peers' record: token-record rates by category and by TVL band, shrunk to the global rate. */
function buildOdds(protocols: SnapshotProtocol[]): OddsTables {
  const globalRate = protocols.filter(recordsToken).length / protocols.length;
  const catCount = new Map<string, { n: number; tok: number }>();
  const bandCount = new Map<number, { n: number; tok: number }>();
  for (const p of protocols) {
    const c = p.category ?? 'Uncategorised';
    const ce = catCount.get(c) ?? { n: 0, tok: 0 };
    ce.n++;
    if (recordsToken(p)) ce.tok++;
    catCount.set(c, ce);
    const b = bandOf(p.tvl_usd);
    const be = bandCount.get(b) ?? { n: 0, tok: 0 };
    be.n++;
    if (recordsToken(p)) be.tok++;
    bandCount.set(b, be);
  }
  const byCategory = new Map<string, number>();
  for (const [c, e] of catCount) byCategory.set(c, (e.tok + FIT.odds_cat_prior * globalRate) / (e.n + FIT.odds_cat_prior));
  const byBand = new Map<number, number>();
  for (const [b, e] of bandCount) byBand.set(b, (e.tok + FIT.odds_band_prior * globalRate) / (e.n + FIT.odds_band_prior));
  return { globalRate, byCategory, byBand };
}

/** The odds one candidate ever records a token: its category's record blended with its band's. */
function launchOdds(odds: OddsTables, p: SnapshotProtocol): number {
  const cat = odds.byCategory.get(p.category ?? 'Uncategorised') ?? odds.globalRate;
  const band = odds.byBand.get(bandOf(p.tvl_usd)) ?? odds.globalRate;
  return Math.min(FIT.odds_cap, Math.max(FIT.odds_floor, 0.5 * cat + 0.5 * band));
}

// ---------------------------------------------------------------- the screen

/** DefiLlama's version-marker rule: a name ending in a release is a deployment of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;
/** Names that begin with an exchange's name are that exchange's own product, not a launch candidate. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/i;
/**
 * Categories the house's own watchlist screen treats as products of a token that already trades:
 * bridges and staking wrappers in this snapshot are overwhelmingly one asset carried onto another
 * chain (the input README names WBTC, Binance staked ETH and USDT0), not protocols awaiting a
 * launch of their own. The board applies the same screen at every size, not only above the floor.
 */
const PRODUCT_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'Stablecoin Wrapper']);

/** A name that is nothing but a ticker (WBTC, USDT0) names an asset, not a protocol. */
const TICKER_NAME = /^[A-Z0-9]{2,10}$/;

/** Why the screen set a pre-token protocol aside, or null when it may be ranked. */
export function screenReason(p: SnapshotProtocol): string | null {
  if (p.category === 'CEX') return 'an exchange: its TVL is customer balances, not a protocol waiting on a launch';
  if (VERSIONED.test(p.name)) return 'a versioned deployment of a protocol that already has its own record';
  if (/\b(wrapped|staked|staking)\b/i.test(p.name)) return 'a wrapped or staked product of a token that already trades';
  if (EXCHANGE_PREFIX.test(p.name)) return 'an exchange-branded product of a token that already trades';
  if (TICKER_NAME.test(p.name)) return 'its name is an asset ticker, not a protocol: the asset itself already trades';
  if (p.category !== null && PRODUCT_CATEGORIES.has(p.category)) return 'a bridge, staking or wrapped product of a token that already trades, by the house screen';
  return null;
}

// ---------------------------------------------------------------- farm plans

/** Gas per on-chain action in dollars, by the chain the action happens on. */
const CHAIN_GAS: Record<string, number> = {
  Ethereum: 6.0,
  Bitcoin: 3.0,
  Tron: 0.8,
  'BNB Chain': 0.6,
  Avalanche: 0.45,
  Arbitrum: 0.35,
  Scroll: 0.35,
  Optimism: 0.35,
  'zkSync Era': 0.3,
  Linea: 0.3,
  Base: 0.25,
  Mantle: 0.2,
  Polygon: 0.08,
  Solana: 0.05,
  Gnosis: 0.05,
  Celo: 0.05,
  Fantom: 0.1,
};

function gasFor(chain: string): number {
  return CHAIN_GAS[chain] ?? 1.0;
}

/** How much capital one farm position carries, from the protocol's own scale. */
function capitalFor(tvl: number): number {
  if (tvl >= 5_000_000_000) return 1000;
  if (tvl >= 1_000_000_000) return 500;
  if (tvl >= 250_000_000) return 250;
  if (tvl >= 50_000_000) return 150;
  return 100;
}

/** How long a position must be held to count, from the protocol's age. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 90;
  if (age < 365) return 60;
  if (age < 1095) return 45;
  return 30;
}

/** The plan's working figures: chain, capital, cadence, and the season's costed total. */
interface PlanContext {
  chain: string;
  secondChain: string | null;
  gas: number;
  capital: number;
  perWeek: number;
  weeks: number;
  holdDays: number;
  bridgeCost: number;
  estCost: number;
}

function planContext(p: SnapshotProtocol, age: number | null): PlanContext {
  const chain = p.chains.length > 0 ? p.chains[0]! : 'Ethereum';
  const secondChain = p.chains.length > 1 ? p.chains[1]! : null;
  const gas = gasFor(chain);
  const capital = capitalFor(p.tvl_usd);
  const perWeek = 2 + (slugHash(p.slug) % 3);
  const weeks = FIT.season_weeks;
  const holdDays = holdDaysFor(age);
  const bridgeCost = chain === 'Ethereum' ? 0 : 14;
  const setupTx = 5;
  const exitTx = 3;
  const estCost = Math.max(8, Math.round(bridgeCost + gas * (setupTx + perWeek * weeks + exitTx)));
  return { chain, secondChain, gas, capital, perWeek, weeks, holdDays, bridgeCost, estCost };
}

/** The verdict a plan earns: implied value against the season's cost of farming it. */
export function verdictFor(implied: number, estCost: number): Verdict {
  const cover = implied / Math.max(1, estCost);
  if (implied >= 20_000_000 && cover >= 3000) return 'FARM';
  if (implied >= 4_000_000 && cover >= 1200) return 'THIN';
  return 'SKIP';
}

/** The category's two core actions, in words a farmer can follow, sized to the plan's capital. */
function coreActions(p: SnapshotProtocol, ctx: PlanContext): [string, string] {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const cap = ctx.capital;
  const half = Math.max(25, Math.round(cap / 2));
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral') || c.includes('uncollateralized')) {
    return [
      `Supply $${cap} of USDC to ${name} on ${ctx.chain} as collateral and leave the position untouched for a full week.`,
      `Borrow about $${half} of a second stablecoin against it, keep the health factor above 2.0, and re-supply the borrowed half so both sides of ${name}'s market see the wallet.`,
    ];
  }
  if (c.includes('dex') || c.includes('options')) {
    return [
      `Swap about $${cap} through ${name}'s deepest pair on ${ctx.chain}, split across both directions rather than one round trip.`,
      `Add $${cap} of liquidity to that same ${name} pool and hold the position; a wallet that only swaps looks like a bot, a wallet that provides looks like a user.`,
    ];
  }
  if (c.includes('staking') || c.includes('restak')) {
    return [
      `Stake $${cap} of ${ctx.chain}'s staking asset through ${name} and keep the receipt token in the same wallet.`,
      `Put the receipt token to work once, in a lending market or pool ${name} itself lists, so the wallet shows both the stake and a second-order use.`,
    ];
  }
  if (c.includes('bridge')) {
    const dest = ctx.secondChain ?? 'Ethereum';
    return [
      `Bridge $${cap} of USDC from Ethereum to ${dest} through ${name}; the crossing itself is the qualifying action.`,
      `Use the bridged funds in one ${dest} application the same week, then bridge a smaller amount back through ${name} by a different route so the wallet has history in both directions.`,
    ];
  }
  if (c.includes('deriv') || c.includes('perpetual') || c.includes('basis')) {
    return [
      `Deposit $${cap} of USDC as margin on ${name} and open one small delta-neutral pair (long spot against short perp, or the protocol's own basis vault).`,
      `Trade a little each week on ${name} to build a real volume record, keeping every position small enough that funding swings cannot liquidate it.`,
    ];
  }
  if (c.includes('prediction')) {
    return [
      `Fund $${cap} and take positions in ${name}'s most liquid markets, on questions you can actually follow.`,
      `Provide liquidity on one of ${name}'s market books and let at least one position resolve before withdrawing, so the record shows use, not wash.`,
    ];
  }
  if (c.includes('rwa') || c.includes('indexes') || c.includes('index')) {
    return [
      `Mint or subscribe $${cap} of ${name}'s flagship asset on ${ctx.chain} and hold it in the farming wallet.`,
      `Hold the ${name} asset through one full yield or rebalance cycle, then make one secondary trade so the wallet shows both entry and intent.`,
    ];
  }
  if (c.includes('curator') || c.includes('allocator') || c.includes('yield') || c.includes('farm')) {
    return [
      `Deposit $${cap} into the flagship vault ${name} curates on ${ctx.chain} and keep the vault shares in the wallet.`,
      `Run a second, smaller ${name} vault or strategy for contrast, and harvest or compound the rewards once a week.`,
    ];
  }
  if (c.includes('chain')) {
    return [
      `Bridge $${cap} onto ${ctx.chain} and hold a working balance of its gas token; a chain's own radar counts native activity first.`,
      `Use two or three of ${ctx.chain}'s native applications each week (a swap, a lend, a mint) so the wallet reads as an early citizen of ${name}'s ecosystem, not a passer-by.`,
    ];
  }
  if (c.includes('payment') || c.includes('card')) {
    return [
      `Open the ${name} account, fund it with $${cap}, and route one real recurring payment or card spend through it.`,
      `Keep a standing balance with ${name} and one transaction a week; payment products reward continuity of use over size.`,
    ];
  }
  if (c.includes('insurance')) {
    return [
      `Buy $${cap} of cover from ${name} on a position you genuinely hold on ${ctx.chain}.`,
      `If ${name} offers a risk pool, stake a smaller amount into it and leave it through one full cover period.`,
    ];
  }
  if (c.includes('stable')) {
    return [
      `Mint or deposit $${cap} of ${name}'s stable asset on ${ctx.chain} against collateral you hold.`,
      `Provide ${name}'s stable asset to its main liquidity pair and hold the position through a full rewards epoch.`,
    ];
  }
  return [
    `Deposit $${cap} of USDC into ${name}'s flagship market on ${ctx.chain} and keep the position open.`,
    `Make one second qualifying action ${name} counts (a borrow, a swap, a vote or a stake, whichever its own app offers) so the wallet is not one-dimensional.`,
  ];
}

/** A step as one string: its action, then its cost and time, inside the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

const usd = (n: number): string => `$${Math.round(n).toLocaleString('en-US')}`;

/**
 * A protocol's farm plan: seven steps, each an action with a cost and a time, derived from the
 * protocol's own record (category, chains, TVL, age) and the model's own numbers, ending in the
 * verdict those numbers earn. No step is copied between rows: amounts, chains, cadence and the
 * verdict's arithmetic are all the row's own.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null, implied: number, verdict: Verdict): FarmStep[] {
  const ctx = planContext(p, age);
  const [coreA, coreB] = coreActions(p, ctx);
  const cover = Math.round(implied / Math.max(1, ctx.estCost));
  const verdictText =
    verdict === 'FARM'
      ? `Verdict: FARM. The model's implied value of ${usd(implied)} covers the roughly ${usd(ctx.estCost)} season cost about ${cover.toLocaleString('en-US')} times over, so a full season at the stated size is worth its fees and the capital's lock-up.`
      : verdict === 'THIN'
        ? `Verdict: THIN. Implied value of ${usd(implied)} against roughly ${usd(ctx.estCost)} of season cost is a real but modest edge (about ${cover.toLocaleString('en-US')}x cover): farm it only at the stated size, on the cheap weeks, and skip it if gas on ${ctx.chain} spikes.`
        : `Verdict: SKIP. Implied value of ${usd(implied)} does not clear the roughly ${usd(ctx.estCost)} season cost by enough (about ${cover.toLocaleString('en-US')}x cover) to justify ten weeks of attention; revisit only if its TVL or the model's odds move.`;
  return [
    {
      text: `Use a fresh wallet for ${p.name} alone and keep its seed phrase offline; one wallet per protocol keeps every farm's record clean.`,
      cost: 'nothing to create, under $3 of gas to fund',
      time: '5 minutes',
    },
    {
      text:
        ctx.bridgeCost > 0
          ? `Fund the wallet on Ethereum, then bridge about ${usd(ctx.capital + 50)} to ${ctx.chain}, the chain where ${p.name}'s TVL sits, and keep ${usd(25)} of its gas token spare.`
          : `Fund the wallet directly on ${ctx.chain} with about ${usd(ctx.capital + 50)} and keep ${usd(25)} of its gas token spare; no bridge is needed.`,
      cost: ctx.bridgeCost > 0 ? `about ${usd(ctx.bridgeCost)} of bridge and exit fees` : 'about $2 of transfer fees',
      time: '15 minutes',
    },
    { text: coreA, cost: `${usd(ctx.capital)} of capital and about ${usd(Math.max(1, Math.round(ctx.gas * 2)))} of gas`, time: '15 minutes to set up' },
    { text: coreB, cost: `about ${usd(Math.max(1, Math.round(ctx.gas * 2)))} of gas, no new capital`, time: '10 minutes' },
    {
      text: `Keep a cadence of ${ctx.perWeek} qualifying transactions a week for ${ctx.weeks} weeks on ${p.name}, varying the amounts and the days so the record reads as use, not scripting.`,
      cost: `about ${usd(Math.max(1, Math.round(ctx.gas * ctx.perWeek)))} of gas a week`,
      time: `${ctx.perWeek * 5} minutes a week`,
    },
    {
      text: `Hold the position at least ${ctx.holdDays} days so it survives more than one TVL snapshot, and check ${p.name}'s own points or rewards page weekly, claiming only from links the protocol itself publishes.`,
      cost: `the ${usd(ctx.capital)} stays in the position; checking is free and never pay to claim`,
      time: `${ctx.holdDays} days, 5 minutes a week`,
    },
    { text: verdictText, cost: `about ${usd(ctx.estCost)} all-in for the season, ${usd(ctx.capital)} of it recoverable capital`, time: `${ctx.weeks} weeks of cadence` },
  ];
}

// ---------------------------------------------------------------- the board

/** Fit the production model and its held-out report card from the snapshot's anchors. */
export function fitModel(snapshot: Snapshot): { fit: LineFit; model: FittedModel; odds: OddsTables } {
  const anchors = snapshot.protocols.filter(isAnchor);
  const train = anchors.filter((p) => slugHash(p.slug) % FIT.holdout_mod !== 0);
  const test = anchors.filter((p) => slugHash(p.slug) % FIT.holdout_mod === 0);
  const trainFit = fitLine(train);
  const held = scoreFit(trainFit, test);
  const naive = scoreFit(naiveFit(train), test);
  const fit = fitLine(anchors);
  const categories: CategoryFit[] = [...fit.counts.entries()]
    .map(([category, n]) => ({
      category,
      anchors: n,
      median_multiple: round4(fit.medians.get(category) ?? 0),
      offset: round4(fit.offsets.get(category) ?? 0),
    }))
    .sort((a, b) => b.anchors - a.anchors || (a.category < b.category ? -1 : 1));
  const model: FittedModel = {
    slope: round4(fit.slope),
    intercept: round4(fit.intercept),
    global_median_multiple: round4(fit.globalMedianMultiple),
    anchors: anchors.length,
    categories,
    holdout: {
      train_n: train.length,
      test_n: test.length,
      median_ape_pct: round2(held.medianApe * 100),
      log_r2: round4(held.logR2),
      within_2x_pct: round2(held.within2 * 100),
      within_3x_pct: round2(held.within3 * 100),
      naive_median_ape_pct: round2(naive.medianApe * 100),
      naive_log_r2: round4(naive.logR2),
      naive_within_2x_pct: round2(naive.within2 * 100),
    },
    global_token_rate: round4(buildOdds(snapshot.protocols).globalRate),
  };
  return { fit, model, odds: buildOdds(snapshot.protocols) };
}

/** Score one candidate: fitted value, its shape adjustments, its odds, its verdict and its plan. */
function scoreCandidate(
  p: SnapshotProtocol,
  snapshot: Snapshot,
  fit: LineFit,
  odds: OddsTables,
  watchlist: boolean,
): Omit<BoardRow, 'rank'> {
  const age = ageDays(snapshot.as_of, p.listed_at);
  const fitted = lineValue(fit, p.tvl_usd, p.category);
  const rawGrowth = p.change_7d === null ? 0 : p.change_7d;
  const growthPct = Math.min(FIT.growth_cap, Math.max(FIT.growth_floor, rawGrowth));
  const growthMult = 1 + (growthPct / 100) * FIT.growth_weight;
  const ageForModel = age ?? FIT.unknown_age_days;
  const maturityMult = FIT.maturity_base + (Math.min(Math.max(ageForModel, 0), FIT.maturity_days) / FIT.maturity_days) * FIT.maturity_span;
  const oddsValue = launchOdds(odds, p);
  const implied = Math.max(1, Math.round(fitted * growthMult * maturityMult * oddsValue));
  const ctx = planContext(p, age);
  const verdict = verdictFor(implied, ctx.estCost);
  return {
    slug: p.slug,
    name: p.name,
    category: p.category,
    chains: p.chains,
    tvl_usd: p.tvl_usd,
    change_7d: p.change_7d,
    mcap_usd: p.mcap_usd,
    listed_at: p.listed_at,
    gecko_id: p.gecko_id,
    symbol: p.symbol,
    token_status: 'pre-token',
    watchlist,
    age_days: age,
    fitted_value_usd: Math.round(fitted),
    growth_multiplier: round4(growthMult),
    maturity_multiplier: round4(maturityMult),
    launch_odds: round4(oddsValue),
    implied_value_usd: implied,
    verdict,
    est_cost_usd: ctx.estCost,
    capital_usd: ctx.capital,
    farm_steps: farmSteps(p, age, implied, verdict).map(stepText),
  };
}

/** The protocols the board ranks, strongest first, with ranks 1..n, plus the snapshot's accounting. */
export function buildBoard(snapshot: Snapshot): { board: BoardRow[]; model: FittedModel; stats: Accounting } {
  const { fit, model, odds } = fitModel(snapshot);
  const watch = new Set(snapshot.watchlist);
  const chosen = new Map<string, SnapshotProtocol>();
  const reasonCounts = new Map<string, number>();
  let screenedOut = 0;
  for (const p of snapshot.protocols) {
    if (!isPreToken(p)) continue;
    if (watch.has(p.slug)) {
      chosen.set(p.slug, p);
      continue;
    }
    const reason = screenReason(p);
    if (reason === null) chosen.set(p.slug, p);
    else {
      screenedOut++;
      reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1);
    }
  }
  const scored = [...chosen.values()].map((p) => scoreCandidate(p, snapshot, fit, odds, watch.has(p.slug)));
  scored.sort((a, b) => b.implied_value_usd - a.implied_value_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0));
  const board = scored.map((row, i) => ({ ...row, rank: i + 1 }));
  const priced = snapshot.protocols.filter(isAnchor).length;
  const recorded = snapshot.protocols.filter((p) => !isPreToken(p)).length;
  const pretoken = snapshot.protocols.filter(isPreToken).length;
  const stats: Accounting = {
    total: snapshot.protocols.length,
    priced_anchors: priced,
    token_recorded_unpriced: recorded - priced,
    pretoken,
    board_rows: board.length,
    screened_out: screenedOut,
    screen_reasons: [...reasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    watchlist_size: snapshot.watchlist.length,
    watchlist_covered: board.filter((r) => r.watchlist).length,
  };
  return { board, model, stats };
}

/** The live-token protocols, by market cap, for the dashboard's "already trades" strip. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.mcap_usd !== null && p.mcap_usd > 0)
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || (a.slug < b.slug ? -1 : 1))
    .slice(0, 16)
    .map((p) => ({ slug: p.slug, name: p.name, symbol: p.symbol, category: p.category, tvl_usd: p.tvl_usd, mcap_usd: p.mcap_usd! }));
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const { board, model, stats } = buildBoard(snapshot);
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    stats,
    model,
    rows: board,
    live: liveRows(snapshot),
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, shared value, steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  if (board.length < 100 || board.length > 4000) return `the board holds ${board.length} rows, outside 100..4000`;
  const slugs = new Set(board.map((r) => r.slug));
  if (slugs.size !== board.length) return 'the board repeats a slug';
  const known = new Set(snapshot.protocols.map((p) => p.slug));
  for (const r of board) if (!known.has(r.slug)) return `${r.slug} is not one of the snapshot's protocols`;
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  const byRank = [...board].sort((a, b) => a.rank - b.rank);
  for (let i = 1; i < byRank.length; i++) {
    if (byRank[i]!.implied_value_usd > byRank[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  }
  if (board.length >= 2 && byRank[0]!.implied_value_usd === byRank[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) {
      const t = s.trim();
      if (t.length < 20 || t.length > 600) return `${r.slug} has a farm step of ${t.length} characters`;
    }
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0 || r.implied_value_usd > 100_000_000_000_000) {
      return `${r.slug} has implied value ${r.implied_value_usd}`;
    }
    if (r.slug.length < 1 || r.slug.length > 128 || /\s/.test(r.slug)) return `bad slug ${r.slug}`;
    if (r.name.trim().length === 0) return `${r.slug} has an empty name`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
