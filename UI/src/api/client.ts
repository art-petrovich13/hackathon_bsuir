// frontend/src/api/client.ts
import axios, { AxiosError } from "axios";

// Базовый URL — в dev берём из vite proxy, в prod из env
const BASE_URL = import.meta.env.VITE_API_URL || "";

export const apiClient = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor — можно добавить токен авторизации в будущем
apiClient.interceptors.request.use(
  (config) => {
    // TODO: добавить Bearer токен если понадобится авторизация
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — нормализовать ошибки
apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 501) {
      console.warn("Endpoint not implemented yet:", error.config?.url);
    }
    if (error.response?.status === 422) {
      console.error("Validation error:", error.response.data);
    }
    return Promise.reject(error);
  }
);

export default apiClient;