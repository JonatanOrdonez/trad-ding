export type UserRole = "user" | "admin";

export interface AuthUser {
  id: string;
  email: string;
  userName: string;
  role: UserRole;
}

export interface AdminUserRow {
  id: string;
  email: string;
  userName: string;
  role: UserRole;
  created_at: string;
}
