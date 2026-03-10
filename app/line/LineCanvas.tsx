"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";

const CANVAS_W = 600;
const CANVAS_H = 480;
const LINE_WIDTH = 3;
const STEP_SIZE = 3;
const LOOK_AHEAD = 10;
const ROBOT_R = 24;

type Phase = "draw" | "place" | "ready" | "running" | "stopped";

// --- Pixel helpers ---
function isLinePixel(data: Uint8ClampedArray, w: number, h: number, x: number, y: number): boolean {
  const px = Math.round(x);
  const py = Math.round(y);
  if (px < 0 || px >= w || py < 0 || py >= h) return false;
  const idx = (py * w + px) * 4;
  return (data[idx] + data[idx + 1] + data[idx + 2]) / 3 < 128;
}

function hasLineNear(data: Uint8ClampedArray, w: number, h: number, x: number, y: number, r: number = 2): boolean {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (isLinePixel(data, w, h, x + dx, y + dy)) return true;
    }
  }
  return false;
}

function detectAngle(data: Uint8ClampedArray, w: number, h: number, x: number, y: number): number {
  for (let deg = 0; deg < 360; deg += 15) {
    const rad = (deg * Math.PI) / 180;
    if (hasLineNear(data, w, h, x + Math.cos(rad) * LOOK_AHEAD, y + Math.sin(rad) * LOOK_AHEAD, 3)) {
      return rad;
    }
  }
  return 0;
}

// --- Robot drawing ---
function drawRobot(ctx: CanvasRenderingContext2D, x: number, y: number, angle: number, stopped: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = stopped ? "#EF4444" : "#3B82F6";
  ctx.beginPath();
  ctx.arc(0, 0, ROBOT_R, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = stopped ? "#B91C1C" : "#1D4ED8";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "white";
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-6, -12);
  ctx.lineTo(-6, 12);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// --- Line-following step ---
function findNextMove(
  data: Uint8ClampedArray, w: number, h: number,
  x: number, y: number, angle: number, prevX: number, prevY: number
): number | null {
  const deltas = [0, 12, -12, 24, -24, 36, -36, 50, -50, 65, -65, 80, -80, 90, -90];
  // Collect all valid directions
  const candidates: { angle: number; priority: number }[] = [];
  for (let i = 0; i < deltas.length; i++) {
    const a = angle + (deltas[i] * Math.PI) / 180;
    const nx = x + Math.cos(a) * LOOK_AHEAD;
    const ny = y + Math.sin(a) * LOOK_AHEAD;
    if (Math.sqrt((nx - prevX) ** 2 + (ny - prevY) ** 2) < STEP_SIZE) continue;
    if (hasLineNear(data, w, h, nx, ny, 2)) {
      candidates.push({ angle: a, priority: i });
    }
  }
  if (candidates.length === 0) return null;

  // Group into distinct directions (angles within 30° are the same path)
  const groups: { angle: number; priority: number }[][] = [];
  for (const c of candidates) {
    let added = false;
    for (const g of groups) {
      const diff = Math.abs(c.angle - g[0].angle);
      if (diff < (30 * Math.PI) / 180) {
        g.push(c);
        added = true;
        break;
      }
    }
    if (!added) groups.push([c]);
  }

  if (groups.length <= 1) {
    // No fork — pick the best (smallest delta) as before
    return candidates[0].angle;
  }

  // Fork detected — pick a random group, then use its best candidate
  const chosen = groups[Math.floor(Math.random() * groups.length)];
  return chosen[0].angle;
}

export default function LineCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lineDataRef = useRef<ImageData | null>(null);
  const trailRef = useRef<{ x: number; y: number }[]>([]);
  const robotRef = useRef({ x: 0, y: 0, angle: 0, prevX: 0, prevY: 0 });
  const animRef = useRef<number>(0);
  const isDrawingRef = useRef(false);

  const [phase, setPhase] = useState<Phase>("draw");
  const [drawTool, setDrawTool] = useState<"pen" | "eraser">("pen");
  const [speed, setSpeed] = useState(40);
  const [stepCount, setStepCount] = useState(0);
  const [robotPos, setRobotPos] = useState<{ x: number; y: number; angle: number } | null>(null);
  const [noStop, setNoStop] = useState(false);
  const noStopRef = useRef(false);
  const [trailColor, setTrailColor] = useState("#3B82F6");
  const trailColorRef = useRef("#3B82F6");
  const visitCountRef = useRef<Map<string, number>>(new Map());

  useEffect(() => { noStopRef.current = noStop; }, [noStop]);
  useEffect(() => { trailColorRef.current = trailColor; }, [trailColor]);

  // Init canvas
  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }, []);

  // --- Render frame (line image + trail + robot) ---
  const renderFrame = useCallback(
    (stopped = false) => {
      const ctx = canvasRef.current?.getContext("2d");
      if (!ctx || !lineDataRef.current) return;
      ctx.putImageData(lineDataRef.current, 0, 0);

      // Trail with visit-based opacity
      const trail = trailRef.current;
      const visits = visitCountRef.current;
      const color = trailColorRef.current;
      if (trail.length > 1) {
        ctx.lineWidth = 6;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        for (let i = 1; i < trail.length; i++) {
          // Grid key for visit counting (8px buckets)
          const key = `${Math.floor(trail[i].x / 8)},${Math.floor(trail[i].y / 8)}`;
          const count = visits.get(key) || 1;
          const alpha = Math.min(count / 32, 1);
          // Parse hex color to rgb for alpha
          const r2 = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);
          ctx.strokeStyle = `rgba(${r2},${g},${b},${alpha})`;
          ctx.beginPath();
          ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
          ctx.lineTo(trail[i].x, trail[i].y);
          ctx.stroke();
        }
      }

      const r = robotRef.current;
      drawRobot(ctx, r.x, r.y, r.angle, stopped);
    },
    []
  );

  // --- Drawing handlers ---
  const getPos = (e: React.MouseEvent) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (CANVAS_W / rect.width),
      y: (e.clientY - rect.top) * (CANVAS_H / rect.height),
    };
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (phase === "draw") {
      isDrawingRef.current = true;
      const pos = getPos(e);
      const ctx = canvasRef.current!.getContext("2d")!;
      ctx.beginPath();
      ctx.moveTo(pos.x, pos.y);
      ctx.strokeStyle = drawTool === "eraser" ? "white" : "#333";
      ctx.lineWidth = drawTool === "eraser" ? 20 : LINE_WIDTH;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    } else if (phase === "place") {
      placeRobot(e);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (phase !== "draw" || !isDrawingRef.current) return;
    const pos = getPos(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
  };

  const handleMouseUp = () => {
    isDrawingRef.current = false;
  };

  // --- Place robot ---
  const placeRobot = (e: React.MouseEvent) => {
    const pos = getPos(e);
    const ctx = canvasRef.current!.getContext("2d")!;
    const imgData = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);

    if (!hasLineNear(imgData.data, CANVAS_W, CANVAS_H, pos.x, pos.y, 6)) return;

    lineDataRef.current = imgData;
    const angle = detectAngle(imgData.data, CANVAS_W, CANVAS_H, pos.x, pos.y);
    robotRef.current = { x: pos.x, y: pos.y, angle, prevX: pos.x, prevY: pos.y };
    trailRef.current = [{ x: pos.x, y: pos.y }];
    setRobotPos({ x: pos.x, y: pos.y, angle });
    setStepCount(0);
    setPhase("ready");
    // Render robot on canvas
    setTimeout(() => {
      ctx.putImageData(imgData, 0, 0);
      drawRobot(ctx, pos.x, pos.y, angle, false);
    }, 0);
  };

  // --- Run animation ---
  const startRun = useCallback(() => {
    setPhase("running");
  }, []);

  useEffect(() => {
    if (phase !== "running") return;

    let lastTime = 0;

    const animate = (time: number) => {
      if (time - lastTime < speed) {
        animRef.current = requestAnimationFrame(animate);
        return;
      }
      lastTime = time;

      const r = robotRef.current;
      const data = lineDataRef.current!.data;
      const nextAngle = findNextMove(data, CANVAS_W, CANVAS_H, r.x, r.y, r.angle, r.prevX, r.prevY);

      if (nextAngle === null) {
        if (noStopRef.current) {
          // Reverse 180° and continue
          r.angle += Math.PI;
          r.prevX = r.x + Math.cos(r.angle) * -STEP_SIZE;
          r.prevY = r.y + Math.sin(r.angle) * -STEP_SIZE;
          renderFrame(false);
          animRef.current = requestAnimationFrame(animate);
          return;
        }
        renderFrame(true);
        setRobotPos({ x: r.x, y: r.y, angle: r.angle });
        setPhase("stopped");
        return;
      }

      const nx = r.x + Math.cos(nextAngle) * STEP_SIZE;
      const ny = r.y + Math.sin(nextAngle) * STEP_SIZE;
      robotRef.current = { x: nx, y: ny, angle: nextAngle, prevX: r.x, prevY: r.y };
      trailRef.current.push({ x: nx, y: ny });
      // Record visit for opacity
      const vkey = `${Math.floor(nx / 8)},${Math.floor(ny / 8)}`;
      visitCountRef.current.set(vkey, (visitCountRef.current.get(vkey) || 0) + 1);
      setStepCount((s) => s + 1);
      setRobotPos({ x: nx, y: ny, angle: nextAngle });

      renderFrame(false);
      animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [phase, speed, renderFrame]);

  // --- Phase transitions ---
  const goToPlace = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    lineDataRef.current = ctx.getImageData(0, 0, CANVAS_W, CANVAS_H);
    setPhase("place");
  };

  const goToDraw = () => {
    cancelAnimationFrame(animRef.current);
    if (lineDataRef.current) {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) ctx.putImageData(lineDataRef.current, 0, 0);
    }
    setPhase("draw");
    setRobotPos(null);
    trailRef.current = [];
    visitCountRef.current.clear();
  };

  const rotateRobot = (delta: number) => {
    const r = robotRef.current;
    r.angle += (delta * Math.PI) / 180;
    setRobotPos({ x: r.x, y: r.y, angle: r.angle });
    renderFrame(false);
  };

  const retry = () => {
    cancelAnimationFrame(animRef.current);
    trailRef.current = [];
    visitCountRef.current.clear();
    setStepCount(0);
    setPhase("place");
    if (lineDataRef.current) {
      const ctx = canvasRef.current?.getContext("2d");
      if (ctx) ctx.putImageData(lineDataRef.current, 0, 0);
    }
    setRobotPos(null);
  };

  const clearAll = () => {
    cancelAnimationFrame(animRef.current);
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
    }
    lineDataRef.current = null;
    trailRef.current = [];
    visitCountRef.current.clear();
    setPhase("draw");
    setRobotPos(null);
    setStepCount(0);
  };

  const phaseLabels: Record<Phase, string> = {
    draw: "線を描こう",
    place: "線の上をクリックしてロボットを置こう",
    ready: "準備OK！",
    running: "走行中...",
    stopped: "停止しました",
  };

  return (
    <div className="flex flex-col gap-4 w-full" onMouseUp={handleMouseUp}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-500 hover:text-gray-800 hover:border-gray-400 transition-colors text-sm"
        >
          &larr; メニュー
        </Link>
        <h1 className="text-xl font-bold text-gray-800">Line Mode</h1>
        <span
          className={`ml-2 px-3 py-1 rounded-full text-sm font-bold ${
            phase === "running"
              ? "bg-orange-100 text-orange-600 animate-pulse"
              : phase === "stopped"
              ? "bg-red-100 text-red-600"
              : phase === "ready"
              ? "bg-green-100 text-green-600"
              : "bg-blue-100 text-blue-600"
          }`}
        >
          {phaseLabels[phase]}
        </span>
      </div>

      {/* 3-column layout */}
      <div className="flex gap-4 items-start">
        {/* Left panel */}
        <div className="flex flex-col gap-3 w-52 shrink-0">
          {phase === "draw" && (
            <>
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  描画ツール
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setDrawTool("pen")}
                    className={`flex-1 py-2 rounded-lg font-bold text-sm border-2 transition-colors ${
                      drawTool === "pen"
                        ? "bg-gray-800 text-white border-gray-900"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    ✏️ ペン
                  </button>
                  <button
                    onClick={() => setDrawTool("eraser")}
                    className={`flex-1 py-2 rounded-lg font-bold text-sm border-2 transition-colors ${
                      drawTool === "eraser"
                        ? "bg-pink-500 text-white border-pink-600"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    🧹 消す
                  </button>
                </div>
              </div>

              <button
                onClick={goToPlace}
                className="w-full py-3 rounded-xl font-bold text-white shadow-md bg-green-500 hover:bg-green-600 transition-colors"
              >
                🤖 ロボットを置く →
              </button>
              <button
                onClick={clearAll}
                className="w-full py-2 rounded-xl font-bold text-sm text-gray-600 border border-gray-300 hover:bg-gray-100 transition-colors"
              >
                全部消す
              </button>
            </>
          )}

          {phase === "place" && (
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                ロボット配置
              </p>
              <p className="text-sm text-gray-600 mb-3">線の上をクリックしてロボットを置いてね</p>
              <button
                onClick={goToDraw}
                className="w-full py-2 rounded-xl font-bold text-sm text-gray-600 border border-gray-300 hover:bg-gray-100 transition-colors"
              >
                ← 線を描きなおす
              </button>
            </div>
          )}

          {(phase === "ready" || phase === "running" || phase === "stopped") && (
            <>
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  スピード
                </p>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { label: "おそい", v: 80 },
                    { label: "ふつう", v: 40 },
                    { label: "はやい", v: 15 },
                  ].map((s) => (
                    <button
                      key={s.v}
                      onClick={() => setSpeed(s.v)}
                      className={`py-1.5 rounded-lg text-xs font-bold transition-colors ${
                        speed === s.v
                          ? "bg-blue-500 text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noStop}
                    onChange={(e) => setNoStop(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500"
                  />
                  <span className="text-sm font-bold text-gray-700">停止なし</span>
                </label>
                <p className="text-xs text-gray-400 mt-1">行き止まりで自動反転します</p>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  あしあとの色
                </p>
                <div className="grid grid-cols-5 gap-2">
                  {[
                    { color: "#3B82F6", name: "あお" },
                    { color: "#EF4444", name: "あか" },
                    { color: "#10B981", name: "みどり" },
                    { color: "#F59E0B", name: "きいろ" },
                    { color: "#8B5CF6", name: "むらさき" },
                    { color: "#EC4899", name: "ピンク" },
                    { color: "#F97316", name: "オレンジ" },
                    { color: "#06B6D4", name: "みずいろ" },
                    { color: "#84CC16", name: "きみどり" },
                    { color: "#6366F1", name: "あい" },
                  ].map((c) => (
                    <button
                      key={c.color}
                      onClick={() => setTrailColor(c.color)}
                      title={c.name}
                      className={`w-8 h-8 rounded-full border-2 transition-transform ${
                        trailColor === c.color
                          ? "border-gray-800 scale-110"
                          : "border-gray-200 hover:scale-105"
                      }`}
                      style={{ backgroundColor: c.color }}
                    />
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  ロボット情報
                </p>
                <div className="text-sm text-gray-600 space-y-1">
                  <div className="flex justify-between">
                    <span>ステップ</span>
                    <span className="font-mono">{stepCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>状態</span>
                    <span
                      className={`font-bold ${
                        phase === "running"
                          ? "text-orange-500"
                          : phase === "stopped"
                          ? "text-red-500"
                          : "text-green-500"
                      }`}
                    >
                      {phase === "running" ? "走行中" : phase === "stopped" ? "停止" : "待機中"}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Center: Canvas */}
        <div className="flex flex-col items-center gap-2">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className={`border-2 border-gray-300 shadow-lg rounded-lg bg-white ${
              phase === "draw"
                ? "cursor-crosshair"
                : phase === "place"
                ? "cursor-pointer"
                : ""
            }`}
            style={{ width: CANVAS_W, height: CANVAS_H }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => (isDrawingRef.current = false)}
          />
        </div>

        {/* Right panel */}
        <div className="flex flex-col gap-3 w-52 shrink-0">
          {phase === "ready" && (
            <>
              <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                  向きを変える
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => rotateRobot(-45)}
                    className="flex-1 py-2 rounded-lg font-bold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    ↺ 左45°
                  </button>
                  <button
                    onClick={() => rotateRobot(45)}
                    className="flex-1 py-2 rounded-lg font-bold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    ↻ 右45°
                  </button>
                </div>
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => rotateRobot(-90)}
                    className="flex-1 py-2 rounded-lg font-bold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    ↺ 左90°
                  </button>
                  <button
                    onClick={() => rotateRobot(180)}
                    className="flex-1 py-2 rounded-lg font-bold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    ↻ 反転
                  </button>
                  <button
                    onClick={() => rotateRobot(90)}
                    className="flex-1 py-2 rounded-lg font-bold text-sm bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                  >
                    ↻ 右90°
                  </button>
                </div>
              </div>
              <button
                onClick={startRun}
                className="w-full py-4 rounded-xl font-bold text-white text-lg shadow-md bg-red-500 hover:bg-red-600 transition-colors"
              >
                ▶ 実行！
              </button>
            </>
          )}

          {phase === "running" && (
            <div className="w-full py-3 rounded-xl font-bold text-center text-orange-600 bg-orange-50 border border-orange-200 text-sm animate-pulse">
              🤖 走行中...
            </div>
          )}

          {phase === "stopped" && (
            <div className="flex flex-col gap-2">
              <div className="w-full py-3 rounded-xl font-bold text-center text-red-600 bg-red-50 border border-red-200 text-sm">
                🚫 線が見つかりません
              </div>
              <button
                onClick={retry}
                className="w-full py-3 rounded-xl font-bold text-white shadow-md bg-blue-500 hover:bg-blue-600 transition-colors"
              >
                ↻ もう一度置く
              </button>
              <button
                onClick={goToDraw}
                className="w-full py-2 rounded-xl font-bold text-sm text-gray-600 border border-gray-300 hover:bg-gray-100 transition-colors"
              >
                ✏️ 線を描きなおす
              </button>
            </div>
          )}

          {(phase === "ready" || phase === "running" || phase === "stopped") && (
            <button
              onClick={retry}
              className="w-full py-2 rounded-xl font-bold text-sm text-gray-600 border border-gray-300 hover:bg-gray-100 transition-colors"
            >
              🤖 ロボットを置きなおす
            </button>
          )}

          {phase === "draw" && (
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                あそびかた
              </p>
              <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                <li>キャンバスに線を描こう</li>
                <li>ロボットを線の上に置こう</li>
                <li>実行ボタンでロボットが線をたどるよ</li>
              </ol>
            </div>
          )}

          {phase === "place" && (
            <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <p className="text-sm text-gray-600">
                描いた線の上をクリックすると、そこにロボットが現れます
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
