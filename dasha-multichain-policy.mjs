import { MINT, PAIR, WSOL } from './dasha-lobby-mod.mjs';

export const SOLANA_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const JUPITER_BRIDGE = 'https://jup.ag/deposit/bridge';
export const SOURCE_NETWORKS = Object.freeze({
  solana: 'Solana', base: 'Base', ethereum: 'Ethereum',
  arbitrum: 'Arbitrum', bnb: 'BNB Chain', other: 'Another network',
});
export const ARRIVAL_ASSETS = Object.freeze({
  sol: Object.freeze({ symbol: 'SOL', address: WSOL }),
  usdc: Object.freeze({ symbol: 'USDC', address: SOLANA_USDC }),
});

/** This is a project registry, not an assertion about every token with this ticker. */
export const CHAIN_REGISTRY = Object.freeze({
  schema: 'dasha-chains/v1',
  canonical: Object.freeze({
    network: 'solana-mainnet-beta',
    standard: 'SPL',
    mint: MINT,
    pair: PAIR,
    explorer: 'https://solscan.io/token/' + MINT,
  }),
  representations: Object.freeze([]),
  acquisition: Object.freeze({
    mode: 'external-handoff',
    bridgeUrl: JUPITER_BRIDGE,
    exactMintDirectCrossChain: false,
    quotesProvidedByDasha: false,
    settlementObservedByDasha: false,
  }),
});

/** No caller can override the final output mint or add affiliate/recipient parameters. */
export function buildAcquisitionRoute(from = 'base', via = 'sol') {
  if (!Object.hasOwn(SOURCE_NETWORKS, from) || !Object.hasOwn(ARRIVAL_ASSETS, via)) {
    throw new RangeError('Choose a source network and SOL or USDC on Solana.');
  }
  const asset = ARRIVAL_ASSETS[via];
  const swap = new URL('https://jup.ag/swap');
  swap.searchParams.set('sell', asset.address);
  swap.searchParams.set('buy', MINT);
  return Object.freeze({
    from, sourceLabel: SOURCE_NETWORKS[from], via,
    arrivalSymbol: asset.symbol, arrivalMint: asset.address,
    destination: CHAIN_REGISTRY.canonical,
    kind: from === 'solana' ? 'solana-swap' : 'bridge-then-swap',
    bridgeUrl: from === 'solana' ? null : JUPITER_BRIDGE,
    swapUrl: swap.href,
    status: 'instructions-only',
  });
}

function atomic(value, name) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)$/.test(value) || value.length > 78) {
    throw new TypeError(name + ' must be an unsigned decimal integer string.');
  }
  return BigInt(value);
}

function scale(decimals) {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new RangeError('Decimals must be an integer from 0 to 18.');
  }
  return 10n ** BigInt(decimals);
}

/**
 * Arithmetic for a future Solana-lock / Base-mint deployment.
 * Inputs must come from independently finalized, reconciled observations.
 * This function does not fetch balances, authenticate an escrow or verify transfers.
 */
export function inspectBacking({
  solanaSupplyAtomic, solanaLockedAtomic, solanaDecimals,
  baseSupplyAtomic, baseDecimals,
}) {
  const total = atomic(solanaSupplyAtomic, 'Solana supply');
  const locked = atomic(solanaLockedAtomic, 'Solana escrow');
  const issued = atomic(baseSupplyAtomic, 'Base supply');
  if (locked > total) throw new RangeError('Escrow cannot exceed the Solana supply.');
  const solScale = scale(solanaDecimals);
  const baseScale = scale(baseDecimals);
  const normalizedDecimals = Math.max(solanaDecimals, baseDecimals);
  const commonScale = scale(normalizedDecimals);
  const reserve = locked * (commonScale / solScale);
  const obligation = issued * (commonScale / baseScale);
  const gap = reserve - obligation;
  return Object.freeze({
    assessment: gap < 0n ? 'underbacked' : gap === 0n ? 'balanced' : 'surplus-needs-reconciliation',
    normalizedDecimals,
    reserveAtomic: reserve.toString(),
    obligationAtomic: obligation.toString(),
    gapAtomic: gap.toString(),
    // Locked Solana units are excluded to avoid counting the same backing twice.
    circulatingAtomic: ((total - locked) * (commonScale / solScale) + obligation).toString(),
    chainEvidenceVerified: false,
    readyForLaunch: false,
  });
}
