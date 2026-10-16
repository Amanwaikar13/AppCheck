"use client";

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchSession, selectAuth } from "@/features/auth/authSlice";

/** Reads auth state, asking the API once per page load whether a session exists. */
export function useAuth() {
  const dispatch = useDispatch();
  const auth = useSelector(selectAuth);
  const shouldCheck = auth.status === "idle";

  useEffect(() => {
    if (shouldCheck) dispatch(fetchSession());
  }, [shouldCheck, dispatch]);

  return {
    ...auth,
    isAuthenticated: auth.status === "authenticated",
    isResolving: auth.status === "idle" || auth.status === "checking",
    retry: () => dispatch(fetchSession()),
  };
}
