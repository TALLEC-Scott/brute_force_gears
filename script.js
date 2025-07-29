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
   */
  constructor({ teeth, outerRadius, innerRadius, x, y, direction }) {
    this.teeth = teeth;
    this.outerRadius = outerRadius;
    this.innerRadius = innerRadius;
    this.x = x;
    this.y = y;
    this.direction = direction;
    this.angle = 0;
    this.element = this.createElement();
  }

  /**
   * Generate the SVG path string for a simplistic gear shape. Each tooth is
   * represented as a triangular wedge from the inner radius to the outer
   * radius. While not mechanically perfect, this shape captures the key
   * characteristics of gears in an easily computed form.
   *
   * @returns {string}
   */
  generatePath() {
    const points = [];
    const toothAngle = (2 * Math.PI) / this.teeth;
    for (let i = 0; i < this.teeth; i++) {
      const angle = i * toothAngle;
      const nextAngle = angle + toothAngle;
      // Root of the tooth at inner radius
      const x0 = this.innerRadius * Math.cos(angle);
      const y0 = this.innerRadius * Math.sin(angle);
      // Tip of the tooth at mid angle
      const midAngle = angle + toothAngle / 2;
      const x1 = this.outerRadius * Math.cos(midAngle);
      const y1 = this.outerRadius * Math.sin(midAngle);
      // End of the tooth at inner radius
      const x2 = this.innerRadius * Math.cos(nextAngle);
      const y2 = this.innerRadius * Math.sin(nextAngle);
      // Add commands
      points.push(`${i === 0 ? 'M' : 'L'}${(x0 + this.x).toFixed(3)},${(y0 + this.y).toFixed(3)}`);
      points.push(`L${(x1 + this.x).toFixed(3)},${(y1 + this.y).toFixed(3)}`);
      points.push(`L${(x2 + this.x).toFixed(3)},${(y2 + this.y).toFixed(3)}`);
    }
    points.push('Z');
    return points.join(' ');
  }

  /**
   * Create the SVG group element for this gear, including the path and
   * optionally a central circle to visually anchor the gear.
   *
   * @returns {SVGGElement}
   */
  createElement() {
    const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    // Generate gear path
    const pathElement = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathElement.setAttribute('d', this.generatePath());
    pathElement.setAttribute('fill', '#ffffff');
    pathElement.setAttribute('stroke', '#8fa9c9');
    pathElement.setAttribute('stroke-width', '1');
    group.appendChild(pathElement);
    // Optional centre circle
    const centre = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    centre.setAttribute('cx', this.x.toString());
    centre.setAttribute('cy', this.y.toString());
    centre.setAttribute('r', (this.innerRadius * 0.4).toString());
    centre.setAttribute('fill', '#2a6f97');
    group.appendChild(centre);
    return group;
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
      `rotate(${angle.toFixed(3)} ${this.x.toFixed(3)} ${this.y.toFixed(3)})`
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

    // Attack state
    this.charSet = CHARSETS[this.charsetSelect.value];
    this.target = this.passwordInput.value || '';
    this.speed = parseInt(this.speedRange.value, 10);
    this.attemptCount = 0n;
    this.totalCombinations = 0n;
    this.running = false;
    this.lastTime = 0;

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
    // Update internal settings
    this.target = this.passwordInput.value.toUpperCase();
    // Convert to uppercase because our charsets are uppercase; maintain only valid characters
    this.passwordInput.value = this.target;
    this.charSet = CHARSETS[this.charsetSelect.value];
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
    // Determine base sizes
    const baseOuter = 40;
    const baseInner = 30;
    let currentX = 0;
    for (let i = 0; i < length; i++) {
      // Radii increase slightly for each subsequent gear
      const outerRadius = baseOuter + i * 8;
      const innerRadius = outerRadius - 10;
      // Compute position: centre gears next to each other with slight overlap to simulate meshing
      if (i === 0) {
        currentX = outerRadius;
      } else {
        const prevGear = this.gears[i - 1];
        currentX += prevGear.outerRadius + outerRadius - 4;
      }
      const gear = new Gear({
        teeth: 12,
        outerRadius,
        innerRadius,
        x: currentX,
        y: 90,
        direction: i % 2 === 0 ? 1 : -1,
      });
      this.gears.push(gear);
      this.gearSvg.appendChild(gear.element);
    }
    // Resize SVG view box based on total width
    const totalWidth = currentX + this.gears[this.gears.length - 1].outerRadius;
    const maxRadius = Math.max(...this.gears.map((g) => g.outerRadius));
    const height = maxRadius * 2 + 20;
    this.gearSvg.setAttribute('viewBox', `0 0 ${totalWidth + 20} ${height}`);
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
    // Map digits to characters; digits array indexes correspond to positions
    let str = '';
    for (let i = digits.length - 1; i >= 0; i--) {
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
    // Attempts made
    this.totalAttemptsDisplay.textContent = this.attemptCount.toString();
    // Progress percentage (integer)
    if (this.totalCombinations > 0n) {
      const percent = (this.attemptCount * 100n) / this.totalCombinations;
      this.progressPercent.textContent = `${percent.toString()}%`;
      this.progressFill.style.width = `${percent.toString()}%`;
    } else {
      this.progressPercent.textContent = '0%';
      this.progressFill.style.width = '0%';
    }
    // Estimated time remaining
    if (this.running && this.totalCombinations > this.attemptCount) {
      const remaining = this.totalCombinations - this.attemptCount;
      // attempts per second ~ speed * 60 (approximate 60fps)
      const attemptsPerSecond = this.speed * 60;
      // When remaining is very large, converting to Number can overflow. Use a threshold.
      // If remaining exceeds 1e12, display infinity.
      const maxRemainingForEstimate = 1000000000000n;
      if (remaining > maxRemainingForEstimate) {
        this.etaDisplay.textContent = '∞';
      } else {
        const seconds = Number(remaining) / attemptsPerSecond;
        this.etaDisplay.textContent = formatDuration(seconds);
      }
    } else {
      this.etaDisplay.textContent = '∞';
    }
    // Target display always shows current target
    this.targetDisplay.textContent = this.target || '–';
  }

  /**
   * Compute and apply the rotation for each gear based on the current
   * attempt count and the selected character set length. The least
   * significant gear (position 0) rotates fastest; each subsequent gear
   * rotates charSet.length times slower. Directions alternate to
   * simulate meshing.
   */
  updateGearOrientations() {
    if (this.gears.length === 0) return;
    const base = this.charSet.length;
    // Convert the current attempt into base‑n digits. We use the same helper
    // as for computing the candidate string; digits[0] corresponds to the
    // least significant position, digits[i] to position i.
    const digits = bigIntToBase(this.attemptCount, BigInt(base), this.gears.length);
    for (let i = 0; i < this.gears.length; i++) {
      const digit = digits[i];
      // Each increment of a digit corresponds to a step of 360/base degrees.
      const angle = this.gears[i].direction * digit * (360 / base);
      // Normalise angle to within 0–360 to prevent large transforms from
      // accumulating floating point error.
      const normalized = ((angle % 360) + 360) % 360;
      this.gears[i].setRotation(normalized);
    }
  }
}

// Initialise the visualiser once the DOM has loaded
window.addEventListener('DOMContentLoaded', () => {
  new BruteForceVisualizer();
});