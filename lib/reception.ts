// 受付情報(整理券データ)をリプレイURLのクエリパラメータとして表現するための encode/decode。
// 整理券管理アプリ(waiting-display-demo)と3D Ballの両方が参照する契約。
// Node.js固有API非依存の純粋関数のみで構成し、Server/Client両方の Component から import できる。

import type { RawNdefRecord } from "./ndef";

export interface ReceptionInfo {
  ticketNumber: string;
  name?: string;
  slotKey: string;
}

/** 受付情報用に予約されたクエリパラメータ名("r"始まり)。他のリプレイ用パラメータと衝突しない。 */
export const RECEPTION_PARAM_KEYS = ["rt", "rn", "rs"] as const;

/** UTF-8文字列をURL安全なbase64url(パディング無し)にエンコードする。 */
export function encodeName(name: string): string {
  const bytes = new TextEncoder().encode(name);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** base64urlエンコードされた氏名をデコードする。不正な値は null を返す。 */
export function decodeName(encoded: string): string | null {
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
}

/** クエリパラメータ(文字列)から受付情報を読み取る。整理番号か時間枠が無ければ null。 */
export function parseReception(params: { rt?: string; rn?: string; rs?: string }): ReceptionInfo | null {
  const { rt, rn, rs } = params;
  if (!rt || !rs) return null;
  const name = rn ? decodeName(rn) ?? undefined : undefined;
  return { ticketNumber: rt, slotKey: rs, name };
}

/** 受付情報をURLに反映する(rt/rn/rsを上書き。氏名が無ければrnは付与しない)。 */
export function applyReceptionParams(url: URL, info: ReceptionInfo): void {
  url.searchParams.set("rt", info.ticketNumber);
  url.searchParams.set("rs", info.slotKey);
  if (info.name) {
    url.searchParams.set("rn", encodeName(info.name));
  } else {
    url.searchParams.delete("rn");
  }
}

/** "1000"のような時間枠キー(HMM/HHMM)を "10:00" 形式に整形する。パターンに合わなければ生値を返す。 */
export function formatSlotKey(key: string): string {
  if (!/^\d{3,4}$/.test(key)) return key;
  const padded = key.padStart(4, "0");
  return `${padded.slice(0, 2)}:${padded.slice(2)}`;
}

const TICKET_TEXT_TYPE_BYTE = 0x54; // 'T'
const TNF_WELL_KNOWN = 0x01;

function isTicketTextRecord(record: RawNdefRecord): boolean {
  return record.tnf === TNF_WELL_KNOWN && record.type.length === 1 && record.type[0] === TICKET_TEXT_TYPE_BYTE;
}

/** NDEF Textレコードのpayload(status byte + lang + text)から本文を取り出す。Buffer非依存。 */
function decodeTextRecordPayload(payload: Uint8Array): string {
  const statusByte = payload[0] ?? 0;
  const langLength = statusByte & 0x3f;
  return new TextDecoder("utf-8").decode(payload.subarray(1 + langLength));
}

/**
 * 整理券管理アプリ(waiting-display-demo)が書き込んだ Text レコード群から受付情報を復元する。
 * 整理券JSONスキーマ {t: 整理番号, n: 氏名, s: 時間枠キー} との薄い結合。
 * 見つからない、またはJSONとして不正な場合は null を返す。
 */
export function readTicketFromRecords(records: RawNdefRecord[]): ReceptionInfo | null {
  const record = records.find(isTicketTextRecord);
  if (!record) return null;

  try {
    const parsed = JSON.parse(decodeTextRecordPayload(record.payload));
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof parsed.t === "string" &&
      typeof parsed.n === "string" &&
      typeof parsed.s === "string"
    ) {
      return { ticketNumber: parsed.t, name: parsed.n || undefined, slotKey: parsed.s };
    }
    return null;
  } catch {
    return null;
  }
}
