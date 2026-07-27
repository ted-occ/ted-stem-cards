"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { IconBall } from "@/app/components/Guide";
import { ReceptionInfo, formatSlotKey } from "@/lib/reception";

interface ReceptionPanelProps {
  reception: ReceptionInfo | null;
}

// 氏名はURLクエリに由来し誰でも書き換えられるため、この画面は本人確認や
// チェックイン済みの証明としては使わない(表示のみの参加者向け案内)。
// このため視覚表現でも「認証済み」を強調しない(公式印章・盾・鍵アイコン等は使わない)。
const NAME_DISPLAY_MAX_LENGTH = 40;

// ページ地色。3Dシーン(app/page.tsx, Scene.tsx)と共通。
// チケット左右の切り欠きをこの色で塗ることで「紙を打ち抜いた」ように見せる。
const PAGE_BG = "#0d0d14";

// ── SVG Icons (Guide.tsx と同じ規約: 24x24 viewBox / strokeWidth 2 / currentColor) ──

function IconCheckCircle({ className = "w-4 h-4", animated = false }: { className?: string; animated?: boolean }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline
        points="8 12.5 10.8 15.3 16 9.4"
        pathLength={1}
        className={animated ? "animate-check-draw" : undefined}
        style={animated ? { strokeDasharray: 1 } : undefined}
      />
    </svg>
  );
}

function IconUser({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconClock({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}

function IconAlertCircle({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="13" />
      <line x1="12" y1="16.5" x2="12" y2="16.5" />
    </svg>
  );
}

// ── 段階表示(stagger) ──
// Guide.tsx の HintBubble / HelpPanel / WelcomePanel と同じ「useState + setTimeout + transition」方式。
// 遅延は要素ごとに transitionDelay(inline style)で与えるため、state は1つで済む。
const revealCls = (visible: boolean) =>
  `transition-all duration-500 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"}`;

// ── 明細セル(お名前 / 体験時間) ──
// flex-1 なので氏名が無い場合は残り1セルが自動で全幅に広がる。条件付きクラス不要。
function DetailCell({
  icon: Icon,
  label,
  value,
}: {
  icon: (p: { className?: string }) => React.ReactElement;
  label: string;
  value: string;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1.5 px-3 py-4">
      <dt className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.14em] text-white/55">
        <Icon className="h-3.5 w-3.5 shrink-0 text-[#f7d488]" />
        <span className="truncate">{label}</span>
      </dt>
      <dd className="line-clamp-2 max-w-full break-words text-center text-lg font-medium leading-snug text-white/90">
        {value}
      </dd>
    </div>
  );
}

export default function ReceptionPanel({ reception }: ReceptionPanelProps) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 40);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="relative flex min-h-screen min-h-dvh w-full items-center justify-center overflow-hidden bg-[#0d0d14] px-5 py-10">
      {/* 環境光。3Dシーンのボール色(#4488ff)とゴール色(#ffaa00)を薄く敷いて本編と地続きにする。
          左右端(=切り欠きの位置)には届かないよう、中央上下から配置している。 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(80% 55% at 50% -10%, rgba(68,136,255,0.20), transparent 70%)," +
            "radial-gradient(70% 45% at 50% 112%, rgba(255,170,0,0.12), transparent 70%)",
        }}
      />

      {/* チケット本体。切り欠きを外にはみ出させるため overflow-hidden は付けない */}
      <div
        className={`relative w-full max-w-sm rounded-3xl border border-white/10 bg-linear-to-b from-[#1c1c29] via-[#15151f] to-[#0f0f17] shadow-[0_30px_80px_-20px_rgba(0,0,0,0.9)] ${revealCls(visible)}`}
        style={{ transitionDelay: "0ms" }}
      >
        {/* 光沢スイープ(1回のみ)。sheen だけをここでクリップする */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden rounded-3xl">
          <div
            className="animate-ticket-sheen absolute inset-y-0 left-0 w-1/3"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.10), transparent)" }}
          />
        </div>

        {reception ? (
          <>
            {/* ── ヘッダー: イベントロゴ ── */}
            <header
              className={`flex flex-col items-center gap-1.5 px-6 pt-7 ${revealCls(visible)}`}
              style={{ transitionDelay: "80ms" }}
            >
              <div className="flex items-center gap-2.5">
                <IconBall className="h-6 w-6 text-[#6ba4ff]" />
                <span className="text-lg font-bold tracking-[0.22em] text-white/90">3D BALL</span>
              </div>
              <span className="text-xs font-medium tracking-[0.16em] text-white/55">
                {t("receptionEventTagline")}
              </span>
            </header>

            <div className="mx-6 mt-5 border-t border-white/10" />

            {/* ── 受付完了バッジ + タイトル ── */}
            <section
              className={`flex flex-col items-center gap-3 px-6 pt-6 ${revealCls(visible)}`}
              style={{ transitionDelay: "180ms" }}
            >
              <div className="relative flex h-12 w-12 items-center justify-center">
                <span
                  aria-hidden="true"
                  className="animate-check-halo absolute inset-0 rounded-full border border-[#f7d488]/45"
                />
                <IconCheckCircle className="h-12 w-12 text-[#f7d488]" animated />
              </div>
              <h1 className="text-xl font-bold tracking-wide text-white">{t("receptionTitle")}</h1>
            </section>

            {/* ── 整理番号(ヒーロー) ── */}
            <section
              className={`flex flex-col items-center gap-2 px-6 pt-6 ${revealCls(visible)}`}
              style={{ transitionDelay: "300ms" }}
            >
              <span className="text-xs font-semibold tracking-[0.22em] text-white/55">
                {t("receptionTicket")}
              </span>
              <span
                className="max-w-full text-center font-bold leading-none tabular-nums tracking-tight text-[#f7d488]"
                style={{
                  fontSize: "clamp(3rem, 18vw, 4.5rem)",
                  textShadow: "0 0 28px rgba(255,170,0,0.35)",
                }}
              >
                {reception.ticketNumber}
              </span>
            </section>

            {/* ── ミシン目 + 左右の切り欠き ── */}
            <div className="relative mt-7 px-6">
              <span
                aria-hidden="true"
                className="absolute -left-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full"
                style={{ backgroundColor: PAGE_BG }}
              />
              <span
                aria-hidden="true"
                className="absolute -right-3 top-1/2 h-6 w-6 -translate-y-1/2 rounded-full"
                style={{ backgroundColor: PAGE_BG }}
              />
              <div className="border-t border-dashed border-white/15" />
            </div>

            {/* ── 明細(お名前 / 体験時間) ── */}
            <dl
              className={`mx-6 mt-6 flex divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.04] ${revealCls(visible)}`}
              style={{ transitionDelay: "400ms" }}
            >
              {reception.name && (
                <DetailCell
                  icon={IconUser}
                  label={t("receptionName")}
                  value={reception.name.slice(0, NAME_DISPLAY_MAX_LENGTH)}
                />
              )}
              <DetailCell
                icon={IconClock}
                label={t("receptionSlot")}
                value={formatSlotKey(reception.slotKey)}
              />
            </dl>

            {/* ── フッター: 案内 + 注記 ── */}
            <footer
              className={`flex flex-col items-center gap-1.5 px-6 pb-7 pt-5 text-center ${revealCls(visible)}`}
              style={{ transitionDelay: "500ms" }}
            >
              <p className="text-sm font-medium leading-relaxed text-white/80">{t("receptionGuide")}</p>
              <p className="text-xs leading-relaxed text-white/55">{t("receptionNote")}</p>
            </footer>
          </>
        ) : (
          /* ── 受付情報なし(未書き込みカード / パラメータ無しアクセス) ── */
          <div
            className={`flex flex-col items-center gap-3 px-8 py-12 text-center ${revealCls(visible)}`}
            style={{ transitionDelay: "80ms" }}
          >
            <div className="flex items-center gap-2.5">
              <IconBall className="h-5 w-5 text-[#6ba4ff]" />
              <span className="text-base font-bold tracking-[0.22em] text-white/70">3D BALL</span>
            </div>
            <IconAlertCircle className="mt-2 h-10 w-10 text-white/40" />
            <p className="text-lg font-bold text-white/90">{t("noProgram")}</p>
            <p className="text-sm text-white/55">{t("noProgramHint")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
