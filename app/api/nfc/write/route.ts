import { NextRequest, NextResponse } from "next/server";
import { writeNdefUrl, cancelWrite } from "@/lib/nfc";

/** POST /api/nfc/write — write NDEF URL to next tapped NTAG */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const url = body.url as string | undefined;

  if (!url) {
    return NextResponse.json({ error: "url is required" }, { status: 400 });
  }

  try {
    await writeNdefUrl(url, 30000);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

/** DELETE /api/nfc/write — cancel pending write */
export async function DELETE() {
  cancelWrite();
  return NextResponse.json({ cancelled: true });
}
