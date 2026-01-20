import { NextResponse } from "next/server";
import { requireOfficeNetwork, verifyOfficePass } from "@/lib/networkGuard";

export async function POST(req: Request) {
  const pass = req.headers.get("x-office-pass") ?? "";
  if (!verifyOfficePass(pass)) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const result = await requireOfficeNetwork(req);
  if (!result.ok) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
