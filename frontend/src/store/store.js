import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/features/auth/authSlice";
import healthReducer from "@/features/health/healthSlice";
import scansReducer from "@/features/scans/scansSlice";

// A new store is created per request/render tree, as recommended for the App Router.
export function makeStore() {
  return configureStore({
    reducer: {
      auth: authReducer,
      health: healthReducer,
      scans: scansReducer,
    },
  });
}
