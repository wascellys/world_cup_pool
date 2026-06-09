"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

type LoginInput = { username: string; password: string };
type RegisterInput = { name: string; username: string; password: string; avatar?: string | null };

type AuthState = {
  status: "idle" | "loading";
  token: string | null;
  user: AuthUser | null;
  login: (input: LoginInput) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
  requireAuth: () => void;
};

const AuthContext = createContext<AuthState | null>(null);

const STORAGE_KEY = "wcp_auth_v1";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthState["status"]>("idle");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  const client = useMemo(() => api({ token, baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL }), [token]);

  useEffect(() => {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as { token: string; user: AuthUser };
      setToken(parsed.token);
      setUser(parsed.user);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  const persist = useCallback((nextToken: string, nextUser: AuthUser) => {
    setToken(nextToken);
    setUser(nextUser);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: nextToken, user: nextUser }));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
  }, []);

  const login = useCallback(
    async (input: LoginInput) => {
      setStatus("loading");
      try {
        const res = await api({ baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL }).post<{
          token: string;
          id: number;
          username: string;
          nome: string;
          avatar?: string | null;
        }>("/auth/login/", input);
        persist(res.token, { id: res.id, username: res.username, nome: res.nome, avatar: res.avatar ?? null });
      } finally {
        setStatus("idle");
      }
    },
    [persist]
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      setStatus("loading");
      try {
        const res = await api({ baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL }).post<{
          token: string;
          id: number;
          username: string;
          nome: string;
          avatar?: string | null;
        }>("/participant/", input);
        persist(res.token, { id: res.id, username: res.username, nome: res.nome, avatar: res.avatar ?? null });
      } finally {
        setStatus("idle");
      }
    },
    [persist]
  );

  const requireAuth = useCallback(async () => {
    if (!token) return;
    try {
      const me = await client.get<{ id: number; username: string; nome: string; avatar?: string | null }>("/auth/me/");
      setUser({ id: me.id, username: me.username, nome: me.nome, avatar: me.avatar ?? null });
    } catch {
      logout();
    }
  }, [client, logout, token]);

  const value: AuthState = {
    status,
    token,
    user,
    login,
    register,
    logout,
    requireAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

