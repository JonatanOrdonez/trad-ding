import { NextRequest } from "next/server";
import { supabase } from "@/lib/services/supabase";
import { extractToken, requireAdmin } from "@/lib/services/auth";
import type { UserRole } from "@/types/auth";

const VALID_ROLES: UserRole[] = ["user", "admin"];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const admin = await requireAdmin(extractToken(req.headers.get("authorization")));
  if (!admin) {
    return Response.json({ detail: "Forbidden" }, { status: 403 });
  }

  const { userId } = await params;
  const { role } = await req.json();

  if (!VALID_ROLES.includes(role)) {
    return Response.json({ detail: "Invalid role. Must be 'user' or 'admin'" }, { status: 400 });
  }

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    user_metadata: { role },
  });

  if (error) {
    return Response.json({ detail: error.message }, { status: 500 });
  }

  return Response.json({ success: true, userId, role });
}
