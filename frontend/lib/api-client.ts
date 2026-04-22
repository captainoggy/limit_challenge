import axios from 'axios';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000/api';

export const apiClient = axios.create({
  baseURL: apiBaseUrl,
  timeout: 15_000,
});

// Render's free tier takes ~55s to warm up after 15 min of inactivity. The
// default 15s timeout is the right guardrail for everything else, but any
// fetch that runs on initial page load has to outlive a cold start — otherwise
// the request aborts mid-warmup and the user sees an error alert before the
// cold-start banner can auto-reload at zero. Pass this as a per-request
// `timeout` override on those fetches.
export const COLD_START_TIMEOUT_MS = 60_000;
