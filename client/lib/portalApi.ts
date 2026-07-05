import axios from "axios";
import { API_BASE_URL } from "./constants";

const portalApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10_000,
});

portalApi.interceptors.request.use((config) => {
  let token: string | undefined;

  if (typeof window !== "undefined") {
    token = sessionStorage.getItem("fc_portal_token") ?? undefined;
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

portalApi.interceptors.response.use(
  (response) => response,
  (error) => {
    // If we get a 401 Unauthorized in the portal, the token might be expired.
    // We should probably redirect to an expired session page, but for now we'll just throw.
    if (error?.response?.status === 401 && typeof window !== "undefined") {
      sessionStorage.removeItem("fc_portal_token");
      
      // Safeguard: Only redirect if not already on the portal entry page
      if (window.location.pathname !== "/portal") {
        window.location.href = "/portal"; // Will redirect to an error state or request a new link
      }
    }
    const message = error?.response?.data?.message ?? error?.response?.data?.error ?? error.message ?? "An error occurred";
    return Promise.reject(new Error(message));
  }
);

export default portalApi;
