import { NextRequest } from "next/server";
import { supabase } from "@/lib/services/supabase";
import { extractToken, requireAdmin } from "@/lib/services/auth";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(extractToken(req.headers.get("authorization")));
  if (!admin) return Response.json({ detail: "Forbidden" }, { status: 403 });

  const { data, error } = await supabase
    .from("assets")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return Response.json({ detail: error.message }, { status: 500 });
  return Response.json(data);
}
