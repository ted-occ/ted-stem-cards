# STEAM Cards

NFCカードを使って、子供たちが「触れる」プログラミング体験ができるSTEAM教育アプリです。

物理的なNFCカードをリーダーにかざすだけで、画面上のロボットに命令を送ることができます。

## Game Modes

### Maze Mode

迷路をプログラミングでゴールまで導くモードです。
NFCカードをかざしてアクションを追加し、ロボットをSTARTからGOALへナビゲートします。
一人称視点でも迷路を体験できます。

### Draw Mode

コードで絵を描くモードです。アクションカードを組み合わせてキャンバス上に模様を描きます。

### Line Mode

線を描いてロボットを動かすモードです。自分で描いた線の上をロボットが自動でたどります。

### Demo

マルチプレイヤーアニメーションのデモモードです。

### NFC Writer

NFCタグにアクションカードのデータを書き込むツールです。白無地のNTAGカードからオリジナルのアクションカードを作成できます。

## NFC Action Cards

| カード | ID | 説明 |
|--------|-----|------|
| ⬆ Forward | `FORWARD` | 前に進む |
| ⬇ Back | `BACK` | 後ろに下がる |
| ↻ Turn Right | `TURN_RIGHT` | 右を向く |
| ↺ Turn Left | `TURN_LEFT` | 左を向く |
| 🔁 2回 | `LOOP_2` | 2回くり返し |
| 🔁 3回 | `LOOP_3` | 3回くり返し |
| 🔁 4回 | `LOOP_4` | 4回くり返し |
| 🔁 5回 | `LOOP_5` | 5回くり返し |
| 🏁 おわり | `END` | くり返しの終了 |

## Requirements

- Node.js 18+
- USB NFCカードリーダー（動作確認済: SONY RC-S300）
- NFC タグ（NTAG213 / NTAG215 / NTAG216）

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

http://localhost:3000 を開いてください。

### NFC カードの作成

1. `/nfc` ページを開く
2. 書き込みたいアクションカードを選択
3. 「書き込む」ボタンを押す
4. 白無地のNTAGカードをリーダーにかざす

### Maze Mode で遊ぶ

1. `/game` ページを開く（ヘッダーの NFC インジケーターが緑になることを確認）
2. 作成したNFCアクションカードをリーダーにかざす
3. プログラムにアクションが自動追加される
4. 「Action!」ボタンでプログラムを実行

## Tech Stack

- [Next.js](https://nextjs.org/) 16 (App Router / Turbopack)
- [React](https://react.dev/) 19
- [Tailwind CSS](https://tailwindcss.com/) 4
- [nfc-pcsc](https://github.com/nicedoc/nfc-pcsc) (PC/SC NFC reader)
- TypeScript 5

## License

MIT
