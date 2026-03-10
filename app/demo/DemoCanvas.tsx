"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  generateDemoPlayers,
  simulateAll,
  getCellDisplayColor,
  GRID_WIDTH,
  GRID_HEIGHT,
  type CellData,
  type PathStep,
} from "./art";
import Link from "next/link";

const CELL_SIZE = 12;
const CANVAS_W = GRID_WIDTH * CELL_SIZE;
const CANVAS_H = GRID_HEIGHT * CELL_SIZE;

const PLAYER_COLORS = ["#3B82F6", "#10B981", "#F59E0B"];

export default function DemoCanvas() {
  const { players, finalCells, paths } = useMemo(() => {
    const players = generateDemoPlayers();
    const { cells, paths } = simulateAll(players);
    return { players, finalCells: cells, paths };
  }, []);

  const maxActions = Math.max(...players.map((p) => p.actions.length));

  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(5);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const runningRef = useRef(false);
  const cellsRef = useRef<Record<string, CellData>>({});

  const drawFrame = useCallback(
    (currentCells: Record<string, CellData>, playerPositions: PathStep[]) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      ctx.fillStyle = "#fafaf9";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

      for (const key in currentCells) {
        const [sx, sy] = key.split(",");
        const x = parseInt(sx);
        const y = parseInt(sy);
        ctx.fillStyle = getCellDisplayColor(currentCells[key].level);
        ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
      }

      ctx.strokeStyle = "rgba(0,0,0,0.03)";
      ctx.lineWidth = 0.5;
      for (let i = 0; i <= GRID_WIDTH; i += 5) {
        ctx.beginPath();
        ctx.moveTo(i * CELL_SIZE, 0);
        ctx.lineTo(i * CELL_SIZE, CANVAS_H);
        ctx.stroke();
      }
      for (let i = 0; i <= GRID_HEIGHT; i += 5) {
        ctx.beginPath();
        ctx.moveTo(0, i * CELL_SIZE);
        ctx.lineTo(CANVAS_W, i * CELL_SIZE);
        ctx.stroke();
      }

      playerPositions.forEach((pos, i) => {
        const px = pos.x * CELL_SIZE + CELL_SIZE / 2;
        const py = pos.y * CELL_SIZE + CELL_SIZE / 2;
        ctx.fillStyle = PLAYER_COLORS[i % PLAYER_COLORS.length];
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    },
    []
  );

  useEffect(() => {
    cellsRef.current = {};
    const initPos = players.map((p) => ({
      x: p.startX,
      y: p.startY,
      dir: p.startDir,
    }));
    drawFrame({}, initPos);
  }, [drawFrame, players]);

  const play = useCallback(() => {
    if (isPlaying) return;
    setIsPlaying(true);
    runningRef.current = true;

    const currentCells: Record<string, CellData> = {};
    cellsRef.current = currentCells;

    const DX = [0, 1, 0, -1];
    const DY = [-1, 0, 1, 0];

    const states = players.map((p) => ({
      x: p.startX,
      y: p.startY,
      dir: p.startDir,
      step: 0,
    }));

    const paint = (px: number, py: number) => {
      const key = `${px},${py}`;
      const existing = currentCells[key];
      if (existing) {
        existing.level = Math.min(existing.level + 1, 8);
      } else {
        currentCells[key] = { level: 1 };
      }
    };

    states.forEach((s) => paint(s.x, s.y));

    let globalStep = 0;

    const frame = () => {
      if (!runningRef.current) {
        setIsPlaying(false);
        return;
      }

      for (let s = 0; s < speed; s++) {
        let anyActive = false;
        for (let pi = 0; pi < players.length; pi++) {
          const st = states[pi];
          const acts = players[pi].actions;
          if (st.step >= acts.length) continue;
          anyActive = true;

          const action = acts[st.step];
          if (action === "TURN_RIGHT") {
            st.dir = (st.dir + 1) % 4;
          } else if (action === "TURN_LEFT") {
            st.dir = (st.dir + 3) % 4;
          } else if (action === "FORWARD") {
            st.x += DX[st.dir];
            st.y += DY[st.dir];
            paint(st.x, st.y);
          } else if (action === "BACK") {
            const bd = (st.dir + 2) % 4;
            st.x += DX[bd];
            st.y += DY[bd];
            paint(st.x, st.y);
          }
          st.step++;
        }
        if (!anyActive) break;
        globalStep++;
      }

      setStepIndex(globalStep);
      const positions = states.map((s) => ({ x: s.x, y: s.y, dir: s.dir }));
      drawFrame(currentCells, positions);

      const allDone = states.every(
        (s, i) => s.step >= players[i].actions.length
      );
      if (allDone) {
        setIsPlaying(false);
        runningRef.current = false;
        return;
      }

      requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);
  }, [isPlaying, players, speed, drawFrame]);

  const showFinal = useCallback(() => {
    runningRef.current = false;
    setIsPlaying(false);
    cellsRef.current = { ...finalCells };
    setStepIndex(maxActions);
    const lastPositions = paths.map((p) => p[p.length - 1]);
    drawFrame(finalCells, lastPositions);
  }, [finalCells, paths, maxActions, drawFrame]);

  const reset = useCallback(() => {
    runningRef.current = false;
    setIsPlaying(false);
    setStepIndex(0);
    cellsRef.current = {};
    const initPos = players.map((p) => ({
      x: p.startX,
      y: p.startY,
      dir: p.startDir,
    }));
    drawFrame({}, initPos);
  }, [drawFrame, players]);

  const progress =
    maxActions > 0 ? Math.min(100, Math.round((stepIndex / maxActions) * 100)) : 0;
  const paintedCount = Object.keys(cellsRef.current).length;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="px-3 py-1.5 rounded-lg border border-stone-600 text-stone-400 hover:text-stone-200 hover:border-stone-400 transition-colors text-sm"
        >
          &larr; Back
        </Link>
        <h1 className="text-xl font-bold text-stone-100">STEM Quest - Demo</h1>
      </div>

      {/* 3-column layout */}
      <div className="flex gap-4 items-start">
        {/* Left panel: Controls */}
        <div className="flex flex-col gap-3 w-48 shrink-0">
          <div className="bg-stone-800 rounded-xl p-4 border border-stone-700">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">Controls</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={play}
                disabled={isPlaying}
                className={`w-full px-4 py-2 rounded-lg font-bold text-white shadow-md transition-colors ${
                  isPlaying
                    ? "bg-stone-600 cursor-not-allowed"
                    : "bg-orange-500 hover:bg-orange-600"
                }`}
              >
                {stepIndex > 0 && !isPlaying ? "Replay" : "Play"}
              </button>
              <button
                onClick={showFinal}
                className="w-full px-4 py-2 rounded-lg font-bold text-white bg-stone-600 hover:bg-stone-500 shadow-md transition-colors"
              >
                Skip
              </button>
              <button
                onClick={reset}
                className="w-full px-4 py-2 rounded-lg font-bold text-stone-300 border border-stone-600 hover:bg-stone-700 shadow-md transition-colors"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="bg-stone-800 rounded-xl p-4 border border-stone-700">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">Speed</p>
            <div className="grid grid-cols-4 gap-1.5">
              {[1, 3, 5, 10].map((s) => (
                <button
                  key={s}
                  onClick={() => setSpeed(s)}
                  className={`px-2 py-1.5 rounded text-xs font-bold transition-colors ${
                    speed === s
                      ? "bg-orange-500 text-white"
                      : "bg-stone-700 text-stone-400 hover:bg-stone-600"
                  }`}
                >
                  x{s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Canvas */}
        <div className="flex flex-col items-center gap-2">
          <div className="relative border-2 border-stone-600 shadow-2xl bg-stone-800 rounded-lg overflow-hidden">
            <canvas
              ref={canvasRef}
              width={CANVAS_W}
              height={CANVAS_H}
              style={{ width: CANVAS_W, height: CANVAS_H }}
            />
          </div>
          {/* Progress bar */}
          <div className="w-full h-1.5 bg-stone-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-orange-500 transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        {/* Right panel: Stats */}
        <div className="flex flex-col gap-3 w-48 shrink-0">
          <div className="bg-stone-800 rounded-xl p-4 border border-stone-700">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">Status</p>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-stone-500">Step</span>
                <span className="text-stone-300 font-mono">{stepIndex} / {maxActions}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Painted</span>
                <span className="text-stone-300 font-mono">{paintedCount} cells</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Players</span>
                <span className="text-stone-300 font-mono">{players.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Canvas</span>
                <span className="text-stone-300 font-mono">{GRID_WIDTH}x{GRID_HEIGHT}</span>
              </div>
            </div>
          </div>

          <div className="bg-stone-800 rounded-xl p-4 border border-stone-700">
            <p className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-3">Players</p>
            <div className="flex flex-col gap-1.5 text-xs">
              {players.map((p, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full inline-block"
                    style={{ backgroundColor: PLAYER_COLORS[i] }}
                  />
                  <span className="text-stone-400">
                    {i === 0 ? "O" : `C${i}`} ({p.startX},{p.startY})
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
