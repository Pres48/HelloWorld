// game.js

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
 * You can tweak this curve over time.
 */
export function getDifficultyForLevel(level) {
  // Slower start, smoother ramp
  const baseTimeMs = 4500;   // Level 1 = 4.5 seconds per turn
  const minTimeMs = 1400;    // Hard cap for very high levels

  // Each level shaves off 150ms, until minTimeMs
  const timePerTurnMs = Math.max(
    minTimeMs,
    baseTimeMs - (level - 1) * 150
  );

  const gridSize = level >= 15 ? 7 : 6;
  const turns = 8 + Math.min(4, Math.floor(level / 5)); // 8–12 turns

  // Tile distribution weights
  const bonusWeight = 1 + Math.min(3, Math.floor(level / 4));
  const chainWeight = 1 + Math.min(3, Math.floor(level / 5));
  const riskWeight = 1 + Math.min(4, Math.floor(level / 6));
  const numberWeight = 6; // always common

  return {
    timePerTurnMs,
    gridSize,
    turns,
    tileWeights: {
      [TILE_TYPES.NUMBER]: numberWeight,
      [TILE_TYPES.BONUS]: bonusWeight,
      [TILE_TYPES.CHAIN]: chainWeight,
      [TILE_TYPES.RISK]: riskWeight,
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
          value = randomInt(2, 10);
          break;
        case TILE_TYPES.BONUS:
          value = randomInt(1, 3); // multiplier steps
          break;
        case TILE_TYPES.CHAIN:
          value = randomInt(3, 7);
          break;
        case TILE_TYPES.RISK:
          value = randomInt(-8, 16);
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
