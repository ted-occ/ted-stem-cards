import * as THREE from "three";

export const CELL_SIZE = 1.2;
export const BALL_RADIUS = 0.4;

export const COLOR_PRESETS = [
  "#ff0000", "#ff8800", "#ffcc00", "#00cc00", "#0088ff",
  "#4488ff", "#8844ff", "#ff44aa", "#ffffff", "#000000",
];

export interface PatternConfig {
  pattern: number;
  color1: string;
  color2: string;
  scale: number;
}

export function makeShaderMaterial(config: PatternConfig) {
  const fragmentShaders: Record<number, string> = {
    0: `
      uniform vec3 color1;
      uniform vec3 color2;
      uniform float scale;
      varying vec3 vPosition;
      void main() {
        float stripe = step(0.0, sin(vPosition.y * scale));
        float lng = atan(vPosition.z, vPosition.x);
        float stripeV = step(0.0, sin(lng * scale * 0.5));
        float pattern = mod(stripe + stripeV, 2.0);
        vec3 color = mix(color1, color2, pattern);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
    1: `
      uniform vec3 color1;
      uniform vec3 color2;
      uniform float scale;
      varying vec3 vPosition;
      void main() {
        float stripe = smoothstep(0.45, 0.55, fract(vPosition.y * scale));
        vec3 color = mix(color1, color2, stripe);
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  };

  return new THREE.ShaderMaterial({
    uniforms: {
      color1: { value: new THREE.Color(config.color1) },
      color2: { value: new THREE.Color(config.color2) },
      scale: { value: config.scale },
    },
    vertexShader: `
      varying vec3 vPosition;
      void main() {
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: fragmentShaders[config.pattern],
  });
}

export const CAMERA_3D = {
  pos: [0, 3, 6] as const,
  lookAt: [0, 0, 0] as const,
  up: [0, 1, 0] as const,
};
export const CAMERA_2D = {
  pos: [0, 7, 0] as const,
  lookAt: [0, 0, 0] as const,
  up: [0, 0, -1] as const,
};

export const NFC_DIRECTIONS = ["UP", "DOWN", "LEFT", "RIGHT", "JUMP", "X2", "X3", "BRANCH"] as const;
export const NFC_ICONS: Record<string, string> = { UP: "⬆", DOWN: "⬇", LEFT: "⬅", RIGHT: "➡", JUMP: "⤴", X2: "×2", X3: "×3", BRANCH: "❓", PIPE: "|", SLASH: "/" };

/** Check if a direction is horizontal (LEFT or RIGHT) */
export function isHorizontalDir(dir: string): boolean {
  return dir === "LEFT" || dir === "RIGHT";
}

export function moveGrid(
  prev: { col: number; row: number },
  direction: string,
  gridSize: number = 3,
  obstacles: { col: number; row: number }[] = [],
): { col: number; row: number } | null {
  const maxIdx = gridSize - 1;
  let { col, row } = prev;
  switch (direction) {
    case "UP":
      row = Math.max(0, row - 1);
      break;
    case "DOWN":
      row = Math.min(maxIdx, row + 1);
      break;
    case "LEFT":
      col = Math.max(0, col - 1);
      break;
    case "RIGHT":
      col = Math.min(maxIdx, col + 1);
      break;
    default:
      return null;
  }
  if (col === prev.col && row === prev.row) return null;
  if (obstacles.some((o) => o.col === col && o.row === row)) return null;
  return { col, row };
}

/** Generate a random path from start to goal on the 3x3 grid.
 *  Sometimes takes detours to make it more interesting. */
export function generateRandomPath(
  start: { col: number; row: number },
  goal: { col: number; row: number },
  gridSize: number = 3,
  obstacles: { col: number; row: number }[] = [],
): string[] {
  const DIRS = ["UP", "DOWN", "LEFT", "RIGHT"];
  const path: string[] = [];
  let pos = { ...start };

  // Decide if we add detour steps (50% chance, 1-3 extra moves)
  const detourCount = Math.random() < 0.5 ? 0 : 1 + Math.floor(Math.random() * 3);

  // Add random detour moves first
  for (let i = 0; i < detourCount; i++) {
    const valid = DIRS.filter((d) => {
      const next = moveGrid(pos, d, gridSize, obstacles);
      return next !== null;
    });
    if (valid.length === 0) break;
    const dir = valid[Math.floor(Math.random() * valid.length)];
    path.push(dir);
    pos = moveGrid(pos, dir, gridSize, obstacles)!;
  }

  // Now walk toward the goal (greedy with random axis priority, avoiding obstacles)
  let safety = 40;
  while ((pos.col !== goal.col || pos.row !== goal.row) && safety-- > 0) {
    const candidates: string[] = [];
    if (pos.col < goal.col) candidates.push("RIGHT");
    if (pos.col > goal.col) candidates.push("LEFT");
    if (pos.row < goal.row) candidates.push("DOWN");
    if (pos.row > goal.row) candidates.push("UP");
    // Filter to valid moves (not blocked by obstacles)
    const validCandidates = candidates.filter((d) => moveGrid(pos, d, gridSize, obstacles) !== null);
    if (validCandidates.length > 0) {
      const dir = validCandidates[Math.floor(Math.random() * validCandidates.length)];
      path.push(dir);
      pos = moveGrid(pos, dir, gridSize, obstacles)!;
    } else {
      // All greedy moves blocked — pick any valid move
      const anyValid = DIRS.filter((d) => moveGrid(pos, d, gridSize, obstacles) !== null);
      if (anyValid.length === 0) break;
      const dir = anyValid[Math.floor(Math.random() * anyValid.length)];
      path.push(dir);
      pos = moveGrid(pos, dir, gridSize, obstacles)!;
    }
  }

  // If greedy failed to reach goal, use BFS fallback
  if (pos.col !== goal.col || pos.row !== goal.row) {
    const bfsPath = bfsPath_(start, goal, gridSize, obstacles);
    if (bfsPath) return bfsPath;
  }

  return path;
}

/** BFS to find shortest path avoiding obstacles */
function bfsPath_(
  start: { col: number; row: number },
  goal: { col: number; row: number },
  gridSize: number,
  obstacles: { col: number; row: number }[],
): string[] | null {
  const DIRS = ["UP", "DOWN", "LEFT", "RIGHT"];
  const key = (c: number, r: number) => `${c},${r}`;
  const visited = new Set<string>();
  const queue: { col: number; row: number; path: string[] }[] = [{ ...start, path: [] }];
  visited.add(key(start.col, start.row));

  while (queue.length > 0) {
    const cur = queue.shift()!;
    for (const dir of DIRS) {
      const next = moveGrid(cur, dir, gridSize, obstacles);
      if (!next) continue;
      const k = key(next.col, next.row);
      if (visited.has(k)) continue;
      visited.add(k);
      const newPath = [...cur.path, dir];
      if (next.col === goal.col && next.row === goal.row) return newPath;
      queue.push({ col: next.col, row: next.row, path: newPath });
    }
  }
  return null;
}

/** Find the index of the matching SLASH for a BRANCH token at branchIndex.
 *  Handles nested BRANCH/SLASH pairs via depth tracking.
 *  Returns tokens.length if no matching SLASH is found. */
export function findMatchingSlash(tokens: string[], branchIndex: number): number {
  let depth = 0;
  let j = branchIndex + 1;
  while (j < tokens.length) {
    if (tokens[j] === "BRANCH") depth++;
    if (tokens[j] === "SLASH") {
      if (depth === 0) return j;
      depth--;
    }
    j++;
  }
  return tokens.length;
}

/** Split a P-block (BRANCH...PIPE...SLASH) into if/else bodies.
 *  Returns the two body arrays and the index of the closing SLASH. */
export function splitPBlock(tokens: string[], branchIndex: number): { ifBody: string[]; elseBody: string[]; endIndex: number } {
  const endIndex = findMatchingSlash(tokens, branchIndex);
  const blockContent = tokens.slice(branchIndex + 1, endIndex);
  const pipePos = blockContent.indexOf("PIPE");
  const ifBody = pipePos >= 0 ? blockContent.slice(0, pipePos) : blockContent;
  const elseBody = pipePos >= 0 ? blockContent.slice(pipePos + 1) : [];
  return { ifBody, elseBody, endIndex };
}

const DIRECTION_CHARS: Record<string, string> = { UP: "U", DOWN: "D", LEFT: "L", RIGHT: "R", JUMP: "J", X2: "2", X3: "3", BRANCH: "B", PIPE: "E", SLASH: "F" };
const CHAR_DIRECTIONS: Record<string, string> = { U: "UP", D: "DOWN", L: "LEFT", R: "RIGHT", J: "JUMP", "2": "X2", "3": "X3", B: "BRANCH", E: "PIPE", F: "SLASH" };

export function encodeProgram(steps: string[]): string {
  return steps.map((s) => DIRECTION_CHARS[s] || "").join("");
}

export function decodeProgram(encoded: string): string[] {
  return encoded.split("").map((c) => CHAR_DIRECTIONS[c]).filter(Boolean);
}

/** Expand x2/x3 loop cards in a program.
 *  x2 = repeat previous command 2 times total, x3 = 3 times total.
 *  Consecutive loops add: → x2 x2 = 4, → x2 x3 = 5 */
export function expandProgram(steps: string[]): string[] {
  return expandProgramWithMap(steps).expanded;
}

export function expandProgramWithMap(steps: string[]): { expanded: string[]; indexMap: number[] } {
  const expanded: string[] = [];
  const indexMap: number[] = [];

  let baseCommand: string | null = null;
  let baseIndex = -1;
  let totalRepeat = 0;

  const flush = () => {
    if (baseCommand && totalRepeat > 0) {
      // Remove the 1 already pushed for the base command
      expanded.pop();
      indexMap.pop();
      for (let r = 0; r < totalRepeat; r++) {
        expanded.push(baseCommand!);
        indexMap.push(baseIndex);
      }
    }
    baseCommand = null;
    totalRepeat = 0;
  };

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (s === "X2" || s === "X3") {
      const n = s === "X2" ? 2 : 3;
      if (baseCommand === null) {
        continue;
      }
      if (totalRepeat === 0) {
        totalRepeat = n;
      } else {
        totalRepeat += n;
      }
      baseIndex = i;
    } else if (s === "BRANCH") {
      // P-block: flush any pending repeat, then copy the entire P-block as-is
      // (with internal X2/X3 expanded within each body)
      flush();
      // The direction before P was already pushed; keep it.
      // Push P token
      expanded.push("BRANCH");
      indexMap.push(i);
      // Extract if-body and else-body, expand X2/X3 within each
      const { ifBody: ifRaw, elseBody: elseRaw, endIndex: j } = splitPBlock(steps, i);
      const ifExpanded = expandProgramWithMap(ifRaw);
      const elseExpanded = expandProgramWithMap(elseRaw);
      // Push expanded if-body (map to original source indices)
      const ifBaseIdx = i + 1;
      for (let k = 0; k < ifExpanded.expanded.length; k++) {
        expanded.push(ifExpanded.expanded[k]);
        indexMap.push(ifBaseIdx + ifExpanded.indexMap[k]);
      }
      // Push PIPE (at its original position in source)
      const pipeSourceIdx = i + 1 + ifRaw.length;
      expanded.push("PIPE");
      indexMap.push(pipeSourceIdx);
      // Push expanded else-body (map to original source indices)
      const elseBaseIdx = pipeSourceIdx + 1;
      for (let k = 0; k < elseExpanded.expanded.length; k++) {
        expanded.push(elseExpanded.expanded[k]);
        indexMap.push(elseBaseIdx + elseExpanded.indexMap[k]);
      }
      // Push SLASH
      expanded.push("SLASH");
      indexMap.push(j);
      // Skip past the block in the source
      i = j; // the for loop will i++ past SLASH
    } else if (s === "PIPE" || s === "SLASH") {
      // These are handled by the P-block parser above; skip if encountered at top level
      flush();
    } else {
      flush();
      baseCommand = s;
      baseIndex = i;
      totalRepeat = 0;
      expanded.push(s);
      indexMap.push(i);
    }
  }
  flush();

  return { expanded, indexMap };
}

/** Grouped display of program steps: loop cards merged into the preceding direction */
export interface PBlock {
  ifLabel: string;
  elseLabel: string;
  ifSteps: DisplayStep[];
  elseSteps: DisplayStep[];
}

export interface DisplayStep {
  dir: string;
  repeat: number;
  rawIndices: number[];
  pBlock?: PBlock;
}

/** Get the if/else labels for a P-block based on the direction card it's attached to */
function pBlockLabels(dir: string): { ifLabel: string; elseLabel: string } {
  return isHorizontalDir(dir)
    ? { ifLabel: "UP", elseLabel: "DOWN" }
    : { ifLabel: "RIGHT", elseLabel: "LEFT" };
}

export function groupProgramForDisplay(program: string[], baseIndex = 0): DisplayStep[] {
  const groups: DisplayStep[] = [];
  for (let i = 0; i < program.length; i++) {
    const s = program[i];
    if (s === "X2" || s === "X3") {
      if (groups.length === 0) continue;
      const last = groups[groups.length - 1];
      const n = s === "X2" ? 2 : 3;
      last.repeat = last.repeat === 1 ? n : last.repeat + n;
      last.rawIndices.push(baseIndex + i);
    } else if (s === "BRANCH") {
      if (groups.length === 0) continue;
      const last = groups[groups.length - 1];
      last.rawIndices.push(baseIndex + i);
      // Find matching SLASH and split into if/else bodies
      const { ifBody: ifRaw, elseBody: elseRaw, endIndex: j } = splitPBlock(program, i);
      const labels = pBlockLabels(last.dir);
      const ifBaseIdx = baseIndex + i + 1;
      const elseBaseIdx = ifBaseIdx + ifRaw.length + 1; // +1 for PIPE
      last.pBlock = {
        ...labels,
        ifSteps: groupProgramForDisplay(ifRaw, ifBaseIdx),
        elseSteps: groupProgramForDisplay(elseRaw, elseBaseIdx),
      };
      // Collect all raw indices in the block
      for (let k = i + 1; k <= j; k++) last.rawIndices.push(baseIndex + k);
      i = j; // skip past SLASH
    } else if (s === "PIPE" || s === "SLASH") {
      // structural tokens — skip at top level
    } else {
      groups.push({ dir: s, repeat: 1, rawIndices: [baseIndex + i] });
    }
  }
  return groups;
}

export function displayStepsToFlat(groups: DisplayStep[]): string[] {
  const result: string[] = [];
  for (const { dir, repeat, pBlock } of groups) {
    result.push(dir);
    if (repeat > 1) {
      let r = repeat;
      if (r % 3 === 1 && r >= 4) { result.push("X2"); r -= 2; }
      while (r >= 3) { result.push("X3"); r -= 3; }
      while (r >= 2) { result.push("X2"); r -= 2; }
    }
    if (pBlock) {
      result.push("BRANCH");
      result.push(...displayStepsToFlat(pBlock.ifSteps));
      result.push("PIPE");
      result.push(...displayStepsToFlat(pBlock.elseSteps));
      result.push("SLASH");
    }
  }
  return result;
}
