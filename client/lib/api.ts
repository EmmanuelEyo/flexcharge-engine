import axios from "axios";
import { getSession } from "next-auth/react";
import { API_BASE_URL } from "./constants";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 10_000,
});

api.interceptors.request.use(async (config) => {
  let token: string | undefined;

  if (typeof window !== "undefined") {
    const session = await getSession();
    token = (session as any)?.accessToken;

    if (!token) {
      token = localStorage.getItem("fc_token") ?? undefined;
    }
  } else {
    const { getServerSession } = await import("next-auth");
    const { authOptions } = await import("@/lib/authOptions");
    const session = await getServerSession(authOptions);
    token = (session as any)?.accessToken;
  }

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});


api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("fc_token");
      localStorage.removeItem("fc_user");
      import("next-auth/react").then(({ signOut }) => {
        signOut({ callbackUrl: "/login" });
      }).catch(() => {
        window.location.href = "/login";
      });
    }
    const message = error?.response?.data?.error ?? error?.response?.data?.message ?? error.message ?? "An error occurred";
    return Promise.reject(new Error(message));
  }
);

export default api;
