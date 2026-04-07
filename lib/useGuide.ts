"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { HINT_RULES, HELP_CONTENTS, GuideContext, HintRule } from "./guide-content";

const STORAGE_KEY = "guide-dismissed";

function loadDismissed(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return new Set(JSON.parse(raw));
  } catch { /* ignore */ }
  return new Set();
}

function saveDismissed(set: Set<string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch { /* ignore */ }
}

export interface GuideState {
  /** Currently resolved hint (null = no hint) */
  activeHint: HintRule | null;
  /** Help panel open */
  helpOpen: boolean;
  /** Get help content for current context */
  helpContentKey: string;
  /** Actions */
  dismissHint: () => void;
  openHelp: () => void;
  closeHelp: () => void;
  toggleHelp: () => void;
  resetGuide: () => void;
  /** Call every render with current app state */
  updateContext: (ctx: GuideContext) => void;
}

export function useGuide(): GuideState {
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());
  const [activeHint, setActiveHint] = useState<HintRule | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpContentKey, setHelpContentKey] = useState("playground");
  const autoHideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastHintId = useRef<string | null>(null);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (autoHideTimer.current) clearTimeout(autoHideTimer.current);
    };
  }, []);

  const dismissHint = useCallback(() => {
    if (activeHint && !activeHint.repeatable) {
      setDismissed((prev) => {
        const next = new Set(prev);
        next.add(activeHint.id);
        saveDismissed(next);
        return next;
      });
    }
    setActiveHint(null);
    lastHintId.current = null;
    if (autoHideTimer.current) {
      clearTimeout(autoHideTimer.current);
      autoHideTimer.current = null;
    }
  }, [activeHint]);

  const openHelp = useCallback(() => setHelpOpen(true), []);
  const closeHelp = useCallback(() => setHelpOpen(false), []);
  const toggleHelp = useCallback(() => setHelpOpen((v) => !v), []);

  const resetGuide = useCallback(() => {
    setDismissed(new Set());
    saveDismissed(new Set());
    setActiveHint(null);
    lastHintId.current = null;
  }, []);

  const updateContext = useCallback(
    (ctx: GuideContext) => {
      // Resolve help content key
      const key = ctx.levelId || "playground";
      setHelpContentKey(key);

      // Resolve active hint
      let matched: HintRule | null = null;
      for (const rule of HINT_RULES) {
        if (rule.match(ctx)) {
          // Suppress rules (empty textKey) = hide all
          if (!rule.textKey) {
            matched = null;
            break;
          }
          // Skip dismissed (unless repeatable)
          if (!rule.repeatable && dismissed.has(rule.id)) continue;
          matched = rule;
          break;
        }
      }

      // Only update if hint changed
      if (matched?.id !== lastHintId.current) {
        lastHintId.current = matched?.id ?? null;
        setActiveHint(matched);

        // Set auto-hide timer
        if (autoHideTimer.current) {
          clearTimeout(autoHideTimer.current);
          autoHideTimer.current = null;
        }
        if (matched) {
          const ms = matched.autoHideMs ?? 8000;
          autoHideTimer.current = setTimeout(() => {
            setActiveHint((current) => {
              if (current?.id === matched!.id) return null;
              return current;
            });
            lastHintId.current = null;
            autoHideTimer.current = null;
          }, ms);
        }
      }
    },
    [dismissed],
  );

  return {
    activeHint,
    helpOpen,
    helpContentKey,
    dismissHint,
    openHelp,
    closeHelp,
    toggleHelp,
    resetGuide,
    updateContext,
  };
}

export { HELP_CONTENTS };
export type { GuideContext };
