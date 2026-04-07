"use client";

import React, { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { HintRule } from "@/lib/guide-content";
import { HELP_CONTENTS } from "@/lib/useGuide";

export type GuideFontSize = "small" | "medium" | "large";

// ── SVG Icons ──

function IconGamepad({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="6" width="20" height="12" rx="2" />
      <path d="M6 12h4M8 10v4" />
      <circle cx="15" cy="11" r="1" fill="currentColor" />
      <circle cx="18" cy="13" r="1" fill="currentColor" />
    </svg>
  );
}

function IconListOrdered({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <path d="M4 6h1v4" />
      <path d="M4 10h2" />
      <path d="M3 14h2l-2 2h2" />
    </svg>
  );
}

function IconRepeat({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

function IconGitBranch({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <line x1="6" y1="3" x2="6" y2="15" />
      <circle cx="18" cy="6" r="3" />
      <circle cx="6" cy="18" r="3" />
      <path d="M18 9a9 9 0 0 1-9 9" />
    </svg>
  );
}

function IconCard({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M7 15h0M2 9.5h20" />
    </svg>
  );
}

function IconStar({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function IconArrows({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l0 20M2 12l20 0M12 2l-4 4M12 2l4 4M12 22l-4-4M12 22l4-4M2 12l4-4M2 12l4 4M22 12l-4-4M22 12l-4 4" />
    </svg>
  );
}

function IconKeyboard({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 8h0M10 8h0M14 8h0M18 8h0M8 12h0M12 12h0M16 12h0M8 16h8" />
    </svg>
  );
}

function IconCode({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6" />
      <polyline points="8 6 2 12 8 18" />
    </svg>
  );
}

function IconBall({ className = "w-8 h-8" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a15 15 0 0 1 4 10 15 15 0 0 1-4 10" />
      <path d="M12 2a15 15 0 0 0-4 10 15 15 0 0 0 4 10" />
      <path d="M2 12h20" />
    </svg>
  );
}

// Icon map for hint bubbles
const HINT_ICONS: Record<string, (p: { className?: string }) => React.ReactElement> = {
  playground: IconGamepad,
  "lv1-intro": IconListOrdered,
  "lv2-intro": IconRepeat,
  "lv3-intro": IconGitBranch,
  "prog-first": IconCard,
  "level-cleared": IconStar,
};

const fontSizeClasses: Record<GuideFontSize, { hint: string; body: string; label: string; step: string; number: string; shortcut: string; title: string }> = {
  small: { hint: "text-sm", body: "text-sm", label: "text-xs", step: "text-sm", number: "w-5 h-5 text-xs", shortcut: "text-xs", title: "text-lg" },
  medium: { hint: "text-base", body: "text-base", label: "text-sm", step: "text-base", number: "w-6 h-6 text-sm", shortcut: "text-sm", title: "text-xl" },
  large: { hint: "text-lg", body: "text-lg", label: "text-base", step: "text-lg", number: "w-7 h-7 text-base", shortcut: "text-base", title: "text-2xl" },
};

// ── HintBubble ──

const anchorPositions: Record<string, string> = {
  "bottom-center": "bottom-14 left-1/2 -translate-x-1/2",
  "bottom-left": "bottom-14 left-4",
  "left-center": "top-1/2 left-72 -translate-y-1/2",
  "top-center": "top-16 left-1/2 -translate-x-1/2",
};

export function HintBubble({
  hint,
  onDismiss,
  fontSize = "small",
}: {
  hint: HintRule;
  onDismiss: () => void;
  fontSize?: GuideFontSize;
}) {
  const { td } = useI18n();
  const [visible, setVisible] = useState(false);
  const fs = fontSizeClasses[fontSize];

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  const pos = anchorPositions[hint.anchor] || anchorPositions["bottom-center"];
  const maxW = fontSize === "large" ? "max-w-[280px]" : fontSize === "medium" ? "max-w-[250px]" : "max-w-[220px]";

  return (
    <div
      className={`absolute ${pos} z-[15] ${maxW} transition-all duration-300 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
      }`}
    >
      <div className={`relative bg-white/95 backdrop-blur rounded-xl shadow-lg px-3 py-2 ${fs.hint} text-gray-800 leading-snug`}>
        <button
          onClick={onDismiss}
          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-gray-300 hover:bg-gray-400 text-white text-xs flex items-center justify-center leading-none"
        >
          ×
        </button>
        <span className="flex items-center gap-1.5">
          {HINT_ICONS[hint.id] && (() => { const Icon = HINT_ICONS[hint.id]; return <Icon className="w-4 h-4 flex-shrink-0 text-blue-500" />; })()}
          {td(hint.textKey)}
        </span>
      </div>
    </div>
  );
}

// ── HelpButton ──

export function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/40 text-white/80 hover:text-white text-xs font-bold flex items-center justify-center transition"
      title="Guide (H)"
    >
      ?
    </button>
  );
}

// ── HelpPanel ──

const SHORTCUT_KEYS = [
  "shortcutArrows",
  "shortcutSpace",
  "shortcutP",
  "shortcutD",
  "shortcutF",
  "shortcutH",
  "shortcutI",
  "shortcutW",
  "shortcutLang",
] as const;

export function HelpPanel({
  contentKey,
  onClose,
  fontSize = "small",
}: {
  contentKey: string;
  onClose: () => void;
  fontSize?: GuideFontSize;
}) {
  const { td } = useI18n();
  const content = HELP_CONTENTS[contentKey] || HELP_CONTENTS.playground;
  const [visible, setVisible] = useState(false);
  const fs = fontSizeClasses[fontSize];

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`absolute inset-0 z-30 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-200 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl mx-4 max-w-md w-full max-h-[80vh] overflow-y-auto transition-transform duration-200 ${
          visible ? "scale-100" : "scale-95"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className={`${fs.title} font-bold text-gray-800`}>
            {td(content.titleKey)}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 text-sm flex items-center justify-center"
          >
            ×
          </button>
        </div>

        <div className="px-5 pb-5 space-y-4">
          {/* Mission */}
          <section>
            <div className={`${fs.label} font-semibold text-blue-500 uppercase tracking-wide mb-1`}>
              {td("helpMission")}
            </div>
            <p className={`${fs.body} text-gray-700`}>{td(content.objectiveKey)}</p>
          </section>

          {/* Steps */}
          <section>
            <div className={`${fs.label} font-semibold text-blue-500 uppercase tracking-wide mb-1`}>
              {td("helpSteps")}
            </div>
            <ol className="space-y-1.5">
              {content.steps.map((step, i) => (
                <li
                  key={i}
                  className={`flex gap-2 ${fs.step} text-gray-700`}
                >
                  <span className={`flex-shrink-0 ${fs.number} rounded-full bg-blue-100 text-blue-600 font-bold flex items-center justify-center`}>
                    {i + 1}
                  </span>
                  <span>{td(step.textKey)}</span>
                </li>
              ))}
            </ol>
          </section>

          {/* Concept */}
          <section>
            <div className={`${fs.label} font-semibold text-green-600 uppercase tracking-wide mb-1`}>
              {td("helpConcept")}
            </div>
            <p className={`${fs.body} text-gray-700 bg-green-50 rounded-lg px-3 py-2`}>
              {td(content.conceptKey)}
            </p>
          </section>

          {/* Shortcuts */}
          <section>
            <div className={`${fs.label} font-semibold text-gray-400 uppercase tracking-wide mb-1`}>
              {td("helpShortcuts")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {SHORTCUT_KEYS.map((k) => (
                <span
                  key={k}
                  className={`${fs.shortcut} bg-gray-100 text-gray-600 rounded px-2 py-0.5`}
                >
                  {td(k)}
                </span>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ── InfoOverlay (marquee subtitle) ──

const INFO_KEYS: Record<string, string> = {
  playground: "infoPlayground",
  lv1: "infoLv1",
  lv2: "infoLv2",
  lv3: "infoLv3",
};

export function InfoOverlay({
  levelId,
  onClose,
}: {
  levelId: string | null;
  onClose: () => void;
}) {
  const { td } = useI18n();
  const key = INFO_KEYS[levelId || "playground"] || INFO_KEYS.playground;
  const text = td(key);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`absolute inset-0 z-30 flex items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300 cursor-pointer ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <div className="max-w-3xl px-8">
        <p
          className="text-white font-bold leading-relaxed text-center"
          style={{
            fontSize: "clamp(1.5rem, 4vw, 3rem)",
            textShadow: "0 2px 8px rgba(0,0,0,0.5)",
          }}
        >
          {text}
        </p>
      </div>
    </div>
  );
}

// ── InfoButton ──

export function InfoButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-6 h-6 rounded-full bg-white/20 hover:bg-white/40 text-white/80 hover:text-white text-xs font-bold flex items-center justify-center transition"
      title="Info (I)"
    >
      i
    </button>
  );
}

// ── WelcomePanel ──

const LEVEL_ITEMS: { icon: (p: { className?: string }) => React.ReactElement; color: string; key: string }[] = [
  { icon: IconGamepad, color: "text-green-500", key: "welcomePlayground" },
  { icon: IconListOrdered, color: "text-blue-500", key: "welcomeLv1Desc" },
  { icon: IconRepeat, color: "text-orange-500", key: "welcomeLv2Desc" },
  { icon: IconGitBranch, color: "text-purple-500", key: "welcomeLv3Desc" },
];

const CONTROL_ITEMS: { icon: (p: { className?: string }) => React.ReactElement; color: string; key: string }[] = [
  { icon: IconKeyboard, color: "text-gray-500", key: "welcomeControlKeys" },
  { icon: IconCard, color: "text-blue-500", key: "welcomeControlCards" },
  { icon: IconCode, color: "text-green-500", key: "welcomeControlProg" },
];

export function WelcomePanel({
  onClose,
  fontSize = "small",
}: {
  onClose: () => void;
  fontSize?: GuideFontSize;
}) {
  const { td } = useI18n();
  const [visible, setVisible] = useState(false);
  const fs = fontSizeClasses[fontSize];

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      className={`absolute inset-0 z-30 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
        visible ? "opacity-100" : "opacity-0"
      }`}
      onClick={onClose}
    >
      <div
        className={`bg-white rounded-2xl shadow-2xl mx-4 max-w-lg w-full max-h-[85vh] overflow-y-auto transition-transform duration-300 ${
          visible ? "scale-100" : "scale-95"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-2 text-center">
          <div className="flex justify-center mb-2 text-blue-500">
            <IconBall className={fontSize === "large" ? "w-12 h-12" : fontSize === "medium" ? "w-10 h-10" : "w-8 h-8"} />
          </div>
          <h1 className={`${fontSize === "large" ? "text-2xl" : fontSize === "medium" ? "text-xl" : "text-lg"} font-bold text-gray-800`}>
            {td("welcomeTitle")}
          </h1>
        </div>

        <div className="px-6 pb-6 space-y-4">
          {/* Intro */}
          <p className={`${fs.body} text-gray-600 text-center whitespace-pre-line leading-relaxed`}>
            {td("welcomeIntro")}
          </p>

          {/* Levels */}
          <section>
            <div className={`${fs.label} font-semibold text-blue-500 uppercase tracking-wide mb-2`}>
              {td("welcomeLevels")}
            </div>
            <div className="space-y-1.5">
              {LEVEL_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.key} className={`flex gap-2 items-center ${fs.step} text-gray-700`}>
                    <Icon className={`w-4 h-4 flex-shrink-0 ${item.color}`} />
                    <span>{td(item.key)}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Controls */}
          <section>
            <div className={`${fs.label} font-semibold text-green-600 uppercase tracking-wide mb-2`}>
              {td("welcomeControls")}
            </div>
            <div className="space-y-1.5">
              {CONTROL_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.key} className={`flex gap-2 items-center ${fs.step} text-gray-700`}>
                    <Icon className={`w-4 h-4 flex-shrink-0 ${item.color}`} />
                    <span>{td(item.key)}</span>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Start button */}
          <button
            onClick={onClose}
            className={`w-full rounded-xl bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 transition ${fs.body}`}
          >
            {td("welcomeStart")}
          </button>
        </div>
      </div>
    </div>
  );
}
