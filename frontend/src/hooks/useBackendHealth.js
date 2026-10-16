"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useDispatch, useSelector } from "react-redux";
import { checkBackendHealth, selectHealth } from "@/features/health/healthSlice";

const subscribeNoop = () => () => {};

/**
 * False on the server and during hydration, true afterwards. Several components
 * read health, and the first to mount starts the request; one that hydrates
 * later must still render the server's "checking" markup to avoid a mismatch.
 */
function useHydrated() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

const PRE_HYDRATION_STATE = { requestStatus: "idle", report: null, error: null, checkedAt: null };

/** Reads backend health from the store, checking once on first use. */
export function useBackendHealth() {
  const dispatch = useDispatch();
  const storeHealth = useSelector(selectHealth);
  const hydrated = useHydrated();
  const shouldCheck = storeHealth.requestStatus === "idle";

  useEffect(() => {
    if (shouldCheck) dispatch(checkBackendHealth());
  }, [shouldCheck, dispatch]);

  const health = hydrated ? storeHealth : PRE_HYDRATION_STATE;
  return {
    ...health,
    isLoading: health.requestStatus === "idle" || health.requestStatus === "loading",
    refresh: () => dispatch(checkBackendHealth()),
  };
}
