// game.js

// ==== EASY TUNING: TILE VALUE RANGES ====

// Number tiles: base points before multiplier
// const NUMBER_MIN = 2; const NUMBER_MAX = 10;
const NUMBER_MIN = 5; const NUMBER_MAX = 20;

// Bonus tiles: "steps" used as +x(steps * 0.25) to the multiplier
// e.g., 1 => +x0.25, 2 => +x0.50, etc.
const BONUS_STEPS_MIN = 1; const BONUS_STEPS_MAX = 3;

// Chain tiles: base points before chain multiplier
// const CHAIN_MIN = 3; const CHAIN_MAX = 7;
const CHAIN_MIN = 5; const CHAIN_MAX = 12;

// Risk tiles: random integer between these two
// You can make this all positive, all negative, or mixed.
// const RISK_MIN = -8; const RISK_MAX = 16;
const RISK_MIN = -25; const RISK_MAX = 40;

// =========================================

export const TILE_TYPES = {
  NUMBER: "number",
  BONUS: "bonus",
  CHAIN: "chain",
  RISK: "risk",
};

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ---- LEVEL BEHAVIOR / DIFFICULTY FLAGS ----

// This describes how tiles should *display* and behave at a given level.
// You can tune these thresholds however you like.
export function getLevelBehavior(level) {
  // Base behavior (Level 1)
  const behavior = {
    // Visual labels like "NUM", "CHAIN" on tiles
    showNumberChainLabels: true,   // for NUMBER + CHAIN
    showOtherLabels: true,         // for BONUS + RISK

    // Equation display probabilities (0–1)
    // Applied only to NUMBER + CHAIN tiles
    equationChance: 0,             // 0 = never
    multiStepEquationChance: 0,    // 0 = only simple equations

    // Risk tile display
    hideRiskValues: false,         // if true, show "???" instead of value

    // Board reshuffle
    shuffleEachTurn: false,        // if true, grid gets shuffled each turn
  };

  // ---------------------------
  // TIER 1 – Onboarding (L1–4)
  // ---------------------------
  // Pure numeric, full labels, no tricks.
  if (level <= 4) {
    return behavior;
  }

  // ----------------------------------
  // TIER 2 – Light equations (L5–8)
  // ----------------------------------
  // Start sprinkling equations on NUMBER / CHAIN tiles, but keep labels
  if (level <= 8) {
    behavior.equationChance = 0.18;       // ~18% of number/chain tiles show as equations
    behavior.multiStepEquationChance = 0; // only single-op: "10+7", "4×3", etc.
    return behavior;
  }

  // -----------------------------------------
  // TIER 3 – More equations (L9–12)
  // -----------------------------------------
  // Mental load increases, still readable.
  if (level <= 12) {
    behavior.equationChance = 0.30;       // 30% of number/chain tiles as equations
    behavior.multiStepEquationChance = 0.10; // ~10% of those become 2–3 term equations
    return behavior;
  }

  // ------------------------------------------------
  // TIER 4 – Riskier & mathier (L13–16)
  // ------------------------------------------------
  // More equations, occasional multi-step, risk starts getting obscured later.
  if (level <= 16) {
    behavior.equationChance = 0.42;
    behavior.multiStepEquationChance = 0.18;

    // At 15+ we start hiding risk values: pure “feel” choices
    if (level >= 15) {
      behavior.hideRiskValues = true; // risk tiles show "???"
    }

    return behavior;
  }

  // ----------------------------------------------------------
  // TIER 5 – Pattern recognition challenge (L17–20)
  // ----------------------------------------------------------
  // Remove NUM/CHAIN labels; you rely on colors + equation format.
  if (level <= 20) {
    behavior.equationChance = 0.55;
    behavior.multiStepEquationChance = 0.28;

    behavior.showNumberChainLabels = false; // tiles still colored, but no "NUM"/"CHAIN"
    behavior.hideRiskValues = true;        // risk stays hidden

    return behavior;
  }

  // ------------------------------------------------------
  // TIER 6 – Advanced play (L21–30)
  // ------------------------------------------------------
  // Higher equation density, more multi-step, optional board shuffle at 26+.
  if (level <= 30) {
    behavior.equationChance = 0.65;
    behavior.multiStepEquationChance = 0.35;

    behavior.showNumberChainLabels = false;
    behavior.hideRiskValues = true;

    if (level >= 26) {
      behavior.shuffleEachTurn = true; // grid layout scrambles between turns
    }

    return behavior;
  }

  // ------------------------------------------------------
  // TIER 7 – Expert / “endless” (L31+)
  // ------------------------------------------------------
  // This is where grinders live. Very dense equations, frequent multi-step,
  // shuffled boards, risk hidden, NUM/CHAIN labels gone.
  behavior.equationChance = 0.75;          // 3/4 of number/chain tiles are equations
  behavior.multiStepEquationChance = 0.45; // almost half of those are multi-step

  behavior.showNumberChainLabels = false;
  behavior.hideRiskValues = true;
  behavior.shuffleEachTurn = true;

  // You *could* also hide BONUS/RISK labels here if you want true chaos:
  // behavior.showOtherLabels = false;

  return behavior;
}



/**
 * Compute difficulty parameters for a given level.
 */
export function getDifficultyForLevel(level) {
  // 🎯 New timing curve: more thinking room, smoother ramp
  const baseTimeMs = 4200;   // L1 ≈ 4.2s per turn
  const minTimeMs  = 2200;   // Never go below ~2.2s per turn

  // Each level shaves off 70ms, until minTimeMs
  const timePerTurnMs = Math.max(
    minTimeMs,
    baseTimeMs - (level - 1) * 70
  );

  // const gridSize = level >= 15 ? 7 : 6;
  // const turns = 8 + Math.min(4, Math.floor(level / 5)); // 8–12 turns
  const gridSize = level >= 28 ? 7 : 6;
  const turns = 8 + Math.min(4, Math.floor(level / 7)); // 8–12 turns

  // Tile distribution weights – same as before
  const bonusWeight  = 1 + Math.min(3, Math.floor(level / 4));
  const chainWeight  = 1 + Math.min(3, Math.floor(level / 5));
  const riskWeight   = 1 + Math.min(4, Math.floor(level / 6));
  const numberWeight = 6;

  return {
    timePerTurnMs,
    gridSize,
    turns,
    tileWeights: {
      [TILE_TYPES.NUMBER]: numberWeight,
      [TILE_TYPES.BONUS]:  bonusWeight,
      [TILE_TYPES.CHAIN]:  chainWeight,
      [TILE_TYPES.RISK]:   riskWeight,
    },
  };
}


function pickTileType(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);
  let r = Math.random() * total;
  for (const [type, w] of entries) {
    if (r < w) return type;
    r -= w;
  }
  return TILE_TYPES.NUMBER;
}

/**
 * Generate a grid configuration given level/difficulty.
 */
export function generateGrid(level) {
  const { gridSize, tileWeights } = getDifficultyForLevel(level);
  const grid = [];

  for (let row = 0; row < gridSize; row++) {
    const rowArr = [];
    for (let col = 0; col < gridSize; col++) {
      const type = pickTileType(tileWeights);
      let value = 0;

      switch (type) {
        case TILE_TYPES.NUMBER:
          value = randomInt(NUMBER_MIN, NUMBER_MAX);
          break;

        case TILE_TYPES.BONUS:
          value = randomInt(BONUS_STEPS_MIN, BONUS_STEPS_MAX); // multiplier steps
          break;

        case TILE_TYPES.CHAIN:
          value = randomInt(CHAIN_MIN, CHAIN_MAX);
          break;

        case TILE_TYPES.RISK:
          value = randomInt(RISK_MIN, RISK_MAX);
          break;
      }

      rowArr.push({
        id: `${row}-${col}`,
        row,
        col,
        type,
        value,
        selected: false,
      });
    }
    grid.push(rowArr);
  }

  return grid;
}

/**
 * Evaluate a tile selection and update score state.
 */
export function resolveTileSelection(tile, state) {
  const newState = { ...state };

  const { type, value } = tile;

  let basePoints = 0;

  if (type === TILE_TYPES.NUMBER) {
    basePoints = value;

  } else if (type === TILE_TYPES.CHAIN) {
    const chainFactor = 1 + newState.chainCount * 0.35;
    basePoints = Math.round(value * chainFactor);
    newState.chainCount += 1;

  } else if (type === TILE_TYPES.BONUS) {
    newState.multiplier = parseFloat(
      (newState.multiplier + value * 0.25).toFixed(2)
    );
    basePoints = 1; // small base

  } else if (type === TILE_TYPES.RISK) {
    basePoints = value;
    if (value < 0) {
      newState.multiplier = Math.max(
        1,
        parseFloat((newState.multiplier - 0.5).toFixed(2))
      );
    }
  }

  const appliedPoints = Math.round(basePoints * newState.multiplier);
  newState.score += appliedPoints;
  newState.lastTileDelta = appliedPoints;
  newState.turnIndex += 1;

  // Reset chain if not a chain tile
  if (type !== TILE_TYPES.CHAIN) {
    newState.chainCount = 0;
  }

  return newState;
}
