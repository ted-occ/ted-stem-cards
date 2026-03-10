import { NextRequest, NextResponse } from "next/server";
import { getStatus, writeTag, cancelWrite } from "@/lib/nfc";

/** GET /api/nfc — reader status */
export async function GET() {
  const status = getStatus();
  return NextResponse.json(status);
}

/** POST /api/nfc — write card ID to NFC tag */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const cardId = body.cardId as string | undefined;

  if (!cardId) {
    return NextResponse.json({ error: "cardId is required" }, { status: 400 });
  }

  try {
    const result = await writeTag(cardId, 30000);
    return NextResponse.json({ success: true, uid: result.uid, cardId });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

/** DELETE /api/nfc — cancel pending write */
export async function DELETE() {
  cancelWrite();
  return NextResponse.json({ cancelled: true });
}
