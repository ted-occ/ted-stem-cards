import { generateRandomPath, moveGrid, isHorizontalDir } from "@/lib/ball-shared";

export interface LevelConfig {
  id: string;
  gridSize: number;
  minDistance: number;
  hasChallenge: boolean;
  obstacleCount?: { min: number; max: number };
  branchCount?: { min: number; max: number };
  /** i18n key for theme text (e.g. "lv1Theme") */
  themeKey: string;
  /** i18n key for challenge theme text (e.g. "lv1ChallengeTheme") */
  challengeThemeKey: string;
  /** i18n key for level label (e.g. "lv1") */
  labelKey: string;
}

export interface BranchCell {
  col: number;
  row: number;
  horizontalBranch: "UP" | "DOWN";    // arriving horizontally → branch vertically
  verticalBranch: "LEFT" | "RIGHT";   // arriving vertically → branch horizontally
}

export const LEVELS: Record<string, LevelConfig> = {
  lv1: { id: "lv1", gridSize: 3, minDistance: 2, hasChallenge: true, themeKey: "lv1Theme", challengeThemeKey: "lv1ChallengeTheme", labelKey: "lv1" },
  lv2: { id: "lv2", gridSize: 5, minDistance: 4, hasChallenge: true, obstacleCount: { min: 2, max: 4 }, themeKey: "lv2Theme", challengeThemeKey: "lv2ChallengeTheme", labelKey: "lv2" },
  lv3: { id: "lv3", gridSize: 5, minDistance: 4, hasChallenge: false, branchCount: { min: 1, max: 2 }, themeKey: "lv3Theme", challengeThemeKey: "lv3ChallengeTheme", labelKey: "lv3" },
};

export type GridPos = { col: number; row: number };

/** BFS check if path exists from start to goal avoiding obstacles */
export function hasPath(
  start: GridPos,
  goal: GridPos,
  gridSize: number,
  obstacles: GridPos[],
): boolean {
  const key = (c: number, r: number) => `${c},${r}`;
  const visited = new Set<string>();
  const queue: GridPos[] = [start];
  visited.add(key(start.col, start.row));

  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (cur.col === goal.col && cur.row === goal.row) return true;
    for (const dir of ["UP", "DOWN", "LEFT", "RIGHT"]) {
      const next = moveGrid(cur, dir, gridSize, obstacles);
      if (!next) continue;
      const k = key(next.col, next.row);
      if (visited.has(k)) continue;
      visited.add(k);
      queue.push(next);
    }
  }
  return false;
}

/** Generate random obstacles for a level, ensuring path exists */
export function generateObstacles(
  config: LevelConfig,
  start: GridPos,
  goal: GridPos,
): GridPos[] {
  if (!config.obstacleCount) return [];
  const { min, max } = config.obstacleCount;
  const count = min + Math.floor(Math.random() * (max - min + 1));
  const { gridSize } = config;

  for (let attempt = 0; attempt < 50; attempt++) {
    const obstacles: GridPos[] = [];
    const used = new Set<string>();
    used.add(`${start.col},${start.row}`);
    used.add(`${goal.col},${goal.row}`);

    for (let i = 0; i < count; i++) {
      let placed = false;
      for (let t = 0; t < 20; t++) {
        const col = Math.floor(Math.random() * gridSize);
        const row = Math.floor(Math.random() * gridSize);
        const k = `${col},${row}`;
        if (!used.has(k)) {
          used.add(k);
          obstacles.push({ col, row });
          placed = true;
          break;
        }
      }
      if (!placed) break;
    }

    if (obstacles.length === count && hasPath(start, goal, gridSize, obstacles)) {
      return obstacles;
    }
  }
  return []; // fallback: no obstacles
}

/** Generate random branch cells for a level, ensuring branches don't overlap with start/goal/obstacles */
export function generateBranchCells(
  config: LevelConfig,
  start: GridPos,
  goal: GridPos,
  obstacles: GridPos[],
): BranchCell[] {
  if (!config.branchCount) return [];
  const { min, max } = config.branchCount;
  const count = min + Math.floor(Math.random() * (max - min + 1));
  const { gridSize } = config;

  const used = new Set<string>();
  used.add(`${start.col},${start.row}`);
  used.add(`${goal.col},${goal.row}`);
  for (const o of obstacles) used.add(`${o.col},${o.row}`);
  // Exclude corners to reduce deadlock risk
  const corners = [`0,0`, `0,${gridSize - 1}`, `${gridSize - 1},0`, `${gridSize - 1},${gridSize - 1}`];
  for (const c of corners) used.add(c);

  const cells: BranchCell[] = [];
  for (let i = 0; i < count; i++) {
    for (let t = 0; t < 30; t++) {
      const col = Math.floor(Math.random() * gridSize);
      const row = Math.floor(Math.random() * gridSize);
      const k = `${col},${row}`;
      if (used.has(k)) continue;
      used.add(k);
      cells.push({
        col,
        row,
        horizontalBranch: Math.random() < 0.5 ? "UP" : "DOWN",
        verticalBranch: Math.random() < 0.5 ? "LEFT" : "RIGHT",
      });
      break;
    }
  }
  return cells;
}

/** Generate start, goal, obstacles, and branch cells for a level */
export function generateLevel(config: LevelConfig): { start: GridPos; goal: GridPos; obstacles: GridPos[]; branchCells: BranchCell[] } {
  const { start, goal } = generateStartGoal(config);
  const obstacles = generateObstacles(config, start, goal);
  const branchCells = generateBranchCells(config, start, goal, obstacles);
  return { start, goal, obstacles, branchCells };
}

/** Generate random start/goal positions for a level */
export function generateStartGoal(config: LevelConfig): { start: GridPos; goal: GridPos } {
  const { gridSize, minDistance } = config;
  const positions: GridPos[] = [];
  for (let r = 0; r < gridSize; r++)
    for (let c = 0; c < gridSize; c++)
      positions.push({ col: c, row: r });

  const startIdx = Math.floor(Math.random() * positions.length);
  const start = positions[startIdx];
  const far = positions.filter(
    (p) => Math.abs(p.col - start.col) + Math.abs(p.row - start.row) >= minDistance,
  );
  const goal = far[Math.floor(Math.random() * far.length)];
  return { start, goal };
}

/** Generate a challenge target move count */
export function generateChallengeCount(
  start: GridPos,
  goal: GridPos,
  currentChallenge: number | null,
  gridSize: number = 3,
  obstacles: GridPos[] = [],
): number {
  let count: number;
  let attempts = 0;
  do {
    const path = generateRandomPath(start, goal, gridSize, obstacles);
    count = path.length;
    attempts++;
  } while (count === currentChallenge && attempts < 20);
  return count;
}

/** Center position of a grid (used as default ball position when no level active) */
export function gridCenter(gridSize: number): GridPos {
  const center = Math.floor(gridSize / 2);
  return { col: center, row: center };
}

/** Check if a move result triggers success or failure in the level */
export function checkMoveResult(
  config: LevelConfig,
  pos: GridPos,
  goal: GridPos,
  moves: number,
  challenge: number | null,
  branchUsed: boolean = false,
): "success" | "burst" | null {
  const onGoal = pos.col === goal.col && pos.row === goal.row;
  if (onGoal) {
    if (challenge !== null && moves !== challenge) return "burst";
    if (config.branchCount && !branchUsed) return "burst";
    return "success";
  }
  if (challenge !== null && moves > challenge) return "burst";
  return null;
}

/** Check if a program run result is success in the level */
export function checkProgramResult(
  config: LevelConfig,
  finalPos: GridPos,
  goal: GridPos,
  passedGoal: boolean,
  branchUsed: boolean = false,
  moves: number = 0,
  challenge: number | null = null,
): boolean {
  if (passedGoal) return false;
  if (finalPos.col !== goal.col || finalPos.row !== goal.row) return false;
  if (config.branchCount && !branchUsed) return false;
  if (challenge !== null && moves !== challenge) return false;
  return true;
}

/** Check if an intermediate step passes through goal */
export function isGoalPassthrough(
  pos: GridPos,
  goal: GridPos,
): boolean {
  return pos.col === goal.col && pos.row === goal.row;
}

/** Encode obstacles to a compact string: "1223" = col1row2, col2row3 */
export function encodeObstacles(obstacles: GridPos[]): string {
  return obstacles.map((o) => `${o.col}${o.row}`).join("");
}

/** Decode obstacles from compact string */
export function decodeObstacles(encoded: string): GridPos[] {
  const obstacles: GridPos[] = [];
  for (let i = 0; i + 1 < encoded.length; i += 2) {
    obstacles.push({ col: Number(encoded[i]), row: Number(encoded[i + 1]) });
  }
  return obstacles;
}

/** Encode branch cells: "12UD" = col1,row2,hBranch=UP,vBranch=DOWN (U/D for hBranch, L/R for vBranch) */
export function encodeBranchCells(cells: BranchCell[]): string {
  return cells.map((c) => {
    const h = c.horizontalBranch === "UP" ? "U" : "D";
    const v = c.verticalBranch === "LEFT" ? "L" : "R";
    return `${c.col}${c.row}${h}${v}`;
  }).join("");
}

/** Decode branch cells from compact string */
export function decodeBranchCells(encoded: string): BranchCell[] {
  const cells: BranchCell[] = [];
  for (let i = 0; i + 3 < encoded.length; i += 4) {
    cells.push({
      col: Number(encoded[i]),
      row: Number(encoded[i + 1]),
      horizontalBranch: encoded[i + 2] === "U" ? "UP" : "DOWN",
      verticalBranch: encoded[i + 3] === "L" ? "LEFT" : "RIGHT",
    });
  }
  return cells;
}

/** Resolve branch direction for a position given arrival direction and branch cells.
 *  Returns the resolved branch direction and the matching cell, or null if not on a branch cell. */
export function resolveBranchDir(
  pos: GridPos,
  arrivalDir: string,
  branchCells: BranchCell[],
): { branchDir: string; cell: BranchCell } | null {
  const cell = branchCells.find((c) => c.col === pos.col && c.row === pos.row);
  if (!cell) return null;
  const branchDir = isHorizontalDir(arrivalDir) ? cell.horizontalBranch : cell.verticalBranch;
  return { branchDir, cell };
}

/** Build NTAG URL params for a level */
export function buildLevelNtagParams(
  config: LevelConfig,
  start: GridPos,
  goal: GridPos,
  challenge: number | null,
  obstacles: GridPos[] = [],
  branchCells: BranchCell[] = [],
): Record<string, string> {
  const params: Record<string, string> = {
    lv: config.id,
    sc: String(start.col),
    sr: String(start.row),
    gc: String(goal.col),
    gr: String(goal.row),
  };
  if (challenge !== null) params.ch = String(challenge);
  if (obstacles.length > 0) params.ob = encodeObstacles(obstacles);
  if (branchCells.length > 0) params.br = encodeBranchCells(branchCells);
  return params;
}
