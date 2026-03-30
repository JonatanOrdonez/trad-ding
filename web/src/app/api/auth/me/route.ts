import { NextRequest } from "next/server";
import { extractToken, getUserFromToken } from "@/lib/services/auth";

export async function GET(req: NextRequest) {
  const token = extractToken(req.headers.get("authorization"));
  if (!token) {
    return Response.json({ detail: "No token provided" }, { status: 401 });
  }

  const user = await getUserFromToken(token);
  if (!user) {
    return Response.json({ detail: "Invalid or expired token" }, { status: 401 });
  }

  return Response.json({
    id: user.id,
    email: user.email,
    userName: user.user_metadata?.userName ?? "",
    role: user.user_metadata?.role ?? "user",
  });
}
