"use client";

import { useRef, useState, useCallback } from "react";
import { moveGrid, expandProgramWithMap, isHorizontalDir } from "@/lib/ball-shared";
import { GridPos, BranchCell, resolveBranchDir } from "@/lib/levels";
import { playMove, playJump, playBranch, playBump } from "@/lib/sounds";

export interface RunConfig {
  steps: string[];
  startPos: GridPos;
  gridSize: number;
  obstacles: GridPos[];
  branchCells?: BranchCell[];
  /** Called on intermediate steps to check if goal was passed through */
  isPassthrough?: (pos: GridPos, stepIndex: number, totalSteps: number) => boolean;
  /** When true, swap if/else branches in BRANCH blocks */
  reverseBranch?: boolean;
  /** Called each time a JUMP action executes (so move counters can update in real time) */
  onJump?: () => void;
}

export interface RunResult {
  finalPos: GridPos;
  passedGoal: boolean;
  burstFromBranch?: boolean;
  branchUsed?: boolean;
  /** Number of JUMP actions executed (not counted via position change) */
  jumpCount?: number;
}

export function useProgramRunner() {
  const [gridPos, setGridPos] = useState<GridPos>({ col: 1, row: 1 });
  const [isAnimating, setIsAnimating] = useState(false);
  const [jumping, setJumping] = useState(false);
  const [progIndex, setProgIndex] = useState(-1);

  const animDoneResolveRef = useRef<(() => void) | null>(null);
  const jumpDoneResolveRef = useRef<(() => void) | null>(null);

  const handleAnimDone = useCallback(() => {
    setIsAnimating(false);
    if (animDoneResolveRef.current) {
      animDoneResolveRef.current();
      animDoneResolveRef.current = null;
    }
  }, []);

  const handleJumpDone = useCallback(() => {
    setJumping(false);
    if (jumpDoneResolveRef.current) {
      jumpDoneResolveRef.current();
      jumpDoneResolveRef.current = null;
    }
  }, []);

  // --- Animation primitives ---

  /** Play jump animation and wait for completion */
  const waitJump = async (sound: () => void = playJump) => {
    setJumping(true);
    sound();
    await new Promise<void>((resolve) => { jumpDoneResolveRef.current = resolve; });
  };

  /** Move ball to a position with animation and wait for completion */
  const waitMove = async (pos: GridPos) => {
    playMove();
    setIsAnimating(true);
    setGridPos(pos);
    await new Promise<void>((resolve) => { animDoneResolveRef.current = resolve; });
  };

  // --- Execution helpers ---

  /** Execute a single direction move with animation. Returns new position. */
  const execMove = async (
    currentPos: GridPos, direction: string, gridSize: number,
    obstacles: GridPos[], isPassthrough: RunConfig["isPassthrough"],
    stepIdx: number, totalSteps: number,
    passedGoalRef: { value: boolean },
  ): Promise<GridPos> => {
    if (direction === "JUMP") {
      await waitJump();
      return currentPos;
    }
    const next = moveGrid(currentPos, direction, gridSize, obstacles);
    if (!next) { playBump(); return currentPos; }
    if (isPassthrough?.(next, stepIdx, totalSteps)) passedGoalRef.value = true;
    await waitMove(next);
    return next;
  };

  /** Execute a sequence of steps (used for BRANCH block bodies). Returns final position. */
  const execBody = async (
    body: string[], startPos: GridPos, gridSize: number,
    obstacles: GridPos[], branchCells: BranchCell[],
    isPassthrough: RunConfig["isPassthrough"],
    progIdx: number, totalSteps: number,
    passedGoalRef: { value: boolean }, branchUsedRef: { value: boolean },
    jumpCountRef: { value: number },
    onJump?: () => void,
    bodyIndexMap?: number[],
  ): Promise<{ pos: GridPos; burstFromBranch?: boolean }> => {
    let pos = startPos;
    for (let si = 0; si < body.length; si++) {
      const step = body[si];
      if (step === "PIPE" || step === "SLASH" || step === "BRANCH") continue;
      if (bodyIndexMap) setProgIndex(bodyIndexMap[si]);
      if (step === "JUMP") { jumpCountRef.value += 1; onJump?.(); }
      pos = await execMove(pos, step, gridSize, obstacles, isPassthrough, progIdx, totalSteps, passedGoalRef);
      await new Promise((r) => setTimeout(r, 200));
      if (step !== "JUMP") {
        // In BRANCH body: landing on "?" without explicit BRANCH card → burst
        if (branchCells.length > 0) {
          const resolved = resolveBranchDir(pos, step, branchCells);
          if (resolved) return { pos, burstFromBranch: true };
        }
      }
    }
    return { pos };
  };

  /** Run program steps with animations. Returns final position and passedGoal flag. */
  const runSteps = useCallback(async (config: RunConfig): Promise<RunResult> => {
    const { steps, startPos, gridSize, obstacles, branchCells = [], isPassthrough, reverseBranch = false, onJump } = config;

    setGridPos(startPos);
    setIsAnimating(false);
    setProgIndex(-1);
    await new Promise((r) => setTimeout(r, 100));

    const { expanded, indexMap } = expandProgramWithMap(steps);

    let currentPos = { ...startPos };
    const passedGoalRef = { value: false };
    const branchUsedRef = { value: false };
    const jumpCountRef = { value: 0 };

    for (let i = 0; i < expanded.length; i++) {
      const token = expanded[i];

      // Skip structural P-block tokens
      if (token === "PIPE" || token === "SLASH") continue;

      setProgIndex(indexMap[i]);

      if (token === "BRANCH") {
        // P-block: find boundaries
        let pipeIdx = i + 1;
        while (pipeIdx < expanded.length && expanded[pipeIdx] !== "PIPE") pipeIdx++;
        let slashIdx = pipeIdx + 1;
        while (slashIdx < expanded.length && expanded[slashIdx] !== "SLASH") slashIdx++;
        const ifBody = expanded.slice(i + 1, pipeIdx);
        const elseBody = expanded.slice(pipeIdx + 1, slashIdx);

        // Check if on a "?" cell
        // Find the direction that moved us here (the step before P in the expanded array)
        let arrivalDir = "";
        for (let k = i - 1; k >= 0; k--) {
          if (["UP", "DOWN", "LEFT", "RIGHT"].includes(expanded[k])) { arrivalDir = expanded[k]; break; }
        }
        const branchResolved = arrivalDir ? resolveBranchDir(currentPos, arrivalDir, branchCells) : null;
        if (branchResolved) {
          branchUsedRef.value = true;
          const opposites: Record<string, string> = { UP: "DOWN", DOWN: "UP", LEFT: "RIGHT", RIGHT: "LEFT" };
          const branchDir = reverseBranch ? opposites[branchResolved.branchDir] : branchResolved.branchDir;
          const isH = isHorizontalDir(arrivalDir);
          // if-block = UP (horizontal arrival) or RIGHT (vertical arrival)
          const isIfBranch = isH ? branchDir === "UP" : branchDir === "RIGHT";
          const chosenBody = isIfBranch ? ifBody : elseBody;

          // Jump-move: jump and move simultaneously
          const branchNext = moveGrid(currentPos, branchDir, gridSize, obstacles);
          if (branchNext) {
            currentPos = branchNext;
            setJumping(true);
            playBranch();
            playMove();
            setIsAnimating(true);
            setGridPos(branchNext);
            await Promise.all([
              new Promise<void>((resolve) => { jumpDoneResolveRef.current = resolve; }),
              new Promise<void>((resolve) => { animDoneResolveRef.current = resolve; }),
            ]);
            await new Promise((r) => setTimeout(r, 200));
          } else {
            await waitJump(playBranch);
            playBump();
          }

          // Execute chosen body from the new position
          // Don't pass isPassthrough — goal reached during BRANCH body
          // may be the final destination, not an intermediate passthrough
          const bodyIndexMap = isIfBranch
            ? indexMap.slice(i + 1, pipeIdx)
            : indexMap.slice(pipeIdx + 1, slashIdx);
          const result = await execBody(
            chosenBody, currentPos, gridSize, obstacles, branchCells,
            undefined, indexMap[i], expanded.length,
            passedGoalRef, branchUsedRef, jumpCountRef, onJump, bodyIndexMap,
          );
          if (result.burstFromBranch) {
            return { finalPos: result.pos, passedGoal: passedGoalRef.value, burstFromBranch: true, branchUsed: branchUsedRef.value, jumpCount: jumpCountRef.value };
          }
          currentPos = result.pos;
        }
        // Skip to after SLASH
        i = slashIdx;
        continue;
      }

      if (token === "JUMP") {
        jumpCountRef.value += 1;
        onJump?.();
        await waitJump();
      } else {
        const next = moveGrid(currentPos, token, gridSize, obstacles);
        if (next) {
          if (isPassthrough?.(next, i, expanded.length)) passedGoalRef.value = true;
          currentPos = next;
          await waitMove(next);

          // Check if landed on "?" cell without a BRANCH card → burst
          let hasBranchAhead = false;
          for (let k = i + 1; k < expanded.length; k++) {
            if (expanded[k] === "BRANCH") { hasBranchAhead = true; break; }
            if (expanded[k] !== token) break;
          }
          if (!hasBranchAhead && branchCells.length > 0) {
            const resolved = resolveBranchDir(currentPos, token, branchCells);
            if (resolved) {
              // Landed on "?" without BRANCH card → execution failure
              return { finalPos: currentPos, passedGoal: passedGoalRef.value, burstFromBranch: true, branchUsed: branchUsedRef.value, jumpCount: jumpCountRef.value };
            }
          }
        }
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    setProgIndex(-1);

    return { finalPos: currentPos, passedGoal: passedGoalRef.value, branchUsed: branchUsedRef.value, jumpCount: jumpCountRef.value };
  }, []);

  /** Trigger a jump and wait for it to complete */
  const triggerJump = useCallback(async () => {
    await waitJump();
  }, []);

  /** Reset highlight index (e.g. when closing programming panel) */
  const resetProgIndex = useCallback(() => setProgIndex(-1), []);

  return {
    gridPos,
    setGridPos,
    isAnimating,
    setIsAnimating,
    jumping,
    setJumping,
    progIndex,
    resetProgIndex,
    handleAnimDone,
    handleJumpDone,
    runSteps,
    triggerJump,
  };
}
