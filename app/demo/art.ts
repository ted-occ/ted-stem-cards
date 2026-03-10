const WIDTH = 40;
const HEIGHT = 20;
const MAX_LEVEL = 8;
const PEN_COLOR = "#E8872A";

export type SimpleAction = "FORWARD" | "BACK" | "TURN_RIGHT" | "TURN_LEFT";

export interface CellData {
  level: number;
}

export interface PathStep {
  x: number;
  y: number;
  dir: number;
}

export interface PlayerConfig {
  startX: number;
  startY: number;
  startDir: number;
  actions: SimpleAction[];
}

// Direction: 0=UP, 1=RIGHT, 2=DOWN, 3=LEFT
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

const UP = 0, RIGHT = 1, DOWN = 2, LEFT = 3;

/**
 * Letter shape: 8w x 12h octagon, 1-cell corner cuts, 2-cell wall thickness.
 * Rows 0,11: cols 1-6 | Rows 1,10: cols 0-7
 * Rows 2-9:  O = cols 0-1 + 6-7 (walls) | C = cols 0-1 only (left wall)
 */

function createPathBuilder(startDir: number) {
  const actions: SimpleAction[] = [];
  const s = { dir: startDir };
  const face = (target: number) => {
    const diff = (target - s.dir + 4) % 4;
    if (diff === 1) { actions.push("TURN_RIGHT"); s.dir = target; }
    else if (diff === 3) { actions.push("TURN_LEFT"); s.dir = target; }
    else if (diff === 2) { actions.push("TURN_RIGHT"); actions.push("TURN_RIGHT"); s.dir = target; }
  };
  const go = (target: number, n: number) => {
    face(target);
    for (let i = 0; i < n; i++) actions.push("FORWARD");
  };
  return { actions, go };
}

// Shared path fragments (relative moves, all use `go`)
const topBarFromLeft = (go: (d: number, n: number) => void) => {
  go(UP, 1);       // →(0,1)
  go(RIGHT, 7);    // →(7,1)
  go(LEFT, 1);     // →(6,1) re-paint
  go(UP, 1);       // →(6,0)
  go(LEFT, 5);     // →(1,0)
};

const topBarFromRight = (go: (d: number, n: number) => void) => {
  go(UP, 1);       // →(7,1)
  go(LEFT, 7);     // →(0,1)
  go(RIGHT, 1);    // →(1,1) re-paint
  go(UP, 1);       // →(1,0)
  go(RIGHT, 5);    // →(6,0)
};

const bottomBar = (go: (d: number, n: number) => void) => {
  go(DOWN, 1);     // →(0,10)
  go(RIGHT, 7);    // →(7,10)
  go(LEFT, 1);     // →(6,10) re-paint
  go(DOWN, 1);     // →(6,11)
  go(LEFT, 5);     // →(1,11)
};

const leftWallDown = (go: (d: number, n: number) => void) => {
  for (let row = 2; row <= 9; row++) {
    go(row % 2 === 0 ? RIGHT : LEFT, 1);
    if (row < 9) go(DOWN, 1);
  }
  // ends at (0,9)
};

const leftWallUp = (go: (d: number, n: number) => void) => {
  for (let i = 0; i < 8; i++) {
    go(i % 2 === 0 ? RIGHT : LEFT, 1);
    if (i < 7) go(UP, 1);
  }
  // ends at (0,2)
};

/**
 * O: Start at right wall bottom → UP right wall → top bar → DOWN left wall → bottom bar
 * (clockwise from bottom-right)
 */
function generateO(ox: number, oy: number): PlayerConfig {
  const { actions, go } = createPathBuilder(UP);

  // Right wall UP (rows 9→2)
  for (let i = 0; i < 8; i++) {
    go(i % 2 === 0 ? LEFT : RIGHT, 1);
    if (i < 7) go(UP, 1);
  }
  // at (7,2)

  // Top bar (from right side)
  topBarFromRight(go);
  // at (6,0)

  // Transition to left wall
  go(DOWN, 1); go(LEFT, 6); go(DOWN, 1); // →(0,2)

  // Left wall DOWN
  leftWallDown(go);
  // at (0,9)

  // Bottom bar
  bottomBar(go);

  return { startX: ox + 7, startY: oy + 9, startDir: UP, actions };
}

/**
 * C1: Start at bottom-right → LEFT along bottom → UP left wall → top bar RIGHT
 * (counter-clockwise from bottom-right)
 */
function generateC_bottomUp(ox: number, oy: number): PlayerConfig {
  const { actions, go } = createPathBuilder(LEFT);

  // Bottom bar (right→left)
  go(LEFT, 7);     // →(0,10)
  go(RIGHT, 1);    // →(1,10) re-paint
  go(DOWN, 1);     // →(1,11)
  go(RIGHT, 5);    // →(6,11)

  // Return to left wall
  go(LEFT, 5); go(UP, 1); go(LEFT, 1); // →(0,10) re-paint
  go(UP, 1);       // →(0,9)

  // Left wall UP (rows 9→2)
  leftWallUp(go);
  // at (0,2)

  // Top bar (from left side)
  topBarFromLeft(go);

  return { startX: ox + 7, startY: oy + 10, startDir: LEFT, actions };
}

/**
 * C2: Start at left wall middle → UP to top bar → back DOWN through start → bottom bar
 * (middle-outward spiral)
 */
function generateC_middleOut(ox: number, oy: number): PlayerConfig {
  const { actions, go } = createPathBuilder(UP);

  // Left wall upper half UP (rows 5→2, serpentine)
  go(UP, 1);                               // →(1,4)
  go(LEFT, 1); go(UP, 1);                  // →(0,3)
  go(RIGHT, 1); go(UP, 1);                 // →(1,2)
  go(LEFT, 1);                             // →(0,2)

  // Top bar (from left side)
  topBarFromLeft(go);
  // at (1,0)

  // Return down through left wall back to start
  go(DOWN, 1); go(LEFT, 1);                // →(0,1) re-paint
  go(DOWN, 1); go(RIGHT, 1); go(DOWN, 1);  // →(1,3) re-paint
  go(LEFT, 1); go(DOWN, 1);                // →(0,4) re-paint
  go(RIGHT, 1); go(DOWN, 1);               // →(1,5) back at start

  // Left wall lower half DOWN (rows 5→9, serpentine from col 1)
  go(LEFT, 1); go(DOWN, 1);                // →(0,6)
  go(RIGHT, 1); go(DOWN, 1);               // →(1,7)
  go(LEFT, 1); go(DOWN, 1);                // →(0,8)
  go(RIGHT, 1); go(DOWN, 1);               // →(1,9)
  go(LEFT, 1);                             // →(0,9)

  // Bottom bar
  bottomBar(go);

  return { startX: ox + 1, startY: oy + 5, startDir: UP, actions };
}

export function generateDemoPlayers(): PlayerConfig[] {
  return [
    generateO(5, 4),
    generateC_bottomUp(16, 4),
    generateC_middleOut(27, 4),
  ];
}

// Simulate all players → combined painted cells + per-player paths
export function simulateAll(players: PlayerConfig[]): {
  cells: Record<string, CellData>;
  paths: PathStep[][];
} {
  const cells: Record<string, CellData> = {};
  const paths: PathStep[][] = [];

  const paint = (px: number, py: number) => {
    const key = `${px},${py}`;
    const existing = cells[key];
    if (existing) {
      existing.level = Math.min(existing.level + 1, MAX_LEVEL);
    } else {
      cells[key] = { level: 1 };
    }
  };

  for (const player of players) {
    const path: PathStep[] = [];
    let x = player.startX, y = player.startY, dir = player.startDir;

    paint(x, y);
    path.push({ x, y, dir });

    for (const action of player.actions) {
      if (action === "TURN_RIGHT") dir = (dir + 1) % 4;
      else if (action === "TURN_LEFT") dir = (dir + 3) % 4;
      else if (action === "FORWARD") {
        x += DX[dir]; y += DY[dir];
        paint(x, y);
      } else if (action === "BACK") {
        const bd = (dir + 2) % 4;
        x += DX[bd]; y += DY[bd];
        paint(x, y);
      }
      path.push({ x, y, dir });
    }

    paths.push(path);
  }

  return { cells, paths };
}

export function getCellDisplayColor(level: number): string {
  return PEN_COLOR;
}

export const GRID_WIDTH = WIDTH;
export const GRID_HEIGHT = HEIGHT;
export const PEN = PEN_COLOR;

// --- Single-player API used by DemoCanvas ---

// All grid cells are valid paint targets
export const TARGET_CELLS: Set<string> = (() => {
  const set = new Set<string>();
  for (let y = 0; y < HEIGHT; y++)
    for (let x = 0; x < WIDTH; x++)
      set.add(`${x},${y}`);
  return set;
})();

// Flat action list from all demo players concatenated
export function generateDemoActions(): SimpleAction[] {
  return generateDemoPlayers().flatMap((p) => p.actions);
}

// Simulate a single player starting at canvas center
export function simulate(actions: SimpleAction[]): {
  cells: Record<string, CellData>;
  path: PathStep[];
} {
  const x0 = Math.floor(WIDTH / 2);
  const y0 = Math.floor(HEIGHT / 2);
  const cells: Record<string, CellData> = {};
  const path: PathStep[] = [];
  let x = x0, y = y0, dir = 0;

  const paint = (px: number, py: number) => {
    const key = `${px},${py}`;
    const ex = cells[key];
    cells[key] = ex ? { level: Math.min(ex.level + 1, MAX_LEVEL) } : { level: 1 };
  };

  paint(x, y);
  path.push({ x, y, dir });

  for (const action of actions) {
    if (action === "TURN_RIGHT") {
      dir = (dir + 1) % 4;
    } else if (action === "TURN_LEFT") {
      dir = (dir + 3) % 4;
    } else if (action === "FORWARD") {
      x = ((x + DX[dir]) % WIDTH + WIDTH) % WIDTH;
      y = ((y + DY[dir]) % HEIGHT + HEIGHT) % HEIGHT;
      paint(x, y);
    } else if (action === "BACK") {
      const bd = (dir + 2) % 4;
      x = ((x + DX[bd]) % WIDTH + WIDTH) % WIDTH;
      y = ((y + DY[bd]) % HEIGHT + HEIGHT) % HEIGHT;
      paint(x, y);
    }
    path.push({ x, y, dir });
  }

  return { cells, path };
}
