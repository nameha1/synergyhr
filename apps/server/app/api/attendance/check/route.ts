import { NextResponse } from "next/server";
import { requireOfficeNetwork, signOfficePass } from "@/lib/networkGuard";

export async function GET(req: Request) {
  const result = await requireOfficeNetwork(req);
  if (!result.ok) {
    console.error("[office-gate] blocked:", result.reason);
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const pass = signOfficePass({ ip: result.ip, asn: result.asn }, 120);
  return NextResponse.json({ ok: true, pass }, { status: 200 });
}
