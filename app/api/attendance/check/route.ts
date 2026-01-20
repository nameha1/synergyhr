import { NextResponse } from "next/server";
import { requireOfficeNetwork, signOfficePass, addCorsHeaders } from "@/lib/networkGuard";

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

export async function GET(req: Request) {
  const result = await requireOfficeNetwork(req);
  if (!result.ok) {
    console.error("[office-gate] blocked:", (result as { reason: string }).reason);
    const response = NextResponse.json({ ok: false }, { status: 403 });
    return addCorsHeaders(response);
  }

  const pass = signOfficePass({ ip: result.ip, asn: result.asn }, 120);
  const response = NextResponse.json({ ok: true, pass }, { status: 200 });
  return addCorsHeaders(response);
}
