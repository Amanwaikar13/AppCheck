"use client";

import { useState } from "react";
import { useDispatch } from "react-redux";
import { logout } from "@/features/auth/authSlice";

/**
 * Signs out through the API (revoking the session server-side). On success the
 * auth state becomes "unauthenticated" and AuthGate redirects to /login.
 */
export function useSignOut() {
  const dispatch = useDispatch();
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState(null);

  const signOut = async () => {
    setSigningOut(true);
    setError(null);
    const result = await dispatch(logout());
    // Another sign-out is already in flight; it will update the session state.
    if (result.meta?.condition) {
      setSigningOut(false);
      return false;
    }
    const ok = logout.fulfilled.match(result);
    if (!ok) setError("Could not sign out. Check your connection and try again.");
    setSigningOut(false);
    return ok;
  };

  return { signOut, signingOut, error };
}
