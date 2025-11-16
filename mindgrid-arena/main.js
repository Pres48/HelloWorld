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
const restartButton = document.getElementById("restartButton");
const playerNameInput = document.getElementById("playerNameInput");
const bestScoreDisplay = document.getElementById("bestScoreDisplay");
const bestLevelDisplay = document.getElementById("bestLevelDisplay");
const saveScoreButton = document.getElementById("saveScoreButton");
const saveStatus = document.getElementById("saveStatus");
const lastMoveDisplay = document.getElementById("lastMoveDisplay");
const leaderboardList = document.getElementById("leaderboardList");
const MIN_SUBMIT_SCORE = 200; // minimum score required to submit to global leaderboard

let gameState = null;
let timerInterval = null;
let turnDeadline = null;
let selectedThisTurn = false;
let bestScore = 0;
let bestLevel = 0;

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

function resetTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerFill.style.width = "0%";
  turnDeadline = null;
}

/**
 * Initialize a new run.
 */
function startGame() {
  const level = 1;

  gameState = {
    level,
    turnIndex: 0,
    turns: getDifficultyForLevel(level).turns,
    score: 0,                  // NEW RUN always starts at 0
    multiplier: 1,
    chainCount: 0,
    lastTileDelta: 0,
    grid: generateGrid(level),
    timePerTurnMs: getDifficultyForLevel(level).timePerTurnMs,
    locked: false,
  };

  updateUIFromState();
  renderGrid();
  messageArea.textContent = "Pick a tile before the time runs out!";

  startButton.disabled = true;
  restartButton.disabled = false;
  saveScoreButton.disabled = true;
  saveStatus.textContent = "";

  nextTurn();
}


/**
 * Starts timer and waits for a tile click. If none, auto-advance.
 */
function nextTurn() {
  if (!gameState) return;

  if (gameState.turnIndex >= gameState.turns) {
    endRound();
    return;
  }

  selectedThisTurn = false;
  // enable tiles
  setTilesDisabled(false);
  timerFill.style.transition = "none";
  timerFill.style.width = "100%";

  const now = performance.now();
  const duration = gameState.timePerTurnMs;
  turnDeadline = now + duration;

  // Timer animation
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

/**
 * Create DOM for current grid.
 */
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

      tileEl.addEventListener("click", () => onTileClick(tile));

      gridContainer.appendChild(tileEl);
    });
  });
}

/**
 * Handle tile click -> update state, go to next turn.
 */
function onTileClick(tile) {
  if (!gameState || gameState.locked) return;
  if (selectedThisTurn) return;

  selectedThisTurn = true;
  setTilesDisabled(true);

  // highlight selected
  const el = gridContainer.querySelector(`[data-tile-id="${tile.id}"]`);
  if (el) el.classList.add("selected");

  resetTimer();

  const updatedState = resolveTileSelection(tile, gameState);
  gameState = {
    ...gameState,
    ...updatedState,
  };

  updateUIFromState();

  // Short delay for feedback, then next turn
  setTimeout(() => {
    nextTurn();
  }, 300);
}

function updateUIFromState() {
  if (!gameState) return;

  levelDisplay.textContent = gameState.level;
  scoreDisplay.textContent = gameState.score.toLocaleString();
  multiplierDisplay.textContent = `x${gameState.multiplier.toFixed(2)}`;
  updateTurnDisplay();

  // Last move display
  const delta = gameState.lastTileDelta ?? 0;
  let text = delta === 0 ? "0" : delta > 0 ? `+${delta}` : `${delta}`;
  lastMoveDisplay.textContent = text;

  if (delta > 0) {
    lastMoveDisplay.style.color = "#22c55e"; // green
  } else if (delta < 0) {
    lastMoveDisplay.style.color = "#f97373"; // red
  } else {
    lastMoveDisplay.style.color = "#9ca3af"; // neutral
  }
}

function updateTurnDisplay() {
  if (!gameState) {
    turnDisplay.textContent = "0 / 0";
    return;
  }

  // turnIndex is "turns completed" (0-based).
  // For display, show current turn as (turnIndex + 1),
  // but never higher than total turns.
  const currentTurn = Math.min(gameState.turnIndex + 1, gameState.turns);
  turnDisplay.textContent = `${currentTurn} / ${gameState.turns}`;
}

/**
 * Round finished. Determine next level / best scores.
 */
function endRound() {
  resetTimer();
  setTilesDisabled(true);
  gameState.locked = true;

  const finalScore = gameState.score;
  messageArea.textContent = `Round complete! Final score: ${finalScore.toLocaleString()}`;

  // session best tracking (optional)
  if (finalScore > bestScore) {
    bestScore = finalScore;
    bestLevel = gameState.level;
    bestScoreDisplay.textContent = bestScore.toLocaleString();
    bestLevelDisplay.textContent = bestLevel;
  }

  // (your anti-spam + save button logic here...)

  startButton.disabled = false;
  startButton.textContent = "Play Next Level";

  // ✅ important: next click goes to the NEXT LEVEL, keeping score
  startButton.onclick = () => {
    const nextLevel = gameState.level + 1;
    startLevel(nextLevel);
  };
}



function startLevel(level) {
  // preserve cumulative score from previous levels
  const prevScore = gameState ? gameState.score : 0;

  gameState = {
    level,
    turnIndex: 0,
    turns: getDifficultyForLevel(level).turns,
    score: prevScore,          // ✅ carry over score
    multiplier: 1,
    chainCount: 0,
    lastTileDelta: 0,
    grid: generateGrid(level),
    timePerTurnMs: getDifficultyForLevel(level).timePerTurnMs,
    locked: false,
  };

  updateUIFromState();
  renderGrid();
  messageArea.textContent = `Level ${level}: Faster & trickier tiles.`;

  startButton.disabled = true;
  restartButton.disabled = false;
  saveScoreButton.disabled = true;
  saveStatus.textContent = "";

  nextTurn();
}


function restartGame() {
  resetTimer();
  startButton.disabled = true;
  startButton.textContent = "Start Game";
  saveStatus.textContent = "";
  saveStatus.style.color = "";
  startGame();
}


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
      const level = row.level ?? 1;
    
      // Format date/time
      let timeText = "";
      if (row.created_at) {
        const d = new Date(row.created_at);
        // e.g. "11/16 9:23p"
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
        <span class="entry-level">Lv ${level}</span>
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

/**
 * Save score to Supabase
 */
async function handleSaveScore() {
  if (!gameState) return;
  saveScoreButton.disabled = true;
  saveStatus.textContent = "Saving…";

  try {
    const name = playerNameInput.value;
    await saveScoreToSupabase(name, gameState.score, gameState.level);
    saveStatus.textContent = "Score saved!";
    saveStatus.style.color = "#22c55e";

    // Refresh leaderboard
    await loadLeaderboard();
  } catch (err) {
    saveStatus.textContent = "Error saving score. Check console.";
    saveStatus.style.color = "#f97373";
    saveScoreButton.disabled = false;
  }
}


/**
 * Wire up top-level events.
 */
function init() {
  startButton.onclick = startGame;      // brand-new run
  restartButton.onclick = restartGame;
  saveScoreButton.onclick = handleSaveScore;

  bestScoreDisplay.textContent = "–";
  bestLevelDisplay.textContent = "–";
  restartButton.disabled = true;
  saveScoreButton.disabled = true;

  loadLeaderboard();
}




init();
