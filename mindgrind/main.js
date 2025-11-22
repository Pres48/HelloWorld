// main.js
import {
  generateGrid,
  getDifficultyForLevel,
  resolveTileSelection,
  getLevelBehavior,
  RISK_MIN,
  RISK_MAX,
} from "./game.js";


import { saveScoreToSupabase, fetchTopScores } from "./supabaseClient.js";

// ---------- DOM ELEMENTS ----------

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

const bestScoreDisplay = document.getElementById("bestScoreDisplay");
const bestLevelDisplay = document.getElementById("bestLevelDisplay");
const saveScoreButton = document.getElementById("saveScoreButton");
const saveStatus = document.getElementById("saveStatus");
const lastMoveDisplay = document.getElementById("lastMoveDisplay");
const leaderboardList = document.getElementById("leaderboardList");
const levelGoals = document.getElementById("levelGoals");

const goalProgressDisplay    = document.getElementById("goalProgressDisplay");
const goalRemainingDisplay   = document.getElementById("goalRemainingDisplay");
const chainRunDisplay        = document.getElementById("chainRunDisplay");
const chainMultiplierDisplay = document.getElementById("chainMultiplierDisplay");
const speedBonusDisplay      = document.getElementById("speedBonusDisplay");


// ----- Result Modal Elements -----
const mgModal       = document.querySelector(".mg-modal");
const mgOverlay     = document.getElementById("mg-modal-overlay");
const mgTitle       = document.getElementById("mg-title");
const mgSubtitle    = document.getElementById("mg-subtitle");
const mgExtra       = document.getElementById("mg-extra");

const mgTotalPoints = document.getElementById("mg-total-points");
const mgRoundPoints = document.getElementById("mg-round-points");
const mgNeeded      = document.getElementById("mg-needed");
const mgMisses      = document.getElementById("mg-misses");
const mgCredits     = document.getElementById("mg-credits");
const mgTimeBonus   = document.getElementById("mg-time-bonus");
const mgNextTarget  = document.getElementById("mg-next-target");

const mgBtnNext     = document.getElementById("mg-next");
const mgBtnNew      = document.getElementById("mg-new");
const mgBtnContinue = document.getElementById("mg-continue");
const mgBtnClose    = document.getElementById("mg-close");

// Popover elements
const howToPlayInfoBtn = document.getElementById("howToPlayInfoBtn");
const howToPlayInfoPopover = document.getElementById("howToPlayInfoPopover");
const levelGoalsInfoBtn = document.getElementById("levelGoalsInfoBtn");
const levelGoalsInfoPopover = document.getElementById("levelGoalsInfoPopover");
const leaderboardInfoBtn = document.getElementById("leaderboardInfoBtn");
const leaderboardInfoPopover = document.getElementById("leaderboardInfoPopover");

// ---------- FUN MESSAGE POOLS ----------

// When player MISSES a turn
const MISS_MESSAGES = [
  "Missed that one — brain buffer overflow. 🧠💫",
  "Timer zapped you. Next pick, no hesitation. ⏱️⚡",
  "You blinked… the turn vanished. 👀💨",
  "Even geniuses need warm-up turns. 🧠🔥",
  "That one got away. Regroup and grind. 🌀",
  "Mind lag detected — recalibrating neurons. 💫",
  "Close call. Your brain almost had it. 😮‍💨",
  "The grid outsmarted you… this time. 🎭",
  "Lost in the matrix for a sec? 🕳️",
  "Your mental RAM dipped into the red. 🪫",
  "That pick fell through the mental cracks. 🫥",
  "Processing… processing… missed. ⌛",
  "The tile was open — your mind wasn’t. 😶‍🌫️",
  "Brain-to-finger desync. Happens. 🔌💤",
  "Neural misfire. Shake it off. ⚠️",
  "Momentum hiccup — keep moving. 🔄",
  "Mind Grind took the point. Take it back. 🎯",
  "A phantom click would've saved that one. 👻🖱️",
  "The clock stole your thunder. ⏱️😮",
  "Your instincts paused. The grid didn’t. 🧠⛔",
  "Mental gears slipped for half a second. ⚙️💥",
  "Your focus tab… closed unexpectedly. 🧠❌",
  "Think fast — the grid isn't waiting. 🏃‍♂️💨",
  "Good players miss. Great players recover. 🔁"
];

// When player SELECTS a tile (good + neutral + bad)
const HIT_POSITIVE_MESSAGES = [
  "Nice grind! 🧠",
  "Clean hit — keep the run alive. 🎯",
  "Brain is warmed up now. 🔥",
  "Love that pick. 💥",
  "Tasty points. More, please. 😋",
  "Locked in. Keep cooking. 🔥👨‍🍳",
  "Your instincts are dialed in. ⚡",
  "Grid reads are on point. 👀",
  "Chef’s kiss of a selection. 👌💫",
  "That pick felt *intentional*. 🎯",
  "Sharp eyes, sharper moves. 👁️✂️",
  "You’re in flow mode now. 🌊",
  "That one was surgical. 🗡️",
  "Beautiful tile awareness. ✨",
  "You’re starting to heat up. 🔥",
  "That’s a pro-level tap. 🏆",
  "Smooth. Efficient. Deadly. ⚙️",
  "Momentum rising — don’t stop. 🚀",
  "That’s the grind I like to see. 🧠🔥",
  "Ooh, the grid didn’t stand a chance. 💥",
  "Brilliant pickup. 💡",
  "Your brain’s firing on all cylinders. ⚡🧠",
  "Precision like that wins runs. 🎯",
  "Elite tile control right there. 🕹️",
  "You’re making this look easy. 😎"
];

const HIT_NEUTRAL_MESSAGES = [
  "Alright, warming up that brain. 🧠",
  "Okay pick. Lining up the big ones. 📊",
  "Not huge, not terrible — keep scanning. 👀",
  "Steady. Set up your next move. ➡️",
  "Baseline move. Now find the signal. 📡",
  "Decent pull — keep the grid moving. 🔄",
  "Solid enough. What's next? 🤔",
  "A fine choice. Nothing wild. ➖",
  "Neutral hit. Keep reading the board. 🧩",
  "Okay value. Eyes open for the next. 👁️",
  "Not a game-changer, but it counts. 📌",
  "Steady tap. Momentum intact. 🫱",
  "Clean enough. Look for patterns. 📐",
  "That’ll do. The board resets. ♻️",
  "Respectable pick — keep checking options. 🗺️",
  "Neutral gain. The run continues. ➡️",
  "Alright. Let the grid breathe. 🌬️",
  "Safe choice. Could set up something bigger. 📈",
  "Middle-of-the-pack value. 📊",
  "Measured move. Stay aware. 👌",
  "Not flashy. Still progress. ➕",
  "Fine hit. Refresh your scan. 🔍",
  "That's one more tile out of the way. ✔️",
  "It’s a step — line up the next one. 🪜"
];

const HIT_NEGATIVE_MESSAGES = [
  "Ouch, that one stung! 🤕",
  "Risky… didn’t pay off. ⚠️",
  "That tile fought back 😬",
  "Pain. Just pain. 💀",
  "Rough tile. Shake it off! 🩹",
  "Well… that was unfortunate. 😵",
  "Grid said ‘nope.’ ❌",
  "That tile had beef with you. 🥩😑",
  "Unlucky pull — move on. 🍀❌",
  "Harsh. The board bites back. 🐍",
  "Oof. Momentum wobble. 🥴",
  "That one punched your scorecard. 🥊",
  "Not your finest moment. 😬",
  "Yeahhh… let's pretend that didn’t happen. 🙈",
  "Painful flick. Regroup. 😣",
  "The grid landed a crit hit. 💥",
  "That tile filed a complaint. 📄😑",
  "Score sabotage achieved. 🔻",
  "Upset tile syndrome activated. 😤",
  "That was a morale tax. 🧾💸",
  "Your luck just lagged. 🪫",
  "A strategic… misfire. 💨",
  "Oof. Reset your brain buffer. ♻️🧠",
  "Consider that a friendly warning from the grid. ⚠️"
];

const RARITY_MESSAGES = {
  rare:   "You found a RARE tile! ✨",
  epic:   "EPIC tile snagged — nice find! 🔥",
  legend: "LEGEND tile! That’s serious value. 🏆",
  mythic: "MYTHIC tile secured. Big brain move. 🧠⚡",
  relic:  "You unearthed a RELIC! Ancient points unlocked. 🗝️",
  exotic: "EXOTIC tile! That’s a wild score boost. 🌀",
  cosmic: "COSMIC tile!! The universe just high-fived you. 🌌🚀"
};

const openHowToPlayBtn   = document.getElementById("openHowToPlay");
const howToPlayBackdrop  = document.getElementById("howToPlayBackdrop");
const closeHowToPlayBtn  = document.getElementById("closeHowToPlay");

const nameDialogOverlay = document.getElementById("nameDialogOverlay");
const nameDialogInput   = document.getElementById("nameDialogInput");
const nameDialogSave    = document.getElementById("nameDialogSave");
const nameDialogCancel  = document.getElementById("nameDialogCancel");

// Load cached player name (supports old key + new key)
let cachedPlayerName = null;
try {
  cachedPlayerName =
    localStorage.getItem("mg_player_name") ||
    localStorage.getItem("mindgrindPlayerName") ||
    null;

  // Normalize to the new key going forward
  if (cachedPlayerName) {
    localStorage.setItem("mg_player_name", cachedPlayerName);
  }
} catch (e) {
  cachedPlayerName = null;
}

function promptForPlayerName() {
  return new Promise((resolve) => {
    if (!nameDialogOverlay || !nameDialogInput) {
      // Fallback if dialog isn't present
      resolve(null);
      return;
    }

    nameDialogOverlay.classList.remove("hidden");
    nameDialogInput.value = cachedPlayerName || "";
    nameDialogInput.focus();

    function cleanup(result) {
      nameDialogOverlay.classList.add("hidden");
      nameDialogSave.removeEventListener("click", onSave);
      nameDialogCancel.removeEventListener("click", onCancel);
      nameDialogInput.removeEventListener("keydown", onKeyDown);
      resolve(result);
    }

    function onSave() {
      let name = (nameDialogInput.value || "").trim();
      if (!name) {
        // Simple inline feedback: just refocus for now
        nameDialogInput.focus();
        return;
      }

      if (isNameProfane(name)) {
        alert(
          "That name isn't allowed on the public leaderboard. Please choose a different one."
        );
        nameDialogInput.focus();
        return;
      }

      cachedPlayerName = name;
      try {
        localStorage.setItem("mg_player_name", name);
      } catch (e) {
        // ignore storage errors
      }
      cleanup(name);
    }

    function onCancel() {
      cleanup(null);
    }

    function onKeyDown(e) {
      if (e.key === "Enter") onSave();
      if (e.key === "Escape") onCancel();
    }

    nameDialogSave.addEventListener("click", onSave);
    nameDialogCancel.addEventListener("click", onCancel);
    nameDialogInput.addEventListener("keydown", onKeyDown);
  });
}



function openHowToPlay() {
  if (!howToPlayBackdrop) return;
  howToPlayBackdrop.hidden = false;
}

function closeHowToPlay() {
  if (!howToPlayBackdrop) return;
  howToPlayBackdrop.hidden = true;
}

if (openHowToPlayBtn && howToPlayBackdrop && closeHowToPlayBtn) {
  openHowToPlayBtn.addEventListener("click", openHowToPlay);
  closeHowToPlayBtn.addEventListener("click", closeHowToPlay);

  // Close when clicking outside the modal
  howToPlayBackdrop.addEventListener("click", (e) => {
    if (e.target === howToPlayBackdrop) {
      closeHowToPlay();
    }
  });

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !howToPlayBackdrop.hidden) {
      closeHowToPlay();
    }
  });
}

function renderIdleGrid() {
  if (!gridContainer) return;

  // Use your real level 1 generator so size & mix match the game
  const previewGrid = generateGrid(1);
  if (!previewGrid || !previewGrid.length) return;

  const size = previewGrid.length;         // e.g., 6 for a 6x6
  const totalTiles = size * size;

  // Force exactly one rarity tile
  const rarityTypes = ["rare", "epic", "legend", "mythic", "relic", "exotic", "cosmic"];
  const chosenRarity = rarityTypes[Math.floor(Math.random() * rarityTypes.length)];
  const rarityIndex = Math.floor(Math.random() * totalTiles);  // 0..(size*size-1)

  gridContainer.innerHTML = "";
  gridContainer.style.gridTemplateColumns = `repeat(${size}, minmax(0, 1fr))`;

  let flatIndex = 0;

  previewGrid.forEach((row) => {
    row.forEach((tile) => {
      // Use the real tile type, unless this is the one we turn into a rarity
      let type = tile.type;
      if (flatIndex === rarityIndex) {
        type = chosenRarity;
      }
      flatIndex++;

      const tileEl = document.createElement("button");
      tileEl.className = `tile type-${type} idle-tile`;
      tileEl.disabled = true; // no interaction on idle grid

      const label = document.createElement("span");
      label.className = "tile-label";

      const valueEl = document.createElement("span");
      valueEl.className = "tile-value";

      // Idle board = pure color / frame only
      label.textContent = "";
      valueEl.textContent = "";

      tileEl.appendChild(label);
      tileEl.appendChild(valueEl);
      gridContainer.appendChild(tileEl);
    });
  });
}



function pickRandom(arr) {
  if (!arr || arr.length === 0) return "";
  const idx = Math.floor(Math.random() * arr.length);
  return arr[idx];
}

function showMissMessage() {
  if (!messageArea) return;
  messageArea.textContent = pickRandom(MISS_MESSAGES);
}

function showHitMessage(delta, tile) {
  if (!messageArea) return;

  // Rarity tiles get special shout-outs
  if (
    tile &&
    ["rare", "epic", "legend", "mythic", "relic", "exotic", "cosmic"].includes(tile.type)
  ) {
    const msg = RARITY_MESSAGES[tile.type] || "You found something special!";
    messageArea.innerHTML = `<strong>${msg}</strong>`;
    return;
  }

  // Positive / negative flavor based on the last tile delta
    const positiveThreshold = Math.max(10, Math.floor(gameState.level * 1.5));
    
    if (delta >= positiveThreshold) {
      messageArea.textContent = pickRandom(HIT_POSITIVE_MESSAGES);
    } else if (delta < 0) {
      messageArea.textContent = pickRandom(HIT_NEGATIVE_MESSAGES);
    } else {
      messageArea.textContent = pickRandom(HIT_NEUTRAL_MESSAGES);
    }
}

// ---------- CONSTANTS & STATE ----------

const MIN_SUBMIT_SCORE = 500; // minimum score required to submit to global leaderboard
const HIGH_SCORE_NAME_WARN_THRESHOLD = MIN_SUBMIT_SCORE;

let gameState = null;
let timerInterval = null;
let turnDeadline = null;
let selectedThisTurn = false;
let bestScore = 0;
let bestLevel = 0;
let currentRunScoreId = null;
let currentRunSavedScore = 0;

// Retry credits you earn at certain milestone levels (banked in this browser session)
let retryCredits = 0;

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
  if (!Number.isFinite(value)) return String(value);

  // Maybe do a multi-step equation
  if (multiStepChance > 0 && Math.random() < multiStepChance) {
    // Simple pattern: a + b - c = value
    const a = Math.max(1, Math.floor(value * 0.4));
    const b = Math.max(1, Math.floor(value * 0.8) - a);
    const c = a + b - value; // ensures equality

    if (Number.isInteger(c) && c >= 0) {
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

const PROFANITY_PATTERNS = PROFANITY_WORDS.map(
  (w) => new RegExp(buildWordRegex(w), "i")
);

function isNameProfane(name) {
  if (!name) return false;
  const cleaned = name.normalize("NFKD");
  return PROFANITY_PATTERNS.some((re) => re.test(cleaned));
}

// ======================================================
//  LEVEL GOAL / DIFFICULTY HELPERS (CURVED PROGRESSION)
// ======================================================

function getTheoreticalMaxLevelGain(level) {
  const { turns } = getDifficultyForLevel(level); // 8–12 turns

  // These are generous upper bounds given your current tile ranges
  if (turns <= 8)  return 650;
  if (turns <= 10) return 800;
  return 950;
}

function getRequiredGainForLevel(level) {
  let required;

  if (level <= 1) {
    required = 100;                     // +20
  } else if (level <= 5) {
    required = 100 + 15 * (level - 1);  // 80 -> 100
  } else if (level <= 10) {
    required = 180 + 20 * (level - 6);  // 160 -> 180
  } else if (level <= 15) {
    required = 290 + 25 * (level - 11); // 270 -> 290
  } else if (level <= 20) {
    required = 420 + 30 * (level - 16); // 400 -> 420
  } else {
    const extra = level - 20;
    const baseAfter20 = 570;            // 550 -> 570
    const step = 35;
    required = baseAfter20 + step * Math.log2(1 + extra);
  }

  required = Math.round(required);

  // Still enforce fairness so we don’t ask for the impossible
  const cap = getTheoreticalMaxLevelGain(level);
  return Math.min(required, cap);
}

function computeSpeedBonus(level, timeBankMs, turns, timePerTurnMs) {
  if (!timeBankMs || timeBankMs <= 0) return 0;

  // Max possible bank if you insta-clicked every turn
  const maxBankMs = (turns || 0) * (timePerTurnMs || 0);
  if (!maxBankMs || maxBankMs <= 0) return 0;

  const fractionSaved = Math.min(1, timeBankMs / maxBankMs); // 0–1
  const target = getRequiredGainForLevel(level);

  // Cap: at absolute best you can get 20% of the level target as speed bonus
  const MAX_PCT = 0.20;

  const rawBonus = target * fractionSaved * MAX_PCT;

  return Math.round(rawBonus); // nice integer
}

function getAllowedMissesForLevel(level) {
  // Effectively “infinite” for now — miss count doesn’t gate progression.
  return 9999;
}

// ===== Retry credit awards at milestone levels =====
function maybeAwardRetryCreditForLevel(level) {
  const milestones = [5, 10, 20, 30];

  if (milestones.includes(level)) {
    retryCredits++;
    console.log(`Retry credit earned at level ${level}. Total:`, retryCredits);
    return;
  }

  // After level 40, give 1 credit every 20 levels
  if (level >= 40 && level % 20 === 0) {
    retryCredits++;
    console.log(`Late-game retry credit at level ${level}. Total:`, retryCredits);
  }
}



// ===== Modal open/close helpers =====
function openResultModal({
  cleared,
  level,
  totalPoints,
  roundPoints,
  neededPoints,
  misses,
  nextLevelNeededPoints,
  timeBonus = 0,
  isPerfectLevel = false,
  isNewHighScore = false,
}) {
  if (!mgOverlay) {
    console.warn("mgOverlay not found, skipping modal");
    return;
  }

  const credits = retryCredits; // single source of truth

  console.log("openResultModal()", {
    cleared,
    level,
    totalPoints,
    roundPoints,
    neededPoints,
    misses,
    credits,
    nextLevelNeededPoints,
    isPerfectLevel,
    isNewHighScore,
  });

  // ---- Header text ----
  if (cleared) {
    mgTitle.textContent = `Level ${level} Cleared!`;
    mgSubtitle.textContent = `Nice job — Level ${level + 1} is up next.`;
  } else {
    mgTitle.textContent = `Run Over — Level ${level}`;
    mgSubtitle.textContent = `You were ${Math.max(
      0,
      neededPoints - roundPoints
    ).toLocaleString()} points short.`;
  }

  // ---- Stats ----
  mgNeeded.textContent      = neededPoints.toLocaleString();
  mgTotalPoints.textContent = totalPoints.toLocaleString();
  mgMisses.textContent      = misses.toLocaleString();
  mgCredits.textContent     = credits.toString();
  mgTimeBonus.textContent   = timeBonus.toLocaleString()

  // Round points + ✓
  const passedLevel = roundPoints >= neededPoints;
  mgRoundPoints.innerHTML = passedLevel
    ? `${roundPoints.toLocaleString()} <span class="mg-round-check">✓</span>`
    : roundPoints.toLocaleString();

  // ----- Next Level Target (pulled out separately) -----  
  if (cleared && typeof nextLevelNeededPoints === "number") {
    mgNextTarget.textContent =
      `Next level target: ${nextLevelNeededPoints.toLocaleString()} pts`;
    mgNextTarget.classList.remove("hidden");
  } else {
    mgNextTarget.textContent = "";
    mgNextTarget.classList.add("hidden");
  }
  
  // ---- Extra stacked messages ----
  const extraLines = [];
  
  if (cleared && isPerfectLevel) {
    extraLines.push(`Perfect level (0 misses)`);
  }
  
  if (isNewHighScore) {
    extraLines.push(`New high score!`);
  }
  
  if (extraLines.length > 0) {
    mgExtra.innerHTML = extraLines.join("<br>");
    mgExtra.classList.remove("hidden");
  } else {
    mgExtra.innerHTML = "";
    mgExtra.classList.add("hidden");
  }

  // --------------------------------------------------------------------
  //                      BUTTON LOGIC
  // --------------------------------------------------------------------

  const btnNext     = document.getElementById("mg-next");
  const btnContinue = document.getElementById("mg-continue");
  const btnNewGame  = document.getElementById("mg-new");

  // Clear handlers + hide all + remove ALL style classes
  [btnNext, btnContinue, btnNewGame].forEach((btn) => {
    if (!btn) return;
    btn.onclick = null;
    btn.classList.add("hidden");
    btn.classList.remove(
      "mg-btn-next",
      "mg-btn-continue",
      "mg-btn-newgame",
      "mg-primary",
      "mg-secondary"
    );
  });

  // ===== LEVEL CLEARED ================================================
  if (cleared) {
    if (btnNext) {
      btnNext.textContent = "Start Next Level";
      btnNext.classList.remove("hidden");
      btnNext.classList.add("mg-btn-next");

      btnNext.onclick = () => {
        closeResultModal();
        startLevel(level + 1);
      };
    }

    mgOverlay.classList.remove("hidden");
    return;
  }

  // ===== RUN OVER ======================================================

  if (credits > 0) {
    // --------------------------------------------
    // Has retry credits → ONLY Continue Run
    // --------------------------------------------
    if (btnContinue) {
      btnContinue.textContent = "Continue Run";
      btnContinue.classList.remove("hidden");
      btnContinue.classList.add("mg-btn-continue");

      btnContinue.onclick = () => {
        // Spend 1 credit
        retryCredits = Math.max(0, retryCredits - 1);

        // Keep accumulated score — DO NOT reset
        closeResultModal();
        startLevel(level);
      };
    }
  } else {
    // --------------------------------------------
    // No credits → ONLY Start New Game
    // --------------------------------------------
    if (btnNext) {
      btnNext.textContent = "Start New Game";
      btnNext.classList.remove("hidden");
      btnNext.classList.add("mg-btn-newgame");

      btnNext.onclick = () => {
        closeResultModal();
        restartGame();
      };
    }
  }

  // Display modal
  mgOverlay.classList.remove("hidden");
}




function closeResultModal() {
  if (!mgOverlay) return;
  mgOverlay.classList.add("hidden");
}

// Close button on modal (X)
if (mgBtnClose) {
  mgBtnClose.addEventListener("click", () => {
    closeResultModal();
  });
}

// ---------- Fairness helpers: ensure each level is beatable ----------

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

  // Strategy A: always best NUMBER tile
  if (bestNumber !== null) {
    let mult = 1;
    let total = 0;
    for (let i = 0; i < turns; i++) {
      const base = bestNumber;
      total += Math.round(base * mult);
    }
    maxGain = Math.max(maxGain, total);
  }

  // Strategy B: always best CHAIN tile
  if (bestChain !== null) {
    let mult = 1;
    let chainCount = 0;
    let total = 0;
    for (let i = 0; i < turns; i++) {
      const factor = 1 + chainCount * 0.3;
      const base = Math.round(bestChain * factor);
      total += Math.round(base * mult);
      chainCount += 1;
    }
    maxGain = Math.max(maxGain, total);
  }

  // Strategy C: BONUS then CHAIN
  if (bestChain !== null && bestBonus !== null) {
    const maxSetupTurns = Math.min(5, turns);
    for (let setup = 1; setup <= maxSetupTurns; setup++) {
      let mult = 1;
      let chainCount = 0;
      let total = 0;

      for (let t = 0; t < turns; t++) {
        if (t < setup) {
          const base = 1;
          total += Math.round(base * mult);
          mult = parseFloat((mult + bestBonus * 0.25).toFixed(2));
        } else {
          const factor = 1 + chainCount * 0.3;
          const base = Math.round(bestChain * factor);
          total += Math.round(base * mult);
          chainCount += 1;
        }
      }

      maxGain = Math.max(maxGain, total);
    }
  }

  // Strategy D: always best positive RISK tile
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

function generateFairGrid(level) {
  const { turns } = getDifficultyForLevel(level);
  const requiredGain = getRequiredGainForLevel(level);
  let grid;
  let tries = 0;

  do {
    grid = generateGrid(level);
    tries++;
    const maxPossible = computeMaxPossibleGain(grid, turns);

    if (maxPossible >= requiredGain || tries >= 30) {
      break;
    }
  } while (true);

  return grid;
}

// ---------- Timer / Name warning helpers ----------

function resetTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
  timerFill.style.width = "0%";
  turnDeadline = null;
}

function setStartButtonVisual(mode) {
  if (!startButton) return;

  startButton.classList.add("main-cta");
  startButton.classList.remove("main-cta-primary", "main-cta-next");

  if (mode === "next") {
    // Play Level X → green style
    startButton.classList.add("main-cta-next");
  } else {
    // Start Game / Start New Game → purple style
    startButton.classList.add("main-cta-primary");
  }
}

function setEndButtonVisual(enabled) {
  if (!endButton) return;

  endButton.classList.add("main-cta");
  if (enabled) {
    endButton.classList.add("main-cta-danger");
  } else {
    endButton.classList.remove("main-cta-danger");
  }
}




// ---------- Core Game ----------

function startGame() {
  const level = 1;
  currentRunScoreId = null;
  currentRunSavedScore = 0;

  const difficulty = getDifficultyForLevel(level);
  const behavior = getLevelBehavior(level);

  setEndButtonVisual(true);

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
    lastClickTurn: -1,
    // ⏱ per-level time bank
    timeBankMs: 0,
    currentTurnStartMs: null,
    currentTurnDurationMs: null,
  };

  // Debug exports
  window.gameState = gameState;
  window.getLevelBehavior = getLevelBehavior;
  window.renderGrid = renderGrid;

  window.jumpToLevel = function (lvl) {
    const prevScore = gameState ? gameState.score : 0;
    const diff = getDifficultyForLevel(lvl);
    const beh = getLevelBehavior(lvl);

    gameState = {
      level: lvl,
      turnIndex: 0,
      turns: diff.turns,
      score: prevScore,
      scoreAtLevelStart: prevScore,
      missedTurns: 0,
      multiplier: 1,
      chainCount: 0,
      lastTileDelta: 0,
      grid: generateGrid(lvl),
      timePerTurnMs: diff.timePerTurnMs,
      behavior: beh,
      locked: false,
      // ⏱ per-level time bank
      timeBankMs: 0,
      currentTurnStartMs: null,
      currentTurnDurationMs: null,
    };

    window.gameState = gameState;
    updateUIFromState();
    updateLevelGoals();
    renderGrid();
    messageArea.textContent = `Debug jump to Level ${lvl}`;
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

  setEndButtonVisual(true);

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
    lastClickTurn: -1,
    // ⏱ per-level time bank
    timeBankMs: 0,
    currentTurnStartMs: null,
    currentTurnDurationMs: null,    
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

  gameState.locked = false;

  const behavior = gameState.behavior || getLevelBehavior(gameState.level);

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
  gameState.turnStartTime = now;
  
  // ⏱ remember this turn’s timing
  gameState.currentTurnStartMs = now;
  gameState.currentTurnDurationMs = duration;

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
  
  // ⚠️ Fun miss message
  showMissMessage();
  
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

function shouldHideRiskValues(level) {
  const behavior = getLevelBehavior(level);
  return behavior.hideRiskValues;
}

function getRandomInt(min, max) {
  // inclusive min & max
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRiskDisplayOptions(tile, level) {
  // Reuse cached pair if already generated
  if (
    tile.riskOptions &&
    Array.isArray(tile.riskOptions) &&
    tile.riskOptions.length === 2
  ) {
    return tile.riskOptions;
  }

  const actual = tile.value;
  const actualMag = Math.max(1, Math.abs(actual));

  // Global cap based on your real risk range
  const maxRiskMagnitude = Math.max(Math.abs(RISK_MIN), Math.abs(RISK_MAX));

  // --- LEVEL 51–60: both same sign (both + or both -), at least 10 apart ---
  if (level >= 51 && level <= 60) {
    const sign = actual >= 0 ? 1 : -1;
    const minDiff = 10;

    // Start with a diff relative to actual
    let diff = getRandomInt(minDiff, Math.max(minDiff + 5, Math.floor(actualMag * 0.8)));

    // Randomly decide bigger or smaller in magnitude
    let makeBigger = Math.random() < 0.5;

    let decoyMag;

    if (makeBigger) {
      // Try going up
      decoyMag = actualMag + diff;
      // Clamp to cap
      if (decoyMag > maxRiskMagnitude) {
        // If we busted the cap, flip to smaller instead
        decoyMag = Math.max(1, actualMag - diff);
      }
    } else {
      // Try going down
      decoyMag = Math.max(1, actualMag - diff);
      // If that collapses too low (no separation), flip to bigger but clamped
      if (actualMag - decoyMag < minDiff) {
        decoyMag = Math.min(maxRiskMagnitude, actualMag + diff);
      }
    }

    // Final safety: clamp to [1, maxRiskMagnitude]
    decoyMag = Math.min(Math.max(decoyMag, 1), maxRiskMagnitude);

    // Avoid identical magnitude
    if (decoyMag === actualMag) {
      if (actualMag + minDiff <= maxRiskMagnitude) {
        decoyMag = actualMag + minDiff;
      } else if (actualMag - minDiff >= 1) {
        decoyMag = actualMag - minDiff;
      }
    }

    const decoy = sign * decoyMag;
    let pair = [actual, decoy];

    if (Math.random() < 0.5) pair.reverse();

    tile.riskOptions = pair;
    return pair;
  }

  // --- LEVEL 61–70: one positive, one negative (Option A – symmetric-ish) ---
  if (level >= 61 && level <= 70) {
    const decoySign = actual >= 0 ? -1 : 1;

    const minFactor = 0.6;
    const maxFactor = 1.6;
    const factor = minFactor + Math.random() * (maxFactor - minFactor);
    let decoyMag = Math.round(actualMag * factor);

    if (decoyMag < 1) decoyMag = 1;

    // Clamp to your real risk cap
    decoyMag = Math.min(decoyMag, maxRiskMagnitude);

    // Avoid identical magnitude
    if (decoyMag === actualMag) {
      if (actualMag + 5 <= maxRiskMagnitude) {
        decoyMag = actualMag + 5;
      } else if (actualMag - 5 >= 1) {
        decoyMag = actualMag - 5;
      }
    }

    const decoy = decoySign * decoyMag;
    let pair = [actual, decoy];

    if (Math.random() < 0.5) pair.reverse();

    tile.riskOptions = pair;
    return pair;
  }

  // --- DEFAULT: existing behavior for earlier levels (<= 50) ---------------
  let decoy;

  if (actual > 0) {
    const maxPenalty = Math.max(5, Math.floor(actual * 0.75));
    const minPenalty = Math.min(-1, -maxPenalty);
    decoy = getRandomInt(minPenalty, -1);
  } else if (actual < 0) {
    const magnitude = Math.abs(actual);
    const minReward = Math.max(1, Math.floor(magnitude * 0.5));
    const maxReward = minReward + Math.max(5, Math.floor(magnitude * 0.5));
    decoy = getRandomInt(minReward, maxReward);
  } else {
    decoy = getRandomInt(-10, 10);
    if (decoy === 0) decoy = 5;
  }

  if (decoy === actual) {
    decoy += actual > 0 ? -1 : 1;
  }

  let pair = [actual, decoy];

  if (Math.random() < 0.5) {
    pair.reverse();
  }

  tile.riskOptions = pair;
  return pair;
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

      const isNumberOrChain = tile.type === "number" || tile.type === "chain";
      const showLabel =
        (isNumberOrChain && behavior.showNumberChainLabels) ||
        (!isNumberOrChain && behavior.showOtherLabels);

      if (tile.type === "number") {
        if (showLabel) label.textContent = "NUM";
        valueEl.textContent = formatTileDisplay(tile, behavior);

      } else if (tile.type === "bonus") {
        if (showLabel) label.textContent = "BONUS";
        valueEl.textContent = `+x${(tile.value * 0.25).toFixed(2)}`;

      } else if (tile.type === "chain") {
        if (showLabel) label.textContent = "CHAIN";
        valueEl.textContent = formatTileDisplay(tile, behavior);

      } else if (tile.type === "risk") {
        if (showLabel) label.textContent = "RISK";

        const lvl = gameState.level;

        // 71+ : show only "??"
        if (lvl >= 71) {
          valueEl.textContent = "??";
        }
        // 51–70 : masked pair, but logic lives inside getRiskDisplayOptions
        else if (shouldHideRiskValues(lvl)) {
          const [optA, optB] = getRiskDisplayOptions(tile, lvl);
          valueEl.textContent = `${optA} | ${optB}`;
        }
        // earlier levels: show concrete value/equation
        else {
          valueEl.textContent = formatTileDisplay(tile, behavior);
        }

      // ==== RARITY TILE RENDERING ====
      } else if (tile.type === "rare") {
        if (showLabel) label.textContent = "RARE";
        valueEl.textContent = tile.value;

      } else if (tile.type === "epic") {
        if (showLabel) label.textContent = "EPIC";
        valueEl.textContent = tile.value;

      } else if (tile.type === "legend") {
        if (showLabel) label.textContent = "LEGEND";
        valueEl.textContent = tile.value;

      } else if (tile.type === "mythic") {
        if (showLabel) label.textContent = "MYTHIC";
        valueEl.textContent = tile.value;

      } else if (tile.type === "relic") {
        if (showLabel) label.textContent = "RELIC";
        valueEl.textContent = tile.value;

      } else if (tile.type === "exotic") {
        if (showLabel) label.textContent = "EXOTIC";
        valueEl.textContent = tile.value;

      } else if (tile.type === "cosmic") {
        if (showLabel) label.textContent = "COSMIC";
        valueEl.textContent = tile.value;
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

      if (tile.used) {
        tileEl.disabled = true;
        tileEl.classList.add("tile-used");
      }

      tileEl.onclick = () => onTileClick(tile);

      gridContainer.appendChild(tileEl);
    });
  });
}

function onTileClick(tile) {
  if (!gameState || gameState.locked) return;
  if (selectedThisTurn) return;

  // 🚫 If this tile has already been used in this level, ignore it
  if (tile.used) return;

  // ✅ First time this tile is being used in this level
  selectedThisTurn = true;
  tile.used = true;
  setTilesDisabled(true);

  const el = gridContainer.querySelector(`[data-tile-id="${tile.id}"]`);

  if (el) {
    el.classList.add("selected");

    // immediately mark/dim this tile
    el.classList.add("tile-used");
    el.disabled = true;

    if (tile.type === "risk" && shouldHideRiskValues(gameState.level)) {
      const valueSpan = el.querySelector(".tile-value");
      if (valueSpan) {
        valueSpan.textContent = tile.value;
        valueSpan.classList.add("risk-revealed");
      }
    }
  }

  // ⏱ Bank leftover time for this turn (if any)
  if (
    gameState &&
    typeof gameState.currentTurnStartMs === "number" &&
    typeof gameState.currentTurnDurationMs === "number"
  ) {
    const now = performance.now();
    const elapsed = now - gameState.currentTurnStartMs;
    const savedMs = Math.max(0, gameState.currentTurnDurationMs - elapsed);

    gameState.timeBankMs = (gameState.timeBankMs || 0) + savedMs;
  }

  resetTimer();


  const updatedState = resolveTileSelection(tile, gameState);

  gameState = {
    ...gameState,
    ...updatedState,
  };

  updateUIFromState();

  // 🎉 Fun message based on this tile's outcome (AND rarity, if applicable)
  const delta = updatedState.lastTileDelta ?? 0;
  showHitMessage(delta, tile);
  
  setTimeout(() => {
    nextTurn();
  }, 300);
}

// ---------- UI Updates ----------

function updateUIFromState() {
  if (!gameState) return;

  const {
    level,
    score,
    multiplier,
    chainCount,
    scoreAtLevelStart,
    timeBankMs,
    turns,
    timePerTurnMs,
  } = gameState;

  // ----- PRIMARY STATS -----
  levelDisplay.textContent = level;
  multiplierDisplay.textContent = `x${multiplier.toFixed(2)}`;
  scoreDisplay.textContent = score.toLocaleString();
  updateTurnDisplay();

  // CHAIN: run + its own multiplier (separate from overall multiplier)
  const chainRun = chainCount || 0;

  if (chainRunDisplay) {
    chainRunDisplay.textContent =
      `${chainRun} ${chainRun === 1 ? "tile" : "tiles"}`;
  }

  if (chainMultiplierDisplay) {
    const chainMult = gameState.chainMultiplierDisplay || 1;
    chainMultiplierDisplay.textContent = `x${chainMult.toFixed(2)}`;
  }

  // ----- SECONDARY STATS -----

  // Level Goal progress: based on level gain vs required gain
  if (goalProgressDisplay && goalRemainingDisplay) {
    const targetGain = getRequiredGainForLevel(level);
    const levelGain = score - (scoreAtLevelStart || 0);

    if (targetGain > 0) {
      const ratio = Math.max(0, Math.min(1, levelGain / targetGain));
      const pct = Math.round(ratio * 100);

      goalProgressDisplay.textContent = `${pct}%`;

      const remaining = Math.max(targetGain - levelGain, 0);
      goalRemainingDisplay.textContent =
        `Need: ${remaining.toLocaleString()}`;
    } else {
      goalProgressDisplay.textContent = "—";
      goalRemainingDisplay.textContent = "Need: —";
    }
  }

  // Time Bonus (speed bonus for this level so far)
  if (speedBonusDisplay) {
    const currentTimeBank = timeBankMs || 0;
    const bonus = computeSpeedBonus(
      level,
      currentTimeBank,
      turns,
      timePerTurnMs
    );

    const bonusText = bonus === 0
      ? "0"
      : bonus > 0
        ? `+${bonus.toLocaleString()}`
        : `${bonus}`;

    speedBonusDisplay.textContent = bonusText;

    if (bonus > 0) {
      speedBonusDisplay.style.color = "#22c55e";
    } else if (bonus < 0) {
      speedBonusDisplay.style.color = "#f97373";
    } else {
      speedBonusDisplay.style.color = "#9ca3af";
    }
  }

  // Last Move display
  const delta = gameState.lastTileDelta ?? 0;
  const text = delta === 0 ? "0" : delta > 0 ? `+${delta}` : `${delta}`;
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

  // Must hit minimum score to even be considered
  if (finalScore < MIN_SUBMIT_SCORE) {
    saveScoreButton.disabled = true;
    saveStatus.textContent = `Reach at least ${MIN_SUBMIT_SCORE.toLocaleString()} points to save to the global leaderboard.`;
    saveStatus.style.color = "#9ca3af";
    return;
  }

  // Don’t re-save if we’ve already saved this run at a higher/equal score
  if (finalScore <= currentRunSavedScore) {
    return;
  }

  // Get name to use — either cached or via dialog
  let nameToUse = cachedPlayerName;

  if (!nameToUse) {
    saveStatus.textContent = "New high score! Enter a name to appear on the leaderboard…";
    saveStatus.style.color = "#9ca3af";

    // Ask player for a name
    const chosenName = await promptForPlayerName();

    if (!chosenName) {
      // Player closed or skipped dialog; allow manual retry later
      saveStatus.textContent = "Score not saved. Tap 'Retry Save' if you want to add a name and submit.";
      saveStatus.style.color = "#9ca3af";
      saveScoreButton.disabled = false;
      return;
    }

    nameToUse = chosenName;
  }

  // Last profanity guard in case cached name was set long ago
  if (isNameProfane(nameToUse)) {
    saveStatus.textContent =
      "That name isn't allowed on the public leaderboard. Please choose a different one.";
    saveStatus.style.color = "#f97373";
    saveScoreButton.disabled = false;
    return;
  }

  saveScoreButton.disabled = true;
  saveStatus.textContent = "Saving to leaderboard…";
  saveStatus.style.color = "#9ca3af";

  try {
    const returnedId = await saveScoreToSupabase(
      nameToUse,
      finalScore,
      gameState.level,
      currentRunScoreId
    );

    currentRunScoreId = returnedId;
    currentRunSavedScore = finalScore;

    saveStatus.textContent = "Auto-saved to leaderboard.";
    saveStatus.style.color = "#22c55e";

    await loadLeaderboard();
  } catch (err) {
    console.error("Auto-save error:", err);
    saveStatus.textContent = "Auto-save failed. Tap to retry.";
    saveStatus.style.color = "#f97373";
    saveScoreButton.disabled = false;
  }
}


// ---------- Fireworks ----------

function triggerFireworks() {
  const overlay = document.getElementById("fireworksOverlay");
  if (!overlay) return;

  overlay.innerHTML = "";
  overlay.classList.add("active");

  const burstCount = 4;
  const particlesPerBurst = 26;
  const colors = [
    "#f97316",
    "#facc15",
    "#22c55e",
    "#38bdf8",
    "#a855f7",
    "#f97373",
  ];

  const allDurations = [];

  for (let b = 0; b < burstCount; b++) {
    const centerX = 25 + Math.random() * 50;
    const centerY = 30 + Math.random() * 40;

    for (let i = 0; i < particlesPerBurst; i++) {
      const p = document.createElement("span");
      p.className = "firework-particle";

      const angle = Math.random() * Math.PI * 2;
      const distance = 90 + Math.random() * 130;

      const dx = Math.cos(angle) * distance;
      const dy = Math.sin(angle) * distance;

      p.style.setProperty("--dx", `${dx}px`);
      p.style.setProperty("--dy", `${dy}px`);

      const size = 7 + Math.random() * 7;
      p.style.width = `${size}px`;
      p.style.height = `${size}px`;

      const color = colors[(b + i) % colors.length];
      p.style.background = color;
      p.style.boxShadow = `
        0 0 8px ${color},
        0 0 18px ${color}AA,
        0 0 26px ${color}77
      `;

      const duration = 750 + Math.random() * 350;
      const delay = Math.random() * 200 + b * 100;

      p.style.animationDuration = `${duration}ms`;
      p.style.animationDelay = `${delay}ms`;

      allDurations.push(duration + delay);

      p.style.left = `${centerX}%`;
      p.style.top = `${centerY}%`;

      overlay.appendChild(p);
    }
  }

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

  const level = gameState.level;

  // ⏱ Compute speed bonus ONCE per level, apply before gate check
  let timeBonus = 0;
  if (gameState.timeBankMs && gameState.timeBankMs > 0) {
    timeBonus = computeSpeedBonus(
      level,
      gameState.timeBankMs,
      gameState.turns,
      gameState.timePerTurnMs
    );

    if (timeBonus > 0) {
      gameState.score += timeBonus;
    }
  }

  // 🔹 Refresh UI so scoreDisplay shows the post-bonus total
  updateUIFromState();

  const finalScore = gameState.score;
  const levelGain = finalScore - (gameState.scoreAtLevelStart || 0);
  const missed = gameState.missedTurns || 0;

  const requiredGain = getRequiredGainForLevel(level);

  const passedScoreGate = levelGain >= requiredGain;
  const passedMissGate = true; // currently unused gate

  const wasNewHighScore = finalScore > bestScore;

  // Track session best (cumulative score)
  if (finalScore > bestScore) {
    bestScore = finalScore;
    bestLevel = level;
    bestScoreDisplay.textContent = bestScore.toLocaleString();
    bestLevelDisplay.textContent = bestLevel;
  }

  // Auto-save (or show why not)
  autoSaveScoreIfEligible();

  // If player chose End Game, always treat as run over (no modal)
  if (reason === "quit") {
    messageArea.innerHTML =
      `<strong class="over">Run ended by player at Level ${level}.</strong> ` +
      `Final score: ${finalScore.toLocaleString()}.`;

    startButton.disabled = false;
    startButton.textContent = "Start Game";
    startButton.onclick = startGame;
    setStartButtonVisual("new");

    endButton.disabled = true;
    setEndButtonVisual(false);

    if (levelGoals) levelGoals.textContent = "";
    return;
  }

    if (passedScoreGate && passedMissGate) {
      // 🎆 Fireworks on level clear
      triggerFireworks();

      // Mark this as a “long” center message
      messageArea.classList.add("long");
    
      const bonusText =
        timeBonus > 0
          ? ` That includes <strong>${timeBonus.toLocaleString()} pts</strong> from playing fast.`
          : "";

      messageArea.innerHTML =
        `<strong>Level ${level} cleared!</strong> ` +
        `You earned ${levelGain.toLocaleString()} points this level ` +
        `(${missed} missed turn${missed === 1 ? "" : "s"}).` +
        bonusText;


    // Award retry credit if this level is a milestone
    maybeAwardRetryCreditForLevel(level);

    // NEXT level’s point requirement
    const nextLevel = level + 1;
    const targetNext = getRequiredGainForLevel(nextLevel);
    if (levelGoals) {
      levelGoals.textContent =
        `Level ${nextLevel} target: +${targetNext.toLocaleString()} pts`;
    }

    // ✅ Backup: Start button still works to advance
    startButton.disabled = false;
    startButton.textContent = `Play Level ${nextLevel}`;
    startButton.onclick = () => startLevel(nextLevel);
    setStartButtonVisual("next");   // 🔹 same look as “Next Level” modal button

    // Show modal for "Level Cleared"
    openResultModal({
      cleared: true,
      level,
      totalPoints: finalScore,
      roundPoints: levelGain,
      neededPoints: requiredGain,
      misses: missed,
      nextLevelNeededPoints: targetNext,
      timeBonus,
      isPerfectLevel: missed === 0,
      isNewHighScore: wasNewHighScore,
    });

  } else {
    // ❌ Run ends here due to not hitting the point target

    // Mark this as a “long” center message
    messageArea.classList.add("long");
      
    const reasonText =
      `You needed at least ${requiredGain.toLocaleString()} points this level ` +
      `(you got ${levelGain.toLocaleString()}).`;
  
    const bonusText =
      timeBonus > 0
        ? ` You still earned <strong>${timeBonus.toLocaleString()} pts</strong> from speed this level.`
        : "";
  
    messageArea.innerHTML =
      `<strong class="over">Run over at Level ${level}.</strong> ` +
      `Final score: ${finalScore.toLocaleString()}. ${reasonText}` +
      bonusText;


    if (levelGoals) levelGoals.textContent = "";

    // ✅ Backup: Start button returns to "Start Game"
    startButton.disabled = false;
    startButton.textContent = "Start Game";
    startButton.onclick = startGame;
    setStartButtonVisual("new");    // 🔹 same look as “Start New Game”


    // Show modal for "Run Over"
    openResultModal({
      cleared: false,
      level,
      totalPoints: finalScore,
      roundPoints: levelGain,
      neededPoints: requiredGain,
      misses: missed,
      timeBonus,
      retryCredits, // pass current value
    });
  }

  // No active run after round ends
  endButton.disabled = true;
  setEndButtonVisual(false);

}

// ---------- Leaderboard ----------

async function loadLeaderboard() {
  if (!leaderboardList) return;

  leaderboardList.innerHTML = `<p class="soft-text">Loading…</p>`;

  try {
    const rows = await fetchTopScores();

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
  await autoSaveScoreIfEligible();
}

// ---------- End Game, Restart, Init ----------

function endGame() {
  if (!gameState || gameState.locked) return;
  endRound("quit");
}

function restartGame() {
  resetTimer();
  startButton.disabled = true;
  startButton.textContent = "Start Game";
  setStartButtonVisual("new");  // keep it in “new game” style while disabled
  saveStatus.textContent = "";
  saveStatus.style.color = "";
  
  endButton.disabled = true;
  setEndButtonVisual(false);

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
  
  setEndButtonVisual(false);   // grey/disabled look
  setStartButtonVisual("new"); // normal Start Game style

  
  saveScoreButton.disabled = true;

  // 🔹 Make Start look like “Start New Game” initially
  setStartButtonVisual("new");

  // 🔹 Show a preview board on load
  renderIdleGrid();

  // Leaderboard popover min score
  const minScoreSpan = document.getElementById("leaderboardMinScore");
  if (minScoreSpan) {
    minScoreSpan.textContent = MIN_SUBMIT_SCORE.toLocaleString();
  }

  // Initial Level 1 goals
  if (levelGoals) {
    const initialLevel = 1;
    const target = getRequiredGainForLevel(initialLevel);
    levelGoals.textContent =
      `Level ${initialLevel} target: +${target.toLocaleString()} pts`;
  }


  // Load leaderboard on page load
  loadLeaderboard();

  // --- Popover helpers ---
  function togglePopover(popover) {
    if (!popover) return;
    const isVisible = popover.classList.contains("visible");

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

  document.addEventListener("click", () => {
    [howToPlayInfoPopover, levelGoalsInfoPopover, leaderboardInfoPopover].forEach((p) => {
      if (p) p.classList.remove("visible");
    });
  });

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
  const HOW_TO_PLAY_KEY = "mindgrindHowToPlayOpen";

  function setHowToPlayOpen(open) {
    if (!howToPlayContent || !howToPlayArrow) return;

    if (open) {
      howToPlayContent.classList.add("open");
      howToPlayArrow.classList.add("open");
      howToPlayContent.style.maxHeight = howToPlayContent.scrollHeight + "px";
    } else {
      howToPlayContent.classList.remove("open");
      howToPlayArrow.classList.remove("open");
      howToPlayContent.style.maxHeight = "0px";
    }
  }

  let initialOpen = true;
  try {
    const stored = localStorage.getItem(HOW_TO_PLAY_KEY);
    if (stored === "0") initialOpen = false;
    if (stored === "1") initialOpen = true;
  } catch (e) {
    // ignore
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
        // ignore
      }
    };
  }
}

init();
