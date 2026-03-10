import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50">
      <div className="flex flex-col items-center gap-8">
        <h1 className="text-3xl font-bold text-gray-800">STEM Quest</h1>
        <div className="flex gap-6">
          <Link
            href="/game"
            className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-gray-300 bg-white hover:border-blue-400 hover:shadow-lg transition-all w-56"
          >
            <span className="text-5xl">{"\uD83C\uDFAF"}</span>
            <span className="text-lg font-bold text-gray-700">Maze Mode</span>
            <span className="text-sm text-gray-500 text-center">Navigate from START to GOAL</span>
          </Link>
          <Link
            href="/draw"
            className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-gray-300 bg-white hover:border-green-400 hover:shadow-lg transition-all w-56"
          >
            <span className="text-5xl">{"\uD83C\uDFA8"}</span>
            <span className="text-lg font-bold text-gray-700">Draw Mode</span>
            <span className="text-sm text-gray-500 text-center">Draw pictures with code</span>
          </Link>
          <Link
            href="/line"
            className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-gray-300 bg-white hover:border-orange-400 hover:shadow-lg transition-all w-56"
          >
            <span className="text-5xl">{"\uD83E\uDD16"}</span>
            <span className="text-lg font-bold text-gray-700">Line Mode</span>
            <span className="text-sm text-gray-500 text-center">線を描いてロボットを動かそう</span>
          </Link>
          <Link
            href="/demo"
            className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-gray-300 bg-white hover:border-purple-400 hover:shadow-lg transition-all w-56"
          >
            <span className="text-5xl">{"\uD83D\uDDBC\uFE0F"}</span>
            <span className="text-lg font-bold text-gray-700">Demo</span>
            <span className="text-sm text-gray-500 text-center">See what you can create</span>
          </Link>
          <Link
            href="/nfc"
            className="flex flex-col items-center gap-3 p-8 rounded-xl border-2 border-gray-300 bg-white hover:border-cyan-400 hover:shadow-lg transition-all w-56"
          >
            <span className="text-5xl">{"\uD83D\uDCE1"}</span>
            <span className="text-lg font-bold text-gray-700">NFC Writer</span>
            <span className="text-sm text-gray-500 text-center">NFCタグにカードを書き込む</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
