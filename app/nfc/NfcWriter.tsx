"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Link from "next/link";

// --- Card definitions matching the game ---
interface CardDef {
  id: string;
  label: string;
  icon: string;
  bgColor: string;
  borderColor: string;
  hoverColor: string;
  textColor: string;
}

const ACTION_CARDS: CardDef[] = [
  { id: "FORWARD",    label: "Forward",    icon: "⬆", bgColor: "bg-blue-100",   borderColor: "border-blue-400",   hoverColor: "hover:bg-blue-200",   textColor: "text-blue-700" },
  { id: "BACK",       label: "Back",       icon: "⬇", bgColor: "bg-orange-100", borderColor: "border-orange-400", hoverColor: "hover:bg-orange-200", textColor: "text-orange-700" },
  { id: "TURN_RIGHT", label: "Turn Right", icon: "↻", bgColor: "bg-green-100",  borderColor: "border-green-400",  hoverColor: "hover:bg-green-200",  textColor: "text-green-700" },
  { id: "TURN_LEFT",  label: "Turn Left",  icon: "↺", bgColor: "bg-purple-100", borderColor: "border-purple-400", hoverColor: "hover:bg-purple-200", textColor: "text-purple-700" },
];

const LOOP_CARDS: CardDef[] = [2, 3, 4, 5].map((n) => ({
  id: `LOOP_${n}`,
  label: `${n}回`,
  icon: "🔁",
  bgColor: "bg-cyan-100",
  borderColor: "border-cyan-400",
  hoverColor: "hover:bg-cyan-200",
  textColor: "text-cyan-700",
}));

const END_CARD: CardDef = {
  id: "END",
  label: "おわり",
  icon: "🏁",
  bgColor: "bg-gray-100",
  borderColor: "border-gray-400",
  hoverColor: "hover:bg-gray-200",
  textColor: "text-gray-700",
};

type WriteStatus = "idle" | "waiting" | "success" | "error";

interface WriteLog {
  cardId: string;
  label: string;
  uid: string;
  time: string;
}

export default function NfcWriter() {
  const [selected, setSelected] = useState<CardDef | null>(null);
  const [status, setStatus] = useState<WriteStatus>("idle");
  const [message, setMessage] = useState("");
  const [readerConnected, setReaderConnected] = useState(false);
  const [readerName, setReaderName] = useState("");
  const [logs, setLogs] = useState<WriteLog[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  // Poll reader status
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/nfc");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) {
          setReaderConnected(data.connected);
          setReaderName(data.readerName || "");
        }
      } catch {
        // ignore
      }
    };
    poll();
    const id = setInterval(poll, 2000);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  const handleSelect = useCallback((card: CardDef) => {
    setSelected(card);
    setStatus("idle");
    setMessage("");
  }, []);

  const handleWrite = useCallback(async () => {
    if (!selected) return;

    // Cancel previous request
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      setStatus("waiting");
      setMessage("NFCタグをリーダーにかざしてください...");

      const res = await fetch("/api/nfc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: selected.id }),
        signal: ac.signal,
      });

      const data = await res.json();

      if (data.success) {
        setStatus("success");
        setMessage(`「${selected.label}」を書き込みました！ (UID: ${data.uid})`);
        setLogs((prev) => [
          { cardId: selected.id, label: selected.label, uid: data.uid, time: new Date().toLocaleTimeString() },
          ...prev,
        ]);
      } else {
        setStatus("error");
        setMessage(data.error || "書き込みに失敗しました。");
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setStatus("error");
      setMessage(`通信エラー: ${err instanceof Error ? err.message : String(err)}`);
    }
  }, [selected]);

  const handleCancel = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort();
    try {
      await fetch("/api/nfc", { method: "DELETE" });
    } catch {
      // ignore
    }
    setStatus("idle");
    setMessage("");
  }, []);

  return (
    <div className="min-h-screen bg-stone-50 p-6">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Link
            href="/"
            className="px-4 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-sm"
          >
            ← メニュー
          </Link>
          <h1 className="text-2xl font-bold text-gray-800">
            📡 NFC カード書き込み
          </h1>
        </div>

        {/* Reader status */}
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl mb-6 text-sm font-medium
          ${readerConnected
            ? "bg-green-50 border border-green-300 text-green-700"
            : "bg-red-50 border border-red-300 text-red-700"
          }`}
        >
          <span className={`inline-block w-3 h-3 rounded-full ${readerConnected ? "bg-green-500 animate-pulse" : "bg-red-400"}`} />
          {readerConnected
            ? `リーダー接続中: ${readerName}`
            : "NFCリーダーが見つかりません — USBリーダーを接続してください"
          }
        </div>

        {/* Step 1: Select card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-700 mb-4">
            ① カードの種類を選択
          </h2>

          <p className="text-sm font-semibold text-gray-500 mb-2">ACTION CARDS</p>
          <div className="flex flex-wrap gap-3 mb-4">
            {ACTION_CARDS.map((card) => (
              <button
                key={card.id}
                onClick={() => handleSelect(card)}
                className={`flex flex-col items-center justify-center w-24 h-24 rounded-xl border-2 transition-all font-bold text-sm
                  ${card.bgColor} ${card.borderColor} ${card.hoverColor}
                  ${selected?.id === card.id ? "ring-4 ring-blue-300 scale-105" : ""}
                `}
              >
                <span className="text-2xl mb-1">{card.icon}</span>
                <span className={card.textColor}>{card.label}</span>
              </button>
            ))}
          </div>

          <p className="text-sm font-semibold text-gray-500 mb-2">くり返しカード</p>
          <div className="flex flex-wrap gap-3 mb-4">
            {LOOP_CARDS.map((card) => (
              <button
                key={card.id}
                onClick={() => handleSelect(card)}
                className={`flex flex-col items-center justify-center w-20 h-20 rounded-xl border-2 transition-all font-bold text-sm
                  ${card.bgColor} ${card.borderColor} ${card.hoverColor}
                  ${selected?.id === card.id ? "ring-4 ring-blue-300 scale-105" : ""}
                `}
              >
                <span className="text-lg mb-1">{card.icon}</span>
                <span className={card.textColor}>{card.label}</span>
              </button>
            ))}
          </div>

          <p className="text-sm font-semibold text-gray-500 mb-2">その他</p>
          <div className="flex gap-3">
            <button
              onClick={() => handleSelect(END_CARD)}
              className={`flex flex-col items-center justify-center w-24 h-20 rounded-xl border-2 transition-all font-bold text-sm
                ${END_CARD.bgColor} ${END_CARD.borderColor} ${END_CARD.hoverColor}
                ${selected?.id === END_CARD.id ? "ring-4 ring-blue-300 scale-105" : ""}
              `}
            >
              <span className="text-lg mb-1">{END_CARD.icon}</span>
              <span className={END_CARD.textColor}>{END_CARD.label}</span>
            </button>
          </div>
        </div>

        {/* Step 2: Write */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
          <h2 className="text-lg font-bold text-gray-700 mb-4">
            ② NFCタグに書き込む
          </h2>

          {selected ? (
            <div className="flex flex-col items-center gap-4">
              <div
                className={`flex flex-col items-center justify-center w-32 h-32 rounded-2xl border-3 font-bold
                  ${selected.bgColor} ${selected.borderColor}
                `}
              >
                <span className="text-4xl mb-2">{selected.icon}</span>
                <span className={`text-lg ${selected.textColor}`}>{selected.label}</span>
                <span className="text-xs text-gray-400 mt-1">{selected.id}</span>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleWrite}
                  disabled={status === "waiting" || !readerConnected}
                  className={`px-8 py-3 rounded-xl font-bold text-lg transition-all
                    ${status === "waiting"
                      ? "bg-yellow-400 text-yellow-900 animate-pulse"
                      : "bg-blue-500 text-white hover:bg-blue-600 active:scale-95"
                    }
                    disabled:opacity-60 disabled:cursor-not-allowed
                  `}
                >
                  {status === "waiting" ? "📡 タグを待っています..." : "📝 書き込む"}
                </button>

                {status === "waiting" && (
                  <button
                    onClick={handleCancel}
                    className="px-4 py-3 rounded-xl font-bold text-sm bg-gray-200 text-gray-600 hover:bg-gray-300 transition-all"
                  >
                    キャンセル
                  </button>
                )}
              </div>

              {message && (
                <div
                  className={`px-4 py-3 rounded-lg text-sm font-medium w-full text-center
                    ${status === "success" ? "bg-green-100 text-green-700 border border-green-300" : ""}
                    ${status === "error" ? "bg-red-100 text-red-700 border border-red-300" : ""}
                    ${status === "waiting" ? "bg-yellow-50 text-yellow-700 border border-yellow-300" : ""}
                  `}
                >
                  {message}
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-400 text-center py-8">
              上からカードの種類を選んでください
            </p>
          )}
        </div>

        {/* Write log */}
        {logs.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
            <h2 className="text-lg font-bold text-gray-700 mb-3">📋 書き込み履歴</h2>
            <div className="space-y-2">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg text-sm"
                >
                  <span className="text-gray-400 text-xs">{log.time}</span>
                  <span className="font-bold text-gray-700">{log.label}</span>
                  <span className="text-gray-400">({log.cardId})</span>
                  <span className="ml-auto text-xs text-gray-400 font-mono">UID: {log.uid}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
