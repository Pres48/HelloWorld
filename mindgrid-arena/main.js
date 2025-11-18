// main.js
import {
  generateGrid,
  getDifficultyForLevel,
  resolveTileSelection,
  getLevelBehavior,
} from "./game.js";

import { saveScoreToSupabase, fetchTopScores } from "./supabaseClient.js";

const gridContainer = document.getElementById("gridContainer");
const levelDisplay = document.getElementById("levelDisplay");
const turnDisplay = document.getElementById("turnDisplay");
const scoreDisplay = document.getElementById("scoreDisplay");
const multiplierDisplay = document.getElementById("multiplierDisplay");
const timerFill = document.getElementById("timerFill");
const messageArea = document.getElementById("messageArea");
const startButton = document.getElementById("startButton");
const endButton = document.getElementById("endButton");
const restartButton = document.getElementById("restartButton");
const playerNameInput = document.getElementById("playerNameInput");
const playerNameHelper = document.getElementById("playerNameHelper");
const bestScoreDisplay = document.getElementById("bestScoreDisplay");
const bestLevelDisplay = document.getElementById("bestLevelDisplay");
const saveScoreButton = document.getElementById("saveScoreButton");
const saveStatus = document.getElementById("saveStatus");
const lastMoveDisplay = document.getElementById("lastMoveDisplay");
const leaderboardList = document.getElementById("leaderboardList");
const levelGoals = document.getElementById("levelGoals");

// Popover elements
const howToPlayInfoBtn = document.getElementById("howToPlayInfoBtn");
const howToPlayInfoPopover = document.getElementById("howToPlayInfoPopover");
const levelGoalsInfoBtn = document.getElementById("levelGoalsInfoBtn");
const levelGoalsInfoPopover = document.getElementById("levelGoalsInfoPopover");
const leaderboardInfoBtn = document.getElementById("leaderboardInfoBtn");
const leaderboardInfoPopover = document.getElementById("leaderboardInfoPopover");

const MIN_SUBMIT_SCORE = 5000; // minimum score required to submit to global leaderboard
const HIGH_SCORE_NAME_WARN_THRESHOLD = MIN_SUBMIT_SCORE;

let gameState = null;
let timerInterval = null;
let turnDeadline = null;
let selectedThisTurn = false;
let bestScore = 0;
let bestLevel = 0;
let currentRunScoreId = null;
let currentRunSavedScore = 0;

// ---------- Utility ----------
function escapeHtml(str) {
  if (typeof str !== "string") return "";
  return str.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return c;
    }
  });
}

// ---- TILE DISPLAY HELPERS (equations, hiding risk, labels) ----

// Make a simple or multi-step equation string that evaluates to `value`
function makeEquationString(value, multiStepChance = 0) {
  // Guard against weird values
  if (!Number.isFinite(value)) return String(value);

  // Maybe do a multi-step equation
  if (multiStepChance > 0 && Math.random() < multiStepChance) {
    // Simple pattern: a + b - c = value
    // Ensure all integers, keep it readable
    const a = Math.max(1, Math.floor(value * 0.4));
    const b = Math.max(1, Math.floor(value * 0.8) - a);
    const c = a + b - value; // ensures equality

    if (Number.isInteger(c) && c >= 0) {
      // e.g. "10 + 7 - 3"
      return `${a}+${b}-${c}`;
    }
  }

  // Single-op equation: pick from +, -, ×, ÷
  const ops = ["add", "sub", "mul", "div"];
  const op = ops[Math.floor(Math.random() * ops.length)];

  if (op === "add") {
    const a = Math.max(1, Math.floor(value / 2));
    const b = value - a;
    return `${a}+${b}`;
  }

  if (op === "sub") {
    const a = value + Math.max(1, Math.floor(value / 3));
    const b = a - value;
    return `${a}-${b}`;
  }

  if (op === "mul" && value >= 4) {
    // find a small factor
    for (let i = 2; i <= Math.sqrt(value); i++) {
      if (value % i === 0) {
        const a = i;
        const b = value / i;
        return `${a}×${b}`;
      }
    }
  }

  if (op === "div" && value >= 4) {
    const b = Math.max(2, Math.floor(value / 2));
    const a = value * b;
    return `${a}÷${b}`;
  }

  // Fallback: plain value
  return String(value);
}

// Given a tile + behavior, decide what to show as the *value text*
function formatTileDisplay(tile, behavior) {
  const type = tile.type;
  const v = tile.value;

  // Hide RISK value entirely if configured
  if (type === "risk" && behavior.hideRiskValues) {
    return "???";
  }

  // Equations only for number/chain tiles
  const allowEquation = type === "number" || type === "chain";
  if (
    allowEquation &&
    behavior.equationChance > 0 &&
    Math.random() < behavior.equationChance
  ) {
    return makeEquationString(v, behavior.multiStepEquationChance || 0);
  }

  // Otherwise just show the raw number
  return String(v);
}

// Simple in-place shuffle for a square grid [row][col]
function shuffleGridInPlace(grid) {
  if (!grid || !grid.length) return;
  const flat = [];
  grid.forEach((row) => row.forEach((tile) => flat.push(tile)));

  // Fisher–Yates
  for (let i = flat.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [flat[i], flat[j]] = [flat[j], flat[i]];
  }

  const size = grid.length; // square grid
  let idx = 0;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const t = flat[idx++];
      t.row = r;
      t.col = c;
      t.id = `${r}-${c}`;
      grid[r][c] = t;
    }
  }
}


/* ============================================================
   PROFANITY FILTER (safe patterns — fill in your word list)
   ============================================================ */

// Build leetspeak + punctuation-tolerant regex for each word
function buildWordRegex(word) {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const map = {
    a: "[a4@^ÀÁÂÃÄÅàáâãäå∆Λ]",
    e: "[e3ÈÉÊËèéêë€]",
    i: "[i1!|ÌÍÎÏìíîï]",
    o: "[o0°ºòóôõöø]",
    u: "[uµùúûüÙÚÛÜ]",
    s: "[s5$§]",
    t: "[t7+†]",
    b: "[b8ß]",
    g: "[g69]",
    l: "[l1|!¡]",
    c: "[c(<{¢©]",
    k: "[k(<{]",
  };

  const pattern = escaped
    .split("")
    .map((ch) => map[ch.toLowerCase()] || ch)
    .join("");

  // allow punctuation/spaces between letters (f.u.c.k / f u ck)
  return pattern.split("").join("[^a-zA-Z0-9]*");
}

// Put your actual word list BELOW (fill privately in your file only)
const PROFANITY_WORDS = [
  "WORD1",
  "WORD2",
  "WORD3",
  "WORD4",
  "WORD5",
  // ...
];

// Compile the regex patterns
const PROFANITY_PATTERNS = PROFANITY_WORDS.map(
  (w) => new RegExp(buildWordRegex(w), "i")
);

// Main exported function
function isNameProfane(name) {
  if (!name) return false;
  const cleaned = name.normalize("NFKD");
  return PROFANITY_PATTERNS.some((re) => re.test(cleaned));
}


// ======================================================
//  LEVEL GOAL / DIFFICULTY HELPERS (CURVED PROGRESSION)
// ======================================================

function getTheoreticalMaxLevelGain(level) {
  // Use the same function you already have in game.js
  // to know how many turns this level will have.
  const { turns } = getDifficultyForLevel(level); // 8–12 turns

  // These are generous upper bounds given your current tile ranges:
  // NUMBER: 5–20, CHAIN: 5–12, RISK: -25–40, BONUS boosts multiplier.
  if (turns <= 8)  return 650;  // early levels, slow timer, 8 turns
  if (turns <= 10) return 800;  // mid levels, 9–10 turns
  return 950;                   // later levels, 11–12 turns
}

/**
 * Required score gain PER LEVEL to advance.
 * Uses a curved progression so:
 *  - Levels 1–5 ramp gently (onboarding)
 *  - 6–15 ramp steadily (core difficulty)
 *  - 16–20 are spicy
 *  - 20+ ramps with a slow log curve (endless but not impossible)
 *
 * Then we clamp the requirement by getTheoreticalMaxLevelGain(level)
 * so a level is NEVER mathematically impossible.
 */
function getRequiredGainForLevel(level) {
  let required;

  if (level <= 1) {
    // Level 1: easy intro
    required = 80;
  } else if (level <= 5) {
    // Levels 2–5: +15 per level
    // L1: 80, L2: 95, L3: 110, L4: 125, L5: 140
    required = 80 + 15 * (level - 1);
  } else if (level <= 10) {
    // Levels 6–10: ramp a bit quicker, +20 each
    // L6: 160, L7: 180, L8: 200, L9: 220, L10: 240
    required = 160 + 20 * (level - 6);
  } else if (level <= 15) {
    // Levels 11–15: +25 each
    // L11: 270, L12: 295, L13: 320, L14: 345, L15: 370
    required = 270 + 25 * (level - 11);
  } else if (level <= 20) {
    // Levels 16–20: +30 each
    // L16: 400, L17: 430, L18: 460, L19: 490, L20: 520
    required = 400 + 30 * (level - 16);
  } else {
    // 21+ : slow logarithmic growth so it's endless but not insane
    const extra = level - 20;
    const baseAfter20 = 550;  // starting requirement around level 20
    const step = 35;          // strength of late-game ramp
    required = baseAfter20 + step * Math.log2(1 + extra);
  }

  // Round nicely
  required = Math.round(required);

  // 🔒 Safety: never require more than the theoretical max for that level.
  const cap = getTheoreticalMaxLevelGain(level);
  return Math.min(required, cap);
}

// function getAllowedMissesForLevel(level) {
//  if (level <= 3) return 3;
//  if (level <= 6) return 2;
//  return 1;
// }

function getAllowedMissesForLevel(level) {
  // Effectively “infinite” for now — miss count doesn’t gate progression.
  return 9999;
}


// ---------- Fairness helpers: ensure each level is beatable ----------

/**
 * Compute a *feasible* best-case gain for a given static grid and turn count.
 * We only simulate a few simple strategies that are actually possible:
 *  - Always best NUMBER tile
 *  - Always best CHAIN tile
 *  - A few turns of BONUS, then CHAIN
 *  - Always best positive RISK tile
 *
 * Because these are all legal strategies, this is a *lower bound* on true
 * maximum potential gain. If this is < requiredGain, the level is definitely
 * too hard → we reroll the grid.
 */
function computeMaxPossibleGain(grid, turns) {
  let bestNumber = null;
  let bestChain = null;
  let bestBonus = null;
  let bestRiskPos = null;

  // Scan grid for best values of each tile type
  grid.forEach((row) => {
    row.forEach((tile) => {
      const v = tile.value;
      switch (tile.type) {
        case "number":
          bestNumber = bestNumber === null ? v : Math.max(bestNumber, v);
          break;
        case "chain":
          bestChain = bestChain === null ? v : Math.max(bestChain, v);
          break;
        case "bonus":
          bestBonus = bestBonus === null ? v : Math.max(bestBonus, v);
          break;
        case "risk":
          if (v > 0) {
            bestRiskPos = bestRiskPos === null ? v : Math.max(bestRiskPos, v);
          }
          break;
      }
    });
  });

  let maxGain = 0;

  // Strategy A: always best NUMBER tile (no chains/mult changes)
  if (bestNumber !== null) {
    let mult = 1;
    let total = 0;
    for (let i = 0; i < turns; i++) {
      const base = bestNumber;
      total += Math.round(base * mult);
    }
    maxGain = Math.max(maxGain, total);
  }

  // Strategy B: always best CHAIN tile (no bonus)
  if (bestChain !== null) {
    let mult = 1;
    let chainCount = 0;
    let total = 0;
    for (let i = 0; i < turns; i++) {
      const factor = 1 + chainCount * 0.35;
      const base = Math.round(bestChain * factor);
      total += Math.round(base * mult);
      chainCount += 1;
    }
    maxGain = Math.max(maxGain, total);
  }

  // Strategy C: some early BONUS turns to pump multiplier, then CHAIN
  if (bestChain !== null && bestBonus !== null) {
    const maxSetupTurns = Math.min(5, turns); // don't go crazy, just a few
    for (let setup = 1; setup <= maxSetupTurns; setup++) {
      let mult = 1;
      let chainCount = 0;
      let total = 0;

      for (let t = 0; t < turns; t++) {
        if (t < setup) {
          // BONUS turn: small points, boost multiplier
          const base = 1;
          total += Math.round(base * mult);
          mult = parseFloat((mult + bestBonus * 0.25).toFixed(2));
        } else {
          // CHAIN turn with boosted multiplier and chainCount
          const factor = 1 + chainCount * 0.35;
          const base = Math.round(bestChain * factor);
          total += Math.round(base * mult);
          chainCount += 1;
        }
      }

      maxGain = Math.max(maxGain, total);
    }
  }

  // Strategy D: always best positive RISK tile (if any)
  if (bestRiskPos !== null) {
    let mult = 1;
    let total = 0;
    for (let i = 0; i < turns; i++) {
      const base = bestRiskPos;
      total += Math.round(base * mult);
    }
    maxGain = Math.max(maxGain, total);
  }

  return maxGain;
}

/**
 * Generate a "fair" grid for a given level: reroll until
 * the theoretical best-case gain is at least the requiredGain
 * for that level. Never lowers the target.
 */
function generateFairGrid(level) {
  const { turns } = getDifficultyForLevel(level);
  const requiredGain = getRequiredGainForLevel(level);
  let grid;
  let tries = 0;

  do {
    grid = generateGrid(level);
    tries++;
    const maxPossible = computeMaxPossibleGain(grid, turns);

    // If this grid is capable of reaching the required gain, or we've tried
    // too many times (safety cap), accept it.
    if (maxPossible >= requiredGain || tries >= 30) {
      break;
    }
  } while (true);

  return grid;
}

function resetTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerFill.style.width = "0%";
  turnDeadline = null;
}

function setNameWarningActive(active) {
  if (!playerNameInput || !playerNameHelper) return;
  if (active) {
    playerNameHelper.classList.add("warning");
    playerNameInput.classList.add("name-warning");
  } else {
    playerNameHelper.classList.remove("warning");
    playerNameInput.classList.remove("name-warning");
  }
}

// ---------- Core Game ----------

function startGame() {
  const level = 1;

  // New run → clear current run leaderboard tracking
  currentRunScoreId = null;
  currentRunSavedScore = 0;

  const difficulty = getDifficultyForLevel(level);
  const behavior = getLevelBehavior(level);

  gameState = {
    level,
    turnIndex: 0,
    turns: difficulty.turns,
    score: 0,
    scoreAtLevelStart: 0,
    missedTurns: 0,
    multiplier: 1,
    chainCount: 0,
    lastTileDelta: 0,
    grid: generateGrid(level),
    timePerTurnMs: difficulty.timePerTurnMs,
    behavior,
    locked: false,
  };

  updateUIFromState();
  updateLevelGoals();
  renderGrid();
  messageArea.textContent = "Pick a tile before the time runs out!";

  startButton.disabled = true;
  restartButton.disabled = false;
  endButton.disabled = false;
  saveScoreButton.disabled = true;
  saveStatus.textContent = "";

  nextTurn();
}


function startLevel(level) {
  const prevScore = gameState ? gameState.score : 0;

  const difficulty = getDifficultyForLevel(level);
  const behavior = getLevelBehavior(level);

  gameState = {
    level,
    turnIndex: 0,
    turns: difficulty.turns,
    score: prevScore,             // cumulative
    scoreAtLevelStart: prevScore, // baseline for this level
    missedTurns: 0,
    multiplier: 1,
    chainCount: 0,
    lastTileDelta: 0,
    grid: generateGrid(level),
    timePerTurnMs: difficulty.timePerTurnMs,
    behavior,
    locked: false,
  };

  updateUIFromState();
  updateLevelGoals();
  renderGrid();
  messageArea.textContent = `Level ${level}: Faster & trickier tiles.`;

  startButton.disabled = true;
  restartButton.disabled = false;
  endButton.disabled = false;
  saveScoreButton.disabled = true;
  saveStatus.textContent = "";

  nextTurn();
}


function nextTurn() {
  if (!gameState) return;

  const behavior = gameState.behavior || getLevelBehavior(gameState.level);

  // Optional: shuffle grid each turn for higher levels
  if (behavior.shuffleEachTurn) {
    shuffleGridInPlace(gameState.grid);
    renderGrid();
  }

  if (gameState.turnIndex >= gameState.turns) {
    endRound(); // normal end of level
    return;
  }

  selectedThisTurn = false;
  setTilesDisabled(false);
  timerFill.style.transition = "none";
  timerFill.style.width = "100%";

  const now = performance.now();
  const duration = gameState.timePerTurnMs;
  turnDeadline = now + duration;

  timerInterval = setInterval(() => {
    const nowInner = performance.now();
    const remaining = Math.max(0, turnDeadline - nowInner);
    const pct = (remaining / duration) * 100;
    timerFill.style.transition = "width 0.05s linear";
    timerFill.style.width = `${pct}%`;

    if (remaining <= 0) {
      clearInterval(timerInterval);
      timerInterval = null;
      if (!selectedThisTurn) {
        handleMissedTurn();
      }
    }
  }, 50);

  updateTurnDisplay();
}

function handleMissedTurn() {
  setTilesDisabled(true);
  messageArea.textContent = "Missed! No tile selected this turn.";

  gameState.turnIndex += 1;
  gameState.chainCount = 0;
  gameState.lastTileDelta = 0;
  gameState.missedTurns = (gameState.missedTurns || 0) + 1;

  updateUIFromState();

  setTimeout(() => {
    nextTurn();
  }, 400);
}

function setTilesDisabled(disabled) {
  const tileEls = gridContainer.querySelectorAll(".tile");
  tileEls.forEach((el) => {
    if (disabled) el.classList.add("disabled");
    else el.classList.remove("disabled");
  });
}

function renderGrid() {
  gridContainer.innerHTML = "";
  if (!gameState) return;
  const { grid, behavior: storedBehavior } = gameState;

  const behavior = storedBehavior || getLevelBehavior(gameState.level);

  const size = grid.length;
  gridContainer.style.gridTemplateColumns = `repeat(${size}, minmax(0, 1fr))`;

  grid.forEach((row) => {
    row.forEach((tile) => {
      const tileEl = document.createElement("button");
      tileEl.className = `tile type-${tile.type}`;
      tileEl.dataset.tileId = tile.id;

      const label = document.createElement("span");
      label.className = "tile-label";
      const valueEl = document.createElement("span");
      valueEl.className = "tile-value";

      // Decide whether to show labels
      const isNumberOrChain = tile.type === "number" || tile.type === "chain";
      const showLabel =
        (isNumberOrChain && behavior.showNumberChainLabels) ||
        (!isNumberOrChain && behavior.showOtherLabels);

      if (tile.type === "number") {
        if (showLabel) label.textContent = "NUM";
        valueEl.textContent = formatTileDisplay(tile, behavior);
      } else if (tile.type === "bonus") {
        if (showLabel) label.textContent = "BONUS";
        // Bonus tiles still show multiplier, not equations
        valueEl.textContent = `+x${(tile.value * 0.25).toFixed(2)}`;
      } else if (tile.type === "chain") {
        if (showLabel) label.textContent = "CHAIN";
        valueEl.textContent = formatTileDisplay(tile, behavior);
      } else if (tile.type === "risk") {
        if (showLabel) label.textContent = "RISK";
        // Risk may hide value based on behavior
        valueEl.textContent = formatTileDisplay(tile, behavior);
      }

      const text = valueEl.textContent || "";
      if (text.length >= 5) {
        valueEl.style.transform = "scale(0.90)";
      }
      if (text.length >= 7) {
        valueEl.style.transform = "scale(0.80)";
      }
      
      tileEl.appendChild(label);
      tileEl.appendChild(valueEl);

      tileEl.onclick = () => onTileClick(tile);

      gridContainer.appendChild(tileEl);
    });
  });
}


function onTileClick(tile) {
  if (!gameState || gameState.locked) return;
  if (selectedThisTurn) return;

  selectedThisTurn = true;
  setTilesDisabled(true);

const el = gridContainer.querySelector(`[data-tile-id="${tile.id}"]`);
if (el) {
  el.classList.add("selected");

  // If risk values are hidden at this level, reveal this one on click
  if (tile.type === "risk" && shouldHideRiskValues(gameState.level)) {
    const valueSpan = el.querySelector(".tile-value");
    if (valueSpan) {
      valueSpan.textContent = tile.value;          // show actual number
      valueSpan.classList.add("risk-revealed");    // optional, for a little effect
    }
  }
}

resetTimer();

const updatedState = resolveTileSelection(tile, gameState);

  gameState = {
    ...gameState,
    ...updatedState,
  };

  updateUIFromState();

  setTimeout(() => {
    nextTurn();
  }, 300);
}

// ---------- UI Updates ----------

function updateUIFromState() {
  if (!gameState) return;

  levelDisplay.textContent = gameState.level;
  scoreDisplay.textContent = gameState.score.toLocaleString();
  multiplierDisplay.textContent = `x${gameState.multiplier.toFixed(2)}`;
  updateTurnDisplay();

  const delta = gameState.lastTileDelta ?? 0;
  let text = delta === 0 ? "0" : delta > 0 ? `+${delta}` : `${delta}`;
  lastMoveDisplay.textContent = text;

  if (delta > 0) {
    lastMoveDisplay.style.color = "#22c55e";
  } else if (delta < 0) {
    lastMoveDisplay.style.color = "#f97373";
  } else {
    lastMoveDisplay.style.color = "#9ca3af";
  }
}

function updateTurnDisplay() {
  if (!gameState) {
    turnDisplay.textContent = "0 / 0";
    return;
  }
  const currentTurn = Math.min(gameState.turnIndex + 1, gameState.turns);
  turnDisplay.textContent = `${currentTurn} / ${gameState.turns}`;
}

function updateLevelGoals() {
  if (!gameState || !levelGoals) {
    if (levelGoals) levelGoals.textContent = "";
    return;
  }

  const level = gameState.level;
  const target = getRequiredGainForLevel(level);

  levelGoals.textContent =
    `Level ${level} target: +${target.toLocaleString()} pts`;
}



// ---------- Auto-save to leaderboard ----------

async function autoSaveScoreIfEligible() {
  if (!gameState) return;

  const finalScore = gameState.score;

  // Below threshold → don't save, just show hint
  if (finalScore < MIN_SUBMIT_SCORE) {
    saveScoreButton.disabled = true;
    saveStatus.textContent = `Reach at least ${MIN_SUBMIT_SCORE} points to appear on the global leaderboard.`;
    saveStatus.style.color = "#9ca3af";
    return;
  }

  // 👇 NEW: only save if this run's score improved over what we've already logged
  if (finalScore <= currentRunSavedScore) {
    return;
  }

  const rawName =
    playerNameInput && playerNameInput.value ? playerNameInput.value : "";
  const trimmed = rawName.trim();

  // High score + blank name → warn, don't save yet
  if (finalScore >= HIGH_SCORE_NAME_WARN_THRESHOLD && trimmed.length === 0) {
    saveStatus.textContent =
      "Enter a name to save this high score on the public leaderboard.";
    saveStatus.style.color = "#f97373";
    saveScoreButton.disabled = false; // allow manual retry after they type
    setNameWarningActive(true);
    return;
  }

  // Profanity/inappropriate filter
  if (trimmed && isNameProfane(trimmed)) {
    saveStatus.textContent =
      "That name isn't allowed on the public leaderboard. Please choose a different one.";
    saveStatus.style.color = "#f97373";
    saveScoreButton.disabled = false;
    setNameWarningActive(true);
    return;
  }

  // Safe to use. If still blank (shouldn't happen with threshold), fallback to Guest.
  const nameToUse = trimmed || "Guest";

  saveScoreButton.disabled = true;
  saveStatus.textContent = "Saving to leaderboard…";
  saveStatus.style.color = "#9ca3af";

  try {
    // 👇 NEW: pass currentRunScoreId so Supabase can UPDATE instead of always INSERT
    const returnedId = await saveScoreToSupabase(
      nameToUse,
      finalScore,
      gameState.level,
      currentRunScoreId
    );

    // Track this row + score for the rest of the run
    currentRunScoreId = returnedId;
    currentRunSavedScore = finalScore;

    saveStatus.textContent = "Auto-saved to leaderboard.";
    saveStatus.style.color = "#22c55e";

    await loadLeaderboard();
  } catch (err) {
    console.error("Auto-save error:", err);
    saveStatus.textContent = "Auto-save failed. Tap to retry.";
    saveStatus.style.color = "#f97373";
    saveScoreButton.disabled = false; // allow manual retry
  }
}

function triggerFireworks() {
  const overlay = document.getElementById("fireworksOverlay");
  if (!overlay) return;

  overlay.innerHTML = "";
  overlay.classList.add("active");

  const burstCount = 4; // number of distinct bursts
  const particlesPerBurst = 26; // per burst
  const colors = [
    "#f97316", // orange
    "#facc15", // yellow
    "#22c55e", // green
    "#38bdf8", // blue
    "#a855f7", // purple
    "#f97373", // red
  ];

  const allDurations = [];

  for (let b = 0; b < burstCount; b++) {
    // Random center for each burst (keep mostly in the middle)
    const centerX = 25 + Math.random() * 50; // % across width
    const centerY = 30 + Math.random() * 40; // % down height

    for (let i = 0; i < particlesPerBurst; i++) {
      const p = document.createElement("span");
      p.className = "firework-particle";

      // Random radial direction
      const angle = Math.random() * Math.PI * 2;
      const distance = 90 + Math.random() * 130; // 90–220px

      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;

      p.style.setProperty("--dx", `${dx}px`);
      p.style.setProperty("--dy", `${dy}px`);

      // Random size
      const size = 7 + Math.random() * 7; // 7–14px
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;

      // Color glow variant
      const color = colors[(b + i) % colors.length];
      p.style.background = color;
      p.style.boxShadow = `
        0 0 8px ${color},
        0 0 18px ${color}AA,
        0 0 26px ${color}77
      `;

      // Random duration & delay for more organic feel
      const duration = 750 + Math.random() * 350; // 750–1100ms
      const delay = Math.random() * 200 + b * 100; // stagger bursts slightly

      p.style.animationDuration = `${duration}ms`;
      p.style.animationDelay = `${delay}ms`;

      allDurations.push(duration + delay);

      // Place at the chosen burst center
      p.style.left = `${centerX}%`;
      p.style.top = `${centerY}%`;

      overlay.appendChild(p);
    }
  }

  // Turn off overlay after the longest particle finishes
  const maxTotal = Math.max(...allDurations);
  setTimeout(() => {
    overlay.classList.remove("active");
    overlay.innerHTML = "";
  }, maxTotal + 200);
}



// ---------- End of Round & Progression ----------

function endRound(reason = "normal") {
  resetTimer();
  setTilesDisabled(true);
  if (!gameState) return;
  gameState.locked = true;

  const finalScore = gameState.score;
  const level = gameState.level;
  const levelGain = finalScore - (gameState.scoreAtLevelStart || 0);
  const missed = gameState.missedTurns || 0;

  const requiredGain = getRequiredGainForLevel(level);

  // ✅ Only gate on points now
  const passedScoreGate = levelGain >= requiredGain;
  const passedMissGate = true; // ignore misses for progression (for now)

  // Track session best (cumulative score)
  if (finalScore > bestScore) {
    bestScore = finalScore;
    bestLevel = level;
    bestScoreDisplay.textContent = bestScore.toLocaleString();
    bestLevelDisplay.textContent = bestLevel;
  }

  // Auto-save (or show why not)
  autoSaveScoreIfEligible();

  // If player chose End Game, always treat as run over
  if (reason === "quit") {
    messageArea.innerHTML =
      `<strong class="over">Run ended by player at Level ${level}.</strong> ` +
      `Final score: ${finalScore.toLocaleString()}.`;

    startButton.disabled = false;
    startButton.textContent = "Start Game";
    startButton.onclick = startGame;
    endButton.disabled = true;
    if (levelGoals) levelGoals.textContent = "";
    return;
  }

  if (passedScoreGate) {
    // 🎆 Fireworks on level clear
    triggerFireworks();
    
    // ✅ Level cleared – allow NEXT level (misses are just informational)
    messageArea.innerHTML =
      `<strong>Level ${level} cleared!</strong> ` +
      `You earned ${levelGain.toLocaleString()} points this level ` +
      `(${missed} missed turn${missed === 1 ? "" : "s"}).`;

    // Show NEXT level’s point requirement
    const nextLevel = level + 1;
    const targetNext = getRequiredGainForLevel(nextLevel);
    if (levelGoals) {
      levelGoals.textContent =
        `Level ${nextLevel} target: +${targetNext.toLocaleString()} pts`;
    }

    startButton.disabled = false;
    startButton.textContent = "Play Next Level";
    startButton.onclick = () => {
      startLevel(nextLevel);
    };
  } else {
    // ❌ Run ends here due to not hitting the point target
    let reasonText = "";
    reasonText += `You needed at least ${requiredGain.toLocaleString()} points this level (you got ${levelGain.toLocaleString()}).`;

    messageArea.innerHTML =
      `<strong class="over">Run over at Level ${level}.</strong> ` +
      `Final score: ${finalScore.toLocaleString()}. ${reasonText}`;

    startButton.disabled = false;
    startButton.textContent = "Start Game";
    startButton.onclick = startGame;

    if (levelGoals) levelGoals.textContent = "";
  }

  // In any end-of-round case, there's no active run anymore
  endButton.disabled = true;
}


// ---------- Leaderboard ----------

async function loadLeaderboard() {
  if (!leaderboardList) return;

  leaderboardList.innerHTML = `<p class="soft-text">Loading…</p>`;

  try {
    const rows = await fetchTopScores(10);

    if (!rows || rows.length === 0) {
      leaderboardList.innerHTML = `<p class="soft-text">No scores yet. Be the first!</p>`;
      return;
    }

    leaderboardList.innerHTML = "";
    const fragment = document.createDocumentFragment();

    rows.forEach((row, index) => {
      const div = document.createElement("div");
      div.className = "leaderboard-row";

      const safeName = escapeHtml(row.name || "Guest");
      const score = row.score ?? 0;
      const lvl = row.level ?? 1;

      let timeText = "";
      if (row.created_at) {
        const d = new Date(row.created_at);
        const month = d.getMonth() + 1;
        const day = d.getDate();
        let hours = d.getHours();
        const mins = d.getMinutes().toString().padStart(2, "0");
        const ampm = hours >= 12 ? "p" : "a";
        hours = hours % 12 || 12;
        // timeText = `${month}/${day} ${hours}:${mins}${ampm}`;
        timeText = `${month}/${day}`;
      }

      div.innerHTML = `
        <span class="rank">#${index + 1}</span>
        <span class="entry-name">${safeName}</span>
        <span class="entry-score">${score.toLocaleString()}</span>
        <span class="entry-level">Lv ${lvl}</span>
        <span class="entry-time">${timeText}</span>
      `;
      
      fragment.appendChild(div);
    });

    leaderboardList.appendChild(fragment);
  } catch (err) {
    console.error("Leaderboard load error:", err);
    leaderboardList.innerHTML = `<p class="soft-text">Error loading leaderboard.</p>`;
  }
}

async function handleSaveScore() {
  // Manual retry just reuses auto-save logic
  await autoSaveScoreIfEligible();
}

// ---------- End Game, Restart, Init ----------

function endGame() {
  // Only end if a run is active and not already locked
  if (!gameState || gameState.locked) return;
  endRound("quit");
}

function restartGame() {
  resetTimer();
  startButton.disabled = true;
  startButton.textContent = "Start Game";
  saveStatus.textContent = "";
  saveStatus.style.color = "";
  endButton.disabled = true;
  startGame();
}

function init() {
  // Main buttons
  startButton.onclick = startGame;
  restartButton.onclick = restartGame;
  endButton.onclick = endGame;
  saveScoreButton.onclick = handleSaveScore;

  // Initial UI state
  bestScoreDisplay.textContent = "–";
  bestLevelDisplay.textContent = "–";
  restartButton.disabled = true;
  endButton.disabled = true;
  saveScoreButton.disabled = true;
  
  // --- Dynamically update popover leaderboard minimum ---
  const minScoreSpan = document.getElementById("leaderboardMinScore");
  if (minScoreSpan) {
    minScoreSpan.textContent = MIN_SUBMIT_SCORE.toLocaleString();
  }

  // Initial Level 1 goals before the first game starts (points-only)
  if (levelGoals) {
    const initialLevel = 1;
    const target = getRequiredGainForLevel(initialLevel);
    levelGoals.textContent =
      `Level ${initialLevel} target: +${target.toLocaleString()} pts`;
  }

  // Restore player name from previous visit, if any
  try {
    const savedName = localStorage.getItem("mindgridPlayerName");
    if (savedName && typeof savedName === "string" && playerNameInput) {
      playerNameInput.value = savedName;
    }
  } catch (e) {
    console.warn("Name restore skipped (localStorage unavailable):", e);
  }

  // Persist player name on change + clear warnings
  if (playerNameInput) {
    playerNameInput.addEventListener("input", () => {
      const raw = playerNameInput.value || "";
      const trimmed = raw.trim();

      setNameWarningActive(false);

      try {
        if (trimmed.length === 0) {
          localStorage.removeItem("mindgridPlayerName");
        } else {
          localStorage.setItem("mindgridPlayerName", trimmed);
        }
      } catch (e) {
        console.warn("Name save skipped (localStorage unavailable):", e);
      }
    });
  }

  // Load leaderboard on page load
  loadLeaderboard();

  // --- Popover helpers ---
  function togglePopover(popover) {
    if (!popover) return;
    const isVisible = popover.classList.contains("visible");

    // close all first
    [howToPlayInfoPopover, levelGoalsInfoPopover, leaderboardInfoPopover].forEach((p) => {
      if (p) p.classList.remove("visible");
    });

    if (!isVisible) {
      popover.classList.add("visible");
    }
  }

  if (howToPlayInfoBtn && howToPlayInfoPopover) {
    howToPlayInfoBtn.onclick = (e) => {
      e.stopPropagation();
      togglePopover(howToPlayInfoPopover);
    };
  }

  if (levelGoalsInfoBtn && levelGoalsInfoPopover) {
    levelGoalsInfoBtn.onclick = (e) => {
      e.stopPropagation();
      togglePopover(levelGoalsInfoPopover);
    };
  }

  if (leaderboardInfoBtn && leaderboardInfoPopover) {
    leaderboardInfoBtn.onclick = (e) => {
      e.stopPropagation();
      togglePopover(leaderboardInfoPopover);
    };
  }

  // Click anywhere else closes all popovers
  document.addEventListener("click", () => {
    [howToPlayInfoPopover, levelGoalsInfoPopover, leaderboardInfoPopover].forEach((p) => {
      if (p) p.classList.remove("visible");
    });
  });

  // Prevent clicks inside popovers from closing them
  [howToPlayInfoPopover, levelGoalsInfoPopover, leaderboardInfoPopover].forEach((p) => {
    if (!p) return;
    p.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  });

  // --- How to Play accordion with smooth slide + saved state ---
  const howToPlayToggle = document.getElementById("howToPlayToggle");
  const howToPlayContent = document.getElementById("howToPlayContent");
  const howToPlayArrow = document.getElementById("howToPlayArrow");
  const HOW_TO_PLAY_KEY = "mindgridHowToPlayOpen";

  function setHowToPlayOpen(open) {
    if (!howToPlayContent || !howToPlayArrow) return;

    if (open) {
      howToPlayContent.classList.add("open");
      howToPlayArrow.classList.add("open");
      // use scrollHeight for smooth dynamic height
      howToPlayContent.style.maxHeight = howToPlayContent.scrollHeight + "px";
    } else {
      howToPlayContent.classList.remove("open");
      howToPlayArrow.classList.remove("open");
      howToPlayContent.style.maxHeight = "0px";
    }
  }

  // Restore saved state (default: open on first visit)
  let initialOpen = true;
  try {
    const stored = localStorage.getItem(HOW_TO_PLAY_KEY);
    if (stored === "0") initialOpen = false;
    if (stored === "1") initialOpen = true;
  } catch (e) {
    // ignore if storage not available
  }
  setHowToPlayOpen(initialOpen);

  if (howToPlayToggle && howToPlayContent && howToPlayArrow) {
    howToPlayToggle.onclick = (e) => {
      e.preventDefault();
      const nowOpen = !howToPlayContent.classList.contains("open");
      setHowToPlayOpen(nowOpen);

      try {
        localStorage.setItem(HOW_TO_PLAY_KEY, nowOpen ? "1" : "0");
      } catch (e2) {
        // ignore storage errors
      }
    };
  }
}

init();

