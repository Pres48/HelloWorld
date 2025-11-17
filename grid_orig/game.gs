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
