// main.js
import { generateGrid, getDifficultyForLevel, resolveTileSelection } from "./game.js";
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

const MIN_SUBMIT_SCORE = 2000; // minimum score required to submit to global leaderboard
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


// Required performance per level
// function getRequiredGainForLevel(level) {
//  const base = 80;   // level 1 requirement
//  const perLevel = 30;
//  return base + (level - 1) * perLevel;
// }

// Curved difficulty for required points per *level*.
// Idea:
// - Levels 1–5: gentle onboarding
// - 6–10: steady climb
// - 11–15: mid-game challenge
// - 16–20: late-game push
// - 21+: flattens with a soft curve so pros can reach very high levels
function getRequiredGainForLevel(level) {
  if (level <= 0) return 0;

  // 1–5: 80, 95, 110, 125, 140
  if (level <= 5) {
    return 80 + 15 * (level - 1);
  }

  // 6–10: 160, 180, 200, 220, 240
  if (level <= 10) {
    return 160 + 20 * (level - 6);
  }

  // 11–15: 270, 295, 320, 345, 370
  if (level <= 15) {
    return 270 + 25 * (level - 11);
  }

  // 16–20: 400, 430, 460, 490, 520
  if (level <= 20) {
    return 400 + 30 * (level - 16);
  }

  // 21+: slowly rising curve, but not crazy.
  // Requirements hover in the ~550–700+ range so
  // high-level players are challenged but not hard-capped.
  const extra = level - 20;
  const baseAfter20 = 550; // roughly just above Level 20 requirement
  const step = 35;         // how steep the tail gets

  // use log2 for diminishing growth: big jump at first, then flatter
  const gain = baseAfter20 + step * Math.log2(1 + extra);
  return Math.round(gain);
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
  const diff = getDifficultyForLevel(level);
  const fairGrid = generateFairGrid(level);

  // New run → clear current run leaderboard tracking
  currentRunScoreId = null;
  currentRunSavedScore = 0;

  gameState = {
    level,
    turnIndex: 0,
    turns: diff.turns,
    score: 0,
    scoreAtLevelStart: 0,
    missedTurns: 0,
    multiplier: 1,
    chainCount: 0,
    lastTileDelta: 0,
    grid: fairGrid,
    timePerTurnMs: diff.timePerTurnMs,
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
  const diff = getDifficultyForLevel(level);
  const fairGrid = generateFairGrid(level);

  gameState = {
    level,
    turnIndex: 0,
    turns: diff.turns,
    score: prevScore,             // cumulative
    scoreAtLevelStart: prevScore, // baseline for this level
    missedTurns: 0,
    multiplier: 1,
    chainCount: 0,
    lastTileDelta: 0,
    grid: fairGrid,
    timePerTurnMs: diff.timePerTurnMs,
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
  const { grid } = gameState;

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

      if (tile.type === "number") {
        label.textContent = "NUM";
        valueEl.textContent = `${tile.value}`;
      } else if (tile.type === "bonus") {
        label.textContent = "BONUS";
        valueEl.textContent = `+x${(tile.value * 0.25).toFixed(2)}`;
      } else if (tile.type === "chain") {
        label.textContent = "CHAIN";
        valueEl.textContent = `${tile.value}`;
      } else if (tile.type === "risk") {
        label.textContent = "RISK";
        valueEl.textContent = `${tile.value}`;
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
  if (el) el.classList.add("selected");

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
        timeText = `${month}/${day} ${hours}:${mins}${ampm}`;
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

