/* eslint-disable @typescript-eslint/no-explicit-any */
import { NFC } from "nfc-pcsc";

// ---- NDEF helpers for NTAG213/215/216 ----

/** Build an NDEF Text record with "en" language code. */
function buildNdefText(text: string): Buffer {
  const langCode = Buffer.from("en", "ascii"); // 2 bytes
  const textBuf = Buffer.from(text, "utf-8");
  const payloadLen = 1 + langCode.length + textBuf.length; // status + lang + text

  // NDEF record: MB=1 ME=1 CF=0 SR=1 IL=0 TNF=001 → 0xD1
  const record = Buffer.alloc(3 + 1 + payloadLen);
  let off = 0;
  record[off++] = 0xd1;           // header flags
  record[off++] = 0x01;           // type length = 1
  record[off++] = payloadLen;     // payload length (SR)
  record[off++] = 0x54;           // type = "T"
  record[off++] = langCode.length; // status byte (UTF-8, lang len)
  langCode.copy(record, off); off += langCode.length;
  textBuf.copy(record, off);

  return record;
}

/** Wrap an NDEF message in TLV for NTAG user memory (starting at page 4). */
function wrapNdefTlv(ndefMessage: Buffer): Buffer {
  // TLV: 03 [len] [ndef] FE
  const tlv = Buffer.alloc(2 + ndefMessage.length + 1);
  tlv[0] = 0x03; // NDEF Message TLV
  tlv[1] = ndefMessage.length;
  ndefMessage.copy(tlv, 2);
  tlv[2 + ndefMessage.length] = 0xfe; // Terminator TLV

  // Pad to multiple of 4 bytes (NTAG page size)
  const padded = Buffer.alloc(Math.ceil(tlv.length / 4) * 4);
  tlv.copy(padded);
  return padded;
}

/** Parse NDEF Text record from raw NTAG user memory (pages 4+). */
function parseNdefText(data: Buffer): string | null {
  // Find NDEF Message TLV: 03 [len] [message...]
  let i = 0;
  while (i < data.length) {
    const type = data[i];
    if (type === 0x00) { i++; continue; }          // NULL TLV
    if (type === 0xfe) break;                       // Terminator TLV
    if (type === 0x03) {                            // NDEF Message TLV
      const len = data[i + 1];
      const msg = data.subarray(i + 2, i + 2 + len);
      return parseNdefRecord(msg);
    }
    // Skip unknown TLV
    const len = data[i + 1];
    i += 2 + len;
  }
  return null;
}

function parseNdefRecord(msg: Buffer): string | null {
  if (msg.length < 4) return null;
  const header = msg[0];
  const typeLen = msg[1];
  const sr = (header & 0x10) !== 0; // Short Record flag
  const payloadLen = sr ? msg[2] : msg.readUInt32BE(2);
  const typeOffset = sr ? 3 : 6;
  const type = msg.subarray(typeOffset, typeOffset + typeLen);
  const payloadOffset = typeOffset + typeLen;
  const payload = msg.subarray(payloadOffset, payloadOffset + payloadLen);

  // Text record: type = "T" (0x54)
  if (type.length === 1 && type[0] === 0x54 && payload.length > 0) {
    const statusByte = payload[0];
    const langLen = statusByte & 0x3f;
    const text = payload.subarray(1 + langLen).toString("utf-8");
    return text;
  }
  return null;
}

// ---- Singleton NFC manager ----

interface WriteRequest {
  cardId: string;
  resolve: (info: { uid: string }) => void;
  reject: (err: Error) => void;
}

export interface NfcReadEvent {
  cardId: string;
  uid: string;
  timestamp: number;
}

let nfc: any = null;
let activeReader: any = null;
let readerName: string = "";
let pendingWrite: WriteRequest | null = null;

// Read event queue — consumers poll and drain this
let readEvents: NfcReadEvent[] = [];
let lastSeenUid: string = "";

function ensureNfc() {
  if (nfc) return;
  nfc = new NFC();

  nfc.on("reader", (reader: any) => {
    activeReader = reader;
    readerName = reader.reader.name;
    console.log(`[NFC] Reader connected: ${readerName}`);

    reader.on("card", async (card: any) => {
      console.log(`[NFC] Card detected: UID=${card.uid}, ATR=${card.atr?.toString("hex")}`);

      // --- Write mode ---
      if (pendingWrite) {
        const req = pendingWrite;
        pendingWrite = null;

        try {
          const ndef = buildNdefText(req.cardId);
          const data = wrapNdefTlv(ndef);
          await reader.write(4, data, 4);
          console.log(`[NFC] Written "${req.cardId}" (${data.length} bytes) to UID=${card.uid}`);
          req.resolve({ uid: card.uid });
        } catch (err: any) {
          console.error(`[NFC] Write error:`, err);
          req.reject(new Error(err.message ?? String(err)));
        }
        return;
      }

      // --- Read mode (default) ---
      // Deduplicate: ignore the same UID until it's removed
      if (card.uid === lastSeenUid) return;
      lastSeenUid = card.uid;

      try {
        // Read 16 pages (64 bytes) from page 4 — enough for our short NDEF records
        const data = await reader.read(4, 64, 4);
        const text = parseNdefText(data);
        if (text) {
          console.log(`[NFC] Read "${text}" from UID=${card.uid}`);
          readEvents.push({ cardId: text, uid: card.uid, timestamp: Date.now() });
        } else {
          console.log(`[NFC] No NDEF text found on UID=${card.uid}`);
        }
      } catch (err: any) {
        console.error(`[NFC] Read error:`, err);
      }
    });

    reader.on("card.off", (card: any) => {
      console.log(`[NFC] Card removed: UID=${card.uid}`);
      // Clear lastSeenUid so the same card can be read again after removal
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
    waiting: pendingWrite !== null,
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
 * Queue a write request. Resolves when a tag is presented and written.
 * Rejects on timeout or write error.
 */
export function writeTag(cardId: string, timeoutMs = 30000): Promise<{ uid: string }> {
  ensureNfc();

  if (!activeReader) {
    return Promise.reject(new Error("NFCリーダーが接続されていません。"));
  }

  // Cancel any existing pending write
  if (pendingWrite) {
    pendingWrite.reject(new Error("新しい書き込みリクエストで上書きされました。"));
    pendingWrite = null;
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (pendingWrite?.cardId === cardId) {
        pendingWrite = null;
        reject(new Error("タイムアウト: タグが検出されませんでした。"));
      }
    }, timeoutMs);

    pendingWrite = {
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

/** Cancel any pending write. */
export function cancelWrite(): void {
  if (pendingWrite) {
    pendingWrite.reject(new Error("キャンセルされました。"));
    pendingWrite = null;
  }
}
