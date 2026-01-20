import { NextResponse } from "next/server";
import { requireOfficeNetwork, verifyOfficePass, addCorsHeaders } from "@/lib/networkGuard";

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-office-pass',
    },
  });
}

export async function POST(req: Request) {
  const pass = req.headers.get("x-office-pass") ?? "";
  if (!verifyOfficePass(pass)) {
    const response = NextResponse.json({ ok: false }, { status: 403 });
    return addCorsHeaders(response);
  }

  const result = await requireOfficeNetwork(req);
  if (!result.ok) {
    const response = NextResponse.json({ ok: false }, { status: 403 });
    return addCorsHeaders(response);
  }

  const response = NextResponse.json({ ok: true }, { status: 200 });
  return addCorsHeaders(response);
}
