"use client";

import { useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import {
  CELL_SIZE,
  BALL_RADIUS,
  CAMERA_3D,
  CAMERA_2D,
  makeShaderMaterial,
  PatternConfig,
} from "@/lib/ball-shared";
import { BranchCell } from "@/lib/levels";

export function CameraController({ is2D, gridSize = 3 }: { is2D: boolean; gridSize?: number }) {
  const { camera, size, gl } = useThree();
  const target = is2D ? CAMERA_2D : CAMERA_3D;
  const currentPos = useRef(new THREE.Vector3(...CAMERA_3D.pos));
  const currentLookAt = useRef(new THREE.Vector3(...CAMERA_3D.lookAt));
  const currentUp = useRef(new THREE.Vector3(...CAMERA_3D.up));
  const zoomRef = useRef(1);

  useEffect(() => {
    const canvas = gl.domElement;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 1.1 : 0.9;
      zoomRef.current = Math.max(0.3, Math.min(3, zoomRef.current * delta));
    };
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", handleWheel);
  }, [gl]);

  useFrame((_state, delta) => {
    const aspect = size.width / size.height;
    // Pull camera back for portrait screens so the full board is visible
    let scale = aspect < 1 ? 1 / aspect : 1;
    // Scale camera distance for larger grids
    scale *= gridSize / 3;
    // Apply user zoom
    scale *= zoomRef.current;

    const basePos = new THREE.Vector3(...target.pos);
    const lookAt = new THREE.Vector3(...target.lookAt);
    // Scale the offset from lookAt point
    const offset = basePos.clone().sub(lookAt).multiplyScalar(scale);
    const targetPos = lookAt.clone().add(offset);

    const targetUp = new THREE.Vector3(...target.up);
    const speed = 4 * delta;

    currentPos.current.lerp(targetPos, speed);
    currentLookAt.current.lerp(lookAt, speed);
    currentUp.current.lerp(targetUp, speed).normalize();

    camera.position.copy(currentPos.current);
    camera.up.copy(currentUp.current);
    camera.lookAt(currentLookAt.current);
  });

  return null;
}

export function Board({ gridSize = 3 }: { gridSize?: number }) {
  const boardSize = CELL_SIZE * gridSize;
  const borderWidth = 0.15;
  const frameSize = boardSize + borderWidth * 2;
  const offset = (gridSize - 1) / 2;

  const cells = [];
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const isDark = (row + col) % 2 === 0;
      cells.push(
        <mesh
          key={`${row}-${col}`}
          position={[
            (col - offset) * CELL_SIZE,
            0.01,
            (row - offset) * CELL_SIZE,
          ]}
          rotation={[-Math.PI / 2, 0, 0]}
          receiveShadow
        >
          <planeGeometry args={[CELL_SIZE, CELL_SIZE]} />
          <meshStandardMaterial color={isDark ? "#555566" : "#e0d8c8"} />
        </mesh>
      );
    }
  }
  return (
    <>
      <mesh position={[0, -0.02, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[frameSize, frameSize]} />
        <meshStandardMaterial color="#8B6914" roughness={0.7} />
      </mesh>
      {cells}
    </>
  );
}

/** Shared scene environment: background, fog, lights */
export function SceneLighting({ gridSize = 3 }: { gridSize?: number }) {
  const fogScale = gridSize / 3;
  return (
    <>
      <color attach="background" args={["#0d0d14"]} />
      <fog attach="fog" args={["#0d0d14", 8 * fogScale, 18 * fogScale]} />
      <ambientLight intensity={1.0} />
      <directionalLight
        position={[3, 6, 4]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.5}
        shadow-camera-far={20}
        shadow-camera-left={-4}
        shadow-camera-right={4}
        shadow-camera-top={4}
        shadow-camera-bottom={-4}
        shadow-bias={-0.002}
      />
      <pointLight position={[0, 3, 0]} intensity={0.3} color="#aaccff" />
    </>
  );
}

export function Ground() {
  return (
    <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[20, 20]} />
      <meshStandardMaterial color="#1a1a24" roughness={1} />
    </mesh>
  );
}

/** Pulsing ring marker for start/goal cells */
export function CellMarker({
  col,
  row,
  color,
  gridSize = 3,
}: {
  col: number;
  row: number;
  color: string;
  gridSize?: number;
}) {
  const ringRef = useRef<THREE.Mesh>(null);
  const glowRef = useRef<THREE.Mesh>(null);
  const offset = (gridSize - 1) / 2;

  useFrame(() => {
    if (!ringRef.current || !glowRef.current) return;
    const t = performance.now() / 1000;
    ringRef.current.scale.setScalar(0.8 + 0.2 * Math.sin(t * 3));
    (glowRef.current.material as THREE.MeshStandardMaterial).opacity = 0.15 + 0.1 * Math.sin(t * 3);
  });

  const x = (col - offset) * CELL_SIZE;
  const z = (row - offset) * CELL_SIZE;

  return (
    <group position={[x, 0.02, z]}>
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[CELL_SIZE * 0.45, 32]} />
        <meshStandardMaterial color={color} transparent opacity={0.2} />
      </mesh>
      <mesh ref={ringRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[CELL_SIZE * 0.3, CELL_SIZE * 0.4, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
}

/** Canvas-based text sprite for start/goal labels */
export function TextSprite({
  col,
  row,
  text,
  color,
  gridSize = 3,
}: {
  col: number;
  row: number;
  text: string;
  color: string;
  gridSize?: number;
}) {
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 128, 64);
    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText(text, 64, 32);
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  }, [text, color]);

  const offset = (gridSize - 1) / 2;
  const x = (col - offset) * CELL_SIZE;
  const z = (row - offset) * CELL_SIZE;

  return (
    <sprite position={[x, 0.8, z]} scale={[0.7, 0.35, 1]}>
      <spriteMaterial map={texture} transparent />
    </sprite>
  );
}

/** Obstacle marker — red translucent block */
export function ObstacleMarker({
  col,
  row,
  gridSize = 5,
}: {
  col: number;
  row: number;
  gridSize?: number;
}) {
  const offset = (gridSize - 1) / 2;
  const x = (col - offset) * CELL_SIZE;
  const z = (row - offset) * CELL_SIZE;
  const blockSize = CELL_SIZE * 0.7;
  const blockHeight = 0.3;

  return (
    <group position={[x, blockHeight / 2 + 0.01, z]}>
      <mesh castShadow>
        <boxGeometry args={[blockSize, blockHeight, blockSize]} />
        <meshStandardMaterial color="#cc3333" transparent opacity={0.7} roughness={0.5} />
      </mesh>
    </group>
  );
}

/** Branch cell marker — pulsing "?" on the board surface, same style as CellMarker */
export function BranchMarker({
  branchCell,
  gridSize = 5,
}: {
  branchCell: BranchCell;
  gridSize?: number;
  highlightDir?: string | null;
}) {
  const glowRef = useRef<THREE.Mesh>(null);
  const offset = (gridSize - 1) / 2;
  const x = (branchCell.col - offset) * CELL_SIZE;
  const z = (branchCell.row - offset) * CELL_SIZE;
  const color = "#bb66ff";

  useFrame(() => {
    if (!glowRef.current) return;
    const t = performance.now() / 1000;
    (glowRef.current.material as THREE.MeshStandardMaterial).opacity = 0.18 + 0.1 * Math.sin(t * 3);
  });

  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, 128, 128);
    ctx.font = "bold 96px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = color;
    ctx.fillText("?", 64, 64);
    return new THREE.CanvasTexture(canvas);
  }, []);

  return (
    <group position={[x, 0.02, z]}>
      {/* Pulsing glow circle */}
      <mesh ref={glowRef} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[CELL_SIZE * 0.45, 32]} />
        <meshStandardMaterial color={color} transparent opacity={0.2} />
      </mesh>
      {/* "?" decal on the board */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[CELL_SIZE * 0.7, CELL_SIZE * 0.7]} />
        <meshStandardMaterial map={texture} transparent />
      </mesh>
    </group>
  );
}

export interface AnimState {
  fromX: number;
  fromZ: number;
  toX: number;
  toZ: number;
  rotAxisX: number;
  rotAxisZ: number;
  progress: number;
}

const PARTICLE_COUNT = 12;

interface BurstParticle {
  vel: THREE.Vector3;
  pos: THREE.Vector3;
}

export function Sphere({
  gridCol,
  gridRow,
  jumping,
  bursting,
  onAnimDone,
  onJumpDone,
  onBurstDone,
  patternConfig,
  gridSize = 3,
}: {
  gridCol: number;
  gridRow: number;
  jumping?: boolean;
  bursting?: boolean;
  onAnimDone: () => void;
  onJumpDone?: () => void;
  onBurstDone?: () => void;
  patternConfig: PatternConfig;
  gridSize?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const particlesRef = useRef<THREE.Group>(null);
  const animRef = useRef<AnimState | null>(null);
  const jumpRef = useRef<{ bounce: number; progress: number } | null>(null);
  const burstRef = useRef<{ progress: number; particles: BurstParticle[] } | null>(null);
  const prevPos = useRef({ col: gridCol, row: gridRow });
  const cumulativeRotation = useRef(new THREE.Quaternion());
  const gridOffset = (gridSize - 1) / 2;

  const ANIM_SPEED = 4;
  const JUMP_SPEED = 3;
  const JUMP_HEIGHT = BALL_RADIUS * 2.5;
  const BOUNCE_COUNT = 3;
  const BURST_EXPAND_DURATION = 0.1;
  const BURST_SCATTER_DURATION = 0.6;
  const BURST_TOTAL = BURST_EXPAND_DURATION + BURST_SCATTER_DURATION;

  // Start jump animation
  useEffect(() => {
    if (jumping && !jumpRef.current) {
      jumpRef.current = { bounce: 0, progress: 0 };
    }
  }, [jumping]);

  // Start burst animation
  useEffect(() => {
    if (bursting && !burstRef.current) {
      const particles: BurstParticle[] = [];
      for (let i = 0; i < PARTICLE_COUNT; i++) {
        const theta = (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const phi = Math.random() * Math.PI * 0.8 + 0.1;
        const speed = 2 + Math.random() * 2;
        particles.push({
          vel: new THREE.Vector3(
            Math.sin(phi) * Math.cos(theta) * speed,
            Math.cos(phi) * speed * 0.8 + 1,
            Math.sin(phi) * Math.sin(theta) * speed,
          ),
          pos: new THREE.Vector3(0, 0, 0),
        });
      }
      burstRef.current = { progress: 0, particles };
    }
  }, [bursting]);

  useEffect(() => {
    const prevCol = prevPos.current.col;
    const prevRow = prevPos.current.row;
    if (prevCol === gridCol && prevRow === gridRow) return;

    const fromX = (prevCol - gridOffset) * CELL_SIZE;
    const fromZ = (prevRow - gridOffset) * CELL_SIZE;
    const toX = (gridCol - gridOffset) * CELL_SIZE;
    const toZ = (gridRow - gridOffset) * CELL_SIZE;

    const dx = gridCol - prevCol;
    const dz = gridRow - prevRow;

    animRef.current = {
      fromX,
      fromZ,
      toX,
      toZ,
      rotAxisX: dz,
      rotAxisZ: -dx,
      progress: 0,
    };

    prevPos.current = { col: gridCol, row: gridRow };
  }, [gridCol, gridRow]);

  useFrame((_state, delta) => {
    if (!groupRef.current || !innerRef.current) return;

    // Jump animation with bounces
    const jump = jumpRef.current;
    let jumpY = 0;
    if (jump) {
      // Each bounce gets smaller: height * (0.4 ^ bounce)
      const heightScale = Math.pow(0.4, jump.bounce);
      const bounceHeight = JUMP_HEIGHT * heightScale;
      // Each bounce gets faster
      const speedScale = 1 + jump.bounce * 0.5;

      jump.progress += delta * JUMP_SPEED * speedScale;
      const jt = Math.min(jump.progress, 1);
      // Parabolic arc
      jumpY = bounceHeight * 4 * jt * (1 - jt);

      if (jt >= 1) {
        jump.bounce++;
        if (jump.bounce >= BOUNCE_COUNT) {
          jumpRef.current = null;
          jumpY = 0;
          onJumpDone?.();
        } else {
          jump.progress = 0;
          jumpY = 0;
        }
      }
    }

    // Burst animation
    const burst = burstRef.current;
    if (burst && particlesRef.current) {
      burst.progress += delta;
      const t = burst.progress;

      if (t < BURST_EXPAND_DURATION) {
        // Phase 1: quick expand
        const et = t / BURST_EXPAND_DURATION;
        innerRef.current.scale.setScalar(1 + et * 0.4);
      } else {
        // Phase 2: ball invisible, particles scatter
        innerRef.current.scale.setScalar(0);
        const st = (t - BURST_EXPAND_DURATION) / BURST_SCATTER_DURATION;
        const clampedSt = Math.min(st, 1);

        const children = particlesRef.current.children;
        for (let i = 0; i < burst.particles.length; i++) {
          const p = burst.particles[i];
          const child = children[i] as THREE.Mesh;
          if (!child) continue;
          // Apply gravity
          const elapsed = t - BURST_EXPAND_DURATION;
          const px = p.vel.x * elapsed;
          const py = p.vel.y * elapsed - 4.9 * elapsed * elapsed;
          const pz = p.vel.z * elapsed;
          child.position.set(px, py, pz);
          // Fade out by shrinking
          const fadeScale = 1 - clampedSt;
          child.scale.setScalar(fadeScale);
          child.visible = true;
        }
      }

      if (t >= BURST_TOTAL) {
        burstRef.current = null;
        innerRef.current.scale.setScalar(1);
        // Hide particles
        if (particlesRef.current) {
          for (const child of particlesRef.current.children) {
            (child as THREE.Mesh).visible = false;
            (child as THREE.Mesh).scale.setScalar(1);
            child.position.set(0, 0, 0);
          }
        }
        onBurstDone?.();
      }
    }

    // Move animation
    const anim = animRef.current;
    if (!anim) {
      // Update Y for jump even when not moving
      groupRef.current.position.y = BALL_RADIUS + jumpY;
      return;
    }

    anim.progress += delta * ANIM_SPEED;
    const t = Math.min(anim.progress, 1);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

    const x = anim.fromX + (anim.toX - anim.fromX) * eased;
    const z = anim.fromZ + (anim.toZ - anim.fromZ) * eased;
    groupRef.current.position.set(x, BALL_RADIUS + jumpY, z);

    const totalDist = Math.sqrt(
      (anim.toX - anim.fromX) ** 2 + (anim.toZ - anim.fromZ) ** 2
    );
    const totalAngle = totalDist / BALL_RADIUS;
    const currentAngle = totalAngle * eased;

    const axis = new THREE.Vector3(anim.rotAxisX, 0, anim.rotAxisZ).normalize();
    const rollQuat = new THREE.Quaternion().setFromAxisAngle(axis, currentAngle);
    const combined = rollQuat.multiply(cumulativeRotation.current.clone());
    innerRef.current.quaternion.copy(combined);

    if (t >= 1) {
      cumulativeRotation.current.copy(innerRef.current.quaternion);
      animRef.current = null;
      onAnimDone();
    }
  });

  const material = useMemo(() => makeShaderMaterial(patternConfig), [patternConfig]);
  const particleMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: patternConfig.color1 }),
    [patternConfig.color1],
  );

  const initX = (gridCol - gridOffset) * CELL_SIZE;
  const initZ = (gridRow - gridOffset) * CELL_SIZE;

  return (
    <group ref={groupRef} position={[initX, BALL_RADIUS, initZ]}>
      <group ref={innerRef}>
        <mesh material={material} castShadow>
          <sphereGeometry args={[BALL_RADIUS, 64, 64]} />
        </mesh>
      </group>
      <group ref={particlesRef}>
        {Array.from({ length: PARTICLE_COUNT }).map((_, i) => (
          <mesh key={i} material={particleMaterial} visible={false}>
            <sphereGeometry args={[BALL_RADIUS * 0.2, 8, 8]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
