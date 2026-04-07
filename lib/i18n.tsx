"use client";

import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";

export type Locale = "ja" | "en" | "es";

const translations = {
  // Ball.tsx
  checker: { ja: "チェッカー", en: "Checker", es: "Cuadros" },
  stripe: { ja: "ストライプ", en: "Stripe", es: "Rayas" },
  programming: { ja: "プログラミング", en: "Programming", es: "Programaci\u00f3n" },
  close: { ja: "閉じる", en: "Close", es: "Cerrar" },
  scanCardToAdd: { ja: "カードをかざして\n命令を追加", en: "Tap a card\nto add a command", es: "Acerca una tarjeta\npara agregar" },
  running: { ja: "実行中...", en: "Running...", es: "Ejecutando..." },
  run: { ja: "Run", en: "Run", es: "Run" },
  settings: { ja: "設定", en: "Settings", es: "Ajustes" },
  mode3D: { ja: "3D モード", en: "3D Mode", es: "Modo 3D" },
  mode2D: { ja: "2D モード", en: "2D Mode", es: "Modo 2D" },
  color1: { ja: "色 1", en: "Color 1", es: "Color 1" },
  color2: { ja: "色 2", en: "Color 2", es: "Color 2" },
  width: { ja: "幅", en: "Width", es: "Ancho" },
  nfcCardRegister: { ja: "NFC カード登録", en: "NFC Card Setup", es: "Registro NFC" },
  nfcConnected: { ja: "NFC 接続中", en: "NFC Connected", es: "NFC Conectado" },
  nfcDisconnected: { ja: "NFC 未接続", en: "NFC Disconnected", es: "NFC Desconectado" },

  // NfcWriter.tsx
  dirUp: { ja: "上 (Up)", en: "Up", es: "Arriba" },
  dirDown: { ja: "下 (Down)", en: "Down", es: "Abajo" },
  dirLeft: { ja: "左 (Left)", en: "Left", es: "Izquierda" },
  dirRight: { ja: "右 (Right)", en: "Right", es: "Derecha" },
  dirJump: { ja: "ジャンプ (Jump)", en: "Jump", es: "Salto" },
  waitingForCard: { ja: "カードをリーダーにかざしてください...", en: "Tap a card on the reader...", es: "Acerca una tarjeta al lector..." },
  registered: { ja: "として登録しました！", en: "registered!", es: "\u00a1registrada!" },
  registerFailed: { ja: "登録に失敗しました。", en: "Registration failed.", es: "Error en el registro." },
  commError: { ja: "通信エラー: ", en: "Connection error: ", es: "Error de conexi\u00f3n: " },
  goBack: { ja: "← もどる", en: "← Back", es: "← Volver" },
  nfcCardSetup: { ja: "NFC カード登録", en: "NFC Card Setup", es: "Registro de tarjetas NFC" },
  readerConnected: { ja: "リーダー接続中: ", en: "Reader connected: ", es: "Lector conectado: " },
  readerNotFound: { ja: "NFCリーダーが見つかりません — USBリーダーを接続してください", en: "NFC reader not found — connect a USB reader", es: "Lector NFC no encontrado — conecta un lector USB" },
  registeredCards: { ja: "登録済みカード", en: "Registered Cards", es: "Tarjetas registradas" },
  noCardsYet: { ja: "まだカードが登録されていません", en: "No cards registered yet", es: "A\u00fan no hay tarjetas registradas" },
  selectDirAndTap: { ja: "方向を選んでカードをかざして登録", en: "Select a direction and tap a card to register", es: "Elige una direcci\u00f3n y acerca una tarjeta" },
  waitingCard: { ja: "カードを待っています...", en: "Waiting for card...", es: "Esperando tarjeta..." },
  registerBtn: { ja: "を登録する", en: "Register", es: "Registrar" },
  tapToRegister: { ja: "カードをかざして登録", en: "Tap card to register", es: "Acerca una tarjeta" },
  reRegister: { ja: "再登録", en: "Re-register", es: "Re-registrar" },
  cancel: { ja: "キャンセル", en: "Cancel", es: "Cancelar" },
  language: { ja: "言語", en: "Language", es: "Idioma" },

  // Replay page
  replay: { ja: "リプレイ", en: "Replay", es: "Repetir" },
  replayAgain: { ja: "もう一度見る", en: "Watch Again", es: "Ver de nuevo" },
  noProgram: { ja: "プログラムが指定されていません", en: "No program specified", es: "No se especific\u00f3 un programa" },
  steps: { ja: "ステップ", en: "steps", es: "pasos" },

  // Lv1 mode
  lv1: { ja: "Lv1", en: "Lv1", es: "Lv1" },
  lv1Theme: { ja: "ゴールをめざそう！", en: "Reach the Goal!", es: "\u00a1Llega a la meta!" },
  lv1Challenge: { ja: "お題", en: "Challenge", es: "Reto" },
  lv1ChallengeTheme: { ja: "回でゴールをめざそう！", en: " moves to the Goal!", es: " movimientos a la meta!" },

  // Lv2 mode
  lv2: { ja: "Lv2", en: "Lv2", es: "Lv2" },
  lv2Theme: { ja: "障害物をさけてゴール！", en: "Avoid obstacles!", es: "\u00a1Evita obst\u00e1culos!" },
  lv2ChallengeTheme: { ja: "回で障害物をさけてゴール！", en: " moves, avoid obstacles!", es: " movimientos, \u00a1evita!" },

  // Lv3 mode
  lv3: { ja: "Lv3", en: "Lv3", es: "Lv3" },
  lv3Theme: { ja: "？で分岐してゴール！", en: "Branch at ? to Goal!", es: "¡Bifurca en ? a la meta!" },
  lv3ChallengeTheme: { ja: "回で？を使ってゴール！", en: " moves, use ? to Goal!", es: " movimientos, ¡usa ?!" },

  // Loop cards & branch
  dirX2: { ja: "×2 (Loop2)", en: "\u00d72 (Loop2)", es: "\u00d72 (Loop2)" },
  dirX3: { ja: "×3 (Loop3)", en: "\u00d73 (Loop3)", es: "\u00d73 (Loop3)" },
  dirBranch: { ja: "？ (Which?)", en: "? (Which?)", es: "? (Which?)" },
  ifBlock: { ja: "もし", en: "if", es: "si" },
  elseBlock: { ja: "それ以外", en: "else", es: "si no" },
  tapElse: { ja: "else に切替", en: "Switch to else", es: "Cambiar a else" },
  closePBlock: { ja: "分岐を閉じる", en: "Close branch", es: "Cerrar bifurcación" },
  nextChallenge: { ja: "つぎへ", en: "Next", es: "Siguiente" },
  newMap: { ja: "マップ変更", en: "New Map", es: "Nuevo mapa" },
  start: { ja: "スタート", en: "START", es: "INICIO" },
  goal: { ja: "ゴール", en: "GOAL", es: "META" },

  // NTAG write
  saveToNtag: { ja: "NTAGに保存", en: "Save to NTAG", es: "Guardar en NTAG" },
  saveToNtagDesc: { ja: "NTAGカードにプログラムを書き込みます。\nカードをリーダーにかざしてください。", en: "Write the program to an NTAG card.\nTap a card on the reader.", es: "Escribe el programa en una tarjeta NTAG.\nAcerca una tarjeta al lector." },
  tapNtagToWrite: { ja: "NTAGカードをかざしてください...", en: "Tap an NTAG card...", es: "Acerca una tarjeta NTAG..." },
  writeSuccess: { ja: "書き込み完了！", en: "Written!", es: "\u00a1Escrito!" },
  writeFailed: { ja: "書き込みに失敗しました", en: "Write failed", es: "Error de escritura" },
  waitingForNtag: { ja: "NTAGを待っています...", en: "Waiting for NTAG...", es: "Esperando NTAG..." },

  // Guide — context hints
  guidePlayground: { ja: "Lv1 をおしてスタート！", en: "Press Lv1 to start!", es: "¡Presiona Lv1 para empezar!" },
  guideLv1Intro: { ja: "ボールをゴールへうごかそう！", en: "Move the ball to the goal!", es: "¡Mueve la bola a la meta!" },
  guideLv2Intro: { ja: "障害物をよけてゴール！×2/×3で繰り返し", en: "Dodge obstacles! Use ×2/×3 to repeat", es: "¡Esquiva obstáculos! Usa ×2/×3 para repetir" },
  guideLv3Intro: { ja: "？で道が分岐する！条件を読もう", en: "? splits the path! Read the conditions", es: "¡? divide el camino! Lee las condiciones" },
  guideProgFirst: { ja: "カードをかざして めいれいをついか", en: "Tap a card to add a command", es: "Acerca una tarjeta para agregar" },
  guideCleared: { ja: "クリア！つぎへいこう！", en: "Cleared! Let's go next!", es: "¡Completado! ¡Vamos!" },

  // Guide — help panel
  helpTitle: { ja: "ガイド", en: "Guide", es: "Guía" },
  helpMission: { ja: "ミッション", en: "Mission", es: "Misión" },
  helpSteps: { ja: "やりかた", en: "How to play", es: "Cómo jugar" },
  helpConcept: { ja: "学べること", en: "You will learn", es: "Aprenderás" },
  helpShortcuts: { ja: "ショートカット", en: "Shortcuts", es: "Atajos" },

  // Guide — playground
  helpTitlePlayground: { ja: "自由モード", en: "Free Play!", es: "¡Juego libre!" },
  helpObjPlayground: { ja: "ボールを自由に動かしてみよう。", en: "Move the ball around freely", es: "Mueve la bola libremente" },
  helpConceptPlayground: { ja: "入力と出力 — ボタンを押すとボールが動く", en: "Input & Output — press a button, ball moves", es: "Entrada y salida — presiona un botón, la bola se mueve" },
  helpStepPlayground1: { ja: "矢印キーで上下左右に動かせるよ。", en: "Use arrow keys or cards to move", es: "Usa flechas o tarjetas para mover" },
  helpStepPlayground2: { ja: "スペースキーでジャンプ！", en: "Press Space to jump!", es: "¡Presiona Espacio para saltar!" },
  helpStepPlayground3: { ja: "カードも使って同じようにボールを自由に動かしてみよう。", en: "Try moving the ball with cards too!", es: "¡Prueba mover la bola con tarjetas también!" },

  // Guide — Lv1
  helpTitleLv1: { ja: "レベル１（順番）", en: "Lv1: Move step by step", es: "Lv1: Mueve paso a paso" },
  helpObjLv1: { ja: "スタートからゴールまで、ボールを動かそう。", en: "Move the ball to the goal!", es: "¡Mueve la bola a la meta!" },
  helpConceptLv1: { ja: "逐次処理 — 命令を順番にひとつずつ実行する", en: "Sequential — run commands one by one", es: "Secuencial — ejecutar uno por uno" },
  helpStepLv1_1: { ja: "矢印キーで１マスずつ進めるよ。", en: "Use arrow keys to move one step at a time", es: "Usa las flechas para mover paso a paso" },
  helpStepLv1_2: { ja: "それができたらプログラミングモードで、カードを順番に並べて実行してみよう！", en: "Then switch to Programming mode and line up cards in order!", es: "Luego, en modo Programación, alinea las tarjetas en orden." },
  helpStepLv1_3: { ja: "「お題」ボタンで目標の回数が出るよ。", en: "The Challenge button shows the target move count.", es: "El botón Reto muestra el número objetivo de movimientos." },
  helpStepLv1_4: { ja: "めざせぴったりクリア！", en: "Aim for a perfect clear!", es: "¡Intenta un despeje perfecto!" },

  // Guide — Lv2
  helpTitleLv2: { ja: "レベル２（繰り返し）", en: "Lv2: Use loops to reach goal", es: "Lv2: Usa bucles para llegar" },
  helpObjLv2: { ja: "ブロックをよけながらゴールをめざそう。", en: "Dodge obstacles and reach the goal!", es: "¡Esquiva obstáculos y llega a la meta!" },
  helpConceptLv2: { ja: "繰り返し処理 — 同じ命令を何度も実行する", en: "Loops — repeat the same command", es: "Bucles — repetir el mismo comando" },
  helpStepLv2_1: { ja: "赤いブロックはぶつかると止まるよ。", en: "Red blocks stop you when you hit them.", es: "Los bloques rojos te detienen al chocar." },
  helpStepLv2_2: { ja: "×2 や ×3 カードを使うと、同じ動きを繰り返せるよ。", en: "Use ×2 / ×3 cards to repeat the same move.", es: "Usa tarjetas ×2 / ×3 para repetir el mismo movimiento." },
  helpStepLv2_3: { ja: "たとえば「→ ×3」で右に３マス進む！", en: "e.g. → ×3 moves right 3 times!", es: "Por ejemplo: → ×3 mueve a la derecha 3 veces." },
  helpStepLv2_4: { ja: "少ないカードでクリアできるかな？", en: "Can you clear with fewer cards?", es: "¿Puedes completar con menos tarjetas?" },

  // Guide — Lv3
  helpTitleLv3: { ja: "レベル３（条件分岐）", en: "Lv3: Use conditionals", es: "Lv3: Usa condicionales" },
  helpObjLv3: { ja: "必ず「？」マスを通ってゴールしよう。", en: "Pass through ? cells to reach the goal!", es: "¡Pasa por celdas ? para llegar!" },
  helpConceptLv3: { ja: "条件分岐 — 条件によって進む道が変わる (if/else)", en: "Conditionals — the path changes (if/else)", es: "Condicionales — el camino cambia (if/else)" },
  helpStepLv3_1: { ja: "紫の「？」マスに乗ると、ボールが自動で動くよ。", en: "Land on a purple ? cell and the ball moves automatically.", es: "Al pisar una celda ? morada, la bola se mueve sola." },
  helpStepLv3_2: { ja: "ボールの動きを観察してみてルールを見つけ出してみて！", en: "Watch the ball and figure out the rule!", es: "Observa la bola y descubre la regla." },
  helpStepLv3_3: { ja: "プログラミングでは、？カードで if/else ブロックを作れるよ。", en: "In Programming, use the ? card to build if/else blocks.", es: "En Programación, usa la tarjeta ? para crear bloques if/else." },
  helpStepLv3_4: { ja: "条件によって違う道を選ぶ——それがプログラミングの力！", en: "Choose different paths by condition — that's programming!", es: "Elige caminos según condiciones — ¡eso es programar!" },

  // Guide — shortcuts table
  shortcutArrows: { ja: "↑↓←→ 移動", en: "↑↓←→ Move", es: "↑↓←→ Mover" },
  shortcutSpace: { ja: "Space ジャンプ", en: "Space Jump", es: "Space Saltar" },
  shortcutP: { ja: "P プログラミング", en: "P Programming", es: "P Programar" },
  shortcutD: { ja: "D 2D/3D切替", en: "D 2D/3D toggle", es: "D Cambiar 2D/3D" },
  shortcutF: { ja: "F1-F3 レベル", en: "F1-F3 Level", es: "F1-F3 Nivel" },
  shortcutH: { ja: "H ガイド", en: "H Guide", es: "H Guía" },
  shortcutI: { ja: "I インフォ", en: "I Info", es: "I Info" },
  shortcutLang: { ja: "J/E/N 言語", en: "J/E/N Language", es: "J/E/N Idioma" },

  // Guide — font size setting
  guideFontSize: { ja: "ガイド文字サイズ", en: "Guide font size", es: "Tamaño de fuente guía" },
  guideFontSmall: { ja: "小", en: "S", es: "P" },
  guideFontMedium: { ja: "中", en: "M", es: "M" },
  guideFontLarge: { ja: "大", en: "L", es: "G" },

  // Welcome page
  welcomeTitle: { ja: "3D Ball へようこそ！", en: "Welcome to 3D Ball!", es: "¡Bienvenido a 3D Ball!" },
  welcomeIntro: { ja: "ボールを動かしてプログラミングを学ぼう！\nカードを使って「命令」を並べると、\nボールが自動で動くよ。", en: "Move the ball and learn programming!\nStack cards to build commands,\nthen watch the ball move on its own.", es: "¡Mueve la bola y aprende programación!\nApila tarjetas para crear comandos\ny mira cómo la bola se mueve sola." },
  welcomeLevels: { ja: "コース", en: "Courses", es: "Cursos" },
  welcomePlayground: { ja: "自由モード — ボールを自由に動かしてみよう", en: "Free Play — move the ball around freely", es: "Juego libre — mueve la bola libremente" },
  welcomeLv1Desc: { ja: "レベル１（順番）— 命令を順番に並べてゴールしよう", en: "Lv1: Sequence — line up commands to reach the goal", es: "Lv1: Secuencia — alinea comandos para llegar a la meta" },
  welcomeLv2Desc: { ja: "レベル２（繰り返し）— ×2/×3 カードで繰り返しを使おう", en: "Lv2: Loops — use ×2/×3 cards to repeat commands", es: "Lv2: Bucles — usa tarjetas ×2/×3 para repetir" },
  welcomeLv3Desc: { ja: "レベル３（条件分岐）— ？カードで道を分けよう", en: "Lv3: Conditionals — use ? cards to split the path", es: "Lv3: Condicionales — usa tarjetas ? para dividir el camino" },
  welcomeControls: { ja: "操作方法", en: "Controls", es: "Controles" },
  welcomeControlCards: { ja: "カードをかざして命令を送る", en: "Tap cards to send commands", es: "Acerca tarjetas para enviar comandos" },
  welcomeControlKeys: { ja: "矢印キーで動く、スペースキーでジャンプ", en: "Arrow keys to move, Space to jump", es: "Flechas para mover, Espacio para saltar" },
  welcomeControlProg: { ja: "プログラミングモードで命令を並べて Run！", en: "Programming mode: stack commands and Run!", es: "Modo programación: apila comandos y ¡Run!" },
  welcomeStart: { ja: "はじめる", en: "Start", es: "Empezar" },
  shortcutW: { ja: "W ようこそ", en: "W Welcome", es: "W Bienvenida" },

  // Info overlay — mode descriptions (marquee text)
  infoPlayground: {
    ja: "自由モード：　ボールを自由に動かしてみよう。　矢印キーで上下左右に動かせるよ。　スペースキーでジャンプ！　カードも使って同じようにボールを自由に動かしてみよう。",
    en: "Free Play  ——  Move the ball freely!  Use arrow keys to go up, down, left, right.  Press Space to jump!  In Programming mode (P key), stack cards to make the ball move automatically.  When you're ready, try Lv1!",
    es: "Juego libre  ——  ¡Mueve la bola libremente!  Usa las flechas para ir arriba, abajo, izquierda, derecha.  ¡Presiona Espacio para saltar!  En modo Programación (tecla P), apila tarjetas para mover la bola automáticamente.  Cuando estés listo, ¡prueba Lv1!",
  },
  infoLv1: {
    ja: "レベル１（順番）：　スタートからゴールまで、ボールを動かそう。　矢印キーで１マスずつ進めるよ。　それができたらプログラミングモードで、カードを順番に並べて実行してみよう！　「お題」ボタンで目標の回数が出るよ。　めざせぴったりクリア！",
    en: "Level 1 \"Sequence\"  ——  Move the ball from the green Start to the orange Goal!  Use arrow keys to go one step at a time.  In Programming mode (P key), line up cards in order and press Run!  The \"Challenge\" button shows the target number of moves.  Aim for a perfect clear!",
    es: "Nivel 1 \"Secuencia\"  ——  ¡Mueve la bola del Inicio verde a la Meta naranja!  Usa las flechas para avanzar paso a paso.  En modo Programación (tecla P), alinea las tarjetas en orden y presiona Run.  El botón \"Reto\" muestra el número objetivo de movimientos.  ¡Intenta un despeje perfecto!",
  },
  infoLv2: {
    ja: "レベル２（繰り返し）：　赤いブロックはぶつかると止まるよ。　ブロックをよけながらゴールをめざそう。　×2 や ×3 カードを使うと、同じ動きを繰り返せるよ。　少ないカードでクリアできるかな？",
    en: "Level 2 \"Loops\"  ——  Red blocks are walls! You'll stop if you hit them.  Dodge obstacles and reach the goal.  Use ×2 or ×3 cards to repeat the same move.  For example, → ×3 moves right 3 times!  Can you clear it with fewer cards?",
    es: "Nivel 2 \"Bucles\"  ——  ¡Los bloques rojos son muros! Te detienes si chocas.  Esquiva obstáculos y llega a la meta.  Usa tarjetas ×2 o ×3 para repetir el mismo movimiento.  Por ejemplo, → ×3 mueve a la derecha 3 veces.  ¿Puedes completarlo con menos tarjetas?",
  },
  infoLv3: {
    ja: "レベル３（条件分岐）：　紫の「？」マスに乗ると、ボールが自動で動くよ。　ボールの動きを観察してみてルールを見つけ出してみて！　必ず「？」マスを通ってゴールしよう。　プログラミングでは、？カードで if/else ブロックを作れるよ。",
    en: "Level 3 \"Conditionals\"  ——  Land on a purple ? cell and your direction changes based on how you arrived!  Come from the side → go vertical. Come from top/bottom → go horizontal.  You must pass through a ? cell to reach the goal.  In Programming, use the ? card to create if/else blocks.  Choosing different paths based on conditions — that's the power of programming!",
    es: "Nivel 3 \"Condicionales\"  ——  ¡Pisa una celda ? morada y tu dirección cambia según de dónde vengas!  Vienes del lado → vas vertical. Vienes de arriba/abajo → vas horizontal.  Debes pasar por una celda ? para llegar a la meta.  En Programación, usa la tarjeta ? para crear bloques if/else.  Elegir diferentes caminos según condiciones — ¡ese es el poder de la programación!",
  },
} as const;

export type TranslationKey = keyof typeof translations;

interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
  /** Dynamic key lookup (for config-driven keys). Returns key itself if not found. */
  td: (key: string) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: "ja",
  setLocale: () => {},
  t: (key) => translations[key].ja,
  td: (key) => (translations as Record<string, Record<string, string>>)[key]?.ja ?? key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("ja");

  useEffect(() => {
    const saved = localStorage.getItem("locale");
    if (saved === "ja" || saved === "en" || saved === "es") {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("locale", l);
  }, []);

  const t = useCallback(
    (key: TranslationKey) => translations[key][locale],
    [locale],
  );

  const td = useCallback(
    (key: string) => (translations as Record<string, Record<string, string>>)[key]?.[locale] ?? key,
    [locale],
  );

  return (
    <I18nContext.Provider value={{ locale, setLocale, t, td }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
