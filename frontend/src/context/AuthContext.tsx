"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthStore, API_BASE } from "../lib/auth";
import { useRouter } from "next/navigation";

interface AuthContextType {
  user: any;
  loading: boolean;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => void;
  api: (path: string, options?: RequestInit) => Promise<Response>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({
  children,
  prefix,
  loginEndpoint,
}: {
  children: React.ReactNode;
  prefix: string;
  loginEndpoint: string;
}) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const initAuth = async () => {
      const storedUser = AuthStore.getUser(prefix);
      if (storedUser) {
        try {
          const res = await AuthStore.api(prefix, "/api/v1/auth/me", {}, () => {
            setUser(null);
          });
          if (res.ok) {
            const data = await res.json();
            setUser(data);
            AuthStore.save(prefix, { ...data, access_token: AuthStore.getAccessToken(prefix), refresh_token: AuthStore.getRefreshToken(prefix) });
          }
        } catch {
          setUser(null);
        }
      }
      setLoading(false);
    };
    initAuth();
  }, [prefix]);

  const login = async (email: string, pass: string) => {
    const res = await fetch(`${API_BASE}${loginEndpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: pass }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "Login failed");
    }
    const data = await res.json();
    AuthStore.save(prefix, data);
    setUser(data.user);
  };

  const logout = () => {
    AuthStore.clear(prefix);
    setUser(null);
  };

  const api = (path: string, options?: RequestInit) => {
    return AuthStore.api(prefix, path, options, () => {
      setUser(null);
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, api }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
