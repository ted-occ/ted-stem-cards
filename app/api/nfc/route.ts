import { NextRequest, NextResponse } from "next/server";
import { getStatus, registerNextCard, cancelRegister, getRegisteredCards } from "@/lib/nfc";

/** GET /api/nfc — reader status + registered cards */
export async function GET() {
  const status = getStatus();
  const cards = getRegisteredCards();
  return NextResponse.json({ ...status, cards });
}

/** POST /api/nfc — register a card (tap to associate UID with cardId) */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const cardId = body.cardId as string | undefined;

  if (!cardId) {
    return NextResponse.json({ error: "cardId is required" }, { status: 400 });
  }

  try {
    const result = await registerNextCard(cardId, 30000);
    return NextResponse.json({ success: true, uid: result.uid, cardId });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

/** DELETE /api/nfc — cancel pending registration */
export async function DELETE() {
  cancelRegister();
  return NextResponse.json({ cancelled: true });
}
