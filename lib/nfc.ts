/* eslint-disable @typescript-eslint/no-explicit-any */
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

let pendingWrite: {
  url: string;
  resolve: () => void;
  reject: (err: Error) => void;
} | null = null;

/**
 * Build an NDEF message containing a single URI record.
 * Uses URI prefix 0x04 ("https://") if the url starts with "https://",
 * otherwise 0x03 ("http://"), otherwise 0x00 (no prefix).
 */
function buildNdefUrlMessage(url: string): Buffer {
  let prefixCode = 0x00;
  let uriBody = url;
  if (url.startsWith("https://")) {
    prefixCode = 0x04;
    uriBody = url.slice(8);
  } else if (url.startsWith("http://")) {
    prefixCode = 0x03;
    uriBody = url.slice(7);
  }

  const uriBytes = Buffer.from(uriBody, "utf8");
  const payloadLength = 1 + uriBytes.length; // prefix byte + uri

  // NDEF record: MB|ME|SR|TNF=well-known(1) = 0xD1
  const record = Buffer.alloc(3 + 1 + payloadLength);
  record[0] = 0xd1; // flags
  record[1] = 0x01; // type length
  record[2] = payloadLength; // payload length (short record)
  record[3] = 0x55; // type = 'U' (URI)
  record[4] = prefixCode;
  uriBytes.copy(record, 5);

  // TLV wrapper: 0x03, length, record, 0xFE terminator
  const tlv = Buffer.alloc(2 + record.length + 1);
  tlv[0] = 0x03; // NDEF message TLV
  tlv[1] = record.length;
  record.copy(tlv, 2);
  tlv[2 + record.length] = 0xfe; // terminator

  return tlv;
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
    const ndefData = buildNdefUrlMessage(req.url);
    const PAGE_SIZE = 4;
    const startPage = 4; // NTAG user data starts at page 4

    // Write 4 bytes at a time
    for (let offset = 0; offset < ndefData.length; offset += PAGE_SIZE) {
      const page = startPage + offset / PAGE_SIZE;
      const chunk = Buffer.alloc(PAGE_SIZE, 0);
      ndefData.copy(chunk, 0, offset, Math.min(offset + PAGE_SIZE, ndefData.length));
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
