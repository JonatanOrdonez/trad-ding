import { NextRequest } from "next/server";
import { supabase } from "@/lib/services/supabase";

export async function POST(req: NextRequest) {
  try {
    const { email, password, userName } = await req.json();

    if (!email || !password || !userName) {
      return Response.json({ detail: "Email, password, and userName are required" }, { status: 400 });
    }

    if (password.length < 8) {
      return Response.json({ detail: "Password must be at least 8 characters" }, { status: 400 });
    }

    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
      return Response.json({ detail: "Password must contain at least one special character" }, { status: 400 });
    }

    // Create user with admin API (service role key)
    const { data: createData, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { userName, role: "user" },
    });

    if (createError) {
      return Response.json({ detail: createError.message }, { status: 400 });
    }

    // Sign in to get session tokens
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      return Response.json({ detail: "Account created but login failed. Please log in manually." }, { status: 201 });
    }

    const user = createData.user;
    return Response.json({
      access_token: signInData.session.access_token,
      refresh_token: signInData.session.refresh_token,
      expires_at: signInData.session.expires_at,
      user: {
        id: user.id,
        email: user.email,
        userName: user.user_metadata?.userName ?? "",
        role: user.user_metadata?.role ?? "user",
      },
    });
  } catch {
    return Response.json({ detail: "Registration failed" }, { status: 500 });
  }
}
