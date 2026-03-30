"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { AuthUser } from "@/types/auth";

const LS_ACCESS = "td_access_token";
const LS_REFRESH = "td_refresh_token";
const LS_EXPIRES = "td_expires_at";
const LS_USER = "td_user";

// Refresh 2 minutes before expiry
const REFRESH_MARGIN_S = 120;

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(LS_USER);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function saveSession(access: string, refresh: string, expiresAt: number, user: AuthUser) {
  localStorage.setItem(LS_ACCESS, access);
  localStorage.setItem(LS_REFRESH, refresh);
  localStorage.setItem(LS_EXPIRES, String(expiresAt));
  localStorage.setItem(LS_USER, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(LS_ACCESS);
  localStorage.removeItem(LS_REFRESH);
  localStorage.removeItem(LS_EXPIRES);
  localStorage.removeItem(LS_USER);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(LS_ACCESS);
}

interface SessionPayload {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: AuthUser;
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleRefresh = useCallback((expiresAt: number, refreshToken: string) => {
    if (refreshTimer.current) clearTimeout(refreshTimer.current);

    const nowSec = Math.floor(Date.now() / 1000);
    const delaySec = Math.max(expiresAt - nowSec - REFRESH_MARGIN_S, 10);

    refreshTimer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) {
          clearSession();
          setUser(null);
          return;
        }
        const data: SessionPayload = await res.json();
        saveSession(data.access_token, data.refresh_token, data.expires_at, data.user);
        setUser(data.user);
        scheduleRefresh(data.expires_at, data.refresh_token);
      } catch {
        clearSession();
        setUser(null);
      }
    }, delaySec * 1000);
  }, []);

  // Validate session on mount
  useEffect(() => {
    const validate = async () => {
      const token = localStorage.getItem(LS_ACCESS);
      const refresh = localStorage.getItem(LS_REFRESH);
      const expiresAt = Number(localStorage.getItem(LS_EXPIRES) || "0");

      if (!token) {
        setLoading(false);
        return;
      }

      // If token is expired, try refresh
      const nowSec = Math.floor(Date.now() / 1000);
      if (expiresAt && nowSec >= expiresAt && refresh) {
        try {
          const res = await fetch("/api/auth/refresh", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: refresh }),
          });
          if (res.ok) {
            const data: SessionPayload = await res.json();
            saveSession(data.access_token, data.refresh_token, data.expires_at, data.user);
            setUser(data.user);
            scheduleRefresh(data.expires_at, data.refresh_token);
          } else {
            clearSession();
          }
        } catch {
          clearSession();
        }
        setLoading(false);
        return;
      }

      // Token not expired — validate it
      try {
        const res = await fetch("/api/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data: AuthUser = await res.json();
          setUser(data);
          if (expiresAt && refresh) {
            scheduleRefresh(expiresAt, refresh);
          }
        } else {
          clearSession();
        }
      } catch {
        clearSession();
      }
      setLoading(false);
    };

    validate();
    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
    };
  }, [scheduleRefresh]);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail ?? "Login failed");
    saveSession(data.access_token, data.refresh_token, data.expires_at, data.user);
    setUser(data.user);
    scheduleRefresh(data.expires_at, data.refresh_token);
  }, [scheduleRefresh]);

  const register = useCallback(async (email: string, password: string, userName: string): Promise<void> => {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, userName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail ?? "Registration failed");
    if (data.access_token) {
      saveSession(data.access_token, data.refresh_token, data.expires_at, data.user);
      setUser(data.user);
      scheduleRefresh(data.expires_at, data.refresh_token);
    }
  }, [scheduleRefresh]);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
    if (refreshTimer.current) clearTimeout(refreshTimer.current);
  }, []);

  return { user, loading, login, register, logout };
}
