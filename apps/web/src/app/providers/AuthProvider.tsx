import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import type { User } from "@/shared/api/types";
import { getStoredToken, setStoredToken } from "@/shared/api/http";

type AuthContextValue = {
  token: string | null;
  user: User | null;
  setSession: (input: { token: string; user: User }) => void;
  setUser: (user: User | null) => void;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getStoredToken());
  const [user, setUser] = useState<User | null>(null);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      setUser,
      setSession: (session) => {
        setStoredToken(session.token);
        setToken(session.token);
        setUser(session.user);
      },
      logout: () => {
        setStoredToken(null);
        setToken(null);
        setUser(null);
      }
    }),
    [token, user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
