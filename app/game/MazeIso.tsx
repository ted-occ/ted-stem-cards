"use client";
import { useEffect, useRef, useCallback } from "react";
import { TileType, TILE, MAP_WIDTH, MAP_HEIGHT } from "./map-data";

const TW = 52;
const TH = 26;
const WH = 34;

// Map center pivot for rotation
const CX = (MAP_WIDTH - 1) / 2;   // 4.5
const CY = (MAP_HEIGHT - 1) / 2;  // 4.5

// Canvas size (wider to accommodate rotation)
export const ISO_W = 600;
export const ISO_H = 380;

// Where map center projects on canvas
const CSX = ISO_W / 2;   // 300
const CSY = 170;

// World direction unit vectors [dx, dy] for UP/RIGHT/DOWN/LEFT
const WORLD_DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

function toScreen(gx: number, gy: number, az: number, el: number) {
  const rx = gx - CX;
  const ry = gy - CY;
  const rrx = rx * Math.cos(az) - ry * Math.sin(az);
  const rry = rx * Math.sin(az) + ry * Math.cos(az);
  return {
    sx: CSX + (rrx - rry) * (TW / 2),
    sy: CSY + (rrx + rry) * (TH / 2) * el,
  };
}

function rotatedDepth(gx: number, gy: number, az: number): number {
  const rx = gx - CX;
  const ry = gy - CY;
  return (rx * Math.cos(az) - ry * Math.sin(az)) + (rx * Math.sin(az) + ry * Math.cos(az));
}

function drawFloor(
  ctx: CanvasRenderingContext2D,
  gx: number, gy: number,
  az: number, el: number,
  tile: TileType
) {
  const color =
    tile === TILE.START ? "#86efac" :
    tile === TILE.GOAL  ? "#fde047" :
    "#ede9e0";

  const p00 = toScreen(gx,     gy,     az, el);
  const p10 = toScreen(gx + 1, gy,     az, el);
  const p11 = toScreen(gx + 1, gy + 1, az, el);
  const p01 = toScreen(gx,     gy + 1, az, el);

  ctx.beginPath();
  ctx.moveTo(p00.sx, p00.sy);
  ctx.lineTo(p10.sx, p10.sy);
  ctx.lineTo(p11.sx, p11.sy);
  ctx.lineTo(p01.sx, p01.sy);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "rgba(0,0,0,0.07)";
  ctx.lineWidth = 0.5;
  ctx.stroke();
}

function drawWall(
  ctx: CanvasRenderingContext2D,
  gx: number, gy: number,
  az: number, el: number
) {
  // Normalize az to [0, 2π)
  const a = ((az % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);

  // Choose 2 visible side faces based on viewing quadrant
  let face1: [[number, number], [number, number]];
  let face2: [[number, number], [number, number]];
  let color1: string;
  let color2: string;

  if (a < Math.PI / 2) {
    // Viewing from SE: +x (right) and +y (back-left) faces visible
    face1 = [[gx + 1, gy], [gx + 1, gy + 1]];
    face2 = [[gx,     gy + 1], [gx + 1, gy + 1]];
    color1 = "#1e2939"; color2 = "#3d4a5c";
  } else if (a < Math.PI) {
    // Viewing from SW: -x (left) and +y (back-right) faces visible
    face1 = [[gx, gy], [gx, gy + 1]];
    face2 = [[gx, gy + 1], [gx + 1, gy + 1]];
    color1 = "#4b5a6e"; color2 = "#3d4a5c";
  } else if (a < 1.5 * Math.PI) {
    // Viewing from NW: -x (front-right) and -y (front-left) faces visible
    face1 = [[gx, gy], [gx, gy + 1]];
    face2 = [[gx, gy], [gx + 1, gy]];
    color1 = "#4b5a6e"; color2 = "#2a3850";
  } else {
    // Viewing from NE: +x (front-left) and -y (front-right) faces visible
    face1 = [[gx + 1, gy], [gx + 1, gy + 1]];
    face2 = [[gx, gy], [gx + 1, gy]];
    color1 = "#1e2939"; color2 = "#2a3850";
  }

  // Draw the two side faces (face2 first so face1 overlaps it at edges)
  for (const [face, color] of [[face2, color2], [face1, color1]] as [[[number,number],[number,number]], string][]) {
    const b0 = toScreen(face[0][0], face[0][1], az, el);
    const b1 = toScreen(face[1][0], face[1][1], az, el);
    ctx.beginPath();
    ctx.moveTo(b0.sx,       b0.sy);
    ctx.lineTo(b1.sx,       b1.sy);
    ctx.lineTo(b1.sx,       b1.sy - WH);
    ctx.lineTo(b0.sx,       b0.sy - WH);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  // Top face
  const t00 = toScreen(gx,     gy,     az, el);
  const t10 = toScreen(gx + 1, gy,     az, el);
  const t11 = toScreen(gx + 1, gy + 1, az, el);
  const t01 = toScreen(gx,     gy + 1, az, el);
  ctx.beginPath();
  ctx.moveTo(t00.sx, t00.sy - WH);
  ctx.lineTo(t10.sx, t10.sy - WH);
  ctx.lineTo(t11.sx, t11.sy - WH);
  ctx.lineTo(t01.sx, t01.sy - WH);
  ctx.closePath();
  ctx.fillStyle = "#4b5a6e";
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 0.5;
  ctx.fill();
  ctx.stroke();
}

function drawPlayer(
  ctx: CanvasRenderingContext2D,
  gx: number, gy: number,
  dir: number,
  az: number, el: number
) {
  // Center of tile top face
  const center = toScreen(gx + 0.5, gy + 0.5, az, el);
  const cx = center.sx;
  const cy = center.sy;

  // Drop shadow
  ctx.save();
  ctx.globalAlpha = 0.18;
  ctx.beginPath();
  ctx.ellipse(cx, cy, TW / 4, TH / 5, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.restore();

  // Body sphere
  const bodyY = cy - 14;
  const r = 10;
  const grad = ctx.createRadialGradient(cx - 2, bodyY - 3, 1, cx, bodyY, r);
  grad.addColorStop(0, "#93c5fd");
  grad.addColorStop(1, "#1d4ed8");
  ctx.beginPath();
  ctx.arc(cx, bodyY, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = "#1e40af";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Direction dot (project world direction to screen direction)
  const [wdx, wdy] = WORLD_DIRS[dir];
  const ahead = toScreen(gx + 0.5 + wdx * 0.5, gy + 0.5 + wdy * 0.5, az, el);
  const ddx = ahead.sx - cx;
  const ddy = ahead.sy - cy;
  const norm = Math.sqrt(ddx * ddx + ddy * ddy) || 1;
  ctx.beginPath();
  ctx.arc(cx + (ddx / norm) * r * 0.65, bodyY + (ddy / norm) * r * 0.65, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = "white";
  ctx.fill();
}

interface Props {
  map: TileType[][];
  playerPos: { x: number; y: number };
  playerDir: number;
}

export default function MazeIso({ map, playerPos, playerDir }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const azRef = useRef(0);
  const elRef = useRef(1.0);
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  const drawScene = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const az = azRef.current;
    const el = elRef.current;

    ctx.clearRect(0, 0, ISO_W, ISO_H);
    ctx.fillStyle = "#f8f7f4";
    ctx.fillRect(0, 0, ISO_W, ISO_H);

    // Collect all cells and sort by depth (painter's algorithm)
    const cells: { x: number; y: number }[] = [];
    for (let y = 0; y < MAP_HEIGHT; y++)
      for (let x = 0; x < MAP_WIDTH; x++)
        cells.push({ x, y });

    cells.sort((a, b) => {
      const da = rotatedDepth(a.x, a.y, az);
      const db = rotatedDepth(b.x, b.y, az);
      return da !== db ? da - db : (a.x - b.x);
    });

    for (const { x, y } of cells) {
      const tile = map[y][x];
      if (tile === TILE.WALL) drawWall(ctx, x, y, az, el);
      else drawFloor(ctx, x, y, az, el, tile);
    }

    drawPlayer(ctx, playerPos.x, playerPos.y, playerDir, az, el);
  }, [map, playerPos, playerDir]);

  // Store latest drawScene in ref so mouse handlers always use current version
  const drawSceneRef = useRef(drawScene);
  useEffect(() => { drawSceneRef.current = drawScene; }, [drawScene]);

  // Redraw whenever props change
  useEffect(() => {
    drawScene();
  }, [drawScene]);

  // Mouse handlers
  const onMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.style.cursor = "grabbing";
  }, []);

  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY };

    // Horizontal drag → rotate azimuth
    azRef.current += dx * 0.008;

    // Vertical drag → adjust elevation (clamp to reasonable range)
    elRef.current = Math.max(0.4, Math.min(2.0, elRef.current - dy * 0.005));

    drawSceneRef.current();
  }, []);

  const onMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    e.currentTarget.style.cursor = "grab";
  }, []);

  const onMouseLeave = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    e.currentTarget.style.cursor = "grab";
  }, []);

  return (
    <div className="relative select-none">
      <canvas
        ref={canvasRef}
        width={ISO_W}
        height={ISO_H}
        style={{ width: ISO_W, height: ISO_H, cursor: "grab" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseLeave}
      />
      <div className="absolute bottom-1 right-2 text-xs text-stone-400 pointer-events-none">
        ドラッグで視点変更
      </div>
    </div>
  );
}
