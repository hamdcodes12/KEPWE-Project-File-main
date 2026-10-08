// NIFTY option chain assembled from real Angel One data only:
//   contracts (token, strike, expiry, lot size)  <- official scrip master
//   LTP, best bid/ask, volume                    <- SmartAPI quote API (FULL)
//   delta                                        <- SmartAPI optionGreek API
// SmartAPI has no single option-chain endpoint, so the chain is the strikes
// nearest to spot for the nearest non-expired expiry. A contract without a
// real LTP and two-sided quote is dropped, never estimated.

import { loadAngelInstrumentMaster, nearestOptionExpiryContracts, niftyFreezeQuantity } from './angel-one-instruments.service.js';

// 25 strikes x CE/PE = 50 tokens = one quote API call.
const DEFAULT_STRIKES_EACH_SIDE = 12;

function finite(value) {
  if (value === null || value === undefined || value === '') return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

/** Contracts for the strikes closest to spot (pure; exported for tests). */
export function selectStrikesAroundSpot(contracts, spotPrice, strikesEachSide = DEFAULT_STRIKES_EACH_SIDE) {
  const strikes = [...new Set(contracts.map((contract) => contract.strike))]
    .sort((a, b) => Math.abs(a - spotPrice) - Math.abs(b - spotPrice))
    .slice(0, (strikesEachSide * 2) + 1);
  const wanted = new Set(strikes);
  return contracts.filter((contract) => wanted.has(contract.strike));
}

/** Merges master contracts with quotes and greeks (pure; exported for tests). */
export function buildOptionInstruments({ contracts, quotes, greeks = [], receivedAt, freezeQuantity = null }) {
  const quoteByToken = new Map(quotes.map((quote) => [String(quote.symbolToken), quote]));
  const deltaByKey = new Map(greeks.map((row) => [`${Number(row.strike)}:${row.optionType}`, row.delta]));
  const instruments = [];
  for (const contract of contracts) {
    const quote = quoteByToken.get(String(contract.symbolToken));
    if (!quote) continue;
    const ltp = finite(quote.ltp);
    const bid = finite(quote.bid);
    const ask = finite(quote.ask);
    if (ltp === null || ltp <= 0 || bid === null || ask === null) continue;
    if (!(contract.lotSize > 0) || !contract.expiry) continue;
    instruments.push({
      optionType: contract.optionType,
      strike: contract.strike,
      securityId: contract.symbolToken,
      symbolToken: contract.symbolToken,
      exchange: 'NFO',
      ltp,
      bid,
      ask,
      ltpTimestamp: receivedAt,
      // NSE index options stop trading at 15:30 IST on the expiry date.
      expiry: `${contract.expiry}T15:30:00+05:30`,
      expiryDate: contract.expiry,
      tradingSymbol: contract.tradingSymbol,
      displayName: contract.displayName,
      lotSize: contract.lotSize,
      quantityFreeze: freezeQuantity,
      delta: finite(deltaByKey.get(`${Number(contract.strike)}:${contract.optionType}`)),
      volume: finite(quote.volume) ?? 0,
      isLiquid: ask >= bid && bid > 0 && Number(quote.volume || 0) > 0,
      halted: false,
      abnormallyVolatile: false,
    });
  }
  return instruments;
}

/**
 * Fetches the live NIFTY option chain around `spotPrice`.
 * Returns { expiry, expiryRaw, instruments, greeksAvailable, greeksError }.
 */
export async function fetchNiftyOptionChain(adapter, { spotPrice, strikesEachSide = DEFAULT_STRIKES_EACH_SIDE, now = Date.now() } = {}) {
  if (!Number.isFinite(Number(spotPrice)) || Number(spotPrice) <= 0) {
    throw new Error('A live NIFTY spot price is required to build the option chain');
  }
  const master = await loadAngelInstrumentMaster();
  const { expiry, expiryRaw, contracts } = nearestOptionExpiryContracts(master, 'NIFTY', now);
  if (!expiry) return { expiry: null, expiryRaw: null, instruments: [], greeksAvailable: false, greeksError: null };
  const selected = selectStrikesAroundSpot(contracts, Number(spotPrice), strikesEachSide);

  // Greeks first: the quotes must be the freshest data when a contract is chosen.
  let greeks = [];
  let greeksError = null;
  try {
    greeks = await adapter.getOptionGreeks({ name: 'NIFTY', expiry: expiryRaw });
  } catch (error) {
    if (error?.code === 'BROKER_SESSION_EXPIRED') throw error;
    greeksError = error.message;
  }
  const { fetched, receivedAt } = await adapter.getQuotes({
    mode: 'FULL',
    exchangeTokens: { NFO: selected.map((contract) => contract.symbolToken) },
  });
  return {
    expiry,
    expiryRaw,
    instruments: buildOptionInstruments({ contracts: selected, quotes: fetched, greeks, receivedAt, freezeQuantity: niftyFreezeQuantity() }),
    greeksAvailable: greeks.length > 0,
    greeksError,
  };
}
