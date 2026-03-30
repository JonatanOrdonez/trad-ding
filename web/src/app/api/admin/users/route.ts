import { NextRequest } from "next/server";
import { supabase } from "@/lib/services/supabase";
import { extractToken, requireAdmin } from "@/lib/services/auth";

export async function GET(req: NextRequest) {
  const admin = await requireAdmin(extractToken(req.headers.get("authorization")));
  if (!admin) {
    return Response.json({ detail: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 100 });

  if (error) {
    return Response.json({ detail: error.message }, { status: 500 });
  }

  const users = data.users.map((u) => ({
    id: u.id,
    email: u.email ?? "",
    userName: u.user_metadata?.userName ?? "",
    role: u.user_metadata?.role ?? "user",
    created_at: u.created_at,
  }));

  return Response.json(users);
}
