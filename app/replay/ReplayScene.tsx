"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import {
  PatternConfig,
  NFC_ICONS,
} from "@/lib/ball-shared";
import { GridPos, BranchCell } from "@/lib/levels";
import { SceneLighting, CameraController, Board, Ground, Sphere, CellMarker, TextSprite, ObstacleMarker, BranchMarker } from "@/app/components/Scene";
import { playSuccess } from "@/lib/sounds";
import { useProgramRunner } from "@/lib/useProgramRunner";

interface LevelInfo {
  start: { col: number; row: number };
  goal: { col: number; row: number };
  challenge?: number;
}

interface ReplaySceneProps {
  steps: string[];
  color1?: string;
  color2?: string;
  scale?: number;
  pattern?: number;
  createdAt?: number;
  gridSize?: number;
  obstacles?: GridPos[];
  branchCells?: BranchCell[];
  levelInfo?: LevelInfo;
}

export default function ReplayScene({ steps, color1, color2, scale, pattern, createdAt, gridSize: gridSizeProp, obstacles = [], branchCells = [], levelInfo }: ReplaySceneProps) {
  const gridSize = gridSizeProp ?? 3;
  const startPos = levelInfo ? levelInfo.start : { col: 1, row: 1 };
  const runner = useProgramRunner();
  const { gridPos, jumping, progIndex, handleAnimDone, handleJumpDone } = runner;
  const [levelCleared, setLevelCleared] = useState(false);
  const [is2D, setIs2D] = useState(false);
  const [finished, setFinished] = useState(false);
  const stepsRef = useRef<HTMLDivElement>(null);

  const patternConfig: PatternConfig = {
    pattern: pattern ?? 0,
    color1: color1 || "#4488ff",
    color2: color2 || "#ffffff",
    scale: scale ?? 20,
  };

  // Auto-scroll to highlighted step
  useEffect(() => {
    if (progIndex < 0 || !stepsRef.current) return;
    const el = stepsRef.current.children[progIndex] as HTMLElement | undefined;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [progIndex]);

  const runProgram = useCallback(async (reverseBranch: boolean = false) => {
    setFinished(false);
    setLevelCleared(false);

    const isPassthrough = levelInfo
      ? (pos: { col: number; row: number }, i: number, total: number) =>
          i < total - 1 && pos.col === levelInfo.goal.col && pos.row === levelInfo.goal.row
      : undefined;

    const { finalPos, passedGoal } = await runner.runSteps({
      steps,
      startPos,
      gridSize,
      obstacles,
      branchCells,
      isPassthrough,
      reverseBranch,
    });

    setFinished(true);
    if (levelInfo && !passedGoal &&
        finalPos.col === levelInfo.goal.col && finalPos.row === levelInfo.goal.row) {
      setLevelCleared(true);
    }
    playSuccess();
  }, [steps, startPos, levelInfo, gridSize, obstacles, branchCells, runner]);

  // Auto-play on mount
  useEffect(() => {
    const timer = setTimeout(() => runProgram(false), 500);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasBranch = steps.includes("BRANCH");

  return (
    <div className="relative h-screen w-screen">
      {/* Program steps bar — bottom */}
      <div className="absolute bottom-0 left-0 right-0 z-10 bg-black/60 backdrop-blur">
        <div
          ref={stepsRef}
          className="flex items-center justify-center gap-1 px-3 py-2 overflow-x-auto"
        >
          {steps.map((dir, i) => {
            // Skip structural P-block tokens
            if (dir === "PIPE" || dir === "SLASH") return null;
            const icon = NFC_ICONS[dir];
            if (!icon) return null;
            return (
              <div
                key={i}
                className={`flex-shrink-0 flex items-center justify-center w-10 h-10 rounded-lg text-lg font-medium transition ${
                  progIndex === i
                    ? "bg-yellow-300 scale-110"
                    : finished
                      ? "bg-white/20 text-white/60"
                      : "bg-white/10 text-white/40"
                }`}
              >
                {icon}
              </div>
            );
          })}
        </div>

        {/* Step count + level info */}
        <div className="text-center pb-2">
          {levelInfo ? (
            <div className="flex flex-col items-center gap-0.5">
              {levelInfo.challenge != null && (
                <span className="text-sm font-bold text-yellow-300">
                  {progIndex >= 0 ? progIndex + 1 : (finished ? steps.length : 0)} / {levelInfo.challenge}
                </span>
              )}
              <span className="text-xs text-yellow-300/70">
                {levelInfo.challenge != null
                  ? `${levelInfo.challenge} moves${obstacles.length > 0 ? ", avoid obstacles!" : " to the Goal!"}`
                  : (obstacles.length > 0 ? "Avoid obstacles!" : "Reach the Goal!")}
                {levelCleared && " ✓"}
              </span>
            </div>
          ) : (
            <span className="text-xs text-white/40">{steps.length} steps</span>
          )}
        </div>
      </div>

      {/* Top bar — created date (left) + replay button (center) */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center">
        {/* Created date */}
        <div className="text-xs text-white/50">
          {createdAt ? (() => {
            const d = new Date(createdAt);
            const pad = (n: number) => String(n).padStart(2, "0");
            return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
          })() : ""}
        </div>

        {/* Replay button — centered */}
        <div className="flex-1 flex justify-center gap-2">
          {finished && (
            <>
              <button
                onClick={() => runProgram(false)}
                className="rounded-xl bg-white/95 px-6 py-3 text-base font-bold text-black shadow-xl backdrop-blur border border-gray-200 transition hover:bg-white hover:scale-105"
              >
                Replay
              </button>
              {hasBranch && (
                <button
                  onClick={() => runProgram(true)}
                  title="Reverse branch"
                  className="rounded-xl bg-purple-500/95 px-6 py-3 text-base font-bold text-white shadow-xl backdrop-blur border border-purple-400 transition hover:bg-purple-500 hover:scale-105 flex items-center gap-2"
                >
                  <span>?</span>
                  <span>⇄</span>
                </button>
              )}
            </>
          )}
        </div>

        {/* 3D/2D toggle */}
        <button
          onClick={() => setIs2D((v) => !v)}
          className="rounded-lg bg-white/95 px-3 py-2 text-sm font-medium text-black shadow-md backdrop-blur border border-gray-200 transition hover:bg-white"
        >
          {is2D ? "3D" : "2D"}
        </button>
      </div>

      <Canvas camera={{ position: [0, 5, 5], fov: 45 }} gl={{ antialias: true }} shadows>
        <SceneLighting gridSize={gridSize} />
        <CameraController is2D={is2D} gridSize={gridSize} />
        <Ground />
        <Board gridSize={gridSize} />
        {levelInfo && (
          <>
            <CellMarker col={levelInfo.start.col} row={levelInfo.start.row} color="#44cc44" gridSize={gridSize} />
            <TextSprite col={levelInfo.start.col} row={levelInfo.start.row} text="START" color="#44cc44" gridSize={gridSize} />
            <CellMarker col={levelInfo.goal.col} row={levelInfo.goal.row} color="#ffaa00" gridSize={gridSize} />
            <TextSprite col={levelInfo.goal.col} row={levelInfo.goal.row} text="GOAL" color="#ffaa00" gridSize={gridSize} />
            {obstacles.map((ob, i) => (
              <ObstacleMarker key={`ob-${i}`} col={ob.col} row={ob.row} gridSize={gridSize} />
            ))}
            {branchCells.map((bc, i) => (
              <BranchMarker key={`br-${i}`} branchCell={bc} gridSize={gridSize} />
            ))}
          </>
        )}
        <Sphere
          gridCol={gridPos.col}
          gridRow={gridPos.row}
          jumping={jumping}
          onAnimDone={handleAnimDone}
          onJumpDone={handleJumpDone}
          patternConfig={patternConfig}
          gridSize={gridSize}
        />
      </Canvas>
    </div>
  );
}
