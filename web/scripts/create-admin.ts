/**
 * One-time script to create the admin user.
 * Run with: npx tsx scripts/create-admin.ts
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Set SUPABASE_URL and SUPABASE_KEY env vars");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const { data, error } = await supabase.auth.admin.createUser({
    email: "jonatan-ordonez@hotmail.com",
    password: "12345678",
    email_confirm: true,
    user_metadata: {
      userName: "jonatan-ordonez",
      role: "admin",
    },
  });

  if (error) {
    console.error("Failed to create user:", error.message);
    process.exit(1);
  }

  console.log("Admin user created successfully:");
  console.log("  ID:", data.user.id);
  console.log("  Email:", data.user.email);
  console.log("  Role:", data.user.user_metadata?.role);
}

main();
