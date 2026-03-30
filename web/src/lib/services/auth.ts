import { supabase } from "./supabase";
import type { UserRole } from "@/types/auth";

/**
 * Validate an access token and return the user if valid.
 */
export async function getUserFromToken(accessToken: string) {
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return null;
  return data.user;
}

/**
 * Require admin role from the access token. Returns the user or null.
 */
export async function requireAdmin(accessToken: string | null) {
  if (!accessToken) return null;
  const user = await getUserFromToken(accessToken);
  if (!user) return null;
  const role = (user.user_metadata?.role as UserRole) ?? "user";
  if (role !== "admin") return null;
  return user;
}

/**
 * Extract Bearer token from Authorization header.
 */
export function extractToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}
