// Guide content definitions — pure data, no React dependency

export type HintAnchor =
  | "bottom-center"
  | "bottom-left"
  | "left-center"
  | "top-center";

export interface HintRule {
  id: string;
  /** i18n key for the hint text */
  textKey: string;
  anchor: HintAnchor;
  /** If true, hint shows every time (not persisted as dismissed) */
  repeatable?: boolean;
  /** Auto-dismiss after ms (default 8000) */
  autoHideMs?: number;
  /** Return true when this hint should be active */
  match: (ctx: GuideContext) => boolean;
}

export interface GuideContext {
  levelActive: boolean;
  levelId: string | null;
  levelCleared: boolean;
  progMode: boolean;
  progRunning: boolean;
  nfcConnected: boolean;
  programLength: number;
  bursting: boolean;
}

/**
 * Ordered by priority — first match wins.
 * Rules with `match` returning true but suppress=true hide all hints.
 */
export const HINT_RULES: HintRule[] = [
  // Suppress during execution / burst
  {
    id: "prog-running",
    textKey: "",
    anchor: "bottom-center",
    match: (ctx) => ctx.progRunning,
  },
  {
    id: "bursting",
    textKey: "",
    anchor: "bottom-center",
    match: (ctx) => ctx.bursting,
  },
  // Level cleared
  {
    id: "level-cleared",
    textKey: "guideCleared",
    anchor: "bottom-center",
    repeatable: true,
    autoHideMs: 10000,
    match: (ctx) => ctx.levelCleared,
  },
  // Programming mode first open
  {
    id: "prog-first",
    textKey: "guideProgFirst",
    anchor: "left-center",
    match: (ctx) => ctx.progMode && ctx.programLength === 0,
  },
  // Playground (no level, no prog)
  {
    id: "playground",
    textKey: "guidePlayground",
    anchor: "bottom-left",
    match: (ctx) => !ctx.levelActive && !ctx.progMode,
  },
];

// ── Help panel content ──

export interface HelpStep {
  textKey: string;
}

export interface HelpContent {
  titleKey: string;
  objectiveKey: string;
  conceptKey: string;
  steps: HelpStep[];
}

/** Key = levelId or "playground" */
export const HELP_CONTENTS: Record<string, HelpContent> = {
  playground: {
    titleKey: "helpTitlePlayground",
    objectiveKey: "helpObjPlayground",
    conceptKey: "helpConceptPlayground",
    steps: [
      { textKey: "helpStepPlayground1" },
      { textKey: "helpStepPlayground2" },
      { textKey: "helpStepPlayground3" },
    ],
  },
  lv1: {
    titleKey: "helpTitleLv1",
    objectiveKey: "helpObjLv1",
    conceptKey: "helpConceptLv1",
    steps: [
      { textKey: "helpStepLv1_1" },
      { textKey: "helpStepLv1_2" },
      { textKey: "helpStepLv1_3" },
      { textKey: "helpStepLv1_4" },
    ],
  },
  lv2: {
    titleKey: "helpTitleLv2",
    objectiveKey: "helpObjLv2",
    conceptKey: "helpConceptLv2",
    steps: [
      { textKey: "helpStepLv2_1" },
      { textKey: "helpStepLv2_2" },
      { textKey: "helpStepLv2_3" },
      { textKey: "helpStepLv2_4" },
    ],
  },
  lv3: {
    titleKey: "helpTitleLv3",
    objectiveKey: "helpObjLv3",
    conceptKey: "helpConceptLv3",
    steps: [
      { textKey: "helpStepLv3_1" },
      { textKey: "helpStepLv3_2" },
      { textKey: "helpStepLv3_3" },
      { textKey: "helpStepLv3_4" },
    ],
  },
};
