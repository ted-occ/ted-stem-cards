"use client";
import { useEffect, useRef } from "react";
import { TileType, TILE, MAP_WIDTH, MAP_HEIGHT } from "./map-data";

export const FPS_W = 520;
export const FPS_H = 220;

const FOV = Math.PI / 1.8;   // ~100° horizontal FOV
const NUM_RAYS = FPS_W;

// World direction angles in standard math coords (x+ = right, y+ = down in screen)
// 0=UP(dy=-1), 1=RIGHT(dx=+1), 2=DOWN(dy=+1), 3=LEFT(dx=-1)
const DIR_ANGLE = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];
const DIR_LABELS = ["北 ↑", "東 →", "南 ↓", "西 ←"];

interface RayHit {
  dist: number;
  side: 0 | 1;  // 0 = vertical wall face (E/W), 1 = horizontal wall face (N/S)
}

function castRay(
  map: TileType[][],
  px: number,
  py: number,
  angle: number
): RayHit {
  const cosA = Math.cos(angle);
  const sinA = Math.sin(angle);

  let mapX = Math.floor(px);
  let mapY = Math.floor(py);

  const stepX = cosA >= 0 ? 1 : -1;
  const stepY = sinA >= 0 ? 1 : -1;

  const deltaDistX = cosA === 0 ? 1e30 : Math.abs(1 / cosA);
  const deltaDistY = sinA === 0 ? 1e30 : Math.abs(1 / sinA);

  let sideDistX =
    cosA >= 0 ? (mapX + 1 - px) * deltaDistX : (px - mapX) * deltaDistX;
  let sideDistY =
    sinA >= 0 ? (mapY + 1 - py) * deltaDistY : (py - mapY) * deltaDistY;

  let side: 0 | 1 = 0;

  for (let step = 0; step < 32; step++) {
    if (sideDistX < sideDistY) {
      sideDistX += deltaDistX;
      mapX += stepX;
      side = 0;
    } else {
      sideDistY += deltaDistY;
      mapY += stepY;
      side = 1;
    }

    if (mapX < 0 || mapX >= MAP_WIDTH || mapY < 0 || mapY >= MAP_HEIGHT) {
      return { dist: 20, side };
    }

    if (map[mapY][mapX] === TILE.WALL) {
      const perpDist =
        side === 0
          ? (mapX - px + (1 - stepX) / 2) / cosA
          : (mapY - py + (1 - stepY) / 2) / sinA;
      return { dist: Math.abs(perpDist), side };
    }
  }

  return { dist: 20, side: 0 };
}

interface Props {
  map: TileType[][];
  playerPos: { x: number; y: number };
  playerDir: number;
  goalPos: { x: number; y: number };
}

export default function MazeFPS({ map, playerPos, playerDir, goalPos }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, FPS_W, FPS_H);

    // --- Ceiling ---
    const ceilGrad = ctx.createLinearGradient(0, 0, 0, FPS_H / 2);
    ceilGrad.addColorStop(0, "#0f2540");
    ceilGrad.addColorStop(1, "#1d4b7a");
    ctx.fillStyle = ceilGrad;
    ctx.fillRect(0, 0, FPS_W, FPS_H / 2);

    // --- Floor ---
    const floorGrad = ctx.createLinearGradient(0, FPS_H / 2, 0, FPS_H);
    floorGrad.addColorStop(0, "#2e2820");
    floorGrad.addColorStop(1, "#141210");
    ctx.fillStyle = floorGrad;
    ctx.fillRect(0, FPS_H / 2, FPS_W, FPS_H / 2);

    // --- Walls via raycasting ---
    const px = playerPos.x + 0.5;
    const py = playerPos.y + 0.5;
    const viewAngle = DIR_ANGLE[playerDir];

    for (let x = 0; x < NUM_RAYS; x++) {
      const rayAngle = viewAngle - FOV / 2 + (x / NUM_RAYS) * FOV;
      const { dist, side } = castRay(map, px, py, rayAngle);

      const wallH = Math.min(FPS_H * 3, FPS_H / Math.max(0.01, dist) * 1.3);
      const wallTop = (FPS_H - wallH) / 2;

      // Stone wall color: warm tone, distance fog, side shading
      const brightness = Math.max(0, Math.min(255, 200 / (dist + 0.4)));
      const sideFactor = side === 1 ? 0.65 : 1.0;  // N/S faces darker
      const r = Math.floor(brightness * sideFactor * 0.85);
      const g = Math.floor(brightness * sideFactor * 0.72);
      const b = Math.floor(brightness * sideFactor * 0.55);

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, wallTop, 1, wallH);
    }

    // --- Goal direction indicator ---
    const gdx = goalPos.x + 0.5 - px;
    const gdy = goalPos.y + 0.5 - py;
    const goalAngle = Math.atan2(gdy, gdx);
    let relAngle = goalAngle - viewAngle;
    // Normalize to [-π, π]
    while (relAngle > Math.PI) relAngle -= 2 * Math.PI;
    while (relAngle < -Math.PI) relAngle += 2 * Math.PI;

    const goalDist = Math.sqrt(gdx * gdx + gdy * gdy);
    const goalAlpha = Math.max(0.3, Math.min(1.0, 1 - goalDist / 14));

    if (Math.abs(relAngle) < FOV * 0.6) {
      // Goal is roughly in view — draw a golden star at the projected position
      const screenX = FPS_W / 2 + (relAngle / (FOV / 2)) * (FPS_W / 2);
      ctx.save();
      ctx.globalAlpha = goalAlpha;
      ctx.font = "bold 18px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fde047";
      ctx.shadowColor = "#f59e0b";
      ctx.shadowBlur = 12;
      ctx.fillText("★ GOAL", screenX, FPS_H - 14);
      ctx.restore();
    } else {
      // Goal is off-screen — draw an edge arrow
      const arrowChar = relAngle > 0 ? "▶" : "◀";
      const arrowX = relAngle > 0 ? FPS_W - 24 : 24;
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.font = "bold 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "#fde047";
      ctx.shadowColor = "#f59e0b";
      ctx.shadowBlur = 8;
      ctx.fillText(arrowChar + " GOAL", arrowX, FPS_H - 14);
      ctx.restore();
    }

    // --- Crosshair ---
    const cx = FPS_W / 2, cy = FPS_H / 2;
    ctx.strokeStyle = "rgba(255,255,255,0.45)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy);
    ctx.lineTo(cx + 9, cy);
    ctx.moveTo(cx, cy - 9);
    ctx.lineTo(cx, cy + 9);
    ctx.stroke();

    // --- Direction label ---
    ctx.save();
    ctx.font = "bold 11px monospace";
    ctx.textAlign = "left";
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(DIR_LABELS[playerDir], 8, 16);
    ctx.restore();
  }, [map, playerPos, playerDir, goalPos]);

  return (
    <canvas
      ref={canvasRef}
      width={FPS_W}
      height={FPS_H}
      style={{ width: FPS_W, height: FPS_H, display: "block" }}
    />
  );
}
