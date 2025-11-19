// game.js

// ==== EASY TUNING: TILE VALUE RANGES ====

// Number tiles: base points before multiplier
const NUMBER_MIN = 8; 
const NUMBER_MAX = 25;

// Bonus tiles: "steps" used as +x(steps * 0.25) to the multiplier
// e.g., 1 => +x0.25, 2 => +x0.50, etc.
const BONUS_STEPS_MIN = 2; 
const BONUS_STEPS_MAX = 4;

// Chain tiles: base points before chain multiplier
const CHAIN_MIN = 7; 
const CHAIN_MAX = 18;

// Risk tiles: random integer between these two
// You can make this all positive, all negative, or mixed.
const RISK_MIN = -30; 
const RISK_MAX = 50;

// =========================================

export const TILE_TYPES = {
  NUMBER:     "number",
  BONUS:      "bonus",
  CHAIN:      "chain",
  RISK:       "risk",
};

export const RARITY_TYPES = {
  RARE:       "rare",
  EPIC:       "epic",
  LEGEND:     "legend",
  MYTHIC:     "mythic",
  RELIC:      "relic",
  EXOTIC:     "exotic",
  COSMIC:     "cosmic",
};

// Special tiles (fixed-value, rare)
export const RARITY_VALUES = {
  rare:       100,
  epic:       250,
  legend:     500,
  mythic:     1000,
  relic:      2000,
  exotic:     5000,
  cosmic:     10000,
};


function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ---- LEVEL BEHAVIOR / DIFFICULTY FLAGS ----

// This describes how tiles should *display* and behave at a given level.
// Cleaned up to remove unreachable conditions, but effective behavior is the same
// as in your current version.
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
  // TIER 1 – Onboarding (L1–10)
  // Pure numeric, full labels, no tricks.
  // ---------------------------
  if (level <= 10) {
    return behavior;
  }

  // ----------------------------------
  // TIER 2 – Light equations (L11–20)
  // Start sprinkling equations on NUMBER / CHAIN tiles, but keep labels
  // ----------------------------------
  if (level <= 20) {
    behavior.equationChance = 0.1;
    behavior.multiStepEquationChance = 0.0; // only single-op
    return behavior;
  }

  // -----------------------------------------
  // TIER 3 – More equations (L21–30)
  // Mental load increases, still readable.
  // -----------------------------------------
  if (level <= 30) {
    behavior.equationChance = 0.15;
    behavior.multiStepEquationChance = 0.05;
    return behavior;
  }

  // ------------------------------------------------
  // TIER 4 – Riskier & mathier (L31–40)
  // More equations, occasional multi-step.
  // ------------------------------------------------
  if (level <= 40) {
    behavior.equationChance = 0.2;
    behavior.multiStepEquationChance = 0.1;
    
    behavior.showNumberChainLabels = false;
    
    return behavior;
  }

  // ----------------------------------------------------------
  // TIER 5 – Pattern recognition challenge (L41–50)
  // Remove NUM/CHAIN labels; rely on colors + equation format.
  // Remove BONUS/RISK labels; rely on colors
  // ----------------------------------------------------------
  if (level <= 50) {
    behavior.equationChance = 0.25;
    behavior.multiStepEquationChance = 0.1;

    behavior.showNumberChainLabels = false;
      // hide BONUS/RISK labels here:
    behavior.showOtherLabels = false;

    return behavior;
  }

  // ------------------------------------------------------
  // TIER 6 – Advanced play (L51–60)
  // Higher equation density, more multi-step, risk hidden (shows 2 possible number choices for tile).
  // ------------------------------------------------------
  if (level <= 60) {
    behavior.equationChance = 0.3;
    behavior.multiStepEquationChance = 0.15;

    behavior.showNumberChainLabels = false;
    behavior.showOtherLabels = false;
    
    behavior.hideRiskValues = true;

    return behavior;
  }

  // ------------------------------------------------------
  // TIER 7 – Expert / “endless” (L61+)
  // Dense equations, frequent multi-step, shuffled boards, risk hidden,
  // NUM/CHAIN, BONUS/RISK labels gone.
  // ------------------------------------------------------
  behavior.equationChance = 0.35;
  behavior.multiStepEquationChance = 0.2;

  behavior.showNumberChainLabels = false;
  behavior.showOtherLabels = false;
  behavior.hideRiskValues = true;
  
  behavior.shuffleEachTurn = true;

  return behavior;
}

/**
 * Compute difficulty parameters for a given level.
 */
export function getDifficultyForLevel(level) {
  // New timing curve: more thinking room, smoother ramp
  const baseTimeMs = 6400;   // L1 ≈ 6.4s per turn
  const minTimeMs  = 2400;   // Never go below ~2.4s per turn

  // Each level shaves off XX ms, until minTimeMs
  const timeStep = 50; // was 70
  const timePerTurnMs = Math.max(
    minTimeMs,
    baseTimeMs - (level - 1) * timeStep
  );

  const gridSize = level >= 35 ? 7 : 6;
  const turns = 8 + Math.min(4, Math.floor(level / 7)); // 8–12 turns

  // Tile distribution weights – same as before
  const bonusWeight  = 1 + Math.min(3, Math.floor(level / 4));
  const chainWeight  = 1 + Math.min(3, Math.floor(level / 5));
  const riskWeight   = 1 + Math.min(2, Math.floor(level / 10));
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


function boardRarityChance(level) {
  if (level < 5) return 0;        // no rarities yet
  if (level < 10) return 0.12;    // 12%
  if (level < 15) return 0.18;
  if (level < 20) return 0.25;
  if (level < 25) return 0.30;
  if (level < 30) return 0.35;
  if (level < 40) return 0.40;
  return 0.45;                    // max 45% chance a board gets a special tile
}

function rarityWeightsForLevel(level) {
  const weights = {};

  if (level >= 5)  weights[RARITY_TYPES.RARE]      = 8;
  if (level >= 10) weights[RARITY_TYPES.EPIC]      = 4;
  if (level >= 15) weights[RARITY_TYPES.LEGEND]    = 2;
  if (level >= 20) weights[RARITY_TYPES.MYTHIC]    = 1.5;
  if (level >= 30) weights[RARITY_TYPES.RELIC]     = 1;
  if (level >= 40) weights[RARITY_TYPES.EXOTIC]    = 0.5;
  if (level >= 50) weights[RARITY_TYPES.COSMIC]    = 0.25;

  return weights;
}

function pickRarityByWeight(weights) {
  const entries = Object.entries(weights);
  const total = entries.reduce((sum, [, w]) => sum + w, 0);

  let r = Math.random() * total;

  for (const [rarity, w] of entries) {
    if (r < w) return rarity;
    r -= w;
  }

  // fallback — should never hit
  return entries[0][0];
}

function maybeInjectRarityTile(level, grid) {
  // 1. Roll to see if ANY rarity appears on this board
  const spawnChance = boardRarityChance(level);
  if (Math.random() > spawnChance) return;  // no rarity this board

  // 2. Get rarity weights for this level
  const weights = rarityWeightsForLevel(level);
  if (!Object.keys(weights).length) return; // none unlocked yet

  // 3. Pick one rarity by weight
  const rarityType = pickRarityByWeight(weights);
  const rarityValue = RARITY_VALUES[rarityType];

  // 4. Pick a random tile position
  const gridSize = grid.length;
  const row = Math.floor(Math.random() * gridSize);
  const col = Math.floor(Math.random() * gridSize);

  // 5. Inject rarity tile (overwrite whatever was there)
  grid[row][col] = {
    id: `${row}-${col}`,
    row,
    col,
    type: rarityType,
    value: rarityValue,
    selected: false
  };
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

  // Try to overwrite one normal tile with a rarity tile, depending on level
  maybeInjectRarityTile(level, grid);

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
    // Slightly stronger chains so they become a real strategy,
    // especially in mid/high levels.
    let step = 0.40;
    if (state.level >= 10) step = 0.45;
    if (state.level >= 20) step = 0.50;
    if (state.level >= 40) step = 0.55;
  
    const chainFactor = 1 + newState.chainCount * step;
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
  } else if (
  type === RARITY_TYPES.RARE ||
  type === RARITY_TYPES.EPIC ||
  type === RARITY_TYPES.LEGEND ||
  type === RARITY_TYPES.MYTHIC ||
  type === RARITY_TYPES.RELIC ||
  type === RARITY_TYPES.EXOTIC ||
  type === RARITY_TYPES.COSMIC
) {
  basePoints = value; // treat like super-number tile
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
