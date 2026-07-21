/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  decodeNdefMessage,
  encodeNdefMessage,
  locateNdefMessageTlv,
  RawNdefRecord,
  TNF_WELL_KNOWN,
} from "./ndef";

let NFC: any;
try { NFC = require("nfc-pcsc").NFC; } catch { /* not available on Vercel */ }
const db = (() => {
  try { return require("./db") as typeof import("./db"); } catch { return null; }
})()
const loadCards = db?.loadCards ?? (() => new Map<string, string>());
const upsertCard = db?.upsertCard ?? (() => {});
const deleteCard = db?.deleteCard ?? (() => {});

// ---- UID-based card mapping (backed by SQLite) ----
// In-memory cache loaded from DB at startup
let uidMap: Map<string, string> | null = null;

function getUidMap(): Map<string, string> {
  if (!uidMap) {
    uidMap = loadCards();
    console.log(`[NFC] Loaded ${uidMap.size} card(s) from database`);
  }
  return uidMap;
}

export function registerCard(uid: string, cardId: string): void {
  getUidMap().set(uid, cardId);
  upsertCard(uid, cardId);
  console.log(`[NFC] Registered UID=${uid} → ${cardId}`);
}

export function getRegisteredCards(): Array<{ uid: string; cardId: string }> {
  return Array.from(getUidMap().entries()).map(([uid, cardId]) => ({ uid, cardId }));
}

export function removeCard(uid: string): void {
  getUidMap().delete(uid);
  deleteCard(uid);
}

// ---- Singleton NFC manager ----

export interface NfcReadEvent {
  cardId: string;
  uid: string;
  timestamp: number;
}

let nfc: any = null;
let activeReader: any = null;
let readerName: string = "";

// Read event queue — consumers poll and drain this
let readEvents: NfcReadEvent[] = [];
let lastSeenUid: string = "";

// Registration mode: when set, next card tap registers with this cardId
let pendingRegister: {
  cardId: string;
  resolve: (info: { uid: string }) => void;
  reject: (err: Error) => void;
} | null = null;

function ensureNfc() {
  if (nfc) return;
  if (!NFC) return; // nfc-pcsc not available (e.g. Vercel)
  nfc = new NFC();

  nfc.on("reader", (reader: any) => {
    activeReader = reader;
    readerName = reader.reader.name;
    console.log(`[NFC] Reader connected: ${readerName}`);

    reader.on("card", async (card: any) => {
      console.log(`[NFC] Card detected: UID=${card.uid}`);

      // --- NDEF write mode ---
      if (await handlePendingWrite(reader, card)) return;

      // --- Registration mode ---
      if (pendingRegister) {
        const req = pendingRegister;
        pendingRegister = null;
        registerCard(card.uid, req.cardId);
        req.resolve({ uid: card.uid });
        return;
      }

      // --- Read mode (default) ---
      if (card.uid === lastSeenUid) return;
      lastSeenUid = card.uid;

      const cardId = getUidMap().get(card.uid);
      if (cardId) {
        console.log(`[NFC] Matched UID=${card.uid} → ${cardId}`);
        readEvents.push({ cardId, uid: card.uid, timestamp: Date.now() });
      } else {
        console.log(`[NFC] Unknown card UID=${card.uid} (not registered)`);
      }
    });

    reader.on("card.off", (card: any) => {
      console.log(`[NFC] Card removed: UID=${card.uid}`);
      if (card.uid === lastSeenUid) {
        lastSeenUid = "";
      }
    });

    reader.on("error", (err: any) => {
      console.error(`[NFC] Reader error:`, err);
    });

    reader.on("end", () => {
      console.log(`[NFC] Reader disconnected: ${readerName}`);
      if (activeReader === reader) {
        activeReader = null;
        readerName = "";
      }
    });
  });

  nfc.on("error", (err: any) => {
    console.error("[NFC] NFC error:", err);
  });
}

/** Get current reader status. */
export function getStatus(): { connected: boolean; readerName: string; waiting: boolean } {
  ensureNfc();
  return {
    connected: activeReader !== null,
    readerName,
    waiting: pendingRegister !== null,
  };
}

/** Drain all pending read events (returns and clears the queue). */
export function drainReadEvents(): NfcReadEvent[] {
  ensureNfc();
  const events = readEvents;
  readEvents = [];
  return events;
}

/**
 * Queue a registration request. Resolves when a card is tapped.
 * The card's UID will be mapped to the given cardId.
 */
export function registerNextCard(cardId: string, timeoutMs = 30000): Promise<{ uid: string }> {
  ensureNfc();

  if (!activeReader) {
    return Promise.reject(new Error("NFCリーダーが接続されていません。"));
  }

  if (pendingRegister) {
    pendingRegister.reject(new Error("新しい登録リクエストで上書きされました。"));
    pendingRegister = null;
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pendingRegister?.cardId === cardId) {
        pendingRegister = null;
        reject(new Error("タイムアウト: カードが検出されませんでした。"));
      }
    }, timeoutMs);

    pendingRegister = {
      cardId,
      resolve: (info) => {
        clearTimeout(timer);
        resolve(info);
      },
      reject: (err) => {
        clearTimeout(timer);
        reject(err);
      },
    };
  });
}

/** Cancel any pending registration. */
export function cancelRegister(): void {
  if (pendingRegister) {
    pendingRegister.reject(new Error("キャンセルされました。"));
    pendingRegister = null;
  }
}

// ---- NDEF URL write to NTAG ----
// NDEFの汎用レコード/メッセージ組立・解析は lib/ndef.ts に切り出し済み。ここでは
// 「自分のURIレコード(type='U')だけを追記/置換し、他typeのレコード(例: 別アプリが書く
// 整理券Textレコード)は保持する」read-modify-write方式を担当する。
// (参考: waiting-display-demo/lib/nfc.ts のTextレコード版read-modify-writeを踏襲)

const PAGE_SIZE = 4;
const USER_MEMORY_START_PAGE = 4; // NTAG のユーザーデータは page 4 から
const INITIAL_READ_BYTES = 64; // 先頭64Bをまず読む。TLV長が超える場合のみ追加読取。

// NTAG機種ごとのユーザーメモリ容量(バイト)。実運用タグは NTAG215。
const NTAG_CAPACITY_BYTES = {
  NTAG213: 144,
  NTAG215: 504,
  NTAG216: 888,
} as const;
const TAG_USER_MEMORY_CAPACITY = NTAG_CAPACITY_BYTES.NTAG215;

const URI_RECORD_TYPE = Buffer.from("U", "ascii"); // type='U' (0x55)

let pendingWrite: {
  url: string;
  resolve: () => void;
  reject: (err: Error) => void;
} | null = null;

/**
 * Build the payload for an NDEF URI record.
 * Uses URI prefix 0x04 ("https://") if the url starts with "https://",
 * otherwise 0x03 ("http://"), otherwise 0x00 (no prefix).
 */
function encodeUriRecordPayload(url: string): Buffer {
  let prefixCode = 0x00;
  let uriBody = url;
  if (url.startsWith("https://")) {
    prefixCode = 0x04;
    uriBody = url.slice(8);
  } else if (url.startsWith("http://")) {
    prefixCode = 0x03;
    uriBody = url.slice(7);
  }

  return Buffer.concat([Buffer.from([prefixCode]), Buffer.from(uriBody, "utf8")]);
}

/** レコードがwell-known type='U'(URIレコード)かどうか判定する。 */
function isUriRecord(record: RawNdefRecord): boolean {
  return record.tnf === TNF_WELL_KNOWN && record.type.length === 1 && record.type[0] === 0x55;
}

// nfc-pcsc の reader.read() は既定でこの単位(16B=4ページ)ごとにREAD BINARY APDUを発行する。
// 一部のPC/SCリーダー(例: SONY PaSoRi)はLe(要求読取長)がこれ以外だと
// Status 0x6c10("Wrong length; correct length is 0x10")で拒否するため、
// 追加読取の要求長は常にこの倍数に切り上げる。
const READ_PACKET_SIZE = 16;

/** カードの page4 以降を読み、NDEFメッセージ内の全レコードを返す(未解釈のraw形式)。 */
async function readNdefRecords(reader: any): Promise<RawNdefRecord[]> {
  let buf: Buffer = await reader.read(USER_MEMORY_START_PAGE, INITIAL_READ_BYTES, PAGE_SIZE);

  // 初回読取に収まっていればここで解決。TLV長が読取範囲を超える場合のみ追加読取する。
  const located = locateNdefMessageTlv(buf);
  if (located !== null) {
    const neededBytes = located.offset + 2 + located.length;
    if (neededBytes > buf.length) {
      const rawLength = Math.ceil(neededBytes / PAGE_SIZE) * PAGE_SIZE;
      const readLength = Math.ceil(rawLength / READ_PACKET_SIZE) * READ_PACKET_SIZE;
      buf = await reader.read(USER_MEMORY_START_PAGE, readLength, PAGE_SIZE);
    }
  }

  return decodeNdefMessage(buf);
}

/**
 * Write an NDEF URL record to the next tapped NTAG card.
 * Pages are 4 bytes; NDEF data starts at page 4.
 */
export function writeNdefUrl(url: string, timeoutMs = 30000): Promise<void> {
  ensureNfc();

  if (!activeReader) {
    return Promise.reject(new Error("NFCリーダーが接続されていません。"));
  }

  if (pendingWrite) {
    pendingWrite.reject(new Error("新しい書き込みリクエストで上書きされました。"));
    pendingWrite = null;
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pendingWrite) {
        pendingWrite = null;
        reject(new Error("タイムアウト: カードが検出されませんでした。"));
      }
    }, timeoutMs);

    pendingWrite = {
      url,
      resolve: () => { clearTimeout(timer); resolve(); },
      reject: (err) => { clearTimeout(timer); reject(err); },
    };
  });
}

/** Cancel any pending write. */
export function cancelWrite(): void {
  if (pendingWrite) {
    pendingWrite.reject(new Error("キャンセルされました。"));
    pendingWrite = null;
  }
}

/** Internal: called from card event to handle pending write */
async function handlePendingWrite(reader: any, card: any): Promise<boolean> {
  if (!pendingWrite) return false;

  const req = pendingWrite;
  pendingWrite = null;

  try {
    const uriRecord: RawNdefRecord = {
      tnf: TNF_WELL_KNOWN,
      type: URI_RECORD_TYPE,
      payload: encodeUriRecordPayload(req.url),
    };

    // read: 既存のNDEFメッセージを読み取り、自分のURIレコード以外(他アプリが書いた
    // レコード等)を保持したまま、URIレコードだけを置き換える/無ければ追加する。
    const existingRecords = await readNdefRecords(reader);
    const uriIndex = existingRecords.findIndex(isUriRecord);
    const records = [...existingRecords];
    if (uriIndex >= 0) {
      records[uriIndex] = uriRecord;
    } else {
      records.push(uriRecord);
    }

    // modify: 全レコードを1つのNDEFメッセージに再構成する。
    const message = encodeNdefMessage(records);

    // 4バイト境界にパディングしてページ単位で逐次書込する。
    const paddedLength = Math.ceil(message.length / PAGE_SIZE) * PAGE_SIZE;
    if (paddedLength > TAG_USER_MEMORY_CAPACITY) {
      throw new Error(
        `書込データ(${paddedLength}B)がタグの容量(${TAG_USER_MEMORY_CAPACITY}B)を超えています。`
      );
    }
    const padded = Buffer.alloc(paddedLength, 0);
    message.copy(padded, 0);

    // write: 再構成したメッセージを書き戻す。
    for (let offset = 0; offset < padded.length; offset += PAGE_SIZE) {
      const page = USER_MEMORY_START_PAGE + offset / PAGE_SIZE;
      const chunk = padded.subarray(offset, offset + PAGE_SIZE);
      await reader.write(page, chunk, PAGE_SIZE);
    }

    console.log(`[NFC] NDEF URL written to card UID=${card.uid}: ${req.url}`);
    req.resolve();
  } catch (err: any) {
    console.error(`[NFC] NDEF write failed:`, err);
    req.reject(new Error(`書き込みに失敗しました: ${err.message || err}`));
  }

  return true;
}
