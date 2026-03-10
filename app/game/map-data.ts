// Tile types
export const TILE = {
  FLOOR: 0,
  WALL: 1,
  START: 2,
  GOAL: 3,
  TRAP: 4,
} as const;

export type TileType = (typeof TILE)[keyof typeof TILE];

export const MAP_WIDTH = 10;
export const MAP_HEIGHT = 10;

// Default handcrafted map
export const mapData: TileType[][] = [
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 2, 0, 0, 1, 0, 0, 0, 0, 1],
  [1, 0, 1, 0, 1, 0, 1, 1, 0, 1],
  [1, 0, 1, 0, 0, 0, 0, 1, 0, 1],
  [1, 0, 1, 1, 1, 1, 0, 1, 0, 1],
  [1, 0, 0, 0, 0, 1, 0, 0, 0, 1],
  [1, 1, 1, 1, 0, 1, 0, 1, 1, 1],
  [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
  [1, 0, 1, 1, 1, 1, 1, 1, 3, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
];

// -------------------------------------------------------
// Recursive Backtracking maze generator
//
// The 10x10 grid is structured as:
//   row/col 0, 9        → outer border walls
//   row/col 1,3,5,7     → maze cells  (4 per axis)
//   row/col 2,4,6       → walls between cells
//   row/col 8           → inner border wall strip
//
// START = (1,1), GOAL = (7,7)
// -------------------------------------------------------
export function generateMaze(): TileType[][] {
  // Start with all walls
  const grid: TileType[][] = Array.from({ length: MAP_HEIGHT }, () =>
    Array<TileType>(MAP_WIDTH).fill(TILE.WALL)
  );

  // Cell positions (odd indices within 1..7)
  const CELL_COORDS = [1, 3, 5, 7];

  const visited = new Set<string>();

  function carve(cx: number, cy: number) {
    visited.add(`${cx},${cy}`);
    grid[cy][cx] = TILE.FLOOR;

    // Shuffle 4 directions (step of 2)
    const dirs = [
      { dx: 2, dy: 0 },
      { dx: -2, dy: 0 },
      { dx: 0, dy: 2 },
      { dx: 0, dy: -2 },
    ];
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }

    for (const { dx, dy } of dirs) {
      const nx = cx + dx;
      const ny = cy + dy;
      if (
        CELL_COORDS.includes(nx) &&
        CELL_COORDS.includes(ny) &&
        !visited.has(`${nx},${ny}`)
      ) {
        // Remove the wall between current and next cell
        grid[cy + dy / 2][cx + dx / 2] = TILE.FLOOR;
        carve(nx, ny);
      }
    }
  }

  carve(1, 1);

  // Fixed positions
  grid[1][1] = TILE.START;

  // Connect last maze cell (7,7) to goal at (8,8)
  //   (7,7) → right → (8,7) → down → (8,8) = GOAL
  grid[7][8] = TILE.FLOOR;  // passage right of cell (7,7)
  grid[8][8] = TILE.GOAL;   // GOAL fixed at (8,8)

  return grid;
}

// -------------------------------------------------------
// Map-aware helpers (accept a map parameter)
// -------------------------------------------------------
export function findStartIn(map: TileType[][]): { x: number; y: number } {
  for (let y = 0; y < MAP_HEIGHT; y++)
    for (let x = 0; x < MAP_WIDTH; x++)
      if (map[y][x] === TILE.START) return { x, y };
  return { x: 1, y: 1 };
}

export function findGoalIn(map: TileType[][]): { x: number; y: number } {
  for (let y = 0; y < MAP_HEIGHT; y++)
    for (let x = 0; x < MAP_WIDTH; x++)
      if (map[y][x] === TILE.GOAL) return { x, y };
  return { x: 8, y: 8 };
}

export function isWalkableIn(
  map: TileType[][],
  x: number,
  y: number
): boolean {
  if (x < 0 || x >= MAP_WIDTH || y < 0 || y >= MAP_HEIGHT) return false;
  return map[y][x] !== TILE.WALL;
}

// Legacy single-map helpers (kept for compatibility)
export function findStart() { return findStartIn(mapData); }
export function findGoal()  { return findGoalIn(mapData); }
export function isWalkable(x: number, y: number) { return isWalkableIn(mapData, x, y); }
