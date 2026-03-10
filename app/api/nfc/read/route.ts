import { NextResponse } from "next/server";
import { drainReadEvents, getStatus } from "@/lib/nfc";

/** GET /api/nfc/read — drain pending NFC read events */
export async function GET() {
  const status = getStatus();
  const events = drainReadEvents();
  return NextResponse.json({ connected: status.connected, events });
}
