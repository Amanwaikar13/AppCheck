import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { API_URL } from "@/lib/config";
import { describeApiError } from "@/services/apiClient";
import { fetchHealth } from "@/services/healthService";

export const checkBackendHealth = createAsyncThunk(
  "health/check",
  async (_, { rejectWithValue }) => {
    if (!API_URL) {
      return rejectWithValue(
        "NEXT_PUBLIC_API_URL is not set. Copy frontend/.env.example to frontend/.env.local and restart the dev server."
      );
    }
    try {
      return await fetchHealth();
    } catch (error) {
      return rejectWithValue(describeApiError(error));
    }
  },
  {
    // The header indicator, sidebar footer, and status cards all read health;
    // only one check is in flight at a time.
    condition: (_arg, { getState }) => getState().health.requestStatus !== "loading",
  }
);

const initialState = {
  // idle | loading | succeeded | failed
  requestStatus: "idle",
  report: null,
  error: null,
  checkedAt: null,
};

const healthSlice = createSlice({
  name: "health",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(checkBackendHealth.pending, (state) => {
        state.requestStatus = "loading";
        state.error = null;
      })
      .addCase(checkBackendHealth.fulfilled, (state, action) => {
        state.requestStatus = "succeeded";
        state.report = action.payload;
        state.checkedAt = new Date().toISOString();
      })
      .addCase(checkBackendHealth.rejected, (state, action) => {
        state.requestStatus = "failed";
        state.report = null;
        state.error = action.payload ?? action.error.message;
        state.checkedAt = new Date().toISOString();
      });
  },
});

export const selectHealth = (state) => state.health;

export default healthSlice.reducer;
