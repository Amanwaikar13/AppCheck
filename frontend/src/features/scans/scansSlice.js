import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { login, logout, register } from "@/features/auth/authSlice";
import { API_URL } from "@/lib/config";
import { toApiError } from "@/services/apiClient";
import * as scanService from "@/services/scanService";

const MISSING_API_URL = {
  status: null,
  code: "CONFIG_ERROR",
  message:
    "NEXT_PUBLIC_API_URL is not set. Copy frontend/.env.example to frontend/.env.local and restart the dev server.",
  fieldErrors: {},
};

function scanThunk(type, request, condition) {
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

// Skip a read when the identical request is already in flight (React Strict
// Mode runs effects twice in development; components can remount mid-request).
const sameArg = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const notDuplicate = (key) => (arg, { getState }) => {
  const slot = getState().scans[key];
  return !(slot.status === "loading" && sameArg(slot.arg, arg));
};

export const createUrlScan = scanThunk("scans/createUrl", scanService.createUrlScan);
export const createSourceScan = scanThunk("scans/createSource", scanService.createSourceScan);
export const fetchScans = scanThunk("scans/fetchList", scanService.listScans, notDuplicate("list"));
/** Dashboard summary (GET /scans/summary): one request for counts, recent scans, and findings. */
export const fetchScanSummary = scanThunk("scans/fetchSummary", () => scanService.getScanSummary(), notDuplicate("recent"));
export const fetchScanFindings = scanThunk("scans/fetchFindings", scanService.getScanFindings, notDuplicate("findings"));
export const fetchScannerStatus = scanThunk("scans/fetchScannerStatus", () => scanService.getScannerStatus(), notDuplicate("scanner"));
export const fetchScan = scanThunk("scans/fetchOne", scanService.getScan, notDuplicate("detail"));

export const DEFAULT_SCAN_QUERY = { page: 1, limit: 10, type: "", status: "", sort: "-createdAt" };

// Each request slot: idle | loading | succeeded | failed. `requestId` makes
// sure a slow, older response never overwrites a newer one.
const initialState = {
  query: DEFAULT_SCAN_QUERY,
  list: { status: "idle", items: [], pagination: null, error: null, requestId: null },
  // Dashboard summary from GET /scans/summary.
  recent: { status: "idle", items: [], counts: null, findings: null, error: null, requestId: null },
  // Findings of the scan shown on the detail page (`id` = that scan).
  findings: { status: "idle", id: null, items: [], error: null, requestId: null },
  // URL scanner availability from GET /scanner/status.
  scanner: { status: "idle", data: null, error: null, requestId: null },
  // `id` is the scan ID the slot's status, record, and error belong to.
  detail: { status: "idle", id: null, scan: null, error: null, requestId: null },
};

function trackRequest(builder, thunk, key, onSuccess, onPending) {
  builder
    .addCase(thunk.pending, (state, action) => {
      state[key].status = "loading";
      state[key].error = null;
      state[key].requestId = action.meta.requestId;
      state[key].arg = action.meta.arg ?? null;
      onPending?.(state[key], action.meta.arg);
    })
    .addCase(thunk.fulfilled, (state, action) => {
      if (state[key].requestId !== action.meta.requestId) return;
      state[key].status = "succeeded";
      onSuccess(state[key], action.payload);
    })
    .addCase(thunk.rejected, (state, action) => {
      if (state[key].requestId !== action.meta.requestId) return;
      state[key].status = "failed";
      state[key].error = action.payload ?? { message: action.error.message, code: "CLIENT_ERROR" };
    });
}

const scansSlice = createSlice({
  name: "scans",
  initialState,
  reducers: {
    /** Merges query changes. Changing filters, sort, or page size returns to page 1. */
    updateScanQuery(state, action) {
      const changes = action.payload;
      const resetsPage = ["type", "status", "sort", "limit"].some((key) => key in changes);
      state.query = { ...state.query, ...(resetsPage ? { page: 1 } : {}), ...changes };
    },
    resetScanQuery(state) {
      state.query = DEFAULT_SCAN_QUERY;
    },
  },
  extraReducers: (builder) => {
    trackRequest(builder, fetchScans, "list", (slot, payload) => {
      slot.items = payload.items;
      slot.pagination = payload.pagination;
    });
    trackRequest(builder, fetchScanSummary, "recent", (slot, payload) => {
      slot.items = payload.recent;
      slot.counts = payload.counts;
      slot.findings = payload.findings;
    });
    trackRequest(
      builder,
      fetchScanFindings,
      "findings",
      (slot, payload) => {
        slot.items = payload.items;
      },
      (slot, id) => {
        slot.id = id;
      }
    );
    trackRequest(builder, fetchScannerStatus, "scanner", (slot, payload) => {
      slot.data = payload;
    });
    trackRequest(
      builder,
      fetchScan,
      "detail",
      (slot, payload) => {
        slot.scan = payload;
      },
      (slot, id) => {
        slot.id = id;
      }
    );

    // A new record makes cached lists stale; mark them for refetch.
    const invalidateLists = (state) => {
      state.list.status = "idle";
      state.recent.status = "idle";
    };
    builder.addCase(createUrlScan.fulfilled, invalidateLists);
    builder.addCase(createSourceScan.fulfilled, invalidateLists);

    // Scan records belong to one account: drop them whenever the account changes.
    const reset = () => initialState;
    builder.addCase(login.fulfilled, reset);
    builder.addCase(register.fulfilled, reset);
    builder.addCase(logout.fulfilled, reset);
  },
});

export const { updateScanQuery, resetScanQuery } = scansSlice.actions;

export const selectScanQuery = (state) => state.scans.query;
export const selectScanList = (state) => state.scans.list;
export const selectRecentScans = (state) => state.scans.recent;
export const selectScanDetail = (state) => state.scans.detail;
export const selectScanFindings = (state) => state.scans.findings;
export const selectScannerStatus = (state) => state.scans.scanner;

export default scansSlice.reducer;
