"use client";

import { useState, useRef, useCallback } from "react";
import Link from "next/link";

const GRID_SIZE = 10;
const CELL_SIZE = 56;
const STEP_DELAY = 400;

type Direction = 0 | 1 | 2 | 3;

const DIRECTION_ARROWS: Record<Direction, string> = {
  0: "\u25B2",
  1: "\u25B6",
  2: "\u25BC",
  3: "\u25C0",
};

const DIRECTION_LABELS: Record<Direction, string> = {
  0: "UP",
  1: "RIGHT",
  2: "DOWN",
  3: "LEFT",
};

const DIRECTION_DX: Record<Direction, number> = { 0: 0, 1: 1, 2: 0, 3: -1 };
const DIRECTION_DY: Record<Direction, number> = { 0: -1, 1: 0, 2: 1, 3: 0 };

// --- Action tree types ---
type SimpleAction = "FORWARD" | "BACK" | "TURN_RIGHT" | "TURN_LEFT";

interface SimpleItem {
  kind: "action";
  action: SimpleAction;
}

interface LoopItem {
  kind: "loop";
  count: number;
  children: ActionItem[];
}

type ActionItem = SimpleItem | LoopItem;

// --- Card definitions ---
interface CardDef {
  id: string;
  label: string;
  icon: string;
  color: string;
}

const ACTION_CARDS: CardDef[] = [
  { id: "FORWARD",    label: "Forward",    icon: "\u2B06", color: "bg-blue-100 border-blue-400 hover:bg-blue-200" },
  { id: "BACK",       label: "Back",       icon: "\u2B07", color: "bg-orange-100 border-orange-400 hover:bg-orange-200" },
  { id: "TURN_RIGHT", label: "Turn Right", icon: "\u21BB", color: "bg-green-100 border-green-400 hover:bg-green-200" },
  { id: "TURN_LEFT",  label: "Turn Left",  icon: "\u21BA", color: "bg-purple-100 border-purple-400 hover:bg-purple-200" },
];

const LOOP_COUNTS = [2, 3, 4, 5];

type GameState = "planning" | "running" | "done";

// --- Flatten action tree ---
interface FlatStep {
  action: SimpleAction;
  path: number[];
}

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

// --- Tree helpers ---
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

// --- Action helpers ---
function actionIcon(a: SimpleAction): string {
  return ACTION_CARDS.find((c) => c.id === a)!.icon;
}
function actionLabel(a: SimpleAction): string {
  return ACTION_CARDS.find((c) => c.id === a)!.label;
}

// --- Queue renderer ---
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
        const isExecutingHere = executingPath !== null && executingPath.length >= 1 && executingPath[0] === i;

        if (item.kind === "action") {
          const highlight = isExecutingHere && executingPath!.length === 1;
          return (
            <div
              key={i}
              className={`flex items-center gap-2 px-2 py-1 rounded text-sm border ${
                highlight ? "bg-yellow-200 border-yellow-500 font-bold" : "bg-white border-gray-200"
              }`}
              style={{ marginLeft: depth * 20 }}
            >
              <span>{actionIcon(item.action)}</span>
              <span className="flex-1">{actionLabel(item.action)}</span>
              {planning && (
                <button onClick={() => onRemove([i])} className="w-5 h-5 flex items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-500 hover:text-white text-xs font-bold transition-colors">&times;</button>
              )}
            </div>
          );
        }

        const loopHighlight = isExecutingHere;
        return (
          <div key={i}>
            <div
              className={`flex items-center gap-2 px-2 py-1 rounded text-sm border font-bold ${
                loopHighlight ? "bg-cyan-200 border-cyan-500" : "bg-cyan-50 border-cyan-300"
              }`}
              style={{ marginLeft: depth * 20 }}
            >
              <span className="text-lg">{"\uD83D\uDD04"}</span>
              <span className="flex-1">x{item.count} くり返し</span>
              {planning && (
                <button onClick={() => onRemove([i])} className="w-5 h-5 flex items-center justify-center rounded-full bg-red-100 text-red-500 hover:bg-red-500 hover:text-white text-xs font-bold transition-colors">&times;</button>
              )}
            </div>
            {item.children.length === 0 && (
              <div className="text-xs text-gray-400 italic px-2 py-1" style={{ marginLeft: (depth + 1) * 20 }}>(empty)</div>
            )}
            <QueueList
              items={item.children}
              depth={depth + 1}
              executingPath={isExecutingHere ? executingPath!.slice(1) : null}
              planning={planning}
              onRemove={(childPath) => onRemove([i, ...childPath])}
            />
            <div className="px-2 py-0.5 text-xs text-cyan-500 font-mono" style={{ marginLeft: depth * 20 }}>end for</div>
          </div>
        );
      })}
    </>
  );
}

// --- Pen color palette ---
const PEN_COLORS = [
  { name: "Black",  value: "#333333" },
  { name: "Red",    value: "#EF4444" },
  { name: "Blue",   value: "#3B82F6" },
  { name: "Green",  value: "#22C55E" },
  { name: "Yellow", value: "#EAB308" },
  { name: "Purple", value: "#A855F7" },
  { name: "Orange", value: "#F97316" },
  { name: "Pink",   value: "#EC4899" },
];

const MAX_LEVEL = 8;

// Cell data: color + intensity level (1-8)
interface CellData {
  color: string;
  level: number;
}

// Interpolate from white (#fafaf9) to the target color based on level
function getCellColor(cell: CellData): string {
  const ratio = cell.level / MAX_LEVEL;
  const base = { r: 250, g: 250, b: 249 }; // stone-50
  const hex = cell.color;
  const target = {
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
  const r = Math.round(base.r + (target.r - base.r) * ratio);
  const g = Math.round(base.g + (target.g - base.g) * ratio);
  const b = Math.round(base.b + (target.b - base.b) * ratio);
  return `rgb(${r},${g},${b})`;
}

// ========================
// Main component
// ========================
export default function DrawMap() {
  const initialPos = { x: 4, y: 4 };

  const [playerPos, setPlayerPos] = useState(initialPos);
  const [playerDir, setPlayerDir] = useState<Direction>(0);
  const [actionTree, setActionTree] = useState<ActionItem[]>([]);
  const [gameState, setGameState] = useState<GameState>("planning");
  const [executingPath, setExecutingPath] = useState<number[] | null>(null);
  const [insertPath, setInsertPath] = useState<number[]>([]);
  const runningRef = useRef(false);

  // Painted cells: key "x,y" -> { color, level }
  const [painted, setPainted] = useState<Record<string, CellData>>({
    [`${initialPos.x},${initialPos.y}`]: { color: PEN_COLORS[0].value, level: 1 },
  });
  const [penColor, setPenColor] = useState(PEN_COLORS[0].value);
  const [penColorAtAction, setPenColorAtAction] = useState(PEN_COLORS[0].value);

  const getInsertTarget = useCallback(
    (tree: ActionItem[], path: number[]): ActionItem[] => {
      let target = tree;
      for (const idx of path) {
        const item = target[idx];
        if (item.kind === "loop") target = item.children;
      }
      return target;
    },
    []
  );

  const resetAll = useCallback(() => {
    setPlayerPos(initialPos);
    setPlayerDir(0);
    setActionTree([]);
    setGameState("planning");
    setExecutingPath(null);
    setInsertPath([]);
    setPainted({ [`${initialPos.x},${initialPos.y}`]: { color: penColor, level: 1 } });
    setPenColorAtAction(penColor);
    runningRef.current = false;
  }, [penColor]);

  // Retry: keep program, reset canvas & player, go back to planning
  const retry = useCallback(() => {
    setPlayerPos(initialPos);
    setPlayerDir(0);
    setGameState("planning");
    setExecutingPath(null);
    setInsertPath([]);
    setPainted({ [`${initialPos.x},${initialPos.y}`]: { color: penColor, level: 1 } });
    setPenColorAtAction(penColor);
    runningRef.current = false;
  }, [penColor]);

  // Edit: go back to planning keeping program & canvas
  const backToEdit = useCallback(() => {
    setGameState("planning");
    setExecutingPath(null);
    setInsertPath([]);
    runningRef.current = false;
  }, []);

  const clearCanvas = useCallback(() => {
    setPainted({ [`${playerPos.x},${playerPos.y}`]: { color: penColor, level: 1 } });
  }, [playerPos, penColor]);

  const addAction = (action: SimpleAction) => {
    if (gameState !== "planning") return;
    setActionTree((prev) => insertAtPath(prev, insertPath, { kind: "action", action }));
  };

  const undoAction = () => {
    if (gameState !== "planning") return;
    setActionTree((prev) => {
      if (prev.length === 0) return prev;
      // Remove last item at current insert path
      const target = getInsertTarget(prev, insertPath);
      if (target.length === 0) {
        // If inside an empty loop, exit loop first
        if (insertPath.length > 0) {
          setInsertPath((p) => p.slice(0, -1));
        }
        return prev;
      }
      const lastIdx = target.length - 1;
      return removeAtPath(prev, [...insertPath, lastIdx]);
    });
  };

  const addLoop = (count: number) => {
    if (gameState !== "planning") return;
    const item: LoopItem = { kind: "loop", count, children: [] };
    setActionTree((prev) => {
      const newTree = insertAtPath(prev, insertPath, item);
      const parentItems = getInsertTarget(newTree, insertPath);
      const newIndex = parentItems.length - 1;
      setInsertPath((prev) => [...prev, newIndex]);
      return newTree;
    });
  };

  const removeItem = (path: number[]) => {
    if (gameState !== "planning") return;
    setInsertPath([]);
    setActionTree((prev) => removeAtPath(prev, path));
  };

  const exitLoop = () => setInsertPath((prev) => prev.slice(0, -1));

  const executeActions = useCallback(async () => {
    const steps = flattenActions(actionTree);
    if (steps.length === 0) return;

    setGameState("running");
    runningRef.current = true;

    let pos = { ...initialPos };
    let dir: Direction = 0;
    const newPainted: Record<string, CellData> = {
      [`${pos.x},${pos.y}`]: { color: penColorAtAction, level: 1 },
    };

    const paintCell = (x: number, y: number) => {
      const key = `${x},${y}`;
      const existing = newPainted[key];
      if (existing && existing.color === penColorAtAction) {
        existing.level = Math.min(existing.level + 1, MAX_LEVEL);
      } else {
        newPainted[key] = { color: penColorAtAction, level: 1 };
      }
    };

    setPlayerPos({ ...pos });
    setPlayerDir(dir);
    setPainted({ ...newPainted });

    await new Promise((r) => setTimeout(r, STEP_DELAY));

    for (let i = 0; i < steps.length; i++) {
      if (!runningRef.current) return;

      const step = steps[i];
      setExecutingPath(step.path);

      if (step.action === "TURN_RIGHT") {
        dir = ((dir + 1) % 4) as Direction;
        setPlayerDir(dir);
      } else if (step.action === "TURN_LEFT") {
        dir = ((dir + 3) % 4) as Direction;
        setPlayerDir(dir);
      } else if (step.action === "FORWARD") {
        let newX = pos.x + DIRECTION_DX[dir];
        let newY = pos.y + DIRECTION_DY[dir];
        newX = ((newX % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;
        newY = ((newY % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;
        pos = { x: newX, y: newY };
        setPlayerPos({ ...pos });
        paintCell(pos.x, pos.y);
        setPainted({ ...newPainted });
      } else if (step.action === "BACK") {
        const backDir = ((dir + 2) % 4) as Direction;
        let newX = pos.x + DIRECTION_DX[backDir];
        let newY = pos.y + DIRECTION_DY[backDir];
        newX = ((newX % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;
        newY = ((newY % GRID_SIZE) + GRID_SIZE) % GRID_SIZE;
        pos = { x: newX, y: newY };
        setPlayerPos({ ...pos });
        paintCell(pos.x, pos.y);
        setPainted({ ...newPainted });
      }

      await new Promise((r) => setTimeout(r, STEP_DELAY));
    }

    setExecutingPath(null);
    setGameState("done");
    runningRef.current = false;
  }, [actionTree, penColorAtAction]);

  const insideLoop = insertPath.length > 0;

  return (
    <div className="flex flex-col gap-4 w-full">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="px-3 py-1.5 rounded-lg border border-gray-300 text-gray-500 hover:text-gray-800 hover:border-gray-400 transition-colors text-sm"
        >
          &larr; メニュー
        </Link>
        <h1 className="text-xl font-bold text-gray-800">Draw Mode</h1>
        <span className="ml-auto text-sm text-gray-400">
          {flattenActions(actionTree).length} ステップ
        </span>
      </div>

      {/* 3-column layout */}
      <div className="flex gap-4 items-start">
        {/* Left panel: Cards */}
        <div className="flex flex-col gap-3 w-52 shrink-0">
          {/* Pen Color */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">Pen Color</p>
            <div className="grid grid-cols-4 gap-2">
              {PEN_COLORS.map((c) => (
                <button
                  key={c.value}
                  onClick={() => { setPenColor(c.value); if (gameState === "planning") setPenColorAtAction(c.value); }}
                  className={`w-full aspect-square rounded-lg border-3 transition-transform ${
                    penColor === c.value ? "border-gray-800 scale-110" : "border-gray-300"
                  }`}
                  style={{ backgroundColor: c.value }}
                  title={c.name}
                />
              ))}
            </div>
          </div>

          {/* Action Cards */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">ACTION CARDS</p>
            <div className="grid grid-cols-2 gap-2">
              {ACTION_CARDS.map((card) => (
                <button
                  key={card.id}
                  onClick={() => addAction(card.id as SimpleAction)}
                  disabled={gameState !== "planning"}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-colors ${
                    gameState === "planning" ? card.color : "bg-gray-100 border-gray-300 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <span className="text-2xl">{card.icon}</span>
                  <span className="text-xs font-bold">{card.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Loop Cards */}
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">くり返しカード</p>
            <div className="grid grid-cols-4 gap-2">
              {LOOP_COUNTS.map((n) => (
                <button
                  key={n}
                  onClick={() => addLoop(n)}
                  disabled={gameState !== "planning"}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg border-2 transition-colors ${
                    gameState === "planning"
                      ? "bg-cyan-100 border-cyan-400 hover:bg-cyan-200"
                      : "bg-gray-100 border-gray-300 opacity-50 cursor-not-allowed"
                  }`}
                >
                  <span className="text-lg">{"\uD83D\uDD04"}</span>
                  <span className="text-xs font-bold">x{n}</span>
                </button>
              ))}
            </div>
            {insideLoop && gameState === "planning" && (
              <button
                onClick={exitLoop}
                className="mt-2 w-full py-2 rounded-lg border-2 border-cyan-400 bg-cyan-50 hover:bg-cyan-100 text-sm font-bold text-cyan-700 transition-colors"
              >
                {"\u2934"} おわり
              </button>
            )}
            {insideLoop && gameState === "planning" && (
              <div className="mt-1 text-xs text-cyan-600">
                ループの中に追加中 (深さ {insertPath.length})
              </div>
            )}
          </div>
        </div>

        {/* Center: Grid Canvas */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="grid border-2 border-gray-800 shadow-lg rounded-lg overflow-hidden"
            style={{
              gridTemplateColumns: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
              gridTemplateRows: `repeat(${GRID_SIZE}, ${CELL_SIZE}px)`,
            }}
          >
            {Array.from({ length: GRID_SIZE }, (_, y) =>
              Array.from({ length: GRID_SIZE }, (_, x) => {
                const isPlayer = playerPos.x === x && playerPos.y === y;
                const cellData = painted[`${x},${y}`];
                const bgColor = cellData ? getCellColor(cellData) : "#fafaf9";

                return (
                  <div
                    key={`${x}-${y}`}
                    className="relative flex items-center justify-center border border-gray-200"
                    style={{
                      width: CELL_SIZE,
                      height: CELL_SIZE,
                      backgroundColor: bgColor,
                    }}
                  >
                    {cellData && !isPlayer && (
                      <span className="text-[10px] text-gray-500 opacity-60 absolute bottom-0.5 right-1">
                        {cellData.level}
                      </span>
                    )}
                    {isPlayer && (
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-500 text-white text-xl shadow-md border-2 border-blue-700 z-10">
                        {DIRECTION_ARROWS[playerDir]}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
          <div className="text-center text-sm text-gray-500">
            Facing: {DIRECTION_LABELS[playerDir]} {DIRECTION_ARROWS[playerDir]}
            {" | "}Position: ({playerPos.x}, {playerPos.y})
          </div>
        </div>

        {/* Right panel: Action Queue + Buttons */}
        <div className="flex flex-col gap-3 w-52 shrink-0">
          <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider">プログラム</p>
              {actionTree.length > 0 && (
                <span className="text-xs text-gray-400 font-mono">{actionTree.length} 個</span>
              )}
            </div>
            <div className="flex flex-col gap-1 max-h-72 overflow-y-auto pr-1">
              {actionTree.length === 0 && (
                <p className="text-sm text-gray-400 italic">カードを選んでプログラムを作ろう</p>
              )}
              <QueueList
                items={actionTree}
                depth={0}
                executingPath={executingPath}
                planning={gameState === "planning"}
                onRemove={removeItem}
              />
            </div>
          </div>

          {gameState === "planning" && (
            <>
              <button
                onClick={executeActions}
                disabled={actionTree.length === 0}
                className={`w-full py-3 rounded-xl font-bold text-white text-lg shadow-md transition-colors ${
                  actionTree.length > 0
                    ? "bg-red-500 hover:bg-red-600"
                    : "bg-gray-300 cursor-not-allowed"
                }`}
              >
                ▶ Action!
              </button>

              <div className="flex gap-2">
                <button
                  onClick={undoAction}
                  disabled={actionTree.length === 0}
                  className={`flex-1 py-2 rounded-xl font-bold text-sm border transition-colors ${
                    actionTree.length > 0
                      ? "text-gray-600 border-gray-300 hover:bg-gray-100"
                      : "text-gray-300 border-gray-200 cursor-not-allowed"
                  }`}
                >
                  ↩ 元に戻す
                </button>
                <button
                  onClick={() => { setActionTree([]); setInsertPath([]); }}
                  disabled={actionTree.length === 0}
                  className={`flex-1 py-2 rounded-xl font-bold text-sm border transition-colors ${
                    actionTree.length > 0
                      ? "text-gray-600 border-gray-300 hover:bg-gray-100"
                      : "text-gray-300 border-gray-200 cursor-not-allowed"
                  }`}
                >
                  全削除
                </button>
              </div>

              <button
                onClick={clearCanvas}
                className="w-full py-2 rounded-xl font-bold text-gray-600 border border-gray-300 hover:bg-gray-100 transition-colors text-sm"
              >
                キャンバスをクリア
              </button>
            </>
          )}

          {gameState === "running" && (
            <div className="w-full py-3 rounded-xl font-bold text-center text-orange-600 bg-orange-50 border border-orange-200 text-sm animate-pulse">
              実行中...
            </div>
          )}

          {gameState === "done" && (
            <div className="flex flex-col gap-2">
              <button
                onClick={retry}
                className="w-full py-3 rounded-xl font-bold text-white text-lg shadow-md bg-blue-500 hover:bg-blue-600 transition-colors"
              >
                ↻ リトライ
              </button>
              <button
                onClick={backToEdit}
                className="w-full py-2 rounded-xl font-bold text-sm text-gray-600 border border-gray-300 hover:bg-gray-100 transition-colors"
              >
                ✏ プログラムを編集
              </button>
              <button
                onClick={resetAll}
                className="w-full py-2 rounded-xl font-bold text-sm text-red-500 border border-red-300 hover:bg-red-50 transition-colors"
              >
                すべてリセット
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
