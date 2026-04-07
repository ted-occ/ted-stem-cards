import { decodeProgram } from "@/lib/ball-shared";
import { LEVELS, decodeObstacles, decodeBranchCells } from "@/lib/levels";
import ReplayScene from "./ReplayScene";

export default async function ReplayPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const p = typeof params.p === "string" ? params.p : "";
  const c1 = typeof params.c1 === "string" ? params.c1 : "";
  const c2 = typeof params.c2 === "string" ? params.c2 : "";
  const s = typeof params.s === "string" ? params.s : "";
  const pt = typeof params.pt === "string" ? params.pt : "";
  const t = typeof params.t === "string" ? params.t : "";
  // Level params
  const lv = typeof params.lv === "string" ? params.lv : "";
  const sc = typeof params.sc === "string" ? params.sc : "";
  const sr = typeof params.sr === "string" ? params.sr : "";
  const gc = typeof params.gc === "string" ? params.gc : "";
  const gr = typeof params.gr === "string" ? params.gr : "";
  const ch = typeof params.ch === "string" ? params.ch : "";
  const ob = typeof params.ob === "string" ? params.ob : "";
  const br = typeof params.br === "string" ? params.br : "";

  const steps = decodeProgram(p);

  if (steps.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-[#0d0d14]">
        <div className="text-center text-white/80 p-8">
          <p className="text-lg font-bold mb-2">No program specified</p>
          <p className="text-sm text-white/50">
            Add a program to the URL, e.g. ?p=UUDLRR
          </p>
        </div>
      </div>
    );
  }

  const hasLevel = sc !== "" && sr !== "" && gc !== "" && gr !== "";
  const levelConfig = lv && LEVELS[lv] ? LEVELS[lv] : null;
  const gridSize = levelConfig?.gridSize ?? 3;
  const obstacles = ob ? decodeObstacles(ob) : [];
  const branchCells = br ? decodeBranchCells(br) : [];

  return (
    <ReplayScene
      steps={steps}
      color1={c1 ? `#${c1}` : undefined}
      color2={c2 ? `#${c2}` : undefined}
      scale={s ? Number(s) : undefined}
      pattern={pt ? Number(pt) : undefined}
      createdAt={t ? Number(t) * 1000 : undefined}
      gridSize={hasLevel ? gridSize : undefined}
      obstacles={obstacles}
      branchCells={branchCells}
      levelInfo={hasLevel ? {
        start: { col: Number(sc), row: Number(sr) },
        goal: { col: Number(gc), row: Number(gr) },
        challenge: ch ? Number(ch) : undefined,
      } : undefined}
    />
  );
}
