/**
 * Unit tests for gear tooth count and speed ratio formulas.
 *
 * Run with: node gear_speed.test.js
 *
 * These tests verify that:
 *   1. Tooth counts grow as N_i = baseTeeth * (i+1)
 *   2. Speed ratios follow ω_i / ω_0 = N_0 / N_i = 1 / (i+1)
 *   3. With 8 gears, the last gear turns at 1/8 the speed of the first
 */

const BASE_TEETH = 12;

function toothCount(i) {
  return BASE_TEETH * (i + 1);
}

function speedRatio(i) {
  // ω_i / ω_0 = N_0 / N_i
  return toothCount(0) / toothCount(i);
}

let passed = 0;
let failed = 0;

function assert(description, actual, expected, tolerance = 1e-9) {
  const ok = Math.abs(actual - expected) <= tolerance;
  if (ok) {
    console.log(`  ✓ ${description}`);
    passed++;
  } else {
    console.error(`  ✗ ${description}`);
    console.error(`      expected ${expected}, got ${actual}`);
    failed++;
  }
}

// --- Tooth counts ---
console.log('\nTooth counts (N_i = baseTeeth × (i+1)):');
assert('gear 0 has 12 teeth',  toothCount(0), 12);
assert('gear 1 has 24 teeth',  toothCount(1), 24);
assert('gear 2 has 36 teeth',  toothCount(2), 36);
assert('gear 7 has 96 teeth',  toothCount(7), 96);

// --- Speed ratios ---
console.log('\nSpeed ratios (ω_i / ω_0 = N_0 / N_i):');
assert('gear 0 runs at full speed (1/1)',    speedRatio(0), 1);
assert('gear 1 runs at half speed (1/2)',    speedRatio(1), 0.5);
assert('gear 2 runs at one-third speed (1/3)', speedRatio(2), 1/3);
assert('gear 3 runs at one-quarter speed (1/4)', speedRatio(3), 0.25);
assert('gear 7 runs at one-eighth speed (1/8)', speedRatio(7), 0.125);

// --- 8-gear train ---
console.log('\n8-gear train speed ratios:');
const numGears = 8;
for (let i = 0; i < numGears; i++) {
  assert(
    `gear ${i} (${toothCount(i)} teeth): speed = 1/${i+1}`,
    speedRatio(i),
    1 / (i + 1)
  );
}

// --- Mechanical coupling check ---
// For meshing gears: ω_{i+1} / ω_i = N_i / N_{i+1}
console.log('\nMechanical coupling (each adjacent pair):');
for (let i = 0; i < numGears - 1; i++) {
  const N_i  = toothCount(i);
  const N_i1 = toothCount(i + 1);
  const expectedRatio = N_i / N_i1;         // mechanical rule
  const actualRatio   = speedRatio(i + 1) / speedRatio(i); // from our formula
  assert(
    `ω_${i+1}/ω_${i} = N_${i}/N_${i+1} = ${N_i}/${N_i1} = ${expectedRatio.toFixed(4)}`,
    actualRatio,
    expectedRatio
  );
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
