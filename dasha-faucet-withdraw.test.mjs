#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  FAUCET_MINT,
  FAUCET_TREASURY_DEFAULT,
  FAUCET_WITHDRAW_DEST,
  SYSTEM_RENT_EXEMPT_LAMPORTS,
  TX_FEE_LAMPORTS,
  ATA_RENT_LAMPORTS,
  buildStatus,
  donateAmountUi,
  donateFailClosed,
  donateSigError,
  faucetAdminOk,
  faucetAdminSecret,
  inspectDonateTx,
  jarCopyAddress,
  jarHeadline,
  jarSolNote,
  planTreasuryWithdraw,
} from './dasha-faucet.mjs';
import {
  SYSTEM_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  associatedTokenAddress,
  buildWithdrawInstructions,
  systemTransferInstruction,
} from './dasha-faucet-solana.mjs';

const TREASURY = 'DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb';
const POTTER = '3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN';
const root = new URL('./', import.meta.url);
const worker = readFileSync(new URL('./dasha-lobby-worker.mjs', root), 'utf8');
const client = readFileSync(new URL('./dasha-lobby-static-gen.mjs', root), 'utf8');
const page = readFileSync(new URL('./dasha-faucet-page.html', root), 'utf8');

assert.equal(FAUCET_MINT, '53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump');
assert.equal(FAUCET_TREASURY_DEFAULT, TREASURY);
assert.equal(FAUCET_WITHDRAW_DEST, POTTER);
assert.equal(SYSTEM_RENT_EXEMPT_LAMPORTS, 890880n);
assert.equal(TX_FEE_LAMPORTS, 5000n);
assert.equal(ATA_RENT_LAMPORTS, 2039280n);

assert.equal(donateAmountUi(0), 0);
assert.equal(donateAmountUi(100_000_000n), 100);
assert.equal(donateAmountUi(69_000_000_000n), 69000);
assert.equal(donateAmountUi('1000000000'), 1000);

assert.equal(donateSigError(''), 'sig miss');
assert.deepEqual(donateFailClosed({}), { error: 'sig miss' });

assert.equal(faucetAdminSecret({}), '');
assert.equal(faucetAdminOk({}, 'x'), false);
assert.equal(faucetAdminOk({ LOBBY_SESSION_SECRET: 'abc' }, ''), false);
assert.equal(faucetAdminOk({ LOBBY_SESSION_SECRET: 'abc' }, 'abc'), true);
assert.equal(faucetAdminOk({ LOBBY_SESSION_SECRET: 'abc' }, 'abd'), false);
assert.equal(faucetAdminOk({ FAUCET_ADMIN: 'one', LOBBY_SESSION_SECRET: 'two' }, 'one'), true);
assert.equal(faucetAdminOk({ FAUCET_ADMIN: 'one', LOBBY_SESSION_SECRET: 'two' }, 'two'), false);

const empty = planTreasuryWithdraw({ solLamports: 0n, tokenRaw: 0n });
assert.equal(empty.ok, false);
assert.equal(empty.error, 'treasury_empty');
assert.equal(empty.dest, POTTER);
assert.equal(empty.canSend, false);

const dustSol = planTreasuryWithdraw({ solLamports: 0n, tokenRaw: 69_000_000_000n });
assert.equal(dustSol.ok, false);
assert.equal(dustSol.error, 'treasury_rent');
assert.equal(dustSol.dest, POTTER);
assert.equal(dustSol.tokenRaw, '69000000000');
assert.equal(dustSol.tokenUi, 69000);
assert.equal(dustSol.canSend, false);

const wrong = planTreasuryWithdraw({
  solLamports: 2_000_000_000n,
  tokenRaw: 69_000_000_000n,
  dest: TREASURY,
});
assert.equal(wrong.ok, false);
assert.equal(wrong.error, 'dest_not_potter');
assert.equal(wrong.dest, POTTER);

const funded = planTreasuryWithdraw({
  solLamports: 2_000_000_000n,
  tokenRaw: 69_000_000_000n,
});
assert.equal(funded.ok, true);
assert.equal(funded.dest, POTTER);
assert.equal(funded.tokenRaw, '69000000000');
assert.equal(funded.tokenUi, 69000);
assert.equal(funded.solSend, String(2_000_000_000n - 890880n - 5000n));
assert.equal(funded.solKeep, '890880');
assert.equal(funded.canSend, true);

const tokenOnly = planTreasuryWithdraw({
  solLamports: 890880n + 5000n,
  tokenRaw: 100_000_000n,
});
assert.equal(tokenOnly.ok, true);
assert.equal(tokenOnly.solSend, '0');
assert.equal(tokenOnly.tokenRaw, '100000000');

const needAta = planTreasuryWithdraw({
  solLamports: 890880n + 5000n + 2_039_280n + 10_000n,
  tokenRaw: 1n,
  createDestAta: true,
});
assert.equal(needAta.ok, true);
assert.equal(needAta.solSend, '10000');

const ix = systemTransferInstruction({ from: TREASURY, to: POTTER, lamports: 1000 });
assert.equal(ix.programId, SYSTEM_PROGRAM_ID);
assert.equal(ix.keys[0].pubkey, TREASURY);
assert.equal(ix.keys[0].isSigner, true);
assert.equal(ix.keys[1].pubkey, POTTER);
assert.deepEqual([...ix.data.slice(0, 4)], [2, 0, 0, 0]);

const built = await buildWithdrawInstructions({
  payer: TREASURY,
  dest: POTTER,
  mint: FAUCET_MINT,
  tokenRaw: 69_000_000_000n,
  solSend: 1_000_000n,
  createAta: false,
});
assert.equal(built.ok, true);
assert.equal(built.dest, POTTER);
assert.equal(built.instructions.length, 2);
assert.equal(built.instructions[0].programId, TOKEN_PROGRAM_ID);
assert.equal(built.instructions[1].programId, SYSTEM_PROGRAM_ID);
const srcAta = await associatedTokenAddress(TREASURY, FAUCET_MINT);
const destAta = await associatedTokenAddress(POTTER, FAUCET_MINT);
assert.equal(built.sourceAta, srcAta);
assert.equal(built.destAta, destAta);
assert.equal(built.instructions[0].keys[0].pubkey, srcAta);
assert.equal(built.instructions[0].keys[1].pubkey, destAta);

const stolen = await buildWithdrawInstructions({
  payer: TREASURY,
  dest: TREASURY,
  mint: FAUCET_MINT,
  tokenRaw: 1n,
});
assert.equal(stolen.ok, false);
assert.equal(stolen.error, 'dest_not_potter');

assert.equal(inspectDonateTx(null).error, 'sig miss');
assert.equal(inspectDonateTx({ meta: { err: 'x' } }).error, 'sig miss');

assert.match(worker, /path === '\/faucet\/withdraw'/);
assert.match(worker, /faucetAdminOk/);
assert.match(worker, /landed: true/);
assert.match(worker, /minRaw: 1n/);
assert.match(worker, /sendTreasuryWithdraw/);
assert.match(worker, /FAUCET_WITHDRAW_DEST/);
assert.doesNotMatch(worker, /plugin\.jup\.ag/);
assert.match(readFileSync(new URL('./dasha-faucet.mjs', root), 'utf8'), /3KNdL8kYP6ynpspjBgASfyKv2G5exQeQPStyTyS8eaqN/);

assert.match(client, /Fill the jar/);
assert.match(client, /dasha-faucet-jar/);
assert.match(client, /dasha-faucet-sig/);
assert.match(client, /Copy address/);
assert.match(client, /d\.landed/);
assert.match(client, /in\./);
assert.match(client, /DwpCrg5qfCMW11a9FYFsAR9ZYQUYKNhfLdnzpci7sYgb/);
assert.doesNotMatch(client, /1 simp point per 1,000/);
assert.doesNotMatch(client, /Not a purchase/);
assert.doesNotMatch(client, /plugin\.jup\.ag/);

const jar = buildStatus({
  configured: true, paused: false, hasSigner: true,
  amountRaw: 100_000_000n, amountUi: 100, decimals: 6,
  cooldownDays: 1, mint: FAUCET_MINT, treasury: TREASURY,
}, { balanceRaw: 69_000_000_000n, rpcOk: true, solLamports: 0n });
assert.equal(jar.balanceUi, 69000);
assert.equal(jar.solLamports, 0);
assert.equal(jarHeadline(jar), '69000 $dasha in the jar.');
assert.equal(jarSolNote(jar), 'Jar needs a drop of SOL.');
assert.equal(jarCopyAddress({ treasury: 'x' }), TREASURY);
assert.match(client, /function copyTreasury/);
assert.match(client, /function refreshStatus/);
assert.match(client, /jar empty/);
assert.doesNotMatch(client, /\/faucet\/withdraw/);

{
  const { createHash } = await import('node:crypto');
  const { FAUCET_CLIENT_JS, FAUCET_CLIENT_SRI } = await import('./dasha-lobby-static-gen.mjs');
  const sri = 'sha384-' + createHash('sha384').update(FAUCET_CLIENT_JS).digest('base64');
  assert.equal(FAUCET_CLIENT_SRI, sri);
  assert.match(page, new RegExp(sri.replace(/[+/]/g, '\\$&')));
  assert.match(client, new RegExp(sri.replace(/[+/]/g, '\\$&')));
}
assert.doesNotMatch(page, /plugin\.jup\.ag/);

console.log('dasha-faucet-withdraw: PASS (donate landed + dest-locked drain plan, no plugin.jup)');
