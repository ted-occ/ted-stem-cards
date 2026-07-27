import { Metadata } from "next";
import { decodeProgram } from "@/lib/ball-shared";
import { LEVELS, decodeObstacles, decodeBranchCells } from "@/lib/levels";
import { parseReception } from "@/lib/reception";
import ReplayScene from "./ReplayScene";
import ReceptionPanel from "./ReceptionPanel";

// 受付情報(整理番号・氏名)がクエリに含まれるため検索エンジンに拾わせない。
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

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
  // Reception params
  const rt = typeof params.rt === "string" ? params.rt : "";
  const rn = typeof params.rn === "string" ? params.rn : "";
  const rs = typeof params.rs === "string" ? params.rs : "";

  const steps = decodeProgram(p);
  const reception = parseReception({ rt, rn, rs });

  if (steps.length === 0) {
    return <ReceptionPanel reception={reception} />;
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
      reception={reception}
    />
  );
}
