import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { API_URL } from "@/lib/config";
import { toApiError } from "@/services/apiClient";
import * as authService from "@/services/authService";

const MISSING_API_URL = {
  status: null,
  code: "CONFIG_ERROR",
  message:
    "NEXT_PUBLIC_API_URL is not set. Copy frontend/.env.example to frontend/.env.local and restart the dev server.",
  fieldErrors: {},
};

/**
 * `condition` returning false cancels the dispatch before any request is sent;
 * it is how duplicate requests are prevented (see below).
 */
function authThunk(type, request, condition) {
  return createAsyncThunk(
    type,
    async (arg, { rejectWithValue }) => {
      if (!API_URL) return rejectWithValue(MISSING_API_URL);
      try {
        return await request(arg);
      } catch (error) {
        return rejectWithValue(toApiError(error));
      }
    },
    condition ? { condition } : undefined
  );
}

// Several components read the session (gate, header, forms) and each may ask
// for a check; React Strict Mode also runs effects twice in development. Only
// one session check is ever in flight.
const notWhileChecking = (_arg, { getState }) => getState().auth.status !== "checking";
// One sign-in, registration, or sign-out at a time: a double click or a second
// Enter press while a request is pending sends nothing.
const notWhileSubmitting = (_arg, { getState }) => !getState().auth.submitting;

/** Asks the API who the session cookie belongs to. 401 means signed out. */
export const fetchSession = authThunk("auth/fetchSession", authService.getCurrentUser, notWhileChecking);
export const login = authThunk("auth/login", authService.login, notWhileSubmitting);
export const register = authThunk("auth/register", authService.register, notWhileSubmitting);
export const logout = authThunk("auth/logout", authService.logout, notWhileSubmitting);

const initialState = {
  // idle | checking | authenticated | unauthenticated | error
  status: "idle",
  // Only set after the API has confirmed the session.
  user: null,
  // Set when the session could not be checked (e.g. API unreachable).
  error: null,
  // The full API error for a failed session check (code, retryAfterSeconds, ...).
  errorDetail: null,
  // True while a login, registration, or logout request is in flight.
  submitting: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    const setAuthenticated = (state, action) => {
      state.status = "authenticated";
      state.user = action.payload;
      state.error = null;
      state.errorDetail = null;
      state.submitting = false;
    };
    const startSubmit = (state) => {
      state.submitting = true;
    };
    const endSubmit = (state) => {
      state.submitting = false;
    };

    builder
      .addCase(fetchSession.pending, (state) => {
        state.status = "checking";
        state.error = null;
      })
      .addCase(fetchSession.fulfilled, setAuthenticated)
      .addCase(fetchSession.rejected, (state, action) => {
        state.user = null;
        if (action.payload?.status === 401) {
          state.status = "unauthenticated";
        } else {
          state.status = "error";
          state.error = action.payload?.message ?? action.error.message;
          state.errorDetail = action.payload ?? null;
        }
      })
      .addCase(login.pending, startSubmit)
      .addCase(register.pending, startSubmit)
      .addCase(logout.pending, startSubmit)
      .addCase(login.fulfilled, setAuthenticated)
      .addCase(register.fulfilled, setAuthenticated)
      .addCase(login.rejected, endSubmit)
      .addCase(register.rejected, endSubmit)
      .addCase(logout.rejected, endSubmit)
      .addCase(logout.fulfilled, (state) => {
        state.status = "unauthenticated";
        state.user = null;
        state.error = null;
        state.errorDetail = null;
        state.submitting = false;
      });
  },
});

export const selectAuth = (state) => state.auth;
export const selectCurrentUser = (state) =>
  state.auth.status === "authenticated" ? state.auth.user : null;

export default authSlice.reducer;
