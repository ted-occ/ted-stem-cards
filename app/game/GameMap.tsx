"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import MazeFPS from "./MazeFPS";
import {
  mapData, MAP_WIDTH, MAP_HEIGHT, TILE,
  generateMaze, findStartIn, findGoalIn, isWalkableIn,
  type TileType,
} from "./map-data";

const CELL_SIZE = 52;
const STEP_DELAY = 400;

// Directions: 0=up, 1=right, 2=down, 3=left
type Direction = 0 | 1 | 2 | 3;

const DIRECTION_LABELS: Record<Direction, string> = {
  0: "UP", 1: "RIGHT", 2: "DOWN", 3: "LEFT",
};

const DIRECTION_ARROWS: Record<Direction, string> = {
  0: "\u25B2", 1: "\u25B6", 2: "\u25BC", 3: "\u25C0",
};

const DIRECTION_DX: Record<Direction, number> = { 0: 0, 1: 1, 2: 0, 3: -1 };
const DIRECTION_DY: Record<Direction, number> = { 0: -1, 1: 0, 2: 1, 3: 0 };

// --- Action tree types ---
type SimpleAction = "FORWARD" | "BACK" | "TURN_RIGHT" | "TURN_LEFT";

interface SimpleItem { kind: "action"; action: SimpleAction; }
interface LoopItem   { kind: "loop";   count: number; children: ActionItem[]; }
type ActionItem = SimpleItem | LoopItem;

// --- Card definitions ---
interface CardDef { id: string; label: string; icon: string; color: string; }

const ACTION_CARDS: CardDef[] = [
  { id: "FORWARD",    label: "Forward",    icon: "\u2B06", color: "bg-blue-100 border-blue-400 hover:bg-blue-200" },
  { id: "BACK",       label: "Back",       icon: "\u2B07", color: "bg-orange-100 border-orange-400 hover:bg-orange-200" },
  { id: "TURN_RIGHT", label: "Turn Right", icon: "\u21BB", color: "bg-green-100 border-green-400 hover:bg-green-200" },
  { id: "TURN_LEFT",  label: "Turn Left",  icon: "\u21BA", color: "bg-purple-100 border-purple-400 hover:bg-purple-200" },
];

const LOOP_COUNTS = [2, 3, 4, 5];

type GameState = "planning" | "running" | "executed" | "success" | "failed";

// --- Flatten ---
interface FlatStep { action: SimpleAction; path: number[]; }

function flattenActions(items: ActionItem[], pathPrefix: number[] = []): FlatStep[] {
  const result: FlatStep[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const path = [...pathPrefix, i];
    if (item.kind === "action") {
      result.push({ action: item.action, path });
    } else {
      for (let r = 0; r < item.count; r++) {
        result.push(...flattenActions(item.children, path));
      }
    }
  }
  return result;
}

function insertAtPath(items: ActionItem[], insertPath: number[], item: ActionItem): ActionItem[] {
  if (insertPath.length === 0) return [...items, item];
  return items.map((it, i) => {
    if (i === insertPath[0] && it.kind === "loop") {
      return { ...it, children: insertAtPath(it.children, insertPath.slice(1), item) };
    }
    return it;
  });
}

function removeAtPath(items: ActionItem[], targetPath: number[]): ActionItem[] {
  if (targetPath.length === 1) return items.filter((_, i) => i !== targetPath[0]);
  return items.map((it, i) => {
    if (i === targetPath[0] && it.kind === "loop") {
      return { ...it, children: removeAtPath(it.children, targetPath.slice(1)) };
    }
    return it;
  });
}

// --- Tile rendering ---
function getTileStyle(tile: number): string {
  switch (tile) {
    case TILE.WALL:  return "bg-gray-700 border-gray-800";
    case TILE.START: return "bg-green-300 border-green-400";
    case TILE.GOAL:  return "bg-yellow-300 border-yellow-400";
    case TILE.TRAP:  return "bg-red-300 border-red-400";
    default:         return "bg-stone-100 border-stone-200";
  }
}

function getTileLabel(tile: number): string | null {
  if (tile === TILE.START) return "S";
  if (tile === TILE.GOAL)  return "G";
  return null;
}

function actionIcon(a: SimpleAction): string { return ACTION_CARDS.find((c) => c.id === a)!.icon; }
function actionLabel(a: SimpleAction): string { return ACTION_CARDS.find((c) => c.id === a)!.label; }

// --- Queue / Program list (recursive) ---
function QueueList({
  items, depth, executingPath, planning, onRemove,
}: {
  items: ActionItem[];
  depth: number;
  executingPath: number[] | null;
  planning: boolean;
  onRemove: (path: number[]) => void;
}) {
  return (
    <>
      {items.map((item, i) => {
        const isExecutingHere =
          executingPath !== null && executingPath.length >= 1 && executingPath[0] === i;

        if (item.kind === "action") {
          const highlight = isExecutingHere && executingPath!.length === 1;
          return (
            <div
              key={i}
              data-executing={highlight ? "true" : undefined}
              className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm border transition-colors ${
                highlight
                  ? "bg-yellow-300 border-yellow-500 font-bold shadow-md ring-2 ring-yellow-400"
                  : "bg-white border-gray-200"
              }`}
              style={{ marginLeft: depth * 16 }}
            >
              {highlight && <span className="text-yellow-700 font-bold">▶</span>}
              <span>{actionIcon(item.action)}</span>
              <span className="flex-1">{actionLabel(item.action)}</span>
              {planning && (
                <button onClick={() => onRemove([i])} className="text-red-400 hover:text-red-600 text-xs font-bold">x</button>
              )}
            </div>
          );
        }

        // Loop item
        const loopHighlight = isExecutingHere;
        return (
          <div key={i}>
            <div
              className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm border font-bold ${
                loopHighlight ? "bg-cyan-200 border-cyan-500 ring-2 ring-cyan-400" : "bg-cyan-50 border-cyan-300"
              }`}
              style={{ marginLeft: depth * 16 }}
            >
              {loopHighlight && <span className="text-cyan-700">▶</span>}
              <span className="text-base">{"\uD83D\uDD04"}</span>
              <span className="flex-1">{item.count}回 くり返し</span>
              {planning && (
                <button onClick={() => onRemove([i])} className="text-red-400 hover:text-red-600 text-xs font-bold">x</button>
              )}
            </div>

            {item.children.length === 0 && (
              <div className="text-xs text-gray-400 italic px-2 py-1" style={{ marginLeft: (depth + 1) * 16 }}>
                （カードを追加してね）
              </div>
            )}
            <QueueList
              items={item.children}
              depth={depth + 1}
              executingPath={isExecutingHere ? executingPath!.slice(1) : null}
              planning={planning}
              onRemove={(childPath) => onRemove([i, ...childPath])}
            />

            <div
              className="flex items-center gap-1 px-2 py-1 rounded text-xs font-bold bg-orange-50 border border-orange-300 text-orange-600"
              style={{ marginLeft: depth * 16 }}
            >
              <span>🔚</span><span>おわり</span>
            </div>
          </div>
        );
      })}
    </>
  );
}

// ========================
// Main component
// ========================
export default function GameMap() {
  const [currentMap, setCurrentMap] = useState<TileType[][]>(mapData);

  const startPos = findStartIn(currentMap);
  const goalPos  = findGoalIn(currentMap);

  const [playerPos, setPlayerPos] = useState(startPos);
  const [playerDir, setPlayerDir] = useState<Direction>(2);
  const [actionTree, setActionTree] = useState<ActionItem[]>([]);
  const [gameState, setGameState] = useState<GameState>("planning");
  const [executingPath, setExecutingPath] = useState<number[] | null>(null);
  const [stepInfo, setStepInfo] = useState<{ current: number; total: number } | null>(null);
  const runningRef = useRef(false);
  const queueContainerRef = useRef<HTMLDivElement>(null);

  const [insertPath, setInsertPath] = useState<number[]>([]);
  const [nfcConnected, setNfcConnected] = useState(false);
  const [nfcFlash, setNfcFlash] = useState<string | null>(null); // flash card label on scan
  const nfcFlashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- NFC polling: read tags and add cards ---
  const actionTreeRef = useRef(actionTree);
  actionTreeRef.current = actionTree;
  const insertPathRef = useRef(insertPath);
  insertPathRef.current = insertPath;
  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  useEffect(() => {
    let cancelled = false;

    const VALID_ACTIONS = ["FORWARD", "BACK", "TURN_RIGHT", "TURN_LEFT"];
    const VALID_LOOPS = ["LOOP_2", "LOOP_3", "LOOP_4", "LOOP_5"];

    const poll = async () => {
      try {
        const res = await fetch("/api/nfc/read");
        if (!res.ok || cancelled) return;
        const data = await res.json();
        setNfcConnected(data.connected);

        for (const ev of data.events) {
          const cardId: string = ev.cardId;
          const state = gameStateRef.current;
          if (state !== "planning" && state !== "executed") continue;

          if (VALID_ACTIONS.includes(cardId)) {
            setActionTree((prev) =>
              insertAtPath(prev, insertPathRef.current, { kind: "action", action: cardId as SimpleAction })
            );
            showNfcFlash(cardId);
          } else if (VALID_LOOPS.includes(cardId)) {
            const count = parseInt(cardId.split("_")[1], 10);
            setActionTree((prev) => {
              const newTree = insertAtPath(prev, insertPathRef.current, { kind: "loop", count, children: [] });
              const parentItems = getInsertTarget(newTree, insertPathRef.current);
              const newIndex = parentItems.length - 1;
              setInsertPath((p) => [...p, newIndex]);
              return newTree;
            });
            showNfcFlash(`${count}回 くり返し`);
          } else if (cardId === "END") {
            setInsertPath((prev) => prev.length > 0 ? prev.slice(0, -1) : prev);
            showNfcFlash("おわり");
          }
        }
      } catch {
        // ignore fetch errors
      }
    };

    const id = setInterval(poll, 400);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  function showNfcFlash(label: string) {
    setNfcFlash(label);
    if (nfcFlashTimer.current) clearTimeout(nfcFlashTimer.current);
    nfcFlashTimer.current = setTimeout(() => setNfcFlash(null), 1200);
  }

  // Auto-scroll: keep executing step centered in the queue container
  useEffect(() => {
    const container = queueContainerRef.current;
    if (!container) return;
    const el = container.querySelector('[data-executing="true"]') as HTMLElement | null;
    if (!el) return;
    const targetTop =
      el.offsetTop - container.clientHeight / 2 + el.offsetHeight / 2;
    container.scrollTo({ top: Math.max(0, targetTop), behavior: "smooth" });
  }, [executingPath]);

  const getInsertTarget = useCallback((tree: ActionItem[], path: number[]): ActionItem[] => {
    let target = tree;
    for (const idx of path) {
      const item = target[idx];
      if (item.kind === "loop") target = item.children;
    }
    return target;
  }, []);

  const resetGame = useCallback(() => {
    setPlayerPos(findStartIn(currentMap));
    setPlayerDir(2);
    setActionTree([]);
    setGameState("planning");
    setExecutingPath(null);
    setStepInfo(null);
    setInsertPath([]);
    runningRef.current = false;
  }, []);

  const addAction = (action: SimpleAction) => {
    if (gameState !== "planning" && gameState !== "executed") return;
    setActionTree((prev) => insertAtPath(prev, insertPath, { kind: "action", action }));
  };

  const addLoop = (count: number) => {
    if (gameState !== "planning" && gameState !== "executed") return;
    setActionTree((prev) => {
      const newTree = insertAtPath(prev, insertPath, { kind: "loop", count, children: [] });
      const parentItems = getInsertTarget(newTree, insertPath);
      const newIndex = parentItems.length - 1;
      setInsertPath((p) => [...p, newIndex]);
      return newTree;
    });
  };

  const removeItem = (path: number[]) => {
    if (gameState !== "planning" && gameState !== "executed" && gameState !== "failed") return;
    setInsertPath([]);
    setActionTree((prev) => removeAtPath(prev, path));
    if (gameState === "failed") {
      setPlayerPos(findStartIn(currentMap));
      setPlayerDir(2);
      setGameState("executed");
      setExecutingPath(null);
      setStepInfo(null);
      runningRef.current = false;
    }
  };

  const exitLoop = () => setInsertPath((prev) => prev.slice(0, -1));

  const executeActions = useCallback(async () => {
    const steps = flattenActions(actionTree);
    if (steps.length === 0) return;

    setGameState("running");
    setStepInfo({ current: 0, total: steps.length });
    runningRef.current = true;

    let pos = { ...startPos };
    let dir: Direction = 2;

    for (let i = 0; i < steps.length; i++) {
      if (!runningRef.current) return;

      const step = steps[i];
      setExecutingPath(step.path);
      setStepInfo({ current: i + 1, total: steps.length });

      if (step.action === "TURN_RIGHT") {
        dir = ((dir + 1) % 4) as Direction;
        setPlayerDir(dir);
      } else if (step.action === "TURN_LEFT") {
        dir = ((dir + 3) % 4) as Direction;
        setPlayerDir(dir);
      } else if (step.action === "FORWARD") {
        const newX = pos.x + DIRECTION_DX[dir];
        const newY = pos.y + DIRECTION_DY[dir];
        if (!isWalkableIn(currentMap, newX, newY)) { setGameState("failed"); runningRef.current = false; return; }
        pos = { x: newX, y: newY };
        setPlayerPos({ ...pos });
      } else if (step.action === "BACK") {
        const backDir = ((dir + 2) % 4) as Direction;
        const newX = pos.x + DIRECTION_DX[backDir];
        const newY = pos.y + DIRECTION_DY[backDir];
        if (!isWalkableIn(currentMap, newX, newY)) { setGameState("failed"); runningRef.current = false; return; }
        pos = { x: newX, y: newY };
        setPlayerPos({ ...pos });
      }

      if (pos.x === goalPos.x && pos.y === goalPos.y) {
        setGameState("success");
        setExecutingPath(null);
        setStepInfo(null);
        runningRef.current = false;
        return;
      }

      await new Promise((r) => setTimeout(r, STEP_DELAY));
    }

    setExecutingPath(null);
    setStepInfo(null);
    setGameState("executed");
    runningRef.current = false;
  }, [actionTree, startPos, goalPos, currentMap]);

  const generateNewMaze = useCallback(() => {
    const newMap = generateMaze();
    setCurrentMap(newMap);
    setPlayerPos(findStartIn(newMap));
    setPlayerDir(2);
    setActionTree([]);
    setInsertPath([]);
    setGameState("planning");
    setExecutingPath(null);
    setStepInfo(null);
    runningRef.current = false;
  }, []);

  const isEditable = gameState === "planning" || gameState === "executed";
  const canDelete  = isEditable || gameState === "failed";

  const retryActions = useCallback(() => {
    setPlayerPos(findStartIn(currentMap));
    setPlayerDir(2);
    executeActions();
  }, [executeActions]);

  // 失敗したアクションを削除してリセット → "executed" 状態へ
  const retryFromFail = useCallback(() => {
    const failPath = executingPath;
    setPlayerPos(findStartIn(currentMap));
    setPlayerDir(2);
    setGameState("executed");
    setExecutingPath(null);
    setStepInfo(null);
    runningRef.current = false;
    if (failPath) {
      setActionTree((prev) => removeAtPath(prev, failPath));
      setInsertPath([]);
    }
  }, [executingPath, currentMap]);

  const insideLoop = insertPath.length > 0;

  return (
    <div className="flex flex-col min-h-screen bg-stone-50">

      {/* Header */}
      <div className="flex items-center gap-4 px-5 py-3 bg-white border-b border-gray-200 shadow-sm">
        <Link
          href="/"
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm font-medium text-gray-600 transition-colors"
        >
          ← メニュー
        </Link>
        <h1 className="text-xl font-bold text-gray-800">🎯 Maze Mode</h1>
        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
          nfcConnected
            ? "bg-green-50 border-green-300 text-green-700"
            : "bg-gray-50 border-gray-300 text-gray-400"
        }`}>
          <span className={`inline-block w-2 h-2 rounded-full ${nfcConnected ? "bg-green-500 animate-pulse" : "bg-gray-300"}`} />
          {nfcConnected ? "NFC" : "NFC OFF"}
        </div>
        <button
          onClick={generateNewMaze}
          disabled={gameState === "running"}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-300 bg-indigo-50 hover:bg-indigo-100 text-sm font-medium text-indigo-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          🎲 新しい迷路
        </button>
      </div>

      {/* NFC scan flash notification */}
      {nfcFlash && (
        <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-xl bg-green-500 text-white font-bold text-lg shadow-lg animate-bounce">
          📡 {nfcFlash}
        </div>
      )}

      {/* Main 3-column layout */}
      <div className="flex gap-4 p-4 items-start">

        {/* ===== LEFT: Card Controls ===== */}
        <div className="w-52 flex-shrink-0 flex flex-col gap-4">

          {/* Action Cards */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
            <h2 className="text-sm font-bold text-gray-600 mb-2 uppercase tracking-wide">Action Cards</h2>
            <div className="grid grid-cols-2 gap-2">
              {ACTION_CARDS.map((card) => (
                <button
                  key={card.id}
                  onClick={() => addAction(card.id as SimpleAction)}
                  disabled={!isEditable}
                  className={`flex flex-col items-center gap-1 p-2.5 rounded-lg border-2 transition-colors ${
                    isEditable ? card.color : "bg-gray-100 border-gray-300 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <span className="text-xl">{card.icon}</span>
                  <span className="text-xs font-bold">{card.label}</span>
                </button>
              ))}
            </div>
            {/* おわりカード */}
            <button
              onClick={exitLoop}
              disabled={!isEditable || !insideLoop}
              className={`mt-2 w-full py-2 rounded-lg border-2 text-sm font-bold transition-colors ${
                isEditable && insideLoop
                  ? "bg-orange-100 border-orange-400 hover:bg-orange-200 text-orange-700"
                  : "bg-gray-100 border-gray-300 text-gray-400 opacity-50 cursor-not-allowed"
              }`}
            >
              <span className="mr-1">🔚</span>おわり
            </button>
          </div>

          {/* くり返しカード */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
            <h2 className="text-sm font-bold text-gray-600 mb-2 uppercase tracking-wide">くり返しカード</h2>
            <div className="grid grid-cols-4 gap-1.5">
              {LOOP_COUNTS.map((n) => (
                <button
                  key={n}
                  onClick={() => addLoop(n)}
                  disabled={!isEditable}
                  className={`flex flex-col items-center gap-0.5 p-1.5 rounded-lg border-2 transition-colors ${
                    isEditable
                      ? "bg-cyan-100 border-cyan-400 hover:bg-cyan-200"
                      : "bg-gray-100 border-gray-300 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <span className="text-base">{"\uD83D\uDD04"}</span>
                  <span className="text-xs font-bold">{n}回</span>
                </button>
              ))}
            </div>
            {insideLoop && isEditable && (
              <div className="mt-2 text-xs text-cyan-600 text-center bg-cyan-50 rounded px-2 py-1 border border-cyan-200">
                くり返しの中 (深さ {insertPath.length})
              </div>
            )}
          </div>
        </div>

        {/* ===== CENTER: Maze ===== */}
        <div className="flex flex-col items-center flex-shrink-0">

          {/* Success banner (above maze) */}
          {gameState === "success" && (
            <div className="mb-3 flex flex-col items-center gap-2">
              <div className="rounded-lg bg-yellow-100 px-6 py-2 text-lg font-bold text-yellow-800 border-2 border-yellow-400">
                🎉 GOAL!
              </div>
              <button onClick={resetGame} className="rounded-lg bg-green-500 hover:bg-green-600 px-5 py-1.5 text-white font-bold shadow-md transition-colors text-sm">
                スタートに戻る
              </button>
            </div>
          )}

          {/* 2D Maze view */}
          <div
            className="border-2 border-gray-800 shadow-lg overflow-hidden bg-stone-50"
            style={{ width: CELL_SIZE * MAP_WIDTH, height: CELL_SIZE * MAP_HEIGHT }}
          >
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${MAP_WIDTH}, ${CELL_SIZE}px)`,
                gridTemplateRows:    `repeat(${MAP_HEIGHT}, ${CELL_SIZE}px)`,
              }}
            >
              {currentMap.map((row, y) =>
                row.map((tile, x) => {
                  const isPlayer = playerPos.x === x && playerPos.y === y;
                  const label = getTileLabel(tile);
                  return (
                    <div
                      key={`${x}-${y}`}
                      className={`relative flex items-center justify-center border ${getTileStyle(tile)}`}
                      style={{ width: CELL_SIZE, height: CELL_SIZE }}
                    >
                      {label && !isPlayer && (
                        <span className="text-xs font-bold text-gray-600 absolute top-0.5 left-1">{label}</span>
                      )}
                      {isPlayer && (
                        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-blue-500 text-white text-lg shadow-md border-2 border-blue-700 z-10">
                          {DIRECTION_ARROWS[playerDir]}
                        </div>
                      )}
                      {tile === TILE.WALL && (
                        <div className="absolute inset-0 opacity-20">
                          <div className="w-full h-1/2 border-b border-gray-600 flex">
                            <div className="w-1/2 border-r border-gray-600" />
                            <div className="w-1/2" />
                          </div>
                          <div className="w-full h-1/2 flex">
                            <div className="w-1/4 border-r border-gray-600" />
                            <div className="w-1/2 border-r border-gray-600" />
                            <div className="w-1/4" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* First-person view */}
          <div className="border-2 border-gray-800 shadow-lg overflow-hidden" style={{ width: CELL_SIZE * MAP_WIDTH }}>
            <div className="flex items-center gap-2 px-3 py-1 bg-gray-800 text-xs text-gray-300 font-medium">
              <span>👁</span>
              <span>一人称視点</span>
              {gameState === "running" && (
                <span className="ml-auto text-yellow-400 animate-pulse">● 実行中</span>
              )}
            </div>
            <MazeFPS
              map={currentMap}
              playerPos={playerPos}
              playerDir={playerDir}
              goalPos={goalPos}
            />
          </div>

          {/* Legend */}
          <div className="flex gap-4 text-xs text-gray-500 mt-2 justify-center">
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-300 border border-green-400" /><span>START</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-300 border border-yellow-400" /><span>GOAL</span></div>
            <div className="flex items-center gap-1"><div className="w-3 h-3 bg-gray-700 border border-gray-800" /><span>WALL</span></div>
          </div>
          <div className="text-center mt-1 text-xs text-gray-400">
            Facing: {DIRECTION_LABELS[playerDir]} {DIRECTION_ARROWS[playerDir]}
          </div>

          {/* Failure banner (below maze) */}
          {gameState === "failed" && (
            <div className="mt-3 flex flex-col items-center gap-2">
              <div className="rounded-lg bg-red-100 px-6 py-2 text-lg font-bold text-red-800 border-2 border-red-400">
                💥 かべにぶつかった！
              </div>
              <p className="text-xs text-gray-500">プログラムの × を押して修正してください</p>
              <button onClick={resetGame} className="rounded-lg bg-gray-400 hover:bg-gray-500 px-5 py-1.5 text-white font-medium shadow-md transition-colors text-xs">
                すべてリセット
              </button>
            </div>
          )}
        </div>

        {/* ===== RIGHT: Program / Debugger ===== */}
        <div className="flex-1 min-w-[240px] max-w-[280px] flex flex-col gap-3">

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {/* Program header */}
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-200">
              <h2 className="text-sm font-bold text-gray-700">📋 プログラム</h2>
              {gameState === "running" && stepInfo && (
                <span className="text-xs font-mono bg-yellow-100 text-yellow-800 border border-yellow-300 px-2 py-0.5 rounded-full">
                  {stepInfo.current} / {stepInfo.total} ステップ
                </span>
              )}
            </div>

            {/* Step progress bar */}
            {gameState === "running" && stepInfo && stepInfo.total > 0 && (
              <div className="h-1.5 bg-gray-100">
                <div
                  className="h-full bg-yellow-400 transition-all duration-300"
                  style={{ width: `${(stepInfo.current / stepInfo.total) * 100}%` }}
                />
              </div>
            )}

            {/* Queue list */}
            <div
              ref={queueContainerRef}
              className={`flex flex-col gap-1 p-2 overflow-y-scroll transition-colors ${
                gameState === "running" ? "bg-yellow-50" : ""
              }`}
              style={{ maxHeight: "420px", scrollbarWidth: "thin", scrollbarColor: gameState === "running" ? "#fbbf24 #fef9c3" : "#d1d5db #f9fafb" }}
            >
              {actionTree.length === 0 && (
                <p className="text-xs text-gray-400 italic text-center py-4">
                  カードを選んでプログラムを作ろう
                </p>
              )}
              <QueueList
                items={actionTree}
                depth={0}
                executingPath={executingPath}
                planning={canDelete}
                onRemove={removeItem}
              />
            </div>
          </div>

          {/* Run / Retry / Clear buttons */}
          <div className="flex flex-col gap-2">
            {gameState === "executed" ? (
              <button
                onClick={retryActions}
                disabled={actionTree.length === 0}
                className="py-3 rounded-xl font-bold text-white text-base shadow-md transition-colors bg-blue-500 hover:bg-blue-600"
              >
                🔄 Retry
              </button>
            ) : (
              <button
                onClick={executeActions}
                disabled={gameState !== "planning" || actionTree.length === 0}
                className={`py-3 rounded-xl font-bold text-white text-base shadow-md transition-colors ${
                  gameState === "planning" && actionTree.length > 0
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-gray-300 cursor-not-allowed"
                }`}
              >
                ▶ Action!
              </button>
            )}
            {isEditable && actionTree.length > 0 && (
              <button
                onClick={() => {
                  setActionTree([]);
                  setInsertPath([]);
                  setPlayerPos(findStartIn(currentMap));
                  setPlayerDir(2);
                  setGameState("planning");
                }}
                className="py-2 rounded-xl font-bold text-gray-600 border border-gray-300 hover:bg-gray-100 transition-colors text-sm"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
