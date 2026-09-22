"use client";

// Lightweight Google sign-in via Google Identity Services (GIS).
//
// This needs ONLY an OAuth 2.0 Web client ID from any Google Cloud project
// (APIs & Services → Credentials) — no Firebase. Set it as
// NEXT_PUBLIC_GOOGLE_CLIENT_ID in frontend/.env.local. Without it the app
// still works via "Continue as guest", so the workshop hand-over has zero
// auth setup as a hard dependency.

import { createContext, useContext, useEffect, useRef, useState } from "react";

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const STORAGE_KEY = "social-spark-user";

export type User = {
  name: string;
  email?: string;
  picture?: string;
  guest?: boolean;
};

type AuthContextValue = {
  user: User | null;
  signInAsGuest: () => void;
  signOut: () => void;
  setUser: (u: User) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setUserState(JSON.parse(raw));
    } catch {
      /* corrupt storage — treat as signed out */
    }
    setLoaded(true);
  }, []);

  const setUser = (u: User) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(u));
    setUserState(u);
  };

  const signInAsGuest = () => setUser({ name: "Guest", guest: true });

  const signOut = () => {
    localStorage.removeItem(STORAGE_KEY);
    setUserState(null);
    // Stop GIS from silently signing the same account back in.
    (window as any).google?.accounts?.id?.disableAutoSelect?.();
  };

  // Avoid a sign-in flash while localStorage is being read.
  if (!loaded) return null;

  return (
    <AuthContext.Provider value={{ user, signInAsGuest, signOut, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

/** The GIS-rendered "Sign in with Google" button. */
export function GoogleSignInButton() {
  const { setUser } = useAuth();
  const buttonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !buttonRef.current) return;

    const init = () => {
      const gsi = (window as any).google?.accounts?.id;
      if (!gsi || !buttonRef.current) return;
      gsi.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: (response: { credential: string }) => {
          // The credential is a JWT; its payload (name/email/picture) is all
          // we need for a workshop UI — no backend verification here.
          const payload = JSON.parse(
            atob(response.credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))
          );
          setUser({
            name: payload.name ?? payload.email,
            email: payload.email,
            picture: payload.picture,
          });
        },
      });
      gsi.renderButton(buttonRef.current, {
        theme: "outline",
        size: "large",
        shape: "pill",
        width: 280,
      });
    };

    if ((window as any).google?.accounts?.id) {
      init();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = init;
    document.head.appendChild(script);
  }, [setUser]);

  if (!GOOGLE_CLIENT_ID) {
    return (
      <p className="signin-note">
        Google sign-in is not configured. Set{" "}
        <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> in{" "}
        <code>frontend/.env.local</code> (see README) — or continue as guest.
      </p>
    );
  }
  return <div ref={buttonRef} />;
}
