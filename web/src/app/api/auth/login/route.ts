import { NextRequest } from "next/server";
import { supabase } from "@/lib/services/supabase";

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return Response.json({ detail: "Email and password are required" }, { status: 400 });
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      return Response.json({ detail: error.message }, { status: 401 });
    }

    const user = data.user;
    return Response.json({
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
      user: {
        id: user.id,
        email: user.email,
        userName: user.user_metadata?.userName ?? "",
        role: user.user_metadata?.role ?? "user",
      },
    });
  } catch {
    return Response.json({ detail: "Login failed" }, { status: 500 });
  }
}
