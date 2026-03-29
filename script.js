/*
 * Password Brute‑Force Visualizer
 *
 * This script powers an educational demonstration of brute force attacks on
 * passwords. It dynamically generates SVG gears to represent each character
 * position in the password and drives their rotation based on systematic
 * enumeration of all possible character combinations.
 *
 * The logic here is intentionally written with ES6 classes and without
 * external libraries, keeping the code accessible and easy to follow. The
 * application centres around three main responsibilities:
 *
 * 1. Gear generation: building scalable vector gears with realistic teeth.
 * 2. Brute force enumeration: iterating through base‑n numbers representing
 *    candidate passwords, tracking progress and detecting success.
 * 3. User interaction: updating UI elements, handling controls and
 *    orchestrating the animation loop.
 */

// Define supported character sets for the brute force attack. The demo set
// ("demo") contains only A, B, C for a quick preview; the remaining sets
// reflect typical alphabetic, numeric and alphanumeric spaces.
const CHARSETS = {
  demo: Array.from('ABC'),
  alpha: Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ'),
  numeric: Array.from('0123456789'),
  alphanumeric: Array.from('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'),
};

/**
 * Utility to compute an integer exponent with BigInt. JavaScript's native
 * exponentiation operator (**) works with BigInt but returns a BigInt only
 * when the base is a BigInt. This helper ensures the result is always
 * returned as a BigInt.
 *
 * @param {bigint} base
 * @param {number} exponent
 * @returns {bigint}
 */
/**
 * Compute the static phase offset (degrees) that aligns a gear's teeth with
 * the gaps of its neighbours. With a 47 % tooth / 53 % gap duty cycle the
 * tooth tip centre falls at 0.235 of the pitch and the gap centre at 0.735.
 *
 * Even-indexed gears sit with a gap at every contact point (0° and 180°) so
 * that the adjacent odd gear's tooth can slide in. Odd-indexed gears sit with
 * a tooth at every contact point.
 *
 * @param {number} teeth  Number of teeth on this gear
 * @param {boolean} gapAtContact  true → gap at 0°/180°, false → tooth there
 * @returns {number} Phase offset in degrees
 */
function gearPhaseOffset(teeth, gapAtContact) {
  const step = 360 / teeth;
  // Even gear: shift the last gap so its centre lands on 0° (= 360°).
  //   gap(N-1) centre without phase = (N-1 + 0.735) * step = (N-0.265) * step
  //   required shift = 360 - (N-0.265)*step = 0.265 * step
  // Odd gear: shift the last tooth so its centre lands on 0°.
  //   tooth(N-1) centre without phase = (N-1 + 0.235) * step = (N-0.765) * step
  //   required shift = 360 - (N-0.765)*step = 0.765 * step
  return gapAtContact ? 0.265 * step : 0.765 * step;
}

function bigPow(base, exponent) {
  let result = 1n;
  for (let i = 0; i < exponent; i++) {
    result *= base;
  }
  return result;
}

/**
 * Convert a BigInt into its base‑n representation (where n is the
 * length of the character set) as an array of integer digits. The array
 * is of fixed length `numDigits`; leading zeros are padded at the front.
 *
 * @param {bigint} value The value to convert.
 * @param {bigint} base The base to convert into.
 * @param {number} numDigits The fixed length of the resulting digit array.
 * @returns {number[]} Array of integers representing the base‑n digits.
 */
function bigIntToBase(value, base, numDigits) {
  const digits = new Array(numDigits).fill(0);
  let remainder = value;
  for (let i = 0; i < numDigits; i++) {
    // Compute the digit at this position by dividing by base^i.
    const divisor = bigPow(base, i);
    const digit = remainder / divisor;
    const digitValue = Number(digit % base);
    digits[i] = digitValue;
  }
  return digits;
}

/**
 * Format a duration in seconds into a human readable string HH:MM:SS.
 * If the duration is greater than 99 hours it returns "∞" to indicate
 * impracticality (since brute forcing long passwords with large character
 * sets will take an astronomical amount of time).
 *
 * @param {number} seconds
 * @returns {string}
 */
function formatDuration(seconds) {
  if (!isFinite(seconds) || seconds > 99 * 3600) {
    return '∞';
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const hh = h.toString().padStart(2, '0');
  const mm = m.toString().padStart(2, '0');
  const ss = s.toString().padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

/**
 * Class representing a single gear in the visualisation. A gear is
 * responsible solely for producing its SVG element and updating its
 * rotation transform.
 */
class Gear {
  /**
   * @param {object} options
   * @param {number} options.teeth Number of teeth drawn on this gear
   * @param {number} options.outerRadius Radius to the tip of the teeth
   * @param {number} options.innerRadius Radius to the base of the teeth
   * @param {number} options.x x‑coordinate for the gear centre
   * @param {number} options.y y‑coordinate for the gear centre
   * @param {number} options.direction Rotation direction: 1 for clockwise, -1 for counterclockwise
   * @param {number} options.phaseOffset Static angular offset (degrees) applied on top of the
   *   dynamic rotation so that teeth of adjacent gears align with each other's gaps at rest.
   */
  constructor({ teeth, outerRadius, innerRadius, x, y, direction, phaseOffset = 0 }) {
    this.teeth = teeth;
    this.outerRadius = outerRadius;
    this.innerRadius = innerRadius;
    // The pitch radius is the midpoint between root and tip; adjacent gears are
    // positioned so their pitch circles are tangent, which makes the tooth tips
    // of each gear reach exactly to the root circle of its neighbour.
    this.pitchRadius = (outerRadius + innerRadius) / 2;
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.phaseOffset = phaseOffset;
    this.angle = 0;
    this.element = this.createElement();
  }

  /**
   * Generate the SVG path for a gear with module-correct tooth geometry.
   * Each tooth occupies 47 % of the angular pitch with a 2.5 % bevel on
   * each flank; the remaining 53 % is the gap. Because all gears share the
   * same module the tooth arc length (≈ π × m) is identical across every gear,
   * so teeth of any two adjacent gears interlock without overlap or excess
   * clearance regardless of their size difference.
   *
   * @returns {string}
   */
  generatePath() {
    const pts = [];
    const step = (2 * Math.PI) / this.teeth;
    const ri = this.innerRadius;
    const ro = this.outerRadius;

    const pt = (r, a) =>
      `${(r * Math.cos(a) + this.x).toFixed(3)},${(r * Math.sin(a) + this.y).toFixed(3)}`;

    for (let i = 0; i < this.teeth; i++) {
      const a = i * step;
      // 47 % tooth (0 → 0.47 of pitch), bevelled at tip (0.025 inset each side).
      const aInL  = a;                 // root leading edge
      const aOutL = a + step * 0.025; // tip  leading edge
      const aOutR = a + step * 0.445; // tip  trailing edge
      const aInR  = a + step * 0.47;  // root trailing edge
      const aNext = (i + 1) * step;   // root leading edge of next tooth

      if (i === 0) pts.push(`M${pt(ri, aInL)}`);
      pts.push(`L${pt(ro, aOutL)}`);
      pts.push(`L${pt(ro, aOutR)}`);
      pts.push(`L${pt(ri, aInR)}`);
      // Clockwise arc along root circle through the 53 % gap (always < 180°).
      pts.push(`A${ri},${ri} 0 0,1 ${pt(ri, aNext)}`);
    }
    pts.push('Z');
    return pts.join(' ');
  }

  /**
   * Create the SVG group element for the rotating gear body (path + hub
   * circle). The character label is a separate non‑rotating element stored
   * in this.labelElement so that it stays upright as the gear spins.
   *
   * @returns {SVGGElement}
   */
  createElement() {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathElement.setAttribute('d', this.generatePath());
    pathElement.setAttribute('fill', '#ffffff');
    pathElement.setAttribute('stroke', '#8fa9c9');
    pathElement.setAttribute('stroke-width', '1');
    group.appendChild(pathElement);
    // Hub circle — slightly larger than before to comfortably frame the label.
    const centre = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    centre.setAttribute('cx', this.x.toString());
    centre.setAttribute('cy', this.y.toString());
    centre.setAttribute('r', (this.innerRadius * 0.55).toString());
    centre.setAttribute('fill', '#2a6f97');
    group.appendChild(centre);

    // Non-rotating label — appended to the SVG directly in buildGears so it
    // sits above all gear bodies in the z-order.
    const label = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    label.setAttribute('x', this.x.toString());
    label.setAttribute('y', this.y.toString());
    label.setAttribute('text-anchor', 'middle');
    label.setAttribute('dominant-baseline', 'central');
    label.setAttribute('font-size', Math.round(this.innerRadius * 0.5).toString());
    label.setAttribute('font-family', 'monospace');
    label.setAttribute('font-weight', 'bold');
    label.setAttribute('fill', '#ffffff');
    label.setAttribute('pointer-events', 'none');
    this.labelElement = label;

    return group;
  }

  /**
   * Update the character shown on the gear hub.
   *
   * @param {string} char Single character to display
   */
  setLabel(char) {
    this.labelElement.textContent = char;
  }

  /**
   * Apply rotation to the gear. The rotation is applied by setting
   * the transform attribute on the group element. The gear rotates
   * around its own centre.
   *
   * @param {number} angle Angle in degrees
   */
  setRotation(angle) {
    this.angle = angle;
    this.element.setAttribute(
      'transform',
      `rotate(${(angle + this.phaseOffset).toFixed(3)} ${this.x.toFixed(3)} ${this.y.toFixed(3)})`
    );
  }
}

/**
 * Core class orchestrating the brute force attack simulation and updating
 * both the gears and the UI. This class encapsulates the state of the
 * attack, including the current attempt, selected character set and target
 * password. It owns the animation loop that drives the gear rotations.
 */
class BruteForceVisualizer {
  constructor() {
    // UI Elements
    this.passwordInput = document.getElementById('passwordInput');
    this.charsetSelect = document.getElementById('charsetSelect');
    this.speedRange = document.getElementById('speedRange');
    this.speedValue = document.getElementById('speedValue');
    this.startButton = document.getElementById('startButton');
    this.pauseButton = document.getElementById('pauseButton');
    this.resetButton = document.getElementById('resetButton');
    this.gearSvg = document.getElementById('gearSvg');
    this.targetDisplay = document.getElementById('targetDisplay');
    this.currentAttemptDisplay = document.getElementById('currentAttempt');
    this.totalAttemptsDisplay = document.getElementById('totalAttempts');
    this.statusDisplay = document.getElementById('status');
    this.progressFill = document.getElementById('progressFill');
    this.progressPercent = document.getElementById('progressPercent');
    this.etaDisplay = document.getElementById('eta');

    this.charsetWarning = document.getElementById('charsetWarning');

    // Attack state
    this.charSet = CHARSETS[this.charsetSelect.value];
    this.target = this.passwordInput.value || '';
    this.speed = parseInt(this.speedRange.value, 10);
    this.attemptCount = 0n;
    this.totalCombinations = 0n;
    this.running = false;
    this.lastTime = 0;
    // Accumulated visual rotation for gear 0 (degrees). All other gears are
    // derived from this via the mechanical constraint θ_i = dir_i × θ_0 × N_0/N_i.
    // Keeping it separate from attemptCount avoids the stroboscopic effect that
    // occurs when the rotation per frame is close to a multiple of 180°.
    this.visualGearAngle = 0;

    // Gear data
    this.gears = [];

    // Bind event handlers
    this.startButton.addEventListener('click', () => this.start());
    this.pauseButton.addEventListener('click', () => this.pause());
    this.resetButton.addEventListener('click', () => this.reset());
    this.passwordInput.addEventListener('input', () => this.onConfigChange());
    this.charsetSelect.addEventListener('change', () => this.onConfigChange());
    this.speedRange.addEventListener('input', () => this.onSpeedChange());

    // Initialise UI
    this.onSpeedChange();
    this.onConfigChange();
  }

  /**
   * Reconfigure the simulation whenever the target password or character
   * set changes. This recalculates the total number of combinations,
   * rebuilds the gears and resets the attack state.
   */
  onConfigChange() {
    // Uppercase because all charsets are uppercase
    const rawValue = this.passwordInput.value.toUpperCase();
    this.charSet = CHARSETS[this.charsetSelect.value];
    // Filter to only characters present in the selected charset
    const filtered = Array.from(rawValue).filter(c => this.charSet.includes(c)).join('');
    this.passwordInput.value = filtered;
    // Warn the user if any characters were stripped due to charset mismatch
    if (filtered.length < rawValue.length) {
      this.charsetWarning.textContent = 'Some characters were removed — not in the selected charset.';
      this.charsetWarning.style.display = 'block';
    } else {
      this.charsetWarning.style.display = 'none';
    }
    this.target = filtered;
    this.totalCombinations = bigPow(BigInt(this.charSet.length), this.target.length);
    this.attemptCount = 0n;
    this.updateDashboard();
    this.buildGears();
    this.updateGearOrientations();
    // Reset status
    this.statusDisplay.textContent = 'Idle';
    this.pauseButton.disabled = true;
    // Ensure start button is enabled after reconfiguring
    this.startButton.disabled = false;
    this.running = false;
  }

  /**
   * Handler for speed slider changes. Updates the display and modifies
   * the iteration rate accordingly.
   */
  onSpeedChange() {
    this.speed = parseInt(this.speedRange.value, 10);
    this.speedValue.textContent = `${this.speed}×`;
    this.updateDashboard();
  }

  /**
   * Build or rebuild the gears based on the current password length. Each
   * character position is represented by a gear. The gears are arranged
   * horizontally with increasing radii so larger gears represent more
   * significant digits (which turn more slowly). Directions alternate to
   * simulate meshing.
   */
  buildGears() {
    // Remove existing gears
    while (this.gearSvg.firstChild) {
      this.gearSvg.removeChild(this.gearSvg.firstChild);
    }
    this.gears = [];
    const length = this.target.length;
    if (length === 0) {
      return;
    }
    // Module-based gear design: all gears share module m so every tooth has the
    // same arc length (π × m) and teeth of adjacent gears interlock correctly.
    //
    //   N_i         = baseTeeth × (i + 1)         (teeth grow proportionally with position)
    //   pitchRadius = m × N / 2                   (standard relation)
    //   outerRadius = pitchRadius + m              (addendum = 1 × m)
    //   innerRadius = pitchRadius − 1.25 × m       (dedendum = 1.25 × m, standard clearance)
    //
    // Using N_i = N_0 × (i+1) means gear i has (i+1)× as many teeth as gear 0.
    // The mechanical speed ratio is therefore ω_i = ω_0 × N_0/N_i = ω_0/(i+1):
    // gear 1 turns at half speed, gear 2 at a third, gear 3 at a quarter, etc.
    // Size and speed are fully coupled — the physical tooth-count ratio is the
    // sole determinant of how fast each gear spins.
    const m = 5;           // module (tooth-size unit; same for all gears so teeth mesh)
    const baseTeeth = 12;  // tooth count of the smallest (leftmost, fastest) gear
    const padding = 10;

    // The largest gear (rightmost, most-significant digit) determines how tall
    // the SVG must be. Compute its outer radius before building any gears so the
    // shared centre-line y can be set correctly.
    const maxN = baseTeeth * length;
    const maxOuter = m * maxN / 2 + m;
    const gearCenterY = maxOuter + padding;

    let currentX = 0;
    for (let i = 0; i < length; i++) {
      const teeth      = baseTeeth * (i + 1);
      const pitchRadius = m * teeth / 2;
      const outerRadius = pitchRadius + m;
      const innerRadius = pitchRadius - 1.25 * m;
      // Pitch-circle tangency guarantees the standard 0.25 m tip clearance.
      if (i === 0) {
        currentX = outerRadius;
      } else {
        const prevGear = this.gears[i - 1];
        currentX += prevGear.pitchRadius + pitchRadius;
      }
      // Phase offset computed per gear so a gap (even) or tooth (odd) sits at
      // every contact point, matching the 47/53 tooth/gap duty cycle.
      const phaseOffset = gearPhaseOffset(teeth, i % 2 === 0);
      const gear = new Gear({
        teeth,
        outerRadius,
        innerRadius,
        x: currentX,
        y: gearCenterY,
        direction: i % 2 === 0 ? 1 : -1,
        phaseOffset,
      });
      this.gears.push(gear);
      this.gearSvg.appendChild(gear.element);
    }
    // Append labels after all gear bodies so they render on top.
    for (const gear of this.gears) {
      this.gearSvg.appendChild(gear.labelElement);
    }
    // viewBox: height = 2 × (maxOuter + padding) so the largest gear fits exactly.
    const totalWidth = currentX + this.gears[this.gears.length - 1].outerRadius;
    const viewHeight = 2 * (maxOuter + padding);
    this.gearSvg.setAttribute('viewBox', `0 0 ${totalWidth + 20} ${viewHeight}`);
  }

  /**
   * Start the brute force attack animation. If already running, this call
   * has no effect.
   */
  start() {
    if (this.running || this.target.length === 0) return;
    this.running = true;
    this.statusDisplay.textContent = 'Running';
    this.startButton.disabled = true;
    this.pauseButton.disabled = false;
    this.resetButton.disabled = false;
    // Kick off animation
    this.lastTime = performance.now();
    requestAnimationFrame((ts) => this.loop(ts));
  }

  /**
   * Pause the attack animation. Preserves progress so that calling
   * start() again will resume.
   */
  pause() {
    if (!this.running) return;
    this.running = false;
    this.statusDisplay.textContent = 'Paused';
    this.startButton.disabled = false;
    this.pauseButton.disabled = true;
  }

  /**
   * Reset the simulation to its initial state, clearing progress and
   * resetting UI and gears.
   */
  reset() {
    this.running = false;
    this.attemptCount = 0n;
    this.visualGearAngle = 0;
    this.statusDisplay.textContent = 'Idle';
    this.startButton.disabled = false;
    this.pauseButton.disabled = true;
    this.updateDashboard();
    this.updateGearOrientations();
  }

  /**
   * Core animation loop. It calculates how many attempts should be
   * processed based on elapsed time and configured speed, updates
   * the current attempt, checks for success and updates the UI.
   *
   * @param {number} timestamp High resolution time provided by requestAnimationFrame
   */
  loop(timestamp) {
    if (!this.running) return;
    const delta = timestamp - this.lastTime;
    this.lastTime = timestamp;
    // Approximate frames per second around 60
    const attemptsPerSecond = this.speed * 60;
    // Determine how many attempts to process during this frame
    const attemptsThisFrame = Math.max(1, Math.floor((delta / 1000) * attemptsPerSecond));
    for (let i = 0; i < attemptsThisFrame; i++) {
      // If we've exhausted all combinations, stop
      if (this.attemptCount >= this.totalCombinations) {
        this.running = false;
        this.statusDisplay.textContent = 'Complete';
        this.startButton.disabled = true;
        this.pauseButton.disabled = true;
        break;
      }
      // Compute current attempt string and compare to target
      const attemptString = this.computeAttemptString();
      if (attemptString === this.target) {
        this.running = false;
        this.statusDisplay.textContent = 'Success';
        this.updateDashboard();
        this.startButton.disabled = true;
        this.pauseButton.disabled = true;
        // Update gears one last time at found state
        this.updateGearOrientations();
        return;
      }
      // Not yet correct, advance attempt
      this.attemptCount++;
    }
    // Advance visual gear rotation at a speed-proportional rate, capped to keep
    // rotation per frame below ~90° so the direction of spin remains perceptible.
    // (At high attempt counts the raw attempt-mod formula caused a stroboscopic
    // effect because gear 0 would jump ~150° per frame, appearing stationary.)
    const visualRate = Math.min(this.speed * 0.6, 9); // °/frame for gear 0
    this.visualGearAngle += visualRate;
    // Update UI after processing attempts
    this.updateDashboard();
    this.updateGearOrientations();
    requestAnimationFrame((ts) => this.loop(ts));
  }

  /**
   * Compute the current candidate string based on the attempt counter and
   * selected character set. The attemptCount is treated as a base‑n
   * counter with n equal to the length of the character set. Each digit
   * corresponds to one character position in the password.
   *
   * @returns {string}
   */
  computeAttemptString() {
    if (this.target.length === 0) return '';
    const base = BigInt(this.charSet.length);
    const digits = bigIntToBase(this.attemptCount, base, this.target.length);
    // Build left-to-right: gear 0 (leftmost, fastest) = digits[0] = first character.
    let str = '';
    for (let i = 0; i < digits.length; i++) {
      str += this.charSet[digits[i]];
    }
    return str;
  }

  /**
   * Update the dashboard display with current attempt, attempts made,
   * progress and estimated time remaining. Uses BigInt arithmetic to
   * compute progress even when the total number of combinations is too
   * large to fit in a Number.
   */
  updateDashboard() {
    // Display current candidate string
    const attemptString = this.computeAttemptString();
    this.currentAttemptDisplay.textContent = attemptString;
    // Attempts made — abbreviate if the number is too large to display cleanly
    const attemptStr = this.attemptCount.toString();
    this.totalAttemptsDisplay.textContent = attemptStr.length > 15
      ? `${attemptStr.slice(0, 6)}… (${attemptStr.length} digits)`
      : attemptStr;
    // Progress percentage (integer)
    if (this.totalCombinations > 0n) {
      const percent = (this.attemptCount * 100n) / this.totalCombinations;
      this.progressPercent.textContent = `${percent.toString()}%`;
      this.progressFill.style.width = `${percent.toString()}%`;
    } else {
      this.progressPercent.textContent = '0%';
      this.progressFill.style.width = '0%';
    }
    // ETA based on average case: expect to find the password halfway through
    // the remaining combinations, not at the very end (worst case).
    const attemptsPerSecond = this.speed * 60;
    if (this.totalCombinations > 0n && this.totalCombinations > this.attemptCount) {
      const combsForEstimate = (this.totalCombinations - this.attemptCount) / 2n;
      const maxForEstimate = 1000000000000n;
      if (combsForEstimate > maxForEstimate) {
        this.etaDisplay.textContent = '∞';
      } else {
        const seconds = Number(combsForEstimate) / attemptsPerSecond;
        this.etaDisplay.textContent = formatDuration(seconds);
      }
    } else {
      this.etaDisplay.textContent = '–';
    }
    // Target display always shows current target
    this.targetDisplay.textContent = this.target || '–';
  }

  /**
   * Compute and apply the rotation for each gear and update its hub label.
   *
   * For teeth to mesh correctly as the gears turn, adjacent gears must satisfy
   * the mechanical constraint θ_{i+1} = −θ_i × (N_i / N_{i+1}).  It can be
   * shown that rotating gear i by direction_i × attemptCount × (360 / N_i)
   * satisfies this for every adjacent pair simultaneously:
   *
   *   −θ_i × (N_i/N_{i+1})
   *     = −(dir_i × count × 360/N_i) × (N_i/N_{i+1})
   *     = −dir_i × count × 360/N_{i+1}
   *     =  dir_{i+1} × count × 360/N_{i+1}   (since dir_{i+1} = −dir_i)
   *     = θ_{i+1}  ✓
   *
   * Hub labels are updated from the brute-force digit values independently.
   */
  updateGearOrientations() {
    if (this.gears.length === 0) return;
    const n = this.gears.length;

    // Rotation follows directly from the mechanical coupling: the speed of each
    // gear is inversely proportional to its tooth count.  Gear 0 (N_0 teeth)
    // drives the train; gear i (N_i = N_0 × (i+1) teeth) rotates at
    //   ω_i = ω_0 × N_0 / N_i = ω_0 / (i+1)
    // so gear 1 turns at half speed, gear 2 at a third, etc.  Size and speed are
    // fully determined by the tooth-count ratio — no separate formula needed.
    const N0 = this.gears[0].teeth;
    for (let i = 0; i < n; i++) {
      const gear = this.gears[i];
      const rawAngle = gear.direction * this.visualGearAngle * (N0 / gear.teeth);
      gear.setRotation(((rawAngle % 360) + 360) % 360);
    }

    // Labels come from the brute-force digit decomposition, not the rotation.
    const digits = bigIntToBase(this.attemptCount, BigInt(this.charSet.length), n);
    for (let i = 0; i < n; i++) {
      this.gears[i].setLabel(this.charSet[digits[i]]);
    }
  }
}

// Initialise the visualiser once the DOM has loaded
window.addEventListener('DOMContentLoaded', () => {
  new BruteForceVisualizer();
});