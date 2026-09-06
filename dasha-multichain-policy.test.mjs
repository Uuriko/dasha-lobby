import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectBacking } from './dasha-multichain-policy.mjs';

const snapshot = {
  solanaSupplyAtomic: '1000000000000', solanaLockedAtomic: '100000000000', solanaDecimals: 9,
  baseSupplyAtomic: '100000000000000000000', baseDecimals: 18,
};

test('equal backing across different decimals excludes escrow from circulating supply', () => {
  const report = inspectBacking(snapshot);
  assert.equal(report.assessment, 'balanced');
  assert.equal(report.normalizedDecimals, 18);
  assert.equal(report.gapAtomic, '0');
  assert.equal(report.circulatingAtomic, '1000000000000000000000');
  assert.equal(report.chainEvidenceVerified, false);
  assert.equal(report.readyForLaunch, false);
});

test('one smallest-unit deficit remains visible beyond JavaScript safe-integer precision', () => {
  const report = inspectBacking({ ...snapshot, baseSupplyAtomic: '100000000000000000001' });
  assert.equal(report.assessment, 'underbacked');
  assert.equal(report.gapAtomic, '-1');
});

test('extra escrow requires transfer reconciliation and is never treated as extra token supply', () => {
  const report = inspectBacking({ ...snapshot, baseSupplyAtomic: '99000000000000000000' });
  assert.equal(report.assessment, 'surplus-needs-reconciliation');
  assert.equal(report.gapAtomic, '1000000000000000000');
  assert.equal(report.circulatingAtomic, '999000000000000000000');
  assert.equal(report.readyForLaunch, false);
});

test('scale direction works when the origin has more decimals and when both match', () => {
  const reversed = inspectBacking({
    solanaSupplyAtomic: '1000000000000000000000', solanaLockedAtomic: '100000000000000000000',
    solanaDecimals: 18, baseSupplyAtomic: '100000000000', baseDecimals: 9,
  });
  assert.equal(reversed.assessment, 'balanced');
  const same = inspectBacking({
    solanaSupplyAtomic: '1000', solanaLockedAtomic: '100', solanaDecimals: 0,
    baseSupplyAtomic: '100', baseDecimals: 0,
  });
  assert.equal(same.circulatingAtomic, '1000');
});

test('malformed balances, lossy numbers, impossible escrow, and unsupported decimals are rejected', () => {
  for (const value of [-1, 1e18, '-1', '1.0', '1e18', ' 1', '01', '', null, '1'.repeat(79)]) {
    assert.throws(() => inspectBacking({ ...snapshot, solanaSupplyAtomic: value }));
  }
  for (const value of [-1, 1.5, 19, '9', NaN]) {
    assert.throws(() => inspectBacking({ ...snapshot, solanaDecimals: value }));
  }
  assert.throws(() => inspectBacking({ ...snapshot, solanaLockedAtomic: '1000000000001' }));
});
