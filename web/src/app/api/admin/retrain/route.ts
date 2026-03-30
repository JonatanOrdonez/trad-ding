import { NextRequest } from "next/server";
import { extractToken, requireAdmin } from "@/lib/services/auth";

export async function POST(req: NextRequest) {
  const admin = await requireAdmin(extractToken(req.headers.get("authorization")));
  if (!admin) return Response.json({ detail: "Forbidden" }, { status: 403 });

  const { symbol } = await req.json();
  if (!symbol) return Response.json({ detail: "symbol is required" }, { status: 400 });

  // Call the internal train endpoint with the API key
  const trainApiKey = process.env.TRAIN_API_KEY;
  if (!trainApiKey) return Response.json({ detail: "TRAIN_API_KEY not configured" }, { status: 500 });

  const baseUrl = req.nextUrl.origin;
  const res = await fetch(`${baseUrl}/api/train`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": trainApiKey,
    },
    body: JSON.stringify({ symbols: [symbol] }),
  });

  const data = await res.json();
  if (!res.ok) return Response.json(data, { status: res.status });

  return Response.json(data);
}
