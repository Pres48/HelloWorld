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
const bestScoreDisplay = document.getElementById("bestScoreDisplay");
const bestLevelDisplay = document.getElementById("bestLevelDisplay");
const saveScoreButton = document.getElementById("saveScoreButton");
const saveStatus = document.getElementById("saveStatus");
const lastMoveDisplay = document.getElementById("lastMoveDisplay");
const leaderboardList = document.getElementById("leaderboardList");
const levelGoals = document.getElementById("levelGoals");
const rawName = playerNameInput.value.trim();
const name = rawName || "Guest";
await saveScoreToSupabase(name, finalScore, gameState.level);

// popover elements
const howToPlayInfoBtn = document.getElementById("howToPlayInfoBtn");
const howToPlayInfoPopover = document.getElementById("howToPlayInfoPopover");
const levelGoalsInfoBtn = document.getElementById("levelGoalsInfoBtn");
const levelGoalsInfoPopover = document.getElementById("levelGoalsInfoPopover");
const leaderboardInfoBtn = document.getElementById("leaderboardInfoBtn");
const leaderboardInfoPopover = document.getElementById("leaderboardInfoPopover");

const MIN_SUBMIT_SCORE = 200; // minimum score required to submit to global leaderboard

let gameState = null;
let timerInterval = null;
let turnDeadline = null;
let selectedThisTurn = false;
let bestScore = 0;
let bestLevel = 0;

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

// Required performance per level
function getRequiredGainForLevel(level) {
  const base = 80;   // level 1 requirement
  const perLevel = 30;
  return base + (level - 1) * perLevel;
}

function getAllowedMissesForLevel(level) {
  if (level <= 3) return 3;
  if (level <= 6) return 2;
  return 1;
}

function resetTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerFill.style.width = "0%";
  turnDeadline = null;
}

// ---------- Core Game ----------

function startGame() {
  const level = 1;

  gameState = {
    level,
    turnIndex: 0,
    turns: getDifficultyForLevel(level).turns,
    score: 0,                 // new run
    scoreAtLevelStart: 0,     // baseline for this level
    missedTurns: 0,
    multiplier: 1,
    chainCount: 0,
    lastTileDelta: 0,
    grid: generateGrid(level),
    timePerTurnMs: getDifficultyForLevel(level).timePerTurnMs,
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

  gameState = {
    level,
    turnIndex: 0,
    turns: getDifficultyForLevel(level).turns,
    score: prevScore,             // cumulative
    scoreAtLevelStart: prevScore, // baseline for this level
    missedTurns: 0,
    multiplier: 1,
    chainCount: 0,
    lastTileDelta: 0,
    grid: generateGrid(level),
    timePerTurnMs: getDifficultyForLevel(level).timePerTurnMs,
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
  const maxMiss = getAllowedMissesForLevel(level);

  levelGoals.textContent = `Level target: +${target.toLocaleString()} pts, Max misses: ${maxMiss}`;
}

// ---------- Auto-save to leaderboard ----------

async function autoSaveScoreIfEligible() {
  if (!gameState) return;

  const finalScore = gameState.score;

  if (finalScore < MIN_SUBMIT_SCORE) {
    saveScoreButton.disabled = true;
    saveStatus.textContent = `Reach at least ${MIN_SUBMIT_SCORE} points to appear on the global leaderboard.`;
    saveStatus.style.color = "#9ca3af";
    return;
  }

  saveScoreButton.disabled = true;
  saveStatus.textContent = "Saving to leaderboard…";
  saveStatus.style.color = "#9ca3af";

  try {
    const name = playerNameInput.value;
    await saveScoreToSupabase(name, finalScore, gameState.level);

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
  const allowedMisses = getAllowedMissesForLevel(level);

  const passedScoreGate = levelGain >= requiredGain;
  const passedMissGate = missed <= allowedMisses;

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
    messageArea.textContent =
      `Run ended by player at Level ${level}. ` +
      `Final score: ${finalScore.toLocaleString()}.`;

    startButton.disabled = false;
    startButton.textContent = "Start Game";
    startButton.onclick = startGame;
    endButton.disabled = true;
    if (levelGoals) levelGoals.textContent = "";
    return;
  }

  if (passedScoreGate && passedMissGate) {
    // Level cleared – allow NEXT level
    messageArea.textContent =
      `Level ${level} cleared! You earned ${levelGain.toLocaleString()} points this level ` +
      `(${missed} missed turn${missed === 1 ? "" : "s"}).`;

    startButton.disabled = false;
    startButton.textContent = "Play Next Level";

    startButton.onclick = () => {
      const nextLevel = level + 1;
      startLevel(nextLevel);
    };
  } else {
    // Run ends here due to failing goals
    let reasonText = "";
    if (!passedScoreGate) {
      reasonText += `You needed at least ${requiredGain.toLocaleString()} points this level (you got ${levelGain.toLocaleString()}). `;
    }
    if (!passedMissGate) {
      reasonText += `Too many missed turns (allowed ${allowedMisses}, you had ${missed}).`;
    }

    messageArea.textContent =
      `Run over at Level ${level}. Final score: ${finalScore.toLocaleString()}. ${reasonText}`;

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
  // --- Buttons ---
  startButton.onclick = startGame;
  restartButton.onclick = restartGame;
  endButton.onclick = endGame;
  saveScoreButton.onclick = handleSaveScore;

  // --- Initial UI state ---
  bestScoreDisplay.textContent = "–";
  bestLevelDisplay.textContent = "–";
  restartButton.disabled = true;
  endButton.disabled = true;
  saveScoreButton.disabled = true;

  // --- Restore player name from previous visit (localStorage) ---
  try {
    const savedName = localStorage.getItem("mindgridPlayerName");
    if (savedName && typeof savedName === "string" && playerNameInput) {
      playerNameInput.value = savedName;
    }
  } catch (e) {
    // localStorage might be disabled; fail silently
    console.warn("Name restore skipped (localStorage unavailable):", e);
  }

  // --- Persist player name on change ---
  if (playerNameInput) {
    playerNameInput.addEventListener("input", () => {
      const raw = playerNameInput.value || "";
      const trimmed = raw.trim();

      try {
        if (trimmed.length === 0) {
          // Optional: clear key if empty
          localStorage.removeItem("mindgridPlayerName");
        } else {
          localStorage.setItem("mindgridPlayerName", trimmed);
        }
      } catch (e) {
        console.warn("Name save skipped (localStorage unavailable):", e);
      }
    });
  }

  // --- Load leaderboard on page load ---
  loadLeaderboard();

  // --- Popover helpers ---
  function togglePopover(popover) {
    if (!popover) return;
    const isVisible = popover.classList.contains("visible");

    // Close all first
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

  // Prevent clicks inside popovers from closing them immediately
  [howToPlayInfoPopover, levelGoalsInfoPopover, leaderboardInfoPopover].forEach((p) => {
    if (!p) return;
    p.addEventListener("click", (e) => {
      e.stopPropagation();
    });
  });
}


init();
